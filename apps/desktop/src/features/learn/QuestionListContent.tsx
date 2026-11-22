"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChevronLeft, Plus, Search, Trash2 } from "lucide-react";
import { PageShell } from "@/components/app-shell/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePackStore } from "@/stores/usePackStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { cn } from "@/lib/utils";
import { UNCATEGORIZED, questionsInCategory } from "@/lib/categories";
import type { Question, Topic } from "@logixzen/shared/content";

type ListSource =
  | { kind: "topic"; id: string }
  | { kind: "category"; id: string };

export function QuestionListContent({
  source,
}: {
  source: ListSource;
}): React.ReactElement {
  const questions = usePackStore((state) => state.questions);
  const topics = usePackStore((state) => state.topics);
  const categories = usePackStore((state) => state.categories);
  const assignments = usePackStore((state) => state.questionCategory);
  const databases = usePackStore((state) => state.databases);
  const hydrated = usePackStore((state) => state.hydrated);
  const addQuestion = usePackStore((state) => state.addQuestion);
  const removeQuestion = usePackStore((state) => state.removeQuestion);
  const solved = useProgressStore((state) => state.solvedQuestions);
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState<
    "all" | "easy" | "medium" | "hard"
  >("all");

  const sourceQuestions = useMemo(
    () =>
      source.kind === "topic"
        ? questions.filter((question) => question.topicId === source.id)
        : questionsInCategory(questions, assignments, source.id),
    [questions, source, assignments],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sourceQuestions.filter((question) => {
      if (difficulty !== "all" && question.difficulty !== difficulty)
        return false;
      if (term === "") return true;
      return (
        question.title.toLowerCase().includes(term) ||
        question.description.toLowerCase().includes(term) ||
        question.tags.some((tag) => tag.toLowerCase().includes(term))
      );
    });
  }, [sourceQuestions, search, difficulty]);

  const solvedCount = sourceQuestions.filter((question) =>
    solved.has(question.id),
  ).length;

  const title =
    source.kind === "topic"
      ? topicTitle(topics, source.id)
      : categoryTitle(categories, source.id);

  return (
    <PageShell
      title={title}
      subtitle={
        hydrated ? `${solvedCount}/${sourceQuestions.length} solved` : undefined
      }
      actions={
        <div className="flex items-center gap-2">
          <NewQuestionDialog
            source={source}
            databases={databases}
            onAdd={(newQ) =>
              addQuestion(
                newQ,
                source.kind === "category" && source.id !== UNCATEGORIZED
                  ? source.id
                  : null,
              )
            }
          />
          <Link
            href="/learn"
            className="flex items-center gap-1 text-[11.5px] text-muted transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-3.5" />{" "}
            {source.kind === "topic" ? "All topics" : "All categories"}
          </Link>
        </div>
      }
    >
      <div className="mx-auto max-w-4xl px-5 py-6">
        <div className="mb-4 flex items-center gap-1.5 font-mono text-[11px] text-muted-dim">
          <Link href="/" className="hover:text-foreground">
            Workspace
          </Link>
          <span>/</span>
          <Link href="/learn" className="hover:text-foreground">
            {source.kind === "topic" ? "Topics" : "Categories"}
          </Link>
          <span>/</span>
          <span className="font-medium text-foreground">{title}</span>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-dim" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search questions"
              className="h-8 w-64 pl-8"
            />
          </div>
          <div className="flex border border-border">
            {(["all", "easy", "medium", "hard"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDifficulty(value)}
                className={cn(
                  "h-8 px-3 text-[11.5px] capitalize transition-colors",
                  difficulty === value
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-dim hover:bg-surface-hover hover:text-foreground",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        {sourceQuestions.length === 0 && hydrated ? (
          <p className="border border-border bg-surface px-4 py-10 text-center text-[12.5px] text-muted-dim">
            No questions here yet.{" "}
            <Link href="/import/resources" className="text-primary hover:underline">
              Install a resource
            </Link>{" "}
            or create a question with New Question above.
          </p>
        ) : null}

        <div className="divide-y divide-border border border-border bg-surface">
          {visible.map((question, index) => (
            <QuestionRow
              key={question.id}
              question={question}
              index={index}
              source={source}
              solved={solved.has(question.id)}
              onDelete={() => removeQuestion(question.id)}
            />
          ))}
        </div>
      </div>
    </PageShell>
  );
}

function topicTitle(topics: Topic[], id: string): string {
  return topics.find((topic) => topic.id === id)?.title ?? id.replace(/[-_]+/g, " ");
}

function categoryTitle(
  categories: Array<{ id: string; name: string }>,
  id: string,
): string {
  if (id === UNCATEGORIZED) return "Uncategorised";
  return categories.find((category) => category.id === id)?.name ?? "Category";
}

function QuestionRow({
  question,
  index,
  source,
  solved,
  onDelete,
}: {
  question: Question;
  index: number;
  source: ListSource;
  solved: boolean;
  onDelete: () => void;
}): React.ReactElement {
  const practiceHref = `/learn/practice?${
    source.kind === "category" ? `category=${source.id}&` : ""
  }topic=${question.topicId}&q=${question.id}`;

  return (
    <div className="group flex h-12 items-center gap-3 px-4 transition-colors hover:bg-surface-hover">
      <Link
        href={practiceHref}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center border text-[10px]",
            solved
              ? "border-success/40 bg-success/10 text-success"
              : "border-border text-muted-dim",
          )}
        >
          {solved ? <Check className="size-3" /> : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">
            {question.title}
          </span>
          <span className="block truncate text-[10.5px] text-muted-dim">
            {question.tags.join(" · ")}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 border px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wider",
            question.difficulty === "easy" && "border-success/40 text-success",
            question.difficulty === "medium" && "border-warning/40 text-warning",
            question.difficulty === "hard" && "border-error/40 text-error",
          )}
        >
          {question.difficulty}
        </span>
        <span className="numeric w-10 shrink-0 text-right text-[10.5px] text-muted-dim">
          {question.points} pts
        </span>
      </Link>
      <button
        type="button"
        aria-label={`Delete question ${question.title}`}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        className="flex size-6 shrink-0 items-center justify-center text-muted-dim opacity-0 transition-opacity hover:text-error group-hover:opacity-100"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}

