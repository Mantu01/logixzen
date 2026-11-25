import crypto from "node:crypto";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import net from "node:net";
import { join } from "node:path";
import {
  CONTAINER_PREFIX,
  ENGINE_CATALOG,
  defaultContainerName,
  defaultVolumeName,
} from "../../shared/engine-catalog";
import type {
  ContainerTechnicalDetails,
  EngineOptionId,
  InstallationRecord,
  OrphanContainerSummary,
  PlatformSnapshot,
  VerificationResult,
} from "../../shared/engines";
import { tempDir } from "../paths";
import { retrieveSecret, storeSecret } from "../secrets";
import { markerStatement } from "../state/ownership";
import {
  loadInstallState,
  updateInstallation,
  updateInstallationStatus,
} from "../state/store";
import {
  detectAppContainers,
  isImagePulled,
  probeContainerReadinessSync,
} from "./docker";
import type { StageExecutionContext } from "./jobs";
import { redactText, writeLog } from "./logger";
import { runSafeChildProcess } from "./runner";

async function findFreeLoopbackPort(
  startPort: number,
  host = "127.0.0.1",
): Promise<number> {
  for (let port = startPort; port < startPort + 100; port += 1) {
    const isFree = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.once("error", () => resolve(false));
      server.once("listening", () => {
        server.close(() => resolve(true));
      });
      server.listen(port, host);
    });
    if (isFree) return port;
  }
  throw new Error(
    `Unable to find a free loopback port in range ${startPort}-${startPort + 99}`,
  );
}

function generateStrongCredential(length = 28): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#%&*-_+=";
  const allChars = upper + lower + digits + symbols;

  const bytes = crypto.randomBytes(length);
  const chars: string[] = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    digits[bytes[2] % digits.length],
    symbols[bytes[3] % symbols.length],
  ];

  for (let i = 4; i < length; i += 1) {
    chars.push(allChars[bytes[i] % allChars.length]);
  }

  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = bytes[i] % (i + 1);
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }

  return chars.join("");
}

interface ContainerInspectResult {
  exists: boolean;
  running: boolean;
  status: string;
  port?: number;
}

export async function inspectContainer(
  containerName: string,
): Promise<ContainerInspectResult> {
  const res = await runSafeChildProcess({
    executable: "docker",
    args: [
      "inspect",
      "--format",
      "{{.State.Running}}\t{{.State.Status}}",
      containerName,
    ],
    timeoutMs: 10000,
  });

  if (res.exitCode !== 0 || res.cancelled) {
    return { exists: false, running: false, status: "missing" };
  }

  const [runningStr = "false", status = "unknown"] = res.stdout
    .trim()
    .split("\t");
  return {
    exists: true,
    running: runningStr.toLowerCase() === "true",
    status,
  };
}

export async function pullImageWithProgress(
  image: string,
  tag: string,
  ctx: StageExecutionContext,
): Promise<void> {
  if (isImagePulled(image, tag)) {
    writeLog(
      "info",
      `Image ${image}:${tag} already present locally; skipping pull.`,
    );
    return;
  }

  let attempt = 0;
  const maxAttempts = 2;
  while (attempt < maxAttempts) {
    attempt += 1;
    if (ctx.signal.aborted) return;

    writeLog(
      "info",
      `Pulling Docker image ${image}:${tag} (attempt ${attempt}/${maxAttempts})`,
    );
    ctx.updateProgress({ determinate: false }, `Pulling image ${image}:${tag}`);

    const result = await runSafeChildProcess({
      executable: "docker",
      args: ["pull", `${image}:${tag}`],
      timeoutMs: 300000,
      abortSignal: ctx.signal,
      onStdoutChunk: (chunk) => {
        const lines = chunk.split(/\r?\n/);
        for (const line of lines) {
          const match =
            /(\d+(?:\.\d+)?)\s*([kKMmGg][bB])\s*\/\s*(\d+(?:\.\d+)?)\s*([kKMmGg][bB])/.exec(
              line,
            );
          if (match) {
            ctx.updateProgress({ determinate: false }, line.trim());
          }
        }
      },
    });

    if (result.exitCode === 0) {
      return;
    }

    if (ctx.signal.aborted) {
      throw new Error("Image download cancelled by user.");
    }

    if (attempt >= maxAttempts) {
      throw new Error(
        `Failed to pull image ${image}:${tag}: ${result.stderr || result.stdout}`,
      );
    }
  }
}

