import { createHash } from "node:crypto";
import {
  closeSync,
  createReadStream,
  createWriteStream,
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  statfsSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { request as httpsRequest } from "node:https";
import type { IncomingMessage } from "node:http";
import { join } from "node:path";
import type {
  BridgeResult,
  EngineOptionId,
  ProgressMeasure,
} from "../../shared/engines";
import { stagingDir } from "../paths";
import { writeLog } from "./logger";
import { runSafeChildProcess } from "./runner";
import { failureResult } from "./validate";

const ALLOWED_DOWNLOAD_DOMAINS = [
  "download.microsoft.com",
  "go.microsoft.com",
  "packages.microsoft.com",
  "sqlserverbuilds.azureedge.net",
  "www.microsoft.com",
  "microsoft.com",
  "www.sqlite.org",
  "sqlite.org",
];

const MAX_REDIRECTS = 5;
const CONNECT_TIMEOUT_MS = 15000;
const STALL_TIMEOUT_MS = 20000;
const MAX_RETRIES = 3;
const TEMP_HEADROOM_BYTES = 100 * 1024 * 1024;

export interface DownloadPackageSpec {
  optionId: EngineOptionId;
  filename: string;
  url: string;
  expectedSha256?: string;
  expectedPublisher?: string;
  expectedSize: number;
}

export interface DownloadOptions {
  signal?: AbortSignal;
  onProgress?: (measure: ProgressMeasure, activity: string) => void;
  jobId?: string;
}

interface StagedMetadata {
  url: string;
  etag?: string;
  lastModified?: string;
  totalBytes: number;
  expectedSha256?: string;
}

export const PACKAGE_MANIFESTS: Partial<
  Record<EngineOptionId, DownloadPackageSpec>
> = {
  "mssql-express-windows": {
    optionId: "mssql-express-windows",
    filename: "SQL2022-SSEI-Expr.exe",
    url: "https://download.microsoft.com/download/5/1/4/51452704-2074-4952-aa30-6799d16a707b/SQL2022-SSEI-Expr.exe",
    expectedSize: 748772024,
    expectedPublisher: "Microsoft Corporation",
  },
  "mssql-localdb": {
    optionId: "mssql-localdb",
    filename: "SqlLocalDB.msi",
    url: "https://download.microsoft.com/download/3/8/d/38d659cf-0205-4845-a744-889984cf639a/SqlLocalDB.msi",
    expectedSize: 68452352,
    expectedPublisher: "Microsoft Corporation",
  },
  "mssql-express-linux": {
    optionId: "mssql-express-linux",
    filename: "mssql-server_16.0.4180.1-1_amd64.deb",
    url: "https://packages.microsoft.com/ubuntu/24.04/mssql-server-2022/pool/main/m/mssql-server/mssql-server_16.0.4180.1-1_amd64.deb",
    expectedSize: 317148974,
    expectedPublisher: "Microsoft Corporation",
  },
};

export function isAllowedDownloadUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_DOWNLOAD_DOMAINS.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`),
    );
  } catch {
    return false;
  }
}

export async function preflightDownload(
  spec: DownloadPackageSpec,
  jobId?: string,
): Promise<BridgeResult<void>> {
  if (!isAllowedDownloadUrl(spec.url)) {
    writeLog("error", `Blocked download from untrusted URL: ${spec.url}`, {
      jobId,
    });
    return failureResult(
      "integrity",
      "The download URL is not from an approved vendor source. Only official sources are permitted.",
      ["open-official-download"],
    );
  }

  const root = stagingDir();

  const probeFile = join(root, `.writetest-${Date.now()}`);
  try {
    const handle = openSync(probeFile, "w");
    closeSync(handle);
    unlinkSync(probeFile);
  } catch (err) {
    writeLog("error", `Staging directory write check failed: ${String(err)}`, {
      jobId,
    });
    return failureResult(
      "permission",
      "Cannot write to the app staging folder. Check permissions and try again.",
      ["grant-permission", "retry"],
    );
  }

  const required = Math.ceil(spec.expectedSize * 1.5) + TEMP_HEADROOM_BYTES;
  try {
    const stats = statfsSync(root);
    const available = Number(stats.bavail) * Number(stats.bsize);
    if (available < required) {
      writeLog(
        "error",
        `Insufficient disk space for download: required=${required}, available=${available}`,
        { jobId },
      );
      return failureResult(
        "resources",
        "Not enough disk space for download and staging. Free up disk space and try again.",
        ["free-resources", "retry"],
      );
    }
  } catch {}

  return new Promise<BridgeResult<void>>((resolve) => {
    try {
      const parsed = new URL(spec.url);
      const req = httpsRequest(
        {
          hostname: parsed.hostname,
          path: parsed.pathname + parsed.search,
          method: "HEAD",
          timeout: 5000,
        },
        (res) => {
          res.resume();
          resolve({ ok: true, data: undefined });
        },
      );
      req.on("timeout", () => {
        req.destroy();
        writeLog(
          "error",
          `Preflight connection timed out to ${parsed.hostname}`,
          { jobId },
        );
        resolve(
          failureResult(
            "network",
            "Cannot connect to the download server. Check your internet connection.",
            ["retry"],
          ),
        );
      });
      req.on("error", (err) => {
        writeLog("error", `Preflight reachability failed: ${String(err)}`, {
          jobId,
        });
        resolve(
          failureResult(
            "network",
            "Cannot reach the official download server. Check your network connection.",
            ["retry"],
          ),
        );
      });
      req.end();
    } catch (err) {
      resolve(
        failureResult(
          "network",
          "Failed to parse download URL. Check connection.",
          ["retry"],
          String(err),
        ),
      );
    }
  });
}

function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function verifyAuthenticodeSignature(
  filePath: string,
  expectedPublisher?: string,
): Promise<boolean> {
  if (process.platform !== "win32") return true;
  try {
    const escaped = filePath.replace(/'/g, "''");
    const result = await runSafeChildProcess({
      executable: "powershell.exe",
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `(Get-AuthenticodeSignature -FilePath '${escaped}').Status.ToString(); (Get-AuthenticodeSignature -FilePath '${escaped}').SignerCertificate.Subject`,
      ],
      timeoutMs: 15000,
    });
    if (result.exitCode !== 0) return false;
    const lines = result.stdout
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const status = lines[0];
    if (status !== "Valid") return false;
    if (expectedPublisher && lines.length > 1) {
      return lines[1].toLowerCase().includes(expectedPublisher.toLowerCase());
    }
    return true;
  } catch {
    return false;
  }
}

export async function verifyPackage(
  partPath: string,
  spec: DownloadPackageSpec,
  jobId?: string,
): Promise<BridgeResult<string>> {
  if (!existsSync(partPath)) {
    return failureResult(
      "prerequisite",
      "Downloaded file not found. Restart download.",
      ["retry"],
    );
  }

  let computedHash = "";
  try {
    computedHash = await computeFileSha256(partPath);
  } catch (err) {
    writeLog(
      "error",
      `Failed computing hash for ${spec.filename}: ${String(err)}`,
      { jobId },
    );
    return failureResult(
      "integrity",
      "Could not verify package hash. File may be damaged.",
      ["retry"],
    );
  }

  if (
    spec.expectedSha256 &&
    computedHash.toLowerCase() !== spec.expectedSha256.toLowerCase()
  ) {
    writeLog(
      "error",
      `Hash mismatch for ${spec.filename}: expected ${spec.expectedSha256}, computed ${computedHash}`,
      { jobId },
    );
    try {
      unlinkSync(partPath);
    } catch {}
    return failureResult(
      "integrity",
      "Package hash verification failed. The downloaded file is corrupt or tampered with.",
      ["retry", "open-official-download"],
      `Expected ${spec.expectedSha256}, got ${computedHash}`,
    );
  }

  if (process.platform === "win32" && spec.expectedPublisher) {
    const validSignature = await verifyAuthenticodeSignature(
      partPath,
      spec.expectedPublisher,
    );
    if (!validSignature) {
      writeLog(
        "error",
        `Authenticode signature verification failed for ${spec.filename}`,
        { jobId },
      );
      try {
        unlinkSync(partPath);
      } catch {}
      return failureResult(
        "integrity",
        "Package signature check failed. The file is not signed by the expected vendor.",
        ["retry", "open-official-download"],
      );
    }
  }

  writeLog(
    "info",
    `Verification passed for ${spec.filename}: SHA256=${computedHash}`,
    { jobId },
  );

  const target = join(stagingDir(), spec.filename);
  renameSync(partPath, target);

  const metaPath = `${partPath}.meta.json`;
  if (existsSync(metaPath)) {
    try {
      unlinkSync(metaPath);
    } catch {}
  }

  return { ok: true, data: target };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchStream(
  urlStr: string,
  startByte: number,
  meta: StagedMetadata | null,
  redirectCount: number,
  signal?: AbortSignal,
): Promise<{ res: IncomingMessage; finalUrl: string }> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Download aborted"));
      return;
    }
    if (redirectCount > MAX_REDIRECTS) {
      reject(new Error("Exceeded maximum redirects"));
      return;
    }
    if (!isAllowedDownloadUrl(urlStr)) {
      reject(new Error(`Redirected to untrusted URL: ${urlStr}`));
      return;
    }

    const parsed = new URL(urlStr);
    const headers: Record<string, string> = {
      "User-Agent": "LogixZen Desktop",
    };

    if (startByte > 0) {
      headers["Range"] = `bytes=${startByte}-`;
      if (meta?.etag) headers["If-Range"] = meta.etag;
      else if (meta?.lastModified) headers["If-Range"] = meta.lastModified;
    }

    const req = httpsRequest(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers,
        timeout: CONNECT_TIMEOUT_MS,
      },
      (res) => {
        const code = res.statusCode ?? 0;
        if ([301, 302, 303, 307, 308].includes(code)) {
          const loc = res.headers.location;
          res.resume();
          if (!loc) {
            reject(new Error("Redirect missing location header"));
            return;
          }
          const nextUrl = new URL(loc, urlStr).toString();
          fetchStream(nextUrl, startByte, meta, redirectCount + 1, signal).then(
            resolve,
            reject,
          );
          return;
        }
        resolve({ res, finalUrl: urlStr });
      },
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Connection timed out"));
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          req.destroy();
          reject(new Error("Download aborted"));
        },
        { once: true },
      );
    }

    req.end();
  });
}

export async function downloadPackage(
  spec: DownloadPackageSpec,
  options: DownloadOptions = {},
): Promise<string> {
  const root = stagingDir();
  const target = join(root, spec.filename);
  const partPath = join(root, `${spec.filename}.part`);
  const metaPath = join(root, `${spec.filename}.meta.json`);

  if (existsSync(target)) {
    const verified = await verifyPackage(target, spec, options.jobId);
    if (verified.ok) {
      writeLog("info", `Using existing staged package: ${spec.filename}`, {
        jobId: options.jobId,
      });
      return target;
    }
  }

  const preflight = await preflightDownload(spec, options.jobId);
  if (!preflight.ok) {
    throw new Error(preflight.failure.cause);
  }

  let attempt = 0;
  while (attempt < MAX_RETRIES) {
    if (options.signal?.aborted) {
      throw new Error("Download aborted");
    }

    let startByte = 0;
    let meta: StagedMetadata | null = null;
    if (existsSync(metaPath) && existsSync(partPath)) {
      try {
        meta = JSON.parse(readFileSync(metaPath, "utf8")) as StagedMetadata;
        if (meta.url === spec.url) {
          startByte = statSync(partPath).size;
        }
      } catch {
        meta = null;
      }
    }

    try {
      writeLog(
        "info",
        `Starting download attempt ${attempt + 1}: offset=${startByte}`,
        {
          jobId: options.jobId,
        },
      );
      const { res, finalUrl } = await fetchStream(
        spec.url,
        startByte,
        meta,
        0,
        options.signal,
      );

      const code = res.statusCode ?? 0;
      let append = false;
      let totalBytes = spec.expectedSize;

      if (code === 206) {
        append = true;
        const cr = res.headers["content-range"];
        if (cr) {
          const match = cr.match(/\/(\d+)$/);
          if (match) totalBytes = parseInt(match[1], 10);
        }
      } else if (code === 200) {
        append = false;
        startByte = 0;
        const cl = res.headers["content-length"];
        if (cl) totalBytes = parseInt(cl, 10);
      } else {
        res.resume();
        throw new Error(`Unexpected server status code: ${code}`);
      }

      const newMeta: StagedMetadata = {
        url: finalUrl,
        etag: res.headers.etag,
        lastModified: res.headers["last-modified"],
        totalBytes,
        expectedSha256: spec.expectedSha256,
      };
      writeFileSync(metaPath, JSON.stringify(newMeta, null, 2), "utf8");

      let bytesReceived = startByte;
      const fileStream = createWriteStream(partPath, {
        flags: append ? "a" : "w",
      });

      await new Promise<void>((resolve, reject) => {
        let stallTimer = setTimeout(() => {
          res.destroy();
          reject(new Error("Download stalled"));
        }, STALL_TIMEOUT_MS);

        res.on("data", (chunk: Buffer) => {
          clearTimeout(stallTimer);
          stallTimer = setTimeout(() => {
            res.destroy();
            reject(new Error("Download stalled"));
          }, STALL_TIMEOUT_MS);

          bytesReceived += chunk.length;
          fileStream.write(chunk);

          if (options.onProgress) {
            const hasTotal = totalBytes > 0;
            const measure: ProgressMeasure = hasTotal
              ? {
                  determinate: true,
                  bytesDone: bytesReceived,
                  bytesTotal: totalBytes,
                  percent: Math.min(
                    100,
                    Math.round((bytesReceived / totalBytes) * 100),
                  ),
                }
              : { determinate: false };
            options.onProgress(measure, `Downloading ${spec.filename}`);
          }
        });

        res.on("end", () => {
          clearTimeout(stallTimer);
          fileStream.end(() => resolve());
        });

        res.on("error", (err) => {
          clearTimeout(stallTimer);
          fileStream.end(() => reject(err));
        });
      });

      const verifyOutcome = await verifyPackage(partPath, spec, options.jobId);
      if (!verifyOutcome.ok) {
        throw new Error(verifyOutcome.failure.cause);
      }
      return verifyOutcome.data;
    } catch (err) {
      attempt += 1;
      writeLog("warn", `Download error on attempt ${attempt}: ${String(err)}`, {
        jobId: options.jobId,
      });

      if (options.signal?.aborted) {
        throw new Error("Download aborted");
      }

      if (attempt >= MAX_RETRIES) {
        throw err;
      }
      const backoff =
        500 * Math.pow(2, attempt) + Math.floor(Math.random() * 200);
      await delay(backoff);
    }
  }

  throw new Error("Download failed after retries.");
}

export function cleanExpiredStaging(maxAgeDays = 7): void {
  const root = stagingDir();
  if (!existsSync(root)) return;
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  try {
    const entries = readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const full = join(root, entry.name);
        const stats = statSync(full);
        if (stats.mtimeMs < cutoff) {
          unlinkSync(full);
          writeLog("info", `Pruned expired staging file: ${entry.name}`);
        }
      }
    }
  } catch (err) {
    writeLog("warn", `Staging cleanup warning: ${String(err)}`);
  }
}

export function getStagingCacheSize(): number {
  const root = stagingDir();
  if (!existsSync(root)) return 0;
  let total = 0;
  try {
    const entries = readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        total += statSync(join(root, entry.name)).size;
      }
    }
  } catch {
    return 0;
  }
  return total;
}

export function clearStagingCache(): void {
  const root = stagingDir();
  if (!existsSync(root)) return;
  try {
    const entries = readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        unlinkSync(join(root, entry.name));
      }
    }
    writeLog("info", "Cleared staging cache directory");
  } catch (err) {
    writeLog("warn", `Clear staging cache warning: ${String(err)}`);
  }
}
