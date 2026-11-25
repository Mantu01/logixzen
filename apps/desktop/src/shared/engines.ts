export type EngineId =
  | "sqlite"
  | "postgres"
  | "mysql"
  | "sqlserver"
  | "mssql-container"
  | "postgres-container"
  | "mysql-container";

export type InstallMethod =
  | "bundled"
  | "native"
  | "native-windows"
  | "native-linux"
  | "native-macos"
  | "container";

export type EngineDialect =
  | "sqlite"
  | "postgres"
  | "mysql"
  | "tsql";

export type OsFamily = "windows" | "macos" | "linux" | "other";

export type CpuArch = "x64" | "arm64" | "other";

export type Probe<T> = { known: true; value: T } | { known: false };

export type LifecycleStatus =
  | "not-installed"
  | "detected"
  | "activating"
  | "installing"
  | "installed"
  | "verifying"
  | "ready"
  | "stopped"
  | "needs-repair"
  | "uninstalling"
  | "failed";

type JobState =
  | "queued"
  | "running"
  | "waiting-for-user"
  | "cancelled"
  | "failed"
  | "succeeded"
  | "interrupted";

export type JobKind =
  | "install"
  | "activate"
  | "configure"
  | "initialize"
  | "uninstall"
  | "verify"
  | "switch"
  | "reset-practice"
  | "backup"
  | "restore"
  | "repair"
  | "container-provision"
  | "container-start"
  | "container-stop"
  | "container-remove"
  | "container-update";

export type FailureCode =
  | "cancelled"
  | "unsupported"
  | "prerequisite"
  | "permission"
  | "network"
  | "integrity"
  | "conflict"
  | "resources"
  | "timeout"
  | "runtime"
  | "unknown";

export type RecoveryActionId =
  | "retry"
  | "choose-different-engine"
  | "grant-permission"
  | "open-official-download"
  | "free-resources"
  | "start-runtime"
  | "repair-connection"
  | "open-logs";

interface RuntimeVersions {
  electron: string;
  node: string;
  chrome: string;
}

export interface DiskSpace {
  freeBytes: number;
  totalBytes: number;
}

type ServiceManager = "systemd" | "unknown";

export type PackageManager = "apt" | "dnf" | "zypper" | "unknown";

export interface LinuxEnvironment {
  distroId: string;
  versionId: string;
  serviceManager: ServiceManager;
  packageManager: PackageManager;
}

export type VirtualizationState =
  { applicable: false } | { applicable: true; enabled: Probe<boolean> };

export type WslState =
  | { applicable: false }
  | { applicable: true; present: boolean; version: Probe<1 | 2> };

export type ContainerRuntimeId = "docker" | "podman";

export interface ContainerRuntimePresence {
  runtime: ContainerRuntimeId;
  executableFound: boolean;
  endpointFound: boolean;
  version: Probe<string>;
}

export type ContainerReadinessState =
  | "ready"
  | "not-installed"
  | "stopped"
  | "permission-denied"
  | "outdated"
  | "unsupported";

export type ContainerBackendType =
  "docker-desktop" | "docker-engine" | "podman" | "unknown";

export interface ContainerClientInfo {
  found: boolean;
  executablePath?: string;
  version?: string;
}

export interface ContainerDaemonInfo {
  reachability: boolean;
  version?: string;
  apiVersion?: string;
  arch?: string;
  os?: string;
  backend: ContainerBackendType;
  endpoint?: string;
  totalMemoryBytes?: number;
  availableMemoryBytes?: number;
}

export interface ContainerReadinessGuidance {
  title: string;
  message: string;
  actionUrl?: string;
  command?: string;
}

export interface ContainerPrerequisites {
  wsl2Supported?: boolean;
  virtualizationEnabled?: boolean;
  socketAccessible?: boolean;
  inDockerGroup?: boolean;
}

export interface ContainerResourceCheck {
  memoryBytes?: number;
  diskBytes?: number;
  sufficientForOffers: boolean;
}

export interface ContainerRuntimeReadiness {
  runtime: ContainerRuntimeId;
  state: ContainerReadinessState;
  client: ContainerClientInfo;
  daemon: ContainerDaemonInfo;
  prerequisites: ContainerPrerequisites;
  resources: ContainerResourceCheck;
  guidance?: ContainerReadinessGuidance;
}

interface DockerGuidanceStep {
  title: string;
  detail: string;
  command?: string;
  url?: string;
  urlLabel?: string;
}

export interface DockerGuidanceContent {
  platform: OsFamily;
  headline: string;
  summary: string;
  statusText: string;
  requirements: string[];
  steps: DockerGuidanceStep[];
  notes: {
    restartRequired?: boolean;
    signInRequired?: boolean;
    permissionsRequired?: boolean;
    alternativesAvailable?: boolean;
  };
  officialDocUrl: string;
  checkAgainLabel: string;
}

