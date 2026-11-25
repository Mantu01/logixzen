import { exec, spawn, type ChildProcess } from "node:child_process";
import {
  closeSync,
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import { join } from "node:path";
import {
  getInstanceLogsDir,
  getPidFilePath,
  ensureEngineInstanceDirs,
  getEnginesRootDir,
} from "./paths";
import type { EngineOptionId } from "../../shared/engines";

const MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024;
const GRACEFUL_TIMEOUT_MS = 15000;

export async function findFreePort(preferredPort?: number): Promise<number> {
  if (preferredPort && preferredPort > 1024) {
    const isFree = await new Promise<boolean>((resolve) => {
      const server = net.createServer();
      server.unref();
      server.on("error", () => resolve(false));
      server.listen(preferredPort, "127.0.0.1", () => {
        server.close(() => resolve(true));
      });
    });
    if (isFree) {
      return preferredPort;
    }
  }

  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (typeof addr === "object" && addr !== null) {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error("Failed to get port from OS")));
      }
    });
  });
}

export function killProcessTree(pid: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (process.platform === "win32") {
      exec(`taskkill /F /T /PID ${pid}`, { windowsHide: true }, () => {
        resolve();
      });
    } else {
      try {
        process.kill(-pid, "SIGKILL");
        resolve();
      } catch {
        try {
          process.kill(pid, "SIGKILL");
        } catch {}
        resolve();
      }
    }
  });
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function getEnginePid(engineId: EngineOptionId): number | null {
  const pidFile = getPidFilePath(engineId);
  if (!existsSync(pidFile)) {
    return null;
  }
  try {
    const text = readFileSync(pidFile, "utf8").trim();
    const pid = parseInt(text, 10);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

export function saveEnginePid(engineId: EngineOptionId, pid: number): void {
  ensureEngineInstanceDirs(engineId);
  writeFileSync(getPidFilePath(engineId), String(pid), "utf8");
}

export function clearEnginePid(engineId: EngineOptionId): void {
  const pidFile = getPidFilePath(engineId);
  if (existsSync(pidFile)) {
    try {
      unlinkSync(pidFile);
    } catch {}
  }
}

export async function recoverCrashLeftovers(): Promise<void> {
  const root = getEnginesRootDir();
  const instancesDir = join(root, "instances");
  if (!existsSync(instancesDir)) {
    return;
  }
  const entries = readdirSync(instancesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const engineId = entry.name as EngineOptionId;
      const pid = getEnginePid(engineId);
      if (pid !== null) {
        if (isProcessRunning(pid)) {
          await killProcessTree(pid);
        }
        clearEnginePid(engineId);
      }
    }
  }
}

export class EngineLogRotator {
  private logPath: string;

  constructor(engineId: EngineOptionId) {
    ensureEngineInstanceDirs(engineId);
    this.logPath = join(getInstanceLogsDir(engineId), "engine.log");
  }

  public write(data: string): void {
    try {
      if (existsSync(this.logPath)) {
        const stats = statSync(this.logPath);
        if (stats.size > MAX_LOG_SIZE_BYTES) {
          const backup = `${this.logPath}.1`;
          if (existsSync(backup)) {
            unlinkSync(backup);
          }
          renameSync(this.logPath, backup);
        }
      }
      const fd = openSync(this.logPath, "a");
      writeFileSync(fd, data, "utf8");
      closeSync(fd);
    } catch {}
  }

  public getLogPath(): string {
    return this.logPath;
  }
}

export interface RunningEngineProcess {
  engineId: EngineOptionId;
  pid: number;
  process: ChildProcess;
  port: number;
  logRotator: EngineLogRotator;
}

export class EngineSupervisor {
  private currentRunning: RunningEngineProcess | null = null;

  public getRunning(): RunningEngineProcess | null {
    if (this.currentRunning !== null) {
      if (!isProcessRunning(this.currentRunning.pid)) {
        clearEnginePid(this.currentRunning.engineId);
        this.currentRunning = null;
      }
    }
    return this.currentRunning;
  }

  public isRunning(engineId: EngineOptionId): boolean {
    const r = this.getRunning();
    return r !== null && r.engineId === engineId;
  }

  public spawnEngineProcess(options: {
    engineId: EngineOptionId;
    executable: string;
    args: string[];
    cwd: string;
    env?: Record<string, string>;
    port: number;
  }): RunningEngineProcess {
    ensureEngineInstanceDirs(options.engineId);
    const logRotator = new EngineLogRotator(options.engineId);

    logRotator.write(
      `\n[${new Date().toISOString()}] Starting ${options.engineId}: ${options.executable} ${options.args.join(" ")}\n`,
    );

    const child = spawn(options.executable, options.args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env,
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (!child.pid) {
      throw new Error(`Failed to start process for ${options.engineId}`);
    }

    const pid = child.pid;
    saveEnginePid(options.engineId, pid);

    child.stdout?.on("data", (chunk: Buffer) => {
      logRotator.write(chunk.toString("utf8"));
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      logRotator.write(chunk.toString("utf8"));
    });

    child.on("exit", (code, signal) => {
      logRotator.write(
        `\n[${new Date().toISOString()}] Process ${options.engineId} (PID ${pid}) exited with code ${code}, signal ${signal}\n`,
      );
      clearEnginePid(options.engineId);
      if (this.currentRunning?.pid === pid) {
        this.currentRunning = null;
      }
    });

    const running: RunningEngineProcess = {
      engineId: options.engineId,
      pid,
      process: child,
      port: options.port,
      logRotator,
    };

    this.currentRunning = running;
    return running;
  }

  public async stopCurrent(gracefulStopFn?: () => Promise<void>): Promise<void> {
    const running = this.getRunning();
    if (running === null) {
      return;
    }

    const pid = running.pid;
    const engineId = running.engineId;

    if (gracefulStopFn) {
      try {
        const stopPromise = gracefulStopFn();
        const timeoutPromise = new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), GRACEFUL_TIMEOUT_MS),
        );
        const stoppedGracefully = await Promise.race([
          stopPromise.then(() => true),
          timeoutPromise,
        ]);
        if (stoppedGracefully) {
          clearEnginePid(engineId);
          this.currentRunning = null;
          return;
        }
      } catch {}
    }

    if (isProcessRunning(pid)) {
      await killProcessTree(pid);
    }

    clearEnginePid(engineId);
    this.currentRunning = null;
  }
}

export const supervisor = new EngineSupervisor();
