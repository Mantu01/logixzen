"use client";

import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { PageShell } from "@/components/app-shell/page-shell";
import { Input } from "@/components/ui/input";
import { usePackStore } from "@/stores/usePackStore";
import { cn } from "@/lib/utils";

export default function NotesPage(): React.ReactElement {
  const notes = usePackStore((state) => state.notes);
  const hydrated = usePackStore((state) => state.hydrated);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(notes.map((note) => note.category))).sort(),
    [notes],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return notes
      .filter((note) => (category === "all" ? true : note.category === category))
      .filter((note) =>
        term === ""
          ? true
          : note.title.toLowerCase().includes(term) ||
            note.content.toLowerCase().includes(term) ||
            note.tags.some((tag) => tag.toLowerCase().includes(term)),
      )
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [notes, search, category]);

  const selected = visible.find((note) => note.id === selectedId) ?? visible[0] ?? null;

  if (hydrated && notes.length === 0) {
    return (
      <PageShell title="Notes" subtitle="Study notes from your imported pack">
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <BookOpen className="size-8 text-muted-dim" />
          <p className="text-[13px] font-medium">No notes yet</p>
          <p className="max-w-sm text-[11.5px] text-muted-dim">
            Import the notes pack from the Data Hub, or copy the notes AI prompt to generate one.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Notes"
      subtitle={hydrated ? `${notes.length} notes · ${categories.length} categories` : undefined}
      toolbar={
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-dim" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notes"
              className="h-6 w-56 pl-8 text-[11.5px]"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            <CategoryChip label="All" active={category === "all"} onClick={() => setCategory("all")} />
            {categories.map((name) => (
              <CategoryChip key={name} label={name} active={category === name} onClick={() => setCategory(name)} />
            ))}
          </div>
        </>
      }
      bodyClassName="overflow-hidden"
    >
      <div className="flex h-full min-h-0">
        <div className="w-64 shrink-0 overflow-y-auto border-r border-border bg-surface p-1.5">
          {visible.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => setSelectedId(note.id)}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 border px-2.5 py-2 text-left transition-colors",
                selected?.id === note.id
                  ? "border-primary/40 bg-primary/5"
                  : "border-transparent hover:bg-surface-hover",
              )}
            >
              <span className="text-[12.5px] font-medium">{note.title}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-dim">{note.category}</span>
            </button>
          ))}
          {visible.length === 0 ? (
            <p className="px-2 py-6 text-center text-[11px] text-muted-dim">No notes match</p>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto">
          {selected ? (
            <article className="mx-auto max-w-2xl px-6 py-6">
              <div className="mb-1 text-[10.5px] uppercase tracking-wider text-primary">{selected.category}</div>
              <h2 className="text-[17px] font-semibold">{selected.title}</h2>
              <div className="mt-1 flex gap-1.5">
                {selected.tags.map((tag) => (
                  <span key={tag} className="bg-surface-alt px-1.5 py-px text-[10px] text-muted-dim">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                {selected.content.split(/\n\n+/).map((block, index) => (
                  <NoteBlock key={index} block={block} />
                ))}
              </div>
            </article>
          ) : (
            <div className="flex h-full items-center justify-center text-[12px] text-muted-dim">Select a note</div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function NoteBlock({ block }: { block: string }): React.ReactElement {
  if (block.trim().startsWith("```")) {
    const lines = block.split("\n");
    const code = lines.slice(1, lines.findLastIndex((line) => line.trim() === "```")).join("\n");
    return (
      <pre className="overflow-x-auto border border-border bg-editor p-3 font-mono text-[12px]">{code}</pre>
    );
  }
  if (block.startsWith("### ") || block.startsWith("## ") || block.startsWith("# ")) {
    return <h3 className="text-[14px] font-semibold">{block.replace(/^#+\s*/, "")}</h3>;
  }
  if (block.trim().startsWith("- ") || block.trim().startsWith("* ")) {
    return (
      <ul className="list-disc space-y-1 pl-5 text-[12.5px] text-muted">
        {block
          .split("\n")
          .filter((line) => line.trim().length > 0)
          .map((line, index) => (
            <li key={index}>{line.replace(/^\s*[-*]\s*/, "")}</li>
          ))}
      </ul>
    );
  }
  return <p className="text-[12.5px] leading-relaxed text-muted">{block}</p>;
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-6 shrink-0 border px-2 text-[10.5px] transition-colors",
        active ? "border-primary/50 bg-primary/10 text-foreground" : "border-border text-muted-dim hover:bg-surface-hover hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
