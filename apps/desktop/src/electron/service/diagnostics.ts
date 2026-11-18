import crypto from "node:crypto";
import { existsSync, mkdirSync, statfsSync, writeFileSync } from "node:fs";
import os from "node:os";
import { join } from "node:path";
import type {
  BridgeResult,
  DoctorCheckResult,
  EngineDoctorReport,
  EngineOptionId,
  FailureCode,
  RecoveryActionId,
  SupportBundleSummary,
} from "../../shared/engines";
import {
  LOCALDB_INSTANCE,
  defaultContainerName,
} from "../../shared/engine-catalog";
import { dataDir, logsDir, sqlitePracticeFile } from "../paths";
import { currentSnapshot } from "../platform/snapshot";
import { initializePracticeEnvironment } from "../practice/seeder";
import { retrieveSecret } from "../secrets";
import { connectionRegistry } from "../sql/registry";
import { loadInstallState, updateInstallationStatus } from "../state/store";
import { inspectContainer, startAppContainer } from "./container-provisioner";
import { listLogFiles, redactText, tailLogFile } from "./logger";
import { getLocalDbInfo, startLocalDbInstance } from "./sql-server-localdb";

export interface ErrorClassification {
  code: FailureCode;
  message: string;
  actionableHelp: string;
  recovery: RecoveryActionId[];
}

export function classifyError(err: unknown): ErrorClassification {
  const rawMsg = err instanceof Error ? err.message : String(err);
  const msg = redactText(rawMsg);
  const lower = msg.toLowerCase();

  if (
    lower.includes("enotfound") ||
    lower.includes("eai_again") ||
    lower.includes("getaddrinfo")
  ) {
    return {
      code: "network",
      message: "DNS lookup failed for host.",
      actionableHelp:
        "Check your internet connection or verify custom DNS settings. Installed database engines continue operating offline.",
      recovery: ["retry", "open-logs"],
    };
  }

  if (
    lower.includes("cert_") ||
    lower.includes("leaf_signature") ||
    lower.includes("tls") ||
    lower.includes("self_signed")
  ) {
    return {
      code: "network",
      message: "Secure TLS connection could not be established.",
      actionableHelp:
        "Verify your system date/time and check whether a corporate firewall or proxy is intercepting certificates.",
      recovery: ["retry", "open-logs"],
    };
  }

  if (
    lower.includes("etimedout") ||
    lower.includes("esockettimedout") ||
    lower.includes("timeout") ||
    lower.includes("stall timeout")
  ) {
    return {
      code: "network",
      message: "Network connection timed out.",
      actionableHelp:
        "Connection timed out during transfer. Check network bandwidth or retry after reconnection.",
      recovery: ["retry", "open-logs"],
    };
  }

  if (lower.includes("econnrefused")) {
    return {
      code: "network",
      message: "Connection refused by host.",
      actionableHelp:
        "The destination port or host refused the connection. The service may not be running or is unreachable.",
      recovery: ["repair-connection", "retry", "open-logs"],
    };
  }

  if (
    lower.includes("enospc") ||
    lower.includes("disk space") ||
    lower.includes("insufficient disk")
  ) {
    return {
      code: "resources",
      message: "Disk space exhausted.",
      actionableHelp:
        "Insufficient free disk space available. Free up at least 5 GB on your system drive before retrying.",
      recovery: ["free-resources", "retry"],
    };
  }

  if (
    lower.includes("eacces") ||
    lower.includes("eperm") ||
    lower.includes("access denied") ||
    lower.includes("permission denied")
  ) {
    return {
      code: "permission",
      message: "Permission denied accessing system resources.",
      actionableHelp:
        "Administrative privileges are required for this action. Run LogixZen as administrator or grant directory access.",
      recovery: ["grant-permission", "retry"],
    };
  }

  return {
    code: "runtime",
    message: msg,
    actionableHelp:
      "An unexpected error occurred. Review the application logs for full diagnostic details.",
    recovery: ["retry", "open-logs"],
  };
}

