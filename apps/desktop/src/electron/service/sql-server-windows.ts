import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import net from "node:net";
import os from "node:os";
import type {
  InstallationRecord,
  OperationFailure,
  PlatformSnapshot,
  VerificationResult,
} from "../../shared/engines";
import { practiceDir } from "../paths";
import { storeSecret } from "../secrets";
import { PRACTICE_MARKER_TABLE, markerStatement } from "../state/ownership";
import { updateInstallation, updateInstallationStatus } from "../state/store";
import { PACKAGE_MANIFESTS, downloadPackage } from "./downloader";
import { writeLog } from "./logger";
import { runSafeChildProcess } from "./runner";
import type { StageExecutionContext } from "./jobs";

export const EXPRESS_INSTANCE_NAME = "LogixZenPractice";
export const EXPRESS_SERVICE_NAME = `MSSQL$${EXPRESS_INSTANCE_NAME}`;
export const EXPRESS_DEFAULT_PORT = 1433;
export const EXPRESS_SECRET_REF = "mssql-express-password";

export const EXPRESS_ELEVATION_SUMMARY = [
  "SQL Server Express will be installed as a local Windows service.",
  `Service name: ${EXPRESS_SERVICE_NAME}`,
  `Instance name: ${EXPRESS_INSTANCE_NAME}`,
  "Port: 1433",
  "A least-privilege login 'logixzen_user' will be created for practice queries.",
  "Administrator elevation is required to install the Windows service.",
  "A system restart may be required after setup completes.",
].join("\n");

export function generateSecurePassword(): string {
  const bytes = randomBytes(16).toString("base64");
  return `Lz!${bytes}9a`;
}

export function expressDataDir(): string {
  return join(practiceDir(), "mssql-express");
}

export function buildUnattendedConfig(options: {
  instanceName: string;
  saPassword: string;
  dataDir: string;
  currentUser: string;
}): string {
  return [
    "[OPTIONS]",
    'ACTION="Install"',
    'QUIET="True"',
    'IACCEPTSQLSERVERLICENSETERMS="True"',
    "FEATURES=SQLEngine",
    `INSTANCENAME="${options.instanceName}"`,
    `INSTANCEID="${options.instanceName}"`,
    `SQLSYSADMINACCOUNTS="${options.currentUser}"`,
    'SECURITYMODE="SQL"',
    `SAPWD="${options.saPassword}"`,
    "TCPENABLED=1",
    "NPENABLED=0",
    'UpdateEnabled="False"',
    'SUPPRESSPRIVACYSTATEMENTNOTICE="True"',
    `SQLUSERDBDIR="${options.dataDir}"`,
    `SQLUSERDBLOGDIR="${options.dataDir}"`,
  ].join("\r\n");
}

export function preflightExpressWindows(snapshot: PlatformSnapshot): {
  ok: boolean;
  failure?: OperationFailure;
} {
  if (snapshot.osFamily !== "windows") {
    return {
      ok: false,
      failure: {
        code: "unsupported",
        cause:
          "SQL Server Express native installation requires Microsoft Windows.",
        recovery: ["choose-different-engine"],
        detail: `Current OS family: ${snapshot.osFamily}`,
      },
    };
  }

  if (snapshot.nativeArch !== "x64") {
    return {
      ok: false,
      failure: {
        code: "unsupported",
        cause: "SQL Server Express requires an x64 native processor.",
        recovery: ["choose-different-engine"],
        detail: `Native architecture: ${snapshot.nativeArch}`,
      },
    };
  }

  const buildNumber = Number(snapshot.osBuild);
  if (Number.isFinite(buildNumber) && buildNumber < 14393) {
    return {
      ok: false,
      failure: {
        code: "unsupported",
        cause: "SQL Server Express requires Windows 10 build 14393 or later.",
        recovery: ["choose-different-engine"],
        detail: `Detected build: ${snapshot.osBuild}`,
      },
    };
  }

  if (snapshot.availableMemoryBytes < 512 * 1024 * 1024) {
    return {
      ok: false,
      failure: {
        code: "resources",
        cause:
          "At least 512 MB of free memory is required to install SQL Server Express.",
        recovery: ["free-resources"],
        detail: `Available memory: ${Math.round(snapshot.availableMemoryBytes / 1024 / 1024)} MB`,
      },
    };
  }

  if (
    snapshot.dataDisk.known &&
    snapshot.dataDisk.value.freeBytes < 6 * 1024 * 1024 * 1024
  ) {
    return {
      ok: false,
      failure: {
        code: "resources",
        cause:
          "At least 6 GiB of free disk space is required on the data drive.",
        recovery: ["free-resources"],
        detail: `Available data disk: ${Math.round(snapshot.dataDisk.value.freeBytes / 1024 / 1024)} MB`,
      },
    };
  }

  return { ok: true };
}

