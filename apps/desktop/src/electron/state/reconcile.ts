import net from "node:net";
import { existsSync } from "node:fs";
import type {
  DetectedInstallation,
  InstallStateLoad,
  InstallationRecord,
  PlatformSnapshot,
  RepairReason,
} from "../../shared/engines";
import { retrieveSecret } from "../secrets";
import { applyRepairs } from "./store";

const PORT_TIMEOUT_MS = 500;

function portOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (open: boolean): void => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(PORT_TIMEOUT_MS);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function detectionFor(
  record: InstallationRecord,
  snapshot: PlatformSnapshot,
): DetectedInstallation | undefined {
  return snapshot.existing.find((entry) => entry.engine === record.engine);
}

function containerReason(
  record: InstallationRecord,
  snapshot: PlatformSnapshot,
): RepairReason | null {
  const detection = detectionFor(record, snapshot);
  if (detection === undefined || !("containers" in detection))
    return "container-missing";
  const name = record.containerName ?? record.resources.container;
  if (name === undefined || !detection.containers.includes(name))
    return "container-missing";
  return null;
}

function localDbReason(
  record: InstallationRecord,
  snapshot: PlatformSnapshot,
): RepairReason | null {
  const detection = detectionFor(record, snapshot);
  if (detection === undefined || !("instance" in detection))
    return "service-missing";
  if (!detection.instance.known) return "practice-missing";
  if (detection.instance.value === null) return "service-missing";
  return null;
}

function serviceReason(
  record: InstallationRecord,
  snapshot: PlatformSnapshot,
): RepairReason | null {
  const detection = detectionFor(record, snapshot);
  if (detection === undefined || !("services" in detection))
    return "service-missing";
  const name = record.resources.service ?? record.instanceName;
  if (name === undefined) return "service-missing";
  const service = detection.services.find((entry) => entry.name === name);
  if (service === undefined) return "service-missing";
  return service.running ? null : "service-stopped";
}

async function reasonFor(
  record: InstallationRecord,
  snapshot: PlatformSnapshot,
): Promise<RepairReason | null> {
  if (record.dataLocation !== undefined && !existsSync(record.dataLocation))
    return "data-missing";
  if (record.secretRef !== undefined) {
    try {
      if (retrieveSecret(record.secretRef) === null) return "secret-unreadable";
    } catch {
      return "secret-unreadable";
    }
  }
  if (record.method === "container") return containerReason(record, snapshot);
  if (record.engine === "mssql-localdb") return localDbReason(record, snapshot);
  if (record.engine === "mssql-express") {
    const service = serviceReason(record, snapshot);
    if (service !== null) return service;
  }
  if (record.port !== undefined && !(await portOpen("127.0.0.1", record.port)))
    return "port-closed";
  return null;
}

export async function reconcileInstallations(
  loaded: InstallStateLoad,
  snapshot: PlatformSnapshot,
): Promise<InstallStateLoad> {
  if (loaded.readOnly || loaded.state.installations.length === 0) return loaded;
  const repairs: Array<{
    optionId: InstallationRecord["optionId"];
    reason: RepairReason;
  }> = [];
  for (const record of loaded.state.installations) {
    const reason = await reasonFor(record, snapshot);
    if (reason !== null) repairs.push({ optionId: record.optionId, reason });
  }
  const applied = await applyRepairs(repairs);
  return { ...applied, repairs };
}
