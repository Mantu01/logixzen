import type {
  EngineId,
  EngineOptionId,
  InstallState,
  InstallStateIssue,
  InstallStateLoad,
  InstallMethod,
  InstallationRecord,
  JobKind,
  LifecycleStatus,
  RepairReason,
  VariantMetadata,
  VerificationResult,
} from "../../shared/engines";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { stateBackupFile, stateFile } from "../paths";

const SCHEMA_VERSION = 1;

const ENGINE_IDS: EngineId[] = [
  "sqlite",
  "mssql-express",
  "mssql-localdb",
  "mssql-container",
  "postgres-container",
  "mysql-container",
];

const METHODS: InstallMethod[] = [
  "bundled",
  "native-windows",
  "native-linux",
  "container",
];

const STATUSES: LifecycleStatus[] = [
  "not-installed",
  "detected",
  "activating",
  "installing",
  "installed",
  "verifying",
  "ready",
  "stopped",
  "needs-repair",
  "uninstalling",
  "failed",
];

const JOB_KINDS: JobKind[] = [
  "install",
  "activate",
  "configure",
  "initialize",
  "uninstall",
  "verify",
  "switch",
  "reset-practice",
  "backup",
  "restore",
  "repair",
  "container-provision",
  "container-start",
  "container-stop",
  "container-remove",
  "container-update",
];

interface Migration {
  from: number;
  to: number;
  apply: (state: InstallState) => InstallState;
}

const MIGRATIONS: Migration[] = [];

function emptyState(): InstallState {
  return { schemaVersion: SCHEMA_VERSION, installations: [] };
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8")) as unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function parseVariant(value: unknown): VariantMetadata | null {
  if (!isObject(value)) return null;
  const displayName = text(value.displayName);
  const publisher = text(value.publisher);
  const purpose = text(value.purpose);
  const technicalName = text(value.technicalName);
  const dialect = text(value.dialect);
  if (displayName === null || publisher === null || purpose === null)
    return null;
  if (technicalName === null || dialect === null) return null;
  if (
    dialect !== "sqlite" &&
    dialect !== "tsql" &&
    dialect !== "postgres" &&
    dialect !== "mysql"
  ) {
    return null;
  }
  return { displayName, publisher, purpose, technicalName, dialect };
}

function parseRecord(value: unknown): InstallationRecord | null {
  if (!isObject(value)) return null;
  const optionId = text(value.optionId);
  const engine = text(value.engine);
  const method = text(value.method);
  const status = text(value.status);
  const createdAt = text(value.createdAt);
  const updatedAt = text(value.updatedAt);
  if (optionId === null || engine === null || method === null) return null;
  if (status === null || createdAt === null || updatedAt === null) return null;
  if (!ENGINE_IDS.includes(engine as EngineId)) return null;
  if (!METHODS.includes(method as InstallMethod)) return null;
  if (!STATUSES.includes(status as LifecycleStatus)) return null;
  const variant = parseVariant(value.variant);
  if (variant === null) return null;
  const resources = isObject(value.resources) ? value.resources : {};
  const verification = isObject(value.lastVerification)
    ? value.lastVerification
    : null;

  return {
    optionId: optionId as EngineOptionId,
    engine: engine as EngineId,
    method: method as InstallMethod,
    variant,
    status: status as LifecycleStatus,
    installedVersion: optionalText(value.installedVersion),
    instanceName: optionalText(value.instanceName),
    containerName: optionalText(value.containerName),
    port: optionalNumber(value.port),
    dataLocation: optionalText(value.dataLocation),
    practiceSchemaVersion: optionalNumber(value.practiceSchemaVersion),
    licenseAcceptedAt: optionalText(value.licenseAcceptedAt),
    secretRef: optionalText(value.secretRef),
    installLog: optionalText(value.installLog),
    createdAt,
    updatedAt,
    lastVerification:
      verification === null
        ? undefined
        : {
            ok: verification.ok === true,
            checkedAt: optionalText(verification.checkedAt) ?? updatedAt,
            detail: optionalText(verification.detail),
          },
    resources: {
      service: optionalText(resources.service),
      instance: optionalText(resources.instance),
      container: optionalText(resources.container),
      volume: optionalText(resources.volume),
    },
  };
}

function parseState(value: unknown): InstallState | null {
  if (!isObject(value)) return null;
  if (
    typeof value.schemaVersion !== "number" ||
    !Number.isFinite(value.schemaVersion)
  ) {
    return null;
  }
  if (!Array.isArray(value.installations)) return null;
  const installations: InstallationRecord[] = [];
  for (const entry of value.installations) {
    const record = parseRecord(entry);
    if (record === null) return null;
    installations.push(record);
  }
  const activeOptionId = optionalText(value.activeOptionId);
  const journal = isObject(value.journal) ? value.journal : null;
  const journalEntry =
    journal !== null &&
    text(journal.jobId) !== null &&
    text(journal.kind) !== null &&
    text(journal.optionId) !== null &&
    text(journal.startedAt) !== null &&
    JOB_KINDS.includes(journal.kind as JobKind)
      ? {
          jobId: text(journal.jobId) ?? "",
          kind: journal.kind as JobKind,
          optionId: text(journal.optionId) as EngineOptionId,
          startedAt: text(journal.startedAt) ?? "",
          currentStageId: optionalText(journal.currentStageId),
          currentStageIndex: optionalNumber(journal.currentStageIndex),
          stageLabel: optionalText(journal.stageLabel),
          resources: isObject(journal.resources)
            ? {
                files: Array.isArray(journal.resources.files)
                  ? (journal.resources.files.filter(
                      (f) => typeof f === "string",
                    ) as string[])
                  : undefined,
                container: optionalText(journal.resources.container),
                volume: optionalText(journal.resources.volume),
                service: optionalText(journal.resources.service),
                instance: optionalText(journal.resources.instance),
              }
            : undefined,
          waitingAction: optionalText(journal.waitingAction),
        }
      : undefined;
  return {
    schemaVersion: value.schemaVersion,
    installations,
    activeOptionId: activeOptionId as EngineOptionId | undefined,
    journal: journalEntry,
  };
}

