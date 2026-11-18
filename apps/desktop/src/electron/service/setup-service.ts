import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { shell } from "electron";
import type {
  BackupManifest,
  BridgeResult,
  ContainerLifecycleAction,
  ContainerStats,
  ContainerTechnicalDetails,
  DiagnosticsSummary,
  DockerGuidanceContent,
  DocsTopicId,
  EngineCatalogEntry,
  EngineDoctorReport,
  EngineId,
  EngineOffer,
  EngineOptionId,
  InstallationRecord,
  Job,
  JobKind,
  LogFileSummary,
  OrphanContainerSummary,
  PlatformSnapshot,
  StartJobRequest,
  SupportBundleSummary,
  VerificationResult,
} from "../../shared/engines";
import {
  ENGINE_CATALOG,
  LOCALDB_INSTANCE,
  defaultContainerName,
  defaultVolumeName,
  resolveEngineOffers,
} from "../../shared/engine-catalog";
import { currentSnapshot, refreshSnapshot } from "../platform/snapshot";
import { backupsDir, sqlitePracticeFile } from "../paths";
import { deleteSecret, retrieveSecret } from "../secrets";
import {
  loadInstallState,
  mutateInstallState,
  updateInstallationStatus,
} from "../state/store";
import { connectionRegistry } from "../sql/registry";
import {
  resetPracticeEnvironment,
  initializePracticeEnvironment,
} from "../practice/seeder";
import { activateSqlite, verifySqlitePractice } from "./sqlite";
import {
  executeExpressWindowsInstall,
  verifyExpressWindowsConnection,
} from "./sql-server-windows";
import {
  createLocalDbInstance,
  executeLocalDbInstall,
  getLocalDbInfo,
  startLocalDbInstance,
  stopLocalDbInstance,
  verifyLocalDbConnection,
} from "./sql-server-localdb";
import {
  executeExpressLinuxInstall,
  verifyLinuxExpressConnection,
} from "./sql-server-linux";
import {
  clearContainerReadinessCache,
  getDockerInstallationGuidance,
  isOfficialUrl,
  probeContainerReadinessSync,
} from "./docker";
import {
  cleanupOrphanContainer as cleanupOrphanContainerFn,
  executeContainerProvision,
  findOrphanAppContainers,
  inspectContainer,
  inspectContainerTechnicalDetails,
  pullImageWithProgress,
  removeAppContainer,
  restartAppContainer,
  startAppContainer,
  stopAppContainer,
  verifyContainerConnection,
} from "./container-provisioner";
import {
  cleanupBackups as cleanupBackupsFn,
  createBackup,
  listBackups as listBackupsFn,
} from "./backup-restore";
import {
  applyDoctorRepair,
  createSupportBundle,
  runEngineDoctor,
} from "./diagnostics";
import { runSafeChildProcess } from "./runner";
import {
  getDiagnosticsSummary,
  listLogFiles,
  openLogsFolder,
  tailLogFile,
  writeLog,
} from "./logger";
import { jobManager } from "./jobs";
import type { CreateStageSpec } from "./jobs";
import { failureResult } from "./validate";

const DOC_URLS: Record<DocsTopicId, string> = {
  "docker-install-windows":
    "https://docs.docker.com/desktop/setup/install/windows-install/",
  "docker-install-macos":
    "https://docs.docker.com/desktop/setup/install/mac-install/",
  "docker-install-linux": "https://docs.docker.com/engine/install/",
  "sql-server-express":
    "https://learn.microsoft.com/en-us/sql/database-engine/install-windows/install-sql-server",
  "sql-server-localdb":
    "https://learn.microsoft.com/en-us/sql/database-engine/configure-windows/sql-server-express-localdb",
  sqlite: "https://www.sqlite.org/docs.html",
  postgres: "https://www.postgresql.org/docs/",
  mysql: "https://dev.mysql.com/doc/",
};

export function optionToEngine(optionId: EngineOptionId): EngineId {
  const match = ENGINE_CATALOG.find((entry) => entry.id === optionId);
  return match?.engine ?? "sqlite";
}

async function seedPracticeFor(optionId: EngineOptionId): Promise<void> {
  try {
    const driver = await connectionRegistry.getDriverFor(optionId);
    await initializePracticeEnvironment(driver);
    await driver.disconnect();
  } catch (err) {
    writeLog("warn", `Practice seeding failed for ${optionId}: ${String(err)}`);
  }
}

