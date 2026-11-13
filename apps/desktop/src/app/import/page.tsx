"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  Download,
  FileJson,
  FilePlus2,
  FlaskConical,
  Loader2,
  NotebookPen,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import { PageShell } from "@/components/app-shell/page-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { summarizePacks, usePackStore } from "@/stores/usePackStore";
import type { PackImportOutcome } from "@/stores/usePackStore";
import { OFFICIAL_PACKS, fetchOfficialPack, isConfigured } from "@/lib/packs/official";
import { PACK_PROMPTS } from "@/lib/packs/prompts";
import { serializeDatabasePack, serializeNotesPack, serializeQuestionsPack } from "@/lib/packs/packs";
import { saveTextFile } from "@/lib/save-file";
import { cn } from "@/lib/utils";

type PackTab = "databases" | "questions" | "notes";

export default function ImportPage(): React.ReactElement {
  const [tab, setTab] = useState<PackTab>("databases");
  const packState = usePackStore();
  const summary = summarizePacks(packState);

  return (
    <PageShell
      title="Data Hub"
      subtitle="Import packs, download the official set, or generate one with AI"
    >
      <div className="mx-auto max-w-4xl px-5 py-6">
        <div className="mb-5 grid grid-cols-3 gap-2">
          <SummaryCard icon={<Database className="size-3.5" />} label="Databases" value={summary.databases} active={tab === "databases"} onClick={() => setTab("databases")} />
          <SummaryCard icon={<FlaskConical className="size-3.5" />} label="Questions" value={summary.questions} active={tab === "questions"} onClick={() => setTab("questions")} />
          <SummaryCard icon={<NotebookPen className="size-3.5" />} label="Notes" value={summary.notes} active={tab === "notes"} onClick={() => setTab("notes")} />
        </div>

        <section className="mb-6">
          <SectionHeader
            title="Official packs"
            description="Download the maintained LogixZen packs and install them locally. The download URLs are set in src/lib/packs/official.ts."
          />
          <div className="grid grid-cols-3 gap-2">
            {OFFICIAL_PACKS.map((pack) => (
              <OfficialCard key={pack.kind} pack={pack} />
            ))}
          </div>
        </section>

        <section className="mb-6">
          <SectionHeader
            title="Import your own"
            description="Drop a .json pack file, or paste the JSON. Files are validated before anything is stored."
          />
          <ImportDropzone tab={tab} />
        </section>

        <section>
          <SectionHeader
            title="Generate with AI"
            description="Copy the prompt below into any AI assistant and ask it for the JSON file. Import the result back here."
          />
          <PackBuilderCards />
        </section>

        <section className="mt-8 border-t border-border pt-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="section-label">Installed packs</div>
              <div className="mt-0.5 text-[11.5px] text-muted-dim">
                {summary.databases} databases · {summary.questions} questions · {summary.topics} topics · {summary.notes} notes
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => packState.resetAll()}
            >
              <Trash2 className="size-3.5" /> Clear all
            </Button>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 border px-4 py-3 text-left transition-colors",
        active ? "border-primary/50 bg-primary/5" : "border-border bg-surface hover:bg-surface-hover",
      )}
    >
      <span className={cn("flex size-7 shrink-0 items-center justify-center", active ? "text-primary" : "text-muted-dim")}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="numeric block text-lg font-semibold leading-tight">{value}</span>
        <span className="block text-[10.5px] uppercase tracking-wider text-muted-dim">{label}</span>
      </span>
    </button>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }): React.ReactElement {
  return (
    <div className="mb-2">
      <h2 className="text-[13px] font-semibold">{title}</h2>
      <p className="mt-0.5 max-w-2xl text-[11.5px] text-muted-dim">{description}</p>
    </div>
  );
}

