import type {
  CatalogPlatform,
  EngineCatalogEntry,
  EngineOffer,
  EngineOptionId,
  LinuxEnvironment,
  PlatformSnapshot,
  RequirementCheck,
  RequirementKind,
} from "./engines";

export const LOCALDB_INSTANCE = "LogixZenPractice";

export const CONTAINER_PREFIX = "logixzen-";

export function defaultContainerName(optionId: EngineOptionId): string {
  return `${CONTAINER_PREFIX}${optionId}`;
}

export function defaultVolumeName(optionId: EngineOptionId): string {
  return `${CONTAINER_PREFIX}${optionId}-data`;
}

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

const SQL_SERVER_MIN_DISK = 6 * GIB;

const SUPPORTED_LINUX: Array<{ id: string; versions: string[] }> = [
  { id: "ubuntu", versions: ["22.04", "24.04"] },
  { id: "rhel", versions: ["9", "10"] },
];

const X64_CONTAINER_PLATFORMS: CatalogPlatform[] = [
  "windows-x64",
  "macos-x64",
  "linux-x64",
];
const MULTI_ARCH_PLATFORMS: CatalogPlatform[] = [
  "windows-x64",
  "windows-arm64",
  "macos-x64",
  "macos-arm64",
  "linux-x64",
  "linux-arm64",
];

