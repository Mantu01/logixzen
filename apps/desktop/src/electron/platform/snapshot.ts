import { spawnSync } from "node:child_process";
import { existsSync, statfsSync, statSync } from "node:fs";
import { dirname } from "node:path";
import os from "node:os";
import type {
  ContainerRuntimeId,
  ContainerRuntimePresence,
  CpuArch,
  DetectedInstallation,
  DetectedService,
  DiskSpace,
  LocalDbInstance,
  OsFamily,
  PlatformSnapshot,
  Probe,
  VirtualizationState,
  WslState,
} from "../../shared/engines";
import {
  CONTAINER_PREFIX,
  LOCALDB_INSTANCE,
} from "../../shared/engine-catalog";
import { dataDir, sqlitePracticeFile, tempDir } from "../paths";
import {
  clearContainerReadinessCache,
  probeContainerReadinessSync,
} from "../service/docker";

const PROBE_TIMEOUT_MS = 2000;

type ContainerEngineId =
  | "mssql-container"
  | "postgres-container"
  | "mysql-container";

const CONTAINER_ENGINES: ContainerEngineId[] = [
  "mssql-container",
  "postgres-container",
  "mysql-container",
];

interface CommandResult {
  ok: boolean;
  missing: boolean;
  output: string;
}

function isMissingBinary(error: NodeJS.ErrnoException | undefined): boolean {
  return error?.code === "ENOENT";
}

function run(command: string, args: string[]): CommandResult {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: PROBE_TIMEOUT_MS,
    windowsHide: true,
  });
  return {
    ok: result.status === 0,
    missing: isMissingBinary(result.error),
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.replace(
      /\u0000/g,
      "",
    ),
  };
}

function attempt<T>(probe: () => T): Probe<T> {
  try {
    return { known: true, value: probe() };
  } catch {
    return { known: false };
  }
}

function osFamily(): OsFamily {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  return "other";
}

function archOf(raw: string): CpuArch {
  if (raw === "x64" || raw === "x86_64" || raw === "amd64") return "x64";
  if (raw === "arm64" || raw === "aarch64") return "arm64";
  return "other";
}

function nativeArch(): CpuArch {
  return archOf(os.machine());
}

function disk(path: string): Probe<DiskSpace> {
  return attempt(() => {
    let target = path;
    while (!existsSync(target)) {
      const parent = dirname(target);
      if (parent === target) break;
      target = parent;
    }
    const stats = statfsSync(target);
    return {
      freeBytes: stats.bavail * stats.bsize,
      totalBytes: stats.blocks * stats.bsize,
    };
  });
}

function describeOs(): {
  osName: string;
  osVersion: string;
  osBuild: string;
  kernelVersion: string;
} {
  const kernelVersion = os.release();
  if (process.platform === "win32") {
    const parts = kernelVersion.split(".");
    const build = parts[2] ?? "";
    const buildNumber = Number(build);
    const osName =
      buildNumber >= 22000
        ? "Windows 11"
        : buildNumber >= 10240
          ? "Windows 10"
          : "Windows";
    return {
      osName,
      osVersion: parts.slice(0, 2).join("."),
      osBuild: build,
      kernelVersion,
    };
  }
  const build = run("sw_vers", ["-buildVersion"]);
  return {
    osName: process.platform === "darwin" ? "macOS" : process.platform,
    osVersion:
      typeof process.getSystemVersion === "function"
        ? process.getSystemVersion()
        : "",
    osBuild: build.ok ? build.output.trim() : "",
    kernelVersion,
  };
}

function elevation(family: OsFamily): Probe<boolean> {
  if (family === "windows") {
    if (run("net", ["session"]).ok) return { known: true, value: true };
    const uac = run("reg", [
      "query",
      "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System",
      "/v",
      "EnableLUA",
    ]);
    if (!uac.ok) return { known: false };
    return { known: true, value: /0x1\b/i.test(uac.output) };
  }
  if (family === "macos") return { known: true, value: true };
  return { known: false };
}

function virtualization(family: OsFamily): Probe<VirtualizationState> {
  if (family === "windows") {
    const probe = run("powershell", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "(Get-CimInstance -ClassName Win32_ComputerSystem).HypervisorPresent",
    ]);
    if (probe.missing) return { known: false };
    return {
      known: true,
      value: {
        applicable: true,
        enabled: probe.ok
          ? { known: true, value: /\btrue\b/i.test(probe.output) }
          : { known: false },
      },
    };
  }
  return { known: true, value: { applicable: false } };
}

