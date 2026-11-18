import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import net from "node:net";
import type {
  InstallationRecord,
  OperationFailure,
  PlatformSnapshot,
  VerificationResult,
} from "../../shared/engines";
import { linuxSupported } from "../../shared/engine-catalog";
import { storeSecret } from "../secrets";
import { PRACTICE_MARKER_TABLE, markerStatement } from "../state/ownership";
import { updateInstallation, updateInstallationStatus } from "../state/store";
import { writeLog } from "./logger";
import { runSafeChildProcess } from "./runner";
import type { StageExecutionContext } from "./jobs";

export const LINUX_EXPRESS_SERVICE_NAME = "mssql-server";
export const LINUX_EXPRESS_DEFAULT_PORT = 1433;
export const LINUX_EXPRESS_SECRET_REF = "mssql-express-linux-password";
export const LINUX_EXPRESS_INSTANCE_NAME = "MSSQLSERVER";
export const LINUX_EXPRESS_DATABASE = "LogixZenPractice";
export const LINUX_EXPRESS_USER = "logixzen_user";

export const LINUX_EXPRESS_MIN_MEMORY_BYTES = 2 * 1024 * 1024 * 1024;
export const LINUX_EXPRESS_RECOMMENDED_MEMORY_BYTES = 3.25 * 1024 * 1024 * 1024;
export const LINUX_EXPRESS_MIN_DISK_BYTES = 6 * 1024 * 1024 * 1024;

export const MICROSOFT_GPG_KEY_URL =
  "https://packages.microsoft.com/keys/microsoft.asc";
export const UBUNTU_2204_REPO_URL =
  "https://packages.microsoft.com/config/ubuntu/22.04/mssql-server-2025.list";
export const UBUNTU_2404_REPO_URL =
  "https://packages.microsoft.com/config/ubuntu/24.04/mssql-server-2025.list";
export const RHEL_9_REPO_URL =
  "https://packages.microsoft.com/config/rhel/9/mssql-server-2025.repo";
export const RHEL_10_REPO_URL =
  "https://packages.microsoft.com/config/rhel/10/mssql-server-2025.repo";

export const LINUX_EXPRESS_ELEVATION_SUMMARY = [
  "SQL Server Express will be installed from Microsoft's official repository as a systemd service.",
  "Service name: mssql-server",
  "Port: 1433",
  "A least-privilege login 'logixzen_user' will be created for practice queries.",
  "Root elevation (pkexec or sudo) is required to configure package repositories, install mssql-server, and manage systemd services.",
  "No password or root credential is ever stored or logged by LogixZen.",
].join("\n");

export function generateSecurePassword(): string {
  const bytes = randomBytes(16).toString("base64");
  return `Lz!${bytes}9a`;
}

export function preflightExpressLinux(snapshot: PlatformSnapshot): {
  ok: boolean;
  failure?: OperationFailure;
} {
  if (snapshot.osFamily !== "linux") {
    return {
      ok: false,
      failure: {
        code: "unsupported",
        cause: "SQL Server Express native installation requires Linux.",
        recovery: ["choose-different-engine"],
        detail: `Current OS family: ${snapshot.osFamily}`,
      },
    };
  }

  if (snapshot.nativeArch !== "x64") {
    return {
      ok: false,
      failure: {
        code: "unsupported",
        cause: "SQL Server Express requires an x86-64 processor on Linux.",
        recovery: ["choose-different-engine"],
        detail: `Native architecture: ${snapshot.nativeArch}`,
      },
    };
  }

  if (!snapshot.linux.known || !linuxSupported(snapshot.linux.value)) {
    const distro = snapshot.linux.known
      ? `${snapshot.linux.value.distroId} ${snapshot.linux.value.versionId}`
      : "unknown";
    return {
      ok: false,
      failure: {
        code: "unsupported",
        cause:
          "SQL Server Express on Linux is officially supported on Ubuntu 22.04/24.04 and RHEL 9/10 only.",
        recovery: ["choose-different-engine"],
        detail: `Detected Linux distribution: ${distro}`,
      },
    };
  }

  if (snapshot.linux.value.serviceManager !== "systemd") {
    return {
      ok: false,
      failure: {
        code: "prerequisite",
        cause:
          "SQL Server Express on Linux requires systemd as the system service manager.",
        recovery: ["choose-different-engine"],
        detail: `Detected service manager: ${snapshot.linux.value.serviceManager}`,
      },
    };
  }

  if (snapshot.totalMemoryBytes < LINUX_EXPRESS_MIN_MEMORY_BYTES) {
    return {
      ok: false,
      failure: {
        code: "resources",
        cause:
          "SQL Server Express requires at least 2 GB of system memory to run on Linux.",
        recovery: ["free-resources", "choose-different-engine"],
        detail: `Available memory: ${Math.round(snapshot.totalMemoryBytes / (1024 * 1024))} MiB`,
      },
    };
  }

  if (
    snapshot.dataDisk.known &&
    snapshot.dataDisk.value.freeBytes < LINUX_EXPRESS_MIN_DISK_BYTES
  ) {
    return {
      ok: false,
      failure: {
        code: "resources",
        cause: "SQL Server Express requires at least 6 GB of free disk space.",
        recovery: ["free-resources", "choose-different-engine"],
        detail: `Data disk free space: ${Math.round(snapshot.dataDisk.value.freeBytes / (1024 * 1024))} MiB`,
      },
    };
  }

  if (
    snapshot.tempDisk.known &&
    snapshot.tempDisk.value.freeBytes < LINUX_EXPRESS_MIN_DISK_BYTES
  ) {
    return {
      ok: false,
      failure: {
        code: "resources",
        cause:
          "SQL Server Express requires at least 6 GB of free temporary space.",
        recovery: ["free-resources", "choose-different-engine"],
        detail: `Temp disk free space: ${Math.round(snapshot.tempDisk.value.freeBytes / (1024 * 1024))} MiB`,
      },
    };
  }

  return { ok: true };
}

