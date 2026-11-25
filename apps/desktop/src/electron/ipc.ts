import { BrowserWindow } from "electron";
import type { IpcMain } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import { completeAi } from "./ai";
import type { AiCompletionRequest } from "../shared/desktop-api";
import type { EngineOptionId } from "../shared/engines";
import { engineService } from "./engine/service";
import { registerDialogHandlers } from "./dialogs";
import { showBadgeNotification, showStreakNotification } from "./notifications";
import { deleteSecret, retrieveSecret, storeSecret } from "./secrets";
import { deleteStoredValue, getStoredValue, setStoredValue } from "./storage";
import { setupService } from "./service/setup-service";
import { jobManager } from "./service/jobs";
import {
  failureResult,
  isAuthorizedSender,
  isValidJobId,
  isValidOptionId,
  isValidStartJobRequest,
} from "./service/validate";

function senderWindow(event: Electron.IpcMainEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

export function registerIpcHandlers(ipc: IpcMain): void {
  ipc.handle("storage:get", (_event, key: string) => getStoredValue(key));
  ipc.handle("storage:set", (_event, key: string, value: string) =>
    setStoredValue(key, value),
  );
  ipc.handle("storage:delete", (_event, key: string) => deleteStoredValue(key));

  ipc.handle("secrets:store", (_event, key: string, value: string) =>
    storeSecret(key, value),
  );
  ipc.handle("secrets:retrieve", (_event, key: string) => retrieveSecret(key));
  ipc.handle("secrets:delete", (_event, key: string) => deleteSecret(key));

  ipc.on("window:minimize", (event) => senderWindow(event)?.minimize());
  ipc.on("window:maximize", (event) => {
    const window = senderWindow(event);
    if (window === null) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipc.on("window:close", (event) => senderWindow(event)?.close());

  ipc.handle("database:initialize", (_event, setupSql?: string, name?: string, reset?: boolean) =>
    engineService.initializeDatabase(setupSql, name, reset === true),
  );
  ipc.handle("database:execute", (_event, sql: string) =>
    engineService.runSql(sql),
  );
  ipc.handle("database:use", (_event, name: string) =>
    engineService.useDatabase(name),
  );
  ipc.handle("database:list", () => engineService.listDatabases());
  ipc.handle("database:active", () => engineService.currentDatabase());
  ipc.handle("database:get-schema", () => engineService.getSchema());
  ipc.handle("database:isolated-run", (_event, setupSql: string, sql: string) =>
    engineService.runIsolatedSql(setupSql, sql),
  );

  ipc.handle("files:read-text", (_event, filePath: string) =>
    readFileSync(filePath, "utf8"),
  );
  ipc.handle("files:write-text", (_event, filePath: string, content: string) => {
    writeFileSync(filePath, content, "utf8");
  });

  const guarded = <T>(
    handler: (...args: unknown[]) => Promise<T> | T,
  ) => {
    return async (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => {
      if (!isAuthorizedSender(event)) {
        return failureResult(
          "permission",
          "Request blocked: sender is not authorized.",
          [],
        );
      }
      try {
        return await handler(...args);
      } catch (error) {
        return failureResult(
          "runtime",
          error instanceof Error ? error.message : String(error),
        );
      }
    };
  };

  const optionHandler = (
    channel: string,
    action: (optionId: EngineOptionId) => Promise<unknown>,
  ) => {
    ipc.handle(
      channel,
      guarded(async (optionId) => {
        if (!isValidOptionId(optionId)) {
          throw new Error("Unknown engine identifier.");
        }
        return action(optionId);
      }),
    );
  };

  ipc.handle("setup:snapshot", guarded(() => setupService.getSnapshot()));
  ipc.handle("setup:refresh", guarded(() => setupService.refreshStatus()));
  ipc.handle("setup:catalog", guarded(() => setupService.getCatalog()));
  ipc.handle("setup:compatibility", guarded(() => setupService.getCompatibility()));
  ipc.handle("setup:installations", guarded(() => setupService.getInstallations()));
  ipc.handle("setup:active-engine", guarded(() => setupService.getActiveEngine()));
  ipc.handle("setup:storage-usage", guarded(() => setupService.getStorageUsage()));

  optionHandler("setup:verify-connection", (optionId) =>
    setupService.verifyConnection(optionId),
  );
  optionHandler("setup:switch", (optionId) =>
    setupService.startJob({ optionId, kind: "switch" }),
  );
  optionHandler("setup:start", (optionId) =>
    setupService.startJob({ optionId, kind: "container-start" }),
  );
  optionHandler("setup:stop", (optionId) =>
    setupService.startJob({ optionId, kind: "container-stop" }),
  );
  optionHandler("setup:restart", (optionId) =>
    setupService.startJob({ optionId, kind: "container-start" }),
  );
  optionHandler("setup:repair", (optionId) =>
    setupService.startJob({ optionId, kind: "repair" }),
  );
  optionHandler("setup:reset", (optionId) =>
    setupService.startJob({ optionId, kind: "reset-practice" }),
  );
  optionHandler("setup:uninstall", (optionId) =>
    setupService.startJob({ optionId, kind: "uninstall" }),
  );
  optionHandler("setup:container-update-image", (optionId) =>
    setupService.startJob({ optionId, kind: "container-update" }),
  );
  optionHandler("setup:remove-data", (optionId) =>
    setupService.removeData(optionId),
  );
  optionHandler("setup:container-logs", async (optionId) =>
    setupService.containerLogs(optionId, 200),
  );

  ipc.handle(
    "setup:start-job",
    guarded(async (request) => {
      if (!isValidStartJobRequest(request)) {
        throw new Error("Invalid job request.");
      }
      return setupService.startJob(request);
    }),
  );

  ipc.handle(
    "setup:cancel-job",
    guarded(async (jobId) => {
      if (!isValidJobId(jobId)) throw new Error("Invalid job identifier.");
      return setupService.cancelJob(jobId);
    }),
  );

  ipc.handle(
    "setup:resume-job",
    guarded(async (jobId) => {
      if (!isValidJobId(jobId)) throw new Error("Invalid job identifier.");
      return setupService.resumeJob(jobId);
    }),
  );

  ipc.handle(
    "setup:cleanup-job",
    guarded(async (jobId) => {
      if (!isValidJobId(jobId)) throw new Error("Invalid job identifier.");
      return setupService.cleanupJob(jobId);
    }),
  );

  ipc.handle(
    "setup:check-waiting-job",
    guarded(async (jobId) => {
      if (!isValidJobId(jobId)) throw new Error("Invalid job identifier.");
      return setupService.checkWaitingJob(jobId);
    }),
  );

  ipc.handle(
    "setup:confirm-irreversible",
    guarded(async (jobId, proceed) => {
      if (!isValidJobId(jobId) || typeof proceed !== "boolean") {
        throw new Error("Invalid confirmation request.");
      }
      return setupService.confirmIrreversible(jobId, proceed);
    }),
  );

  ipc.handle(
    "setup:get-job",
    guarded(async (jobId) => {
      if (!isValidJobId(jobId)) throw new Error("Invalid job identifier.");
      return setupService.getJob(jobId);
    }),
  );

  ipc.handle("setup:subscribe-progress", (event) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Request blocked: sender is not authorized.",
        [],
      );
    }
    jobManager.registerSubscriber(event.sender);
    return { ok: true as const, data: undefined };
  });

  ipc.handle("ai:complete", (_event, request: AiCompletionRequest) =>
    completeAi(request),
  );
  ipc.handle("notifications:badge", (_event, title: string, body: string) =>
    showBadgeNotification(title, body),
  );
  ipc.handle("notifications:streak", (_event, streak: number) =>
    showStreakNotification(streak),
  );

  registerDialogHandlers();
}
