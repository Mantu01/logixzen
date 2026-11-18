import { existsSync, mkdirSync } from "node:fs";
import type { InstallStateLoad } from "../../shared/engines";
import {
  backupsDir,
  logsDir,
  practiceDir,
  sqlitePracticeFile,
  stagingDir,
  stateFile,
} from "../paths";
import { currentSnapshot } from "../platform/snapshot";
import { secretStorageAvailable } from "../secrets";
import { desktopSqlEngine } from "../sql/engine";
import { reconcileInstallations } from "./reconcile";
import { loadInstallState } from "./store";
import { dirname } from "node:path";
import { cleanExpiredStaging } from "../service/downloader";
import { jobManager } from "../service/jobs";
import { optionToEngine } from "../service/setup-service";
import { connectionRegistry } from "../sql/registry";

export async function prepareInstallState(): Promise<InstallStateLoad> {
  for (const directory of [
    practiceDir(),
    backupsDir(),
    stagingDir(),
    logsDir(),
  ]) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
  }
  mkdirSync(dirname(stateFile()), { recursive: true, mode: 0o700 });
  cleanExpiredStaging(7);

  const loaded = await loadInstallState();
  const reconciled = await reconcileInstallations(loaded, currentSnapshot());
  if (reconciled.issues.length > 0) {
    console.warn(`Install state issues: ${reconciled.issues.join(", ")}`);
  }
  if (reconciled.state.journal) {
    jobManager.initializeFromJournal(
      reconciled.state.journal,
      optionToEngine(reconciled.state.journal.optionId),
    );
  }
  if (reconciled.repairs.length > 0) {
    console.warn(
      `Install state repairs: ${reconciled.repairs.map((repair) => `${repair.optionId} ${repair.reason}`).join(", ")}`,
    );
  }
  const sqliteRecord = reconciled.state.installations.find(
    (item) => item.optionId === "sqlite" && item.status === "ready",
  );
  if (sqliteRecord && existsSync(sqlitePracticeFile())) {
    desktopSqlEngine.openPracticeDatabase(sqlitePracticeFile());
    if (reconciled.state.activeOptionId === "sqlite") {
      desktopSqlEngine.use("practice");
    }
  }
  if (!(await secretStorageAvailable())) {
    console.warn(
      "OS encryption is unavailable; database credentials cannot be stored on this machine.",
    );
  }

  try {
    await connectionRegistry.initFromState();
    const activeOpt = connectionRegistry.getActiveOptionId();
    if (activeOpt !== "sqlite") {
      const activeRec = reconciled.state.installations.find(
        (i) => i.optionId === activeOpt,
      );
      if (activeRec && activeRec.status === "ready") {
        await Promise.race([
          connectionRegistry.getDriver(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("Auto-connect timed out after 5000ms")),
              5000,
            ),
          ),
        ]);
      }
    }
  } catch (err) {
    console.warn(`Startup auto-connect non-fatal: ${String(err)}`);
  }

  return reconciled;
}
