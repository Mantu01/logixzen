"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ClipboardPaste,
  Copy,
  Download,
  FilePlus2,
  Loader2,
  Package,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { PageShell } from "@/components/app-shell/page-shell";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { InstallReport } from "@/components/packs/install-report";
import type { InstallStatus } from "@/components/packs/install-report";
import { summarizePacks, usePackStore } from "@/stores/usePackStore";
import { useSqlStore } from "@/sql/useSqlStore";
import { serializeNotesPack, serializeQuestionsPack } from "@/lib/packs/packs";
import { PACK_PROMPTS } from "@/lib/packs/prompts";
import { OFFICIAL_RESOURCES } from "@/lib/packs/official";
import { buildDatasetFromSql, dbNameFromSql } from "@/lib/dataset-from-sql";
import { saveTextFile } from "@/lib/save-file";
import { activeSubject } from "@/lib/subjects";
import { cn, errorMessage } from "@/lib/utils";
import type { InstallCounts } from "@/lib/categories";

const ACCEPT = ".sql,.txt,.json,application/json";

export default function ImportPage(): React.ReactElement {
  const packState = usePackStore();
  const summary = summarizePacks(packState);
  const missingDatasets = useMemo(
    () => findMissingDatasets(packState.databases, packState.questions),
    [packState.databases, packState.questions],
  );

  return (
    <PageShell
      title="Data Hub"
      subtitle="Install curated resources, bring your own content, and keep every reference consistent"
    >
      <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4">
        <ResourceCta installed={packState.installedResources.length} />
        <ImportSection />
        <InstalledPanel
          summary={summary}
          missing={missingDatasets}
          onExportSql={exportDatabasesSql}
          onExportQuestions={() =>
            exportJson(
              "logixzen-questions.json",
              serializeQuestionsPack(packState.topics, packState.questions),
            )
          }
          onExportNotes={() =>
            exportJson("logixzen-notes.json", serializeNotesPack(packState.notes))
          }
          onClear={() => packState.resetAll()}
          canClear={
            packState.databases.length > 0 ||
            packState.questions.length > 0 ||
            packState.notes.length > 0
          }
        />
        <PromptSection />
      </div>
    </PageShell>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section>
      <div className="mb-2">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        <p className="mt-0.5 max-w-2xl text-[11.5px] text-muted-dim">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function ResourceCta({ installed }: { installed: number }): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-4 border border-primary/40 bg-primary/5 px-4 py-3.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Package className="size-4 text-primary" />
          <h2 className="text-[13.5px] font-semibold">Install our resources</h2>
        </div>
        <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-muted">
          Ready-made tracks such as Basic SQL and Interview SQL. Each install
          brings the database, its questions and its notes together, validated
          as one unit.
        </p>
        <p className="numeric mt-1 text-[10.5px] text-muted-dim">
          {installed} of {OFFICIAL_RESOURCES.length} resources installed
        </p>
      </div>
      <LinkButton href="/import/resources" label="Browse resources" />
    </div>
  );
}

function LinkButton({
  href,
  label,
}: {
  href: string;
  label: string;
}): React.ReactElement {
  return (
    <Link href={href}>
      <Button size="sm" className="gap-1.5">
        {label} <ArrowRight className="size-3.5" />
      </Button>
    </Link>
  );
}

