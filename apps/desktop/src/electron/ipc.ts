import { BrowserWindow } from "electron";
import type { IpcMain } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import { completeAi } from "./ai";
import type { AiCompletionRequest } from "../shared/desktop-api";
import type { JobKind } from "../shared/engines";
import { registerDialogHandlers } from "./dialogs";
import { showBadgeNotification, showStreakNotification } from "./notifications";
import { deleteSecret, retrieveSecret, storeSecret } from "./secrets";
import { desktopSqlEngine } from "./sql/engine";
import { connectionRegistry } from "./sql/registry";
import { deleteStoredValue, getStoredValue, setStoredValue } from "./storage";
import { setupService } from "./service/setup-service";
import { jobManager } from "./service/jobs";
import { clearStagingCache, getStagingCacheSize } from "./service/downloader";
import {
  failureResult,
  isAuthorizedSender,
  isValidDocsTopic,
  isValidJobId,
  isValidLifecycleAction,
  isValidLineCount,
  isValidLogName,
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
    if (!window) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  ipc.on("window:close", (event) => senderWindow(event)?.close());

  ipc.handle(
    "database:initialize",
    async (_event, setupSql?: string, name?: string) => {
      if (connectionRegistry.getActiveOptionId() === "sqlite") {
        desktopSqlEngine.initialize(setupSql, name);
        return;
      }
      await connectionRegistry.resetDatabase(setupSql ?? "");
    },
  );
  ipc.handle("database:execute", async (_event, sql: string) => {
    if (connectionRegistry.getActiveOptionId() === "sqlite") {
      return desktopSqlEngine.execute(sql);
    }
    return connectionRegistry.execute(sql);
  });
  ipc.handle("database:use", async (_event, name: string) => {
    if (connectionRegistry.getActiveOptionId() === "sqlite") {
      desktopSqlEngine.use(name);
      return;
    }
    await connectionRegistry.useDatabase(name);
  });
  ipc.handle("database:list", async () => {
    if (connectionRegistry.getActiveOptionId() === "sqlite") {
      return desktopSqlEngine.list();
    }
    return connectionRegistry.listDatabases();
  });
  ipc.handle("database:active", () => {
    if (connectionRegistry.getActiveOptionId() === "sqlite") {
      return desktopSqlEngine.activeName();
    }
    return connectionRegistry.currentDatabase();
  });
  ipc.handle("database:get-schema", async () => {
    if (connectionRegistry.getActiveOptionId() === "sqlite") {
      return desktopSqlEngine.getSchema();
    }
    return connectionRegistry.getSchema();
  });
  ipc.handle("database:isolated-run", (_event, setupSql: string, sql: string) =>
    desktopSqlEngine.isolatedRun(setupSql, sql),
  );

  ipc.handle("files:read-text", (_event, filePath: string) =>
    readFileSync(filePath, "utf8"),
  );
  ipc.handle(
    "files:write-text",
    (_event, filePath: string, content: string) => {
      writeFileSync(filePath, content, "utf8");
    },
  );

  ipc.handle("setup:snapshot", (event) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    return setupService.getSnapshot();
  });

  ipc.handle("setup:refresh", (event) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    return setupService.refreshStatus();
  });

  ipc.handle("setup:catalog", (event) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    return setupService.getCatalog();
  });

  ipc.handle("setup:compatibility", (event) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    return setupService.getCompatibility();
  });

  ipc.handle("setup:installations", (event) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    return setupService.getInstallations();
  });

  ipc.handle("setup:verify-connection", (event, optionId: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    if (!isValidOptionId(optionId)) {
      return failureResult(
        "prerequisite",
        "Invalid engine identifier. Check available options.",
        [],
      );
    }
    return setupService.verifyConnection(optionId);
  });

  ipc.handle("setup:start-job", (event, request: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    if (!isValidStartJobRequest(request)) {
      return failureResult(
        "prerequisite",
        "Invalid job parameters. Check engine and action type.",
        [],
      );
    }
    return setupService.startJob(request);
  });

  ipc.handle("setup:cancel-job", (event, jobId: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    if (!isValidJobId(jobId)) {
      return failureResult(
        "prerequisite",
        "Invalid job identifier. Check active jobs.",
        [],
      );
    }
    return setupService.cancelJob(jobId);
  });

  ipc.handle("setup:resume-job", (event, jobId: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    if (!isValidJobId(jobId)) {
      return failureResult(
        "prerequisite",
        "Invalid job identifier. Check active jobs.",
        [],
      );
    }
    return setupService.resumeJob(jobId);
  });

  ipc.handle("setup:cleanup-job", (event, jobId: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    if (!isValidJobId(jobId)) {
      return failureResult(
        "prerequisite",
        "Invalid job identifier. Check active jobs.",
        [],
      );
    }
    return setupService.cleanupJob(jobId);
  });

  ipc.handle("setup:check-waiting-job", (event, jobId: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    if (!isValidJobId(jobId)) {
      return failureResult(
        "prerequisite",
        "Invalid job identifier. Check active jobs.",
        [],
      );
    }
    return setupService.checkWaitingJob(jobId);
  });

  ipc.handle(
    "setup:confirm-irreversible",
    (event, jobId: unknown, proceed: unknown) => {
      if (!isAuthorizedSender(event)) {
        return failureResult(
          "permission",
          "Action blocked because request sender is unauthorized.",
          [],
        );
      }
      if (!isValidJobId(jobId) || typeof proceed !== "boolean") {
        return failureResult(
          "prerequisite",
          "Invalid confirmation parameters.",
          [],
        );
      }
      return setupService.confirmIrreversible(jobId, proceed);
    },
  );

  ipc.handle("setup:get-job", (event, jobId: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    if (!isValidJobId(jobId)) {
      return failureResult(
        "prerequisite",
        "Invalid job identifier. Check active jobs.",
        [],
      );
    }
    return setupService.getJob(jobId);
  });

  ipc.handle("setup:subscribe-progress", (event) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    jobManager.registerSubscriber(event.sender);
    return { ok: true, data: undefined };
  });

  const engineActions: Array<{ channel: string; kind: JobKind }> = [
    { channel: "setup:activate", kind: "install" },
    { channel: "setup:start", kind: "container-start" },
    { channel: "setup:stop", kind: "container-stop" },
    { channel: "setup:restart", kind: "container-start" },
    { channel: "setup:repair", kind: "repair" },
    { channel: "setup:reset", kind: "reset-practice" },
    { channel: "setup:reinitialize", kind: "reset-practice" },
    { channel: "setup:backup", kind: "backup" },
    { channel: "setup:restore", kind: "restore" },
    { channel: "setup:uninstall", kind: "uninstall" },
    { channel: "setup:provision-container", kind: "install" },
    { channel: "setup:container-update-image", kind: "container-update" },
    { channel: "setup:remove-container", kind: "container-remove" },
    { channel: "setup:switch", kind: "switch" },
  ];

  for (const { channel, kind } of engineActions) {
    ipc.handle(channel, (event, optionId: unknown) => {
      if (!isAuthorizedSender(event)) {
        return failureResult(
          "permission",
          "Action blocked because request sender is unauthorized.",
          [],
        );
      }
      if (!isValidOptionId(optionId)) {
        return failureResult(
          "prerequisite",
          "Invalid engine identifier. Check available options.",
          [],
        );
      }
      return setupService.executeAction(optionId, kind);
    });
  }

  ipc.handle("setup:remove-data", async (event, optionId: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    if (!isValidOptionId(optionId)) {
      return failureResult(
        "prerequisite",
        "Invalid engine identifier. Check available options.",
        [],
      );
    }
    await setupService.deleteEngineData(optionId);
    return setupService.executeAction(optionId, "uninstall");
  });

  ipc.handle("setup:remove-volume", (event, optionId: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    if (!isValidOptionId(optionId)) {
      return failureResult(
        "prerequisite",
        "Invalid engine identifier. Check available options.",
        [],
      );
    }
    return setupService.removeVolume(optionId);
  });

  ipc.handle(
    "setup:container-lifecycle",
    (event, optionId: unknown, action: unknown) => {
      if (!isAuthorizedSender(event)) {
        return failureResult(
          "permission",
          "Action blocked because request sender is unauthorized.",
          [],
        );
      }
      if (!isValidOptionId(optionId) || !isValidLifecycleAction(action)) {
        return failureResult(
          "prerequisite",
          "Invalid container lifecycle parameters. Check options.",
          [],
        );
      }
      return setupService.containerLifecycle(optionId, action);
    },
  );

  ipc.handle("setup:container-stats", (event, optionId: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    if (!isValidOptionId(optionId)) {
      return failureResult(
        "prerequisite",
        "Invalid engine identifier. Check available options.",
        [],
      );
    }
    return setupService.containerStats(optionId);
  });

  ipc.handle("setup:container-details", (event, optionId: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    if (!isValidOptionId(optionId)) {
      return failureResult(
        "prerequisite",
        "Invalid engine identifier. Check available options.",
        [],
      );
    }
    return setupService.containerDetails(optionId);
  });

  ipc.handle(
    "setup:container-logs",
    (event, optionId: unknown, tail: unknown) => {
      if (!isAuthorizedSender(event)) {
        return failureResult(
          "permission",
          "Action blocked because request sender is unauthorized.",
          [],
        );
      }
      if (!isValidOptionId(optionId)) {
        return failureResult(
          "prerequisite",
          "Invalid engine identifier. Check available options.",
          [],
        );
      }
      const lines =
        typeof tail === "number" && isValidLineCount(tail) ? tail : 100;
      return setupService.containerLogs(optionId, lines);
    },
  );

  ipc.handle("setup:list-logs", (event) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    return setupService.listLogs();
  });

  ipc.handle("setup:tail-log", (event, name: unknown, lines: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    if (!isValidLogName(name)) {
      return failureResult(
        "prerequisite",
        "Invalid log file name. Check list of available logs.",
        [],
      );
    }
    const count =
      typeof lines === "number" && isValidLineCount(lines) ? lines : 100;
    return setupService.tailLog(name, count);
  });

  ipc.handle("setup:open-logs-folder", (event) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    return setupService.openLogsFolder();
  });

  ipc.handle("setup:diagnostics-summary", (event) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    return setupService.diagnosticsSummary();
  });

  ipc.handle("setup:open-docs", (event, topic: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    if (!isValidDocsTopic(topic)) {
      return failureResult(
        "unsupported",
        "Unrecognized documentation topic. Choose a supported topic.",
        [],
      );
    }
    return setupService.openDocs(topic);
  });

  ipc.handle("setup:docker-guidance", (event) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    return setupService.getDockerGuidance();
  });

  ipc.handle("setup:open-external-url", (event, url: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    if (typeof url !== "string" || url.length === 0) {
      return failureResult("unsupported", "Invalid URL provided.", []);
    }
    return setupService.openExternalUrl(url);
  });

  ipc.handle("setup:cache-size", (event) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    return { ok: true, data: getStagingCacheSize() };
  });

  ipc.handle("setup:clear-cache", (event) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    clearStagingCache();
    return { ok: true, data: undefined };
  });

  ipc.handle("setup:active-engine", (event) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    return setupService.getActiveEngine();
  });

  ipc.handle("setup:storage-usage", (event) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    return setupService.getStorageUsage();
  });

  ipc.handle("setup:list-backups", (event, optionId: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    const filterId = isValidOptionId(optionId) ? optionId : undefined;
    return setupService.listBackups(filterId);
  });

  ipc.handle("setup:cleanup-backups", (event, keepCount: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    const count =
      typeof keepCount === "number" && keepCount >= 0 ? keepCount : 5;
    return setupService.cleanupBackups(count);
  });

  ipc.handle("setup:list-orphan-containers", (event) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    return setupService.listOrphanContainers();
  });

  ipc.handle("setup:cleanup-orphan-container", (event, name: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    if (typeof name !== "string" || !name.startsWith("logixzen-")) {
      return failureResult(
        "prerequisite",
        "Invalid container name for orphan cleanup.",
        [],
      );
    }
    return setupService.cleanupOrphanContainer(name);
  });

  ipc.handle("setup:doctor", (event, optionId: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    if (!isValidOptionId(optionId)) {
      return failureResult(
        "prerequisite",
        "Invalid engine identifier. Check available options.",
        [],
      );
    }
    return setupService.doctor(optionId);
  });

  ipc.handle(
    "setup:repair-issue",
    (event, optionId: unknown, issueId: unknown) => {
      if (!isAuthorizedSender(event)) {
        return failureResult(
          "permission",
          "Action blocked because request sender is unauthorized.",
          [],
        );
      }
      if (!isValidOptionId(optionId)) {
        return failureResult(
          "prerequisite",
          "Invalid engine identifier. Check available options.",
          [],
        );
      }
      const issueStr = typeof issueId === "string" ? issueId : undefined;
      return setupService.repairIssue(optionId, issueStr);
    },
  );

  ipc.handle("setup:export-support-bundle", (event, targetPath: unknown) => {
    if (!isAuthorizedSender(event)) {
      return failureResult(
        "permission",
        "Action blocked because request sender is unauthorized.",
        [],
      );
    }
    const pathStr =
      typeof targetPath === "string" && targetPath.length > 0
        ? targetPath
        : undefined;
    return setupService.exportSupportBundle(pathStr);
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
