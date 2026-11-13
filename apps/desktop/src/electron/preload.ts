import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi, SqlResult } from "../shared/desktop-api";

const api: DesktopApi = {
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
  },
  storage: {
    get: (key) => ipcRenderer.invoke("storage:get", key) as Promise<string | null>,
    set: (key, value) => ipcRenderer.invoke("storage:set", key, value) as Promise<void>,
    delete: (key) => ipcRenderer.invoke("storage:delete", key) as Promise<void>,
    getAll: () => ipcRenderer.invoke("storage:get-all") as Promise<Record<string, string>>,
  },
  secrets: {
    store: (key, value) => ipcRenderer.invoke("secrets:store", key, value) as Promise<void>,
    retrieve: (key) => ipcRenderer.invoke("secrets:retrieve", key) as Promise<string | null>,
    delete: (key) => ipcRenderer.invoke("secrets:delete", key) as Promise<void>,
  },
  dialog: {
    openFile: (options) => ipcRenderer.invoke("dialog:open-file", options) as Promise<string | null>,
    saveFile: (options) => ipcRenderer.invoke("dialog:save-file", options) as Promise<string | null>,
  },
  database: {
    initialize: (setupSql) => ipcRenderer.invoke("database:initialize", setupSql) as Promise<void>,
    execute: (sql) => ipcRenderer.invoke("database:execute", sql),
    getSchema: () => ipcRenderer.invoke("database:get-schema"),
    reset: (setupSql) => ipcRenderer.invoke("database:reset", setupSql) as Promise<void>,
    loadSqlFile: (filePath) => ipcRenderer.invoke("database:load-sql-file", filePath) as Promise<void>,
    loadSqliteFile: (filePath) =>
      ipcRenderer.invoke("database:load-sqlite-file", filePath) as Promise<void>,
    importCsv: (filePath, tableName) =>
      ipcRenderer.invoke("database:import-csv", filePath, tableName) as Promise<number>,
    isolatedRun: (setupSql, sql) =>
      ipcRenderer.invoke("database:isolated-run", setupSql, sql) as Promise<SqlResult[]>,
    close: () => ipcRenderer.invoke("database:close") as Promise<void>,
  },
  files: {
    readText: (filePath) => ipcRenderer.invoke("files:read-text", filePath) as Promise<string>,
    writeText: (filePath, content) =>
      ipcRenderer.invoke("files:write-text", filePath, content) as Promise<void>,
  },
  ai: {
    complete: (request) => ipcRenderer.invoke("ai:complete", request) as Promise<string>,
  },
  notifications: {
    badge: (title, body) => ipcRenderer.invoke("notifications:badge", title, body) as Promise<void>,
    streak: (streak) => ipcRenderer.invoke("notifications:streak", streak) as Promise<void>,
  },
  menu: {
    onNavigate: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, path: string): void => {
        callback(path);
      };
      ipcRenderer.on("navigate", listener);
      return () => {
        ipcRenderer.removeListener("navigate", listener);
      };
    },
  },
  system: {
    getVersion: () => ipcRenderer.invoke("system:get-version") as Promise<string>,
    getPlatform: () => ipcRenderer.invoke("system:get-platform") as Promise<string>,
    getName: () => ipcRenderer.invoke("system:get-name") as Promise<string>,
  },
};

contextBridge.exposeInMainWorld("logixzen", api);