function InstalledPanel({
  summary,
  missing,
  onExportSql,
  onExportQuestions,
  onExportNotes,
  onClear,
  canClear,
}: {
  summary: ReturnType<typeof summarizePacks>;
  missing: Array<{ datasetId: string; count: number }>;
  onExportSql: () => void;
  onExportQuestions: () => void;
  onExportNotes: () => void;
  onClear: () => void;
  canClear: boolean;
}): React.ReactElement {
  const stats: Array<[string, number]> = [
    ["databases", summary.databases],
    ["questions", summary.questions],
    ["topics", summary.topics],
    ["categories", summary.categories],
    ["notes", summary.notes],
  ];
  return (
    <Section
      title="Installed"
      description="Everything stored on this machine, with a reference check across all of it."
    >
      <div className="border border-border bg-surface">
        <div className="grid grid-cols-5 divide-x divide-border">
          {stats.map(([label, value]) => (
            <div key={label} className="px-3 py-2.5">
              <div className="numeric text-[17px] font-semibold leading-none">
                {value}
              </div>
              <div className="section-label mt-1">{label}</div>
            </div>
          ))}
        </div>
        <div className="border-t border-border px-3 py-2.5">
          {missing.length === 0 ? (
            <p className="flex items-center gap-1.5 text-[11.5px] text-success">
              <Check className="size-3.5" /> Every question resolves to an
              installed database.
            </p>
          ) : (
            <ul className="space-y-1">
              {missing.map((entry) => (
                <li
                  key={entry.datasetId}
                  className="flex items-center gap-1.5 text-[11.5px] text-warning"
                >
                  <AlertTriangle className="size-3.5 shrink-0" />
                  <span className="numeric">
                    {entry.count} question{entry.count === 1 ? "" : "s"}
                  </span>
                  reference dataset
                  <code className="border border-border bg-surface-alt px-1 font-mono text-[11px]">
                    {entry.datasetId}
                  </code>
                  which is not installed.
                </li>
              ))}
              <li className="pl-5 text-[11px] text-muted-dim">
                Install a resource that provides it, or drop in the matching
                {` ${activeSubject.scriptExtension} `}file below.
              </li>
            </ul>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2.5">
          <span className="text-[10.5px] text-muted-dim">
            Content only — progress, points and streaks are never written into
            exported files.
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={summary.databases === 0}
              onClick={onExportSql}
            >
              <Download className="size-3.5" /> .sql
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={summary.questions === 0}
              onClick={onExportQuestions}
            >
              <Download className="size-3.5" /> Questions
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={summary.notes === 0}
              onClick={onExportNotes}
            >
              <Download className="size-3.5" /> Notes
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  disabled={!canClear}
                >
                  <Trash2 className="size-3.5" /> Clear all
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove all installed content?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes every database, question, category and note
                    from this machine. Your progress is not affected.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={onClear}
                  >
                    Remove everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    </Section>
  );
}

function ImportSection(): React.ReactElement {
  const [status, setStatus] = useState<InstallStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = useCallback(async (text: string, fileName: string) => {
    setBusy(true);
    setStatus(null);
    setMessage(null);
    try {
      if (looksLikeJson(text, fileName)) {
        const outcome = usePackStore.getState().importFile(text);
        setStatus({ ok: outcome.ok, issues: outcome.issues });
        setMessage(outcome.ok ? describeCounts(outcome.counts) : null);
        return;
      }
      const dataset = await buildDatasetFromSql(
        dbNameFromSql(text, fileName.replace(/\.(sql|txt)$/i, "")),
        text,
      );
      const outcome = usePackStore
        .getState()
        .installContent({ databases: [dataset] });
      setStatus({ ok: outcome.ok, issues: outcome.issues });
      if (outcome.ok) {
        await useSqlStore.getState().activateDataset(dataset.id);
        setMessage(
          `${describeCounts(outcome.counts)} — activated in the editor`,
        );
      }
    } catch (error) {
      setStatus({ ok: false, issues: [{ path: "file", message: errorMessage(error) }] });
    } finally {
      setBusy(false);
    }
  }, []);

  const readFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => void run(String(reader.result ?? ""), file.name);
      reader.readAsText(file);
    },
    [run],
  );

  return (
    <Section
      title="Bring your own content"
      description={`One drop handles everything. A ${activeSubject.scriptExtension} script seeds a database, a .json pack brings questions or notes — both are executed and validated against the live engine before anything is stored.`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Import content file"
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) readFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        className={cn(
          "flex h-28 cursor-pointer flex-col items-center justify-center gap-1.5 border border-dashed transition-colors",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border bg-surface-alt/60 hover:border-primary/40",
          busy && "opacity-60",
        )}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin text-primary" />
        ) : (
          <Upload className="size-4 text-muted-dim" />
        )}
        <span className="text-[12px] font-medium">
          {busy
            ? "Validating against the SQL engine…"
            : "Drop a content file here"}
        </span>
        <span className="text-[10.5px] text-muted-dim">
          or click to browse · {ACCEPT} · {activeSubject.label} engine runs the
          script first
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) readFile(file);
          event.target.value = "";
        }}
      />
      <PasteImport onSubmit={(text) => void run(text, "pasted.txt")} />
      <InstallReport status={status} message={message} />
    </Section>
  );
}

