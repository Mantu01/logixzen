"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ClipboardPaste,
  Copy,
  Database,
  Download,
  FileJson,
  FilePlus2,
  FlaskConical,
  Loader2,
  NotebookPen,
  Trash2,
  Upload,
} from "lucide-react";
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
import { summarizePacks, usePackStore } from "@/stores/usePackStore";
import type { PackImportOutcome } from "@/stores/usePackStore";
import {
  OFFICIAL_PACKS,
  fetchOfficialPack,
  isConfigured,
} from "@/lib/packs/official";
import { PACK_PROMPTS } from "@/lib/packs/prompts";
import { serializeNotesPack, serializeQuestionsPack } from "@/lib/packs/packs";
import { saveTextFile } from "@/lib/save-file";
import { buildDatasetFromSql, dbNameFromSql } from "@/lib/dataset-from-sql";
import { useSqlStore } from "@/sql/useSqlStore";
import { activeSubject } from "@/lib/subjects";
import { cn } from "@/lib/utils";

type PackTab = "databases" | "questions" | "notes";

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
  void saveTextFile("logixzen-databases.sql", `${body}\n`, [
    { name: "SQL", extensions: ["sql"] },
  ]);
}

function exportInstalledJson(kind: "questions" | "notes"): void {
  const store = usePackStore.getState();
  const content =
    kind === "questions"
      ? serializeQuestionsPack(store.topics, store.questions)
      : serializeNotesPack(store.notes);
  void saveTextFile(`logixzen-${kind}.json`, content, [
    { name: "JSON", extensions: ["json"] },
  ]);
}

const TABS: Array<{
  key: PackTab;
  label: string;
  icon: React.ReactNode;
  hint: string;
}> = [
  {
    key: "databases",
    label: activeSubject.dataLabel,
    icon: <Database className="size-3.5" />,
    hint: `${activeSubject.label} dataset — ${activeSubject.scriptExtension} script`,
  },
  {
    key: "questions",
    label: "Questions",
    icon: <FlaskConical className="size-3.5" />,
    hint: "Question pack — .json",
  },
  {
    key: "notes",
    label: "Notes",
    icon: <NotebookPen className="size-3.5" />,
    hint: "Notes pack — .json",
  },
];

const ACCEPT: Record<PackTab, string> = {
  databases: ".sql,.txt",
  questions: ".json,application/json",
  notes: ".json,application/json",
};

export default function ImportPage(): React.ReactElement {
  const [tab, setTab] = useState<PackTab>("databases");
  const packState = usePackStore();
  const summary = summarizePacks(packState);
  const counts: Record<PackTab, number> = {
    databases: summary.databases,
    questions: summary.questions,
    notes: summary.notes,
  };

  return (
    <PageShell
      title="Data Hub"
      subtitle="Content hub for every subject — datasets, question packs and notes. SQL is supported today, more subjects tomorrow."
    >
      <div className="mx-auto max-w-4xl px-5 py-6">
        <div className="mb-6 grid grid-cols-3 gap-2">
          {TABS.map((entry) => (
            <SummaryCard
              key={entry.key}
              icon={entry.icon}
              label={entry.label}
              hint={entry.hint}
              value={counts[entry.key]}
              active={tab === entry.key}
              onClick={() => setTab(entry.key)}
            />
          ))}
        </div>

        <section className="mb-6">
          <SectionHeader
            title={
              tab === "databases"
                ? `Import a ${activeSubject.label} dataset (${activeSubject.scriptExtension})`
                : `Import a ${tab} pack (.json)`
            }
            description="Drop a file, browse for one, or paste its contents. Everything is validated before it is stored."
          />
          <ImportDropzone tab={tab} />
        </section>

        <section className="mb-6">
          <SectionHeader
            title="Official packs"
            description="Download the official packs from GitHub and install them locally."
          />
          <div className="grid grid-cols-3 gap-2">
            {OFFICIAL_PACKS.map((pack) => (
              <OfficialCard key={pack.kind} pack={pack} />
            ))}
          </div>
        </section>

        <section className="mb-6">
          <SectionHeader
            title="Generate with AI"
            description="Copy a prompt into any AI assistant and import the file it produces."
          />
          <PackBuilderCards />
        </section>

        <section className="border-t border-border pt-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="section-label">Installed</div>
              <div className="mt-0.5 text-[11.5px] text-muted-dim">
                {summary.databases} databases · {summary.questions} questions ·{" "}
                {summary.topics} topics · {summary.notes} notes
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={packState.databases.length === 0}
                onClick={exportDatabasesSql}
              >
                <Download className="size-3.5" /> Export .sql
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={packState.questions.length === 0}
                onClick={() => void exportInstalledJson("questions")}
              >
                <Download className="size-3.5" /> Export questions
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={packState.notes.length === 0}
                onClick={() => void exportInstalledJson("notes")}
              >
                <Download className="size-3.5" /> Export notes
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    disabled={
                      packState.databases.length === 0 &&
                      packState.questions.length === 0 &&
                      packState.notes.length === 0
                    }
                  >
                    <Trash2 className="size-3.5" /> Clear all
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Remove every content pack?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes all imported databases, questions and notes
                      from this machine. Your progress is not affected.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => packState.resetAll()}
                    >
                      Remove everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function SummaryCard({
  icon,
  label,
  hint,
  value,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: number;
  active: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-3 border px-4 py-3 text-left transition-colors",
        active
          ? "border-primary/50 bg-primary/5"
          : "border-border bg-surface hover:bg-surface-hover",
      )}
    >
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center",
          active ? "text-primary" : "text-muted-dim",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold">{label}</span>
        <span className="block truncate text-[10px] uppercase tracking-wider text-muted-dim">
          {hint}
        </span>
      </span>
      <span className="numeric text-lg font-semibold">{value}</span>
    </button>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}): React.ReactElement {
  return (
    <div className="mb-2">
      <h2 className="text-[13px] font-semibold">{title}</h2>
      <p className="mt-0.5 max-w-2xl text-[11.5px] text-muted-dim">
        {description}
      </p>
    </div>
  );
}

