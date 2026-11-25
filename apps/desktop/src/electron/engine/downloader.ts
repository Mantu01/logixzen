import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  renameSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { statfs } from "node:fs/promises";
import https from "node:https";
import type { IncomingMessage } from "node:http";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { ensureDirectory, getDownloadsDir } from "./paths";
import type { EngineArtifact } from "./catalog";
import type { EngineOptionId } from "../../shared/engines";

export interface DownloadProgress {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

const MAX_REDIRECTS = 5;
const IDLE_TIMEOUT_MS = 60_000;
const ATTEMPTS = 3;

export async function checkDiskSpace(
  targetDir: string,
  requiredBytes: number,
): Promise<boolean> {
  try {
    ensureDirectory(targetDir);
    const stats = await statfs(targetDir);
    return stats.bavail * stats.bsize >= requiredBytes;
  } catch {
    return true;
  }
}

export function computeFileSha256(filePath: string): Promise<string> {
  return new Promise<string>((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex").toLowerCase()));
    stream.on("error", reject);
  });
}

function openStream(
  url: string,
  startBytes: number,
  signal: AbortSignal,
  redirects = 0,
): Promise<IncomingMessage> {
  return new Promise<IncomingMessage>((resolveResponse, reject) => {
    const headers: Record<string, string> = {
      "User-Agent": "LogixZenDesktop/1.0",
      "Accept-Encoding": "identity",
    };
    if (startBytes > 0) {
      headers.Range = `bytes=${startBytes}-`;
    }

    const request = https.get(url, { headers }, (response) => {
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      if (status >= 300 && status < 400 && location && redirects < MAX_REDIRECTS) {
        response.resume();
        openStream(
          new URL(location, url).toString(),
          startBytes,
          signal,
          redirects + 1,
        ).then(resolveResponse, reject);
        return;
      }
      if (status >= 300 && status < 400) {
        response.resume();
        reject(new Error(`Too many redirects while downloading ${url}.`));
        return;
      }
      if (status !== 200 && status !== 206 && status !== 416) {
        response.resume();
        reject(new Error(`Download failed with HTTP ${status}.`));
        return;
      }
      response.setTimeout(IDLE_TIMEOUT_MS, () => {
        response.destroy(new Error("Download stalled. Check the network."));
      });
      resolveResponse(response);
    });

    request.on("error", reject);
    request.setTimeout(IDLE_TIMEOUT_MS, () => {
      request.destroy(new Error("Download stalled. Check the network."));
    });
    const abort = (): void => {
      request.destroy(new Error("Download cancelled."));
    };
    signal.addEventListener("abort", abort, { once: true });
    request.on("close", () => signal.removeEventListener("abort", abort));
  });
}

async function transfer(
  url: string,
  destinationPath: string,
  onProgress: ((progress: DownloadProgress) => void) | undefined,
  signal: AbortSignal,
): Promise<void> {
  const tempPath = `${destinationPath}.downloading`;
  let resumeBytes = 0;
  if (existsSync(tempPath)) {
    try {
      resumeBytes = statSync(tempPath).size;
    } catch {
      resumeBytes = 0;
    }
  }

  let response = await openStream(url, resumeBytes, signal);
  if (response.statusCode === 416 && resumeBytes > 0) {
    response.resume();
    unlinkSync(tempPath);
    resumeBytes = 0;
    response = await openStream(url, 0, signal);
  }

  const resumed = response.statusCode === 206 && resumeBytes > 0;
  const startBytes = resumed ? resumeBytes : 0;
  const headerLength = Number(response.headers["content-length"] ?? 0);
  const totalBytes =
    Number.isFinite(headerLength) && headerLength > 0
      ? headerLength + startBytes
      : 0;

  let downloadedBytes = startBytes;
  response.on("data", (chunk: Buffer) => {
    downloadedBytes += chunk.length;
    if (!onProgress) return;
    onProgress({
      percent:
        totalBytes > 0
          ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
          : 0,
      downloadedBytes,
      totalBytes,
    });
  });

  const fileStream = createWriteStream(tempPath, {
    flags: resumed ? "a" : "w",
  });

  try {
    await pipeline(response, fileStream);
  } catch (err) {
    if (signal.aborted) {
      try {
        unlinkSync(tempPath);
      } catch {}
      throw new Error("Download cancelled.");
    }
    if (!resumed) {
      try {
        unlinkSync(tempPath);
      } catch {}
    }
    throw err;
  }

  if (totalBytes > 0 && downloadedBytes < totalBytes) {
    throw new Error(
      `Download incomplete: received ${downloadedBytes} of ${totalBytes} bytes.`,
    );
  }

  if (existsSync(destinationPath)) {
    unlinkSync(destinationPath);
  }
  renameSync(tempPath, destinationPath);
}

export async function downloadFile(
  url: string,
  destinationPath: string,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!url.startsWith("https://")) {
    throw new Error("Only HTTPS downloads are permitted.");
  }
  const controller = new AbortController();
  const outerSignal = signal;
  const forwardAbort = (): void => controller.abort();
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort();
    else outerSignal.addEventListener("abort", forwardAbort, { once: true });
  }

  ensureDirectory(dirname(destinationPath));

  let lastError: unknown = new Error("Download failed.");
  try {
    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      if (controller.signal.aborted) {
        throw new Error("Download cancelled.");
      }
      try {
        await transfer(url, destinationPath, onProgress, controller.signal);
        return;
      } catch (err) {
        lastError = err;
        console.error(`[downloader] Attempt ${attempt}/${ATTEMPTS} failed for ${url}:`, err);
        if (controller.signal.aborted) {
          throw new Error("Download cancelled.");
        }
        if (attempt < ATTEMPTS) {
          await new Promise((wait) => setTimeout(wait, attempt * 750));
        }
      }
    }
    throw lastError;
  } finally {
    if (outerSignal) {
      outerSignal.removeEventListener("abort", forwardAbort);
    }
  }
}

