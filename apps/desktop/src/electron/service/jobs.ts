import { existsSync, unlinkSync } from "node:fs";
import type { WebContents } from "electron";
import type {
  EngineId,
  EngineOptionId,
  InstallJournalEntry,
  Job,
  JobKind,
  JobStage,
  JournalResourceRecord,
  ProgressEvent,
  ProgressMeasure,
} from "../../shared/engines";
import { mutateInstallState } from "../state/store";
import { writeLog } from "./logger";

export interface CreateStageSpec {
  id: string;
  label: string;
  irreversible?: boolean;
  weight?: number;
}

export interface CreateJobOptions {
  optionId: EngineOptionId;
  engine: EngineId;
  kind: JobKind;
  stages: CreateStageSpec[];
}

export interface InternalJobRecord {
  job: Job;
  sequence: number;
  abortController: AbortController;
  optionId: EngineOptionId;
  lastProgressEmit: number;
  resumeResolve?: () => void;
}

export interface StageExecutionContext {
  signal: AbortSignal;
  job: Job;
  optionId: EngineOptionId;
  updateProgress: (measure: ProgressMeasure, activity: string) => void;
  recordResource: (
    kind: keyof JournalResourceRecord,
    value: string,
  ) => Promise<void>;
  requestWaiting: (actionDescription: string) => Promise<void>;
}

class OperationOrchestrator {
  private jobs = new Map<string, InternalJobRecord>();
  private engineQueues = new Map<EngineOptionId, Promise<void>>();
  private subscribers = new Set<WebContents>();
  private latestJobId: string | null = null;

  public registerSubscriber(contents: WebContents): void {
    if (contents.isDestroyed()) return;
    this.subscribers.add(contents);
    contents.once("destroyed", () => {
      this.subscribers.delete(contents);
    });

    const latest = this.getLatestJob();
    if (latest !== null) {
      this.sendSnapshotTo(contents, latest);
    }
  }

  public getJob(jobId: string): Job | null {
    return this.jobs.get(jobId)?.job ?? null;
  }

  public getLatestJob(): InternalJobRecord | null {
    if (this.latestJobId === null) return null;
    return this.jobs.get(this.latestJobId) ?? null;
  }

  public hasActiveJob(optionId?: EngineOptionId): boolean {
    for (const record of this.jobs.values()) {
      if (
        record.job.state === "running" ||
        record.job.state === "waiting-for-user"
      ) {
        if (!optionId || record.optionId === optionId) {
          return true;
        }
      }
    }
    return false;
  }

