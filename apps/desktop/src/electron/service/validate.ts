import { BrowserWindow } from "electron";
import type { IpcMainEvent, IpcMainInvokeEvent } from "electron";
import type {
  BridgeResult,
  ContainerLifecycleAction,
  DocsTopicId,
  EngineOptionId,
  FailureCode,
  JobKind,
  OperationFailure,
  RecoveryActionId,
  StartJobRequest,
} from "../../shared/engines";
import { ENGINE_CATALOG } from "../../shared/engine-catalog";

const VALID_OPTION_IDS: ReadonlySet<string> = new Set(
  ENGINE_CATALOG.map((entry) => entry.id),
);

const VALID_JOB_KINDS: ReadonlySet<JobKind> = new Set([
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
]);

const VALID_LIFECYCLE_ACTIONS: ReadonlySet<ContainerLifecycleAction> = new Set([
  "start",
  "stop",
  "restart",
]);

const VALID_DOC_TOPICS: ReadonlySet<DocsTopicId> = new Set([
  "docker-install-windows",
  "docker-install-macos",
  "sql-server-express",
  "sql-server-localdb",
  "sqlite",
  "postgres",
  "mysql",
]);

export function isAuthorizedSender(
  event: IpcMainInvokeEvent | IpcMainEvent,
): boolean {
  try {
    if (BrowserWindow && typeof BrowserWindow.fromWebContents === "function") {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window || window.isDestroyed()) return false;
    }
    const url = event.sender?.getURL?.() ?? "";
    return (
      url.startsWith("logixzen://app") ||
      url.startsWith("http://localhost:3000")
    );
  } catch {
    return false;
  }
}

export function failureResult<T>(
  code: FailureCode,
  cause: string,
  recovery: RecoveryActionId[] = ["retry"],
  detail?: string,
): BridgeResult<T> {
  const failure: OperationFailure = { code, cause, recovery };
  if (detail !== undefined) failure.detail = detail;
  return { ok: false, failure };
}

export function isValidOptionId(value: unknown): value is EngineOptionId {
  return (
    typeof value === "string" && VALID_OPTION_IDS.has(value as EngineOptionId)
  );
}

function isValidJobKind(value: unknown): value is JobKind {
  return typeof value === "string" && VALID_JOB_KINDS.has(value as JobKind);
}

export function isValidJobId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 64 &&
    /^[a-zA-Z0-9_-]+$/.test(value)
  );
}

export function isValidLifecycleAction(
  value: unknown,
): value is ContainerLifecycleAction {
  return (
    typeof value === "string" &&
    VALID_LIFECYCLE_ACTIONS.has(value as ContainerLifecycleAction)
  );
}

export function isValidDocsTopic(value: unknown): value is DocsTopicId {
  return (
    typeof value === "string" && VALID_DOC_TOPICS.has(value as DocsTopicId)
  );
}

export function isValidLogName(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64)
    return false;
  if (value.includes("..") || value.includes("/") || value.includes("\\"))
    return false;
  return /^[a-zA-Z0-9_.-]+$/.test(value);
}

export function isValidLineCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 1000
  );
}

export function isValidStartJobRequest(
  value: unknown,
): value is StartJobRequest {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return isValidOptionId(candidate.optionId) && isValidJobKind(candidate.kind);
}
