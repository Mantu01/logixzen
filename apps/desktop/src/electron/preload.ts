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
    initialize: (setupSql, name) =>
      ipcRenderer.invoke("database:initialize", setupSql, name) as Promise<void>,
    execute: (sql) => ipcRenderer.invoke("database:execute", sql),
    use: (name) => ipcRenderer.invoke("database:use", name) as Promise<void>,
    list: () => ipcRenderer.invoke("database:list") as Promise<string[]>,
    active: () => ipcRenderer.invoke("database:active") as Promise<string | null>,
    getSchema: () => ipcRenderer.invoke("database:get-schema"),
    isolatedRun: (setupSql, sql) =>
      ipcRenderer.invoke("database:isolated-run", setupSql, sql) as Promise<SqlResult[]>,
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
};
contextBridge.exposeInMainWorld("logixzen", api);