export function stagesForKind(kind: JobKind): CreateStageSpec[] {
  switch (kind) {
    case "install":
      return [
        { id: "detect", label: "Checking system requirements", weight: 1 },
        { id: "download", label: "Downloading package", weight: 4 },
        { id: "verify", label: "Verifying package integrity", weight: 1 },
        {
          id: "elevate",
          label: "Requesting administrator permission",
          weight: 1,
        },
        {
          id: "install",
          label: "Installing engine",
          irreversible: true,
          weight: 3,
        },
        { id: "configure", label: "Configuring practice database", weight: 2 },
        { id: "start", label: "Starting service", weight: 1 },
        {
          id: "wait-ready",
          label: "Waiting for database readiness",
          weight: 1,
        },
        {
          id: "initialize",
          label: "Initializing practice schema",
          irreversible: true,
          weight: 2,
        },
        { id: "verify-connection", label: "Verifying connection", weight: 1 },
        { id: "finish", label: "Setup complete", weight: 1 },
      ];
    case "activate":
      return [
        { id: "detect", label: "Checking app data location", weight: 1 },
        {
          id: "configure",
          label: "Configuring practice environment",
          weight: 1,
        },
        {
          id: "initialize",
          label: "Initializing practice database",
          irreversible: true,
          weight: 2,
        },
        { id: "verify-connection", label: "Verifying connection", weight: 1 },
        { id: "finish", label: "Activation complete", weight: 1 },
      ];
    case "uninstall":
      return [
        { id: "backup", label: "Backing up learner data", weight: 2 },
        { id: "stop", label: "Stopping service", weight: 1 },
        {
          id: "uninstall",
          label: "Removing engine",
          irreversible: true,
          weight: 3,
        },
        { id: "finish", label: "Removal complete", weight: 1 },
      ];
    case "verify":
      return [
        { id: "verify-connection", label: "Testing connection", weight: 1 },
      ];
    case "switch":
      return [{ id: "switch", label: "Switching active engine", weight: 1 }];
    case "reset-practice":
      return [
        { id: "backup", label: "Backing up practice data", weight: 2 },
        {
          id: "reset",
          label: "Resetting schema",
          irreversible: true,
          weight: 2,
        },
        { id: "finish", label: "Reset complete", weight: 1 },
      ];
    case "backup":
      return [
        { id: "backup", label: "Creating database backup snapshot", weight: 1 },
      ];
    case "restore":
      return [
        {
          id: "restore",
          label: "Restoring database backup",
          irreversible: true,
          weight: 2,
        },
      ];
    case "repair":
      return [
        { id: "diagnose", label: "Diagnosing engine issue", weight: 1 },
        { id: "repair", label: "Repairing engine instance", weight: 2 },
      ];
    case "container-provision":
      return [
        { id: "detect", label: "Checking container runtime", weight: 1 },
        { id: "download", label: "Pulling container image", weight: 4 },
        { id: "configure", label: "Creating container and volume", weight: 2 },
        { id: "start", label: "Starting container", weight: 1 },
        { id: "wait-ready", label: "Waiting for readiness", weight: 1 },
        {
          id: "initialize",
          label: "Initializing practice schema",
          irreversible: true,
          weight: 2,
        },
        { id: "verify-connection", label: "Verifying connection", weight: 1 },
        { id: "finish", label: "Setup complete", weight: 1 },
      ];
    case "container-start":
      return [{ id: "start", label: "Starting container", weight: 1 }];
    case "container-stop":
      return [{ id: "stop", label: "Stopping container", weight: 1 }];
    case "container-remove":
      return [
        {
          id: "remove",
          label: "Removing container",
          irreversible: true,
          weight: 1,
        },
      ];
    case "container-update":
      return [
        { id: "pull", label: "Pulling latest image", weight: 3 },
        {
          id: "recreate",
          label: "Recreating container",
          irreversible: true,
          weight: 2,
        },
      ];
    case "configure":
      return [{ id: "configure", label: "Configuring engine", weight: 1 }];
    case "initialize":
      return [
        {
          id: "initialize",
          label: "Initializing schema",
          irreversible: true,
          weight: 1,
        },
      ];
  }
}

export class SetupService {
  public async getSnapshot(): Promise<BridgeResult<PlatformSnapshot>> {
    try {
      return { ok: true, data: currentSnapshot() };
    } catch (err) {
      writeLog("error", `Failed to get snapshot: ${String(err)}`);
      return failureResult(
        "unknown",
        "Could not read this computer's details. Retry the detection check.",
      );
    }
  }

  public async refreshStatus(): Promise<BridgeResult<PlatformSnapshot>> {
    try {
      return { ok: true, data: refreshSnapshot() };
    } catch (err) {
      writeLog("error", `Failed to refresh snapshot: ${String(err)}`);
      return failureResult(
        "unknown",
        "Could not refresh system details. Retry the detection check.",
      );
    }
  }

  public async getCatalog(): Promise<BridgeResult<EngineCatalogEntry[]>> {
    return { ok: true, data: ENGINE_CATALOG };
  }

  public async getCompatibility(): Promise<BridgeResult<EngineOffer[]>> {
    const snapshot = currentSnapshot();
    return { ok: true, data: resolveEngineOffers(snapshot) };
  }

  public async getInstallations(): Promise<BridgeResult<InstallationRecord[]>> {
    try {
      const loaded = await loadInstallState();
      return { ok: true, data: loaded.state.installations };
    } catch (err) {
      writeLog("error", `Failed to load installations: ${String(err)}`);
      return failureResult(
        "runtime",
        "Could not read installation records. Check diagnostics logs.",
      );
    }
  }