export interface DetectedService {
  name: string;
  running: boolean;
}

export interface LocalDbInstance {
  name: string;
  version: string;
}

export type DetectedInstallation =
  | { engine: "sqlite"; practiceFileBytes: Probe<number> }
  | {
      engine: "mssql-localdb";
      utility: Probe<string>;
      instance: Probe<LocalDbInstance | null>;
    }
  | {
      engine: "mssql-express";
      services: DetectedService[];
      products: string[];
      packages: string[];
    }
  | {
      engine:
        | "mssql-container"
        | "postgres-container"
        | "mysql-container";
      containers: string[];
      images: string[];
    };

export interface PlatformSnapshot {
  osFamily: OsFamily;
  osName: string;
  osVersion: string;
  osBuild: string;
  kernelVersion: string;
  arch: CpuArch;
  nativeArch: CpuArch;
  runtime: RuntimeVersions;
  totalMemoryBytes: number;
  availableMemoryBytes: number;
  dataDisk: Probe<DiskSpace>;
  tempDisk: Probe<DiskSpace>;
  elevationAvailable: Probe<boolean>;
  virtualization: Probe<VirtualizationState>;
  wsl: Probe<WslState>;
  containerRuntimes: ContainerRuntimePresence[];
  containerReadiness?: ContainerRuntimeReadiness[];
  linux: Probe<LinuxEnvironment>;
  existing: DetectedInstallation[];
}

export interface VariantMetadata {
  displayName: string;
  publisher: string;
  purpose: string;
  technicalName: string;
  dialect: EngineDialect;
}

export interface VerificationResult {
  ok: boolean;
  checkedAt: string;
  detail?: string;
}

export interface EngineStorageUsage {
  practiceBytes?: number;
  dataBytes?: number;
}

export interface BackupManifest {
  manifestVersion: number;
  engine: EngineId;
  optionId: EngineOptionId;
  dialect: EngineDialect;
  practiceSchemaVersion: string;
  createdAt: string;
  isAutomatic: boolean;
  artifactFile: string;
  artifactSizeBytes: number;
  sha256: string;
  tableCount: number;
  rowCount: number;
}

interface OwnedResources {
  service?: string;
  instance?: string;
  container?: string;
  volume?: string;
}

export interface InstallationRecord {
  optionId: EngineOptionId;
  engine: EngineId;
  method: InstallMethod;
  variant: VariantMetadata;
  status: LifecycleStatus;
  installedVersion?: string;
  instanceName?: string;
  containerName?: string;
  port?: number;
  dataLocation?: string;
  practiceSchemaVersion?: number;
  licenseAcceptedAt?: string;
  secretRef?: string;
  installLog?: string;
  createdAt: string;
  updatedAt: string;
  lastVerification?: VerificationResult;
  resources: OwnedResources;
}
export type RepairReason =
  | "data-missing"
  | "service-missing"
  | "service-stopped"
  | "container-missing"
  | "port-closed"
  | "secret-unreadable"
  | "practice-missing"
  | "state-recovered";

export interface JournalResourceRecord {
  files?: string[];
  container?: string;
  volume?: string;
  service?: string;
  instance?: string;
}

export interface InstallJournalEntry {
  jobId: string;
  kind: JobKind;
  optionId: EngineOptionId;
  startedAt: string;
  currentStageId?: string;
  currentStageIndex?: number;
  stageLabel?: string;
  resources?: JournalResourceRecord;
  measurements?: JobMeasurements;
  waitingAction?: string;
}

export interface InstallState {
  schemaVersion: number;
  installations: InstallationRecord[];
  activeOptionId?: EngineOptionId;
  journal?: InstallJournalEntry;
}

export type InstallStateIssue =
  | "state-corrupt"
  | "backup-restored"
  | "state-read-only"
  | "journal-interrupted";

export interface InstallStateLoad {
  state: InstallState;
  issues: InstallStateIssue[];
  readOnly: boolean;
  repairs: Array<{ optionId: EngineOptionId; reason: RepairReason }>;
}

type JobStageStatus =
  "pending" | "running" | "succeeded" | "failed" | "skipped" | "cancelled";

export interface JobStage {
  id: string;
  label: string;
  status: JobStageStatus;
  irreversible?: boolean;
  weight?: number;
}

export type ProgressMeasure =
  | { determinate: false }
  | {
      determinate: true;
      bytesDone: number;
      bytesTotal: number;
      percent: number;
    };

interface JobMeasurements {
  download?: ProgressMeasure;
  diskBytes?: number;
}

export interface OperationFailure {
  code: FailureCode;
  cause: string;
  recovery: RecoveryActionId[];
  detail?: string;
}