async function createVolumeIfMissing(
  volumeName: string,
  ctx: StageExecutionContext,
): Promise<void> {
  const inspectRes = await runSafeChildProcess({
    executable: "docker",
    args: ["volume", "inspect", volumeName],
    timeoutMs: 10000,
  });

  if (inspectRes.exitCode === 0) {
    writeLog("info", `Volume ${volumeName} already exists; reusing.`);
    return;
  }

  const createRes = await runSafeChildProcess({
    executable: "docker",
    args: ["volume", "create", volumeName],
    timeoutMs: 15000,
  });

  if (createRes.exitCode !== 0) {
    throw new Error(
      `Failed to create Docker volume ${volumeName}: ${createRes.stderr}`,
    );
  }

  await ctx.recordResource("volume", volumeName);
}

async function waitForContainerReady(
  port: number,
  timeoutMs = 60000,
  signal?: AbortSignal,
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (signal?.aborted) return false;

    const isOpen = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(800);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.once("error", () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, "127.0.0.1");
    });

    if (isOpen) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

export async function getContainerLogs(
  containerName: string,
  lines = 50,
): Promise<string[]> {
  const text = await getContainerLogTail(containerName, lines);
  return text.length > 0 ? text.split(/\r?\n/) : [];
}

async function getContainerLogTail(
  containerName: string,
  lines = 50,
): Promise<string> {
  try {
    const res = await runSafeChildProcess({
      executable: "docker",
      args: ["logs", "--tail", String(lines), containerName],
      timeoutMs: 10000,
    });
    return redactText(`${res.stdout}\n${res.stderr}`.trim());
  } catch {
    return "";
  }
}

export async function startAppContainer(containerName: string): Promise<void> {
  const res = await runSafeChildProcess({
    executable: "docker",
    args: ["start", containerName],
    timeoutMs: 30000,
  });
  if (res.exitCode !== 0) {
    throw new Error(
      `Failed to start container ${containerName}: ${res.stderr}`,
    );
  }
}

export async function stopAppContainer(
  containerName: string,
  timeoutSec = 10,
): Promise<void> {
  const inspect = await inspectContainer(containerName);
  if (!inspect.exists || !inspect.running) {
    return;
  }
  const res = await runSafeChildProcess({
    executable: "docker",
    args: ["stop", "-t", String(timeoutSec), containerName],
    timeoutMs: (timeoutSec + 10) * 1000,
  });
  if (res.exitCode !== 0) {
    await runSafeChildProcess({
      executable: "docker",
      args: ["kill", containerName],
      timeoutMs: 10000,
    });
  }
}

export async function inspectContainerTechnicalDetails(
  containerName: string,
): Promise<ContainerTechnicalDetails> {
  const res = await runSafeChildProcess({
    executable: "docker",
    args: ["inspect", containerName],
    timeoutMs: 10000,
  });

  if (res.exitCode !== 0 || res.cancelled) {
    return {
      containerName,
      image: "unknown",
      status: "missing",
      running: false,
      ports: [],
      volumes: [],
      environment: [],
    };
  }

  try {
    const rawData = JSON.parse(res.stdout);
    const data = Array.isArray(rawData) ? rawData[0] : rawData;
    const image = data?.Config?.Image ?? "unknown";
    const digest = typeof data?.Image === "string" ? data.Image : undefined;
    const created =
      typeof data?.Created === "string" ? data.Created : undefined;
    const status = data?.State?.Status ?? "unknown";
    const running = Boolean(data?.State?.Running);

    const ports: string[] = [];
    const portBindings = data?.NetworkSettings?.Ports ?? {};
    for (const [containerPort, hostBindings] of Object.entries(portBindings)) {
      if (Array.isArray(hostBindings) && hostBindings.length > 0) {
        for (const b of hostBindings as Array<{
          HostIp: string;
          HostPort: string;
        }>) {
          ports.push(`${b.HostIp}:${b.HostPort} -> ${containerPort}`);
        }
      } else {
        ports.push(containerPort);
      }
    }

    const volumes: string[] = [];
    const mounts = data?.Mounts ?? [];
    if (Array.isArray(mounts)) {
      for (const m of mounts as Array<{
        Name?: string;
        Source?: string;
        Destination?: string;
      }>) {
        const name = m.Name ?? m.Source ?? "";
        const dest = m.Destination ?? "";
        volumes.push(`${name} -> ${dest}`);
      }
    }

    const environment: string[] = [];
    const envArr = data?.Config?.Env ?? [];
    if (Array.isArray(envArr)) {
      for (const item of envArr) {
        if (typeof item !== "string") continue;
        const eqIdx = item.indexOf("=");
        if (eqIdx === -1) {
          environment.push(item);
          continue;
        }
        const key = item.slice(0, eqIdx);
        const val = item.slice(eqIdx + 1);
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes("password") ||
          lowerKey.includes("secret") ||
          lowerKey.includes("pwd") ||
          lowerKey.includes("token")
        ) {
          environment.push(`${key}=***`);
        } else {
          environment.push(`${key}=${val}`);
        }
      }
    }

    return {
      containerName,
      image,
      digest,
      created,
      status,
      running,
      ports,
      volumes,
      environment,
    };
  } catch {
    return {
      containerName,
      image: "unknown",
      status: "parse-error",
      running: false,
      ports: [],
      volumes: [],
      environment: [],
    };
  }
}