function extractBinary(): string {
  if (process.platform === "win32") {
    const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
    return join(systemRoot, "System32", "tar.exe");
  }
  return "tar";
}

export function extractArchive(
  archivePath: string,
  destDir: string,
): Promise<void> {
  ensureDirectory(destDir);
  return new Promise<void>((resolveExtract, reject) => {
    execFile(
      extractBinary(),
      ["-xf", archivePath, "-C", resolve(destDir)],
      { windowsHide: true, timeout: 300_000 },
      (err, _stdout, stderr) => {
        if (err) {
          reject(
            new Error(
              `Could not unpack the downloaded package: ${stderr.trim() || err.message}`,
            ),
          );
        } else {
          resolveExtract();
        }
      },
    );
  });
}

export async function fetchAndVerifyArtifact(
  engineId: EngineOptionId,
  artifact: EngineArtifact,
  onProgress?: (progress: DownloadProgress) => void,
  abortSignal?: AbortSignal,
): Promise<string> {
  const fileName =
    artifact.name ??
    (artifact.url.split("/").pop()?.split("?")[0] ||
      `${engineId}.${artifact.format}`);
  const downloadDest = join(getDownloadsDir(), fileName);

  if (!(await checkDiskSpace(getDownloadsDir(), artifact.size * 2))) {
    throw new Error(
      `Not enough disk space for ${engineId}. Free at least ${Math.ceil((artifact.size * 2) / 1024 / 1024)} MB and retry.`,
    );
  }

  const expected = artifact.sha256?.trim().toLowerCase() ?? "";
  const isUsable = async (): Promise<boolean> => {
    if (!existsSync(downloadDest)) return false;
    try {
      if (statSync(downloadDest).size !== artifact.size) return false;
      if (!expected) return true;
      return (await computeFileSha256(downloadDest)) === expected;
    } catch {
      return false;
    }
  };

  if (!(await isUsable())) {
    await downloadFile(artifact.url, downloadDest, onProgress, abortSignal);
    if (expected) {
      const computed = await computeFileSha256(downloadDest);
      if (computed !== expected) {
        await downloadFile(
          artifact.url,
          downloadDest,
          onProgress,
          abortSignal,
        ).catch(() => undefined);
        const retried = existsSync(downloadDest)
          ? await computeFileSha256(downloadDest)
          : "";
        if (retried !== expected) {
          try {
            unlinkSync(downloadDest);
          } catch {}
          throw new Error(
            `The downloaded ${engineId} package failed its checksum. The package was removed. Check the network or retry the install.`,
          );
        }
      }
    }
  }

  return downloadDest;
}
