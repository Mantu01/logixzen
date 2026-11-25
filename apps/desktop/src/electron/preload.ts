import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi, SqlResult } from "../shared/desktop-api";

const api: DesktopApi = {
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
  },
  storage: {
    get: (key) => ipcRenderer.invoke("storage:get", key),
    set: (key, value) => ipcRenderer.invoke("storage:set", key, value),
    delete: (key) => ipcRenderer.invoke("storage:delete", key),
  },
  secrets: {
    store: (key, value) => ipcRenderer.invoke("secrets:store", key, value),
    retrieve: (key) => ipcRenderer.invoke("secrets:retrieve", key),
    delete: (key) => ipcRenderer.invoke("secrets:delete", key),
  },
  dialog: {
    openFile: (options) => ipcRenderer.invoke("dialog:open-file", options),
    saveFile: (options) => ipcRenderer.invoke("dialog:save-file", options),
  },
  database: {
    initialize: (setupSql, name, reset) =>
      ipcRenderer.invoke("database:initialize", setupSql, name, reset),
    execute: (sql) => ipcRenderer.invoke("database:execute", sql),
    use: (name) => ipcRenderer.invoke("database:use", name),
    list: () => ipcRenderer.invoke("database:list"),
    active: () => ipcRenderer.invoke("database:active"),
    getSchema: () => ipcRenderer.invoke("database:get-schema"),
    isolatedRun: (setupSql, sql) =>
      ipcRenderer.invoke("database:isolated-run", setupSql, sql) as Promise<
        SqlResult[]
      >,
  },
  files: {
    readText: (filePath) => ipcRenderer.invoke("files:read-text", filePath),
    writeText: (filePath, content) =>
      ipcRenderer.invoke("files:write-text", filePath, content),
  },
  setup: {
    snapshot: () => ipcRenderer.invoke("setup:snapshot"),
    catalog: () => ipcRenderer.invoke("setup:catalog"),
    compatibility: () => ipcRenderer.invoke("setup:compatibility"),
    installations: () => ipcRenderer.invoke("setup:installations"),
    refresh: () => ipcRenderer.invoke("setup:refresh"),
    verifyConnection: (optionId) =>
      ipcRenderer.invoke("setup:verify-connection", optionId),
    startJob: (request) => ipcRenderer.invoke("setup:start-job", request),
    cancelJob: (jobId) => ipcRenderer.invoke("setup:cancel-job", jobId),
    resumeJob: (jobId) => ipcRenderer.invoke("setup:resume-job", jobId),
    cleanupJob: (jobId) => ipcRenderer.invoke("setup:cleanup-job", jobId),
    checkWaitingJob: (jobId) =>
      ipcRenderer.invoke("setup:check-waiting-job", jobId),
    confirmIrreversible: (jobId, proceed) =>
      ipcRenderer.invoke("setup:confirm-irreversible", jobId, proceed),
    getJob: (jobId) => ipcRenderer.invoke("setup:get-job", jobId),
    subscribeProgress: (callback) => {
      const lastSequenceByJob = new Map<string, number>();
      const listener = (
        _event: Electron.IpcRendererEvent,
        progress: Parameters<typeof callback>[0],
      ): void => {
        const last = lastSequenceByJob.get(progress.jobId) ?? -1;
        if (progress.sequence <= last) return;
        lastSequenceByJob.set(progress.jobId, progress.sequence);
        callback(progress);
      };
      ipcRenderer.on("setup:progress", listener);
      void ipcRenderer.invoke("setup:subscribe-progress");
      return () => {
        ipcRenderer.removeListener("setup:progress", listener);
      };
    },
    switch: (optionId) => ipcRenderer.invoke("setup:switch", optionId),
    getActiveEngine: () => ipcRenderer.invoke("setup:active-engine"),
    storageUsage: () => ipcRenderer.invoke("setup:storage-usage"),
    start: (optionId) => ipcRenderer.invoke("setup:start", optionId),
    stop: (optionId) => ipcRenderer.invoke("setup:stop", optionId),
    restart: (optionId) => ipcRenderer.invoke("setup:restart", optionId),
    repair: (optionId) => ipcRenderer.invoke("setup:repair", optionId),
    reset: (optionId) => ipcRenderer.invoke("setup:reset", optionId),
    uninstall: (optionId) => ipcRenderer.invoke("setup:uninstall", optionId),
    removeData: (optionId) => ipcRenderer.invoke("setup:remove-data", optionId),
    containerUpdateImage: (optionId) =>
      ipcRenderer.invoke("setup:container-update-image", optionId),
    containerLogs: (optionId, tail) =>
      ipcRenderer.invoke("setup:container-logs", optionId, tail ?? 200),
  },
  ai: {
    complete: (request) => ipcRenderer.invoke("ai:complete", request),
  },
  notifications: {
    badge: (title, body) =>
      ipcRenderer.invoke("notifications:badge", title, body),
    streak: (streak) => ipcRenderer.invoke("notifications:streak", streak),
  },
  menu: {
    onNavigate: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        path: string,
      ): void => {
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
