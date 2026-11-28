"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Group,
  Panel as ResizablePanel,
  Separator,
  usePanelRef,
  type PanelSize,
} from "react-resizable-panels";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  FileText,
  FolderOpen,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  Search,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { PageShell } from "@/components/app-shell/page-shell";
import { WorkspaceSwitcher } from "@/components/learn/WorkspaceSwitcher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InstallReport } from "@/components/packs/install-report";
import type { InstallStatus } from "@/components/packs/install-report";
import { usePackStore } from "@/stores/usePackStore";
import { useSqlStore } from "@/sql/useSqlStore";
import { DEFAULT_WORKSPACE_ID, workspaceCategories } from "@/lib/categories";
import { dialectLabel } from "@/lib/sql-editor";
import { parsePackFile } from "@/lib/packs/packs";
import type { Note, NotesPack } from "@/lib/packs/types";
import type { EngineDialect } from "@/shared/engines";
import { cn, errorMessage } from "@/lib/utils";

const NOTES_SIDEBAR_KEY = "logixzen.notesSidebar.collapsed";

function NotesContent(): React.ReactElement {
  const searchParams = useSearchParams();
  const workspaceParam = searchParams.get("workspace");
  const workspaces = usePackStore((state) => state.workspaces);
  const activeWorkspaceId =
    usePackStore((state) => state.activeWorkspaceId) || DEFAULT_WORKSPACE_ID;
  const setActiveWorkspace = usePackStore((state) => state.setActiveWorkspace);
  const allNotes = usePackStore((state) => state.notes);
  const noteWorkspace = usePackStore((state) => state.noteWorkspace);
  const allNoteCategories = usePackStore((state) => state.noteCategories);
  const hydrated = usePackStore((state) => state.hydrated);

  useEffect(() => {
    if (!workspaceParam || !hydrated) return;
    const direct = workspaces.find((w) => w.id === workspaceParam);
    if (direct) {
      if (direct.id !== activeWorkspaceId) setActiveWorkspace(direct.id);
      return;
    }
    const active = workspaces.find((w) => w.id === activeWorkspaceId);
    if (active && active.subjectId === workspaceParam) return;
    const bySubject = workspaces.find((w) => w.subjectId === workspaceParam);
    if (bySubject) setActiveWorkspace(bySubject.id);
  }, [
    workspaceParam,
    hydrated,
    workspaces,
    activeWorkspaceId,
    setActiveWorkspace,
  ]);
  const addNote = usePackStore((state) => state.addNote);
  const updateNote = usePackStore((state) => state.updateNote);
  const removeNote = usePackStore((state) => state.removeNote);
  const createNoteCategory = usePackStore((state) => state.createNoteCategory);
  const renameNoteCategory = usePackStore((state) => state.renameNoteCategory);
  const reorderNoteCategory = usePackStore(
    (state) => state.reorderNoteCategory,
  );
  const removeNoteCategory = usePackStore((state) => state.removeNoteCategory);
  const activeDialect = useSqlStore((state) => state.activeDialect);

  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [copiedBlock, setCopiedBlock] = useState<number | null>(null);
  const [newCategoryDraft, setNewCategoryDraft] = useState("");
  const [renamingCat, setRenamingCat] = useState<{
    oldName: string;
    draft: string;
  } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const sidebarRef = usePanelRef();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(NOTES_SIDEBAR_KEY) === "true",
  );
  const collapsedRef = useRef(sidebarCollapsed);

  const activeWorkspace = useMemo(
    () =>
      workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0],
    [workspaces, activeWorkspaceId],
  );

  const notes = useMemo(
    () =>
      allNotes.filter(
        (n) =>
          (noteWorkspace[n.id] ?? DEFAULT_WORKSPACE_ID) === activeWorkspaceId,
      ),
    [allNotes, noteWorkspace, activeWorkspaceId],
  );

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    const orderedCats = workspaceCategories(allNoteCategories, activeWorkspaceId);
    for (const cat of orderedCats) {
      counts.set(cat.name, 0);
    }
    for (const note of notes) {
      counts.set(note.category, (counts.get(note.category) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, count]) => ({
      name,
      count,
      record: orderedCats.find((c) => c.name === name) ?? null,
    }));
  }, [allNoteCategories, notes, activeWorkspaceId]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return notes
      .filter((note) =>
        categoryFilter === "all" ? true : note.category === categoryFilter,
      )
      .filter((note) =>
        selectedTag === null ? true : note.tags.includes(selectedTag),
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
          a.category.localeCompare(b.category) || a.title.localeCompare(b.title),
      );
  }, [notes, search, categoryFilter, selectedTag]);

  const selected =
    visible.find((note) => note.id === selectedId) ?? visible[0] ?? null;

  const blocks = useMemo(
    () => (selected ? splitBlocks(selected.content) : []),
    [selected],
  );

  const toggleSidebar = useCallback((): void => {
    const panel = sidebarRef.current;
    if (!panel) return;
    if (collapsedRef.current) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [sidebarRef]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && !event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      } else if (mod && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  const handleSidebarResize = useCallback((size: PanelSize): void => {
    const collapsed = size.inPixels <= 40;
    collapsedRef.current = collapsed;
    setSidebarCollapsed(collapsed);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(NOTES_SIDEBAR_KEY, String(collapsed));
    }
  }, []);

  const copyCode = (block: Block, index: number): void => {
    if (block.kind !== "code") return;
    void navigator.clipboard.writeText(block.text);
    setCopiedBlock(index);
    window.setTimeout(() => setCopiedBlock(null), 1200);
  };

  if (hydrated && allNotes.length === 0) {
    return (
      <PageShell
        title="Notes"
        subtitle="Study notes from your imported packs"
        actions={
          <div className="flex items-center gap-2">
            <WorkspaceSwitcher />
            <NewNoteDialog
              categories={[]}
              onAdd={(n) => addNote(n, activeWorkspaceId)}
            />
            <ImportNotesButton
              workspaceName={activeWorkspace?.name ?? "SQL Practice"}
              workspaceId={activeWorkspaceId}
              existingCategories={[]}
            />
          </div>
        }
      >
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <BookOpen className="size-8 text-muted-dim" />
          <p className="text-[13px] font-medium">No notes yet</p>
          <p className="max-w-sm text-[11.5px] text-muted-dim">
            Notes arrive with a resource install, grouped by category.{" "}
            <Link
              href="/import/resources"
              className="text-primary hover:underline"
            >
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
          ? `${activeWorkspace?.name ?? "Workspace"} · ${notes.length} notes · ${categories.length} categories`
          : undefined
      }
      actions={
        <div className="flex items-center gap-2">
          <WorkspaceSwitcher />
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-dim" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search notes (Ctrl+K)"
              aria-label="Search notes"
              className="h-7 w-48 border border-border bg-surface-alt pl-7 pr-6 text-[11.5px] outline-none transition-colors placeholder:text-muted-dim focus:border-primary/50"
            />
            {search.length > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearch("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-dim hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Clear search</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          {selectedTag !== null ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setSelectedTag(null)}
                  className="flex h-7 items-center gap-1 border border-primary/50 bg-primary/10 px-2 font-mono text-[10.5px] text-primary transition-colors hover:bg-primary/20"
                >
                  <Tag className="size-3" />#{selectedTag}
                  <X className="size-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Clear tag filter</TooltipContent>
            </Tooltip>
          ) : null}
          <NewNoteDialog
            categories={categories.map((c) => c.name)}
            onAdd={(note) => {
              addNote(note, activeWorkspaceId);
              setSelectedId(note.id);
              setEditing(false);
            }}
          />
          <ImportNotesButton
            workspaceName={activeWorkspace?.name ?? "SQL Practice"}
            workspaceId={activeWorkspaceId}
            existingCategories={categories.map((c) => c.name)}
          />
        </div>
      }
      bodyClassName="overflow-hidden"
    >
      <Group orientation="horizontal" className="h-full min-h-0">
        <ResizablePanel minSize={320}>
          <div className="h-full min-h-0 overflow-y-auto bg-surface-alt/40">
            {selected ? (
              editing ? (
                <NoteInlineEditor
                  key={`edit-${selected.id}`}
                  note={selected}
                  categories={categories.map((c) => c.name)}
                  onCancel={() => setEditing(false)}
                  onSave={(updated) => {
                    updateNote(updated);
                    setEditing(false);
                  }}
                />
              ) : (
                <article className="mx-auto min-h-full max-w-3xl border-x border-border bg-surface px-10 py-8">
                  <header className="border-b border-border pb-5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <CategoryEditor
                          key={selected.id}
                          note={selected}
                          categories={categories.map((c) => c.name)}
                        />
                        <span className="numeric text-[10.5px] text-muted-dim">
                          {selected.tags.length} tags
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditing(true)}
                              className="h-7 gap-1 px-2 text-[11px] text-muted hover:text-foreground"
                            >
                              <Pencil className="size-3" />
                              Edit
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit note content and tags</TooltipContent>
                        </Tooltip>
                        <AlertDialog>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label="Delete note"
                                  className="text-muted-dim hover:text-error"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent>Delete this note</TooltipContent>
                          </Tooltip>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete note {selected.title}?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This note will be permanently removed from this
                                workspace.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => {
                                  removeNote(selected.id);
                                  setSelectedId(null);
                                }}
                              >
                                Delete note
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <h1 className="mt-3 text-[20px] font-semibold leading-snug tracking-[-0.01em]">
                      {selected.title}
                    </h1>
                    {selected.tags.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selected.tags.map((tag) => {
                          const isTagActive = selectedTag === tag;
                          return (
                            <Tooltip key={tag}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedTag(isTagActive ? null : tag)
                                  }
                                  className={cn(
                                    "border px-1.5 py-px font-mono text-[10px] transition-colors",
                                    isTagActive
                                      ? "border-primary bg-primary/15 text-primary"
                                      : "border-border bg-surface-alt text-muted hover:border-primary/40 hover:text-foreground",
                                  )}
                                >
                                  #{tag}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {isTagActive
                                  ? `Clear #${tag} filter`
                                  : `Filter notes tagged #${tag}`}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    ) : null}
                  </header>
                  <div className="flex flex-col gap-4 pt-5">
                    {blocks.map((block, index) => (
                      <NoteBlock
                        key={index}
                        block={block}
                        activeDialect={activeDialect}
                        copied={copiedBlock === index}
                        onCopy={() => copyCode(block, index)}
                      />
                    ))}
                  </div>
                  <footer className="mt-10 border-t border-border pt-4 text-[10px] text-muted-dim">
                    {notes.length} notes in {activeWorkspace?.name ?? "workspace"} · offline markdown library
                  </footer>
                </article>
              )
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-dim">
                <FileText className="size-6" />
                <span className="text-[12px]">
                  {notes.length === 0
                    ? "No notes in this workspace yet"
                    : "Select a note from the right panel"}
                </span>
              </div>
            )}
          </div>
        </ResizablePanel>

        <Separator className="w-px bg-border transition-colors hover:bg-primary/50" />

        <ResizablePanel
          panelRef={sidebarRef}
          defaultSize={sidebarCollapsed ? 32 : 300}
          minSize={220}
          maxSize={420}
          collapsible
          collapsedSize={32}
          onResize={handleSidebarResize}
        >
          {sidebarCollapsed ? (
            <div className="flex h-full flex-col items-center gap-2 bg-surface pt-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open notes sidebar"
                    onClick={toggleSidebar}
                    className="flex size-7 items-center justify-center text-muted-dim transition-colors hover:bg-surface-hover hover:text-foreground"
                  >
                    <PanelRightOpen className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  Expand Notes sidebar (Ctrl+B)
                </TooltipContent>
              </Tooltip>
              <span className="rotate-90 font-mono text-[10px] uppercase tracking-widest text-muted-dim">
                Notes
              </span>
            </div>
          ) : (
            <aside className="flex h-full min-h-0 flex-col bg-surface">
              <div className="flex h-8 shrink-0 items-center justify-between border-b border-border pl-2.5 pr-1.5">
                <div className="flex items-center gap-1.5">
                  <FolderOpen className="size-3 text-primary" />
                  <span className="section-label">Categories & Notes</span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label="Close notes sidebar"
                      onClick={toggleSidebar}
                      className="flex size-6 items-center justify-center text-muted-dim transition-colors hover:bg-surface-hover hover:text-foreground"
                    >
                      <PanelRightClose className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    Collapse Notes sidebar (Ctrl+B)
                  </TooltipContent>
                </Tooltip>
              </div>

              <div className="max-h-56 shrink-0 overflow-y-auto border-b border-border bg-surface-alt/40 p-1.5">
                <button
                  type="button"
                  onClick={() => setCategoryFilter("all")}
                  className={cn(
                    "flex h-7 w-full items-center justify-between px-2 text-[11px] transition-colors",
                    categoryFilter === "all"
                      ? "bg-accent font-semibold text-accent-foreground"
                      : "text-muted hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  <span>All notes</span>
                  <span className="numeric font-mono text-[10px] text-muted-dim">
                    {notes.length}
                  </span>
                </button>
                {categories.map((cat, idx) => (
                  <div
                    key={cat.name}
                    className={cn(
                      "group flex h-7 items-center gap-1 px-2 text-[11px] transition-colors",
                      categoryFilter === cat.name
                        ? "bg-accent font-semibold text-accent-foreground"
                        : "text-muted hover:bg-surface-hover hover:text-foreground",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setCategoryFilter(cat.name)}
                      className="min-w-0 flex-1 truncate text-left"
                    >
                      {cat.name}
                    </button>
                    <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                      {cat.record ? (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Move ${cat.name} up`}
                                disabled={idx === 0}
                                onClick={() =>
                                  cat.record &&
                                  reorderNoteCategory(cat.record.id, "up")
                                }
                                className="flex size-5 items-center justify-center text-muted-dim hover:text-foreground disabled:opacity-30"
                              >
                                <ArrowUp className="size-2.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Move up</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Move ${cat.name} down`}
                                disabled={idx === categories.length - 1}
                                onClick={() =>
                                  cat.record &&
                                  reorderNoteCategory(cat.record.id, "down")
                                }
                                className="flex size-5 items-center justify-center text-muted-dim hover:text-foreground disabled:opacity-30"
                              >
                                <ArrowDown className="size-2.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Move down</TooltipContent>
                          </Tooltip>
                        </>
                      ) : null}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Rename ${cat.name}`}
                            onClick={() =>
                              setRenamingCat({
                                oldName: cat.name,
                                draft: cat.name,
                              })
                            }
                            className="flex size-5 items-center justify-center text-muted-dim hover:text-foreground"
                          >
                            <Pencil className="size-2.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Rename category</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Remove ${cat.name}`}
                            onClick={() => {
                              removeNoteCategory(cat.name, activeWorkspaceId);
                              if (categoryFilter === cat.name) {
                                setCategoryFilter("all");
                              }
                            }}
                            className="flex size-5 items-center justify-center text-muted-dim hover:text-destructive"
                          >
                            <Trash2 className="size-2.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Delete category</TooltipContent>
                      </Tooltip>
                    </div>
                    <span className="numeric font-mono text-[10px] text-muted-dim">
                      {cat.count}
                    </span>
                  </div>
                ))}
                <div className="mt-1 flex items-center gap-1 border-t border-border/60 pt-1">
                  <Input
                    value={newCategoryDraft}
                    onChange={(e) => setNewCategoryDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newCategoryDraft.trim()) {
                        createNoteCategory(newCategoryDraft, activeWorkspaceId);
                        setNewCategoryDraft("");
                      }
                    }}
                    placeholder="Add category..."
                    aria-label="New note category"
                    className="h-6 flex-1 border-border bg-surface px-2 text-[11px]"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        aria-label="Create note category"
                        disabled={!newCategoryDraft.trim()}
                        onClick={() => {
                          createNoteCategory(
                            newCategoryDraft,
                            activeWorkspaceId,
                          );
                          setNewCategoryDraft("");
                        }}
                      >
                        <Plus className="size-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Add note category</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {visible.length === 0 ? (
                  <p className="px-3 py-8 text-center text-[11px] text-muted-dim">
                    No notes match the current filter
                  </p>
                ) : null}
                {visible.map((note) => (
                  <NoteListItem
                    key={note.id}
                    note={note}
                    active={selected?.id === note.id}
                    onSelect={() => {
                      setSelectedId(note.id);
                      setEditing(false);
                    }}
                  />
                ))}
              </div>
            </aside>
          )}
        </ResizablePanel>
      </Group>

      {renamingCat ? (
        <Dialog open onOpenChange={(open) => !open && setRenamingCat(null)}>
          <DialogContent className="max-w-sm p-0">
            <DialogHeader className="border-b border-border bg-surface-alt px-4 py-3">
              <DialogTitle className="text-[13px]">
                Rename note category
              </DialogTitle>
            </DialogHeader>
            <div className="px-4 py-4">
              <Input
                value={renamingCat.draft}
                onChange={(e) =>
                  setRenamingCat({ ...renamingCat, draft: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter" && renamingCat.draft.trim()) {
                    renameNoteCategory(
                      renamingCat.oldName,
                      renamingCat.draft,
                      activeWorkspaceId,
                    );
                    if (categoryFilter === renamingCat.oldName) {
                      setCategoryFilter(renamingCat.draft.trim());
                    }
                    setRenamingCat(null);
                  }
                }}
                autoFocus
              />
            </div>
            <DialogFooter className="border-t border-border px-4 py-2.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRenamingCat(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!renamingCat.draft.trim()}
                onClick={() => {
                  renameNoteCategory(
                    renamingCat.oldName,
                    renamingCat.draft,
                    activeWorkspaceId,
                  );
                  if (categoryFilter === renamingCat.oldName) {
                    setCategoryFilter(renamingCat.draft.trim());
                  }
                  setRenamingCat(null);
                }}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </PageShell>
  );
}

