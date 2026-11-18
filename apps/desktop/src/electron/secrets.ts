import { app, safeStorage } from "electron";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

function secretsFile(): string {
  return join(app.getPath("userData"), "secrets.json");
}

function readAll(): Record<string, string> {
  try {
    const raw = readFileSync(secretsFile(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
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
  const file = secretsFile();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(entries, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

export function secretStorageAvailable(): Promise<boolean> {
  if (
    !safeStorage ||
    typeof safeStorage.isAsyncEncryptionAvailable !== "function"
  ) {
    return Promise.resolve(false);
  }
  return safeStorage.isAsyncEncryptionAvailable();
}

function requireEncryption(): void {
  if (safeStorage && typeof safeStorage.isEncryptionAvailable === "function") {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error(
        "OS encryption is unavailable; secrets cannot be stored on this machine.",
      );
    }
  }
}

export function storeSecret(key: string, value: string): void {
  requireEncryption();
  const entries = readAll();
  if (safeStorage && typeof safeStorage.encryptString === "function") {
    entries[key] = safeStorage.encryptString(value).toString("base64");
  } else {
    entries[key] = Buffer.from(value).toString("base64");
  }
  writeAll(entries);
}

export function retrieveSecret(key: string): string | null {
  const entries = readAll();
  const encoded = entries[key];
  if (encoded === undefined) {
    return null;
  }

  requireEncryption();
  if (safeStorage && typeof safeStorage.decryptString === "function") {
    return safeStorage.decryptString(Buffer.from(encoded, "base64"));
  }
  return Buffer.from(encoded, "base64").toString("utf8");
}

export function deleteSecret(key: string): void {
  const entries = readAll();
  delete entries[key];
  writeAll(entries);
}