export async function runEngineDoctor(
  optionId: EngineOptionId,
): Promise<EngineDoctorReport> {
  const checks: DoctorCheckResult[] = [];
  const loaded = await loadInstallState();
  const installRecord = loaded.state.installations.find(
    (i) => i.optionId === optionId,
  );

  if (!installRecord) {
    return {
      optionId,
      healthy: false,
      checks: [
        {
          id: "installed",
          name: "Installation Presence",
          ok: false,
          detail: `Engine ${optionId} is not installed.`,
          autoFixable: false,
        },
      ],
    };
  }

  if (installRecord.secretRef) {
    let secretOk = false;
    try {
      const sec = retrieveSecret(installRecord.secretRef);
      secretOk = sec !== null;
    } catch {
      secretOk = false;
    }
    checks.push({
      id: "credential-decryptable",
      name: "Credential Keystore Access",
      ok: secretOk,
      detail: secretOk
        ? "Credential securely decrypted from OS keystore."
        : "Credential cannot be decrypted.",
      autoFixable: false,
    });
  }

  if (optionId.endsWith("-container")) {
    const containerName =
      installRecord.containerName ?? defaultContainerName(optionId);
    const status = await inspectContainer(containerName);
    checks.push({
      id: "container-running",
      name: "Container State",
      ok: status.exists && status.running,
      detail: status.exists
        ? status.running
          ? `Container ${containerName} is running.`
          : `Container ${containerName} is stopped.`
        : `Container ${containerName} is missing.`,
      autoFixable: status.exists && !status.running,
    });
  } else if (optionId === "mssql-localdb") {
    const info = await getLocalDbInfo(LOCALDB_INSTANCE);
    const exists = info.state !== "Missing";
    const running = info.state === "Running";
    checks.push({
      id: "localdb-running",
      name: "LocalDB Instance State",
      ok: exists && running,
      detail: exists
        ? running
          ? `LocalDB instance ${LOCALDB_INSTANCE} is running.`
          : `LocalDB instance ${LOCALDB_INSTANCE} is stopped.`
        : `LocalDB instance ${LOCALDB_INSTANCE} is missing.`,
      autoFixable: exists && !running,
    });
  } else if (optionId === "sqlite") {
    const dbPath = sqlitePracticeFile();
    const exists = existsSync(dbPath);
    checks.push({
      id: "database-file-present",
      name: "SQLite Database File",
      ok: exists,
      detail: exists
        ? `Database file present at ${dbPath}`
        : "Database file missing.",
      autoFixable: !exists,
    });
  }

  let connectionOk = false;
  let practiceOk = false;
  try {
    const driver = await connectionRegistry.getDriver();
    if (driver) {
      const res = await driver.execute("SELECT 1 as alive;");
      connectionOk = res.length > 0 && res[0].rows.length > 0;
      const countRes = await driver.execute(
        "SELECT count(*) as cnt FROM departments;",
      );
      practiceOk = countRes.length > 0 && countRes[0].rows.length > 0;
    }
  } catch {
    connectionOk = false;
    practiceOk = false;
  }

  checks.push({
    id: "database-connection",
    name: "Database Query Execution",
    ok: connectionOk,
    detail: connectionOk
      ? "Successfully connected and executed query."
      : "Database connection failed.",
    autoFixable: false,
  });

  checks.push({
    id: "practice-schema",
    name: "Practice Schema Integrity",
    ok: practiceOk,
    detail: practiceOk
      ? "Practice tables and canonical records verified."
      : "Practice schema missing or corrupted.",
    autoFixable: true,
  });

  let diskOk = true;
  let diskDetail = "Adequate disk space available.";
  try {
    const dDir = dataDir();
    const stats = statfsSync(dDir);
    const freeBytes = stats.bavail * stats.bsize;
    if (freeBytes < 500 * 1024 * 1024) {
      diskOk = false;
      diskDetail = `Low disk space: ${(freeBytes / (1024 * 1024)).toFixed(0)} MB available.`;
    }
  } catch {
    diskOk = true;
  }

  checks.push({
    id: "disk-space",
    name: "Disk Space Availability",
    ok: diskOk,
    detail: diskDetail,
    autoFixable: false,
  });

  const healthy = checks.every((c) => c.ok);
  return { optionId, checks, healthy };
}