  public async verifyConnection(
    optionId: EngineOptionId,
  ): Promise<BridgeResult<VerificationResult>> {
    const loaded = await loadInstallState();
    const record = loaded.state.installations.find(
      (item) => item.optionId === optionId,
    );
    if (!record) {
      return failureResult(
        "prerequisite",
        "Engine is not installed on this machine. Install the engine before verifying.",
        ["choose-different-engine"],
      );
    }
    if (optionId === "sqlite") {
      const dbFile = record.dataLocation ?? sqlitePracticeFile();
      const verify = verifySqlitePractice(dbFile);
      const now = new Date().toISOString();
      await updateInstallationStatus(
        "sqlite",
        verify.ok ? "ready" : "needs-repair",
        {
          ok: verify.ok,
          checkedAt: now,
          detail: verify.detail,
        },
      );
      return {
        ok: true,
        data: {
          ok: verify.ok,
          checkedAt: now,
          detail: verify.detail,
        },
      };
    }
    if (optionId === "mssql-express-windows") {
      let password: string | undefined;
      if (record.secretRef) {
        try {
          password = (await retrieveSecret(record.secretRef)) ?? undefined;
        } catch {
          password = undefined;
        }
      }
      const verify = await verifyExpressWindowsConnection(password);
      const now = new Date().toISOString();
      await updateInstallationStatus(
        "mssql-express-windows",
        verify.ok ? "ready" : "needs-repair",
        {
          ok: verify.ok,
          checkedAt: now,
          detail: verify.detail,
        },
      );
      return {
        ok: true,
        data: {
          ok: verify.ok,
          checkedAt: now,
          detail: verify.detail,
        },
      };
    }
    if (optionId === "mssql-localdb") {
      const verify = await verifyLocalDbConnection(
        record.instanceName ?? LOCALDB_INSTANCE,
      );
      const now = new Date().toISOString();
      await updateInstallationStatus(
        "mssql-localdb",
        verify.ok ? "ready" : "needs-repair",
        {
          ok: verify.ok,
          checkedAt: now,
          detail: verify.detail,
        },
      );
      return {
        ok: true,
        data: {
          ok: verify.ok,
          checkedAt: now,
          detail: verify.detail,
        },
      };
    }
    if (optionId === "mssql-express-linux") {
      let password: string | undefined;
      if (record.secretRef) {
        try {
          password = (await retrieveSecret(record.secretRef)) ?? undefined;
        } catch {
          password = undefined;
        }
      }
      const verify = await verifyLinuxExpressConnection(password, record.port);
      const now = new Date().toISOString();
      await updateInstallationStatus(
        "mssql-express-linux",
        verify.ok ? "ready" : "needs-repair",
        {
          ok: verify.ok,
          checkedAt: now,
          detail: verify.detail,
        },
      );
      return {
        ok: true,
        data: {
          ok: verify.ok,
          checkedAt: now,
          detail: verify.detail,
        },
      };
    }
    if (optionId.endsWith("-container")) {
      let secret: string | undefined;
      if (record.secretRef) {
        try {
          secret = (await retrieveSecret(record.secretRef)) ?? undefined;
        } catch {
          secret = undefined;
        }
      }
      const verify = await verifyContainerConnection(
        optionId,
        record.port,
        secret,
      );
      const now = new Date().toISOString();
      await updateInstallationStatus(
        optionId,
        verify.ok ? "ready" : "needs-repair",
        {
          ok: verify.ok,
          checkedAt: now,
          detail: verify.detail,
        },
      );
      return { ok: true, data: verify };
    }
    const result: VerificationResult = {
      ok: record.status === "ready",
      checkedAt: new Date().toISOString(),
      detail:
        record.status === "ready"
          ? "Engine is operational"
          : `Engine status is ${record.status}`,
    };
    return { ok: true, data: result };
  }