function migrate(
  state: InstallState,
  issues: InstallStateIssue[],
): InstallState | null {
  if (state.schemaVersion > SCHEMA_VERSION) {
    issues.push("state-read-only");
    return state;
  }
  let current = state;
  for (const migration of MIGRATIONS) {
    if (current.schemaVersion !== migration.from) continue;
    current = { ...migration.apply(current), schemaVersion: migration.to };
  }
  return current;
}

function persist(state: InstallState): void {
  const file = stateFile();
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${process.pid}.tmp`;
  const handle = openSync(temp, "w", 0o600);
  try {
    writeFileSync(handle, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    fsyncSync(handle);
  } finally {
    closeSync(handle);
  }
  if (existsSync(file)) renameSync(file, stateBackupFile());
  renameSync(temp, file);
}

interface FileOutcome {
  exists: boolean;
  state: InstallState | null;
}

function readFileState(file: string): FileOutcome {
  if (!existsSync(file)) return { exists: false, state: null };
  try {
    return { exists: true, state: parseState(readJson(file)) };
  } catch {
    return { exists: true, state: null };
  }
}

export async function loadInstallState(): Promise<InstallStateLoad> {
  const issues: InstallStateIssue[] = [];
  const primary = readFileState(stateFile());
  const backup = readFileState(stateBackupFile());
  const source = primary.state ?? backup.state;
  if (primary.state === null && backup.state !== null)
    issues.push("backup-restored");
  if (!primary.exists && !backup.exists) {
    return { state: emptyState(), issues, readOnly: false, repairs: [] };
  }
  if (source === null) {
    issues.push("state-corrupt");
    return { state: emptyState(), issues, readOnly: false, repairs: [] };
  }
  const migrated = migrate(source, issues);
  if (migrated === null) {
    issues.push("state-corrupt");
    return { state: emptyState(), issues, readOnly: false, repairs: [] };
  }
  if (migrated.journal !== undefined) issues.push("journal-interrupted");
  return {
    state: migrated,
    issues,
    readOnly: issues.includes("state-read-only"),
    repairs: [],
  };
}

let tail: Promise<unknown> = Promise.resolve();

function withInstallLock<T>(task: () => Promise<T> | T): Promise<T> {
  const run = tail.then(task, task);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function mutateInstallState(
  change: (state: InstallState) => InstallState | void,
): Promise<InstallStateLoad> {
  return withInstallLock(async () => {
    const loaded = await loadInstallState();
    if (loaded.readOnly) return loaded;
    const next = change(loaded.state) ?? loaded.state;
    persist({ ...next, schemaVersion: SCHEMA_VERSION });
    return { ...loaded, state: { ...next, schemaVersion: SCHEMA_VERSION } };
  });
}

export async function applyRepairs(
  repairs: Array<{ optionId: EngineOptionId; reason: RepairReason }>,
): Promise<InstallStateLoad> {
  return mutateInstallState((state) => {
    const now = new Date().toISOString();
    const installations = state.installations.map((record) => {
      const hit = repairs.find((repair) => repair.optionId === record.optionId);
      if (hit === undefined) return record;
      return {
        ...record,
        status: "needs-repair" as LifecycleStatus,
        updatedAt: now,
      };
    });
    return { ...state, installations, journal: undefined };
  });
}

export async function updateInstallation(
  record: InstallationRecord,
): Promise<InstallStateLoad> {
  return mutateInstallState((state) => {
    const idx = state.installations.findIndex(
      (item) => item.optionId === record.optionId,
    );
    const installations = [...state.installations];
    if (idx >= 0) {
      installations[idx] = record;
    } else {
      installations.push(record);
    }
    return {
      ...state,
      installations,
      activeOptionId: state.activeOptionId ?? record.optionId,
    };
  });
}

export async function updateInstallationStatus(
  optionId: EngineOptionId,
  status: LifecycleStatus,
  verification?: VerificationResult,
): Promise<InstallStateLoad> {
  return mutateInstallState((state) => {
    const now = new Date().toISOString();
    const installations = state.installations.map((item) => {
      if (item.optionId !== optionId) return item;
      return {
        ...item,
        status,
        updatedAt: now,
        lastVerification: verification ?? item.lastVerification,
      };
    });
    return { ...state, installations };
  });
}