function OfficialCard({
  pack,
}: {
  pack: (typeof OFFICIAL_PACKS)[number];
}): React.ReactElement {
  const store = usePackStore();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  const install = useCallback(async () => {
    setState("loading");
    try {
      const text = await fetchOfficialPack(pack);
      if (pack.kind === "databases") {
        const fallback = pack.fileName
          .replace(/\.sql$/i, "")
          .replace(/^sample-/i, "");
        const name = dbNameFromSql(text, fallback);
        const dataset = await buildDatasetFromSql(name, text);
        store.addDataset(dataset);
        await useSqlStore.getState().activateDataset(dataset.id);
        setState("done");
        setMessage(`${dataset.tables.length} tables installed`);
      } else {
        const outcome = store.importFile(text);
        if (outcome.ok) {
          setState("done");
          setMessage(`${outcome.added} added · ${outcome.updated} updated`);
        } else {
          setState("error");
          setMessage(outcome.issues[0]?.message ?? "Invalid pack");
        }
      }
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }, [pack, store]);

  return (
    <div className="flex flex-col border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        {pack.kind === "databases" ? (
          <Database className="size-3.5 text-primary" />
        ) : (
          <FileJson className="size-3.5 text-primary" />
        )}
        <span className="text-[12.5px] font-semibold">{pack.label}</span>
        <span className="font-mono text-[9.5px] text-muted-dim">
          {pack.fileName}
        </span>
      </div>
      <p className="mt-1 flex-1 text-[11px] leading-relaxed text-muted">
        {pack.description}
      </p>
      <div className="mt-2">
        <Button
          size="xs"
          variant="outline"
          className="w-full gap-1.5"
          disabled={!isConfigured(pack) || state === "loading"}
          onClick={() => void install()}
        >
          {state === "loading" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Download className="size-3" />
          )}
          {state === "done" ? "Installed" : "Download & install"}
        </Button>
        {!isConfigured(pack) ? (
          <p className="mt-1 text-[10px] text-muted-dim">
            Download URL not configured yet.
          </p>
        ) : null}
        {state === "error" ? (
          <p className="mt-1 text-[10px] text-error">{message}</p>
        ) : null}
        {state === "done" ? (
          <p className="mt-1 text-[10px] text-success">{message}</p>
        ) : null}
      </div>
    </div>
  );
}

