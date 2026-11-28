import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  FEATURE_FLAGS,
  type BridgeResult,
  ContainerLifecycleAction,
  EngineCatalogEntry,
  EngineOffer,
  EngineOptionId,
  EngineStorageUsage,
  InstallationRecord,
  Job,
  JobKind,
  PlatformSnapshot,
  StartJobRequest,
  VerificationResult,
} from "../../shared/engines";
import {
  ENGINE_CATALOG,
  defaultContainerName,
  defaultVolumeName,
  resolveEngineOffers,
} from "../../shared/engine-catalog";
import { currentSnapshot, refreshSnapshot } from "../platform/snapshot";
import { deleteSecret, retrieveSecret } from "../secrets";
import {
  loadInstallState,
  mutateInstallState,
  updateInstallation,
  updateInstallationStatus,
} from "../state/store";
import { engineService } from "../engine/service";
import { getPackage } from "../engine/catalog";
import {
  getInstanceDataDir,
  getInstanceDir,
  getPacksDir,
} from "../engine/paths";
import { sqlitePracticeFile } from "../paths";
import {
  initializePracticeEnvironment,
  resetPracticeEnvironment,
  verifyPracticeEnvironment,
} from "../practice/seeder";
import {
  executeContainerProvision,
  getContainerLogs,
  pullImageWithProgress,
  removeAppContainer,
  restartAppContainer,
  startAppContainer,
  stopAppContainer,
  verifyContainerConnection,
} from "./container-provisioner";
import {
  clearContainerReadinessCache,
  getDockerInstallationGuidance,
  probeContainerReadinessSync,
} from "./docker";
import { jobManager, type JobRecord } from "./jobs";
import type { CreateStageSpec, StageExecutionContext } from "./jobs";
import { logPathFor } from "./logger";
import { failureResult } from "./validate";

function catalogEntry(optionId: EngineOptionId): EngineCatalogEntry {
  const entry = ENGINE_CATALOG.find((item) => item.id === optionId);
  if (entry === undefined) {
    throw new Error(`Unknown database engine "${optionId}".`);
  }
  return entry;
}

function isContainerOption(optionId: EngineOptionId): boolean {
  return catalogEntry(optionId).method === "container";
}

function bytesAt(target: string): number {
  let stats;
  try {
    stats = statSync(target);
  } catch {
    return 0;
  }
  if (!stats.isDirectory()) return stats.size;
  let total = 0;
  try {
    for (const entry of readdirSync(target)) {
      total += bytesAt(join(target, entry));
    }
  } catch {
    return 0;
  }
  return total;
}

function practiceDriver(optionId: EngineOptionId) {
  return {
    dialect: catalogEntry(optionId).dialect,
    execute: (sql: string) => engineService.execute(sql),
    getSchema: () => engineService.getSchema(),
  };
}

async function recordReady(optionId: EngineOptionId): Promise<void> {
  const entry = catalogEntry(optionId);
  const loaded = await loadInstallState();
  const existing = loaded.state.installations.find(
    (item) => item.optionId === optionId,
  );
  const port = existing?.port ?? (await engineService.activePort());
  const now = new Date().toISOString();
  await updateInstallation({
    optionId,
    engine: entry.engine,
    method: entry.method,
    variant: {
      displayName: entry.displayName,
      publisher: entry.publisher,
      purpose: entry.purpose,
      technicalName: entry.advancedName,
      dialect: entry.dialect,
    },
    status: "ready",
    installedVersion: entry.pin,
    port: port ?? undefined,
    dataLocation: existing?.dataLocation ?? getInstanceDataDir(optionId),
    secretRef: existing?.secretRef,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastVerification: {
      ok: true,
      checkedAt: now,
      detail: "Engine answered a health check.",
    },
    resources: existing?.resources ?? {},
  });
  await mutateInstallState((state) => {
    state.activeOptionId = optionId;
  });
}

