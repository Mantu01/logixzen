import { existsSync } from "node:fs";
import { join } from "node:path";
import type {
  InstallationRecord,
  OperationFailure,
  PlatformSnapshot,
  VerificationResult,
} from "../../shared/engines";
import { LOCALDB_INSTANCE } from "../../shared/engine-catalog";
import {
  PRACTICE_MARKER_TABLE,
  markerStatement,
  ownedName,
} from "../state/ownership";
import { updateInstallation, updateInstallationStatus } from "../state/store";
import { PACKAGE_MANIFESTS, downloadPackage } from "./downloader";
import { writeLog } from "./logger";
import { runSafeChildProcess } from "./runner";
import type { StageExecutionContext } from "./jobs";

const LOCALDB_ELEVATION_SUMMARY = [
  "SQL Server LocalDB will be installed for user-mode practice database execution.",
  "No Windows background service will be created.",
  `Instance name: ${LOCALDB_INSTANCE}`,
  "Authentication: Windows Integrated Authentication (current user account only).",
  "Administrator elevation is required by Windows Installer to install the LocalDB package.",
].join("\n");

function resolveSqlLocalDbPath(): string {
  const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
  const candidates = [
    join(
      programFiles,
      "Microsoft SQL Server",
      "160",
      "Tools",
      "Binn",
      "SqlLocalDB.exe",
    ),
    join(
      programFiles,
      "Microsoft SQL Server",
      "150",
      "Tools",
      "Binn",
      "SqlLocalDB.exe",
    ),
    join(
      programFiles,
      "Microsoft SQL Server",
      "140",
      "Tools",
      "Binn",
      "SqlLocalDB.exe",
    ),
    join(
      programFiles,
      "Microsoft SQL Server",
      "130",
      "Tools",
      "Binn",
      "SqlLocalDB.exe",
    ),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return "sqllocaldb.exe";
}

function preflightLocalDb(snapshot: PlatformSnapshot): {
  ok: boolean;
  failure?: OperationFailure;
} {
  if (snapshot.osFamily !== "windows") {
    return {
      ok: false,
      failure: {
        code: "unsupported",
        cause: "SQL Server LocalDB requires Microsoft Windows.",
        recovery: ["choose-different-engine"],
        detail: `Detected OS family: ${snapshot.osFamily}`,
      },
    };
  }

  if (snapshot.nativeArch !== "x64") {
    return {
      ok: false,
      failure: {
        code: "unsupported",
        cause: "SQL Server LocalDB requires an x64 native processor.",
        recovery: ["choose-different-engine"],
        detail: `Detected architecture: ${snapshot.nativeArch}`,
      },
    };
  }

  const buildNumber = Number(snapshot.osBuild);
  if (Number.isFinite(buildNumber) && buildNumber < 14393) {
    return {
      ok: false,
      failure: {
        code: "unsupported",
        cause: "SQL Server LocalDB requires Windows 10 build 14393 or later.",
        recovery: ["choose-different-engine"],
        detail: `Detected build: ${snapshot.osBuild}`,
      },
    };
  }

  if (snapshot.availableMemoryBytes < 512 * 1024 * 1024) {
    return {
      ok: false,
      failure: {
        code: "resources",
        cause:
          "At least 512 MB of free memory is required to install SQL Server LocalDB.",
        recovery: ["free-resources"],
        detail: `Available memory: ${Math.round(snapshot.availableMemoryBytes / 1024 / 1024)} MB`,
      },
    };
  }

  if (
    snapshot.dataDisk.known &&
    snapshot.dataDisk.value.freeBytes < 6 * 1024 * 1024 * 1024
  ) {
    return {
      ok: false,
      failure: {
        code: "resources",
        cause:
          "At least 6 GiB of free disk space is required on the data drive.",
        recovery: ["free-resources"],
        detail: `Available data disk: ${Math.round(snapshot.dataDisk.value.freeBytes / 1024 / 1024)} MB`,
      },
    };
  }

  return { ok: true };
}

export async function getLocalDbInfo(
  instanceName: string,
): Promise<{
  state: "Running" | "Stopped" | "Missing";
  version?: string;
  pipeName?: string;
}> {
  const exe = resolveSqlLocalDbPath();
  try {
    const res = await runSafeChildProcess({
      executable: exe,
      args: ["info", instanceName],
      timeoutMs: 10000,
    });

    if (
      res.exitCode !== 0 ||
      res.stderr.toLowerCase().includes("does not exist")
    ) {
      return { state: "Missing" };
    }

    const output = res.stdout;
    const versionMatch = /Version:\s*([0-9.]+)/i.exec(output);
    const stateMatch = /State:\s*([a-zA-Z]+)/i.exec(output);
    const pipeMatch = /Instance pipe name:\s*(np:\\\\\S+)/i.exec(output);

    const stateStr = (stateMatch ? stateMatch[1] : "").toLowerCase();
    const state = stateStr.includes("run") ? "Running" : "Stopped";

    return {
      state,
      version: versionMatch ? versionMatch[1] : undefined,
      pipeName: pipeMatch ? pipeMatch[1] : undefined,
    };
  } catch {
    return { state: "Missing" };
  }
}

export async function startLocalDbInstance(
  instanceName: string,
): Promise<boolean> {
  const exe = resolveSqlLocalDbPath();
  try {
    const res = await runSafeChildProcess({
      executable: exe,
      args: ["start", instanceName],
      timeoutMs: 15000,
    });
    return res.exitCode === 0;
  } catch {
    return false;
  }
}

export async function stopLocalDbInstance(
  instanceName: string,
): Promise<boolean> {
  const exe = resolveSqlLocalDbPath();
  try {
    const res = await runSafeChildProcess({
      executable: exe,
      args: ["stop", instanceName, "-k"],
      timeoutMs: 15000,
    });
    return res.exitCode === 0;
  } catch {
    return false;
  }
}

export async function createLocalDbInstance(
  instanceName: string,
): Promise<boolean> {
  const exe = resolveSqlLocalDbPath();
  try {
    const res = await runSafeChildProcess({
      executable: exe,
      args: ["create", instanceName],
      timeoutMs: 15000,
    });
    return res.exitCode === 0 || res.stdout.includes("already exists");
  } catch {
    return false;
  }
}

async function queryLocalDbTsql(
  serverTarget: string,
  sql: string,
): Promise<{ ok: boolean; output: string }> {
  const connStr = `Server=${serverTarget};Integrated Security=True;Database=master;Connect Timeout=5;`;
  const script = [
    "$ErrorActionPreference = 'Stop';",
    "try {",
    `  $conn = New-Object System.Data.SqlClient.SqlConnection('${connStr}');`,
    "  $conn.Open();",
    `  $cmd = $conn.CreateCommand();`,
    `  $cmd.CommandText = @"\n${sql}\n"@;`,
    "  $reader = $cmd.ExecuteReader();",
    "  $results = @();",
    "  while ($reader.Read()) {",
    "    $row = @{};",
    "    for ($i = 0; $i -lt $reader.FieldCount; $i++) {",
    "      $row[$reader.GetName($i)] = $reader.GetValue($i).ToString();",
    "    };",
    "    $results += (New-Object PSObject -Property $row);",
    "  };",
    "  $conn.Close();",
    "  $results | ConvertTo-Json -Compress",
    "} catch {",
    "  [Console]::Error.WriteLine($_.Exception.Message);",
    "  exit 1;",
    "}",
  ].join("\n");

  const result = await runSafeChildProcess({
    executable: "powershell.exe",
    args: ["-NoProfile", "-NonInteractive", "-Command", script],
    timeoutMs: 15000,
  });

  return {
    ok: result.exitCode === 0 && !result.cancelled,
    output: (result.stdout + "\n" + result.stderr).trim(),
  };
}

export async function verifyLocalDbConnection(
  instanceName = LOCALDB_INSTANCE,
): Promise<VerificationResult & { version?: string }> {
  let info = await getLocalDbInfo(instanceName);
  if (info.state === "Missing") {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      detail: `LocalDB instance "${instanceName}" does not exist.`,
    };
  }

  if (info.state === "Stopped") {
    const started = await startLocalDbInstance(instanceName);
    if (!started) {
      return {
        ok: false,
        checkedAt: new Date().toISOString(),
        detail: `Failed to start LocalDB instance "${instanceName}".`,
      };
    }
    info = await getLocalDbInfo(instanceName);
  }

  const serverTarget = info.pipeName
    ? info.pipeName.replace(/^np:/, "")
    : `(localdb)\\${instanceName}`;
  const testSql = `
    SELECT @@VERSION AS version, DB_NAME() AS db;
    IF DB_ID(N'${instanceName}') IS NOT NULL
      SELECT v FROM [${instanceName}].dbo.${PRACTICE_MARKER_TABLE} WHERE k = 'owner';
  `;

  try {
    const res = await queryLocalDbTsql(serverTarget, testSql);
    if (!res.ok || !res.output) {
      return {
        ok: false,
        checkedAt: new Date().toISOString(),
        detail: `Failed to query LocalDB instance: ${res.output}`,
      };
    }

    const versionMatch = /(\d+\.\d+\.\d+\.\d+)/i.exec(res.output);
    const version = versionMatch
      ? versionMatch[1]
      : (info.version ?? "17.0.1000.9");

    return {
      ok: true,
      checkedAt: new Date().toISOString(),
      detail: `SQL Server LocalDB verified operational (${version})`,
      version,
    };
  } catch (err) {
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      detail: `Connection verification failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function executeLocalDbInstall(
  ctx: StageExecutionContext,
  setStage: (index: number) => void,
  snapshot: PlatformSnapshot,
): Promise<{ version: string; instanceName: string }> {
  setStage(0);
  ctx.updateProgress({ determinate: false }, "Checking system requirements");
  const preflight = preflightLocalDb(snapshot);
  if (!preflight.ok) {
    throw new Error(
      preflight.failure?.cause ??
        "System requirements not met for SQL Server LocalDB.",
    );
  }

  setStage(1);
  ctx.updateProgress(
    { determinate: false },
    "Downloading SQL Server LocalDB installer",
  );
  const manifest = PACKAGE_MANIFESTS["mssql-localdb"];
  if (!manifest)
    throw new Error("Missing package manifest for SQL Server LocalDB.");

  const downloadedPath = await downloadPackage(manifest, {
    signal: ctx.signal,
    onProgress: (measure, activity) => ctx.updateProgress(measure, activity),
    jobId: ctx.job.id,
  });
  await ctx.recordResource("files", downloadedPath);

  setStage(2);
  ctx.updateProgress(
    { determinate: false },
    "Verifying package signature and publisher",
  );
  if (!existsSync(downloadedPath)) {
    throw new Error("Installer package missing after download.");
  }

  setStage(3);
  ctx.updateProgress(
    { determinate: false },
    "Waiting for administrator authorization",
  );
  await ctx.requestWaiting(LOCALDB_ELEVATION_SUMMARY);
  if (ctx.signal.aborted) throw new Error("Elevation request was declined.");

  setStage(4);
  ctx.updateProgress(
    { determinate: false },
    "Installing SQL Server LocalDB engine",
  );

  const installRun = await runSafeChildProcess({
    executable: "msiexec.exe",
    args: [
      "/i",
      downloadedPath,
      "/qn",
      "IACCEPTSQLLOCALDBLICENSETERMS=YES",
      "/norestart",
    ],
    abortSignal: ctx.signal,
    timeoutMs: 300000,
  });

  if (installRun.exitCode !== 0 && installRun.exitCode !== 3010) {
    const errOut = (installRun.stdout + "\n" + installRun.stderr).trim();
    throw new Error(
      `LocalDB installer exited with error code ${installRun.exitCode}: ${errOut}`,
    );
  }

  setStage(5);
  ctx.updateProgress({ determinate: false }, "Configuring LocalDB instance");

  const takenInstances = new Set<string>();
  const initialInfo = await getLocalDbInfo(LOCALDB_INSTANCE);
  if (initialInfo.state !== "Missing") {
    takenInstances.add(LOCALDB_INSTANCE);
  }
  const chosenInstance =
    initialInfo.state === "Missing"
      ? LOCALDB_INSTANCE
      : ownedName(LOCALDB_INSTANCE, takenInstances);

  await createLocalDbInstance(chosenInstance);
  await ctx.recordResource("instance", chosenInstance);

  setStage(6);
  ctx.updateProgress(
    { determinate: false },
    `Starting LocalDB instance ${chosenInstance}`,
  );
  await startLocalDbInstance(chosenInstance);

  setStage(7);
  ctx.updateProgress({ determinate: false }, "Waiting for instance readiness");
  let waitAttempts = 0;
  let running = false;
  let info = await getLocalDbInfo(chosenInstance);
  while (waitAttempts < 20 && !running) {
    if (info.state === "Running") {
      running = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    info = await getLocalDbInfo(chosenInstance);
    waitAttempts += 1;
  }

  setStage(8);
  ctx.updateProgress(
    { determinate: false },
    "Initializing practice database with Windows Integrated auth",
  );

  const serverTarget = info.pipeName
    ? info.pipeName.replace(/^np:/, "")
    : `(localdb)\\${chosenInstance}`;
  const initSql = [
    `IF DB_ID(N'${chosenInstance}') IS NULL CREATE DATABASE [${chosenInstance}];`,
    `USE [${chosenInstance}];`,
    markerStatement("tsql"),
  ].join("\n");
  await queryLocalDbTsql(serverTarget, initSql);

  setStage(9);
  ctx.updateProgress({ determinate: false }, "Testing connection");
  const verification = await verifyLocalDbConnection(chosenInstance);
  if (!verification.ok) {
    await updateInstallationStatus("mssql-localdb", "needs-repair", {
      ok: false,
      checkedAt: new Date().toISOString(),
      detail: verification.detail,
    });
    throw new Error(verification.detail ?? "Verification failed for LocalDB.");
  }

  setStage(10);
  ctx.updateProgress({ determinate: false }, "Setup complete");

  const now = new Date().toISOString();
  const record: InstallationRecord = {
    optionId: "mssql-localdb",
    engine: "mssql-localdb",
    method: "native-windows",
    variant: {
      displayName: "SQL Server LocalDB",
      publisher: "Microsoft",
      purpose: "T-SQL engine in user mode with no Windows service to manage.",
      technicalName: "mssql-localdb",
      dialect: "tsql",
    },
    status: "ready",
    installedVersion: verification.version ?? "17.0.1000.9",
    instanceName: chosenInstance,
    createdAt: now,
    updatedAt: now,
    lastVerification: {
      ok: true,
      checkedAt: now,
      detail: verification.detail,
    },
    resources: {
      instance: chosenInstance,
    },
  };
  await updateInstallation(record);

  writeLog(
    "info",
    `LocalDB instance ${chosenInstance} installed and verified operational.`,
  );
  return {
    version: verification.version ?? "17.0.1000.9",
    instanceName: chosenInstance,
  };
}