  public async startJob(request: StartJobRequest): Promise<BridgeResult<Job>> {
    if (jobManager.hasActiveJob(request.optionId)) {
      return failureResult(
        "conflict",
        `Another job is currently running for engine "${request.optionId}". Wait for it to finish or cancel it before starting a new job.`,
      );
    }

    const engine = optionToEngine(request.optionId);
    const stages = stagesForKind(request.kind);
    const record = jobManager.createJob({
      optionId: request.optionId,
      engine,
      kind: request.kind,
      stages,
    });

    void jobManager.scheduleJob(record, async (ctx) => {
      if (request.kind === "switch") {
        jobManager.setStage(record, 0);
        ctx.updateProgress(
          { determinate: false },
          "Switching active database engine",
        );
        await connectionRegistry.setActiveEngine(request.optionId);
        await mutateInstallState((state) => {
          state.activeOptionId = request.optionId;
        });
        return;
      }

      if (request.kind === "reset-practice") {
        jobManager.setStage(record, 0);
        ctx.updateProgress(
          { determinate: false },
          "Creating backup of learner data",
        );
        const driver = await connectionRegistry.getDriver();
        if (!driver) {
          throw new Error(
            "No active driver available to reset practice environment",
          );
        }
        jobManager.setStage(record, 1);
        ctx.updateProgress(
          { determinate: false },
          "Resetting and reseeding practice tables",
        );
        await resetPracticeEnvironment(driver, { confirmed: true });
        jobManager.setStage(record, 2);
        ctx.updateProgress(
          { determinate: false },
          "Practice environment successfully reset",
        );
        return;
      }

      if (request.kind === "uninstall") {
        jobManager.setStage(record, 0);
        ctx.updateProgress({ determinate: false }, "Backing up learner data");
        try {
          const driver = await connectionRegistry.getDriver();
          if (driver) {
            await createBackup(driver, request.optionId, { isAutomatic: true });
          }
        } catch {}

        jobManager.setStage(record, 1);
        ctx.updateProgress(
          { determinate: false },
          "Stopping service or container",
        );
        if (request.optionId.endsWith("-container")) {
          const containerName = defaultContainerName(request.optionId);
          await stopAppContainer(containerName).catch(() => null);
        } else if (request.optionId === "mssql-localdb") {
          await stopLocalDbInstance(LOCALDB_INSTANCE).catch(() => null);
        }

        jobManager.setStage(record, 2);
        ctx.updateProgress(
          { determinate: false },
          "Removing engine instance (preserving data volumes)",
        );
        if (request.optionId.endsWith("-container")) {
          const containerName = defaultContainerName(request.optionId);
          await removeAppContainer(containerName, false).catch(() => null);
        }

        await mutateInstallState((state) => {
          state.installations = state.installations.filter(
            (i) => i.optionId !== request.optionId,
          );
          if (state.activeOptionId === request.optionId) {
            const nextReady = state.installations.find(
              (i) => i.status === "ready",
            );
            state.activeOptionId = nextReady?.optionId;
          }
        });

        const updated = await loadInstallState();
        if (updated.state.activeOptionId) {
          await connectionRegistry
            .setActiveEngine(updated.state.activeOptionId)
            .catch(() => null);
        }

        jobManager.setStage(record, 3);
        ctx.updateProgress({ determinate: false }, "Uninstall complete");
        return;
      }

      if (request.kind === "container-update") {
        jobManager.setStage(record, 0);
        ctx.updateProgress(
          { determinate: false },
          "Creating safety backup before update",
        );
        try {
          const driver = await connectionRegistry.getDriver();
          if (driver) {
            await createBackup(driver, request.optionId, { isAutomatic: true });
          }
        } catch {}

        jobManager.setStage(record, 1);
        ctx.updateProgress({ determinate: false }, "Pulling latest image");
        const entry = ENGINE_CATALOG.find((e) => e.id === request.optionId);
        if (entry?.container) {
          await pullImageWithProgress(
            entry.container.image,
            entry.container.tag,
            ctx,
          );
        }

        ctx.updateProgress(
          { determinate: false },
          "Recreating container keeping persistent volume",
        );
        const containerName = defaultContainerName(request.optionId);
        await removeAppContainer(containerName, false).catch(() => null);

        const loaded = await loadInstallState();
        const existingRec = loaded.state.installations.find(
          (item) => item.optionId === request.optionId,
        );
        let secret: string | undefined;
        if (existingRec?.secretRef) {
          try {
            secret = (await retrieveSecret(existingRec.secretRef)) ?? undefined;
          } catch {
            secret = undefined;
          }
        }
        await verifyContainerConnection(
          request.optionId,
          existingRec?.port,
          secret,
        );
        await updateInstallationStatus(request.optionId, "ready");
        return;
      }
      if (request.optionId === "sqlite" && request.kind === "activate") {
        await activateSqlite(
          ctx.signal,
          (stageIndex, label) => {
            jobManager.setStage(record, stageIndex);
            ctx.updateProgress({ determinate: false }, label);
          },
          async (kind, val) => {
            await ctx.recordResource(kind, val);
          },
        );
        await seedPracticeFor("sqlite");
        return;
      }
      if (request.optionId === "sqlite" && request.kind === "verify") {
        jobManager.setStage(record, 0);
        ctx.updateProgress(
          { determinate: false },
          "Verifying SQLite connection",
        );
        const dbFile = sqlitePracticeFile();
        const verify = verifySqlitePractice(dbFile);
        if (!verify.ok) {
          throw new Error(verify.detail ?? "SQLite verification failed");
        }
        return;
      }
      if (
        request.optionId === "mssql-express-windows" &&
        request.kind === "install"
      ) {
        await executeExpressWindowsInstall(
          ctx,
          (idx) => jobManager.setStage(record, idx),
          currentSnapshot(),
        );
        await seedPracticeFor(request.optionId);
        return;
      }
      if (
        request.optionId === "mssql-express-windows" &&
        request.kind === "verify"
      ) {
        jobManager.setStage(record, 0);
        ctx.updateProgress(
          { determinate: false },
          "Verifying SQL Server Express connection",
        );
        const loaded = await loadInstallState();
        const existingRec = loaded.state.installations.find(
          (item) => item.optionId === "mssql-express-windows",
        );
        let password: string | undefined;
        if (existingRec?.secretRef) {
          password = (await retrieveSecret(existingRec.secretRef)) ?? undefined;
        }
        const verify = await verifyExpressWindowsConnection(password);
        if (!verify.ok) {
          throw new Error(
            verify.detail ?? "SQL Server Express verification failed",
          );
        }
        return;
      }
      if (request.optionId === "mssql-localdb" && request.kind === "install") {
        await executeLocalDbInstall(
          ctx,
          (idx) => jobManager.setStage(record, idx),
          currentSnapshot(),
        );
        await seedPracticeFor(request.optionId);
        return;
      }
      if (request.optionId === "mssql-localdb" && request.kind === "verify") {
        jobManager.setStage(record, 0);
        ctx.updateProgress(
          { determinate: false },
          "Verifying SQL Server LocalDB connection",
        );
        const loaded = await loadInstallState();
        const existingRec = loaded.state.installations.find(
          (item) => item.optionId === "mssql-localdb",
        );
        const verify = await verifyLocalDbConnection(
          existingRec?.instanceName ?? LOCALDB_INSTANCE,
        );
        if (!verify.ok) {
          throw new Error(
            verify.detail ?? "SQL Server LocalDB verification failed",
          );
        }
        return;
      }
      if (
        request.optionId === "mssql-localdb" &&
        (request.kind === "container-start" || request.kind === "configure")
      ) {
        jobManager.setStage(record, 0);
        ctx.updateProgress({ determinate: false }, "Starting LocalDB instance");
        const loaded = await loadInstallState();
        const existingRec = loaded.state.installations.find(
          (item) => item.optionId === "mssql-localdb",
        );
        await startLocalDbInstance(
          existingRec?.instanceName ?? LOCALDB_INSTANCE,
        );
        await updateInstallationStatus("mssql-localdb", "ready");
        return;
      }
      if (
        request.optionId === "mssql-localdb" &&
        request.kind === "container-stop"
      ) {
        jobManager.setStage(record, 0);
        ctx.updateProgress({ determinate: false }, "Stopping LocalDB instance");
        const loaded = await loadInstallState();
        const existingRec = loaded.state.installations.find(
          (item) => item.optionId === "mssql-localdb",
        );
        await stopLocalDbInstance(
          existingRec?.instanceName ?? LOCALDB_INSTANCE,
        );
        await updateInstallationStatus("mssql-localdb", "stopped");
        return;
      }
      if (request.optionId === "mssql-localdb" && request.kind === "repair") {
        jobManager.setStage(record, 0);
        ctx.updateProgress(
          { determinate: false },
          "Repairing LocalDB instance",
        );
        const loaded = await loadInstallState();
        const existingRec = loaded.state.installations.find(
          (item) => item.optionId === "mssql-localdb",
        );
        const instanceName = existingRec?.instanceName ?? LOCALDB_INSTANCE;
        const info = await getLocalDbInfo(instanceName);
        if (info.state === "Missing") {
          await createLocalDbInstance(instanceName);
        }
        await startLocalDbInstance(instanceName);
        jobManager.setStage(record, 1);
        ctx.updateProgress(
          { determinate: false },
          "Verifying repaired LocalDB instance",
        );
        const verify = await verifyLocalDbConnection(instanceName);
        if (!verify.ok) {
          throw new Error(
            verify.detail ?? "LocalDB repair verification failed",
          );
        }
        await updateInstallationStatus("mssql-localdb", "ready");
        return;
      }
      if (
        request.optionId === "mssql-express-linux" &&
        request.kind === "install"
      ) {
        await executeExpressLinuxInstall(
          ctx,
          (idx) => jobManager.setStage(record, idx),
          currentSnapshot(),
        );
        await seedPracticeFor(request.optionId);
        return;
      }
      if (
        request.optionId === "mssql-express-linux" &&
        request.kind === "verify"
      ) {
        jobManager.setStage(record, 0);
        ctx.updateProgress(
          { determinate: false },
          "Verifying SQL Server Express on Linux connection",
        );
        const loaded = await loadInstallState();
        const existingRec = loaded.state.installations.find(
          (item) => item.optionId === "mssql-express-linux",
        );
        let password: string | undefined;
        if (existingRec?.secretRef) {
          password = (await retrieveSecret(existingRec.secretRef)) ?? undefined;
        }
        const verify = await verifyLinuxExpressConnection(
          password,
          existingRec?.port,
        );
        if (!verify.ok) {
          throw new Error(
            verify.detail ?? "SQL Server Express on Linux verification failed",
          );
        }
        return;
      }
      if (
        request.optionId === "mssql-express-linux" &&
        (request.kind === "container-start" || request.kind === "configure")
      ) {
        jobManager.setStage(record, 0);
        ctx.updateProgress(
          { determinate: false },
          "Starting mssql-server service",
        );
        await runSafeChildProcess({
          executable: "systemctl",
          args: ["start", "mssql-server"],
          timeoutMs: 30000,
        });
        await updateInstallationStatus("mssql-express-linux", "ready");
        return;
      }
      if (
        request.optionId === "mssql-express-linux" &&
        request.kind === "container-stop"
      ) {
        jobManager.setStage(record, 0);
        ctx.updateProgress(
          { determinate: false },
          "Stopping mssql-server service",
        );
        await runSafeChildProcess({
          executable: "systemctl",
          args: ["stop", "mssql-server"],
          timeoutMs: 30000,
        });
        await updateInstallationStatus("mssql-express-linux", "stopped");
        return;
      }
      if (
        request.optionId === "mssql-express-linux" &&
        request.kind === "repair"
      ) {
        jobManager.setStage(record, 0);
        ctx.updateProgress(
          { determinate: false },
          "Restarting mssql-server service",
        );
        await runSafeChildProcess({
          executable: "systemctl",
          args: ["restart", "mssql-server"],
          timeoutMs: 30000,
        });
        jobManager.setStage(record, 1);
        ctx.updateProgress(
          { determinate: false },
          "Verifying SQL Server Express on Linux",
        );
        const loaded = await loadInstallState();
        const existingRec = loaded.state.installations.find(
          (item) => item.optionId === "mssql-express-linux",
        );
        let password: string | undefined;
        if (existingRec?.secretRef) {
          password = (await retrieveSecret(existingRec.secretRef)) ?? undefined;
        }
        const verify = await verifyLinuxExpressConnection(
          password,
          existingRec?.port,
        );
        if (!verify.ok) {
          throw new Error(
            verify.detail ??
              "SQL Server Express on Linux repair verification failed",
          );
        }
        await updateInstallationStatus("mssql-express-linux", "ready");
        return;
      }

      if (
        request.optionId.endsWith("-container") &&
        request.kind === "container-provision"
      ) {
        jobManager.setStage(record, 0);
        ctx.updateProgress(
          { determinate: false },
          "Checking container runtime readiness",
        );
        let readiness = probeContainerReadinessSync(
          "docker",
          currentSnapshot(),
        );
        while (readiness.state !== "ready") {
          if (ctx.signal.aborted) return;
          const guidance = getDockerInstallationGuidance(currentSnapshot());
          const prompt = `${guidance.headline}: ${guidance.summary}\n${guidance.steps.map((s) => `${s.title}: ${s.detail}`).join("\n")}`;
          await ctx.requestWaiting(prompt);
          if (ctx.signal.aborted) return;
          clearContainerReadinessCache();
          refreshSnapshot();
          readiness = probeContainerReadinessSync("docker", currentSnapshot());
        }

        await executeContainerProvision(
          ctx,
          (idx) => jobManager.setStage(record, idx),
          currentSnapshot(),
        );
        await seedPracticeFor(request.optionId);
        return;
      }

      if (
        request.optionId.endsWith("-container") &&
        request.kind === "verify"
      ) {
        jobManager.setStage(record, 0);
        ctx.updateProgress(
          { determinate: false },
          "Verifying container connection",
        );
        const loaded = await loadInstallState();
        const existingRec = loaded.state.installations.find(
          (item) => item.optionId === request.optionId,
        );
        let secret: string | undefined;
        if (existingRec?.secretRef) {
          try {
            secret = (await retrieveSecret(existingRec.secretRef)) ?? undefined;
          } catch {
            secret = undefined;
          }
        }
        const verify = await verifyContainerConnection(
          request.optionId,
          existingRec?.port,
          secret,
        );
        if (!verify.ok) {
          throw new Error(
            verify.detail ?? "Container verification query failed",
          );
        }
        await updateInstallationStatus(request.optionId, "ready");
        return;
      }

      if (
        request.optionId.endsWith("-container") &&
        (request.kind === "container-start" || request.kind === "configure")
      ) {
        jobManager.setStage(record, 0);
        ctx.updateProgress({ determinate: false }, "Starting container");
        const loaded = await loadInstallState();
        const existingRec = loaded.state.installations.find(
          (item) => item.optionId === request.optionId,
        );
        const containerName =
          existingRec?.containerName ?? defaultContainerName(request.optionId);
        await startAppContainer(containerName);
        await updateInstallationStatus(request.optionId, "ready");
        return;
      }

      if (
        request.optionId.endsWith("-container") &&
        request.kind === "container-stop"
      ) {
        jobManager.setStage(record, 0);
        ctx.updateProgress({ determinate: false }, "Stopping container");
        const loaded = await loadInstallState();
        const existingRec = loaded.state.installations.find(
          (item) => item.optionId === request.optionId,
        );
        const containerName =
          existingRec?.containerName ?? defaultContainerName(request.optionId);
        await stopAppContainer(containerName);
        await updateInstallationStatus(request.optionId, "stopped");
        return;
      }

      if (
        request.optionId.endsWith("-container") &&
        request.kind === "repair"
      ) {
        jobManager.setStage(record, 0);
        ctx.updateProgress({ determinate: false }, "Restarting container");
        const loaded = await loadInstallState();
        const existingRec = loaded.state.installations.find(
          (item) => item.optionId === request.optionId,
        );
        const containerName =
          existingRec?.containerName ?? defaultContainerName(request.optionId);
        await restartAppContainer(containerName);
        jobManager.setStage(record, 1);
        ctx.updateProgress(
          { determinate: false },
          "Verifying restarted container",
        );
        let secret: string | undefined;
        if (existingRec?.secretRef) {
          try {
            secret = (await retrieveSecret(existingRec.secretRef)) ?? undefined;
          } catch {
            secret = undefined;
          }
        }
        const verify = await verifyContainerConnection(
          request.optionId,
          existingRec?.port,
          secret,
        );
        if (!verify.ok) {
          throw new Error(
            verify.detail ?? "Container repair verification failed",
          );
        }
        await updateInstallationStatus(request.optionId, "ready");
        return;
      }

      for (let index = 0; index < stages.length; index += 1) {
        if (ctx.signal.aborted) break;
        jobManager.setStage(record, index);
        ctx.updateProgress({ determinate: false }, stages[index].label);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    });

    return { ok: true, data: record.job };
  }

  public async cancelJob(jobId: string): Promise<BridgeResult<Job>> {
    const cancelled = jobManager.cancelJob(jobId);
    if (!cancelled) {
      return failureResult(
        "prerequisite",
        "The requested job was not found. Refresh job list.",
      );
    }
    return { ok: true, data: cancelled };
  }

  public async resumeJob(jobId: string): Promise<BridgeResult<Job>> {
    const resumed = jobManager.resumeJob(jobId);
    if (!resumed) {
      return failureResult(
        "prerequisite",
        "The requested job was not found or is not waiting. Refresh job status.",
      );
    }
    return { ok: true, data: resumed };
  }

  public async cleanupJob(jobId: string): Promise<BridgeResult<Job>> {
    const cleaned = await jobManager.cleanupJob(jobId);
    if (!cleaned) {
      return failureResult(
        "prerequisite",
        "The requested job was not found. Refresh job list.",
      );
    }
    return { ok: true, data: cleaned };
  }

  public async checkWaitingJob(jobId: string): Promise<BridgeResult<Job>> {
    const job = jobManager.getJob(jobId);
    if (!job) {
      return failureResult(
        "prerequisite",
        "The requested job was not found. Refresh job list.",
      );
    }
    if (job.state === "waiting-for-user") {
      jobManager.resumeJob(jobId);
    }
    return { ok: true, data: job };
  }

  public async confirmIrreversible(
    jobId: string,
    proceed: boolean,
  ): Promise<BridgeResult<Job>> {
    const result = jobManager.confirmIrreversible(jobId, proceed);
    if (!result) {
      return failureResult(
        "prerequisite",
        "The requested job was not found. Refresh job list.",
      );
    }
    return { ok: true, data: result };
  }

  public async getJob(jobId: string): Promise<BridgeResult<Job | null>> {
    return { ok: true, data: jobManager.getJob(jobId) };
  }

  public async executeAction(
    optionId: EngineOptionId,
    kind: JobKind,
  ): Promise<BridgeResult<Job>> {
    return this.startJob({ optionId, kind });
  }

  public async containerLifecycle(
    optionId: EngineOptionId,
    action: ContainerLifecycleAction,
  ): Promise<BridgeResult<Job>> {
    const kind: JobKind =
      action === "stop" ? "container-stop" : "container-start";
    return this.startJob({ optionId, kind });
  }

  public async containerStats(
    optionId: EngineOptionId,
  ): Promise<BridgeResult<ContainerStats>> {
    const loaded = await loadInstallState();
    const record = loaded.state.installations.find(
      (item) => item.optionId === optionId,
    );
    return {
      ok: true,
      data: {
        cpuPercent: 0,
        memoryUsageBytes: 0,
        memoryLimitBytes: 0,
        running: record?.status === "ready",
      },
    };
  }

  public async containerLogs(
    optionId: EngineOptionId,
    tail = 100,
  ): Promise<BridgeResult<string[]>> {
    const lines = tailLogFile(`container-${optionId}.log`, tail);
    return { ok: true, data: lines };
  }

  public async listLogs(): Promise<BridgeResult<LogFileSummary[]>> {
    return { ok: true, data: listLogFiles() };
  }

  public async tailLog(
    name: string,
    lines = 100,
  ): Promise<BridgeResult<string[]>> {
    return { ok: true, data: tailLogFile(name, lines) };
  }

  public async openLogsFolder(): Promise<BridgeResult<void>> {
    await openLogsFolder();
    return { ok: true, data: undefined };
  }

  public async diagnosticsSummary(): Promise<BridgeResult<DiagnosticsSummary>> {
    const summary = await getDiagnosticsSummary();
    return { ok: true, data: summary };
  }

  public async openDocs(topic: DocsTopicId): Promise<BridgeResult<void>> {
    const url = DOC_URLS[topic];
    if (!url) {
      return failureResult(
        "unsupported",
        "Documentation topic is not recognized. Check available topics.",
      );
    }
    void shell.openExternal(url);
    return { ok: true, data: undefined };
  }

  public async getDockerGuidance(): Promise<
    BridgeResult<DockerGuidanceContent>
  > {
    return { ok: true, data: getDockerInstallationGuidance(currentSnapshot()) };
  }

  public async openExternalUrl(urlStr: string): Promise<BridgeResult<void>> {
    if (!isOfficialUrl(urlStr)) {
      return failureResult(
        "permission",
        "Opening non-official domains is not permitted. Only official documentation links are allowed.",
      );
    }
    void shell.openExternal(urlStr);
    return { ok: true, data: undefined };
  }

  public async containerDetails(
    optionId: EngineOptionId,
  ): Promise<BridgeResult<ContainerTechnicalDetails>> {
    const details = await inspectContainerTechnicalDetails(
      defaultContainerName(optionId),
    );
    return { ok: true, data: details };
  }

  public async getActiveEngine(): Promise<BridgeResult<EngineOptionId | null>> {
    const loaded = await loadInstallState();
    return { ok: true, data: loaded.state.activeOptionId ?? null };
  }

  public async getStorageUsage(): Promise<
    BridgeResult<Record<string, { bytes: number; human: string }>>
  > {
    const formatBytes = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    let backupsBytes = 0;
    const bDir = backupsDir();
    if (existsSync(bDir)) {
      for (const file of readdirSync(bDir)) {
        try {
          backupsBytes += statSync(join(bDir, file)).size;
        } catch {}
      }
    }

    let sqliteBytes = 0;
    const sqlFile = sqlitePracticeFile();
    if (existsSync(sqlFile)) {
      try {
        sqliteBytes = statSync(sqlFile).size;
      } catch {}
    }

    return {
      ok: true,
      data: {
        backups: { bytes: backupsBytes, human: formatBytes(backupsBytes) },
        sqlite: { bytes: sqliteBytes, human: formatBytes(sqliteBytes) },
      },
    };
  }

  public async listBackups(
    optionId?: EngineOptionId,
  ): Promise<BridgeResult<BackupManifest[]>> {
    const manifests = listBackupsFn(optionId);
    return { ok: true, data: manifests };
  }

  public async cleanupBackups(
    keepCount = 5,
  ): Promise<BridgeResult<{ deletedCount: number; freedBytes: number }>> {
    const result = cleanupBackupsFn(keepCount);
    return { ok: true, data: result };
  }

  public async listOrphanContainers(): Promise<
    BridgeResult<OrphanContainerSummary[]>
  > {
    const loaded = await loadInstallState();
    const orphans = findOrphanAppContainers(loaded.state.installations);
    return { ok: true, data: orphans };
  }

  public async cleanupOrphanContainer(
    name: string,
  ): Promise<BridgeResult<void>> {
    await cleanupOrphanContainerFn(name);
    return { ok: true, data: undefined };
  }

  public async removeVolume(
    optionId: EngineOptionId,
  ): Promise<BridgeResult<Job>> {
    const volName = defaultVolumeName(optionId);
    await runSafeChildProcess({
      executable: "docker",
      args: ["volume", "rm", "-f", volName],
      timeoutMs: 20000,
    }).catch(() => null);
    return this.startJob({ optionId, kind: "container-remove" });
  }

  public async deleteEngineData(
    optionId: EngineOptionId,
  ): Promise<BridgeResult<void>> {
    try {
      const driver = await connectionRegistry.getDriver();
      if (driver) {
        await createBackup(driver, optionId, { isAutomatic: true }).catch(
          () => null,
        );
      }
    } catch {}

    if (optionId === "sqlite") {
      const dbFile = sqlitePracticeFile();
      if (existsSync(dbFile)) {
        try {
          unlinkSync(dbFile);
        } catch {}
      }
    } else if (optionId.endsWith("-container")) {
      const containerName = defaultContainerName(optionId);
      const volumeName = defaultVolumeName(optionId);
      await removeAppContainer(containerName, true, volumeName).catch(
        () => null,
      );
    }

    const loaded = await loadInstallState();
    const existing = loaded.state.installations.find(
      (item) => item.optionId === optionId,
    );
    if (existing?.secretRef) {
      try {
        deleteSecret(existing.secretRef);
      } catch {}
    }

    await mutateInstallState((draft) => {
      draft.installations = draft.installations.filter(
        (inst) => inst.optionId !== optionId,
      );
      if (draft.activeOptionId === optionId) {
        const nextReady = draft.installations.find(
          (inst) => inst.status === "ready",
        );
        draft.activeOptionId = nextReady?.optionId;
      }
    });

    const refreshed = await loadInstallState();
    if (refreshed.state.activeOptionId) {
      await connectionRegistry
        .setActiveEngine(refreshed.state.activeOptionId)
        .catch(() => null);
    }

    return { ok: true, data: undefined };
  }

  public async verifyEngineRemoval(
    optionId: EngineOptionId,
  ): Promise<{ clean: boolean; detail?: string }> {
    if (optionId.endsWith("-container")) {
      const containerName = defaultContainerName(optionId);
      const inspect = await inspectContainer(containerName);
      if (inspect.exists) {
        return {
          clean: false,
          detail: `Container ${containerName} is still present.`,
        };
      }
      return { clean: true, detail: "Container cleanly removed." };
    }
    return { clean: true, detail: "Engine removed." };
  }

  public async doctor(
    optionId: EngineOptionId,
  ): Promise<BridgeResult<EngineDoctorReport>> {
    const report = await runEngineDoctor(optionId);
    return { ok: true, data: report };
  }

  public async repairIssue(
    optionId: EngineOptionId,
    issueId?: string,
  ): Promise<BridgeResult<void>> {
    return applyDoctorRepair(optionId, issueId);
  }

  public async exportSupportBundle(
    targetPath?: string,
  ): Promise<BridgeResult<SupportBundleSummary>> {
    const bundle = await createSupportBundle(targetPath);
    return { ok: true, data: bundle };
  }
}

export const setupService = new SetupService();
