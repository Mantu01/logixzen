import { randomBytes } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const PASSWORD_ALPHABET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateSecret(length = 28): string {
  const bytes = randomBytes(length);
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += PASSWORD_ALPHABET[bytes[index]! % PASSWORD_ALPHABET.length];
  }
  return value;
}

export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function waitFor(
  check: () => Promise<boolean>,
  attempts = 60,
  intervalMs = 500,
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await check()) {
      return true;
    }
    await delay(intervalMs);
  }
  return false;
}

export function findExecutable(
  root: string,
  name: string,
  depth = 3,
): string | null {
  const fileName = process.platform === "win32" ? `${name}.exe` : name;
  const search = (dir: string, remaining: number): string | null => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return null;
    }
    if (entries.includes(fileName)) {
      const candidate = join(dir, fileName);
      try {
        if (statSync(candidate).isFile()) return candidate;
      } catch {}
    }
    if (remaining === 0) return null;
    for (const entry of entries) {
      const child = join(dir, entry);
      try {
        if (!statSync(child).isDirectory()) continue;
      } catch {
        continue;
      }
      const found = search(child, remaining - 1);
      if (found !== null) return found;
    }
    return null;
  };
  return search(root, depth);
}

export function packRoot(root: string): string {
  const search = (dir: string, remaining: number): string => {
    try {
      const entries = readdirSync(dir);
      if (entries.includes("bin")) return dir;
      if (remaining === 0) return dir;
      for (const entry of entries) {
        const child = join(dir, entry);
        try {
          if (!statSync(child).isDirectory()) continue;
        } catch {
          continue;
        }
        if (readdirSync(child).includes("bin")) return child;
      }
    } catch {}
    return dir;
  };
  return search(root, 1);
}