export function findOrphanAppContainers(
  installations: InstallationRecord[],
): OrphanContainerSummary[] {
  const containers = detectAppContainers();
  const orphans: OrphanContainerSummary[] = [];

  for (const c of containers) {
    if (!c.appOwned) continue;
    const isTracked = installations.some(
      (r) => r.containerName === c.name || r.resources.container === c.name,
    );
    if (!isTracked) {
      orphans.push({
        id: c.id,
        name: c.name,
        image: c.image,
        state: c.state,
        status: c.status,
      });
    }
  }

  return orphans;
}

export async function cleanupOrphanContainer(
  containerName: string,
): Promise<void> {
  if (!containerName.startsWith(CONTAINER_PREFIX)) {
    throw new Error(`Cannot cleanup non-LogixZen container: ${containerName}`);
  }
  await removeAppContainer(containerName, false);
}

export async function restartAppContainer(
  containerName: string,
): Promise<void> {
  const res = await runSafeChildProcess({
    executable: "docker",
    args: ["restart", containerName],
    timeoutMs: 30000,
  });
  if (res.exitCode !== 0) {
    throw new Error(
      `Failed to restart container ${containerName}: ${res.stderr}`,
    );
  }
}

export async function removeAppContainer(
  containerName: string,
  removeVolume = false,
  volumeName?: string,
): Promise<void> {
  const inspect = await inspectContainer(containerName);
  if (inspect.exists) {
    if (inspect.running) {
      await stopAppContainer(containerName);
    }
    await runSafeChildProcess({
      executable: "docker",
      args: ["rm", "-f", containerName],
      timeoutMs: 20000,
    });
  }

  if (removeVolume && volumeName) {
    await runSafeChildProcess({
      executable: "docker",
      args: ["volume", "rm", volumeName],
      timeoutMs: 20000,
    });
  }
}

