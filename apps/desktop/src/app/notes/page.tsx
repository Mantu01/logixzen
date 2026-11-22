"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  FileText,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { PageShell } from "@/components/app-shell/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InstallReport } from "@/components/packs/install-report";
import type { InstallStatus } from "@/components/packs/install-report";
import { usePackStore } from "@/stores/usePackStore";
import { parsePackFile } from "@/lib/packs/packs";
import type { Note } from "@/lib/packs/types";
import { cn, errorMessage } from "@/lib/utils";

export default function NotesPage(): React.ReactElement {
  const notes = usePackStore((state) => state.notes);
  const hydrated = usePackStore((state) => state.hydrated);
  const addNote = usePackStore((state) => state.addNote);
  const removeNote = usePackStore((state) => state.removeNote);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes) {
      counts.set(note.category, (counts.get(note.category) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
  }, [notes]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return notes
      .filter((note) =>
        category === "all" ? true : note.category === category,
      )
      .filter((note) =>
        term === ""
          ? true
          : note.title.toLowerCase().includes(term) ||
            note.content.toLowerCase().includes(term) ||
            note.tags.some((tag) => tag.toLowerCase().includes(term)),
      )
      .sort(
        (a, b) =>
          a.category.localeCompare(b.category) ||
          a.title.localeCompare(b.title),
      );
  }, [notes, search, category]);

  const selected =
    visible.find((note) => note.id === selectedId) ?? visible[0] ?? null;

  const blocks = useMemo(
    () => (selected ? splitBlocks(selected.content) : []),
    [selected],
  );

  const copyCode = (block: Block, index: number): void => {
    if (block.kind !== "code") return;
    void navigator.clipboard.writeText(block.text);
    setCopiedBlock(index);
    window.setTimeout(() => setCopiedBlock(null), 1200);
  };

  if (hydrated && notes.length === 0) {
    return (
      <PageShell
        title="Notes"
        subtitle="Study notes from your imported packs"
        actions={
          <div className="flex items-center gap-2">
            <NewNoteDialog categories={[]} onAdd={addNote} />
            <ImportNotesButton />
          </div>
        }
      >
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <BookOpen className="size-8 text-muted-dim" />
          <p className="text-[13px] font-medium">No notes yet</p>
          <p className="max-w-sm text-[11.5px] text-muted-dim">
            Notes arrive with a resource install, grouped by category.{" "}
            <Link href="/import/resources" className="text-primary hover:underline">
              Install a resource
            </Link>{" "}
            or import a notes .json file.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Notes"
      subtitle={
        hydrated
          ? `${notes.length} notes · ${categories.length} categories`
          : undefined
      }
      actions={
        <div className="flex items-center gap-2">
          <NewNoteDialog
            categories={categories.map(([name]) => name)}
            onAdd={addNote}
          />
          <ImportNotesButton />
        </div>
      }
      toolbar={
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-dim" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notes, tags, content"
              aria-label="Search notes"
              className="h-7 w-60 border border-border bg-surface pl-8 pr-2 text-[11.5px] outline-none transition-colors placeholder:text-muted-dim focus:border-primary/50"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            <CategoryChip
              label="All"
              count={notes.length}
              active={category === "all"}
              onClick={() => setCategory("all")}
            />
            {categories.map(([name, count]) => (
              <CategoryChip
                key={name}
                label={name}
                count={count}
                active={category === name}
                onClick={() => setCategory(name)}
              />
            ))}
          </div>
        </>
      }
      bodyClassName="overflow-hidden"
    >
      <div className="flex h-full min-h-0">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-border bg-surface">
          {visible.length === 0 ? (
            <p className="px-3 py-8 text-center text-[11px] text-muted-dim">
              No notes match
            </p>
          ) : null}
          {visible.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              active={selected?.id === note.id}
              onSelect={() => setSelectedId(note.id)}
            />
          ))}
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto bg-surface-alt/40">
          {selected ? (
            <article className="mx-auto min-h-full max-w-3xl border-x border-border bg-surface px-10 py-8">
              <header className="border-b border-border pb-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CategoryEditor
                      key={selected.id}
                      note={selected}
                      categories={categories.map(([name]) => name)}
                    />
                    <span className="numeric text-[10.5px] text-muted-dim">
                      {selected.tags.length} tags
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Delete note"
                    className="text-muted-dim hover:text-error"
                    onClick={() => {
                      removeNote(selected.id);
                      setSelectedId(null);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <h1 className="mt-3 text-[20px] font-semibold leading-snug tracking-[-0.01em]">
                  {selected.title}
                </h1>
                {selected.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.tags.map((tag) => (
                      <span
                        key={tag}
                        className="border border-border bg-surface-alt px-1.5 py-px font-mono text-[10px] text-muted"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </header>
              <div className="space-y-4 pt-5">
                {blocks.map((block, index) => (
                  <NoteBlock
                    key={index}
                    block={block}
                    copied={copiedBlock === index}
                    onCopy={() => copyCode(block, index)}
                  />
                ))}
              </div>
              <footer className="mt-10 border-t border-border pt-4 text-[10px] text-muted-dim">
                {notes.length} notes installed · content from imported packs,
                offline
              </footer>
            </article>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-dim">
              <FileText className="size-6" />
              <span className="text-[12px]">Select a note to read</span>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function ImportNotesButton(): React.ReactElement {
  const [status, setStatus] = useState<InstallStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const readFile = async (file: File): Promise<void> => {
    try {
      const text = await file.text();
      const detected = parsePackFile(text);
      const parsed = detected?.result ?? null;
      if (
        detected === null ||
        parsed === null ||
        !parsed.ok ||
        parsed.data === null
      ) {
        setStatus({
          ok: false,
          issues: parsed?.issues ?? [{ path: "$", message: "Invalid JSON" }],
        });
        setMessage(null);
      } else if (detected.kind !== "notes") {
        setStatus({
          ok: false,
          issues: [
            {
              path: "file",
              message: `This is a ${detected.kind} file — pick a notes .json file`,
            },
          ],
        });
        setMessage(null);
      } else {
        const outcome = usePackStore.getState().importFile(text);
        setStatus({ ok: outcome.ok, issues: outcome.issues });
        setMessage(
          outcome.ok ? `${outcome.counts.notes} notes imported` : null,
        );
      }
    } catch (error: unknown) {
      setStatus({ ok: false, issues: [{ path: "file", message: errorMessage(error) }] });
      setMessage(null);
    }
    setOpen(true);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-3.5" /> Import notes
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-label="Notes JSON file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void readFile(file);
          event.target.value = "";
        }}
      />
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setStatus(null);
            setMessage(null);
          }
        }}
      >
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="border-b border-border bg-surface-alt px-4 py-3">
            <DialogTitle className="text-[13px]">Import notes</DialogTitle>
            <DialogDescription className="text-[11px]">
              The file is parsed and validated before anything is stored.
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 pb-4">
            <InstallReport status={status} message={message} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function NewNoteDialog({
  categories,
  onAdd,
}: {
  categories: string[];
  onAdd: (note: Note) => void;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "SQL Basics");
  const [newCat, setNewCat] = useState("");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");

  const save = (): void => {
    if (title.trim().length === 0 || content.trim().length === 0) return;
    const finalCategory = newCat.trim().length > 0 ? newCat.trim() : category;
    const splitTags = tags
      .split(/[,·]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    onAdd({
      id: `note-${Date.now()}`,
      title: title.trim(),
      category: finalCategory,
      tags: splitTags,
      content: content.trim(),
    });
    setOpen(false);
    setTitle("");
    setContent("");
    setTags("");
    setNewCat("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="size-3.5" /> New note
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="border-b border-border bg-surface-alt px-4 py-3">
          <DialogTitle className="text-[13px]">Create Note</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 p-4">
          <div>
            <label className="section-label mb-1 block">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Window Functions Cheat Sheet"
              className="h-8"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="section-label mb-1 block">Category</label>
              {categories.length > 0 ? (
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-8 w-full border border-border bg-surface px-2 text-[12px] outline-none"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Category..."
                  className="h-8"
                />
              )}
            </div>
            <div>
              <label className="section-label mb-1 block">Or new category</label>
              <Input
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="New category..."
                className="h-8"
              />
            </div>
          </div>
          <div>
            <label className="section-label mb-1 block">Tags (comma-separated)</label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="window, over, partition"
              className="h-8"
            />
          </div>
          <div>
            <label className="section-label mb-1 block">Content (Markdown)</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# Header&#10;&#10;Explanation and code:&#10;&#10;```sql&#10;SELECT ROW_NUMBER() OVER ();&#10;```"
              rows={6}
              className="font-mono text-[11.5px]"
            />
          </div>
        </div>
        <DialogFooter className="border-t border-border px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={title.trim().length === 0 || content.trim().length === 0}
            onClick={save}
          >
            Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NoteListItem({
  note,
  active,
  onSelect,
}: {
  note: Note;
  active: boolean;
  onSelect: () => void;
}): React.ReactElement {
  const snippet = noteSnippet(note.content);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group flex w-full flex-col gap-1 border-b border-border/60 px-3 py-2.5 text-left transition-colors",
        active ? "bg-primary/5" : "hover:bg-surface-hover",
      )}
    >
      <span className="flex items-center gap-1.5">
        {active ? (
          <ChevronRight className="size-3 shrink-0 text-primary" />
        ) : null}
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[12.5px]",
            active
              ? "font-semibold text-foreground"
              : "font-medium text-foreground/90",
          )}
        >
          {note.title}
        </span>
      </span>
      <span className="line-clamp-2 text-[10.5px] leading-snug text-muted-dim">
        {snippet}
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            "px-1 font-mono text-[9px] uppercase tracking-wider",
            active ? "text-primary" : "text-muted-dim",
          )}
        >
          {note.category}
        </span>
        {note.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="text-[9px] text-muted-dim">
            #{tag}
          </span>
        ))}
      </span>
    </button>
  );
}