export const ENGINE_CATALOG: EngineCatalogEntry[] = [
  {
    id: "sqlite",
    engine: "sqlite",
    displayName: "SQLite",
    advancedName: "SQLite in-process embedded database",
    publisher: "SQLite",
    method: "bundled",
    purpose: "Lightweight practice database with zero external download and zero background service.",
    dialect: "sqlite",
    license: "Public domain",
    pin: "bundled",
    sourceUrl: "https://www.sqlite.org/",
    verification: "Run SELECT sqlite_version() against practice database.",
    platforms: MULTI_ARCH_PLATFORMS,
    sizes: {},
    elevation: "never",
    restart: "never",
    supportedLinux: true,
    recommended: true,
    capabilities: {
      startStop: false,
      backup: true,
      portConfig: false,
      introspection: true,
      multipleInstances: true,
    },
  },
  {
    id: "postgres",
    engine: "postgres",
    displayName: "PostgreSQL",
    advancedName: "PostgreSQL 18 server binaries",
    publisher: "PostgreSQL Global Development Group",
    method: "native",
    purpose: "Advanced open-source relational database running locally on loopback.",
    dialect: "postgres",
    license: "PostgreSQL License",
    pin: "18.7.0",
    sourceUrl: "https://github.com/theseus-rs/postgresql-binaries",
    verification: "Run SELECT version() over loopback connection.",
    platforms: MULTI_ARCH_PLATFORMS,
    sizes: {
      "windows-x64": { downloadBytes: 49797717, installedBytes: 150 * MIB },
      "macos-arm64": { downloadBytes: 88965986, installedBytes: 240 * MIB },
      "macos-x64": { downloadBytes: 92187545, installedBytes: 250 * MIB },
    },
    minMemoryBytes: 256 * MIB,
    recommendedMemoryBytes: 512 * MIB,
    minDiskBytes: 1 * GIB,
    supportedLinux: true,
    elevation: "never",
    restart: "never",
    recommended: false,
    capabilities: {
      startStop: true,
      backup: true,
      portConfig: true,
      introspection: true,
      multipleInstances: true,
    },
  },
  {
    id: "mysql",
    engine: "mysql",
    displayName: "MySQL",
    advancedName: "MySQL 8.4 LTS server",
    publisher: "Oracle",
    method: "native",
    purpose: "Popular open-source relational database running locally on loopback.",
    dialect: "mysql",
    license: "GPLv2 with FOSS Exception",
    pin: "8.4.3",
    sourceUrl: "https://cdn.mysql.com/archives/mysql-8.4/",
    verification: "Run SELECT version() over loopback connection.",
    platforms: ["windows-x64", "macos-arm64", "macos-x64"],
    sizes: {
      "windows-x64": { downloadBytes: 259751071, installedBytes: 800 * MIB },
      "macos-arm64": { downloadBytes: 164352132, installedBytes: 600 * MIB },
      "macos-x64": { downloadBytes: 168667303, installedBytes: 600 * MIB },
    },
    minMemoryBytes: 512 * MIB,
    recommendedMemoryBytes: 1 * GIB,
    minDiskBytes: 2 * GIB,
    supportedLinux: true,
    elevation: "never",
    restart: "never",
    recommended: false,
    capabilities: {
      startStop: true,
      backup: true,
      portConfig: true,
      introspection: true,
      multipleInstances: true,
    },
  },
  {
    id: "sqlserver",
    engine: "sqlserver",
    displayName: "Microsoft SQL Server",
    advancedName: "SQL Server LocalDB / Express instance",
    publisher: "Microsoft",
    method: "native-windows",
    purpose: "Full Transact-SQL engine with CTEs, window functions, and procedures.",
    dialect: "tsql",
    license: "Microsoft SQL Server Express License",
    pin: "2022",
    sourceUrl: "https://www.microsoft.com/sql-server",
    verification: "Run SELECT @@VERSION over instance connection.",
    platforms: ["windows-x64", "windows-arm64"],
    sizes: {
      "windows-x64": { downloadBytes: 63508480, installedBytes: 500 * MIB },
    },
    minMemoryBytes: 512 * MIB,
    recommendedMemoryBytes: 1 * GIB,
    minDiskBytes: 2 * GIB,
    supportedLinux: true,
    elevation: "required",
    restart: "never",
    recommended: false,
    capabilities: {
      startStop: true,
      backup: true,
      portConfig: false,
      introspection: true,
      multipleInstances: true,
    },
  },
  {
    id: "mssql-container",
    engine: "mssql-container",
    displayName: "SQL Server",
    advancedName: "mcr.microsoft.com/mssql/server, Express edition",
    publisher: "Microsoft",
    method: "container",
    purpose: "T-SQL practice engine in a container with Express limits.",
    dialect: "tsql",
    license: "Free Express edition inside the official Microsoft image",
    pin: "2025-CU11-ubuntu-24.04",
    sourceUrl:
      "https://learn.microsoft.com/en-us/sql/linux/sql-server-linux-docker-container-deployment",
    verification:
      "Pull the pinned image, then run a T-SQL version query over TCP.",
    platforms: X64_CONTAINER_PLATFORMS,
    sizes: {
      "windows-x64": { downloadBytes: 476169295 },
      "macos-x64": { downloadBytes: 476169295 },
      "linux-x64": { downloadBytes: 476169295 },
    },
    minMemoryBytes: 2 * GIB,
    minDiskBytes: SQL_SERVER_MIN_DISK,
    supportedLinux: true,
    elevation: "never",
    restart: "never",
    recommended: false,
    capabilities: {
      startStop: true,
      backup: true,
      portConfig: true,
      introspection: true,
      multipleInstances: true,
    },
    container: {
      image: "mcr.microsoft.com/mssql/server",
      tag: "2025-CU11-ubuntu-24.04",
      digest:
        "sha256:d8c5825d197607730e70db9268bb03b9ad64b9b9426f041d8e2fb8d3635bbda3",
      port: 1433,
      env: [
        { name: "ACCEPT_EULA", value: "Y" },
        { name: "MSSQL_PID", value: "Express" },
        { name: "MSSQL_SA_PASSWORD" },
      ],
      volumePath: "/var/opt/mssql",
      healthCheck: 'sqlcmd -Q "SELECT 1"',
      minDaemonVersion: "1.8.0",
      supportedArchitectures: ["x64"],
      edition: "Express",
    },
  },
  {
    id: "postgres-container",
    engine: "postgres-container",
    displayName: "PostgreSQL",
    advancedName: "postgres:17 official image",
    publisher: "PostgreSQL Global Development Group",
    method: "container",
    purpose: "PostgreSQL practice engine in a container.",
    dialect: "postgres",
    license: "PostgreSQL License",
    pin: "17",
    sourceUrl: "https://hub.docker.com/_/postgres",
    verification: "Pull the pinned image, then run SELECT version() over TCP.",
    platforms: MULTI_ARCH_PLATFORMS,
    sizes: {
      "windows-x64": { downloadBytes: 167333338 },
      "macos-x64": { downloadBytes: 167333338 },
      "linux-x64": { downloadBytes: 167333338 },
      "windows-arm64": { downloadBytes: 165869675 },
      "macos-arm64": { downloadBytes: 165869675 },
      "linux-arm64": { downloadBytes: 165869675 },
    },
    minMemoryBytes: 512 * MIB,
    minDiskBytes: 1 * GIB,
    supportedLinux: true,
    elevation: "never",
    restart: "never",
    recommended: false,
    capabilities: {
      startStop: true,
      backup: true,
      portConfig: true,
      introspection: true,
      multipleInstances: true,
    },
    container: {
      image: "postgres",
      tag: "17",
      digest:
        "sha256:72635955a9b7cf6fcf125ebad50cb68b209d1fcf214b7e80f1eb26cf39e23eb0",
      port: 5432,
      env: [
        { name: "POSTGRES_USER", value: "logixzen" },
        { name: "POSTGRES_PASSWORD" },
        { name: "POSTGRES_DB", value: "LogixZenPractice" },
      ],
      volumePath: "/var/lib/postgresql/data",
      healthCheck: "pg_isready",
      minDaemonVersion: "1.8.0",
      supportedArchitectures: ["x64", "arm64"],
      edition: "Open Source",
    },
  },
  {
    id: "mysql-container",
    engine: "mysql-container",
    displayName: "MySQL",
    advancedName: "mysql:8.4 official image",
    publisher: "Oracle",
    method: "container",
    purpose: "MySQL practice engine in a container.",
    dialect: "mysql",
    license: "GPLv2",
    pin: "8.4",
    sourceUrl: "https://hub.docker.com/_/mysql",
    verification: "Pull the pinned image, then run SELECT version() over TCP.",
    platforms: MULTI_ARCH_PLATFORMS,
    sizes: {
      "windows-x64": { downloadBytes: 238256607 },
      "macos-x64": { downloadBytes: 238256607 },
      "linux-x64": { downloadBytes: 238256607 },
      "windows-arm64": { downloadBytes: 232912945 },
      "macos-arm64": { downloadBytes: 232912945 },
      "linux-arm64": { downloadBytes: 232912945 },
    },
    minMemoryBytes: 1 * GIB,
    minDiskBytes: 2 * GIB,
    supportedLinux: true,
    elevation: "never",
    restart: "never",
    recommended: false,
    capabilities: {
      startStop: true,
      backup: true,
      portConfig: true,
      introspection: true,
      multipleInstances: true,
    },
    container: {
      image: "mysql",
      tag: "8.4",
      digest:
        "sha256:88eb050cfd5867f185ef3db1a4d95ea7f00ad0607d7301c26fecaa643b123a3d",
      port: 3306,
      env: [
        { name: "MYSQL_USER", value: "logixzen" },
        { name: "MYSQL_PASSWORD" },
        { name: "MYSQL_ROOT_PASSWORD" },
        { name: "MYSQL_DATABASE", value: "LogixZenPractice" },
      ],
      volumePath: "/var/lib/mysql",
      healthCheck: "mysqladmin ping",
      minDaemonVersion: "1.8.0",
      supportedArchitectures: ["x64", "arm64"],
      edition: "Community (GPL)",
    },
  },
];

