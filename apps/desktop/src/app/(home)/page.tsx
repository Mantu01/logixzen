"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Binary,
  CheckCircle2,
  Cpu,
  Flame,
  FolderKanban,
  GraduationCap,
  Layers,
  Loader2,
  Network,
  Pencil,
  Plus,
  Settings2,
  Terminal,
  Trash2,
} from "lucide-react";
import { PageShell } from "@/components/app-shell/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePackStore } from "@/stores/usePackStore";
import { useProgressStore } from "@/stores/useProgressStore";
import {
  DEFAULT_WORKSPACE_ID,
  workspaceCategories,
  type Workspace,
} from "@/lib/categories";
import {
  LEARNING_SERVICES,
  SUBJECT_REGISTRY,
  type LearningService,
  type SubjectId,
} from "@/lib/subjects";
import { cn } from "@/lib/utils";

const SERVICE_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  sql: Terminal,
  dsa: Binary,
  "computer-networking": Network,
  os: Cpu,
  "system-design": Layers,
};

export default function HomePage(): React.ReactElement {
  const router = useRouter();
  const hydrated = usePackStore((state) => state.hydrated);
  const workspaces = usePackStore((state) => state.workspaces);
  const activeWorkspaceId = usePackStore((state) => state.activeWorkspaceId);
  const databases = usePackStore((state) => state.databases);
  const questions = usePackStore((state) => state.questions);
  const notes = usePackStore((state) => state.notes);
  const categories = usePackStore((state) => state.categories);
  const questionWorkspace = usePackStore((state) => state.questionWorkspace);
  const noteWorkspace = usePackStore((state) => state.noteWorkspace);
  const createWorkspace = usePackStore((state) => state.createWorkspace);
  const renameWorkspace = usePackStore((state) => state.renameWorkspace);
  const removeWorkspace = usePackStore((state) => state.removeWorkspace);
  const setActiveWorkspace = usePackStore((state) => state.setActiveWorkspace);

  const totalPoints = useProgressStore((state) => state.totalPoints);
  const solvedCount = useProgressStore((state) => state.solvedQuestions.size);
  const streak = useProgressStore((state) => state.streak.currentStreak);
  const lastPosition = useProgressStore((state) => state.lastPosition);

  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [renamingWorkspace, setRenamingWorkspace] = useState<Workspace | null>(
    null,
  );
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(
    null,
  );

  const lastQuestion = useMemo(
    () =>
      questions.find((question) => question.id === lastPosition?.questionId) ??
      null,
    [lastPosition, questions],
  );

  const empty = databases.length === 0 || questions.length === 0;

  const openWorkspace = (workspace: Workspace): void => {
    setActiveWorkspace(workspace.id);
    router.push("/learn");
  };

  return (
    <PageShell
      title="Overview"
      subtitle={
        hydrated
          ? `${workspaces.length} workspaces · ${databases.length} databases · ${questions.length} questions · ${solvedCount} solved`
          : undefined
      }
      actions={
        <div className="flex items-center gap-2">
          <ReadyBadge hydrated={hydrated} empty={empty} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 border-border px-2 text-[11px]"
              >
                <Link href="/settings">
                  <Settings2 className="size-3" />
                  Settings
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Open settings (Ctrl+,)</TooltipContent>
          </Tooltip>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-4">
        {empty ? (
          <GetStarted hydrated={hydrated} />
        ) : (
          <section className="space-y-2">
            <h2 className="section-label">Your progress</h2>
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                label="Points"
                value={totalPoints}
                tooltip="Total practice points accumulated"
                icon={<GraduationCap className="size-3.5" />}
              />
              <StatCard
                label="Solved"
                value={solvedCount}
                tooltip="Unique graded questions completed"
                icon={<CheckCircle2 className="size-3.5" />}
              />
              <StatCard
                label="Streak"
                value={streak}
                suffix="d"
                tooltip="Consecutive active learning days"
                icon={<Flame className="size-3.5" />}
              />
            </div>

            {lastQuestion && lastPosition ? (
              <div className="flex items-center justify-between gap-4 border border-border bg-surface px-3 py-2.5">
                <div className="min-w-0">
                  <div className="section-label">Continue where you left off</div>
                  <div className="mt-0.5 truncate text-[12.5px] font-medium">
                    {lastQuestion.title}
                  </div>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild size="sm" className="h-7 gap-1.5 text-[11px]">
                      <Link
                        href={`/learn/practice?topic=${lastPosition.topicId}&q=${lastPosition.questionId}`}
                      >
                        Resume <ArrowRight className="size-3" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    Resume solving {lastQuestion.title}
                  </TooltipContent>
                </Tooltip>
              </div>
            ) : null}
          </section>
        )}

        <section className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="section-label">Workspaces</h2>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreatingWorkspace(true)}
                  className="h-7 gap-1 border-border px-2 text-[11px]"
                >
                  <Plus className="size-3" />
                  New Workspace
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                Create an isolated study workspace with its own categories
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {workspaces.map((workspace) => {
              const isActive = workspace.id === activeWorkspaceId;
              const isDefault = workspace.id === DEFAULT_WORKSPACE_ID;
              const qCount = questions.filter(
                (q) =>
                  (questionWorkspace[q.id] ?? DEFAULT_WORKSPACE_ID) ===
                  workspace.id,
              ).length;
              const nCount = notes.filter(
                (n) =>
                  (noteWorkspace[n.id] ?? DEFAULT_WORKSPACE_ID) === workspace.id,
              ).length;
              const cCount = workspaceCategories(categories, workspace.id).length;
              return (
                <div
                  key={workspace.id}
                  className={cn(
                    "flex flex-col border bg-surface p-3 transition-colors",
                    isActive
                      ? "border-primary/60"
                      : "border-border hover:border-border/80",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <FolderKanban className="size-3.5 text-primary" />
                      <span className="font-mono text-[10px] uppercase text-muted-dim">
                        {workspace.subjectId}
                      </span>
                    </span>
                    <div className="flex items-center gap-1">
                      {isActive ? (
                        <StatusChip tone="info">Active</StatusChip>
                      ) : null}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Rename ${workspace.name}`}
                            onClick={() => setRenamingWorkspace(workspace)}
                          >
                            <Pencil className="size-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Rename workspace</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              disabled={isDefault}
                              aria-label={`Delete ${workspace.name}`}
                              onClick={() => setDeletingWorkspace(workspace)}
                              className="hover:text-destructive disabled:opacity-40"
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isDefault
                            ? "Default workspace cannot be deleted"
                            : "Delete workspace and reassign items to default"}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="mt-2 text-[13px] font-semibold text-foreground">
                    {workspace.name}
                  </div>
                  {workspace.description ? (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">
                      {workspace.description}
                    </p>
                  ) : null}
                  <div className="numeric mt-2 font-mono text-[10.5px] text-muted-dim">
                    {cCount} categories · {qCount} questions · {nCount} notes
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant={isActive ? "default" : "outline"}
                      onClick={() => openWorkspace(workspace)}
                      className="h-7 gap-1 px-2.5 text-[11px]"
                    >
                      Open
                      <ArrowRight className="size-3" />
                    </Button>
                    {!isActive ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveWorkspace(workspace.id)}
                        className="h-7 px-2 text-[11px] text-muted-dim hover:text-foreground"
                      >
                        Set active
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="section-label">Learning services</h2>
            <span className="text-[10.5px] text-muted-dim">
              SQL ships today · more subjects follow
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {LEARNING_SERVICES.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                empty={empty}
              />
            ))}
          </div>
        </section>
      </div>

      {creatingWorkspace ? (
        <WorkspaceFormDialog
          mode="create"
          onClose={() => setCreatingWorkspace(false)}
          onSubmit={(name, subjectId, description) => {
            createWorkspace(name, subjectId, description);
            setCreatingWorkspace(false);
          }}
        />
      ) : null}

      {renamingWorkspace ? (
        <WorkspaceFormDialog
          mode="rename"
          initialName={renamingWorkspace.name}
          initialSubjectId={renamingWorkspace.subjectId}
          initialDescription={renamingWorkspace.description ?? ""}
          onClose={() => setRenamingWorkspace(null)}
          onSubmit={(name, _subjectId, description) => {
            renameWorkspace(renamingWorkspace.id, name, description);
            setRenamingWorkspace(null);
          }}
        />
      ) : null}

      {deletingWorkspace ? (
        <AlertDialog
          open
          onOpenChange={(open) => !open && setDeletingWorkspace(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Delete workspace {deletingWorkspace.name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Categories inside this workspace will be removed. Assigned
                questions and notes move safely back to the default workspace.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  removeWorkspace(deletingWorkspace.id);
                  setDeletingWorkspace(null);
                }}
              >
                Delete workspace
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </PageShell>
  );
}

function WorkspaceFormDialog({
  mode,
  initialName = "",
  initialSubjectId = "sql",
  initialDescription = "",
  onClose,
  onSubmit,
}: {
  mode: "create" | "rename";
  initialName?: string;
  initialSubjectId?: SubjectId;
  initialDescription?: string;
  onClose: () => void;
  onSubmit: (name: string, subjectId: SubjectId, description: string) => void;
}): React.ReactElement {
  const [name, setName] = useState(initialName);
  const [subjectId, setSubjectId] = useState<SubjectId>(initialSubjectId);
  const [description, setDescription] = useState(initialDescription);

  const handleSave = (): void => {
    if (name.trim().length === 0) return;
    onSubmit(name, subjectId, description);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0">
        <DialogHeader className="border-b border-border bg-surface-alt px-4 py-3">
          <DialogTitle className="text-[13px]">
            {mode === "create" ? "New Workspace" : "Rename Workspace"}
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            Organize your own categories, questions, and notes by topic or goal.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="workspace-name" className="text-[11.5px]">
              Name
            </Label>
            <Input
              id="workspace-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSave();
              }}
              placeholder="e.g. SQL Interview Prep"
              autoFocus
            />
          </div>
          {mode === "create" ? (
            <div className="space-y-1.5">
              <Label className="text-[11.5px]">Subject</Label>
              <Select
                value={subjectId}
                onValueChange={(value) => setSubjectId(value as SubjectId)}
              >
                <SelectTrigger className="h-8 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECT_REGISTRY.map((subject) => (
                    <SelectItem
                      key={subject.id}
                      value={subject.id}
                      disabled={subject.state !== "available"}
                    >
                      {subject.label}
                      {subject.state !== "available" ? " (Planned)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="workspace-desc" className="text-[11.5px]">
              Description (optional)
            </Label>
            <Input
              id="workspace-desc"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short description of this workspace"
            />
          </div>
        </div>
        <DialogFooter className="border-t border-border px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={name.trim().length === 0}
            onClick={handleSave}
          >
            {mode === "create" ? "Create Workspace" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ServiceCard({
  service,
  empty,
}: {
  service: LearningService;
  empty: boolean;
}): React.ReactElement {
  const Icon = SERVICE_ICONS[service.id] ?? Terminal;
  const available = service.state === "available";
  const href = available
    ? empty
      ? "/import/resources"
      : (service.href ?? "/learn")
    : null;

  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "flex size-6 items-center justify-center",
            available
              ? "bg-primary/10 text-primary"
              : "bg-surface-alt text-muted-dim",
          )}
        >
          <Icon className="size-3.5" />
        </span>
        <span
          className={cn(
            "border px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wider",
            available
              ? "border-success/40 text-success"
              : "border-border text-muted-dim",
          )}
        >
          {available ? "Available" : "Planned"}
        </span>
      </span>
      <span className="mt-2.5 block text-[12.5px] font-semibold">
        {service.label}
      </span>
      <span className="mt-1 block text-[11px] leading-relaxed text-muted">
        {service.summary}
      </span>
      <span
        className={cn(
          "mt-auto flex items-center gap-1 pt-2.5 text-[11px]",
          available ? "text-primary" : "text-muted-dim",
        )}
      >
        {available
          ? empty
            ? "Install resources"
            : "Open practice"
          : "Not yet available"}
        {available ? <ArrowRight className="size-3" /> : null}
      </span>
    </>
  );

  const className = cn(
    "flex flex-col border p-3 transition-colors",
    available
      ? "border-border bg-surface hover:border-primary/40 hover:bg-surface-hover"
      : "border-border/60 bg-surface-alt/40",
  );

  if (href !== null) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={className} aria-disabled="true">
          {body}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {service.label} is planned for a future release
      </TooltipContent>
    </Tooltip>
  );
}

function GetStarted({
  hydrated,
}: {
  hydrated: boolean;
}): React.ReactElement {
  if (!hydrated) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <section className="flex items-center justify-between gap-4 border border-border bg-surface px-4 py-4">
      <div className="min-w-0">
        <div className="text-[13px] font-semibold">
          Install learning resources
        </div>
        <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-muted">
          SQL and Interview SQL ship as validated bundles: the seeded database,
          its questions and its notes are checked together before anything is
          stored.
        </p>
      </div>
      <Button asChild size="sm" className="h-7 gap-1.5 text-[11px]">
        <Link href="/import/resources">
          Browse resources <ArrowRight className="size-3" />
        </Link>
      </Button>
    </section>
  );
}

function StatCard({
  label,
  value,
  suffix,
  tooltip,
  icon,
}: {
  label: string;
  value: number;
  suffix?: string;
  tooltip: string;
  icon: React.ReactNode;
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="border border-border bg-surface px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-muted-dim">
            {icon}
            <span className="section-label">{label}</span>
          </div>
          <div className="numeric mt-1 text-xl font-semibold leading-none">
            {value}
            {suffix ? (
              <span className="text-[12px] text-muted-dim">{suffix}</span>
            ) : null}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function ReadyBadge({
  hydrated,
  empty,
}: {
  hydrated: boolean;
  empty: boolean;
}): React.ReactElement {
  if (!hydrated) {
    return (
      <span className="flex items-center gap-1.5 text-[10.5px] text-muted-dim">
        <Loader2 className="size-3 animate-spin" /> Loading
      </span>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
            empty ? "bg-warning/10 text-warning" : "bg-success/10 text-success",
          )}
        >
          <span
            className={cn("size-1.5", empty ? "bg-warning" : "bg-success")}
          />
          {empty ? "No resources" : "Ready"}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {empty
          ? "Install an official resource bundle or create custom packs"
          : "Databases and practice bundles are loaded locally"}
      </TooltipContent>
    </Tooltip>
  );
}