const DETECT_STAGE: CreateStageSpec = {
  id: "detect",
  label: "Checking environment",
  weight: 1,
};
const START_STAGE: CreateStageSpec = {
  id: "initialize",
  label: "Starting engine",
  weight: 2,
};
const DATABASE_STAGE: CreateStageSpec = {
  id: "configure",
  label: "Creating practice database",
  weight: 1,
};
const VERIFY_STAGE: CreateStageSpec = {
  id: "verify",
  label: "Verifying connection",
  weight: 1,
};
const SEED_STAGE: CreateStageSpec = {
  id: "seed",
  label: "Loading practice data",
  weight: 2,
};
const FINISH_STAGE: CreateStageSpec = {
  id: "finish",
  label: "Environment ready",
  weight: 1,
};

function installStages(optionId: EngineOptionId): CreateStageSpec[] {
  const entry = catalogEntry(optionId);
  const base = [DETECT_STAGE, DATABASE_STAGE, VERIFY_STAGE, SEED_STAGE, FINISH_STAGE];
  if (entry.method === "bundled") {
    return base;
  }
  const download: CreateStageSpec = {
    id: "download",
    label: "Downloading package",
    weight: 4,
  };
  const integrity: CreateStageSpec = {
    id: "verify-package",
    label: "Verifying package",
    weight: 1,
  };
  const extract: CreateStageSpec =
    entry.id === "sqlserver"
      ? { id: "package", label: "Installing system package", weight: 3 }
      : { id: "extract", label: "Unpacking package", weight: 2 };
  return [
    DETECT_STAGE,
    download,
    integrity,
    extract,
    START_STAGE,
    DATABASE_STAGE,
    VERIFY_STAGE,
    SEED_STAGE,
    FINISH_STAGE,
  ];
}

const CONTAINER_STAGES: CreateStageSpec[] = [
  { id: "detect", label: "Checking container runtime", weight: 1 },
  { id: "download", label: "Pulling container image", weight: 4 },
  { id: "configure", label: "Creating container and volume", weight: 2 },
  { id: "start", label: "Starting container", weight: 1 },
  { id: "wait-ready", label: "Waiting for readiness", weight: 1 },
  { id: "initialize", label: "Loading practice data", weight: 2 },
  { id: "verify", label: "Verifying connection", weight: 1 },
  { id: "finish", label: "Setup complete", weight: 1 },
];

function stagesForKind(
  kind: JobKind,
  optionId: EngineOptionId,
): CreateStageSpec[] {
  if (isContainerOption(optionId)) {
    return CONTAINER_STAGES;
  }
  switch (kind) {
    case "install":
    case "activate":
      return installStages(optionId);
    case "switch":
      return [{ id: "switch", label: "Switching active engine", weight: 1 }];
    case "verify":
      return [{ id: "verify", label: "Testing connection", weight: 1 }];
    case "reset-practice":
      return [{ id: "reset", label: "Resetting practice data", weight: 2 }];
    case "repair":
      return [{ id: "repair", label: "Repairing engine", weight: 2 }];
    case "uninstall":
      return [{ id: "uninstall", label: "Removing engine", weight: 2 }];
    case "container-update":
      return [{ id: "update", label: "Updating container", weight: 2 }];
    default:
      return [{ id: "task", label: "Working", weight: 1 }];
  }
}

function localDbInstanceDir(): string {
  if (process.platform !== "win32") return "";
  const localAppData =
    process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
  return join(
    localAppData,
    "Microsoft",
    "Microsoft SQL Server Local DB",
    "Instances",
    "LogixZenPractice",
  );
}

function sumDistinctPaths(paths: Array<string | undefined>): number {
  const resolved = Array.from(
    new Set(
      paths
        .filter((value): value is string => value !== undefined && value.length > 0)
        .map((value) => resolve(value)),
    ),
  ).sort((a, b) => a.length - b.length);
  const roots: string[] = [];
  for (const candidate of resolved) {
    if (
      !roots.some(
        (root) =>
          candidate === root ||
          candidate.startsWith(`${root}\\`) ||
          candidate.startsWith(`${root}/`),
      )
    ) {
      roots.push(candidate);
    }
  }
  return roots.reduce((total, target) => total + bytesAt(target), 0);
}

