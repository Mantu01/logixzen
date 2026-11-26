"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePackStore } from "@/stores/usePackStore";
import { useProgressStore } from "@/stores/useProgressStore";
import {
  DEFAULT_WORKSPACE_ID,
  UNCATEGORIZED,
  categoryCounts,
  workspaceCategories,
  type QuestionCategory,
} from "@/lib/categories";
import { cn } from "@/lib/utils";

interface CategoryRow {
  category: QuestionCategory | null;
  count: number;
  solved: number;
}

export function CategoriesSection(): React.ReactElement {
  const allQuestions = usePackStore((state) => state.questions);
  const allCategories = usePackStore((state) => state.categories);
  const activeWorkspaceId =
    usePackStore((state) => state.activeWorkspaceId) || DEFAULT_WORKSPACE_ID;
  const questionWorkspace = usePackStore((state) => state.questionWorkspace);
  const reorderCategory = usePackStore((state) => state.reorderCategory);
  const assignments = usePackStore((state) => state.questionCategory);
  const solved = useProgressStore((state) => state.solvedQuestions);
  const [renaming, setRenaming] = useState<QuestionCategory | null>(null);
  const [managing, setManaging] = useState<QuestionCategory | null>(null);
  const [removing, setRemoving] = useState<QuestionCategory | null>(null);

  const questions = useMemo(
    () =>
      allQuestions.filter(
        (q) =>
          (questionWorkspace[q.id] ?? DEFAULT_WORKSPACE_ID) ===
          activeWorkspaceId,
      ),
    [allQuestions, questionWorkspace, activeWorkspaceId],
  );

  const categories = useMemo(
    () => workspaceCategories(allCategories, activeWorkspaceId),
    [allCategories, activeWorkspaceId],
  );

  const rows = useMemo<CategoryRow[]>(() => {
    const solvedBy = new Map<string, number>();
    for (const question of questions) {
      if (!solved.has(question.id)) continue;
      const key = assignments[question.id] ?? UNCATEGORIZED;
      solvedBy.set(key, (solvedBy.get(key) ?? 0) + 1);
    }
    return categoryCounts(questions, assignments, categories).map((entry) => ({
      ...entry,
      solved: solvedBy.get(entry.category?.id ?? UNCATEGORIZED) ?? 0,
    }));
  }, [questions, assignments, categories, solved]);

  if (questions.length === 0) {
    return (
      <p className="border border-border bg-surface px-4 py-10 text-center text-[12.5px] text-muted-dim">
        No questions in this workspace yet.{" "}
        <Link href="/import/resources" className="text-primary hover:underline">
          Install a resource
        </Link>{" "}
        to start grouping them.
      </p>
    );
  }

  return (
    <div>
      <div className="divide-y divide-border border border-border bg-surface">
        {rows.map((row, index) => (
          <CategoryRowItem
            key={row.category?.id ?? UNCATEGORIZED}
            row={row}
            index={index}
            canMoveUp={row.category !== null && index > 0}
            canMoveDown={
              row.category !== null && index < categories.length - 1
            }
            onMoveUp={() =>
              row.category && reorderCategory(row.category.id, "up")
            }
            onMoveDown={() =>
              row.category && reorderCategory(row.category.id, "down")
            }
            onRename={() => setRenaming(row.category)}
            onManage={() => setManaging(row.category)}
            onRemove={() => setRemoving(row.category)}
          />
        ))}
        <NewCategoryRow />
      </div>
      {renaming ? (
        <RenameDialog
          key={renaming.id}
          category={renaming}
          onClose={() => setRenaming(null)}
        />
      ) : null}
      {managing ? (
        <ManageDialog
          key={managing.id}
          category={managing}
          onClose={() => setManaging(null)}
        />
      ) : null}
      {removing ? (
        <RemoveDialog
          category={removing}
          onClose={() => setRemoving(null)}
        />
      ) : null}
    </div>
  );
}

