import { BrowserWindow } from "electron";
import type { IpcMain } from "electron";
import { readFileSync, writeFileSync } from "node:fs";
import { completeAi } from "./ai";
import type { AiCompletionRequest } from "../shared/desktop-api";
import { registerDialogHandlers } from "./dialogs";
import { showBadgeNotification, showStreakNotification } from "./notifications";
import { deleteSecret, retrieveSecret, storeSecret } from "./secrets";
import { DesktopSqlEngine } from "./sql/engine";
import { deleteStoredValue, getStoredValue, setStoredValue } from "./storage";

const engine = new DesktopSqlEngine();

function senderWindow(event: Electron.IpcMainEvent): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

export function registerIpcHandlers(ipc: IpcMain): void {
  ipc.handle("storage:get", (_event, key: string) => getStoredValue(key));
  ipc.handle("storage:set", (_event, key: string, value: string) => setStoredValue(key, value));
  ipc.handle("storage:delete", (_event, key: string) => deleteStoredValue(key));

  ipc.handle("secrets:store", (_event, key: string, value: string) => storeSecret(key, value));
  ipc.handle("secrets:retrieve", (_event, key: string) => retrieveSecret(key));
  ipc.handle("secrets:delete", (_event, key: string) => deleteSecret(key));

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

  ipc.handle("database:initialize", (_event, setupSql?: string, name?: string) => {
    engine.initialize(setupSql, name);
  });
  ipc.handle("database:execute", (_event, sql: string) => engine.execute(sql));
  ipc.handle("database:use", (_event, name: string) => engine.use(name));
  ipc.handle("database:list", () => engine.list());
  ipc.handle("database:active", () => engine.activeName());
  ipc.handle("database:get-schema", () => engine.getSchema());
  ipc.handle("database:isolated-run", (_event, setupSql: string, sql: string) =>
    engine.isolatedRun(setupSql, sql),
  );

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
