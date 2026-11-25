import os from "node:os";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { EngineOptionId } from "../../shared/engines";

export function getEnginesRootDir(): string {
  if (process.env.LOGIXZEN_ENGINES_DIR) {
    return process.env.LOGIXZEN_ENGINES_DIR;
  }
  const platform = process.platform;
  if (platform === "win32") {
    const localAppData =
      process.env.LOCALAPPDATA ||
      join(os.homedir(), "AppData", "Local");
    return join(localAppData, "LogixZen", "engines");
  }
  if (platform === "darwin") {
    return join(
      os.homedir(),
      "Library",
      "Application Support",
      "LogixZen",
      "engines",
    );
  }
  const xdgData =
    process.env.XDG_DATA_HOME ||
    join(os.homedir(), ".local", "share");
  return join(xdgData, "LogixZen", "engines");
}

export function getCatalogDir(): string {
  return join(getEnginesRootDir(), "catalog");
}

export function getDownloadsDir(): string {
  return join(getEnginesRootDir(), "downloads");
}

export function getPacksDir(engineId: EngineOptionId, version: string): string {
  return join(getEnginesRootDir(), "packs", engineId, version);
}

export function getInstanceDir(engineId: EngineOptionId): string {
  return join(getEnginesRootDir(), "instances", engineId);
}

export function getInstanceDataDir(engineId: EngineOptionId): string {
  return join(getInstanceDir(engineId), "data");
}

export function getInstanceConfigDir(engineId: EngineOptionId): string {
  return join(getInstanceDir(engineId), "config");
}

export function getInstanceLogsDir(engineId: EngineOptionId): string {
  return join(getInstanceDir(engineId), "logs");
}

export function getRegistryPath(): string {
  return join(getEnginesRootDir(), "registry.json");
}

export function getPidFilePath(engineId: EngineOptionId): string {
  return join(getInstanceDir(engineId), "engine.pid");
}

export function ensureDirectory(dirPath: string): string {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

export function ensureEngineInstanceDirs(engineId: EngineOptionId): {
  instanceDir: string;
  dataDir: string;
  configDir: string;
  logsDir: string;
} {
  return {
    instanceDir: ensureDirectory(getInstanceDir(engineId)),
    dataDir: ensureDirectory(getInstanceDataDir(engineId)),
    configDir: ensureDirectory(getInstanceConfigDir(engineId)),
    logsDir: ensureDirectory(getInstanceLogsDir(engineId)),
  };
}