export interface Job {
  id: string;
  kind: JobKind;
  engine: EngineId;
  optionId?: EngineOptionId;
  state: JobState;
  stages: JobStage[];
  currentStageIndex: number;
  measurements: JobMeasurements;
  warnings: string[];
  failure?: OperationFailure;
  createdAt: string;
  updatedAt: string;
  elapsedMs?: number;
  waitingAction?: string;
  queuePosition?: number;
  rollbackResources?: JournalResourceRecord;
}

export type ContainerLifecycleAction = "start" | "stop" | "restart";

export interface ContainerStats {
  cpuPercent: number;
  memoryUsageBytes: number;
  memoryLimitBytes: number;
  running: boolean;
  networkIo?: string;
  blockIo?: string;
}

export interface ContainerTechnicalDetails {
  containerName: string;
  image: string;
  digest?: string;
  created?: string;
  status: string;
  running: boolean;
  ports: string[];
  volumes: string[];
  environment: string[];
}

export interface OrphanContainerSummary {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
}

export interface LogFileSummary {
  name: string;
  sizeBytes: number;
  updatedAt: string;
}

export interface DiagnosticsSummary {
  platform: {
    osFamily: OsFamily;
    arch: CpuArch;
    osVersion: string;
    totalMemoryBytes: number;
  };
  activeEngine: EngineOptionId | null;
  installedCount: number;
  readyCount: number;
  issues: InstallStateIssue[];
  logCount: number;
}

export type DocsTopicId =
  | "docker-install-windows"
  | "docker-install-macos"
  | "docker-install-linux"
  | "sql-server-express"
  | "sql-server-localdb"
  | "sqlite"
  | "postgres"
  | "mysql";

export interface StartJobRequest {
  optionId: EngineOptionId;
  kind: JobKind;
}

export interface ProgressEvent {
  jobId: string;
  sequence: number;
  stageId: string;
  stageIndex: number;
  measure: ProgressMeasure;
  activity: string;
  canCancel: boolean;
  status: JobState;
  elapsedMs?: number;
  waitingAction?: string;
}

export type BridgeResult<T> =
  { ok: true; data: T } | { ok: false; failure: OperationFailure };

export type EngineOptionId =
  | "sqlite"
  | "postgres"
  | "mysql"
  | "sqlserver"
  | "mssql-container"
  | "postgres-container"
  | "mysql-container";

export type CatalogPlatform =
  | "windows-x64"
  | "windows-arm64"
  | "macos-x64"
  | "macos-arm64"
  | "linux-x64"
  | "linux-arm64";

interface PackageSize {
  downloadBytes: number;
  installedBytes?: number;
}

interface EngineCapabilities {
  startStop: boolean;
  backup: boolean;
  portConfig: boolean;
  introspection: boolean;
  multipleInstances: boolean;
}

type ElevationNeed = "never" | "required";

type RestartNeed = "never" | "may-be-required";

interface ContainerEnvVar {
  name: string;
  value?: string;
}

interface ContainerSpec {
  image: string;
  tag: string;
  digest?: string;
  port: number;
  env: ContainerEnvVar[];
  volumePath: string;
  healthCheck: string;
  minDaemonVersion: string;
  supportedArchitectures?: CpuArch[];
  edition?: string;
}

export interface EngineCatalogEntry {
  id: EngineOptionId;
  engine: EngineId;
  displayName: string;
  advancedName: string;
  publisher: string;
  method: InstallMethod;
  purpose: string;
  dialect: EngineDialect;
  license: string;
  pin: string;
  sourceUrl: string;
  verification: string;
  platforms: CatalogPlatform[];
  sizes: Partial<Record<CatalogPlatform, PackageSize>>;
  minMemoryBytes?: number;
  recommendedMemoryBytes?: number;
  minDiskBytes?: number;
  minWindowsBuild?: number;
  supportedLinux: boolean;
  elevation: ElevationNeed;
  restart: RestartNeed;
  capabilities: EngineCapabilities;
  recommended: boolean;
  container?: ContainerSpec;
}

export type RequirementKind =
  | "platform"
  | "os-version"
  | "distro"
  | "memory"
  | "disk"
  | "container-runtime";

type RequirementStatus = "met" | "warn" | "unmet" | "unknown";

export interface RequirementCheck {
  kind: RequirementKind;
  status: RequirementStatus;
}

export interface EngineOffer {
  entry: EngineCatalogEntry;
  visible: boolean;
  checks: RequirementCheck[];
}

export interface DoctorCheckResult {
  id: string;
  name: string;
  ok: boolean;
  detail: string;
  autoFixable: boolean;
}

export interface EngineDoctorReport {
  optionId: EngineOptionId;
  checks: DoctorCheckResult[];
  healthy: boolean;
}

export interface SupportBundleSummary {
  bundlePath: string;
  checksum: string;
}
