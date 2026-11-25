import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { InstallStateLoad } from "../../shared/engines";
import { ENGINE_CATALOG } from "../../shared/engine-catalog";
import {
  backupsDir,
  logsDir,
  practiceDir,
  stagingDir,
  stateFile,
} from "../paths";
import { secretStorageAvailable } from "../secrets";
import { jobManager } from "../service/jobs";
import { loadInstallState, mutateInstallState } from "./store";

export async function prepareInstallState(): Promise<InstallStateLoad> {
  for (const directory of [practiceDir(), backupsDir(), stagingDir(), logsDir()]) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
  }
  mkdirSync(dirname(stateFile()), { recursive: true, mode: 0o700 });

  const known = new Set(ENGINE_CATALOG.map((item) => item.id));
  const current = await loadInstallState();
  if (current.state.installations.some((item) => !known.has(item.optionId))) {
    await mutateInstallState((state) => {
      state.installations = state.installations.filter((item) =>
        known.has(item.optionId),
      );
      if (
        state.activeOptionId !== undefined &&
        !known.has(state.activeOptionId)
      ) {
        state.activeOptionId = state.installations.find(
          (item) => item.status === "ready",
        )?.optionId;
      }
    });
  }
  const loaded = await loadInstallState();

  if (loaded.state.journal !== undefined) {
    const entry = ENGINE_CATALOG.find(
      (item) => item.id === loaded.state.journal?.optionId,
    );
    if (entry !== undefined) {
      jobManager.initializeFromJournal(loaded.state.journal, entry.engine);
    }
  }

  if (loaded.issues.length > 0) {
    console.warn(`Install state notices: ${loaded.issues.join(", ")}`);
  }

  if (!(await secretStorageAvailable())) {
    console.warn(
      "OS encryption is unavailable; database credentials cannot be stored on this machine.",
    );
  }

  return loaded;
}