function NewQuestionDialog({
  source,
  databases,
  onAdd,
}: {
  source: ListSource;
  databases: Array<{ id: string; name: string }>;
  onAdd: (q: Question) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    "easy",
  );
  const [points, setPoints] = useState(10);
  const [datasetId, setDatasetId] = useState(databases[0]?.id ?? "school");
  const [solutionSql, setSolutionSql] = useState("");
  const [tagsInput, setTagsInput] = useState("sql");

  const save = (): void => {
    if (title.trim().length === 0) return;
    const id = `user-q-${Date.now()}`;
    const topicId = source.kind === "topic" ? source.id : "custom";
    const tags = tagsInput
      .split(/[,·]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    const question: Question = {
      id,
      topicId,
      type: "query",
      difficulty,
      title: title.trim(),
      description: description.trim(),
      datasetId: datasetId || databases[0]?.id || "school",
      points,
      tags: tags.length > 0 ? tags : ["sql"],
      hints: ["Inspect the table structure in Schema to plan your query."],
      explanation: "",
      solutionSql: solutionSql.trim(),
      validation: {
        mode: "result-match",
        columnNamesMatter: false,
        columnOrderMatters: false,
        orderMatters: true,
        floatTolerance: 0.001,
        caseSensitiveStrings: false,
      },
      testCases: [
        { id: `${id}-tc-1`, expected: { type: "fromSolution" }, hidden: false },
      ],
    };

    onAdd(question);
    setOpen(false);
    setTitle("");
    setDescription("");
    setSolutionSql("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-3.5" /> New question
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="border-b border-border bg-surface-alt px-4 py-3">
          <DialogTitle className="text-[13px]">Create Question</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 p-4">
          <div>
            <label className="section-label mb-1 block">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Find Active Students"
              className="h-8"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="section-label mb-1 block">Difficulty</label>
              <Select
                value={difficulty}
                onValueChange={(v) =>
                  setDifficulty(v as "easy" | "medium" | "hard")
                }
              >
                <SelectTrigger size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="section-label mb-1 block">Points</label>
              <Input
                type="number"
                value={points}
                onChange={(e) => setPoints(Number(e.target.value) || 10)}
                className="h-8"
              />
            </div>
            <div>
              <label className="section-label mb-1 block">Database</label>
              <Select value={datasetId} onValueChange={setDatasetId}>
                <SelectTrigger size="sm">
                  <SelectValue placeholder="Database" />
                </SelectTrigger>
                <SelectContent>
                  {databases.map((db) => (
                    <SelectItem key={db.id} value={db.id}>
                      {db.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="section-label mb-1 block">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Question statement or prompt..."
              rows={3}
              className="text-[12px]"
            />
          </div>
          <div>
            <label className="section-label mb-1 block">
              Reference Solution SQL
            </label>
            <Textarea
              value={solutionSql}
              onChange={(e) => setSolutionSql(e.target.value)}
              placeholder="SELECT * FROM students WHERE status = 'active';"
              rows={3}
              className="font-mono text-[11.5px]"
            />
          </div>
          <div>
            <label className="section-label mb-1 block">Tags (comma-separated)</label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="sql, select, filter"
              className="h-8"
            />
          </div>
        </div>
        <DialogFooter className="border-t border-border px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={title.trim().length === 0} onClick={save}>
            Save question
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