function wsl(family: OsFamily): Probe<WslState> {
  if (family !== "windows")
    return { known: true, value: { applicable: false } };
  const status = run("wsl.exe", ["--status"]);
  if (status.missing) {
    return {
      known: true,
      value: { applicable: true, present: false, version: { known: false } },
    };
  }
  if (!status.ok) return { known: false };
  const version = /Default Version:\s*([12])/i.exec(status.output);
  return {
    known: true,
    value: {
      applicable: true,
      present: true,
      version:
        version === null
          ? { known: false }
          : { known: true, value: (version[1] ?? "2") === "1" ? 1 : 2 },
    },
  };
}

function containerEndpoints(runtime: ContainerRuntimeId): string[] {
  if (process.platform === "win32") {
    return runtime === "docker"
      ? ["\\\\.\\pipe\\docker_engine"]
      : ["\\\\.\\pipe\\podman-machine-default"];
  }
  return [
    runtime === "docker" ? "/var/run/docker.sock" : "/run/podman/podman.sock",
  ];
}

function containerRuntimes(): ContainerRuntimePresence[] {
  return (["docker", "podman"] as const).map((runtime) => {
    const probe = run(runtime, ["--version"]);
    const version = /(\d+\.\d+\.\d+)/.exec(probe.output);
    return {
      runtime,
      executableFound: probe.ok,
      endpointFound: containerEndpoints(runtime).some((endpoint) =>
        existsSync(endpoint),
      ),
      version:
        version === null
          ? { known: false }
          : { known: true, value: version[1] ?? "" },
    };
  });
}

function readServices(): DetectedService[] {
  const result = run("sc.exe", ["query"]);
  if (!result.ok) throw new Error("service query failed");
  const services: DetectedService[] = [];
  let name: string | null = null;
  for (const line of result.output.split(/\r?\n/)) {
    const trimline = line.trim();
    const nameMatch = /^SERVICE_NAME:\s*(\S+)/.exec(trimline);
    if (nameMatch !== null) {
      name = nameMatch[1] ?? null;
      continue;
    }
    const stateMatch = /^STATE\s*:\s*\d+\s+(\S+)/.exec(trimline);
    if (stateMatch !== null && name !== null) {
      services.push({ name, running: stateMatch[1] === "RUNNING" });
      name = null;
    }
  }
  return services.sort((left, right) => left.name.localeCompare(right.name));
}

function readSqlServerProducts(): string[] {
  const roots = [
    "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
    "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
  ];
  const products = new Set<string>();
  for (const root of roots) {
    const result = run("reg", ["query", root, "/s", "/v", "DisplayName"]);
    if (!result.ok) continue;
    for (const line of result.output.split(/\r?\n/)) {
      const match = /DisplayName\s+REG_SZ\s+(.+)$/.exec(line.trim());
      const name = match?.[1]?.trim() ?? "";
      if (/express/i.test(name)) products.add(name);
    }
  }
  return [...products].sort();
}

function detectSqlite(): DetectedInstallation {
  const file = sqlitePracticeFile();
  return {
    engine: "sqlite",
    practiceFileBytes: attempt(() =>
      existsSync(file) ? statSync(file).size : 0,
    ),
  };
}

function detectLocalDb(): DetectedInstallation | null {
  const utility = run("sqllocaldb", ["info"]);
  if (utility.missing) return null;
  const info = run("sqllocaldb", ["info", LOCALDB_INSTANCE]);
  const version = /Version:\s*([\d.]+)/i.exec(info.output);
  const instance: Probe<LocalDbInstance | null> = info.missing
    ? { known: false }
    : version === null
      ? { known: true, value: null }
      : {
          known: true,
          value: { name: LOCALDB_INSTANCE, version: version[1] ?? "" },
        };
  return {
    engine: "mssql-localdb",
    utility: { known: true, value: "sqllocaldb" },
    instance,
  };
}

function detectExpressWindows(): DetectedInstallation | null {
  const services = readServices().filter((service) =>
    /^MSSQL/i.test(service.name),
  );
  const products = readSqlServerProducts();
  if (services.length === 0 && products.length === 0) return null;
  return { engine: "mssql-express", services, products, packages: [] };
}

function engineFromContainer(name: string): ContainerEngineId | null {
  for (const engine of CONTAINER_ENGINES) {
    const prefix = `${CONTAINER_PREFIX}${engine}`;
    if (name === prefix || name.startsWith(`${prefix}-`)) return engine;
  }
  return null;
}