export async function verifyContainerConnection(
  optionId: EngineOptionId,
  port?: number,
  secret?: string,
): Promise<VerificationResult> {
  const now = new Date().toISOString();
  const containerName = defaultContainerName(optionId);
  const status = await inspectContainer(containerName);
  if (!status.exists) {
    return {
      ok: false,
      checkedAt: now,
      detail: `Container ${containerName} does not exist.`,
    };
  }
  if (!status.running) {
    return {
      ok: false,
      checkedAt: now,
      detail: `Container ${containerName} is stopped.`,
    };
  }

  try {
    if (optionId === "mssql-container") {
      const extraEnv: Record<string, string> = {};
      if (secret) extraEnv.SQLCMDPASSWORD = secret;

      const testCmd = await runSafeChildProcess({
        executable: "docker",
        args: [
          "exec",
          "-i",
          containerName,
          "/opt/mssql-tools18/bin/sqlcmd",
          "-S",
          "localhost",
          "-U",
          "logixzen_user",
          "-d",
          "LogixZenPractice",
          "-C",
          "-Q",
          "SELECT @@VERSION;",
        ],
        extraEnv,
        timeoutMs: 15000,
      });

      if (testCmd.exitCode === 0) {
        return {
          ok: true,
          checkedAt: now,
          detail: `Verified on port ${port ?? 1433}.`,
        };
      }
      return {
        ok: false,
        checkedAt: now,
        detail: testCmd.stderr || testCmd.stdout,
      };
    }

    if (optionId === "postgres-container") {
      const extraEnv: Record<string, string> = {};
      if (secret) extraEnv.PGPASSWORD = secret;

      const testCmd = await runSafeChildProcess({
        executable: "docker",
        args: [
          "exec",
          "-i",
          containerName,
          "psql",
          "-U",
          "logixzen",
          "-d",
          "LogixZenPractice",
          "-c",
          "SELECT version();",
        ],
        extraEnv,
        timeoutMs: 15000,
      });

      if (testCmd.exitCode === 0) {
        return {
          ok: true,
          checkedAt: now,
          detail: `Verified on port ${port ?? 5432}.`,
        };
      }
      return {
        ok: false,
        checkedAt: now,
        detail: testCmd.stderr || testCmd.stdout,
      };
    }

    if (optionId === "mysql-container") {
      const extraEnv: Record<string, string> = {};
      if (secret) extraEnv.MYSQL_PWD = secret;

      const testCmd = await runSafeChildProcess({
        executable: "docker",
        args: [
          "exec",
          "-i",
          containerName,
          "mysql",
          "-u",
          "logixzen",
          "LogixZenPractice",
          "-e",
          "SELECT VERSION();",
        ],
        extraEnv,
        timeoutMs: 15000,
      });

      if (testCmd.exitCode === 0) {
        return {
          ok: true,
          checkedAt: now,
          detail: `Verified on port ${port ?? 3306}.`,
        };
      }
      return {
        ok: false,
        checkedAt: now,
        detail: testCmd.stderr || testCmd.stdout,
      };
    }

    return {
      ok: false,
      checkedAt: now,
      detail: `Unsupported container option: ${optionId}`,
    };
  } catch (err) {
    return { ok: false, checkedAt: now, detail: String(err) };
  }
}