const cachedUsage = new Map<EngineOptionId, EngineStorageUsage>();

async function measureActivePracticeBytes(
  optionId: EngineOptionId,
): Promise<number | undefined> {
  if (engineService.activeEngineId() !== optionId) return undefined;
  try {
    if (optionId === "postgres") {
      const res = await engineService.runSql(
        "SELECT pg_database_size('practice') AS size_bytes;",
      );
      const val = Number(res[0]?.rows?.[0]?.size_bytes ?? NaN);
      return Number.isFinite(val) && val >= 0 ? val : undefined;
    }
    if (optionId === "mysql") {
      const res = await engineService.runSql(
        "SELECT COALESCE(SUM(data_length + index_length), 0) AS size_bytes FROM information_schema.tables WHERE table_schema = 'practice';",
      );
      const val = Number(res[0]?.rows?.[0]?.size_bytes ?? NaN);
      return Number.isFinite(val) && val > 0 ? val : undefined;
    }
    if (optionId === "sqlserver") {
      const res = await engineService.runSql(
        "SELECT COALESCE(SUM(CAST(size AS BIGINT)) * 8192, 0) AS size_bytes FROM sys.master_files WHERE DB_NAME(database_id) = 'practice';",
      );
      const val = Number(res[0]?.rows?.[0]?.size_bytes ?? NaN);
      return Number.isFinite(val) && val > 0 ? val : undefined;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function measureSqlServerPracticeDiskBytes(): number {
  const dir = localDbInstanceDir();
  if (!dir || !existsSync(dir)) return 0;
  try {
    return readdirSync(dir)
      .filter((name) => /^practice.*\.(mdf|ldf)$/i.test(name))
      .reduce((sum, name) => sum + bytesAt(join(dir, name)), 0);
  } catch {
    return 0;
  }
}

class SetupService {
  public async getSnapshot(): Promise<BridgeResult<PlatformSnapshot>> {
    try {
      return { ok: true, data: currentSnapshot() };
    } catch (error) {
      return failureResult(
        "unknown",
        `Could not read this computer's details: ${stringify(error)}`,
      );
    }
  }

  public async refreshStatus(): Promise<BridgeResult<PlatformSnapshot>> {
    try {
      return { ok: true, data: refreshSnapshot() };
    } catch (error) {
      return failureResult(
        "unknown",
        `Could not refresh system details: ${stringify(error)}`,
      );
    }
  }

  public async getCatalog(): Promise<BridgeResult<EngineCatalogEntry[]>> {
    return { ok: true, data: ENGINE_CATALOG };
  }

  public async getCompatibility(): Promise<BridgeResult<EngineOffer[]>> {
    return { ok: true, data: resolveEngineOffers(currentSnapshot()) };
  }

  public async getInstallations(): Promise<BridgeResult<InstallationRecord[]>> {
    const loaded = await loadInstallState();
    return { ok: true, data: loaded.state.installations };
  }

  public async getActiveEngine(): Promise<BridgeResult<EngineOptionId | null>> {
    const loaded = await loadInstallState();
    return { ok: true, data: loaded.state.activeOptionId ?? null };
  }

  public async verifyConnection(
    optionId: EngineOptionId,
  ): Promise<BridgeResult<VerificationResult>> {
    if (!FEATURE_FLAGS.docker && isContainerOption(optionId)) {
      return failureResult(
        "prerequisite",
        "Docker container engines are coming soon and currently disabled.",
      );
    }
    const loaded = await loadInstallState();
    const record = loaded.state.installations.find(
      (item) => item.optionId === optionId,
    );
    if (record === undefined) {
      return failureResult(
        "prerequisite",
        "Engine is not installed. Install it first.",
        ["choose-different-engine"],
      );
    }

    const checkedAt = new Date().toISOString();

    if (isContainerOption(optionId)) {
      let secret: string | undefined;
      if (record.secretRef !== undefined) {
        try {
          secret = (await retrieveSecret(record.secretRef)) ?? undefined;
        } catch {}
      }
      const verification = await verifyContainerConnection(
        optionId,
        record.port,
        secret,
      );
      await updateInstallationStatus(
        optionId,
        verification.ok ? "ready" : "needs-repair",
        { ...verification, checkedAt },
      );
      return { ok: true, data: verification };
    }

    try {
      await engineService.select(optionId);
      const result = await engineService.runSql("SELECT 1 AS ok;");
      const healthy =
        result[0]?.error === undefined && (result[0]?.rows.length ?? 0) > 0;
      const practice = healthy
        ? await verifyPracticeEnvironment(practiceDriver(optionId))
        : null;
      const ok = healthy && practice?.ok === true;
      const verification: VerificationResult = {
        ok,
        checkedAt,
        detail: ok
          ? "Engine and practice database verified."
          : (result[0]?.error ??
            practice?.error ??
            "The practice database is incomplete."),
      };
      await updateInstallationStatus(
        optionId,
        ok ? "ready" : "needs-repair",
        verification,
      );
      if (ok) {
        await mutateInstallState((state) => {
          state.activeOptionId = optionId;
        });
      }
      return { ok: true, data: verification };
    } catch (error) {
      const verification: VerificationResult = {
        ok: false,
        checkedAt,
        detail: stringify(error),
      };
      await updateInstallationStatus(optionId, "needs-repair", verification);
      return { ok: true, data: verification };
    }
  }

  public async startJob(request: StartJobRequest): Promise<BridgeResult<Job>> {
    if (
      !FEATURE_FLAGS.docker &&
      isContainerOption(request.optionId) &&
      request.kind !== "uninstall"
    ) {
      return failureResult(
        "prerequisite",
        "Docker container engines are coming soon and currently disabled.",
      );
    }
    if (jobManager.hasActiveJob(request.optionId)) {
      return failureResult(
        "conflict",
        `Another task is already running for ${catalogEntry(request.optionId).displayName}. Wait for it to finish.`,
      );
    }

    const entry = catalogEntry(request.optionId);
    const record = jobManager.createJob({
      optionId: request.optionId,
      engine: entry.engine,
      kind: request.kind,
      stages: stagesForKind(request.kind, request.optionId),
    });

    void jobManager.scheduleJob(record, (context) =>
      this.runJob(request, record, context),
    );

    return { ok: true, data: record.job };
  }

  private async runJob(
    request: StartJobRequest,
    record: JobRecord,
    context: StageExecutionContext,
  ): Promise<void> {
    const optionId = request.optionId;
    const entry = catalogEntry(optionId);

    if (request.kind === "install" || request.kind === "activate") {
      if (isContainerOption(optionId)) {
        await this.provisionContainer(optionId, context, record);
        return;
      }
      await this.installNative(optionId, context, record);
      return;
    }

    if (request.kind === "switch" || request.kind === "container-start") {
      jobManager.setStage(record, 0);
      context.updateProgress(
        { determinate: false },
        `Starting ${entry.displayName}`,
      );
      if (isContainerOption(optionId)) {
        await startAppContainer(defaultContainerName(optionId));
      }
      await engineService.select(optionId);
      await updateInstallationStatus(optionId, "ready");
      await mutateInstallState((state) => {
        state.activeOptionId = optionId;
      });
      return;
    }

    if (request.kind === "container-stop") {
      jobManager.setStage(record, 0);
      context.updateProgress({ determinate: false }, "Stopping container");
      if (engineService.activeEngineId() === optionId) {
        await engineService.stop();
      }
      if (isContainerOption(optionId)) {
        await stopAppContainer(defaultContainerName(optionId));
      }
      await updateInstallationStatus(optionId, "stopped");
      return;
    }

    if (request.kind === "verify") {
      jobManager.setStage(record, 0);
      context.updateProgress({ determinate: false }, "Testing connection");
      const verification = await this.verifyConnection(optionId);
      if (!verification.ok) {
        throw new Error(verification.failure.cause);
      }
      if (!verification.data.ok) {
        throw new Error(verification.data.detail ?? "Verification failed.");
      }
      return;
    }

    if (request.kind === "reset-practice") {
      jobManager.setStage(record, 0);
      context.updateProgress({ determinate: false }, "Resetting practice data");
      if (engineService.activeEngineId() !== optionId) {
        await engineService.select(optionId);
        await mutateInstallState((state) => {
          state.activeOptionId = optionId;
        });
      }
      await resetPracticeEnvironment(practiceDriver(optionId), {
        confirmed: true,
      });
      return;
    }

    if (request.kind === "repair") {
      jobManager.setStage(record, 0);
      context.updateProgress({ determinate: false }, "Repairing engine");
      await engineService.stop();
      await engineService.install(optionId);
      await engineService.select(optionId);
      const result = await engineService.runSql("SELECT 1 AS ok;");
      if (result[0]?.error !== undefined) {
        throw new Error(result[0].error);
      }
      await recordReady(optionId);
      return;
    }

    if (request.kind === "uninstall") {
      jobManager.setStage(record, 0);
      context.updateProgress({ determinate: false }, "Removing engine");
      if (engineService.activeEngineId() === optionId) {
        await engineService.stop();
      }
      if (isContainerOption(optionId)) {
        await removeAppContainer(defaultContainerName(optionId), false).catch(
          () => null,
        );
      }
      await engineService.removePack(optionId);
      await mutateInstallState((state) => {
        state.installations = state.installations.filter(
          (item) => item.optionId !== optionId,
        );
        if (state.activeOptionId === optionId) {
          state.activeOptionId = state.installations.find(
            (item) => item.status === "ready",
          )?.optionId;
        }
      });
      return;
    }

    if (request.kind === "container-update") {
      jobManager.setStage(record, 0);
      context.updateProgress({ determinate: false }, "Pulling latest image");
      if (entry.container !== undefined) {
        await pullImageWithProgress(
          entry.container.image,
          entry.container.tag,
          context,
        );
      }
      await removeAppContainer(defaultContainerName(optionId), false).catch(
        () => null,
      );
      await this.provisionContainer(optionId, context, record);
      return;
    }

    throw new Error(`"${request.kind}" is not available for this engine.`);
  }

  private async installNative(
    optionId: EngineOptionId,
    context: StageExecutionContext,
    record: JobRecord,
  ): Promise<void> {
    const entry = catalogEntry(optionId);
    const stageIds = record.job.stages.map((stage) => stage.id);
    const at = (id: string): number => {
      const index = stageIds.indexOf(id);
      return index >= 0 ? index : 0;
    };
    const move = (id: string, activity: string): void => {
      jobManager.setStage(record, at(id));
      context.updateProgress({ determinate: false }, activity);
    };

    move("detect", "Checking environment");
    await engineService.install(optionId, {
      signal: context.signal,
      onPhase: (phase) => {
        if (phase === "download") move("download", "Downloading package");
        if (phase === "verify") move("verify-package", "Verifying package");
        if (phase === "extract") move("extract", "Unpacking package");
        if (phase === "package") move("package", "Installing system package");
      },
      onProgress: (progress) => {
        if (progress.totalBytes > 0) {
          context.updateProgress(
            {
              determinate: true,
              bytesDone: progress.downloadedBytes,
              bytesTotal: progress.totalBytes,
              percent: progress.percent,
            },
            `Downloading package: ${progress.percent}%`,
          );
        } else {
          const mb = (progress.downloadedBytes / (1024 * 1024)).toFixed(1);
          context.updateProgress(
            { determinate: false },
            `Downloading package: ${mb} MB`,
          );
        }
      },
    });

    if (context.signal.aborted) {
      throw new Error("Install cancelled.");
    }

    const startIndex = stageIds.indexOf("initialize");
    jobManager.setStage(record, startIndex >= 0 ? startIndex : at("configure"));
    context.updateProgress(
      { determinate: false },
      `Starting ${entry.displayName}`,
    );
    try {
      await engineService.select(optionId);
    } catch (error) {
      throw new Error(
        `${entry.displayName} could not start. ${stringify(error)}\nLog: ${logPathFor(optionId)}`,
      );
    }

    move("configure", "Creating practice database");
    const health = await engineService.runSql("SELECT 1 AS ok;");
    if (health[0]?.error !== undefined) {
      throw new Error(health[0].error);
    }

    move("verify", "Verifying connection");
    await engineService.getSchema();

    move("seed", "Loading practice data");
    await initializePracticeEnvironment(practiceDriver(optionId));

    move("finish", "Finalizing setup");
    await recordReady(optionId);

    jobManager.setStage(record, record.job.stages.length - 1);
    context.updateProgress({ determinate: false }, "Setup complete");
  }

  private async provisionContainer(
    optionId: EngineOptionId,
    context: StageExecutionContext,
    record: JobRecord,
  ): Promise<void> {
    jobManager.setStage(record, 0);
    context.updateProgress(
      { determinate: false },
      "Checking container runtime",
    );

    let readiness = probeContainerReadinessSync("docker", currentSnapshot());
    while (readiness.state !== "ready") {
      if (context.signal.aborted) return;
      const guidance = getDockerInstallationGuidance(currentSnapshot());
      await context.requestWaiting(
        `${guidance.headline}. ${guidance.summary}`,
      );
      if (context.signal.aborted) return;
      clearContainerReadinessCache();
      refreshSnapshot();
      readiness = probeContainerReadinessSync("docker", currentSnapshot());
    }

    await executeContainerProvision(
      context,
      (index) => jobManager.setStage(record, index),
      currentSnapshot(),
    );
    await mutateInstallState((state) => {
      state.activeOptionId = optionId;
    });
  }

  public async cancelJob(jobId: string): Promise<BridgeResult<Job>> {
    const job = jobManager.cancelJob(jobId);
    if (job === null) {
      return failureResult("prerequisite", "The task is no longer running.");
    }
    return { ok: true, data: job };
  }

  public async resumeJob(jobId: string): Promise<BridgeResult<Job>> {
    const job = jobManager.resumeJob(jobId);
    if (job === null) {
      return failureResult("prerequisite", "The task is not waiting.");
    }
    return { ok: true, data: job };
  }

  public async cleanupJob(jobId: string): Promise<BridgeResult<Job>> {
    const job = await jobManager.cleanupJob(jobId);
    if (job === null) {
      return failureResult("prerequisite", "The task was not found.");
    }
    return { ok: true, data: job };
  }

  public async checkWaitingJob(jobId: string): Promise<BridgeResult<Job>> {
    const job = jobManager.getJob(jobId);
    if (job === null) {
      return failureResult("prerequisite", "The task was not found.");
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
    const job = jobManager.confirmIrreversible(jobId, proceed);
    if (job === null) {
      return failureResult("prerequisite", "The task was not found.");
    }
    return { ok: true, data: job };
  }

  public async getJob(jobId: string): Promise<BridgeResult<Job | null>> {
    return { ok: true, data: jobManager.getJob(jobId) };
  }

  public async removeData(
    optionId: EngineOptionId,
  ): Promise<BridgeResult<void>> {
    if (engineService.activeEngineId() === optionId) {
      await engineService.stop();
    }
    const loaded = await loadInstallState();
    const record = loaded.state.installations.find(
      (item) => item.optionId === optionId,
    );
    if (record?.secretRef !== undefined) {
      try {
        deleteSecret(record.secretRef);
      } catch {}
    }
    if (isContainerOption(optionId)) {
      await removeAppContainer(
        defaultContainerName(optionId),
        true,
        defaultVolumeName(optionId),
      ).catch(() => null);
    } else {
      if (optionId === "sqlite") {
        for (const suffix of ["", "-wal", "-shm"]) {
          rmSync(`${sqlitePracticeFile()}${suffix}`, { force: true });
        }
      }
      await engineService.removeInstance(optionId);
    }
    await mutateInstallState((state) => {
      state.installations = state.installations.filter(
        (item) => item.optionId !== optionId,
      );
      if (state.activeOptionId === optionId) {
        state.activeOptionId = state.installations.find(
          (item) => item.status === "ready",
        )?.optionId;
      }
    });
    return { ok: true, data: undefined };
  }

  public async getStorageUsage(): Promise<
    BridgeResult<Record<string, EngineStorageUsage>>
  > {
    const loaded = await loadInstallState();
    const usage: Record<string, EngineStorageUsage> = {};
    for (const record of loaded.state.installations) {
      if (record.optionId === "sqlite") {
        const dbFile = sqlitePracticeFile();
        const practiceBytes =
          bytesAt(dbFile) + bytesAt(`${dbFile}-wal`) + bytesAt(`${dbFile}-shm`);
        const dataBytes = sumDistinctPaths([
          dirname(dbFile),
          getInstanceDir("sqlite"),
          record.dataLocation,
        ]);
        const entryUsage: EngineStorageUsage = {
          practiceBytes,
          dataBytes: Math.max(dataBytes, practiceBytes),
        };
        cachedUsage.set("sqlite", entryUsage);
        usage.sqlite = entryUsage;
        continue;
      }

      const pkg = getPackage(record.optionId);
      const version = record.installedVersion ?? pkg?.version;
      const packDir =
        version !== undefined ? getPacksDir(record.optionId, version) : undefined;
      const instanceDir = getInstanceDir(record.optionId);
      const dataDir = record.dataLocation ?? getInstanceDataDir(record.optionId);
      const localDbDir =
        record.optionId === "sqlserver" ? localDbInstanceDir() : undefined;

      let practiceBytes = await measureActivePracticeBytes(record.optionId);
      if (practiceBytes === undefined) {
        if (record.optionId === "mysql") {
          const mysqlPracticeDir = join(dataDir, "practice");
          const onDisk = bytesAt(mysqlPracticeDir);
          practiceBytes = onDisk > 0 ? onDisk : cachedUsage.get("mysql")?.practiceBytes;
        } else if (record.optionId === "sqlserver") {
          const onDisk = measureSqlServerPracticeDiskBytes();
          practiceBytes =
            onDisk > 0 ? onDisk : cachedUsage.get("sqlserver")?.practiceBytes;
        } else {
          practiceBytes = cachedUsage.get(record.optionId)?.practiceBytes;
        }
      }

      const rawDataBytes = sumDistinctPaths([
        instanceDir,
        dataDir,
        packDir,
        localDbDir,
      ]);
      const dataBytes =
        practiceBytes !== undefined
          ? Math.max(rawDataBytes, practiceBytes)
          : rawDataBytes;

      const entryUsage: EngineStorageUsage = {
        practiceBytes,
        dataBytes: dataBytes > 0 ? dataBytes : undefined,
      };
      cachedUsage.set(record.optionId, entryUsage);
      usage[record.optionId] = entryUsage;
    }
    return { ok: true, data: usage };
  }

  public async containerLifecycle(
    optionId: EngineOptionId,
    action: ContainerLifecycleAction,
  ): Promise<BridgeResult<Job>> {
    if (!FEATURE_FLAGS.docker) {
      return failureResult(
        "prerequisite",
        "Docker container engines are coming soon and currently disabled.",
      );
    }
    if (action === "restart") {
      await restartAppContainer(defaultContainerName(optionId));
    }
    return this.startJob({
      optionId,
      kind: action === "stop" ? "container-stop" : "container-start",
    });
  }

  public async containerLogs(
    optionId: EngineOptionId,
    tail = 200,
  ): Promise<BridgeResult<string[]>> {
    return {
      ok: true,
      data: await getContainerLogs(defaultContainerName(optionId), tail),
    };
  }
}

function stringify(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const setupService = new SetupService();
export { catalogEntry, isContainerOption };
