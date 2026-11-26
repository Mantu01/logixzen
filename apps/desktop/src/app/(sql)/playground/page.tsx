"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Group,
  Panel,
  Separator,
  usePanelRef,
  type PanelSize,
} from "react-resizable-panels";
import {
  AlignLeft,
  FolderOpen,
  Loader2,
  Plus,
  Save,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { SqlResult } from "@/shared/desktop-api";
import { PageShell } from "@/components/app-shell/page-shell";
import { SchemaPanel } from "@/components/playground/SchemaPanel";
import { PlaygroundResultPanel } from "@/components/playground/ResultPanel";
import {
  CopySqlButton,
  HistoryDialog,
  RunButton,
  SnippetsDialog,
} from "@/components/playground/tool-dialogs";
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
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePackStore } from "@/stores/usePackStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { useQueryHistoryStore } from "@/stores/useQueryHistoryStore";
import { useQueryFilesStore } from "@/stores/useQueryFilesStore";
import { useSqlStore } from "@/sql/useSqlStore";
import { exportToCsv, exportToJson } from "@/lib/exportUtils";
import { saveTextFile } from "@/lib/save-file";
import { useEnsureActiveDataset } from "@/hooks/use-ensure-active-dataset";
import { useFontZoom } from "@/hooks/use-font-zoom";
import { cn } from "@/lib/utils";
import { dialectLabel, formatSql, tableMapFrom } from "@/lib/sql-editor";
import { filterDatasetsForEngine } from "@/lib/dataset-from-sql";
import { ENGINE_CATALOG } from "@/shared/engine-catalog";
import { splitBatches, splitSqlStatements } from "@/shared/sql";
import type { EngineOptionId, InstallationRecord } from "@/shared/engines";
import { errorMessage, waitForJob } from "@/lib/engine-jobs";

const SCHEMA_COLLAPSED_KEY = "logixzen.schemaPanel.collapsed";

const SqlCodeEditor = dynamic(
  () =>
    import("@/components/editor/SqlCodeEditor").then((m) => m.SqlCodeEditor),
  { ssr: false },
);

const ErDiagram = dynamic(
  () => import("@/features/schema/er-diagram").then((m) => m.ErDiagram),
  { ssr: false },
);

function toEngineChoices(
  records: InstallationRecord[],
): Array<{ id: EngineOptionId; name: string; status: InstallationRecord["status"] }> {
  return records
    .filter((record) => record.status === "ready" || record.status === "stopped")
    .map((record) => ({
      id: record.optionId,
      name:
        ENGINE_CATALOG.find((entry) => entry.id === record.optionId)
          ?.displayName ?? record.optionId,
      status: record.status,
    }));
}

function extractStatementPreviews(sql: string): string[] {
  const list: string[] = [];
  for (const batch of splitBatches(sql)) {
    for (const stmt of splitSqlStatements(batch.join("\n"))) {
      list.push(stmt.sql.replace(/\s+/g, " ").trim());
    }
  }
  return list;
}

export default function PlaygroundPage(): React.ReactElement {
  return (
    <Suspense fallback={<Loading />}>
      <PlaygroundInner />
    </Suspense>
  );
}

function Loading(): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center text-muted-dim">
      <Loader2 className="size-4 animate-spin" />
    </div>
  );
}