export default function NotesPage(): React.ReactElement {
  return (
    <Suspense fallback={null}>
      <NotesContent />
    </Suspense>
  );
}

function NoteInlineEditor({
  note,
  categories,
  onSave,
  onCancel,
}: {
  note: Note;
  categories: string[];
  onSave: (note: Note) => void;
  onCancel: () => void;
}): React.ReactElement {
  const [title, setTitle] = useState(note.title);
  const [category, setCategory] = useState(note.category);
  const [tagsText, setTagsText] = useState(note.tags.join(", "));
  const [content, setContent] = useState(note.content);

  const handleSave = (): void => {
    if (!title.trim() || !content.trim()) return;
    const parsedTags = tagsText
      .split(/[,·]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    onSave({
      ...note,
      title: title.trim(),
      category: category.trim() || "General",
      tags: parsedTags,
      content: content.trim(),
    });
  };

  return (
    <div className="mx-auto min-h-full max-w-3xl border-x border-border bg-surface px-10 py-8">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <span className="section-label">Editing note</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!title.trim() || !content.trim()}
            onClick={handleSave}
          >
            Save changes
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-4">
        <div>
          <label className="section-label mb-1 block">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="section-label mb-1 block">Category</label>
            <Input
              list="note-edit-categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <datalist id="note-edit-categories">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="section-label mb-1 block">
              Tags (comma-separated)
            </label>
            <Input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="section-label mb-1 block">Markdown content</label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={18}
            className="font-mono text-[12px] leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
}

function ImportNotesButton({
  workspaceName,
  workspaceId,
  existingCategories,
}: {
  workspaceName: string;
  workspaceId: string;
  existingCategories: string[];
}): React.ReactElement {
  const addNote = usePackStore((state) => state.addNote);
  const [status, setStatus] = useState<InstallStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pendingNotes, setPendingNotes] = useState<Note[] | null>(null);
  const [targetCategory, setTargetCategory] = useState<string>("__preserve__");
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
        setPendingNotes(null);
        setStatus({
          ok: false,
          issues: parsed?.issues ?? [{ path: "$", message: "Invalid JSON" }],
        });
        setMessage(null);
      } else if (detected.kind !== "notes") {
        setPendingNotes(null);
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
        const pack = parsed.data as NotesPack;
        setPendingNotes(pack.notes);
        setTargetCategory("__preserve__");
        setStatus(null);
        setMessage(null);
      }
    } catch (error: unknown) {
      setPendingNotes(null);
      setStatus({
        ok: false,
        issues: [{ path: "file", message: errorMessage(error) }],
      });
      setMessage(null);
    }
    setOpen(true);
  };

  const confirmImport = (): void => {
    if (!pendingNotes) return;
    let count = 0;
    for (const note of pendingNotes) {
      const category =
        targetCategory === "__preserve__" ? note.category : targetCategory;
      addNote({ ...note, category }, workspaceId);
      count += 1;
    }
    setPendingNotes(null);
    setStatus({ ok: true, issues: [] });
    setMessage(`${count} notes imported into ${workspaceName}`);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2 text-[11px]"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-3.5" /> Import
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Bulk import notes from a JSON pack into {workspaceName}
        </TooltipContent>
      </Tooltip>
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
            setPendingNotes(null);
          }
        }}
      >
        <DialogContent className="max-w-md p-0">
          <DialogHeader className="border-b border-border bg-surface-alt px-4 py-3">
            <DialogTitle className="text-[13px]">Import notes</DialogTitle>
            <DialogDescription className="text-[11px]">
              Preview parsed notes and choose how categories map into{" "}
              {workspaceName}.
            </DialogDescription>
          </DialogHeader>
          {pendingNotes ? (
            <div className="flex flex-col gap-3 p-4 text-[12px]">
              <div className="border border-border bg-surface-alt px-3 py-2">
                <span className="font-semibold text-foreground">
                  {pendingNotes.length} notes
                </span>{" "}
                ready to import into{" "}
                <span className="font-mono text-primary">{workspaceName}</span>
              </div>
              <div className="flex flex-col gap-1">
                <label className="section-label">
                  Category mapping
                </label>
                <Select
                  value={targetCategory}
                  onValueChange={setTargetCategory}
                >
                  <SelectTrigger className="h-8 text-[11.5px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="__preserve__">
                        Preserve original note categories
                      </SelectItem>
                      {existingCategories.map((c) => (
                        <SelectItem key={c} value={c}>
                          Assign all to: {c}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="max-h-36 divide-y divide-border overflow-y-auto border border-border">
                {pendingNotes.slice(0, 12).map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between px-2.5 py-1.5 text-[11px]"
                  >
                    <span className="truncate font-medium">{n.title}</span>
                    <span className="font-mono text-[10px] text-muted-dim">
                      {targetCategory === "__preserve__"
                        ? n.category
                        : targetCategory}
                    </span>
                  </div>
                ))}
                {pendingNotes.length > 12 ? (
                  <div className="px-2.5 py-1 text-[10.5px] text-muted-dim">
                    +{pendingNotes.length - 12} more notes
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="p-4">
              <InstallReport status={status} message={message} />
            </div>
          )}
          <DialogFooter className="border-t border-border px-4 py-2.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              {pendingNotes ? "Cancel" : "Close"}
            </Button>
            {pendingNotes ? (
              <Button size="sm" onClick={confirmImport}>
                Import {pendingNotes.length} notes
              </Button>
            ) : null}
          </DialogFooter>
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
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button size="sm" className="h-7 gap-1.5 px-2 text-[11px]">
              <Plus className="size-3.5" /> New note
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Create a new study note</TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="border-b border-border bg-surface-alt px-4 py-3">
          <DialogTitle className="text-[13px]">Create Note</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-col gap-1">
            <label className="section-label">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Window Functions Cheat Sheet"
              className="h-8"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="section-label">Category</label>
              {categories.length > 0 ? (
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger size="sm" className="w-full text-[12px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
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
              <label className="section-label mb-1 block">
                Or new category
              </label>
              <Input
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="New category..."
                className="h-8"
              />
            </div>
          </div>
          <div>
            <label className="section-label mb-1 block">
              Tags (comma-separated)
            </label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="window, over, partition"
              className="h-8"
            />
          </div>
          <div>
            <label className="section-label mb-1 block">
              Content (Markdown)
            </label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                "# Header\n\nExplanation and code:\n\n```sql\nSELECT ROW_NUMBER() OVER ();\n```"
              }
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
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label={`Category: ${note.category}. Change it`}
              className="bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
            >
              {note.category}
            </button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Change note category</TooltipContent>
      </Tooltip>
      <DialogContent className="max-w-sm p-0">
        <DialogHeader className="border-b border-border bg-surface-alt px-4 py-3">
          <DialogTitle className="text-[13px]">Note category</DialogTitle>
          <DialogDescription className="text-[11px]">
            Pick an existing category or type a new one — it is created on save.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 px-4 py-4">
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
          <Button
            size="sm"
            disabled={draft.trim().length === 0}
            onClick={submit}
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "code"; lang: string; text: string }
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
  activeDialect,
  copied,
  onCopy,
}: {
  block: Block;
  activeDialect: EngineDialect;
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
            block.level === 2 && "pt-2 text-[15px]",
            block.level === 3 &&
              "text-[13px] uppercase tracking-wider text-muted",
          )}
        >
          {block.text}
        </h2>
      );
    case "code":
      return (
        <CodeBlock
          code={block.text}
          lang={block.lang}
          activeDialect={activeDialect}
          copied={copied}
          onCopy={onCopy}
        />
      );
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
        <ol className="flex flex-col gap-1.5 pl-1 text-[12.5px] leading-relaxed text-muted">
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
        <ul className="flex flex-col gap-1.5 pl-1 text-[12.5px] leading-relaxed text-muted">
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
  lang,
  activeDialect,
  copied,
  onCopy,
}: {
  code: string;
  lang: string;
  activeDialect: EngineDialect;
  copied: boolean;
  onCopy: () => void;
}): React.ReactElement {
  const badge = lang.trim()
    ? lang.toUpperCase()
    : dialectLabel(activeDialect).toUpperCase();
  const isSqlLike =
    lang === "" ||
    /^(sql|sqlite|postgres|postgresql|mysql|tsql|mssql)$/i.test(lang);
  return (
    <div className="overflow-hidden border border-border bg-editor">
      <div className="flex h-7 items-center justify-between border-b border-border bg-surface px-2">
        <span className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-dim">
          <span className="size-1.5 bg-primary" aria-hidden="true" />
          {badge}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
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
          </TooltipTrigger>
          <TooltipContent>Copy snippet to clipboard</TooltipContent>
        </Tooltip>
      </div>
      <pre className="overflow-x-auto p-3 font-mono text-[11.5px] leading-relaxed">
        <code>
          {isSqlLike
            ? highlightSql(code).map((token, index) => (
                <span key={index} className={token.className}>
                  {token.text}
                </span>
              ))
            : code}
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
  "fetch",
  "top",
  "insert",
  "into",
  "values",
  "update",
  "set",
  "delete",
  "create",
  "database",
  "use",
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
  "ilike",
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
  "returning",
  "over",
  "partition",
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
