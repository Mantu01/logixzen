import { execFileSync } from "node:child_process";
import os from "node:os";
import {
  ENGINE_CATALOG,
  defaultContainerName,
} from "../../shared/engine-catalog";
import type {
  CatalogPlatform,
  EngineCatalogEntry,
  EngineDialect,
  EngineOptionId,
} from "../../shared/engines";

export type EngineKind = "embedded" | "server" | "container";
export type MemoryProfile = "low" | "normal";

export interface EngineArtifact {
  url: string;
  name?: string;
  sha256?: string;
  size: number;
  format: "zip" | "tar.gz" | "msi";
}

export interface EnginePackage {
  id: EngineOptionId;
  name: string;
  kind: EngineKind;
  dialect: EngineDialect;
  version: string;
  defaultPort?: number;
  adminRequired: boolean;
  containerImage?: string;
  containerName: string;
  artifacts: Partial<Record<CatalogPlatform, EngineArtifact>>;
  companions?: EngineArtifact[];
}

const POSTGRES = "18.7.0";
const MYSQL = "8.4.3";

const PACKAGES: Record<string, EnginePackage> = {
  sqlite: {
    id: "sqlite",
    name: "SQLite",
    kind: "embedded",
    dialect: "sqlite",
    version: "bundled",
    adminRequired: false,
    containerName: defaultContainerName("sqlite"),
    artifacts: {},
  },
  postgres: {
    id: "postgres",
    name: "PostgreSQL",
    kind: "server",
    dialect: "postgres",
    version: POSTGRES,
    defaultPort: 5432,
    adminRequired: false,
    containerName: defaultContainerName("postgres"),
    artifacts: {
      "windows-x64": {
        url: `https://github.com/theseus-rs/postgresql-binaries/releases/download/${POSTGRES}/postgresql-${POSTGRES}-x86_64-pc-windows-msvc.zip`,
        sha256:
          "64948bd862b2f9c253067d3476e971b8b31291376fb004c5c7d5d016509401f7",
        size: 49797717,
        format: "zip",
      },
      "macos-arm64": {
        url: `https://github.com/theseus-rs/postgresql-binaries/releases/download/${POSTGRES}/postgresql-${POSTGRES}-aarch64-apple-darwin.tar.gz`,
        size: 88965986,
        format: "tar.gz",
      },
      "macos-x64": {
        url: `https://github.com/theseus-rs/postgresql-binaries/releases/download/${POSTGRES}/postgresql-${POSTGRES}-x86_64-apple-darwin.tar.gz`,
        size: 92187545,
        format: "tar.gz",
      },
    },
  },
  mysql: {
    id: "mysql",
    name: "MySQL",
    kind: "server",
    dialect: "mysql",
    version: MYSQL,
    defaultPort: 3306,
    adminRequired: false,
    containerName: defaultContainerName("mysql"),
    artifacts: {
      "windows-x64": {
        url: `https://cdn.mysql.com/archives/mysql-8.4/mysql-${MYSQL}-winx64.zip`,
        sha256:
          "e401d0420486d91bd14eda7b6b449498007863ca340991e529adff4787352e7e",
        size: 259751071,
        format: "zip",
      },
      "macos-arm64": {
        url: `https://cdn.mysql.com/archives/mysql-8.4/mysql-${MYSQL}-macos14-arm64.tar.gz`,
        size: 164352132,
        format: "tar.gz",
      },
      "macos-x64": {
        url: `https://cdn.mysql.com/archives/mysql-8.4/mysql-${MYSQL}-macos14-x86_64.tar.gz`,
        size: 168667303,
        format: "tar.gz",
      },
    },
  },
  sqlserver: {
    id: "sqlserver",
    name: "SQL Server",
    kind: "server",
    dialect: "tsql",
    version: "2022",
    adminRequired: true,
    containerName: defaultContainerName("sqlserver"),
    artifacts: {
      "windows-x64": {
        url: "https://download.microsoft.com/download/3/8/d/38de7036-2433-4207-8eae-06e247e17b25/SqlLocalDB.msi",
        size: 63508480,
        format: "msi",
      },
    },
    companions: [
      {
        url: "https://go.microsoft.com/fwlink/?linkid=2249004",
        name: "msodbcsql18.msi",
        size: 4677632,
        format: "msi",
      },
    ],
  },
  "mssql-container": {
    id: "mssql-container",
    name: "SQL Server",
    kind: "container",
    dialect: "tsql",
    version: "2025",
    defaultPort: 1433,
    adminRequired: false,
    containerImage: "mcr.microsoft.com/mssql/server:2022-latest",
    containerName: defaultContainerName("mssql-container"),
    artifacts: {},
  },
  "postgres-container": {
    id: "postgres-container",
    name: "PostgreSQL",
    kind: "container",
    dialect: "postgres",
    version: "17",
    defaultPort: 5432,
    adminRequired: false,
    containerImage: "postgres:17",
    containerName: defaultContainerName("postgres-container"),
    artifacts: {},
  },
  "mysql-container": {
    id: "mysql-container",
    name: "MySQL",
    kind: "container",
    dialect: "mysql",
    version: "8.4",
    defaultPort: 3306,
    adminRequired: false,
    containerImage: "mysql:8.4",
    containerName: defaultContainerName("mysql-container"),
    artifacts: {},
  },
};

const CATALOG_BY_ID = new Map<string, EngineCatalogEntry>(
  ENGINE_CATALOG.map((entry) => [entry.id, entry]),
);

export function getCatalogEntry(
  id: EngineOptionId,
): EngineCatalogEntry | undefined {
  return CATALOG_BY_ID.get(id);
}

export function getPackage(id: EngineOptionId): EnginePackage | undefined {
  return PACKAGES[id];
}

export function allPackages(): EnginePackage[] {
  return Object.values(PACKAGES);
}

export function getRealCpuArch(): "x64" | "arm64" {
  if (process.platform === "win32") {
    const native = process.env.PROCESSOR_ARCHITEW6432 || process.arch;
    return native.toLowerCase() === "arm64" ? "arm64" : "x64";
  }
  if (process.platform === "darwin") {
    try {
      const translated = execFileSync(
        "sysctl",
        ["-in", "sysctl.proc_translated"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ).trim();
      if (translated === "1") {
        return "arm64";
      }
    } catch {}
    try {
      const brand = execFileSync("sysctl", ["-n", "machdep.cpu.brand_string"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      if (/Apple/i.test(brand)) {
        return "arm64";
      }
    } catch {}
    return process.arch === "arm64" ? "arm64" : "x64";
  }
  return process.arch === "arm64" ? "arm64" : "x64";
}

export function platformKey(): CatalogPlatform {
  const osKey =
    process.platform === "win32"
      ? "windows"
      : process.platform === "darwin"
        ? "macos"
        : "linux";
  return `${osKey}-${getRealCpuArch()}` as CatalogPlatform;
}

export function artifactFor(
  id: EngineOptionId,
): { artifact: EngineArtifact; platform: CatalogPlatform } | null {
  const platform = platformKey();
  const artifact = PACKAGES[id]?.artifacts[platform];
  return artifact ? { artifact, platform } : null;
}

export function memoryProfile(): MemoryProfile {
  return os.totalmem() >= 8 * 1024 * 1024 * 1024 ? "normal" : "low";
}

export function isManagedContainer(id: EngineOptionId): boolean {
  return PACKAGES[id]?.kind === "container";
}
