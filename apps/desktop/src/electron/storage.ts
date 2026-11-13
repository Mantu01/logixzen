import { app } from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

function storageFile(): string {
  return join(app.getPath("userData"), "storage.json");
}

function readAll(): Record<string, string> {
  try {
    const raw = readFileSync(storageFile(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const entries: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        entries[key] = value;
      }
    }
    return entries;
  } catch {
    return {};
  }
}

function writeAll(entries: Record<string, string>): void {
  const file = storageFile();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

export function getStoredValue(key: string): string | null {
  const entries = readAll();
  return Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : null;
}

export function setStoredValue(key: string, value: string): void {
  const entries = readAll();
  entries[key] = value;
  writeAll(entries);
}

export function deleteStoredValue(key: string): void {
  const entries = readAll();
  delete entries[key];
  writeAll(entries);
}

export function getAllStoredValues(): Record<string, string> {
  return readAll();
}