function CategoryRowItem({
  row,
  index,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onRename,
  onManage,
  onRemove,
}: {
  row: CategoryRow;
  index: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRename: () => void;
  onManage: () => void;
  onRemove: () => void;
}): React.ReactElement {
  const id = row.category?.id ?? UNCATEGORIZED;
  const name = row.category?.name ?? "Uncategorised";
  const percent = row.count === 0 ? 0 : Math.round((row.solved / row.count) * 100);
  return (
    <div className="group flex h-14 items-center gap-4 px-4 transition-colors hover:bg-surface-hover">
      <Link
        href={`/learn/category?id=${id}`}
        className="flex min-w-0 flex-1 items-center gap-4"
      >
        <span className="numeric w-6 shrink-0 font-mono text-[10px] text-muted-dim">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-medium">{name}</span>
          <span className="numeric mt-0.5 block text-[10.5px] text-muted-dim">
            {row.count} questions · {row.solved} solved
          </span>
        </span>
        <span className="flex w-40 shrink-0 items-center gap-2">
          <span className="h-1 flex-1 bg-surface-hover">
            <span
              className={cn(
                "block h-full",
                percent === 100 ? "bg-success" : "bg-primary",
              )}
              style={{ width: `${percent}%` }}
            />
          </span>
          <span className="numeric w-8 text-right text-[10.5px] text-muted-dim">
            {percent}%
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-dim opacity-0 transition-opacity group-hover:opacity-100" />
      </Link>
      {row.category ? (
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <RowButton label="Move up" onClick={onMoveUp} disabled={!canMoveUp}>
            <ArrowUp className="size-3.5" />
          </RowButton>
          <RowButton
            label="Move down"
            onClick={onMoveDown}
            disabled={!canMoveDown}
          >
            <ArrowDown className="size-3.5" />
          </RowButton>
          <RowButton label="Rename category" onClick={onRename}>
            <Pencil className="size-3.5" />
          </RowButton>
          <RowButton label="Choose questions" onClick={onManage}>
            <ListChecks className="size-3.5" />
          </RowButton>
          <RowButton label="Delete category" onClick={onRemove} danger>
            <Trash2 className="size-3.5" />
          </RowButton>
        </span>
      ) : null}
    </div>
  );
}

function RowButton({
  label,
  onClick,
  danger,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            "flex size-7 items-center justify-center text-muted-dim transition-colors hover:bg-surface hover:text-foreground disabled:pointer-events-none disabled:opacity-30",
            danger && "hover:text-destructive",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

function NewCategoryRow(): React.ReactElement {
  const createCategory = usePackStore((state) => state.createCategory);
  const [name, setName] = useState("");
  const submit = (): void => {
    if (createCategory(name) !== null) setName("");
  };
  return (
    <div className="flex h-12 items-center gap-2 px-4">
      <Plus className="size-3.5 shrink-0 text-muted-dim" />
      <Input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") submit();
        }}
        placeholder="New category name — e.g. SQL basics"
        aria-label="New category name"
        className="h-7 flex-1 border-0 bg-transparent px-0 text-[12.5px] focus-visible:ring-0"
      />
      <Button
        size="xs"
        variant="outline"
        disabled={name.trim().length === 0}
        onClick={submit}
      >
        Add
      </Button>
    </div>
  );
}

