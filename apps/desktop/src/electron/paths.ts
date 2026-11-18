import { app } from "electron";
import os from "node:os";
import { join } from "node:path";

function userDataPath(): string {
  if (app && typeof app.getPath === "function") {
    try {
      return app.getPath("userData");
    } catch {}
  }
  return join(process.cwd(), ".data");
}

function runtimeTempPath(): string {
  if (app && typeof app.getPath === "function") {
    try {
      return app.getPath("temp");
    } catch {}
  }
  return os.tmpdir();
}

export function dataDir(): string {
  return join(userDataPath(), "data");
}

export function practiceDir(): string {
  return join(dataDir(), "practice");
}

export function backupsDir(): string {
  return join(dataDir(), "backups");
}

export function stagingDir(): string {
  return join(dataDir(), "staging");
}

export function logsDir(): string {
  return join(dataDir(), "logs");
}

export function tempDir(): string {
  return runtimeTempPath();
}

export function sqlitePracticeFile(): string {
  return join(practiceDir(), "sqlite", "practice.db");
}

export function stateFile(): string {
  return join(dataDir(), "state", "installations.json");
}

export function stateBackupFile(): string {
  return `${stateFile()}.bak`;
}