function ImportDropzone({ tab }: { tab: PackTab }): React.ReactElement {
  const store = usePackStore();
  const [dragging, setDragging] = useState(false);
  const [outcome, setOutcome] = useState<PackImportOutcome | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const runJson = useCallback(
    (text: string) => {
      setOutcome(store.importFile(text));
    },
    [store],
  );

  const runSql = useCallback(
    async (text: string, fallbackName: string) => {
      setBusy(true);
      setOutcome(null);
      try {
        const dataset = await buildDatasetFromSql(
          dbNameFromSql(text, fallbackName || "imported-db"),
          text,
        );
        store.addDataset(dataset);
        await useSqlStore.getState().activateDataset(dataset.id);
        setOutcome({
          ok: true,
          kind: "databases",
          issues: [],
          added: dataset.tables.length,
          updated: 0,
        });
      } catch (error) {
        setOutcome({
          ok: false,
          kind: "databases",
          issues: [
            {
              path: "sql",
              message: error instanceof Error ? error.message : String(error),
            },
          ],
          added: 0,
          updated: 0,
        });
      } finally {
        setBusy(false);
      }
    },
    [store],
  );

  const readFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result ?? "");
        if (tab === "databases") {
          void runSql(
            text,
            file.name.replace(/\.(sql|txt)$/i, "").replace(/^sample-/i, ""),
          );
        } else {
          runJson(text);
        }
      };
      reader.readAsText(file);
    },
    [tab, runJson, runSql],
  );

  return (
    <div>
      {tab === "databases" ? (
        <div className="mb-2 flex items-center gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Database name (used with USE)"
            aria-label="Database name"
            className="h-7 w-56 border border-border bg-surface px-2 text-[11.5px] outline-none placeholder:text-muted-dim focus:border-primary/50"
          />
          <span className="text-[10.5px] text-muted-dim">
            optional — the name you type after{" "}
            <code className="font-mono">USE</code> in the editor; defaults to
            the file name
          </span>
        </div>
      ) : null}
      <div
        role="button"
        tabIndex={0}
        aria-label="Import pack file"
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
          if (event.key === "Enter" || event.key === " ")
            inputRef.current?.click();
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
            ? "Validating on the SQL engine…"
            : tab === "databases"
              ? "Drop a .sql database file here"
              : `Drop a ${tab} .json pack here`}
        </span>
        <span className="text-[10.5px] text-muted-dim">or click to browse</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT[tab]}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) readFile(file);
          event.target.value = "";
        }}
      />

      <PasteImport
        tab={tab}
        onImportJson={runJson}
        onImportSql={(text) => void runSql(text, name)}
      />
      <OutcomeReport outcome={outcome} />
      {outcome?.ok ? (
        <p className="mt-2 text-[11px] text-muted-dim">
          {outcome.kind === "databases"
            ? "Database added. Open Databases to activate it."
            : "Pack installed. Progress and streaks are tracked by the app, never by the file."}
        </p>
      ) : null}
    </div>
  );
}

function PasteImport({
  tab,
  onImportJson,
  onImportSql,
}: {
  tab: PackTab;
  onImportJson: (text: string) => void;
  onImportSql: (text: string) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  const submit = (): void => {
    if (tab === "databases") onImportSql(text);
    else onImportJson(text);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="mt-2 gap-1.5">
          <ClipboardPaste className="size-3.5" /> Paste{" "}
          {tab === "databases" ? "SQL" : "JSON"} instead
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[86vh] max-w-2xl flex-col gap-0 p-0"
        showCloseButton={false}
      >
        <div className="shrink-0 border-b border-border bg-surface-alt px-4 py-3">
          <DialogTitle className="text-[13px]">
            {tab === "databases" ? "Paste SQL script" : "Paste pack JSON"}
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-[11px]">
            The content is validated before it is stored.
          </DialogDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              tab === "databases"
                ? "CREATE DATABASE shop;\nGO\nUSE shop;\nCREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL);"
                : '{ "version": 2, "questions": [ ... ] }'
            }
            className="min-h-[320px] resize-none font-mono text-[12px]"
          />
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={text.trim().length === 0}
            onClick={submit}
          >
            Validate &amp; import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OutcomeReport({
  outcome,
}: {
  outcome: PackImportOutcome | null;
}): React.ReactElement {
  if (!outcome) return <div className="mt-3" />;
  if (!outcome.ok) {
    return (
      <div className="mt-3 border border-error/40 bg-error/5 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-error">
          <AlertTriangle className="size-3.5" /> Validation failed
        </div>
        {outcome.issues.length === 0 ? (
          <p className="mt-1 font-mono text-[11px] text-error/80">
            Unknown error
          </p>
        ) : (
          <ul className="mt-1.5 space-y-0.5">
            {outcome.issues.slice(0, 12).map((issue, index) => (
              <li key={index} className="font-mono text-[10.5px] text-error/85">
                {issue.path}: {issue.message}
              </li>
            ))}
          </ul>
        )}
        {outcome.issues.length > 12 ? (
          <p className="mt-1 text-[10.5px] text-muted-dim">
            and {outcome.issues.length - 12} more issues
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-2 border border-success/40 bg-success/5 px-3 py-2.5 text-[12px] text-success">
      <Check className="size-3.5" />
      <span className="font-medium capitalize">{outcome.kind}</span>
      <span className="text-success/80">
        imported — {outcome.added} added, {outcome.updated} updated
      </span>
    </div>
  );
}

function PackBuilderCards(): React.ReactElement {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(Object.keys(PACK_PROMPTS) as Array<keyof typeof PACK_PROMPTS>).map(
        (kind) => (
          <PackBuilderCard key={kind} kind={kind} />
        ),
      )}
    </div>
  );
}

function PackBuilderCard({
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
    <div className="flex flex-col border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <FilePlus2 className="size-3.5 text-primary" />
        <span className="text-[12.5px] font-semibold capitalize">
          {kind} prompt
        </span>
      </div>
      <p className="mt-1 flex-1 text-[11px] leading-relaxed text-muted">
        Paste this into any AI assistant to get a validated {kind} pack.
      </p>
      <Button
        size="xs"
        variant="outline"
        className="mt-2 gap-1.5"
        onClick={() => void copy()}
      >
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        {copied ? "Prompt copied" : "Copy prompt"}
      </Button>
    </div>
  );
}