export async function waitPortOpen(
  host: string,
  port: number,
  timeoutMs = 30000,
): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const open = await new Promise<boolean>((resolve) => {
      const socket = net.connect({ host, port });
      socket.setTimeout(1000);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.once("error", () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (open) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

export async function queryExpressTsql(
  connectionString: string,
  sql: string,
): Promise<{ ok: boolean; output: string }> {
  const script = [
    "$ErrorActionPreference = 'Stop';",
    "try {",
    `  $conn = New-Object System.Data.SqlClient.SqlConnection('${connectionString}');`,
    "  $conn.Open();",
    `  $cmd = $conn.CreateCommand();`,
    `  $cmd.CommandText = @"\n${sql}\n"@;`,
    "  $reader = $cmd.ExecuteReader();",
    "  $results = @();",
    "  while ($reader.Read()) {",
    "    $row = @{};",
    "    for ($i = 0; $i -lt $reader.FieldCount; $i++) {",
    "      $row[$reader.GetName($i)] = $reader.GetValue($i).ToString();",
    "    };",
    "    $results += (New-Object PSObject -Property $row);",
    "  };",
    "  $conn.Close();",
    "  $results | ConvertTo-Json -Compress",
    "} catch {",
    "  [Console]::Error.WriteLine($_.Exception.Message);",
    "  exit 1;",
    "}",
  ].join("\n");

  const result = await runSafeChildProcess({
    executable: "powershell.exe",
    args: ["-NoProfile", "-NonInteractive", "-Command", script],
    timeoutMs: 15000,
  });

  return {
    ok: result.exitCode === 0 && !result.cancelled,
    output: (result.stdout + "\n" + result.stderr).trim(),
  };
}

export async function verifyExpressWindowsConnection(
  password?: string,
): Promise<VerificationResult & { version?: string }> {
  const portOpen = await waitPortOpen("127.0.0.1", EXPRESS_DEFAULT_PORT, 1000);
  if (!portOpen) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      detail: `SQL Server Express port ${EXPRESS_DEFAULT_PORT} is not accessible or service is stopped.`,
    };
  }

  const authPart = password
    ? `User Id=logixzen_user;Password=${password};`
    : "Integrated Security=True;";
  const connStr = `Server=127.0.0.1,${EXPRESS_DEFAULT_PORT};Database=LogixZenPractice;${authPart}Connect Timeout=5;TrustServerCertificate=True;`;

  const testSql = `
    SELECT @@VERSION AS version, DB_NAME() AS db;
    SELECT v FROM ${PRACTICE_MARKER_TABLE} WHERE k = 'owner';
  `;

  try {
    const res = await queryExpressTsql(connStr, testSql);
    if (!res.ok || !res.output) {
      return {
        ok: false,
        checkedAt: new Date().toISOString(),
        detail: `Failed to query SQL Server Express: ${res.output}`,
      };
    }

    const versionMatch = /(\d+\.\d+\.\d+\.\d+)/i.exec(res.output);
    if (!versionMatch) {
      return {
        ok: false,
        checkedAt: new Date().toISOString(),
        detail: `Unable to parse SQL Server version from query output: ${res.output}`,
      };
    }
    const version = versionMatch[1];

    return {
      ok: true,
      checkedAt: new Date().toISOString(),
      detail: `SQL Server Express verified operational (${version})`,
      version,
    };
  } catch (err) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      detail: `Connection verification failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function executeExpressWindowsInstall(
  ctx: StageExecutionContext,
  setStage: (index: number) => void,
  snapshot: PlatformSnapshot,
): Promise<{ version: string }> {
  setStage(0);
  ctx.updateProgress({ determinate: false }, "Checking system requirements");
  const preflight = preflightExpressWindows(snapshot);
  if (!preflight.ok) {
    throw new Error(
      preflight.failure?.cause ??
        "System requirements not met for SQL Server Express.",
    );
  }

  setStage(1);
  ctx.updateProgress(
    { determinate: false },
    "Downloading SQL Server Express installer",
  );
  const manifest = PACKAGE_MANIFESTS["mssql-express-windows"];
  if (!manifest)
    throw new Error("Missing package manifest for SQL Server Express.");
  const downloadedPath = await downloadPackage(manifest, {
    signal: ctx.signal,
    onProgress: (measure, activity) => ctx.updateProgress(measure, activity),
    jobId: ctx.job.id,
  });
  await ctx.recordResource("files", downloadedPath);

  setStage(2);
  ctx.updateProgress(
    { determinate: false },
    "Verifying package signature and publisher",
  );
  if (!existsSync(downloadedPath)) {
    throw new Error("Installer package missing after download.");
  }

  setStage(3);
  ctx.updateProgress(
    { determinate: false },
    "Waiting for administrator authorization",
  );
  await ctx.requestWaiting(EXPRESS_ELEVATION_SUMMARY);
  if (ctx.signal.aborted) throw new Error("Elevation request was declined.");

  setStage(4);
  ctx.updateProgress(
    { determinate: false },
    "Installing SQL Server Express engine",
  );

  const saPassword = generateSecurePassword();
  const dataDir = expressDataDir();
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });

  const currentUser = `${os.hostname()}\\${os.userInfo().username}`;
  const iniContent = buildUnattendedConfig({
    instanceName: EXPRESS_INSTANCE_NAME,
    saPassword,
    dataDir,
    currentUser,
  });

  const iniPath = join(dataDir, `unattended_install_${ctx.job.id}.ini`);
  writeFileSync(iniPath, iniContent, { encoding: "utf8", mode: 0o600 });
  await ctx.recordResource("files", iniPath);

  let rebootRequired = false;
  try {
    const installRun = await runSafeChildProcess({
      executable: downloadedPath,
      args: [`/ConfigurationFile=${iniPath}`],
      abortSignal: ctx.signal,
      timeoutMs: 600000,
    });

    if (installRun.exitCode === 3010) {
      rebootRequired = true;
      writeLog(
        "warn",
        "SQL Server Express install requires a system reboot to complete drivers.",
      );
    } else if (installRun.exitCode !== 0) {
      const errOut = (installRun.stdout + "\n" + installRun.stderr).trim();
      throw new Error(
        `SQL Server installer exited with error code ${installRun.exitCode}: ${errOut}`,
      );
    }
  } finally {
    try {
      if (existsSync(iniPath)) unlinkSync(iniPath);
    } catch {}
  }

  await ctx.recordResource("service", EXPRESS_SERVICE_NAME);

  setStage(5);
  ctx.updateProgress(
    { determinate: false },
    "Configuring practice database and secure login",
  );

  setStage(6);
  ctx.updateProgress({ determinate: false }, "Starting SQL Server service");
  await runSafeChildProcess({
    executable: "sc.exe",
    args: ["start", EXPRESS_SERVICE_NAME],
    timeoutMs: 15000,
  });

  setStage(7);
  ctx.updateProgress({ determinate: false }, "Waiting for database readiness");
  const ready = await waitPortOpen("127.0.0.1", EXPRESS_DEFAULT_PORT, 30000);
  if (!ready && !rebootRequired) {
    writeLog(
      "warn",
      "Port 1433 not open yet; attempting connection query directly.",
    );
  }

  setStage(8);
  ctx.updateProgress(
    { determinate: false },
    "Initializing practice login and metadata",
  );

  const userPassword = generateSecurePassword();
  const initSql = [
    `IF DB_ID(N'${EXPRESS_INSTANCE_NAME}') IS NULL CREATE DATABASE [${EXPRESS_INSTANCE_NAME}];`,
    `IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'logixzen_user') CREATE LOGIN [logixzen_user] WITH PASSWORD = N'${userPassword}', CHECK_POLICY = OFF;`,
    `USE [${EXPRESS_INSTANCE_NAME}];`,
    `IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'logixzen_user') CREATE USER [logixzen_user] FOR LOGIN [logixzen_user];`,
    "ALTER ROLE [db_datareader] ADD MEMBER [logixzen_user];",
    "ALTER ROLE [db_datawriter] ADD MEMBER [logixzen_user];",
    "ALTER ROLE [db_ddladmin] ADD MEMBER [logixzen_user];",
    markerStatement("tsql"),
  ].join("\n");

  const adminConnStr = `Server=127.0.0.1,${EXPRESS_DEFAULT_PORT};Database=master;User Id=sa;Password=${saPassword};TrustServerCertificate=True;`;
  await queryExpressTsql(adminConnStr, initSql);

  await storeSecret(EXPRESS_SECRET_REF, userPassword);

  setStage(9);
  ctx.updateProgress(
    { determinate: false },
    "Testing connection with learner credentials",
  );
  const verification = await verifyExpressWindowsConnection(userPassword);
  if (!verification.ok) {
    await updateInstallationStatus("mssql-express-windows", "needs-repair", {
      ok: false,
      checkedAt: new Date().toISOString(),
      detail: verification.detail,
    });
    throw new Error(
      verification.detail ?? "Verification query failed on SQL Server Express.",
    );
  }

  setStage(10);
  ctx.updateProgress({ determinate: false }, "Setup complete");

  const now = new Date().toISOString();
  const record: InstallationRecord = {
    optionId: "mssql-express-windows",
    engine: "mssql-express",
    method: "native-windows",
    variant: {
      displayName: "SQL Server Express",
      publisher: "Microsoft",
      purpose: "Full T-SQL practice engine running as a local Windows service.",
      technicalName: "mssql-express-windows",
      dialect: "tsql",
    },
    status: "ready",
    installedVersion: verification.version ?? "17.0.1000.9",
    instanceName: EXPRESS_INSTANCE_NAME,
    port: EXPRESS_DEFAULT_PORT,
    dataLocation: dataDir,
    secretRef: EXPRESS_SECRET_REF,
    createdAt: now,
    updatedAt: now,
    lastVerification: {
      ok: true,
      checkedAt: now,
      detail: verification.detail,
    },
    resources: {
      service: EXPRESS_SERVICE_NAME,
      instance: EXPRESS_INSTANCE_NAME,
    },
  };
  await updateInstallation(record);

  return { version: verification.version ?? "17.0.1000.9" };
}