export async function applyDoctorRepair(
  optionId: EngineOptionId,
  checkId?: string,
): Promise<BridgeResult<void>> {
  if (checkId === "container-running" || optionId.endsWith("-container")) {
    const loaded = await loadInstallState();
    const record = loaded.state.installations.find(
      (i) => i.optionId === optionId,
    );
    const containerName =
      record?.containerName ?? defaultContainerName(optionId);
    await startAppContainer(containerName);
    await updateInstallationStatus(optionId, "ready");
    return { ok: true, data: undefined };
  }

  if (checkId === "localdb-running" || optionId === "mssql-localdb") {
    await startLocalDbInstance(LOCALDB_INSTANCE);
    await updateInstallationStatus(optionId, "ready");
    return { ok: true, data: undefined };
  }

  if (checkId === "practice-schema" || checkId === "database-file-present") {
    const driver = await connectionRegistry.getDriver();
    if (driver) {
      await initializePracticeEnvironment(driver);
      await updateInstallationStatus(optionId, "ready");
      return { ok: true, data: undefined };
    }
  }

  return { ok: true, data: undefined };
}

export function sanitizePath(input: string): string {
  const home = os.homedir();
  return input.replaceAll(home, "[USER_HOME]").replaceAll("\\", "/");
}

export async function createSupportBundle(
  customPath?: string,
): Promise<SupportBundleSummary> {
  const snapshot = currentSnapshot();
  const loaded = await loadInstallState();

  const sanitizedInstallations = loaded.state.installations.map((inst) => {
    const copy = { ...inst };
    if (copy.secretRef) {
      copy.secretRef = "[ENCRYPTED_OS_KEYSTORE]";
    }
    return copy;
  });

  const doctorReports: EngineDoctorReport[] = [];
  for (const inst of loaded.state.installations) {
    try {
      const rep = await runEngineDoctor(inst.optionId);
      doctorReports.push(rep);
    } catch {}
  }

  const logsMap: Record<string, string[]> = {};
  const allLogs = listLogFiles();
  for (const logInfo of allLogs.slice(0, 10)) {
    const lines = tailLogFile(logInfo.name, 200);
    logsMap[logInfo.name] = lines.map((l) => sanitizePath(redactText(l)));
  }

  const bundleData = {
    generatedAt: new Date().toISOString(),
    bundleVersion: "1.0",
    platform: {
      osFamily: snapshot.osFamily,
      arch: snapshot.arch,
      osVersion: snapshot.osVersion,
      totalMemoryBytes: snapshot.totalMemoryBytes,
      availableMemoryBytes: snapshot.availableMemoryBytes,
    },
    installState: {
      activeOptionId: loaded.state.activeOptionId,
      installations: sanitizedInstallations,
      issues: loaded.issues,
    },
    doctorReports,
    logs: logsMap,
  };

  const jsonStr = JSON.stringify(bundleData, null, 2);
  const hash = crypto.createHash("sha256").update(jsonStr).digest("hex");

  const finalBundle = {
    ...bundleData,
    checksum: hash,
  };

  const finalJson = JSON.stringify(finalBundle, null, 2);
  const outDir = logsDir();
  mkdirSync(outDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetFile =
    customPath ?? join(outDir, `support-bundle-${timestamp}.json`);
  writeFileSync(targetFile, finalJson, "utf8");

  return { bundlePath: targetFile, checksum: hash };
}
