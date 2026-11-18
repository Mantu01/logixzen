import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi, SqlResult } from "../shared/desktop-api";
import type {
  BackupManifest,
  BridgeResult,
  ContainerStats,
  ContainerTechnicalDetails,
  DiagnosticsSummary,
  DockerGuidanceContent,
  EngineCatalogEntry,
  EngineDoctorReport,
  EngineOffer,
  EngineOptionId,
  EngineStorageUsage,
  InstallationRecord,
  Job,
  LogFileSummary,
  OrphanContainerSummary,
  PlatformSnapshot,
  ProgressEvent,
  SupportBundleSummary,
  VerificationResult,
} from "../shared/engines";

const api: DesktopApi = {
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
  },
  storage: {
    get: (key) =>
      ipcRenderer.invoke("storage:get", key) as Promise<string | null>,
    set: (key, value) =>
      ipcRenderer.invoke("storage:set", key, value) as Promise<void>,
    delete: (key) => ipcRenderer.invoke("storage:delete", key) as Promise<void>,
  },
  secrets: {
    store: (key, value) =>
      ipcRenderer.invoke("secrets:store", key, value) as Promise<void>,
    retrieve: (key) =>
      ipcRenderer.invoke("secrets:retrieve", key) as Promise<string | null>,
    delete: (key) => ipcRenderer.invoke("secrets:delete", key) as Promise<void>,
  },
  dialog: {
    openFile: (options) =>
      ipcRenderer.invoke("dialog:open-file", options) as Promise<string | null>,
    saveFile: (options) =>
      ipcRenderer.invoke("dialog:save-file", options) as Promise<string | null>,
  },
  database: {
    initialize: (setupSql, name) =>
      ipcRenderer.invoke(
        "database:initialize",
        setupSql,
        name,
      ) as Promise<void>,
    execute: (sql) => ipcRenderer.invoke("database:execute", sql),
    use: (name) => ipcRenderer.invoke("database:use", name) as Promise<void>,
    list: () => ipcRenderer.invoke("database:list") as Promise<string[]>,
    active: () =>
      ipcRenderer.invoke("database:active") as Promise<string | null>,
    getSchema: () => ipcRenderer.invoke("database:get-schema"),
    isolatedRun: (setupSql, sql) =>
      ipcRenderer.invoke("database:isolated-run", setupSql, sql) as Promise<
        SqlResult[]
      >,
  },
  files: {
    readText: (filePath) =>
      ipcRenderer.invoke("files:read-text", filePath) as Promise<string>,
    writeText: (filePath, content) =>
      ipcRenderer.invoke(
        "files:write-text",
        filePath,
        content,
      ) as Promise<void>,
  },
  setup: {
    snapshot: () =>
      ipcRenderer.invoke("setup:snapshot") as Promise<
        BridgeResult<PlatformSnapshot>
      >,
    catalog: () =>
      ipcRenderer.invoke("setup:catalog") as Promise<
        BridgeResult<EngineCatalogEntry[]>
      >,
    compatibility: () =>
      ipcRenderer.invoke("setup:compatibility") as Promise<
        BridgeResult<EngineOffer[]>
      >,
    installations: () =>
      ipcRenderer.invoke("setup:installations") as Promise<
        BridgeResult<InstallationRecord[]>
      >,
    refresh: () =>
      ipcRenderer.invoke("setup:refresh") as Promise<
        BridgeResult<PlatformSnapshot>
      >,
    verifyConnection: (optionId) =>
      ipcRenderer.invoke("setup:verify-connection", optionId) as Promise<
        BridgeResult<VerificationResult>
      >,
    startJob: (request) =>
      ipcRenderer.invoke("setup:start-job", request) as Promise<
        BridgeResult<Job>
      >,
    cancelJob: (jobId) =>
      ipcRenderer.invoke("setup:cancel-job", jobId) as Promise<
        BridgeResult<Job>
      >,
    resumeJob: (jobId) =>
      ipcRenderer.invoke("setup:resume-job", jobId) as Promise<
        BridgeResult<Job>
      >,
    cleanupJob: (jobId) =>
      ipcRenderer.invoke("setup:cleanup-job", jobId) as Promise<
        BridgeResult<Job>
      >,
    checkWaitingJob: (jobId) =>
      ipcRenderer.invoke("setup:check-waiting-job", jobId) as Promise<
        BridgeResult<Job>
      >,
    confirmIrreversible: (jobId, proceed) =>
      ipcRenderer.invoke(
        "setup:confirm-irreversible",
        jobId,
        proceed,
      ) as Promise<BridgeResult<Job>>,
    getJob: (jobId) =>
      ipcRenderer.invoke("setup:get-job", jobId) as Promise<
        BridgeResult<Job | null>
      >,
    subscribeProgress: (callback) => {
      const lastSequenceByJob = new Map<string, number>();
      const listener = (
        _event: Electron.IpcRendererEvent,
        progress: ProgressEvent,
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
    switch: (optionId) =>
      ipcRenderer.invoke("setup:switch", optionId) as Promise<
        BridgeResult<Job>
      >,
    getActiveEngine: () =>
      ipcRenderer.invoke("setup:active-engine") as Promise<
        BridgeResult<EngineOptionId>
      >,
    storageUsage: () =>
      ipcRenderer.invoke("setup:storage-usage") as Promise<
        BridgeResult<Record<string, EngineStorageUsage>>
      >,
    activate: (optionId) =>
      ipcRenderer.invoke("setup:activate", optionId) as Promise<
        BridgeResult<Job>
      >,
    start: (optionId) =>
      ipcRenderer.invoke("setup:start", optionId) as Promise<BridgeResult<Job>>,
    stop: (optionId) =>
      ipcRenderer.invoke("setup:stop", optionId) as Promise<BridgeResult<Job>>,
    restart: (optionId) =>
      ipcRenderer.invoke("setup:restart", optionId) as Promise<
        BridgeResult<Job>
      >,
    repair: (optionId) =>
      ipcRenderer.invoke("setup:repair", optionId) as Promise<
        BridgeResult<Job>
      >,
    reset: (optionId) =>
      ipcRenderer.invoke("setup:reset", optionId) as Promise<BridgeResult<Job>>,
    reinitialize: (optionId) =>
      ipcRenderer.invoke("setup:reinitialize", optionId) as Promise<
        BridgeResult<Job>
      >,
    backup: (optionId) =>
      ipcRenderer.invoke("setup:backup", optionId) as Promise<
        BridgeResult<Job>
      >,
    restore: (optionId) =>
      ipcRenderer.invoke("setup:restore", optionId) as Promise<
        BridgeResult<Job>
      >,
    listBackups: (optionId) =>
      ipcRenderer.invoke("setup:list-backups", optionId) as Promise<
        BridgeResult<BackupManifest[]>
      >,
    cleanupBackups: (keepCount) =>
      ipcRenderer.invoke("setup:cleanup-backups", keepCount) as Promise<
        BridgeResult<{ deletedCount: number; freedBytes: number }>
      >,
    uninstall: (optionId) =>
      ipcRenderer.invoke("setup:uninstall", optionId) as Promise<
        BridgeResult<Job>
      >,
    removeData: (optionId) =>
      ipcRenderer.invoke("setup:remove-data", optionId) as Promise<
        BridgeResult<Job>
      >,
    provisionContainer: (optionId) =>
      ipcRenderer.invoke("setup:provision-container", optionId) as Promise<
        BridgeResult<Job>
      >,
    containerLifecycle: (optionId, action) =>
      ipcRenderer.invoke(
        "setup:container-lifecycle",
        optionId,
        action,
      ) as Promise<BridgeResult<Job>>,
    containerStats: (optionId) =>
      ipcRenderer.invoke("setup:container-stats", optionId) as Promise<
        BridgeResult<ContainerStats>
      >,
    containerDetails: (optionId) =>
      ipcRenderer.invoke("setup:container-details", optionId) as Promise<
        BridgeResult<ContainerTechnicalDetails>
      >,
    containerLogs: (optionId, tail) =>
      ipcRenderer.invoke("setup:container-logs", optionId, tail) as Promise<
        BridgeResult<string[]>
      >,
    containerUpdateImage: (optionId) =>
      ipcRenderer.invoke("setup:container-update-image", optionId) as Promise<
        BridgeResult<Job>
      >,
    removeContainer: (optionId) =>
      ipcRenderer.invoke("setup:remove-container", optionId) as Promise<
        BridgeResult<Job>
      >,
    removeVolume: (optionId) =>
      ipcRenderer.invoke("setup:remove-volume", optionId) as Promise<
        BridgeResult<Job>
      >,
    listOrphanContainers: () =>
      ipcRenderer.invoke("setup:list-orphan-containers") as Promise<
        BridgeResult<OrphanContainerSummary[]>
      >,
    cleanupOrphanContainer: (name) =>
      ipcRenderer.invoke("setup:cleanup-orphan-container", name) as Promise<
        BridgeResult<void>
      >,
    listLogs: () =>
      ipcRenderer.invoke("setup:list-logs") as Promise<
        BridgeResult<LogFileSummary[]>
      >,
    tailLog: (name, lines) =>
      ipcRenderer.invoke("setup:tail-log", name, lines) as Promise<
        BridgeResult<string[]>
      >,
    openLogsFolder: () =>
      ipcRenderer.invoke("setup:open-logs-folder") as Promise<
        BridgeResult<void>
      >,
    diagnosticsSummary: () =>
      ipcRenderer.invoke("setup:diagnostics-summary") as Promise<
        BridgeResult<DiagnosticsSummary>
      >,
    openDocs: (topic) =>
      ipcRenderer.invoke("setup:open-docs", topic) as Promise<
        BridgeResult<void>
      >,
    getDockerGuidance: () =>
      ipcRenderer.invoke("setup:docker-guidance") as Promise<
        BridgeResult<DockerGuidanceContent>
      >,
    openExternalUrl: (url) =>
      ipcRenderer.invoke("setup:open-external-url", url) as Promise<
        BridgeResult<void>
      >,
    cacheSize: () =>
      ipcRenderer.invoke("setup:cache-size") as Promise<BridgeResult<number>>,
    clearCache: () =>
      ipcRenderer.invoke("setup:clear-cache") as Promise<BridgeResult<void>>,
    doctor: (optionId) =>
      ipcRenderer.invoke("setup:doctor", optionId) as Promise<
        BridgeResult<EngineDoctorReport>
      >,
    repairIssue: (optionId, issueId) =>
      ipcRenderer.invoke("setup:repair-issue", optionId, issueId) as Promise<
        BridgeResult<void>
      >,
    exportSupportBundle: (targetPath) =>
      ipcRenderer.invoke("setup:export-support-bundle", targetPath) as Promise<
        BridgeResult<SupportBundleSummary>
      >,
  },
  ai: {
    complete: (request) =>
      ipcRenderer.invoke("ai:complete", request) as Promise<string>,
  },
  notifications: {
    badge: (title, body) =>
      ipcRenderer.invoke("notifications:badge", title, body) as Promise<void>,
    streak: (streak) =>
      ipcRenderer.invoke("notifications:streak", streak) as Promise<void>,
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