export function platformOf(snapshot: PlatformSnapshot): CatalogPlatform | null {
  const arch = snapshot.nativeArch;
  if (arch === "other") return null;
  if (snapshot.osFamily === "windows")
    return arch === "x64" ? "windows-x64" : "windows-arm64";
  if (snapshot.osFamily === "macos")
    return arch === "x64" ? "macos-x64" : "macos-arm64";
  if (snapshot.osFamily === "linux")
    return arch === "x64" ? "linux-x64" : "linux-arm64";
  return null;
}

export function linuxSupported(environment: LinuxEnvironment): boolean {
  return SUPPORTED_LINUX.some(
    (supported) =>
      supported.id === environment.distroId &&
      supported.versions.some(
        (version) =>
          environment.versionId === version ||
          environment.versionId.startsWith(`${version}.`) ||
          (version.length <= 2 &&
            environment.versionId.split(".")[0] === version),
      ),
  );
}

export function versionAtLeast(actual: string, minimum: string): boolean {
  const left = actual.split(".").map(Number);
  const right = minimum.split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

function platformCheck(
  entry: EngineCatalogEntry,
  platform: CatalogPlatform | null,
): RequirementCheck {
  if (platform === null) return { kind: "platform", status: "unknown" };
  return {
    kind: "platform",
    status: entry.platforms.includes(platform) ? "met" : "unmet",
  };
}

function osVersionCheck(
  entry: EngineCatalogEntry,
  snapshot: PlatformSnapshot,
): RequirementCheck | null {
  if (entry.minWindowsBuild === undefined) return null;
  if (snapshot.osFamily !== "windows" || snapshot.osBuild.length === 0) {
    return { kind: "os-version", status: "unknown" };
  }
  const build = Number(snapshot.osBuild);
  if (Number.isNaN(build)) return { kind: "os-version", status: "unknown" };
  return {
    kind: "os-version",
    status: build >= entry.minWindowsBuild ? "met" : "unmet",
  };
}

function distroCheck(
  entry: EngineCatalogEntry,
  snapshot: PlatformSnapshot,
): RequirementCheck | null {
  if (!entry.supportedLinux || entry.method !== "native-linux") return null;
  if (!snapshot.linux || !snapshot.linux.known)
    return { kind: "distro", status: "unknown" };
  return {
    kind: "distro",
    status: linuxSupported(snapshot.linux.value) ? "met" : "unmet",
  };
}

function memoryCheck(
  entry: EngineCatalogEntry,
  snapshot: PlatformSnapshot,
): RequirementCheck | null {
  if (entry.minMemoryBytes === undefined) return null;
  if (snapshot.totalMemoryBytes < entry.minMemoryBytes)
    return { kind: "memory", status: "unmet" };
  if (
    entry.recommendedMemoryBytes !== undefined &&
    snapshot.totalMemoryBytes < entry.recommendedMemoryBytes
  ) {
    return { kind: "memory", status: "warn" };
  }
  return { kind: "memory", status: "met" };
}

function diskCheck(
  entry: EngineCatalogEntry,
  snapshot: PlatformSnapshot,
  platform: CatalogPlatform | null,
): RequirementCheck | null {
  const required =
    entry.minDiskBytes ??
    (platform === null ? undefined : entry.sizes[platform]?.downloadBytes);
  if (required === undefined) return null;
  if (!snapshot.dataDisk.known || !snapshot.tempDisk.known) {
    return { kind: "disk", status: "warn" };
  }
  const enough =
    snapshot.dataDisk.value.freeBytes >= required &&
    snapshot.tempDisk.value.freeBytes >= required;
  return { kind: "disk", status: enough ? "met" : "unmet" };
}

function runtimeCheck(
  entry: EngineCatalogEntry,
  snapshot: PlatformSnapshot,
): RequirementCheck {
  const minimum = entry.container?.minDaemonVersion ?? "1.8.0";

  if (entry.id === "mssql-container") {
    if (entry.container?.edition !== "Express") {
      return { kind: "container-runtime", status: "unmet" };
    }
    const hasExpressPid = entry.container?.env.some(
      (e) => e.name === "MSSQL_PID" && e.value === "Express",
    );
    if (!hasExpressPid) {
      return { kind: "container-runtime", status: "unmet" };
    }
  }

  if (snapshot.containerReadiness && snapshot.containerReadiness.length > 0) {
    const readiness = snapshot.containerReadiness.find(
      (r) => r.runtime === "docker",
    );
    if (!readiness || readiness.state !== "ready") {
      return { kind: "container-runtime", status: "unmet" };
    }

    const rawArch = readiness.daemon.arch?.toLowerCase();
    const daemonArch =
      rawArch === "x86_64" || rawArch === "amd64" || rawArch === "x64"
        ? "x64"
        : rawArch === "arm64" || rawArch === "aarch64"
          ? "arm64"
          : undefined;

    const effectiveArch =
      daemonArch ??
      (snapshot.nativeArch !== "other" ? snapshot.nativeArch : undefined);

    if (effectiveArch && entry.container?.supportedArchitectures) {
      if (!entry.container.supportedArchitectures.includes(effectiveArch)) {
        return { kind: "container-runtime", status: "unmet" };
      }
    }

    if (effectiveArch === "arm64" && entry.id === "mssql-container") {
      return { kind: "container-runtime", status: "unmet" };
    }

    if (
      readiness.daemon.version &&
      !versionAtLeast(readiness.daemon.version, minimum)
    ) {
      return { kind: "container-runtime", status: "unmet" };
    }

    if (
      entry.minMemoryBytes !== undefined &&
      readiness.daemon.totalMemoryBytes !== undefined
    ) {
      if (readiness.daemon.totalMemoryBytes < entry.minMemoryBytes) {
        return { kind: "container-runtime", status: "unmet" };
      }
    }

    return { kind: "container-runtime", status: "met" };
  }

  if (entry.container?.supportedArchitectures) {
    if (!entry.container.supportedArchitectures.includes(snapshot.nativeArch)) {
      return { kind: "container-runtime", status: "unmet" };
    }
  }

  if (snapshot.nativeArch === "arm64" && entry.id === "mssql-container") {
    return { kind: "container-runtime", status: "unmet" };
  }

  const ready = snapshot.containerRuntimes.filter(
    (runtime) => runtime.executableFound && runtime.endpointFound,
  );
  if (ready.length === 0) return { kind: "container-runtime", status: "unmet" };
  const measured = ready.filter((runtime) => runtime.version.known);
  const supported = measured.some(
    (runtime) =>
      runtime.version.known && versionAtLeast(runtime.version.value, minimum),
  );
  if (supported) return { kind: "container-runtime", status: "met" };
  if (measured.length < ready.length)
    return { kind: "container-runtime", status: "unknown" };
  return { kind: "container-runtime", status: "unmet" };
}

const CHECK_ORDER: RequirementKind[] = [
  "platform",
  "os-version",
  "distro",
  "memory",
  "disk",
  "container-runtime",
];

function isHiddenVariant(
  entry: EngineCatalogEntry,
  snapshot: PlatformSnapshot,
): boolean {
  return entry.method === "container" && snapshot.osFamily === "windows";
}

export function resolveEngineOffers(snapshot: PlatformSnapshot): EngineOffer[] {
  const platform = platformOf(snapshot);
  return ENGINE_CATALOG.map((entry) => {
    const checks = [
      platformCheck(entry, platform),
      osVersionCheck(entry, snapshot),
      distroCheck(entry, snapshot),
      memoryCheck(entry, snapshot),
      diskCheck(entry, snapshot, platform),
      entry.method === "container" ? runtimeCheck(entry, snapshot) : null,
    ]
      .filter((check): check is RequirementCheck => check !== null)
      .sort(
        (left, right) =>
          CHECK_ORDER.indexOf(left.kind) - CHECK_ORDER.indexOf(right.kind),
      );
    const platformResult = checks.find((c) => c.kind === "platform");
    const distroResult = checks.find((c) => c.kind === "distro");
    const runtimeResult = checks.find((c) => c.kind === "container-runtime");
    return {
      entry,
      checks,
      visible:
        !isHiddenVariant(entry, snapshot) &&
        platformResult?.status === "met" &&
        (distroResult === undefined || distroResult.status === "met") &&
        (entry.method !== "container" || runtimeResult?.status === "met"),
    };
  });
}
