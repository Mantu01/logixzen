import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, isAbsolute, normalize } from "node:path";
import { stagingDir } from "../paths";
import { redactText, writeLog } from "./logger";

const ALLOWED_BINARIES = new Set([
  "docker",
  "docker.exe",
  "podman",
  "podman.exe",
  "sqllocaldb",
  "sqllocaldb.exe",
  "systemctl",
  "powershell",
  "powershell.exe",
  "pwsh",
  "pwsh.exe",
  "cmd",
  "cmd.exe",
  "net",
  "net.exe",
  "sc",
  "sc.exe",
  "msiexec",
  "msiexec.exe",
  "sqlcmd",
  "sqlcmd.exe",
  "ping",
  "ping.exe",
  "pkexec",
  "sudo",
  "apt-get",
  "apt-cache",
  "dnf",
  "rpm",
  "dpkg",
  "mssql-conf",
  "curl",
  "gpg",
  "tee",
]);

const ALLOWED_ENV_KEYS = [
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "SYSTEMDRIVE",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "HOME",
  "APPDATA",
  "LOCALAPPDATA",
  "LANG",
  "LC_ALL",
  "PROGRAMDATA",
  "PROGRAMFILES",
  "PROGRAMFILES(X86)",
  "COMSPEC",
];

const ALLOWED_EXTRA_ENV_KEYS = new Set([
  "ACCEPT_EULA",
  "MSSQL_PID",
  "MSSQL_SA_PASSWORD",
  "MSSQL_TCP_PORT",
  "SQLCMDPASSWORD",
  "DEBIAN_FRONTEND",
  "PGPASSWORD",
  "POSTGRES_PASSWORD",
  "MYSQL_PWD",
  "MYSQL_PASSWORD",
  "MYSQL_ROOT_PASSWORD",
]);

const MAX_OUTPUT_BYTES = 1024 * 1024;

export interface RunCommandSpec {
  executable: string;
  args: string[];
  cwd?: string;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  jobId?: string;
  stage?: string;
  extraEnv?: Record<string, string>;
  onStdoutChunk?: (chunk: string) => void;
}

export interface RunCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  cancelled: boolean;
}

function resolveExecutable(candidate: string): string | null {
  const normalized = normalize(candidate);
  if (isAbsolute(normalized)) {
    const staging = stagingDir();
    if (normalized.startsWith(staging) && existsSync(normalized)) {
      return normalized;
    }
    const base = basename(normalized).toLowerCase();
    if (ALLOWED_BINARIES.has(base)) {
      return normalized;
    }
    return null;
  }
  const lower = normalized.toLowerCase();
  if (ALLOWED_BINARIES.has(lower)) {
    return normalized;
  }
  return null;
}

function buildSafeEnv(extraEnv?: Record<string, string>): NodeJS.ProcessEnv {
  const safe: Record<string, string | undefined> = {};
  for (const key of ALLOWED_ENV_KEYS) {
    const value = process.env[key];
    if (value !== undefined) safe[key] = value;
  }
  if (extraEnv) {
    for (const [key, value] of Object.entries(extraEnv)) {
      if (ALLOWED_EXTRA_ENV_KEYS.has(key)) {
        safe[key] = value;
      }
    }
  }
  return safe as NodeJS.ProcessEnv;
}

export function killProcessTree(pid: number): void {
  if (process.platform === "win32") {
    try {
      const killer = spawn(
        "taskkill.exe",
        ["/pid", pid.toString(), "/T", "/F"],
        {
          windowsHide: true,
          stdio: "ignore",
        },
      );
      killer.on("error", () => undefined);
    } catch {}
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      try {
        process.kill(pid, "SIGKILL");
      } catch {}
    }
  }
}

export async function runSafeChildProcess(
  spec: RunCommandSpec,
): Promise<RunCommandResult> {
  const binary = resolveExecutable(spec.executable);
  if (binary === null) {
    writeLog("error", `Blocked disallowed executable: ${spec.executable}`, {
      jobId: spec.jobId,
      stage: spec.stage,
    });
    throw new Error(
      `Executable is not permitted or cannot be resolved: ${spec.executable}`,
    );
  }

  writeLog("info", `Starting process: ${binary} ${spec.args.join(" ")}`, {
    jobId: spec.jobId,
    stage: spec.stage,
  });

  return new Promise<RunCommandResult>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let cancelled = false;
    let timer: NodeJS.Timeout | null = null;
    let childProcess: ChildProcess;

    function cleanup(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (spec.abortSignal) {
        spec.abortSignal.removeEventListener("abort", onAbort);
      }
    }

    function onAbort(): void {
      cancelled = true;
      writeLog("warn", "Execution aborted by signal; killing process tree", {
        jobId: spec.jobId,
        stage: spec.stage,
      });
      if (childProcess.pid) {
        killProcessTree(childProcess.pid);
        try {
          childProcess.kill("SIGKILL");
        } catch {}
      }
    }

    try {
      childProcess = spawn(binary, spec.args, {
        shell: false,
        env: buildSafeEnv(spec.extraEnv),
        cwd: spec.cwd,
        windowsHide: true,
      });
    } catch (err) {
      cleanup();
      writeLog("error", `Failed to spawn process: ${String(err)}`, {
        jobId: spec.jobId,
        stage: spec.stage,
      });
      reject(err);
      return;
    }

    if (spec.abortSignal) {
      if (spec.abortSignal.aborted) {
        onAbort();
      } else {
        spec.abortSignal.addEventListener("abort", onAbort);
      }
    }

    if (spec.timeoutMs !== undefined && spec.timeoutMs > 0) {
      timer = setTimeout(() => {
        cancelled = true;
        writeLog(
          "warn",
          `Process timed out after ${spec.timeoutMs}ms; killing tree`,
          {
            jobId: spec.jobId,
            stage: spec.stage,
          },
        );
        if (childProcess.pid) killProcessTree(childProcess.pid);
      }, spec.timeoutMs);
    }

    childProcess.stdout?.on("data", (chunk: Buffer) => {
      if (stdoutBytes < MAX_OUTPUT_BYTES) {
        const text = chunk.toString("utf8");
        stdout += text;
        stdoutBytes += chunk.length;
        if (spec.onStdoutChunk) {
          try {
            spec.onStdoutChunk(text);
          } catch {}
        }
      }
    });

    childProcess.stderr?.on("data", (chunk: Buffer) => {
      if (stderrBytes < MAX_OUTPUT_BYTES) {
        const text = chunk.toString("utf8");
        stderr += text;
        stderrBytes += chunk.length;
      }
    });

    childProcess.on("error", (err) => {
      cleanup();
      writeLog("error", `Process error: ${String(err)}`, {
        jobId: spec.jobId,
        stage: spec.stage,
      });
      reject(err);
    });

    childProcess.on("close", (code) => {
      cleanup();
      const exitCode = code ?? (cancelled ? 1 : 0);
      writeLog(
        cancelled ? "warn" : exitCode === 0 ? "info" : "error",
        `Process finished with code ${exitCode}`,
        { jobId: spec.jobId, stage: spec.stage },
      );
      resolve({
        exitCode,
        stdout: redactText(stdout),
        stderr: redactText(stderr),
        cancelled,
      });
    });
  });
}
