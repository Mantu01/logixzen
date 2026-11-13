import { app, BrowserWindow } from "electron";
import type { IpcMain } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import { completeAi } from "./ai";
import type { AiCompletionRequest } from "../shared/desktop-api";
import { registerDialogHandlers } from "./dialogs";
import { showBadgeNotification, showStreakNotification } from "./notifications";
import { deleteSecret, retrieveSecret, storeSecret } from "./secrets";
import { DesktopSqlEngine } from "./sql/engine";
import { deleteStoredValue, getAllStoredValues, getStoredValue, setStoredValue } from "./storage";

const engine = new DesktopSqlEngine();

function senderWindow(event: Electron.IpcMainEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

export function registerIpcHandlers(ipc: IpcMain): void {
  ipc.handle("storage:get", (_event, key: string) => getStoredValue(key));
  ipc.handle("storage:set", (_event, key: string, value: string) => setStoredValue(key, value));
  ipc.handle("storage:delete", (_event, key: string) => deleteStoredValue(key));
  ipc.handle("storage:get-all", () => getAllStoredValues());

  ipc.handle("secrets:store", (_event, key: string, value: string) => storeSecret(key, value));
  ipc.handle("secrets:retrieve", (_event, key: string) => retrieveSecret(key));
  ipc.handle("secrets:delete", (_event, key: string) => deleteSecret(key));

  ipc.handle("system:get-version", () => app.getVersion());
  ipc.handle("system:get-platform", () => process.platform);
  ipc.handle("system:get-name", () => app.getName());

  ipc.on("window:minimize", (event) => senderWindow(event)?.minimize());
  ipc.on("window:maximize", (event) => {
    const window = senderWindow(event);
    if (!window) {
      return;
    }
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });
  ipc.on("window:close", (event) => senderWindow(event)?.close());

  ipc.handle("database:initialize", (_event, setupSql?: string) => {
    engine.initialize(setupSql);
  });
  ipc.handle("database:execute", (_event, sql: string) => engine.execute(sql));
  ipc.handle("database:get-schema", () => engine.getSchema());
  ipc.handle("database:reset", (_event, setupSql?: string) => engine.reset(setupSql));
  ipc.handle("database:load-sql-file", (_event, filePath: string) => engine.loadSqlFile(filePath));
  ipc.handle("database:load-sqlite-file", (_event, filePath: string) => engine.loadSqliteFile(filePath));
  ipc.handle("database:import-csv", (_event, filePath: string, tableName: string) =>
    engine.importCsv(filePath, tableName),
  );
  ipc.handle("database:isolated-run", (_event, setupSql: string, sql: string) =>
    engine.isolatedRun(setupSql, sql),
  );
  ipc.handle("database:close", () => engine.close());

  ipc.handle("files:read-text", (_event, filePath: string) => readFileSync(filePath, "utf8"));
  ipc.handle("files:write-text", (_event, filePath: string, content: string) => {
    writeFileSync(filePath, content, "utf8");
  });

  ipc.handle("ai:complete", (_event, request: AiCompletionRequest) => completeAi(request));

  ipc.handle("notifications:badge", (_event, title: string, body: string) =>
    showBadgeNotification(title, body),
  );
  ipc.handle("notifications:streak", (_event, streak: number) => showStreakNotification(streak));

  registerDialogHandlers();
}
