import type {
  BackupManifest,
  BridgeResult,
  ContainerLifecycleAction,
  ContainerStats,
  ContainerTechnicalDetails,
  DiagnosticsSummary,
  DockerGuidanceContent,
  DocsTopicId,
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
  StartJobRequest,
  SupportBundleSummary,
  VerificationResult,
} from "./engines";

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface OpenFileOptions {
  title?: string;
  filters?: FileFilter[];
}

export interface SaveFileOptions extends OpenFileOptions {
  defaultPath?: string;
}

export interface SqlRow {
  [key: string]: unknown;
}

export interface SqlResult {
  columns: string[];
  rows: SqlRow[];
  rowsAffected: number;
  error?: string;
  message?: string;
  statementIndex: number;
  isSelect: boolean;
  executionTimeMs: number;
}

interface ForeignKeyInfo {
  from: string;
  table: string;
  to: string;
}

export interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: unknown;
  primaryKey: boolean;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  sampleRows: SqlRow[];
  primaryKey?: string[];
  foreignKeys: ForeignKeyInfo[];
}

export type AiProvider = "openai" | "anthropic" | "openrouter" | "custom";

export interface AiCompletionRequest {
  provider: AiProvider;
  model: string;
  baseUrl: string | null;
  prompt: string;
  maxTokens?: number;
}

interface SetupApi {
  snapshot: () => Promise<BridgeResult<PlatformSnapshot>>;
  catalog: () => Promise<BridgeResult<EngineCatalogEntry[]>>;
  compatibility: () => Promise<BridgeResult<EngineOffer[]>>;
  installations: () => Promise<BridgeResult<InstallationRecord[]>>;
  refresh: () => Promise<BridgeResult<PlatformSnapshot>>;
  verifyConnection: (
    optionId: EngineOptionId,
  ) => Promise<BridgeResult<VerificationResult>>;
  startJob: (request: StartJobRequest) => Promise<BridgeResult<Job>>;
  cancelJob: (jobId: string) => Promise<BridgeResult<Job>>;
  resumeJob: (jobId: string) => Promise<BridgeResult<Job>>;
  cleanupJob: (jobId: string) => Promise<BridgeResult<Job>>;
  checkWaitingJob: (jobId: string) => Promise<BridgeResult<Job>>;
  confirmIrreversible: (
    jobId: string,
    proceed: boolean,
  ) => Promise<BridgeResult<Job>>;
  getJob: (jobId: string) => Promise<BridgeResult<Job | null>>;
  subscribeProgress: (callback: (event: ProgressEvent) => void) => () => void;
  switch: (optionId: EngineOptionId) => Promise<BridgeResult<Job>>;
  getActiveEngine: () => Promise<BridgeResult<EngineOptionId>>;
  storageUsage: () => Promise<BridgeResult<Record<string, EngineStorageUsage>>>;
  activate: (optionId: EngineOptionId) => Promise<BridgeResult<Job>>;
  start: (optionId: EngineOptionId) => Promise<BridgeResult<Job>>;
  stop: (optionId: EngineOptionId) => Promise<BridgeResult<Job>>;
  restart: (optionId: EngineOptionId) => Promise<BridgeResult<Job>>;
  repair: (optionId: EngineOptionId) => Promise<BridgeResult<Job>>;
  reset: (optionId: EngineOptionId) => Promise<BridgeResult<Job>>;
  reinitialize: (optionId: EngineOptionId) => Promise<BridgeResult<Job>>;
  backup: (optionId: EngineOptionId) => Promise<BridgeResult<Job>>;
  restore: (optionId: EngineOptionId) => Promise<BridgeResult<Job>>;
  listBackups: (
    optionId?: EngineOptionId,
  ) => Promise<BridgeResult<BackupManifest[]>>;
  cleanupBackups: (
    keepCount?: number,
  ) => Promise<BridgeResult<{ deletedCount: number; freedBytes: number }>>;
  uninstall: (optionId: EngineOptionId) => Promise<BridgeResult<Job>>;
  removeData: (optionId: EngineOptionId) => Promise<BridgeResult<Job>>;
  provisionContainer: (optionId: EngineOptionId) => Promise<BridgeResult<Job>>;
  containerLifecycle: (
    optionId: EngineOptionId,
    action: ContainerLifecycleAction,
  ) => Promise<BridgeResult<Job>>;
  containerStats: (
    optionId: EngineOptionId,
  ) => Promise<BridgeResult<ContainerStats>>;
  containerDetails: (
    optionId: EngineOptionId,
  ) => Promise<BridgeResult<ContainerTechnicalDetails>>;
  containerLogs: (
    optionId: EngineOptionId,
    tail?: number,
  ) => Promise<BridgeResult<string[]>>;
  containerUpdateImage: (
    optionId: EngineOptionId,
  ) => Promise<BridgeResult<Job>>;
  removeContainer: (optionId: EngineOptionId) => Promise<BridgeResult<Job>>;
  removeVolume: (optionId: EngineOptionId) => Promise<BridgeResult<Job>>;
  listOrphanContainers: () => Promise<BridgeResult<OrphanContainerSummary[]>>;
  cleanupOrphanContainer: (name: string) => Promise<BridgeResult<void>>;
  listLogs: () => Promise<BridgeResult<LogFileSummary[]>>;
  tailLog: (name: string, lines?: number) => Promise<BridgeResult<string[]>>;
  openLogsFolder: () => Promise<BridgeResult<void>>;
  diagnosticsSummary: () => Promise<BridgeResult<DiagnosticsSummary>>;
  openDocs: (topic: DocsTopicId) => Promise<BridgeResult<void>>;
  getDockerGuidance: () => Promise<BridgeResult<DockerGuidanceContent>>;
  openExternalUrl: (url: string) => Promise<BridgeResult<void>>;
  cacheSize: () => Promise<BridgeResult<number>>;
  clearCache: () => Promise<BridgeResult<void>>;
  doctor: (
    optionId: EngineOptionId,
  ) => Promise<BridgeResult<EngineDoctorReport>>;
  repairIssue: (
    optionId: EngineOptionId,
    issueId?: string,
  ) => Promise<BridgeResult<void>>;
  exportSupportBundle: (
    targetPath?: string,
  ) => Promise<BridgeResult<SupportBundleSummary>>;
}

export interface DesktopApi {
  window: {
    minimize: () => void;
    maximize: () => void;
    close: () => void;
  };
  storage: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };
  secrets: {
    store: (key: string, value: string) => Promise<void>;
    retrieve: (key: string) => Promise<string | null>;
    delete: (key: string) => Promise<void>;
  };
  dialog: {
    openFile: (options?: OpenFileOptions) => Promise<string | null>;
    saveFile: (options?: SaveFileOptions) => Promise<string | null>;
  };
  database: {
    initialize: (setupSql?: string, name?: string) => Promise<void>;
    execute: (sql: string) => Promise<SqlResult[]>;
    use: (name: string) => Promise<void>;
    list: () => Promise<string[]>;
    active: () => Promise<string | null>;
    getSchema: () => Promise<TableInfo[]>;
    isolatedRun: (setupSql: string, sql: string) => Promise<SqlResult[]>;
  };
  files: {
    readText: (filePath: string) => Promise<string>;
    writeText: (filePath: string, content: string) => Promise<void>;
  };
  setup: SetupApi;
  ai: {
    complete: (request: AiCompletionRequest) => Promise<string>;
  };
  notifications: {
    badge: (title: string, body: string) => Promise<void>;
    streak: (streak: number) => Promise<void>;
  };
  menu: {
    onNavigate: (callback: (path: string) => void) => () => void;
  };
}