  public createJob(options: CreateJobOptions): InternalJobRecord {
    const id = `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    const stages: JobStage[] = options.stages.map((stage) => ({
      id: stage.id,
      label: stage.label,
      status: "pending",
      irreversible: stage.irreversible ?? false,
      weight: stage.weight ?? 1,
    }));

    const job: Job = {
      id,
      kind: options.kind,
      engine: options.engine,
      optionId: options.optionId,
      state: "queued",
      stages,
      currentStageIndex: 0,
      measurements: {},
      warnings: [],
      createdAt: now,
      updatedAt: now,
      elapsedMs: 0,
      rollbackResources: {},
    };

    const record: InternalJobRecord = {
      job,
      sequence: 1,
      abortController: new AbortController(),
      optionId: options.optionId,
      lastProgressEmit: 0,
    };

    this.jobs.set(id, record);
    this.latestJobId = id;

    writeLog("info", `Job created: ${job.kind} for ${options.optionId}`, {
      jobId: id,
    });
    this.broadcastProgress(record, "Job queued", true);
    return record;
  }

  public initializeFromJournal(
    journal: InstallJournalEntry,
    engine: EngineId,
  ): InternalJobRecord {
    const stages: JobStage[] = [
      {
        id: "interrupted",
        label: journal.stageLabel ?? "Interrupted operation",
        status: "failed",
      },
    ];

    const job: Job = {
      id: journal.jobId,
      kind: journal.kind,
      engine,
      optionId: journal.optionId,
      state: "interrupted",
      stages,
      currentStageIndex: 0,
      measurements: journal.measurements ?? {},
      warnings: ["Operation was interrupted unexpectedly."],
      createdAt: journal.startedAt,
      updatedAt: new Date().toISOString(),
      elapsedMs: 0,
      waitingAction: journal.waitingAction,
      rollbackResources: journal.resources ?? {},
    };

    const record: InternalJobRecord = {
      job,
      sequence: 1,
      abortController: new AbortController(),
      optionId: journal.optionId,
      lastProgressEmit: 0,
    };

    this.jobs.set(journal.jobId, record);
    this.latestJobId = journal.jobId;

    writeLog(
      "warn",
      `Recovered interrupted job from journal: ${journal.jobId}`,
      {
        jobId: journal.jobId,
      },
    );
    return record;
  }

  public async scheduleJob(
    record: InternalJobRecord,
    execute: (context: StageExecutionContext) => Promise<void>,
  ): Promise<Job> {
    const previousQueue =
      this.engineQueues.get(record.optionId) ?? Promise.resolve();

    let releaseQueue: () => void = () => undefined;
    const currentQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });
    this.engineQueues.set(record.optionId, currentQueue);

    try {
      await previousQueue;
    } catch {}

    if (
      record.abortController.signal.aborted ||
      record.job.state === "cancelled"
    ) {
      releaseQueue();
      return record.job;
    }

    record.job.state = "running";
    record.job.updatedAt = new Date().toISOString();
    if (record.job.stages.length > 0) {
      record.job.stages[0].status = "running";
    }

    await this.syncJournal(record);
    this.broadcastProgress(
      record,
      record.job.stages[0]?.label ?? "Running",
      true,
    );

    const updateProgress = (
      measure: ProgressMeasure,
      activity: string,
    ): void => {
      if (record.job.state !== "running") return;
      if (measure.determinate) {
        record.job.measurements.download = measure;
      }
      this.broadcastProgress(record, activity, false);
    };

    const recordResource = async (
      kind: keyof JournalResourceRecord,
      value: string,
    ): Promise<void> => {
      if (!record.job.rollbackResources) record.job.rollbackResources = {};
      if (kind === "files") {
        if (!record.job.rollbackResources.files)
          record.job.rollbackResources.files = [];
        record.job.rollbackResources.files.push(value);
      } else {
        record.job.rollbackResources[kind] = value;
      }
      await this.syncJournal(record);
    };

    const requestWaiting = async (actionDescription: string): Promise<void> => {
      record.job.state = "waiting-for-user";
      record.job.waitingAction = actionDescription;
      record.job.updatedAt = new Date().toISOString();
      await this.syncJournal(record);
      this.broadcastProgress(record, actionDescription, true);

      await new Promise<void>((resolve) => {
        record.resumeResolve = resolve;
      });

      record.job.state = "running";
      record.job.waitingAction = undefined;
      record.job.updatedAt = new Date().toISOString();
      await this.syncJournal(record);
      this.broadcastProgress(record, "Resumed", true);
    };

    const context: StageExecutionContext = {
      signal: record.abortController.signal,
      job: record.job,
      optionId: record.optionId,
      updateProgress,
      recordResource,
      requestWaiting,
    };

    try {
      await execute(context);
      if (record.job.state === "running") {
        record.job.state = "succeeded";
        for (const stage of record.job.stages) {
          if (stage.status !== "failed") {
            stage.status = "succeeded";
          }
        }
        writeLog("info", `Job succeeded: ${record.job.id}`, {
          jobId: record.job.id,
        });
      }
    } catch (err) {
      if (record.abortController.signal.aborted) {
        record.job.state = "cancelled";
        await this.rollbackJob(record);
        writeLog("warn", `Job cancelled: ${record.job.id}`, {
          jobId: record.job.id,
        });
      } else {
        record.job.state = "failed";
        const message = err instanceof Error ? err.message : String(err);
        record.job.failure = {
          code: "runtime",
          cause:
            "The operation encountered an unexpected error. Review the logs for details.",
          recovery: ["retry", "open-logs"],
          detail: message,
        };
        await this.rollbackJob(record);
        writeLog("error", `Job failed: ${message}`, { jobId: record.job.id });
      }
    } finally {
      record.job.updatedAt = new Date().toISOString();
      await mutateInstallState((state) => ({ ...state, journal: undefined }));
      this.broadcastProgress(record, record.job.state, true);
      releaseQueue();
    }

    return record.job;
  }

  public cancelJob(jobId: string): Job | null {
    const record = this.jobs.get(jobId);
    if (!record) return null;
    if (
      record.job.state === "succeeded" ||
      record.job.state === "failed" ||
      record.job.state === "cancelled"
    ) {
      return record.job;
    }

    const currentStage = record.job.stages[record.job.currentStageIndex];
    if (currentStage?.irreversible && record.job.state === "running") {
      record.job.state = "waiting-for-user";
      record.job.waitingAction = "confirm-cancel";
      writeLog(
        "warn",
        `Cancellation requested at irreversible stage: ${currentStage.id}`,
        { jobId },
      );
      this.broadcastProgress(record, "Cancelling requires confirmation", true);
      return record.job;
    }

    record.abortController.abort();
    if (record.resumeResolve) {
      record.resumeResolve();
      record.resumeResolve = undefined;
    }
    record.job.state = "cancelled";
    record.job.updatedAt = new Date().toISOString();
    writeLog("warn", `Job cancelled: ${jobId}`, { jobId });
    this.broadcastProgress(record, "Cancelled", true);
    return record.job;
  }

  public confirmIrreversible(jobId: string, proceed: boolean): Job | null {
    const record = this.jobs.get(jobId);
    if (!record) return null;
    if (record.job.waitingAction !== "confirm-cancel") return record.job;

    if (proceed) {
      record.abortController.abort();
      if (record.resumeResolve) {
        record.resumeResolve();
        record.resumeResolve = undefined;
      }
      record.job.state = "cancelled";
      record.job.waitingAction = undefined;
      record.job.updatedAt = new Date().toISOString();
      void this.rollbackJob(record);
      writeLog(
        "warn",
        `Irreversible cancellation confirmed for job: ${jobId}`,
        { jobId },
      );
      this.broadcastProgress(record, "Cancelled", true);
    } else {
      record.job.state = "running";
      record.job.waitingAction = undefined;
      record.job.updatedAt = new Date().toISOString();
      writeLog("info", `Cancellation rejected; continuing job: ${jobId}`, {
        jobId,
      });
      this.broadcastProgress(record, "Continuing", true);
    }
    return record.job;
  }

  public resumeJob(jobId: string): Job | null {
    const record = this.jobs.get(jobId);
    if (!record) return null;
    if (record.job.state === "waiting-for-user" && record.resumeResolve) {
      record.resumeResolve();
      record.resumeResolve = undefined;
      return record.job;
    }
    return record.job;
  }

  public async cleanupJob(jobId: string): Promise<Job | null> {
    const record = this.jobs.get(jobId);
    if (!record) return null;
    await this.rollbackJob(record);
    record.job.state = "cancelled";
    record.job.updatedAt = new Date().toISOString();
    await mutateInstallState((state) => ({ ...state, journal: undefined }));
    this.broadcastProgress(record, "Cleanup complete", true);
    return record.job;
  }

  public setStage(record: InternalJobRecord, stageIndex: number): void {
    if (stageIndex >= record.job.stages.length) return;
    record.job.currentStageIndex = stageIndex;
    for (let index = 0; index < record.job.stages.length; index += 1) {
      if (index < stageIndex) record.job.stages[index].status = "succeeded";
      else if (index === stageIndex)
        record.job.stages[index].status = "running";
      else record.job.stages[index].status = "pending";
    }
    void this.syncJournal(record);
    this.broadcastProgress(record, record.job.stages[stageIndex].label, true);
  }

  private async syncJournal(record: InternalJobRecord): Promise<void> {
    const currentStage = record.job.stages[record.job.currentStageIndex];
    await mutateInstallState((state) => ({
      ...state,
      journal: {
        jobId: record.job.id,
        kind: record.job.kind,
        optionId: record.optionId,
        startedAt: record.job.createdAt,
        currentStageId: currentStage?.id,
        currentStageIndex: record.job.currentStageIndex,
        stageLabel: currentStage?.label,
        resources: record.job.rollbackResources,
        measurements: record.job.measurements,
        waitingAction: record.job.waitingAction,
      },
    }));
  }

  private async rollbackJob(record: InternalJobRecord): Promise<void> {
    const resources = record.job.rollbackResources;
    if (!resources) return;

    if (Array.isArray(resources.files)) {
      for (const file of resources.files) {
        try {
          if (existsSync(file)) {
            unlinkSync(file);
            writeLog("info", `Rollback unlinked file: ${file}`, {
              jobId: record.job.id,
            });
          }
        } catch (err) {
          writeLog(
            "warn",
            `Rollback failed unlinking file ${file}: ${String(err)}`,
            {
              jobId: record.job.id,
            },
          );
        }
      }
    }
  }

  private broadcastProgress(
    record: InternalJobRecord,
    activity: string,
    immediate: boolean,
  ): void {
    const now = Date.now();
    if (!immediate && now - record.lastProgressEmit < 100) {
      return;
    }
    record.lastProgressEmit = now;
    record.sequence += 1;

    const startedTime = new Date(record.job.createdAt).getTime();
    record.job.elapsedMs = Math.max(0, now - startedTime);

    const currentStage = record.job.stages[record.job.currentStageIndex];
    const event: ProgressEvent = {
      jobId: record.job.id,
      sequence: record.sequence,
      stageId: currentStage?.id ?? "default",
      stageIndex: record.job.currentStageIndex,
      measure: record.job.measurements.download ?? { determinate: false },
      activity,
      canCancel:
        record.job.state === "running" || record.job.state === "queued",
      status: record.job.state,
      elapsedMs: record.job.elapsedMs,
      waitingAction: record.job.waitingAction,
    };

    for (const sub of this.subscribers) {
      if (!sub.isDestroyed()) {
        sub.send("setup:progress", event);
      } else {
        this.subscribers.delete(sub);
      }
    }
  }

  private sendSnapshotTo(
    contents: WebContents,
    record: InternalJobRecord,
  ): void {
    const currentStage = record.job.stages[record.job.currentStageIndex];
    const event: ProgressEvent = {
      jobId: record.job.id,
      sequence: record.sequence,
      stageId: currentStage?.id ?? "default",
      stageIndex: record.job.currentStageIndex,
      measure: record.job.measurements.download ?? { determinate: false },
      activity: currentStage?.label ?? record.job.state,
      canCancel:
        record.job.state === "running" || record.job.state === "queued",
      status: record.job.state,
      elapsedMs: record.job.elapsedMs,
      waitingAction: record.job.waitingAction,
    };
    contents.send("setup:progress", event);
  }
}

export const jobManager = new OperationOrchestrator();
