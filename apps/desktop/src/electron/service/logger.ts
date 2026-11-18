import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  appendFileSync,
} from "node:fs";
import { join } from "node:path";
import { shell } from "electron";
import { logsDir } from "../paths";
import { currentSnapshot } from "../platform/snapshot";
import { loadInstallState } from "../state/store";
import type { DiagnosticsSummary, LogFileSummary } from "../../shared/engines";

const MAX_LOG_SIZE = 5 * 1024 * 1024;
const MAX_BACKUP_FILES = 5;

const REDACTION_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  {
    pattern: /(password\s*[:=]\s*)([^\s,;'"]+)/gi,
    replacement: "$1[REDACTED]",
  },
  { pattern: /(pwd\s*[:=]\s*)([^\s,;'"]+)/gi, replacement: "$1[REDACTED]" },
  { pattern: /(token\s*[:=]\s*)([^\s,;'"]+)/gi, replacement: "$1[REDACTED]" },
  {
    pattern: /(secret\s*[:=]\s*)(?!\w+\s*=)([^\s,;'"]+)/gi,
    replacement: "$1[REDACTED]",
  },
  { pattern: /(bearer\s+)([a-zA-Z0-9_\-.]+)/gi, replacement: "$1[REDACTED]" },
  { pattern: /(MSSQL_SA_PASSWORD=)([^\s]+)/g, replacement: "$1[REDACTED]" },
  { pattern: /(POSTGRES_PASSWORD=)([^\s]+)/g, replacement: "$1[REDACTED]" },
  { pattern: /(MYSQL_ROOT_PASSWORD=)([^\s]+)/g, replacement: "$1[REDACTED]" },
  {
    pattern: /([a-zA-Z]+:\/\/[^:]+:)([^@]+)(@)/g,
    replacement: "$1[REDACTED]$3",
  },
];

export function redactText(text: string): string {
  let result = text;
  for (const { pattern, replacement } of REDACTION_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function rotateIfNeeded(filePath: string): void {
  if (!existsSync(filePath)) return;
  try {
    const stats = statSync(filePath);
    if (stats.size < MAX_LOG_SIZE) return;
    for (let index = MAX_BACKUP_FILES - 1; index >= 1; index -= 1) {
      const from = `${filePath}.${index}`;
      const to = `${filePath}.${index + 1}`;
      if (existsSync(from)) {
        if (index === MAX_BACKUP_FILES - 1 && existsSync(to)) unlinkSync(to);
        renameSync(from, to);
      }
    }
    renameSync(filePath, `${filePath}.1`);
  } catch {}
}

function appendLog(filePath: string, line: string): void {
  try {
    rotateIfNeeded(filePath);
    appendFileSync(filePath, line, "utf8");
  } catch {}
}

export type LogLevel = "info" | "warn" | "error" | "debug";

export function writeLog(
  level: LogLevel,
  message: string,
  context?: { jobId?: string; stage?: string },
): void {
  const root = logsDir();
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const time = new Date().toISOString();
  const safeMessage = redactText(message);
  const jobTag = context?.jobId ? ` [job:${context.jobId}]` : "";
  const stageTag = context?.stage ? ` [stage:${context.stage}]` : "";
  const line = `[${time}] [${level.toUpperCase()}]${jobTag}${stageTag} ${safeMessage}\n`;

  const mainLog = join(root, "app.log");
  appendLog(mainLog, line);

  if (context?.jobId) {
    const jobsDir = join(root, "jobs");
    mkdirSync(jobsDir, { recursive: true, mode: 0o700 });
    const jobLog = join(jobsDir, `${context.jobId}.log`);
    appendLog(jobLog, line);
  }
}

export function listLogFiles(): LogFileSummary[] {
  const root = logsDir();
  if (!existsSync(root)) return [];
  const results: LogFileSummary[] = [];

  function collect(dir: string, prefix = ""): void {
    if (!existsSync(dir)) return;
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        collect(full, relative);
      } else if (entry.isFile() && entry.name.endsWith(".log")) {
        const stats = statSync(full);
        results.push({
          name: relative,
          sizeBytes: stats.size,
          updatedAt: stats.mtime.toISOString(),
        });
      }
    }
  }

  collect(root);
  return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function tailLogFile(name: string, lines = 100): string[] {
  const root = logsDir();
  const safePath = join(root, name);
  if (!safePath.startsWith(root) || !existsSync(safePath)) return [];
  try {
    const content = readFileSync(safePath, "utf8");
    const rawLines = content.split("\n");
    if (rawLines.length > 0 && rawLines[rawLines.length - 1] === "")
      rawLines.pop();
    const count = Math.min(Math.max(lines, 1), 1000);
    return rawLines.slice(-count).map((l) => redactText(l));
  } catch {
    return [];
  }
}

export async function openLogsFolder(): Promise<void> {
  const root = logsDir();
  mkdirSync(root, { recursive: true, mode: 0o700 });
  await shell.openPath(root);
}

export async function getDiagnosticsSummary(): Promise<DiagnosticsSummary> {
  const snapshot = currentSnapshot();
  const loaded = await loadInstallState();
  const logs = listLogFiles();

  return {
    platform: {
      osFamily: snapshot.osFamily,
      arch: snapshot.arch,
      osVersion: snapshot.osVersion,
      totalMemoryBytes: snapshot.totalMemoryBytes,
    },
    activeEngine: loaded.state.activeOptionId ?? null,
    installedCount: loaded.state.installations.length,
    readyCount: loaded.state.installations.filter((i) => i.status === "ready")
      .length,
    issues: loaded.issues,
    logCount: logs.length,
  };
}