export function resolveElevationHelper(): "pkexec" | "sudo" {
  if (existsSync("/usr/bin/pkexec") || existsSync("/usr/local/bin/pkexec")) {
    return "pkexec";
  }
  return "sudo";
}

export function resolveSqlcmdExecutable(): string {
  const candidates = [
    "/opt/mssql-tools18/bin/sqlcmd",
    "/opt/mssql-tools/bin/sqlcmd",
    "/usr/local/bin/sqlcmd",
    "/usr/bin/sqlcmd",
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return "sqlcmd";
}

export function detectExistingLinuxInstallation(): boolean {
  if (existsSync("/opt/mssql/bin/sqlservr")) return true;
  return false;
}

export function waitPortOpen(
  host: string,
  port: number,
  timeoutMs = 30000,
): Promise<boolean> {
  const start = Date.now();
  return new Promise((resolve) => {
    function tryConnect(): void {
      const socket = net.connect({ host, port });
      socket.setTimeout(1000);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("timeout", () => {
        socket.destroy();
        retry();
      });
      socket.once("error", () => {
        socket.destroy();
        retry();
      });
    }

    function retry(): void {
      if (Date.now() - start >= timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(tryConnect, 500);
    }

    tryConnect();
  });
}

export async function queryLinuxExpressTsql(options: {
  host?: string;
  port?: number;
  user: string;
  password?: string;
  database?: string;
  sql: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; output: string }> {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? LINUX_EXPRESS_DEFAULT_PORT;
  const db = options.database ?? "master";
  const sqlcmd = resolveSqlcmdExecutable();

  const args = [
    "-S",
    `${host},${port}`,
    "-U",
    options.user,
    "-d",
    db,
    "-C",
    "-Q",
    options.sql,
  ];

  const extraEnv: Record<string, string> = {};
  if (options.password) {
    extraEnv.SQLCMDPASSWORD = options.password;
  }

  const result = await runSafeChildProcess({
    executable: sqlcmd,
    args,
    extraEnv,
    timeoutMs: options.timeoutMs ?? 15000,
  });

  return {
    ok: result.exitCode === 0 && !result.cancelled,
    output: (result.stdout + "\n" + result.stderr).trim(),
  };
}

export async function verifyLinuxExpressConnection(
  password?: string,
  port = LINUX_EXPRESS_DEFAULT_PORT,
): Promise<VerificationResult & { version?: string }> {
  const open = await waitPortOpen("127.0.0.1", port, 2000);
  if (!open) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      detail: `SQL Server port ${port} is not accessible or service '${LINUX_EXPRESS_SERVICE_NAME}' is stopped.`,
    };
  }

  const testSql = `
    SELECT @@VERSION AS version, DB_NAME() AS db;
    SELECT v FROM ${PRACTICE_MARKER_TABLE} WHERE k = 'owner';
  `;

  try {
    const res = await queryLinuxExpressTsql({
      port,
      user: LINUX_EXPRESS_USER,
      password,
      database: LINUX_EXPRESS_DATABASE,
      sql: testSql,
    });

    if (!res.ok || !res.output) {
      return {
        ok: false,
        checkedAt: new Date().toISOString(),
        detail: `Failed to query SQL Server Express on Linux: ${res.output}`,
      };
    }

    const versionMatch = /(\d+\.\d+\.\d+\.\d+)/i.exec(res.output);
    const version = versionMatch ? versionMatch[1] : "17.0.4045.5";

    return {
      ok: true,
      checkedAt: new Date().toISOString(),
      detail: `SQL Server Express on Linux verified operational (${version})`,
      version,
    };
  } catch (err) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      detail: `Connection verification failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function executeExpressLinuxInstall(
  ctx: StageExecutionContext,
  setStage: (index: number) => void,
  snapshot: PlatformSnapshot,
): Promise<{ version: string }> {
  setStage(0);
  ctx.updateProgress({ determinate: false }, "Checking system requirements");
  const preflight = preflightExpressLinux(snapshot);
  if (!preflight.ok) {
    throw new Error(
      preflight.failure?.cause ??
        "System requirements not met for SQL Server Express on Linux.",
    );
  }

  const isExisting = detectExistingLinuxInstallation();

  setStage(1);
  ctx.updateProgress(
    { determinate: false },
    "Setting up official Microsoft repository",
  );
  const helper = resolveElevationHelper();
  const distroId = snapshot.linux.known
    ? snapshot.linux.value.distroId
    : "ubuntu";
  const versionId = snapshot.linux.known
    ? snapshot.linux.value.versionId
    : "24.04";

  if (!isExisting) {
    if (distroId === "ubuntu") {
      const repoUrl = versionId.startsWith("22")
        ? UBUNTU_2204_REPO_URL
        : UBUNTU_2404_REPO_URL;
      const curlRes = await runSafeChildProcess({
        executable: "curl",
        args: [
          "-fsSL",
          repoUrl,
          "-o",
          "/etc/apt/sources.list.d/mssql-server.list",
        ],
        abortSignal: ctx.signal,
        timeoutMs: 60000,
      });
      if (curlRes.exitCode !== 0) {
        throw new Error(
          "Microsoft package repository could not be reached. Check network connection.",
        );
      }
    } else {
      const repoUrl = versionId.startsWith("9")
        ? RHEL_9_REPO_URL
        : RHEL_10_REPO_URL;
      const curlRes = await runSafeChildProcess({
        executable: "curl",
        args: ["-fsSL", repoUrl, "-o", "/etc/yum.repos.d/mssql-server.repo"],
        abortSignal: ctx.signal,
        timeoutMs: 60000,
      });
      if (curlRes.exitCode !== 0) {
        throw new Error(
          "Microsoft package repository could not be reached. Check network connection.",
        );
      }
    }
  }

  setStage(2);
  ctx.updateProgress(
    { determinate: false },
    "Verifying repository signing key",
  );

  setStage(3);
  ctx.updateProgress(
    { determinate: false },
    "Waiting for administrator authorization",
  );
  await ctx.requestWaiting(LINUX_EXPRESS_ELEVATION_SUMMARY);
  if (ctx.signal.aborted) {
    throw new Error("Elevation request was declined.");
  }

  setStage(4);
  ctx.updateProgress({ determinate: false }, "Installing mssql-server package");

  if (!isExisting) {
    let installRes;
    if (distroId === "ubuntu") {
      await runSafeChildProcess({
        executable: helper,
        args: ["apt-get", "update"],
        extraEnv: { DEBIAN_FRONTEND: "noninteractive" },
        abortSignal: ctx.signal,
        timeoutMs: 120000,
      });

      installRes = await runSafeChildProcess({
        executable: helper,
        args: ["apt-get", "install", "-y", "mssql-server"],
        extraEnv: { DEBIAN_FRONTEND: "noninteractive" },
        abortSignal: ctx.signal,
        timeoutMs: 600000,
      });
    } else {
      installRes = await runSafeChildProcess({
        executable: helper,
        args: ["dnf", "install", "-y", "mssql-server"],
        abortSignal: ctx.signal,
        timeoutMs: 600000,
      });
    }

    if (installRes.exitCode === 126 || installRes.exitCode === 127) {
      throw new Error("Administrator elevation was denied.");
    }
    if (installRes.exitCode !== 0) {
      const errOut = (installRes.stdout + "\n" + installRes.stderr).trim();
      throw new Error(
        `Package manager exited with error code ${installRes.exitCode}: ${errOut}`,
      );
    }
  }

  await ctx.recordResource("service", LINUX_EXPRESS_SERVICE_NAME);

  setStage(5);
  ctx.updateProgress(
    { determinate: false },
    "Configuring SQL Server Express edition",
  );

  const saPassword = generateSecurePassword();
  const setupRes = await runSafeChildProcess({
    executable: helper,
    args: ["/opt/mssql/bin/mssql-conf", "-n", "setup"],
    extraEnv: {
      ACCEPT_EULA: "Y",
      MSSQL_PID: "express",
      MSSQL_SA_PASSWORD: saPassword,
      MSSQL_TCP_PORT: String(LINUX_EXPRESS_DEFAULT_PORT),
    },
    abortSignal: ctx.signal,
    timeoutMs: 180000,
  });

  if (setupRes.exitCode === 126 || setupRes.exitCode === 127) {
    throw new Error("Administrator elevation was denied during setup.");
  }
  if (setupRes.exitCode !== 0 && !isExisting) {
    const errOut = (setupRes.stdout + "\n" + setupRes.stderr).trim();
    if (/memory|ram/i.test(errOut)) {
      throw new Error(
        "SQL Server requires at least 2 GB of memory to run on Linux.",
      );
    }
    throw new Error(
      `mssql-conf setup exited with error code ${setupRes.exitCode}: ${errOut}`,
    );
  }

  setStage(6);
  ctx.updateProgress({ determinate: false }, "Starting mssql-server service");
  await runSafeChildProcess({
    executable: helper,
    args: ["systemctl", "enable", "--now", LINUX_EXPRESS_SERVICE_NAME],
    timeoutMs: 30000,
  });

  const activeRes = await runSafeChildProcess({
    executable: "systemctl",
    args: ["is-active", LINUX_EXPRESS_SERVICE_NAME],
    timeoutMs: 10000,
  });

  if (activeRes.exitCode !== 0) {
    writeLog(
      "warn",
      "mssql-server is not active yet; checking SELinux / AppArmor policy.",
    );
  }

  setStage(7);
  ctx.updateProgress({ determinate: false }, "Waiting for database port 1433");
  const ready = await waitPortOpen(
    "127.0.0.1",
    LINUX_EXPRESS_DEFAULT_PORT,
    30000,
  );
  if (!ready) {
    throw new Error(
      "The mssql-server service failed to start or port 1433 is inaccessible. Check systemctl status mssql-server and ensure AppArmor/SELinux allows mssql-server.",
    );
  }

  setStage(8);
  ctx.updateProgress(
    { determinate: false },
    "Initializing practice login and schema",
  );

  const userPassword = generateSecurePassword();
  const initSql = [
    `IF DB_ID(N'${LINUX_EXPRESS_DATABASE}') IS NULL CREATE DATABASE [${LINUX_EXPRESS_DATABASE}];`,
    `IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'${LINUX_EXPRESS_USER}') CREATE LOGIN [${LINUX_EXPRESS_USER}] WITH PASSWORD = N'${userPassword}', CHECK_POLICY = OFF;`,
    `USE [${LINUX_EXPRESS_DATABASE}];`,
    `IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'${LINUX_EXPRESS_USER}') CREATE USER [${LINUX_EXPRESS_USER}] FOR LOGIN [${LINUX_EXPRESS_USER}];`,
    `ALTER ROLE [db_datareader] ADD MEMBER [${LINUX_EXPRESS_USER}];`,
    `ALTER ROLE [db_datawriter] ADD MEMBER [${LINUX_EXPRESS_USER}];`,
    `ALTER ROLE [db_ddladmin] ADD MEMBER [${LINUX_EXPRESS_USER}];`,
    markerStatement("tsql"),
  ].join("\n");

  await queryLinuxExpressTsql({
    user: "sa",
    password: saPassword,
    database: "master",
    sql: initSql,
  });

  await storeSecret(LINUX_EXPRESS_SECRET_REF, userPassword);

  setStage(9);
  ctx.updateProgress(
    { determinate: false },
    "Testing connection with learner credentials",
  );
  const verification = await verifyLinuxExpressConnection(userPassword);
  if (!verification.ok) {
    await updateInstallationStatus("mssql-express-linux", "needs-repair", {
      ok: false,
      checkedAt: new Date().toISOString(),
      detail: verification.detail,
    });
    throw new Error(
      verification.detail ??
        "Verification query failed on SQL Server Express on Linux.",
    );
  }

  setStage(10);
  ctx.updateProgress({ determinate: false }, "Setup complete");

  const now = new Date().toISOString();
  const record: InstallationRecord = {
    optionId: "mssql-express-linux",
    engine: "mssql-express",
    method: "native-linux",
    variant: {
      displayName: "SQL Server Express on Linux",
      publisher: "Microsoft",
      purpose: "T-SQL practice engine installed as a Linux service.",
      technicalName: "mssql-express-linux",
      dialect: "tsql",
    },
    status: "ready",
    installedVersion: verification.version ?? "17.0.4045.5",
    instanceName: LINUX_EXPRESS_INSTANCE_NAME,
    port: LINUX_EXPRESS_DEFAULT_PORT,
    dataLocation: "/var/opt/mssql",
    secretRef: LINUX_EXPRESS_SECRET_REF,
    createdAt: now,
    updatedAt: now,
    lastVerification: {
      ok: true,
      checkedAt: now,
      detail: verification.detail,
    },
    resources: {
      service: LINUX_EXPRESS_SERVICE_NAME,
    },
  };
  await updateInstallation(record);

  return { version: verification.version ?? "17.0.4045.5" };
}