function engineFromImage(image: string): ContainerEngineId | null {
  if (image.startsWith("mcr.microsoft.com/mssql/server"))
    return "mssql-container";
  if (
    image === "postgres" ||
    image.startsWith("postgres:") ||
    image.startsWith("library/postgres")
  ) {
    return "postgres-container";
  }
  if (
    image === "mysql" ||
    image.startsWith("mysql:") ||
    image.startsWith("library/mysql")
  ) {
    return "mysql-container";
  }
  return null;
}

function detectContainers(): DetectedInstallation[] {
  const listing = run("docker", [
    "ps",
    "-a",
    "--format",
    "{{.Names}}\t{{.Image}}",
  ]);
  const grouped = new Map<
    ContainerEngineId,
    { names: Set<string>; images: Set<string> }
  >();
  for (const engine of CONTAINER_ENGINES) {
    grouped.set(engine, {
      names: new Set<string>(),
      images: new Set<string>(),
    });
  }

  if (listing.ok) {
    for (const line of listing.output.split(/\r?\n/)) {
      const [name, image] = line.trim().split("\t");
      if (name === undefined || image === undefined) continue;
      const engine = engineFromContainer(name);
      if (engine === null) continue;
      const entry = grouped.get(engine);
      if (entry) {
        entry.names.add(name);
        entry.images.add(image);
      }
    }
  }

  const imagesListing = run("docker", [
    "images",
    "--format",
    "{{.Repository}}:{{.Tag}}",
  ]);
  if (imagesListing.ok) {
    for (const line of imagesListing.output.split(/\r?\n/)) {
      const fullRef = line.trim();
      if (fullRef.length === 0 || fullRef.includes("<none>")) continue;
      const [repo = ""] = fullRef.split(":");
      const engine = engineFromImage(repo);
      if (engine === null) continue;
      const entry = grouped.get(engine);
      if (entry) {
        entry.images.add(fullRef);
      }
    }
  }

  return CONTAINER_ENGINES.flatMap((engine): DetectedInstallation[] => {
    const entry = grouped.get(engine);
    if (
      entry === undefined ||
      (entry.names.size === 0 && entry.images.size === 0)
    )
      return [];
    return [
      {
        engine,
        containers: [...entry.names].sort(),
        images: [...entry.images].sort(),
      },
    ];
  });
}

function detectExisting(family: OsFamily): DetectedInstallation[] {
  const found: DetectedInstallation[] = [detectSqlite()];
  const add = (probe: () => DetectedInstallation | null): void => {
    try {
      const item = probe();
      if (item !== null) found.push(item);
    } catch {
      return;
    }
  };

  if (family === "windows") {
    add(detectLocalDb);
    add(detectExpressWindows);
  }
  if (family !== "other") found.push(...detectContainers());
  return found.sort((left, right) => left.engine.localeCompare(right.engine));
}

function buildPlatformSnapshot(): PlatformSnapshot {
  const family = osFamily();
  const virt = virtualization(family);
  const wslProbe = wsl(family);
  const dataD = disk(dataDir());
  const tempD = disk(tempDir());
  const memTotal = os.totalmem();
  const readinessContext: Partial<PlatformSnapshot> = {
    virtualization: virt,
    wsl: wslProbe,
    dataDisk: dataD,
    tempDisk: tempD,
    totalMemoryBytes: memTotal,
  };
  const readinessList = [
    probeContainerReadinessSync("docker", readinessContext),
    probeContainerReadinessSync("podman", readinessContext),
  ];

  return {
    osFamily: family,
    ...describeOs(),
    arch: archOf(process.arch),
    nativeArch: nativeArch(),
    runtime: {
      electron: process.versions.electron ?? "",
      node: process.versions.node,
      chrome: process.versions.chrome ?? "",
    },
    totalMemoryBytes: memTotal,
    availableMemoryBytes: os.freemem(),
    dataDisk: dataD,
    tempDisk: tempD,
    elevationAvailable: elevation(family),
    virtualization: virt,
    wsl: wslProbe,
    containerRuntimes: containerRuntimes(),
    containerReadiness: readinessList,
    existing: detectExisting(family),
  };
}

let cached: PlatformSnapshot | null = null;

export function currentSnapshot(): PlatformSnapshot {
  if (cached === null) cached = buildPlatformSnapshot();
  return cached;
}

export function refreshSnapshot(): PlatformSnapshot {
  clearContainerReadinessCache();
  cached = buildPlatformSnapshot();
  return cached;
}
