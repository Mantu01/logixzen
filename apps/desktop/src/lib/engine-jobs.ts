import type { BridgeResult, Job } from "@/shared/engines";

const FINISHED_STATES = new Set([
  "succeeded",
  "failed",
  "cancelled",
  "interrupted",
]);

const POLL_INTERVAL_MS = 250;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

export function isJobFinished(job: Job | null | undefined): boolean {
  return job !== null && job !== undefined && FINISHED_STATES.has(job.state);
}

export function jobStateLabel(job: Job): string {
  switch (job.state) {
    case "queued":
      return "Queued";
    case "running":
      return "Running";
    case "waiting-for-user":
      return "Waiting for you";
    case "succeeded":
      return "Completed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "interrupted":
      return "Interrupted";
    default:
      return "Working";
  }
}

export async function waitForJob(
  jobId: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Job | null> {
  const bridge = window.logixzen?.setup;
  if (!bridge) return null;
  const deadline = Date.now() + timeoutMs;
  let latest: Job | null = null;

  while (Date.now() < deadline) {
    const result = await bridge.getJob(jobId);
    if (result.ok && result.data) {
      latest = result.data;
      if (FINISHED_STATES.has(result.data.state)) return result.data;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, POLL_INTERVAL_MS);
    });
  }

  return latest;
}

export async function runEngineJob(
  start: () => Promise<BridgeResult<Job>>,
): Promise<Job> {
  const started = await start();
  if (!started.ok) throw new Error(started.failure.cause);
  return (await waitForJob(started.data.id)) ?? started.data;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
