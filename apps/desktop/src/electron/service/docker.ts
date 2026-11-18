import { spawnSync } from "node:child_process";
import { accessSync, constants, existsSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import type {
  ContainerBackendType,
  ContainerClientInfo,
  ContainerDaemonInfo,
  ContainerPrerequisites,
  ContainerReadinessGuidance,
  ContainerReadinessState,
  ContainerResourceCheck,
  ContainerRuntimeId,
  ContainerRuntimeReadiness,
  DockerGuidanceContent,
  PlatformSnapshot,
} from "../../shared/engines";
import { CONTAINER_PREFIX, versionAtLeast } from "../../shared/engine-catalog";

export const DOCKER_MIN_DAEMON_VERSION = "1.8.0";
export const DOCKER_MIN_MEMORY_BYTES = 2 * 1024 * 1024 * 1024;
export const DOCKER_MIN_DISK_BYTES = 6 * 1024 * 1024 * 1024;
const PROBE_TIMEOUT_MS = 2000;
const CACHE_TTL_MS = 10000;

interface CachedReadiness {
  timestamp: number;
  readiness: ContainerRuntimeReadiness;
}

const readinessCache = new Map<ContainerRuntimeId, CachedReadiness>();

export function clearContainerReadinessCache(): void {
  readinessCache.clear();
}

function runCommand(
  command: string,
  args: string[],
  timeoutMs = PROBE_TIMEOUT_MS,
): {
  ok: boolean;
  missing: boolean;
  output: string;
} {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: timeoutMs,
    windowsHide: true,
  });
  const errCode = (result.error as NodeJS.ErrnoException | undefined)?.code;
  return {
    ok: result.status === 0,
    missing: errCode === "ENOENT",
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`
      .replace(/\u0000/g, "")
      .trim(),
  };
}

export function resolveClientExecutablePath(
  runtime: ContainerRuntimeId,
): string | undefined {
  if (process.platform === "win32") {
    const probe = runCommand("where.exe", [runtime]);
    if (probe.ok && probe.output.length > 0) {
      return probe.output.split(/\r?\n/)[0]?.trim();
    }
  } else {
    const probe = runCommand("which", [runtime]);
    if (probe.ok && probe.output.length > 0) {
      return probe.output.split(/\r?\n/)[0]?.trim();
    }
    const standardPaths = [
      `/usr/bin/${runtime}`,
      `/usr/local/bin/${runtime}`,
      `/opt/homebrew/bin/${runtime}`,
    ];
    for (const p of standardPaths) {
      if (existsSync(p)) return p;
    }
  }
  return undefined;
}

export function probeClient(runtime: ContainerRuntimeId): ContainerClientInfo {
  const versionProbe = runCommand(runtime, ["--version"]);
  if (versionProbe.missing || !versionProbe.ok) {
    return { found: false };
  }

  const versionMatch = /(\d+\.\d+\.\d+)/.exec(versionProbe.output);
  const exePath = resolveClientExecutablePath(runtime);

  return {
    found: true,
    executablePath: exePath,
    version: versionMatch ? versionMatch[1] : undefined,
  };
}

export function resolveRuntimeEndpoint(
  runtime: ContainerRuntimeId,
): string | undefined {
  if (process.platform === "win32") {
    return runtime === "docker"
      ? "\\\\.\\pipe\\docker_engine"
      : "\\\\.\\pipe\\podman-machine-default";
  }
  if (process.platform === "darwin") {
    const homeSocket = join(process.env.HOME ?? "", ".docker/run/docker.sock");
    if (existsSync(homeSocket)) return homeSocket;
  }
  const standard =
    runtime === "docker" ? "/var/run/docker.sock" : "/run/podman/podman.sock";
  if (existsSync(standard)) return standard;
  const runtimeDir = process.env.XDG_RUNTIME_DIR;
  if (runtimeDir) {
    const userSocket = join(
      runtimeDir,
      runtime === "docker" ? "docker.sock" : "podman/podman.sock",
    );
    if (existsSync(userSocket)) return userSocket;
  }
  return standard;
}

export function checkLinuxSocketAccess(socketPath: string): {
  accessible: boolean;
  inGroup: boolean;
} {
  if (process.platform !== "linux" || !existsSync(socketPath)) {
    return { accessible: true, inGroup: true };
  }

  let accessible = false;
  try {
    accessSync(socketPath, constants.R_OK | constants.W_OK);
    accessible = true;
  } catch {
    accessible = false;
  }

  let inGroup = false;
  try {
    const idProbe = runCommand("id", ["-Gn"]);
    if (idProbe.ok) {
      inGroup = idProbe.output.split(/\s+/).includes("docker");
    }
  } catch {
    inGroup = false;
  }

  return { accessible, inGroup };
}

export function normalizeArch(raw?: string): string | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower === "x86_64" || lower === "amd64" || lower === "x64") return "x64";
  if (lower === "aarch64" || lower === "arm64") return "arm64";
  return lower;
}

interface RawDaemonJson {
  ServerVersion?: string;
  Architecture?: string;
  OSType?: string;
  OperatingSystem?: string;
  MemTotal?: number;
}

export function probeDaemonInfo(runtime: ContainerRuntimeId): {
  reachability: boolean;
  daemon: ContainerDaemonInfo;
  permissionDenied?: boolean;
} {
  const endpoint = resolveRuntimeEndpoint(runtime);
  const infoProbe = runCommand(runtime, ["info", "--format", "{{json .}}"]);

  if (!infoProbe.ok) {
    const isPermission = /permission denied/i.test(infoProbe.output);
    return {
      reachability: false,
      permissionDenied: isPermission,
      daemon: {
        reachability: false,
        backend: "unknown",
        endpoint,
      },
    };
  }

  let parsed: RawDaemonJson = {};
  try {
    parsed = JSON.parse(infoProbe.output) as RawDaemonJson;
  } catch {
    const verMatch = /Server Version:\s*([\d.]+)/i.exec(infoProbe.output);
    parsed = { ServerVersion: verMatch ? verMatch[1] : undefined };
  }

  const osStr = parsed.OperatingSystem ?? "";
  let backend: ContainerBackendType = "docker-engine";
  if (/desktop/i.test(osStr)) {
    backend = "docker-desktop";
  } else if (runtime === "podman") {
    backend = "podman";
  }

  return {
    reachability: true,
    daemon: {
      reachability: true,
      version: parsed.ServerVersion,
      arch: normalizeArch(parsed.Architecture),
      os: parsed.OSType ?? process.platform,
      backend,
      endpoint,
      totalMemoryBytes: parsed.MemTotal,
    },
  };
}

export function probeContainerReadinessSync(
  runtime: ContainerRuntimeId = "docker",
  snapshot?: Partial<PlatformSnapshot>,
): ContainerRuntimeReadiness {
  const cached = readinessCache.get(runtime);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.readiness;
  }

  const client = probeClient(runtime);
  const endpoint = resolveRuntimeEndpoint(runtime);

  const prerequisites: ContainerPrerequisites = {};
  let state: ContainerReadinessState = "ready";
  let guidance: ContainerReadinessGuidance | undefined;

  if (!client.found) {
    state = "not-installed";
    guidance = {
      title: "Docker is not installed",
      message:
        "Install Docker Desktop to run containerized database engines on your computer.",
      actionUrl: "https://docs.docker.com/get-docker/",
    };
    const notInstalled: ContainerRuntimeReadiness = {
      runtime,
      state,
      client,
      daemon: { reachability: false, backend: "unknown", endpoint },
      prerequisites,
      resources: { sufficientForOffers: false },
      guidance,
    };
    readinessCache.set(runtime, {
      timestamp: Date.now(),
      readiness: notInstalled,
    });
    return notInstalled;
  }

  if (process.platform === "win32" && snapshot) {
    if (
      snapshot.virtualization?.known &&
      snapshot.virtualization.value.applicable
    ) {
      const virtEnabled = snapshot.virtualization.value.enabled.known
        ? snapshot.virtualization.value.enabled.value
        : true;
      prerequisites.virtualizationEnabled = virtEnabled;
      if (!virtEnabled) {
        state = "unsupported";
        guidance = {
          title: "Hardware virtualization is disabled",
          message:
            "Enable hardware virtualization (VT-x / AMD-V) in your computer's BIOS/UEFI firmware settings.",
          actionUrl:
            "https://docs.docker.com/desktop/troubleshoot-and-support/troubleshoot/topics/#virtualization",
        };
      }
    }

    if (
      state === "ready" &&
      snapshot.wsl?.known &&
      snapshot.wsl.value.applicable
    ) {
      const wslPresent = snapshot.wsl.value.present;
      const wslVersion = snapshot.wsl.value.version.known
        ? snapshot.wsl.value.version.value
        : 2;
      const wsl2Ok = wslPresent && wslVersion >= 2;
      prerequisites.wsl2Supported = wsl2Ok;
      if (!wsl2Ok) {
        state = "unsupported";
        guidance = {
          title: "WSL 2 is required",
          message:
            "Docker Desktop requires Windows Subsystem for Linux 2. Open PowerShell as Administrator and run 'wsl --update'.",
          actionUrl: "https://learn.microsoft.com/en-us/windows/wsl/install",
          command: "wsl --update",
        };
      }
    }
  }

  if (process.platform === "linux" && state === "ready") {
    const socketPath = endpoint ?? "/var/run/docker.sock";
    const socketAccess = checkLinuxSocketAccess(socketPath);
    prerequisites.socketAccessible = socketAccess.accessible;
    prerequisites.inDockerGroup = socketAccess.inGroup;
    if (!socketAccess.accessible) {
      state = "permission-denied";
      guidance = {
        title: "Docker socket permission denied",
        message:
          "Your user account does not have permission to access the Docker daemon socket.",
        command: "sudo usermod -aG docker $USER",
      };
    }
  }

  const daemonProbe = probeDaemonInfo(runtime);
  const daemon = daemonProbe.daemon;

  if (state === "ready") {
    if (!daemonProbe.reachability) {
      if (daemonProbe.permissionDenied) {
        state = "permission-denied";
        guidance = {
          title: "Docker permission denied",
          message:
            "Docker daemon socket returned permission denied. Add your user to the docker group.",
          command:
            process.platform === "linux"
              ? "sudo usermod -aG docker $USER"
              : undefined,
        };
      } else {
        state = "stopped";
        guidance = {
          title: "Docker is not running",
          message:
            process.platform === "linux"
              ? "The Docker service is stopped. Start it with 'sudo systemctl start docker'."
              : "Docker Desktop is stopped. Please start Docker Desktop from your applications.",
          command:
            process.platform === "linux"
              ? "sudo systemctl start docker"
              : undefined,
        };
      }
    } else if (
      daemon.version &&
      !versionAtLeast(daemon.version, DOCKER_MIN_DAEMON_VERSION)
    ) {
      state = "outdated";
      guidance = {
        title: "Docker version is outdated",
        message: `Docker Engine version ${daemon.version} is older than the minimum required ${DOCKER_MIN_DAEMON_VERSION}. Please update Docker.`,
        actionUrl: "https://docs.docker.com/engine/install/",
      };
    }
  }

  const memAvailable =
    daemon.totalMemoryBytes ?? snapshot?.totalMemoryBytes ?? os.totalmem();
  const diskAvailable = snapshot?.dataDisk?.known
    ? snapshot.dataDisk.value.freeBytes
    : undefined;
  const sufficientForOffers =
    memAvailable >= DOCKER_MIN_MEMORY_BYTES &&
    (diskAvailable === undefined || diskAvailable >= DOCKER_MIN_DISK_BYTES);

  const resources: ContainerResourceCheck = {
    memoryBytes: memAvailable,
    diskBytes: diskAvailable,
    sufficientForOffers,
  };

  const readiness: ContainerRuntimeReadiness = {
    runtime,
    state,
    client,
    daemon,
    prerequisites,
    resources,
    guidance,
  };

  readinessCache.set(runtime, { timestamp: Date.now(), readiness });
  return readiness;
}

export async function probeContainerReadiness(
  runtime: ContainerRuntimeId = "docker",
  snapshot?: Partial<PlatformSnapshot>,
): Promise<ContainerRuntimeReadiness> {
  return probeContainerReadinessSync(runtime, snapshot);
}

export const OFFICIAL_DOMAINS: readonly string[] = [
  "docs.docker.com",
  "desktop.docker.com",
  "hub.docker.com",
  "docker.com",
  "learn.microsoft.com",
  "microsoft.com",
  "sqlite.org",
  "postgresql.org",
  "mysql.com",
];

export function isOfficialUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    return OFFICIAL_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

export function getDockerInstallationGuidance(
  snapshot: PlatformSnapshot,
): DockerGuidanceContent {
  const readiness =
    snapshot.containerReadiness?.find((r) => r.runtime === "docker") ??
    probeContainerReadinessSync("docker", snapshot);
  const platform = snapshot.osFamily;

  if (readiness.state === "stopped") {
    return {
      platform,
      headline:
        platform === "linux"
          ? "Docker Service is Stopped"
          : "Docker Desktop is Stopped",
      summary:
        platform === "linux"
          ? "The Docker service is installed on your Linux system, but the background daemon is not running."
          : "Docker Desktop is installed on your computer, but the application is currently stopped.",
      statusText:
        "Docker is stopped. (LogixZen detects your installation; it never starts or modifies Docker directly.)",
      requirements: ["Docker daemon running and reachable via local socket"],
      steps:
        platform === "linux"
          ? [
              {
                title: "Start Docker Service",
                detail:
                  "Run the systemd command in your terminal to start the background daemon:",
                command: "sudo systemctl start docker",
              },
              {
                title: "Enable Automatic Start (Optional)",
                detail:
                  "Configure the Docker service to automatically start whenever your computer boots:",
                command: "sudo systemctl enable docker",
              },
            ]
          : [
              {
                title: "Open Docker Desktop",
                detail:
                  "Launch Docker Desktop from your Applications folder or Start menu.",
              },
              {
                title: "Wait for Engine Initialization",
                detail:
                  "Wait until the Docker whale icon stops animating and shows 'Engine running'.",
              },
            ],
      notes: {
        restartRequired: false,
        signInRequired: false,
        permissionsRequired: platform === "linux",
        alternativesAvailable: true,
      },
      officialDocUrl:
        platform === "windows"
          ? "https://docs.docker.com/desktop/setup/install/windows-install/"
          : platform === "macos"
            ? "https://docs.docker.com/desktop/setup/install/mac-install/"
            : "https://docs.docker.com/engine/install/",
      checkAgainLabel: "Check again",
    };
  }

  if (readiness.state === "permission-denied") {
    return {
      platform,
      headline: "Docker Socket Permission Required",
      summary:
        "The Docker daemon is active, but your current user account does not have permission to access /var/run/docker.sock without root privileges.",
      statusText:
        "Docker permission denied. (LogixZen detects your installation; it never alters user groups directly.)",
      requirements: [
        "Current user in the 'docker' system group",
        "Read/write access to /var/run/docker.sock",
      ],
      steps: [
        {
          title: "Add User to Docker Group",
          detail:
            "Add your current user to the docker group so you can manage containers without sudo:",
          command: "sudo usermod -aG docker $USER",
        },
        {
          title: "Apply Group Membership",
          detail:
            "Log out of your desktop session and log back in (or run 'newgrp docker' in your shell) for the group changes to take effect.",
          command: "newgrp docker",
        },
      ],
      notes: {
        restartRequired: false,
        signInRequired: false,
        permissionsRequired: true,
        alternativesAvailable: true,
      },
      officialDocUrl:
        "https://docs.docker.com/engine/install/linux-postinstall/",
      checkAgainLabel: "Check again",
    };
  }

  if (readiness.state === "outdated") {
    return {
      platform,
      headline: "Docker Engine Update Required",
      summary: `The detected Docker version (${readiness.daemon.version ?? "unknown"}) is older than the minimum required version (${DOCKER_MIN_DAEMON_VERSION}).`,
      statusText:
        "Docker is outdated. (LogixZen detects your installation; update Docker using the official vendor package.)",
      requirements: [
        `Docker Engine version ${DOCKER_MIN_DAEMON_VERSION} or higher`,
      ],
      steps: [
        {
          title: "Download Latest Docker Release",
          detail:
            "Visit the official Docker documentation to download and install the latest release for your platform.",
          url:
            platform === "windows"
              ? "https://docs.docker.com/desktop/setup/install/windows-install/"
              : platform === "macos"
                ? "https://docs.docker.com/desktop/setup/install/mac-install/"
                : "https://docs.docker.com/engine/install/",
          urlLabel: "Open official Docker install guide",
        },
      ],
      notes: {
        restartRequired: platform === "windows",
        signInRequired: false,
        permissionsRequired: true,
        alternativesAvailable: true,
      },
      officialDocUrl: "https://docs.docker.com/engine/install/",
      checkAgainLabel: "Check again",
    };
  }

  if (platform === "windows") {
    return {
      platform: "windows",
      headline: "Install Docker Desktop for Windows",
      summary:
        "To run containerized database engines, install Docker Desktop from the official Docker website. LogixZen detects it automatically once started.",
      statusText:
        "Docker was not detected on this machine. (LogixZen detects your installation; it never installs or modifies Docker directly.)",
      requirements: [
        "Windows 11 64-bit or Windows 10 64-bit (Build 19044 or higher)",
        "Hardware-assisted virtualization (VT-x / AMD-V) enabled in BIOS/UEFI",
        "Windows Subsystem for Linux 2 (WSL 2) installed and updated",
        "At least 4 GB system memory (8 GB recommended)",
      ],
      steps: [
        {
          title: "Download Docker Desktop",
          detail: "Download the official installer for Windows from Docker.",
          url: "https://docs.docker.com/desktop/setup/install/windows-install/",
          urlLabel: "Open Docker Desktop for Windows download page",
        },
        {
          title: "Verify WSL 2",
          detail:
            "Ensure WSL 2 is installed. In an administrator PowerShell prompt, run:",
          command: "wsl --update",
        },
        {
          title: "Run Installer",
          detail:
            "Launch Docker Desktop Installer.exe and ensure 'Use WSL 2 instead of Hyper-V' is selected.",
        },
        {
          title: "Restart & Start Docker",
          detail:
            "Restart Windows if prompted, then start Docker Desktop from the Start menu. Sign-in is optional for local development.",
        },
      ],
      notes: {
        restartRequired: true,
        signInRequired: false,
        permissionsRequired: true,
        alternativesAvailable: true,
      },
      officialDocUrl:
        "https://docs.docker.com/desktop/setup/install/windows-install/",
      checkAgainLabel: "Check again",
    };
  }

  if (platform === "macos") {
    return {
      platform: "macos",
      headline: "Install Docker Desktop for Mac",
      summary:
        "To run containerized database engines, install Docker Desktop for Mac. Choose the installer matching your Mac's processor (Apple Silicon or Intel). LogixZen detects it automatically.",
      statusText:
        "Docker was not detected on this Mac. (LogixZen detects your installation; it never installs or modifies Docker directly.)",
      requirements: [
        "macOS 13 (Ventura), macOS 14 (Sonoma), or macOS 15 (Sequoia)",
        "At least 4 GB system memory",
        "Installer build matching your processor: Apple chip (M1/M2/M3/M4) or Intel chip",
      ],
      steps: [
        {
          title: "Download Docker Desktop for Mac",
          detail: "Download the build matching your Mac processor.",
          url: "https://docs.docker.com/desktop/setup/install/mac-install/",
          urlLabel: "Open Docker Desktop for Mac download page",
        },
        {
          title: "Drag to Applications",
          detail:
            "Open Docker.dmg and drag the Docker icon into the Applications folder.",
        },
        {
          title: "Complete Privileged Helper Setup",
          detail:
            "Open Docker from Applications. macOS will ask for your administrator password to install networking helpers.",
        },
        {
          title: "Wait for Engine Initialization",
          detail:
            "Once the menu bar whale icon is steady, Docker is ready. Sign-in is optional.",
        },
      ],
      notes: {
        restartRequired: false,
        signInRequired: false,
        permissionsRequired: true,
        alternativesAvailable: true,
      },
      officialDocUrl:
        "https://docs.docker.com/desktop/setup/install/mac-install/",
      checkAgainLabel: "Check again",
    };
  }

  return {
    platform: "linux",
    headline: "Install Docker Engine on Linux",
    summary:
      "To run containerized database engines, install Docker Engine from the official Docker package repository. Configure systemd and add your user to the docker group so LogixZen can communicate with the daemon.",
    statusText:
      "Docker was not detected on this Linux system. (LogixZen detects your installation; it never installs or modifies Docker directly.)",
    requirements: [
      "64-bit architecture (x86-64 / AMD64 recommended; note SQL Server container requires x86-64)",
      "systemd service manager",
      "Non-root user with sudo privileges for initial setup",
    ],
    steps: [
      {
        title: "Install from Official Repository",
        detail:
          "Follow the official instructions to add Docker's repository and install docker-ce.",
        url: "https://docs.docker.com/engine/install/",
        urlLabel: "Open Docker Engine installation guide",
      },
      {
        title: "Enable and Start Service",
        detail: "Ensure the systemd service starts on boot:",
        command: "sudo systemctl enable --now docker",
      },
      {
        title: "Grant User Socket Permission",
        detail:
          "Add your current user to the docker group to access /var/run/docker.sock without root:",
        command: "sudo usermod -aG docker $USER",
      },
      {
        title: "Apply Group Changes",
        detail:
          "Log out and log back in, or run 'newgrp docker' to apply group membership.",
      },
    ],
    notes: {
      restartRequired: false,
      signInRequired: false,
      permissionsRequired: true,
      alternativesAvailable: true,
    },
    officialDocUrl: "https://docs.docker.com/engine/install/",
    checkAgainLabel: "Check again",
  };
}

export interface PulledImageSummary {
  repository: string;
  tag: string;
  digest?: string;
  id?: string;
  size?: string;
}

export function detectPulledImages(
  runtime: ContainerRuntimeId = "docker",
): PulledImageSummary[] {
  const result = runCommand(runtime, [
    "images",
    "--format",
    "{{.Repository}}\t{{.Tag}}\t{{.Digest}}\t{{.ID}}\t{{.Size}}",
  ]);
  if (!result.ok) return [];
  const images: PulledImageSummary[] = [];
  for (const line of result.output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const [repository = "", tag = "", rawDigest = "", id = "", size = ""] =
      trimmed.split("\t");
    const digest = rawDigest && rawDigest !== "<none>" ? rawDigest : undefined;
    images.push({ repository, tag, digest, id, size });
  }
  return images;
}

export function isImagePulled(
  image: string,
  tag: string,
  digest?: string,
  runtime: ContainerRuntimeId = "docker",
): boolean {
  const pulled = detectPulledImages(runtime);
  return pulled.some((p) => {
    if (p.repository === image && p.tag === tag) return true;
    if (digest && p.digest && p.digest === digest) return true;
    return false;
  });
}

export interface AppContainerSummary {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  appOwned: boolean;
}

export function detectAppContainers(
  runtime: ContainerRuntimeId = "docker",
): AppContainerSummary[] {
  const result = runCommand(runtime, [
    "ps",
    "-a",
    "--format",
    "{{.ID}}\t{{.Names}}\t{{.Image}}\t{{.State}}\t{{.Status}}",
  ]);
  if (!result.ok) return [];
  const containers: AppContainerSummary[] = [];
  for (const line of result.output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const [id = "", name = "", image = "", state = "", status = ""] =
      trimmed.split("\t");
    const appOwned = name.startsWith(CONTAINER_PREFIX);
    containers.push({ id, name, image, state, status, appOwned });
  }
  return containers;
}