export async function executeContainerProvision(
  ctx: StageExecutionContext,
  setStage: (stageIndex: number) => void,
  snapshot: PlatformSnapshot,
): Promise<void> {
  const optionId = ctx.optionId;
  const entry = ENGINE_CATALOG.find((e) => e.id === optionId);
  if (!entry || entry.method !== "container" || !entry.container) {
    throw new Error(
      `Option ${optionId} is not a valid container catalog entry.`,
    );
  }

  const containerName = defaultContainerName(optionId);
  const volumeName = defaultVolumeName(optionId);
  const secretRef = `container:${optionId}:user`;
  const adminSecretRef = `container:${optionId}:admin`;

  setStage(0);
  ctx.updateProgress(
    { determinate: false },
    "Verifying container runtime readiness",
  );
  const readiness = probeContainerReadinessSync("docker", snapshot);
  if (readiness.state !== "ready") {
    throw new Error(`Docker is not ready (current state: ${readiness.state}).`);
  }

  const loaded = await loadInstallState();
  const existing = loaded.state.installations.find(
    (item) => item.optionId === optionId,
  );
  if (existing && existing.status === "ready") {
    const status = await inspectContainer(
      existing.containerName ?? containerName,
    );
    if (status.exists) {
      if (!status.running) {
        await startAppContainer(existing.containerName ?? containerName);
      }
      let secret: string | undefined;
      if (existing.secretRef) {
        try {
          secret = (await retrieveSecret(existing.secretRef)) ?? undefined;
        } catch {
          secret = undefined;
        }
      }
      const verify = await verifyContainerConnection(
        optionId,
        existing.port,
        secret,
      );
      if (verify.ok) {
        writeLog(
          "info",
          `Reusing existing verified container ${containerName}`,
        );
        for (let i = 1; i <= 7; i += 1) setStage(i);
        return;
      }
    }
  }

  setStage(1);
  await pullImageWithProgress(entry.container.image, entry.container.tag, ctx);

  setStage(2);
  ctx.updateProgress(
    { determinate: false },
    "Allocating loopback port and creating volume",
  );

  await createVolumeIfMissing(volumeName, ctx);

  const loopbackPort = await findFreeLoopbackPort(entry.container.port);
  const adminPassword = generateStrongCredential();
  const userPassword = generateStrongCredential();

  await storeSecret(adminSecretRef, adminPassword);
  await storeSecret(secretRef, userPassword);

  const envLines: string[] = [];
  if (optionId === "mssql-container") {
    envLines.push("ACCEPT_EULA=Y");
    envLines.push("MSSQL_PID=Express");
    envLines.push(`MSSQL_SA_PASSWORD=${adminPassword}`);
  } else if (optionId === "postgres-container") {
    envLines.push("POSTGRES_USER=logixzen");
    envLines.push(`POSTGRES_PASSWORD=${userPassword}`);
    envLines.push("POSTGRES_DB=LogixZenPractice");
  } else if (optionId === "mysql-container") {
    envLines.push("MYSQL_USER=logixzen");
    envLines.push(`MYSQL_PASSWORD=${userPassword}`);
    envLines.push(`MYSQL_ROOT_PASSWORD=${adminPassword}`);
    envLines.push("MYSQL_DATABASE=LogixZenPractice");
  }

  const tempEnvFile = join(
    tempDir(),
    `container-env-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.env`,
  );
  writeFileSync(tempEnvFile, `${envLines.join("\n")}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  try {
    const existingContainer = await inspectContainer(containerName);
    if (existingContainer.exists) {
      await removeAppContainer(containerName, false);
    }

    const runArgs = [
      "run",
      "-d",
      "--name",
      containerName,
      "--restart",
      "unless-stopped",
      "-p",
      `127.0.0.1:${loopbackPort}:${entry.container.port}`,
      "-v",
      `${volumeName}:${entry.container.volumePath}`,
      "--env-file",
      tempEnvFile,
      `${entry.container.image}:${entry.container.tag}`,
    ];

    const runRes = await runSafeChildProcess({
      executable: "docker",
      args: runArgs,
      timeoutMs: 60000,
    });

    if (runRes.exitCode !== 0) {
      const logs = await getContainerLogTail(containerName);
      throw new Error(
        `Failed to create container ${containerName}: ${runRes.stderr || runRes.stdout}\n${logs}`,
      );
    }

    await ctx.recordResource("container", containerName);
  } finally {
    if (existsSync(tempEnvFile)) {
      try {
        unlinkSync(tempEnvFile);
      } catch {}
    }
  }

  setStage(3);
  ctx.updateProgress(
    { determinate: false },
    `Started container ${containerName}`,
  );

  setStage(4);
  ctx.updateProgress(
    { determinate: false },
    `Waiting for readiness on 127.0.0.1:${loopbackPort}`,
  );
  const isReady = await waitForContainerReady(loopbackPort, 60000, ctx.signal);
  if (!isReady) {
    const logs = await getContainerLogTail(containerName);
    throw new Error(
      `Container ${containerName} failed to become ready on port ${loopbackPort} within 60s.\n${logs}`,
    );
  }

  setStage(5);
  ctx.updateProgress(
    { determinate: false },
    "Initializing practice database, login, and schema",
  );

  let serverVersion = "unknown";
  if (optionId === "mssql-container") {
    const initSql = [
      "IF DB_ID(N'LogixZenPractice') IS NULL CREATE DATABASE [LogixZenPractice];",
      `IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'logixzen_user') CREATE LOGIN [logixzen_user] WITH PASSWORD = N'${userPassword}', CHECK_POLICY = OFF;`,
      "USE [LogixZenPractice];",
      "IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'logixzen_user') CREATE USER [logixzen_user] FOR LOGIN [logixzen_user];",
      "ALTER ROLE [db_datareader] ADD MEMBER [logixzen_user];",
      "ALTER ROLE [db_datawriter] ADD MEMBER [logixzen_user];",
      "ALTER ROLE [db_ddladmin] ADD MEMBER [logixzen_user];",
      "USE [master];",
      "GRANT CREATE ANY DATABASE TO [logixzen_user];",
      "USE [LogixZenPractice];",
      markerStatement("tsql"),
    ].join("\n");

    const initRes = await runSafeChildProcess({
      executable: "docker",
      args: [
        "exec",
        "-i",
        containerName,
        "/opt/mssql-tools18/bin/sqlcmd",
        "-S",
        "localhost",
        "-U",
        "sa",
        "-C",
        "-Q",
        initSql,
      ],
      extraEnv: { SQLCMDPASSWORD: adminPassword },
      timeoutMs: 30000,
    });

    if (initRes.exitCode !== 0) {
      throw new Error(
        `Failed to initialize SQL Server container: ${initRes.stderr || initRes.stdout}`,
      );
    }

    const verRes = await runSafeChildProcess({
      executable: "docker",
      args: [
        "exec",
        "-i",
        containerName,
        "/opt/mssql-tools18/bin/sqlcmd",
        "-S",
        "localhost",
        "-U",
        "sa",
        "-C",
        "-Q",
        "SELECT @@VERSION;",
      ],
      extraEnv: { SQLCMDPASSWORD: adminPassword },
      timeoutMs: 15000,
    });
    serverVersion =
      verRes.stdout.trim().split(/\r?\n/)[0] ?? "Microsoft SQL Server Express";
  } else if (optionId === "postgres-container") {
    const initRes = await runSafeChildProcess({
      executable: "docker",
      args: [
        "exec",
        "-i",
        containerName,
        "psql",
        "-U",
        "logixzen",
        "-d",
        "LogixZenPractice",
        "-c",
        markerStatement("postgres"),
      ],
      extraEnv: { PGPASSWORD: userPassword },
      timeoutMs: 30000,
    });

    if (initRes.exitCode !== 0) {
      throw new Error(
        `Failed to initialize PostgreSQL container: ${initRes.stderr || initRes.stdout}`,
      );
    }

    const verRes = await runSafeChildProcess({
      executable: "docker",
      args: [
        "exec",
        "-i",
        containerName,
        "psql",
        "-U",
        "logixzen",
        "-d",
        "LogixZenPractice",
        "-c",
        "SELECT version();",
      ],
      extraEnv: { PGPASSWORD: userPassword },
      timeoutMs: 15000,
    });
    serverVersion =
      verRes.stdout.trim().split(/\r?\n/)[2]?.trim() ?? "PostgreSQL 17";
  } else if (optionId === "mysql-container") {
    const initRes = await runSafeChildProcess({
      executable: "docker",
      args: [
        "exec",
        "-i",
        containerName,
        "mysql",
        "-u",
        "root",
        "-e",
        `GRANT ALL PRIVILEGES ON *.* TO 'logixzen'@'%'; FLUSH PRIVILEGES; USE LogixZenPractice; ${markerStatement("mysql")}`,
      ],
      extraEnv: { MYSQL_PWD: adminPassword },
      timeoutMs: 30000,
    });

    if (initRes.exitCode !== 0) {
      throw new Error(
        `Failed to initialize MySQL container: ${initRes.stderr || initRes.stdout}`,
      );
    }

    const verRes = await runSafeChildProcess({
      executable: "docker",
      args: [
        "exec",
        "-i",
        containerName,
        "mysql",
        "-u",
        "logixzen",
        "LogixZenPractice",
        "-e",
        "SELECT VERSION();",
      ],
      extraEnv: { MYSQL_PWD: userPassword },
      timeoutMs: 15000,
    });
    serverVersion =
      verRes.stdout.trim().split(/\r?\n/)[1]?.trim() ?? "MySQL 8.4";
  }

  setStage(6);
  ctx.updateProgress(
    { determinate: false },
    "Verifying connection with learner credentials",
  );
  const verification = await verifyContainerConnection(
    optionId,
    loopbackPort,
    userPassword,
  );
  if (!verification.ok) {
    await updateInstallationStatus(optionId, "needs-repair", {
      ok: false,
      checkedAt: new Date().toISOString(),
      detail: verification.detail,
    });
    throw new Error(
      verification.detail ?? `Connection verification failed for ${optionId}`,
    );
  }

  setStage(7);
  const now = new Date().toISOString();
  const record: InstallationRecord = {
    optionId,
    engine: entry.engine,
    method: "container",
    variant: {
      displayName: entry.displayName,
      publisher: entry.publisher,
      purpose: entry.purpose,
      technicalName: entry.advancedName,
      dialect: entry.dialect,
    },
    status: "ready",
    installedVersion: serverVersion,
    containerName,
    port: loopbackPort,
    dataLocation: volumeName,
    practiceSchemaVersion: 1,
    secretRef,
    createdAt: now,
    updatedAt: now,
    lastVerification: {
      ok: true,
      checkedAt: now,
      detail: `Verified on 127.0.0.1:${loopbackPort}.`,
    },
    resources: {
      container: containerName,
      volume: volumeName,
    },
  };

  await updateInstallation(record);
  ctx.updateProgress(
    { determinate: false },
    `Container ${containerName} ready on port ${loopbackPort}`,
  );
}