function PlaygroundInner(): React.ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  const allDatabases = usePackStore((state) => state.databases);
  const hydrated = usePackStore((state) => state.hydrated);
  const schema = useSqlStore((state) => state.schema);
  const isLoading = useSqlStore((state) => state.isLoading);
  const activeDatasetId = useSqlStore((state) => state.activeDatasetId);
  const execute = useSqlStore((state) => state.execute);
  const activateDataset = useSqlStore((state) => state.activateDataset);
  const clearError = useSqlStore((state) => state.clearError);
  const activeDialect = useSqlStore((state) => state.activeDialect);
  const lastResult = useSqlStore((state) => state.lastResult);
  const resultVersion = useSqlStore((state) => state.resultVersion);
  const addToHistory = useQueryHistoryStore((state) => state.addToHistory);
  const editorFontSize = useProgressStore(
    (state) => state.settings.editorFontSize,
  );
  const setEditorFontSize = useProgressStore(
    (state) => state.setEditorFontSize,
  );
  const resultFontSize = useProgressStore(
    (state) => state.settings.resultFontSize,
  );
  const setResultFontSize = useProgressStore(
    (state) => state.setResultFontSize,
  );

  const files = useQueryFilesStore((state) => state.files);
  const activeId = useQueryFilesStore((state) => state.activeId);
  const setActive = useQueryFilesStore((state) => state.setActive);
  const setContent = useQueryFilesStore((state) => state.setContent);
  const newFile = useQueryFilesStore((state) => state.newFile);
  const closeFile = useQueryFilesStore((state) => state.closeFile);
  const openFileTab = useQueryFilesStore((state) => state.openFile);

  const results = useMemo(() => lastResult ?? [], [lastResult]);
  const [resultIndex, setResultIndex] = useState(0);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [pendingDestructive, setPendingDestructive] = useState<string | null>(
    null,
  );
  const [executedQueries, setExecutedQueries] = useState<string[]>([]);
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const schemaPanelRef = usePanelRef();
  const [schemaCollapsed, setSchemaCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(SCHEMA_COLLAPSED_KEY) === "true",
  );
  const collapsedRef = useRef(schemaCollapsed);

  const activeOptionId = useSqlStore((state) => state.activeOptionId);
  const activeEngineName = useSqlStore((state) => state.activeEngineName);
  const connectionStatus = useSqlStore((state) => state.connectionStatus);
  const autoConnect = useSqlStore((state) => state.autoConnect);
  const databases = useMemo(
    () => filterDatasetsForEngine(allDatabases, activeOptionId),
    [allDatabases, activeOptionId],
  );
  const [readyEngines, setReadyEngines] = useState<
    Array<{
      id: EngineOptionId;
      name: string;
      status: InstallationRecord["status"];
    }>
  >([]);
  const [isSwitchingEngine, setIsSwitchingEngine] = useState(false);

  const loadReadyEngines = useCallback(async (): Promise<void> => {
    const bridge = window.logixzen?.setup;
    if (!bridge) return;
    const res = await bridge.installations();
    if (res.ok) setReadyEngines(toEngineChoices(res.data));
  }, []);

  useEffect(() => {
    window.logixzen?.setup.installations().then((res) => {
      if (res.ok) setReadyEngines(toEngineChoices(res.data));
    });
  }, [activeOptionId]);

  const handleSwitchEngine = async (optionId: EngineOptionId) => {
    const bridge = window.logixzen?.setup;
    if (!bridge || optionId === activeOptionId) return;
    setIsSwitchingEngine(true);
    setRunError(null);
    try {
      const started = await bridge.switch(optionId);
      if (!started.ok) {
        setRunError(started.failure.cause);
        return;
      }
      const finished = await waitForJob(started.data.id);
      if (finished?.state !== "succeeded") {
        setRunError(finished?.failure?.cause ?? "Engine switch did not complete.");
        return;
      }
      await autoConnect();
      await loadReadyEngines();
    } catch (error) {
      setRunError(errorMessage(error));
    } finally {
      setIsSwitchingEngine(false);
    }
  };

  const activeFile = useMemo(
    () => files.find((file) => file.id === activeId) ?? files[0] ?? null,
    [files, activeId],
  );
  const sql = activeFile?.content ?? "";

  const editorZoomRef = useFontZoom(editorFontSize, setEditorFontSize);
  const resultZoomRef = useFontZoom(resultFontSize, setResultFontSize);

  const appliedInitialSql = useRef(false);
  useEffect(() => {
    if (appliedInitialSql.current || activeFile === null) return;
    const initial = params.get("sql");
    if (initial !== null && activeFile.content.length === 0) {
      appliedInitialSql.current = true;
      setContent(activeFile.id, initial);
    }
  }, [params, activeFile, setContent]);

  useEnsureActiveDataset();

  const runSqlNow = useCallback(
    async (text: string) => {
      clearError();
      setRunError(null);
      setExecutedQueries(extractStatementPreviews(text));
      await execute(text);
      const state = useSqlStore.getState();
      setResultIndex(0);
      const failedStatement = state.lastResult?.find(
        (result) => result.error !== undefined,
      );
      const failure = failedStatement?.error ?? state.error ?? null;
      setRunError(failure);
      addToHistory(text, failure === null);
    },
    [execute, clearError, addToHistory],
  );

  const run = useCallback(async () => {
    const text = sql.trim();
    if (text.length === 0) return;
    if (/\bDROP\s+(DATABASE|TABLE)\b|\bTRUNCATE\s+(TABLE\s+)?\w/i.test(text)) {
      setPendingDestructive(text);
      return;
    }
    await runSqlNow(text);
  }, [sql, runSqlNow]);

  const current = useMemo(
    () => results[resultIndex] ?? null,
    [results, resultIndex],
  );

  const tableMap = useMemo(() => tableMapFrom(schema), [schema]);

  const activeDataset = databases.find((item) => item.id === activeDatasetId);

  const download = useCallback(
    async (format: "csv" | "json") => {
      if (!current) return;
      const content =
        format === "csv" ? exportToCsv(current) : exportToJson(current);
      await saveTextFile(`logixzen-result.${format}`, content, [
        { name: format.toUpperCase(), extensions: [format] },
      ]);
    },
    [current],
  );

  const saveSqlFile = useCallback(async () => {
    if (!activeFile || activeFile.content.trim().length === 0) return;
    const saved = await saveTextFile(activeFile.name, activeFile.content, [
      { name: "SQL", extensions: ["sql"] },
    ]);
    if (saved) {
      setSavedNotice(activeFile.name);
      window.setTimeout(() => setSavedNotice(null), 1600);
    }
  }, [activeFile]);

  const openSqlFile = useCallback(async () => {
    const path = await window.logixzen?.dialog.openFile({
      title: "Open SQL file",
      filters: [{ name: "SQL", extensions: ["sql", "txt"] }],
    });
    if (path === null || path === undefined) return;
    try {
      const content = await window.logixzen?.files.readText(path);
      if (typeof content !== "string") return;
      const name = path.split(/[\\/]/).pop() ?? "query.sql";
      openFileTab(name, content);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : String(error));
    }
  }, [openFileTab]);

  const toggleSchemaPanel = useCallback((): void => {
    const panel = schemaPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  }, [schemaPanelRef]);

  const handleFormatSql = useCallback((): void => {
    if (!activeFile || activeFile.content.trim().length === 0) return;
    setContent(activeFile.id, formatSql(activeFile.content));
  }, [activeFile, setContent]);

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setDiagramOpen(false);
        setHistoryOpen(false);
        setPendingDestructive(null);
        return;
      }
      if (event.key === "F5") {
        event.preventDefault();
        void run();
        return;
      }
      const mod = event.ctrlKey || event.metaKey;
      if (!mod || event.altKey) return;
      const key = event.key.toLowerCase();
      if (event.shiftKey && key === "c") {
        if (sql.trim().length > 0) {
          event.preventDefault();
          void navigator.clipboard.writeText(sql);
          setSavedNotice("copied");
          window.setTimeout(() => setSavedNotice(null), 1200);
        }
        return;
      }
      if (event.shiftKey && key === "f") {
        event.preventDefault();
        handleFormatSql();
        return;
      }
      if (key === "s") {
        event.preventDefault();
        void saveSqlFile();
      } else if (key === "n") {
        event.preventDefault();
        newFile();
      } else if (key === "w") {
        event.preventDefault();
        if (activeFile) closeFile(activeFile.id);
      } else if (key === "o") {
        event.preventDefault();
        void openSqlFile();
      } else if (key === "h") {
        event.preventDefault();
        setHistoryOpen((prev) => !prev);
      } else if (key === "b" && !event.shiftKey) {
        event.preventDefault();
        toggleSchemaPanel();
      } else if (key === "d" && !event.shiftKey) {
        if (schema.length > 0) {
          event.preventDefault();
          setDiagramOpen((prev) => !prev);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    saveSqlFile,
    newFile,
    closeFile,
    activeFile,
    openSqlFile,
    run,
    sql,
    handleFormatSql,
    toggleSchemaPanel,
    schema.length,
  ]);

  return (
    <PageShell
      title="Editor"
      subtitle={
        activeDataset
          ? `${activeDataset.name} · ${dialectLabel(activeDialect)} · ${schema.length} tables`
          : hydrated
            ? `${dialectLabel(activeDialect)} · No database selected`
            : undefined
      }
      actions={
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex h-7 items-center gap-1.5 border border-border bg-surface-alt px-2 text-[10.5px]">
                <span
                  className={cn(
                    "size-1.5",
                    connectionStatus === "ready"
                      ? "bg-success"
                      : connectionStatus === "connecting"
                        ? "bg-primary animate-pulse"
                        : "bg-destructive",
                  )}
                />
                <span className="font-mono font-semibold uppercase text-foreground">
                  {dialectLabel(activeDialect)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Active engine: {activeEngineName} ({dialectLabel(activeDialect)} dialect)
            </TooltipContent>
          </Tooltip>
          {readyEngines.length > 0 ? (
            <Select
              value={activeOptionId ?? ""}
              onValueChange={(val) =>
                void handleSwitchEngine(val as EngineOptionId)
              }
              disabled={isSwitchingEngine}
            >
              <SelectTrigger
                size="sm"
                className="w-36 border-border text-[11px]"
                aria-label="Active engine"
              >
                <SelectValue placeholder="Engine" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {readyEngines.map((eng) => (
                    <SelectItem
                      key={eng.id}
                      value={eng.id}
                      className="text-[11px]"
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "size-1.5",
                            eng.status === "ready"
                              ? "bg-success"
                              : "bg-warning",
                          )}
                        />
                        <span>{eng.name}</span>
                        {eng.status === "stopped" ? (
                          <span className="text-[9.5px] text-muted-dim">
                            (stopped)
                          </span>
                        ) : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-7 text-[11px] text-destructive border-destructive/40"
            >
              <Link href="/setup">Install Engine</Link>
            </Button>
          )}
          <Select
            value={activeDatasetId ?? ""}
            onValueChange={(value) => {
              if (value === "__new__") {
                router.push("/schema");
                return;
              }
              void activateDataset(value);
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-52"
              aria-label="Active learning database"
            >
              <SelectValue placeholder="Select database" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {databases.length === 0 ? (
                  <div className="px-2 py-1.5 text-[11.5px] text-muted-dim">
                    No databases yet
                  </div>
                ) : null}
                {databases.map((dataset) => (
                  <SelectItem key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </SelectItem>
                ))}
                <SelectItem
                  value="__new__"
                  className="border-t border-border text-primary"
                >
                  + New database...
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <ToolIconButton
            label="ER diagram"
            shortcut="Ctrl+D"
            disabled={schema.length === 0}
            onClick={() => setDiagramOpen(true)}
          >
            <DiagramIcon />
          </ToolIconButton>
          <HistoryDialog
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            onPick={(picked) => {
              if (activeFile) setContent(activeFile.id, picked);
            }}
          />
          <SnippetsDialog
            sql={sql}
            onPick={(picked) => {
              if (activeFile) setContent(activeFile.id, picked);
            }}
          />
          <ToolIconButton
            label="Format SQL"
            shortcut="Ctrl+Shift+F"
            disabled={sql.trim().length === 0}
            onClick={handleFormatSql}
          >
            <AlignLeft className="size-3.5" />
          </ToolIconButton>
          <CopySqlButton sql={sql} />
          <RunButton onClick={() => void run()} isLoading={isLoading} />
        </>
      }
      bodyClassName="overflow-hidden"
    >
      <div className="flex h-full min-h-0">
        <Group
          id="playground-horizontal"
          defaultLayout={{ editor: 72, schema: 28 }}
        >
          <Panel id="editor" defaultSize="72%" minSize="40%">
            <Group
              id="playground-vertical"
              orientation="vertical"
              defaultLayout={{ query: 45, results: 55 }}
            >
              <Panel id="query" defaultSize="45%" minSize="15%">
                <div className="flex h-full min-h-0 flex-col bg-editor">
                  <QueryTabBar
                    files={files}
                    activeId={activeFile?.id ?? null}
                    savedNotice={savedNotice}
                    onSelect={setActive}
                    onClose={closeFile}
                    onNew={() => newFile()}
                    onSave={() => void saveSqlFile()}
                    onOpen={() => void openSqlFile()}
                  />
                  <div
                    ref={editorZoomRef}
                    className="min-h-0 flex-1 overflow-hidden"
                  >
                    <SqlCodeEditor
                      value={sql}
                      onChange={(value) => {
                        if (activeFile) setContent(activeFile.id, value);
                      }}
                      onRun={() => void run()}
                      dialect={activeDialect}
                      fontSize={editorFontSize}
                      tables={tableMap}
                      placeholder="Type a SQL statement…"
                      minHeight="100%"
                    />
                  </div>
                </div>
              </Panel>
              <Separator className="h-px bg-border transition-colors hover:bg-primary/60" />
              <Panel id="results" defaultSize="55%" minSize="15%">
                <div ref={resultZoomRef} className="h-full min-h-0 bg-surface">
                  {results.length > 1 ? (
                    <ResultTabs
                      results={results}
                      queries={executedQueries}
                      index={resultIndex}
                      onSelect={setResultIndex}
                    />
                  ) : null}
                  <PlaygroundResultPanel
                    key={`${resultVersion}:${resultIndex}`}
                    result={current}
                    error={
                      current?.error ??
                      (results.length === 0 ? (runError ?? undefined) : undefined)
                    }
                    isLoading={isLoading}
                    fontSize={resultFontSize}
                    onExportCsv={() => void download("csv")}
                    onExportJson={() => void download("json")}
                    onCopy={() => {
                      if (current)
                        void navigator.clipboard.writeText(
                          exportToCsv(current),
                        );
                    }}
                  />
                </div>
              </Panel>
            </Group>
          </Panel>
          <Separator className="w-px bg-border transition-colors hover:bg-primary/60" />
          <Panel
            id="schema"
            defaultSize={schemaCollapsed ? "4%" : "28%"}
            minSize="14%"
            collapsible
            collapsedSize="4%"
            panelRef={schemaPanelRef}
            onResize={(size: PanelSize) => {
              const collapsed =
                schemaPanelRef.current?.isCollapsed() ??
                size.asPercentage <= 4.5;
              if (collapsed !== collapsedRef.current) {
                collapsedRef.current = collapsed;
                setSchemaCollapsed(collapsed);
                if (typeof window !== "undefined") {
                  window.localStorage.setItem(
                    SCHEMA_COLLAPSED_KEY,
                    String(collapsed),
                  );
                }
              }
            }}
          >
            <SchemaPanel
              tables={schema}
              activeTable={activeTable}
              onSelectTable={setActiveTable}
              collapsed={schemaCollapsed}
              onToggleCollapsed={toggleSchemaPanel}
            />
          </Panel>
        </Group>
      </div>

      <AlertDialog
        open={pendingDestructive !== null}
        onOpenChange={(open) => !open && setPendingDestructive(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run destructive statement?</AlertDialogTitle>
            <AlertDialogDescription>
              This script contains DROP or TRUNCATE. Data or structures it
              targets will be permanently removed from the active database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const text = pendingDestructive;
                setPendingDestructive(null);
                if (text !== null) void runSqlNow(text);
              }}
            >
              Run anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={diagramOpen} onOpenChange={setDiagramOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex h-[88vh] w-[94vw] max-w-[1500px] flex-col gap-0 overflow-hidden p-0"
        >
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
            <div className="flex min-w-0 items-baseline gap-2.5">
              <DialogTitle className="truncate text-[13px] font-semibold">
                {activeDataset?.name ?? "Schema"} — ER diagram
              </DialogTitle>
              <span className="numeric shrink-0 text-[10.5px] text-muted-dim">
                {schema.length} tables
              </span>
            </div>
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                Close
              </Button>
            </DialogClose>
          </div>
          <DialogDescription className="sr-only">
            Entity relationship diagram
          </DialogDescription>
          <div className="min-h-0 flex-1">
            <ErDiagram
              tables={schema}
              highlightTable={activeTable}
              onTableClick={(table) => setActiveTable(table)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function ToolIconButton({
  label,
  shortcut,
  disabled,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut ? (
          <kbd className="ml-1 font-mono text-[9px] text-background/70">
            {shortcut}
          </kbd>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

function DiagramIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1.5"
        width="5"
        height="11"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <rect
        x="8"
        y="1.5"
        width="5"
        height="5"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <rect
        x="8"
        y="7.5"
        width="5"
        height="5"
        stroke="currentColor"
        strokeWidth="1.1"
      />
      <path d="M6 4h2M6 10h2" stroke="currentColor" strokeWidth="1.1" />
    </svg>
  );
}

function QueryTabBar({
  files,
  activeId,
  savedNotice,
  onSelect,
  onClose,
  onNew,
  onSave,
  onOpen,
}: {
  files: Array<{ id: string; name: string }>;
  activeId: string | null;
  savedNotice: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onSave: () => void;
  onOpen: () => void;
}): React.ReactElement {
  return (
    <div className="flex h-8 shrink-0 items-stretch justify-between border-b border-border bg-surface">
      <div className="flex min-w-0 flex-1 items-stretch overflow-x-auto">
        {files.map((file) => {
          const active = file.id === activeId;
          return (
            <div
              key={file.id}
              className={cn(
                "group flex min-w-0 shrink-0 items-center gap-1 border-r border-border",
                active ? "bg-editor" : "bg-surface hover:bg-surface-hover",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(file.id)}
                className={cn(
                  "flex h-8 min-w-0 items-center gap-1.5 pl-3 pr-1.5 font-mono text-[11px]",
                  active
                    ? "text-foreground"
                    : "text-muted-dim hover:text-foreground",
                )}
              >
                {active ? (
                  <span
                    className="size-1.5 shrink-0 bg-primary"
                    aria-hidden="true"
                  />
                ) : null}
                <span className="max-w-40 truncate">{file.name}</span>
              </button>
              <button
                type="button"
                aria-label={`Close ${file.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onClose(file.id);
                }}
                className="flex size-5 items-center justify-center text-muted-dim opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="size-3" />
              </button>
            </div>
          );
        })}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="New query file"
              onClick={onNew}
              className="flex w-8 shrink-0 items-center justify-center text-muted-dim transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <Plus className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            New query
            <kbd className="ml-1 font-mono text-[9px] text-background/70">
              Ctrl+N
            </kbd>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 px-1.5">
        <div className="flex items-center gap-0.5">
        {savedNotice !== null ? (
          <span className="mr-1 font-mono text-[10px] text-success">
            saved {savedNotice}
          </span>
        ) : null}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Open SQL file"
              onClick={onOpen}
              className="flex size-6 items-center justify-center text-muted-dim transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <FolderOpen className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            Open .sql file
            <kbd className="ml-1 font-mono text-[9px] text-background/70">
              Ctrl+O
            </kbd>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Save file to disk"
              onClick={onSave}
              className="flex size-6 items-center justify-center text-muted-dim transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <Save className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            Export file to disk
            <kbd className="ml-1 font-mono text-[9px] text-background/70">
              Ctrl+S
            </kbd>
          </TooltipContent>
        </Tooltip>
        </div>
      </div>
    </div>
  );
}

function ResultTabs({
  results,
  queries,
  index,
  onSelect,
}: {
  results: SqlResult[];
  queries: string[];
  index: number;
  onSelect: (index: number) => void;
}): React.ReactElement {
  return (
    <div className="flex h-7 shrink-0 items-stretch overflow-x-auto border-b border-border bg-surface-alt">
      {results.map((result, i) => {
        const previewText = queries[i] ?? `Statement ${i + 1}`;
        const shortPreview =
          previewText.length > 32
            ? `${previewText.slice(0, 32)}…`
            : previewText;
        const duration =
          result.executionTimeMs !== undefined
            ? `${Math.round(result.executionTimeMs)}ms`
            : null;
        return (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onSelect(i)}
                className={cn(
                  "flex max-w-64 shrink-0 items-center gap-1.5 border-r border-border px-2.5 text-[10.5px] transition-colors",
                  i === index
                    ? "bg-surface text-foreground"
                    : "text-muted-dim hover:text-foreground",
                )}
              >
                <span className="font-mono text-muted-dim">#{i + 1}</span>
                <span className="truncate font-mono">{shortPreview}</span>
                {result.error !== undefined ? (
                  <span className="size-1.5 shrink-0 bg-destructive" />
                ) : result.isSelect ? (
                  <span className="numeric shrink-0 text-muted-dim">
                    {result.rows.length}r
                  </span>
                ) : (
                  <span className="numeric shrink-0 text-muted-dim">
                    {result.rowsAffected}w
                  </span>
                )}
                {duration ? (
                  <span className="numeric shrink-0 font-mono text-[9.5px] text-muted-dim">
                    {duration}
                  </span>
                ) : null}
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm font-mono text-[10.5px]">
              {previewText}
              {result.error ? ` — Error: ${result.error}` : ""}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