function PasteImport({
  onSubmit,
}: {
  onSubmit: (text: string) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const submit = (): void => {
    onSubmit(text);
    setOpen(false);
    setText("");
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="mt-2 gap-1.5">
          <ClipboardPaste className="size-3.5" /> Paste content instead
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[86vh] max-w-2xl flex-col gap-0 p-0"
        showCloseButton={false}
      >
        <div className="shrink-0 border-b border-border bg-surface-alt px-4 py-3">
          <DialogTitle className="text-[13px]">Paste content</DialogTitle>
          <DialogDescription className="mt-0.5 text-[11px]">
            The content is validated before anything is stored.
          </DialogDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              'CREATE DATABASE school;\nUSE school;\nCREATE TABLE students (id INTEGER PRIMARY KEY, name TEXT NOT NULL);'
            }
            className="min-h-[320px] resize-none font-mono text-[12px]"
          />
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={text.trim().length === 0} onClick={submit}>
            Validate &amp; import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PromptSection(): React.ReactElement {
  return (
    <Section
      title="Generate with AI"
      description="Copy a system prompt into any AI assistant and import the validated file it produces."
    >
      <div className="grid grid-cols-3 gap-2.5">
        {(Object.keys(PACK_PROMPTS) as Array<keyof typeof PACK_PROMPTS>).map(
          (kind) => (
            <PromptCard key={kind} kind={kind} />
          ),
        )}
      </div>
    </Section>
  );
}

function PromptCard({
  kind,
}: {
  kind: keyof typeof PACK_PROMPTS;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(PACK_PROMPTS[kind]);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [kind]);

  return (
    <div className="flex flex-col border border-border bg-surface p-3 transition-colors hover:border-foreground/30">
      <div className="flex items-center gap-2">
        <FilePlus2 className="size-3.5 text-primary" />
        <span className="text-[12.5px] font-semibold capitalize">
          {kind} prompt
        </span>
      </div>
      <p className="mt-1 flex-1 text-[11px] leading-relaxed text-muted">
        Paste into Claude, ChatGPT, or Gemini to get a compliant schema-validated {kind} pack.
      </p>
      <Button
        size="xs"
        variant="outline"
        className="mt-2.5 gap-1.5"
        onClick={() => void copy()}
      >
        {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
        {copied ? "Prompt copied" : "Copy prompt"}
      </Button>
    </div>
  );
}

function exportDatabasesSql(): void {
  const store = usePackStore.getState();
  const header = (name: string, description: string): string =>
    `-- ============================== ${name} ==============================\n-- ${description}\n`;
  const body = store.databases
    .map(
      (dataset) =>
        `${header(dataset.name, dataset.description)}${dataset.setupSql.trim()}`,
    )
    .join("\n\n");
  exportTextFile("logixzen-databases.sql", `${body}\n`, [
    { name: "SQL", extensions: ["sql"] },
  ]);
}

function exportJson(fileName: string, content: string): void {
  exportTextFile(fileName, content, [{ name: "JSON", extensions: ["json"] }]);
}

function exportTextFile(
  fileName: string,
  content: string,
  filters: Array<{ name: string; extensions: string[] }>,
): void {
  void saveTextFile(fileName, content, filters);
}

function looksLikeJson(text: string, fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".json") || text.trimStart().startsWith("{");
}

function describeCounts(counts: InstallCounts): string {
  const parts: string[] = [];
  if (counts.databases > 0) {
    parts.push(`${counts.databases} database${counts.databases === 1 ? "" : "s"}`);
  }
  if (counts.questions > 0) {
    parts.push(`${counts.questions} questions`);
  }
  if (counts.notes > 0) parts.push(`${counts.notes} notes`);
  return `${parts.join(" · ") || "Content"} installed`;
}

function findMissingDatasets(
  databases: Array<{ id: string }>,
  questions: Array<{ id: string; datasetId: string }>,
): Array<{ datasetId: string; count: number }> {
  const known = new Set(databases.map((dataset) => dataset.id));
  const counts = new Map<string, number>();
  for (const question of questions) {
    if (known.has(question.datasetId)) continue;
    counts.set(question.datasetId, (counts.get(question.datasetId) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([datasetId, count]) => ({ datasetId, count }))
    .sort((a, b) => b.count - a.count);
}