function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-6 shrink-0 items-center gap-1.5 border px-2 text-[10.5px] transition-colors",
        active
          ? "border-primary/50 bg-primary/10 text-foreground"
          : "border-border text-muted-dim hover:bg-surface-hover hover:text-foreground",
      )}
    >
      {label}
      <span
        className={cn(
          "numeric text-[9px]",
          active ? "text-primary" : "text-muted-dim",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function CategoryEditor({
  note,
  categories,
}: {
  note: Note;
  categories: string[];
}): React.ReactElement {
  const setNoteCategory = usePackStore((state) => state.setNoteCategory);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note.category);

  const submit = (): void => {
    const trimmed = draft.trim();
    if (trimmed.length > 0) setNoteCategory(note.id, trimmed);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(note.category);
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Category: ${note.category}. Change it`}
          className="bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
        >
          {note.category}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm p-0">
        <DialogHeader className="border-b border-border bg-surface-alt px-4 py-3">
          <DialogTitle className="text-[13px]">Note category</DialogTitle>
          <DialogDescription className="text-[11px]">
            Pick an existing category or type a new one — it is created on
            save.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-4 py-4">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
            aria-label="Category name"
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setDraft(category)}
                className={cn(
                  "border px-2 py-1 text-[10.5px] transition-colors",
                  category === draft
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border text-muted-dim hover:bg-surface-hover hover:text-foreground",
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        <DialogFooter className="border-t border-border px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={draft.trim().length === 0} onClick={submit}>
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }  | { kind: "code"; lang: string; text: string }
  | { kind: "table"; header: string[]; rows: string[][] }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "rule" }
  | { kind: "text"; text: string };

const CODE_FENCE = /^```(\w*)\n?/;

function splitBlocks(content: string): Block[] {
  const paragraphs = content.split(/\n\n+/);
  const blocks: Block[] = [];

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (trimmed.length === 0) continue;

    if (trimmed.startsWith("```")) {
      const fence = CODE_FENCE.exec(trimmed);
      const body = trimmed.replace(/^```\w*\n?/, "").replace(/```\s*$/, "");
      blocks.push({ kind: "code", lang: fence?.[1] ?? "", text: body });
      continue;
    }

    if (/^#{1,3}\s/.test(trimmed)) {
      const level = (trimmed.match(/^#+/)?.[0].length ?? 1) as 1 | 2 | 3;
      blocks.push({
        kind: "heading",
        level,
        text: trimmed.replace(/^#+\s*/, ""),
      });
      continue;
    }

    if (/^\|.*\|$/.test(trimmed)) {
      const lines = trimmed
        .split("\n")
        .filter((line) => line.trim().length > 0);
      const parseRow = (line: string): string[] =>
        line
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((cell) => cell.trim());
      const header = parseRow(lines[0] ?? "");
      const rows = lines
        .slice(1)
        .filter((line) => !/^\|[\s:|-]+\|?$/.test(line))
        .map(parseRow);
      blocks.push({ kind: "table", header, rows });
      continue;
    }

    if (
      /^[-*]\s/m.test(trimmed) &&
      trimmed.split("\n").every((line) => /^[-*]\s/.test(line.trim()))
    ) {
      blocks.push({
        kind: "list",
        ordered: false,
        items: trimmed
          .split("\n")
          .map((line) => line.trim().replace(/^[-*]\s*/, "")),
      });
      continue;
    }

    if (
      /^\d+\.\s/m.test(trimmed) &&
      trimmed.split("\n").every((line) => /^\d+\.\s/.test(line.trim()))
    ) {
      blocks.push({
        kind: "list",
        ordered: true,
        items: trimmed
          .split("\n")
          .map((line) => line.trim().replace(/^\d+\.\s*/, "")),
      });
      continue;
    }

    if (/^(-{3,}|_{3,})$/.test(trimmed)) {
      blocks.push({ kind: "rule" });
      continue;
    }

    blocks.push({ kind: "text", text: trimmed });
  }

  return blocks;
}

function NoteBlock({
  block,
  copied,
  onCopy,
}: {
  block: Block;
  copied: boolean;
  onCopy: () => void;
}): React.ReactElement {
  switch (block.kind) {
    case "heading":
      return (
        <h2
          className={cn(
            "font-semibold tracking-[-0.01em] text-foreground",
            block.level === 1 && "text-[17px]",
            block.level === 2 && "text-[15px] pt-2",
            block.level === 3 &&
              "text-[13px] uppercase tracking-wider text-muted",
          )}
        >
          {block.text}
        </h2>
      );
    case "code":
      return <CodeBlock code={block.text} copied={copied} onCopy={onCopy} />;
    case "table":
      return (
        <div className="overflow-x-auto border border-border">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border bg-surface-alt">
                {block.header.map((cell, index) => (
                  <th
                    key={index}
                    className="px-3 py-1.5 text-left font-mono text-[11px] font-semibold text-foreground/90"
                  >
                    <Inline text={cell} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-border/50 last:border-0"
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className="px-3 py-1.5 align-top text-muted"
                    >
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "list":
      return block.ordered ? (
        <ol className="space-y-1.5 pl-1 text-[12.5px] leading-relaxed text-muted">
          {block.items.map((item, index) => (
            <li key={index} className="flex gap-2.5">
              <span className="numeric shrink-0 font-mono text-[11px] text-primary">
                {index + 1}.
              </span>
              <span className="min-w-0">
                <Inline text={item} />
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <ul className="space-y-1.5 pl-1 text-[12.5px] leading-relaxed text-muted">
          {block.items.map((item, index) => (
            <li key={index} className="flex gap-2.5">
              <span
                className="mt-[7px] size-1 shrink-0 bg-primary"
                aria-hidden="true"
              />
              <span className="min-w-0">
                <Inline text={item} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "rule":
      return <hr className="border-border" />;
    case "text":
      return (
        <p className="text-[12.5px] leading-[1.75] text-muted">
          <Inline text={block.text} />
        </p>
      );
  }
}

function CodeBlock({
  code,
  copied,
  onCopy,
}: {
  code: string;
  copied: boolean;
  onCopy: () => void;
}): React.ReactElement {
  return (
    <div className="overflow-hidden border border-border bg-editor">
      <div className="flex h-7 items-center justify-between border-b border-border bg-surface px-2">
        <span className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-dim">
          <span className="size-1.5 bg-primary" aria-hidden="true" />
          SQL
        </span>
        <button
          type="button"
          aria-label={copied ? "Copied" : "Copy code"}
          onClick={onCopy}
          className="flex items-center gap-1 px-1.5 text-[10px] text-muted-dim transition-colors hover:text-foreground"
        >
          {copied ? (
            <Check className="size-3 text-success" />
          ) : (
            <Copy className="size-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[11.5px] leading-relaxed">
        <code>
          {highlightSql(code).map((token, index) => (
            <span key={index} className={token.className}>
              {token.text}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}

interface Token {
  text: string;
  className: string;
}

const KEYWORDS = new Set([
  "select",
  "from",
  "where",
  "and",
  "or",
  "not",
  "in",
  "as",
  "on",
  "join",
  "left",
  "right",
  "inner",
  "outer",
  "full",
  "cross",
  "group",
  "by",
  "order",
  "having",
  "limit",
  "offset",
  "insert",
  "into",
  "values",
  "update",
  "set",
  "delete",
  "create",
  "table",
  "primary",
  "key",
  "foreign",
  "references",
  "unique",
  "index",
  "view",
  "with",
  "union",
  "all",
  "distinct",
  "case",
  "when",
  "then",
  "else",
  "end",
  "null",
  "is",
  "like",
  "between",
  "exists",
  "asc",
  "desc",
  "constraint",
  "check",
  "default",
  "alter",
  "drop",
  "add",
  "column",
  "cascade",
]);

function highlightSql(code: string): Token[] {
  const tokens: Token[] = [];
  const pattern =
    /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][\w]*)|([(),;*+=<>!]+)/g;
  let last = 0;
  for (const match of code.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > last)
      tokens.push({ text: code.slice(last, index), className: "" });
    const [full, comment, string, number, word, operator] = match;
    if (comment !== undefined) {
      tokens.push({ text: full, className: "text-muted-dim italic" });
    } else if (string !== undefined) {
      tokens.push({ text: full, className: "text-success" });
    } else if (number !== undefined) {
      tokens.push({ text: full, className: "text-warning" });
    } else if (word !== undefined) {
      tokens.push({
        text: full,
        className: KEYWORDS.has(word.toLowerCase())
          ? "font-semibold text-primary uppercase"
          : "",
      });
    } else if (operator !== undefined) {
      tokens.push({ text: full, className: "text-foreground" });
    }
    last = index + full.length;
  }
  if (last < code.length)
    tokens.push({ text: code.slice(last), className: "" });
  return tokens;
}

function Inline({ text }: { text: string }): React.ReactElement {
  const parts = text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .filter((part) => part.length > 0);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={index} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={index}
              className="border border-border bg-surface-alt px-1 font-mono text-[11px] text-primary"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}

function noteSnippet(content: string): string {
  for (const paragraph of content.split(/\n\n+/)) {
    const line = paragraph.trim().split("\n")[0]?.trim() ?? "";
    if (line.startsWith("#") || line.startsWith("```") || line.startsWith("|"))
      continue;
    return line.replace(/[*`]/g, "").slice(0, 160);
  }
  return "";
}