function OfficialCard({ pack }: { pack: (typeof OFFICIAL_PACKS)[number] }): React.ReactElement {
  const store = usePackStore();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const install = useCallback(async () => {
    setState("loading");
    try {
      const text = await fetchOfficialPack(pack);
      const outcome = store.importFile(text);
      if (outcome.ok) {
        setState("done");
        setMessage(`${outcome.added} added · ${outcome.updated} updated`);
      } else {
        setState("error");
        setMessage(outcome.issues[0]?.message ?? "Invalid pack");
      }
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }, [pack, store]);

  return (
    <div className="flex flex-col border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <FileJson className="size-3.5 text-primary" />
        <span className="text-[12.5px] font-semibold">{pack.label}</span>
        <span className="font-mono text-[9.5px] text-muted-dim">{pack.fileName}</span>
      </div>
      <p className="mt-1 flex-1 text-[11px] leading-relaxed text-muted">{pack.description}</p>
      <div className="mt-2">
        <Button size="xs" variant="outline" className="w-full gap-1.5" disabled={!isConfigured(pack) || state === "loading"} onClick={() => void install()}>
          {state === "loading" ? <Loader2 className="size-3 animate-spin" /> : <Download className="size-3" />}
          {state === "done" ? "Installed" : "Download & install"}
        </Button>
        {!isConfigured(pack) ? (
          <p className="mt-1 text-[10px] text-muted-dim">Download URL not configured yet.</p>
        ) : null}
        {state === "error" ? <p className="mt-1 text-[10px] text-error">{message}</p> : null}
        {state === "done" ? <p className="mt-1 text-[10px] text-success">{message}</p> : null}
      </div>
    </div>
  );
}

function ImportDropzone({ tab }: { tab: PackTab }): React.ReactElement {
  const store = usePackStore();
  const [dragging, setDragging] = useState(false);
  const [outcome, setOutcome] = useState<PackImportOutcome | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const runText = useCallback(
    (text: string) => {
      const result = store.importFile(text);
      setOutcome(result);
    },
    [store],
  );

  const readFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => runText(String(reader.result ?? ""));
      reader.readAsText(file);
    },
    [runText],
  );

  return (
    <div>
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
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        className={cn(
          "flex h-28 cursor-pointer flex-col items-center justify-center gap-1.5 border border-dashed transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border bg-surface-alt/60 hover:border-primary/40",
        )}
      >
        <Upload className="size-4 text-muted-dim" />
        <span className="text-[12px] font-medium">Drop a {tab} .json pack here</span>
        <span className="text-[10.5px] text-muted-dim">or click to browse</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) readFile(file);
          event.target.value = "";
        }}
      />

      <PasteImport onImport={runText} />
      <OutcomeReport outcome={outcome} />
      {tab === "databases" && outcome?.ok ? (
        <p className="mt-2 text-[11px] text-muted-dim">
          Databases were added to your library. Open{" "}
          <a href="/schema" className="text-primary underline-offset-2 hover:underline">
            Databases
          </a>{" "}
          to activate one.
        </p>
      ) : null}
    </div>
  );
}

function PasteImport({ onImport }: { onImport: (text: string) => void }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="mt-2 gap-1.5">
          <Sparkles className="size-3.5" /> Paste JSON instead
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Paste pack JSON</DialogTitle>
          <DialogDescription>The content is validated before it is stored.</DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder='{ "version": 2, "questions": [ ... ] }'
          className="min-h-[320px] resize-none font-mono text-[12px]"
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={text.trim().length === 0}
            onClick={() => {
              onImport(text);
              setOpen(false);
            }}
          >
            Validate & import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OutcomeReport({ outcome }: { outcome: PackImportOutcome | null }): React.ReactElement {
  if (!outcome) return <div className="mt-3" />;
  if (!outcome.ok) {
    return (
      <div className="mt-3 border border-error/40 bg-error/5 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-error">
          <AlertTriangle className="size-3.5" /> Validation failed
        </div>
        {outcome.issues.length === 0 ? (
          <p className="mt-1 font-mono text-[11px] text-error/80">Unknown error</p>
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
          <p className="mt-1 text-[10.5px] text-muted-dim">and {outcome.issues.length - 12} more issues</p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-2 border border-success/40 bg-success/5 px-3 py-2.5 text-[12px] text-success">
      <Check className="size-3.5" />
      <span className="font-medium capitalize">{outcome.kind}</span>
      <span className="text-success/80">
        pack imported — {outcome.added} added, {outcome.updated} updated
      </span>
    </div>
  );
}

function PackBuilderCards(): React.ReactElement {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(Object.keys(PACK_PROMPTS) as Array<keyof typeof PACK_PROMPTS>).map((kind) => (
        <PackBuilderCard key={kind} kind={kind} />
      ))}
    </div>
  );
}

function PackBuilderCard({ kind }: { kind: keyof typeof PACK_PROMPTS }): React.ReactElement {
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
        <span className="text-[12.5px] font-semibold capitalize">{kind} prompt</span>
      </div>
      <p className="mt-1 flex-1 text-[11px] leading-relaxed text-muted">
        Paste this into any AI assistant to get a validated {kind} pack.
      </p>
      <Button size="xs" variant="outline" className="mt-2 gap-1.5" onClick={() => void copy()}>
        {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
        {copied ? "Prompt copied" : "Copy prompt"}
      </Button>
    </div>
  );
}

export function exportPacksAction(kind: keyof typeof PACK_PROMPTS): string {
  const store = usePackStore.getState();
  if (kind === "databases") return serializeDatabasePack(store.databases);
  if (kind === "questions") return serializeQuestionsPack(store.topics, store.questions);
  return serializeNotesPack(store.notes);
}

export function savePackAsFile(kind: keyof typeof PACK_PROMPTS): void {
  const content = exportPacksAction(kind);
  void saveTextFile(`logixzen-${kind}.json`, content, [{ name: "JSON", extensions: ["json"] }]);
}