function RenameDialog({
  category,
  onClose,
}: {
  category: QuestionCategory;
  onClose: () => void;
}): React.ReactElement {
  const renameCategory = usePackStore((state) => state.renameCategory);
  const [name, setName] = useState(category.name);
  const submit = (): void => {
    renameCategory(category.id, name);
    onClose();
  };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm p-0">
        <DialogHeader className="border-b border-border bg-surface-alt px-4 py-3">
          <DialogTitle className="text-[13px]">Rename category</DialogTitle>
          <DialogDescription className="text-[11px]">
            Questions keep their assignment.
          </DialogDescription>
        </DialogHeader>
        <div className="px-4 py-4">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            autoFocus
            aria-label="Category name"
          />
        </div>
        <DialogFooter className="border-t border-border px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={name.trim().length === 0} onClick={submit}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageDialog({
  category,
  onClose,
}: {
  category: QuestionCategory;
  onClose: () => void;
}): React.ReactElement {
  const allQuestions = usePackStore((state) => state.questions);
  const activeWorkspaceId =
    usePackStore((state) => state.activeWorkspaceId) || DEFAULT_WORKSPACE_ID;
  const questionWorkspace = usePackStore((state) => state.questionWorkspace);
  const targetWorkspaceId = category.workspaceId ?? activeWorkspaceId;
  const questions = useMemo(
    () =>
      allQuestions.filter(
        (q) =>
          (questionWorkspace[q.id] ?? DEFAULT_WORKSPACE_ID) ===
          targetWorkspaceId,
      ),
    [allQuestions, questionWorkspace, targetWorkspaceId],
  );
  const assignments = usePackStore((state) => state.questionCategory);
  const setQuestionCategories = usePackStore(
    (state) => state.setQuestionCategories,
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        questions
          .filter((question) => assignments[question.id] === category.id)
          .map((question) => question.id),
      ),
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term === "") return questions;
    return questions.filter(
      (question) =>
        question.title.toLowerCase().includes(term) ||
        question.tags.some((tag) => tag.toLowerCase().includes(term)),
    );
  }, [questions, search]);

  const save = (): void => {
    const assign = questions
      .filter(
        (question) =>
          selected.has(question.id) && assignments[question.id] !== category.id,
      )
      .map((question) => question.id);
    const release = questions
      .filter(
        (question) =>
          !selected.has(question.id) && assignments[question.id] === category.id,
      )
      .map((question) => question.id);
    if (assign.length > 0) setQuestionCategories(assign, category.id);
    if (release.length > 0) setQuestionCategories(release, null);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex max-h-[80vh] max-w-2xl flex-col gap-0 p-0"
        showCloseButton={false}
      >
        <DialogHeader className="shrink-0 border-b border-border bg-surface-alt px-4 py-3">
          <DialogTitle className="text-[13px]">
            Questions in {category.name}
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            {selected.size} of {questions.length} selected — a question belongs
            to one category at a time.
          </DialogDescription>
        </DialogHeader>
        <div className="shrink-0 border-b border-border px-4 py-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-dim" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search questions"
              aria-label="Search questions"
              className="h-7 pl-8"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="px-4 py-8 text-center text-[11.5px] text-muted-dim">
              No questions match
            </p>
          ) : null}
          {visible.map((question) => (
            <label
              key={question.id}
              className="flex cursor-pointer items-center gap-3 border-b border-border/60 px-4 py-2 transition-colors last:border-b-0 hover:bg-surface-hover"
            >
              <Checkbox
                checked={selected.has(question.id)}
                onCheckedChange={(checked) =>
                  setSelected((previous) => {
                    const next = new Set(previous);
                    if (checked === true) next.add(question.id);
                    else next.delete(question.id);
                    return next;
                  })
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium">
                  {question.title}
                </span>
                <span className="block truncate text-[10.5px] text-muted-dim">
                  {question.topicId.replace(/[-_]/g, " ")}
                </span>
              </span>
              <span className="numeric shrink-0 text-[10.5px] text-muted-dim">
                {question.points} pts
              </span>
            </label>
          ))}
        </div>
        <DialogFooter className="shrink-0 border-t border-border px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={save}>
            Save selection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveDialog({
  category,
  onClose,
}: {
  category: QuestionCategory;
  onClose: () => void;
}): React.ReactElement {
  const removeCategory = usePackStore((state) => state.removeCategory);
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {category.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The category is removed. Its questions stay installed and move to
            Uncategorised.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              removeCategory(category.id);
              onClose();
            }}
          >
            Delete category
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
