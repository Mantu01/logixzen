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
  Download,
  FileCode2,
  FolderOpen,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { SqlResult } from "@/shared/desktop-api";
import { SchemaPanel } from "@/components/playground/SchemaPanel";
import { PlaygroundResultPanel } from "@/components/playground/ResultPanel";
import {
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
  DialogDescription,
  DialogTitle,
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
import { useQueryFilesStore, type QueryFile } from "@/stores/useQueryFilesStore";
import { useSqlStore } from "@/sql/useSqlStore";
import { exportToCsv, exportToJson } from "@/lib/exportUtils";
import { saveTextFile, saveTextFileAs } from "@/lib/save-file";
import { useEnsureActiveDataset } from "@/hooks/use-ensure-active-dataset";
import { useFontZoom } from "@/hooks/use-font-zoom";
import { cn } from "@/lib/utils";
import { dialectLabel, tableMapFrom } from "@/lib/sql-editor";
import { filterDatasetsForEngine } from "@/lib/dataset-from-sql";
import { ENGINE_CATALOG } from "@/shared/engine-catalog";
import { splitBatches, splitSqlStatements } from "@/shared/sql";
import type { EngineOptionId, InstallationRecord } from "@/shared/engines";
import { errorMessage, waitForJob } from "@/lib/engine-jobs";

const SCHEMA_COLLAPSED_KEY = "logixzen.schemaPanel.collapsed";
const RESULTS_OPEN_HEIGHT_KEY = "logixzen.resultsPanel.openPct";
const DEFAULT_RESULTS_OPEN_PCT = 58;

function readSavedResultsOpenPct(): number {
  if (typeof window === "undefined") return DEFAULT_RESULTS_OPEN_PCT;
  const raw = Number(window.localStorage.getItem(RESULTS_OPEN_HEIGHT_KEY));
  if (!Number.isFinite(raw) || raw < 20 || raw > 80) {
    return DEFAULT_RESULTS_OPEN_PCT;
  }
  return raw;
}

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
): Array<{
  id: EngineOptionId;
  name: string;
  status: InstallationRecord["status"];
}> {
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
    <div className="flex h-full w-full items-center justify-center text-muted-dim">
      <Loader2 className="size-4 animate-spin" />
    </div>
  );
}

function PlaygroundInner(): React.ReactElement {
  const router = useRouter();
  const params = useSearchParams();
  const allDatabases = usePackStore((state) => state.databases);
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
  const renameFile = useQueryFilesStore((state) => state.renameFile);
  const markSaved = useQueryFilesStore((state) => state.markSaved);
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
  const [snippetsOpen, setSnippetsOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const schemaPanelRef = usePanelRef();
  const resultsPanelRef = usePanelRef();
  const [schemaCollapsed, setSchemaCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(SCHEMA_COLLAPSED_KEY) === "true",
  );
  const collapsedRef = useRef(schemaCollapsed);
  const [resultsCollapsed, setResultsCollapsed] = useState(
    () => results.length === 0,
  );
  const resultsCollapsedRef = useRef(resultsCollapsed);
  const [initialResultsOpenPct] = useState(readSavedResultsOpenPct);
  const savedOpenPctRef = useRef<number>(initialResultsOpenPct);

  const activeOptionId = useSqlStore((state) => state.activeOptionId);
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
        setRunError(
          finished?.failure?.cause ?? "Engine switch did not complete.",
        );
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
    if (appliedInitialSql.current) return;
    const initial = params.get("sql");
    if (initial === null) return;
    if (activeFile === null) {
      appliedInitialSql.current = true;
      newFile(undefined, initial);
      return;
    }
    if (activeFile.content.length === 0) {
      appliedInitialSql.current = true;
      setContent(activeFile.id, initial);
    }
  }, [params, activeFile, setContent, newFile]);

  useEnsureActiveDataset();

  const expandResultsPanel = useCallback((): void => {
    const panel = resultsPanelRef.current;
    const targetPct = savedOpenPctRef.current;
    if (panel) {
      if (panel.isCollapsed()) panel.expand();
      panel.resize(`${targetPct}%`);
    }
    resultsCollapsedRef.current = false;
    setResultsCollapsed(false);
  }, [resultsPanelRef]);

  const toggleResultsPanel = useCallback((): void => {
    if (activeFile === null) return;
    const panel = resultsPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      expandResultsPanel();
    } else {
      panel.collapse();
      resultsCollapsedRef.current = true;
      setResultsCollapsed(true);
    }
  }, [activeFile, resultsPanelRef, expandResultsPanel]);

  const runSqlNow = useCallback(
    async (text: string) => {
      clearError();
      setRunError(null);
      expandResultsPanel();
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
    [execute, clearError, addToHistory, expandResultsPanel],
  );

  const run = useCallback(async () => {
    if (activeFile === null) return;
    const text = sql.trim();
    if (text.length === 0) return;
    if (/\bDROP\s+(DATABASE|TABLE)\b|\bTRUNCATE\s+(TABLE\s+)?\w/i.test(text)) {
      setPendingDestructive(text);
      return;
    }
    await runSqlNow(text);
  }, [activeFile, sql, runSqlNow]);

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

  const exportSqlFile = useCallback(async () => {
    if (!activeFile || activeFile.content.trim().length === 0) return;
    const savedPath = await saveTextFileAs(
      activeFile.filePath ?? activeFile.name,
      activeFile.content,
      [{ name: "SQL", extensions: ["sql"] }],
    );
    if (savedPath !== null) {
      const savedName = savedPath.split(/[\\/]/).pop() ?? activeFile.name;
      markSaved(activeFile.id, savedPath, savedName);
      setSavedNotice(savedName);
      window.setTimeout(() => setSavedNotice(null), 1600);
    }
  }, [activeFile, markSaved]);

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
      openFileTab(name, content, path);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : String(error));
    }
  }, [openFileTab]);

  const toggleSchemaPanel = useCallback((): void => {
    if (activeFile === null) return;
    const panel = schemaPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  }, [activeFile, schemaPanelRef]);

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
      if (event.shiftKey && key === "s") {
        event.preventDefault();
        setSnippetsOpen((prev) => !prev);
        return;
      }
      if (key === "s") {
        event.preventDefault();
        void exportSqlFile();
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
      } else if (key === "j" && !event.shiftKey) {
        event.preventDefault();
        toggleResultsPanel();
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
    exportSqlFile,
    newFile,
    closeFile,
    activeFile,
    openSqlFile,
    run,
    toggleSchemaPanel,
    toggleResultsPanel,
    schema.length,
  ]);

  const pickHistoryOrSnippet = useCallback(
    (picked: string) => {
      if (activeFile) {
        setContent(activeFile.id, picked);
      } else {
        newFile(undefined, picked);
      }
    },
    [activeFile, setContent, newFile],
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <header className="grid h-10 shrink-0 grid-cols-[minmax(0,7fr)_minmax(max-content,3fr)] border-b border-border bg-surface">
        <EditorTabStrip
          files={files}
          activeId={activeFile?.id ?? null}
          savedNotice={savedNotice}
          onSelect={setActive}
          onClose={closeFile}
          onRename={renameFile}
        />

        <div className="flex min-w-0 items-center gap-1 border-l border-border bg-surface px-2">
          <RunButton
            onClick={() => void run()}
            isLoading={isLoading}
            disabled={activeFile === null || sql.trim().length === 0}
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => newFile()}
                aria-label="New query file"
                className="h-7 shrink-0 border-border px-2 text-[11px] font-medium"
              >
                <Plus data-icon="inline-start" />
                New
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              New query file
              <kbd className="ml-1.5 border border-background/25 px-1 py-px font-mono text-[9px] text-background/85">
                Ctrl+N
              </kbd>
            </TooltipContent>
          </Tooltip>

          <span className="mx-0.5 h-4 w-px shrink-0 bg-border" aria-hidden="true" />

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
                className="h-7 w-[88px] min-w-0 border-border px-1.5 text-[11px]"
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
                            "size-1.5 shrink-0",
                            eng.status === "ready"
                              ? "bg-success"
                              : "bg-warning",
                          )}
                        />
                        <span className="truncate">{eng.name}</span>
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
              className="h-7 shrink-0 border-destructive/40 px-2 text-[11px] text-destructive"
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
              className="h-7 min-w-[82px] flex-1 max-w-[136px] border-border px-1.5 text-[11px]"
              aria-label="Active learning database"
            >
              <SelectValue placeholder="Database" />
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

          <div className="ml-auto flex shrink-0 items-center gap-0.5">
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
              onPick={pickHistoryOrSnippet}
            />

            <SnippetsDialog
              sql={sql}
              open={snippetsOpen}
              onOpenChange={setSnippetsOpen}
              onPick={pickHistoryOrSnippet}
            />

            <ToolIconButton
              label="Open .sql file"
              shortcut="Ctrl+O"
              onClick={() => void openSqlFile()}
            >
              <FolderOpen className="size-3.5" />
            </ToolIconButton>

            <ToolIconButton
              label="Export .sql file"
              shortcut="Ctrl+S"
              disabled={activeFile === null || sql.trim().length === 0}
              onClick={() => void exportSqlFile()}
            >
              <Download className="size-3.5" />
            </ToolIconButton>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeFile === null ? (
          <EmptyEditorState
            onNew={() => newFile()}
            onOpen={() => void openSqlFile()}
          />
        ) : (
          <div className="flex h-full min-h-0">
            <Group
              id="playground-horizontal"
              defaultLayout={{ editor: 72, schema: 28 }}
            >
              <Panel id="editor" defaultSize="72%" minSize="40%">
                <Group id="playground-vertical" orientation="vertical">
                  <Panel id="query" minSize="20%">
                    <div
                      ref={editorZoomRef}
                      className="h-full min-h-0 overflow-hidden bg-editor"
                    >
                      <SqlCodeEditor
                        value={sql}
                        onChange={(value) => setContent(activeFile.id, value)}
                        onRun={() => void run()}
                        dialect={activeDialect}
                        fontSize={editorFontSize}
                        tables={tableMap}
                        placeholder={`Type a ${dialectLabel(activeDialect)} statement…`}
                        minHeight="100%"
                      />
                    </div>
                  </Panel>
                  <Separator className="h-px bg-border transition-colors hover:bg-primary/60" />
                  <Panel
                    id="results"
                    panelRef={resultsPanelRef}
                    defaultSize={
                      resultsCollapsed ? 32 : `${initialResultsOpenPct}%`
                    }
                    minSize={130}
                    maxSize="80%"
                    collapsible
                    collapsedSize={32}
                    onResize={(size: PanelSize) => {
                      const collapsed =
                        resultsPanelRef.current?.isCollapsed() ??
                        size.inPixels <= 40;
                      if (
                        !collapsed &&
                        size.inPixels > 60 &&
                        size.asPercentage >= 20
                      ) {
                        const rounded =
                          Math.round(size.asPercentage * 10) / 10;
                        savedOpenPctRef.current = rounded;
                        if (typeof window !== "undefined") {
                          window.localStorage.setItem(
                            RESULTS_OPEN_HEIGHT_KEY,
                            String(rounded),
                          );
                        }
                      }
                      if (collapsed !== resultsCollapsedRef.current) {
                        resultsCollapsedRef.current = collapsed;
                        setResultsCollapsed(collapsed);
                      }
                    }}
                  >
                    <div
                      ref={resultZoomRef}
                      className="flex h-full min-h-0 flex-col bg-surface"
                    >
                      {results.length > 1 && !resultsCollapsed ? (
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
                          (results.length === 0
                            ? (runError ?? undefined)
                            : undefined)
                        }
                        isLoading={isLoading}
                        fontSize={resultFontSize}
                        collapsed={resultsCollapsed}
                        onToggleCollapse={toggleResultsPanel}
                        onExportCsv={() => void download("csv")}
                        onExportJson={() => void download("json")}
                        onCopy={() => {
                          if (current) {
                            void navigator.clipboard.writeText(
                              exportToCsv(current),
                            );
                          }
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
        )}
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
    </div>
  );
}

function EmptyEditorState({
  onNew,
  onOpen,
}: {
  onNew: () => void;
  onOpen: () => void;
}): React.ReactElement {
  return (
    <div className="flex h-full w-full items-center justify-center bg-editor p-6">
      <div className="flex max-w-sm flex-col items-center gap-4 border border-border bg-surface px-8 py-8 text-center">
        <span className="flex size-10 items-center justify-center border border-border bg-surface-alt text-muted-dim">
          <FileCode2 className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-[14px] font-semibold text-foreground">
            No open SQL file
          </h2>
          <p className="text-[12px] leading-relaxed text-muted-dim">
            Create a new query tab or open an existing .sql script from disk to
            browse schema and execute queries.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onNew} className="h-8 px-3 text-[12px]">
            <Plus data-icon="inline-start" />
            New file
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onOpen}
            className="h-8 border-border px-3 text-[12px]"
          >
            <FolderOpen data-icon="inline-start" />
            Open .sql
          </Button>
        </div>
        <div className="flex items-center gap-3 pt-1 font-mono text-[10px] text-muted-dim">
          <span>Ctrl+N new</span>
          <span>Ctrl+O open</span>
        </div>
      </div>
    </div>
  );
}

function EditorTabStrip({
  files,
  activeId,
  savedNotice,
  onSelect,
  onClose,
  onRename,
}: {
  files: QueryFile[];
  activeId: string | null;
  savedNotice: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, name: string) => void;
}): React.ReactElement {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const commitRename = (id: string): void => {
    const trimmed = draft.trim();
    if (trimmed.length > 0) {
      onRename(id, trimmed);
    }
    setEditingId(null);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>): void => {
    if (!scrollRef.current || Math.abs(event.deltaY) === 0) return;
    scrollRef.current.scrollLeft += event.deltaY;
  };

  return (
    <div className="flex min-w-0 items-center justify-between gap-2 bg-surface-alt/55 px-2">
      {files.length === 0 ? (
        <span className="px-1 text-[11.5px] text-muted-dim">
          No open SQL files
        </span>
      ) : (
        <div
          ref={scrollRef}
          onWheel={handleWheel}
          className="scrollbar-thin flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1"
        >
          {files.map((file) => {
            const active = file.id === activeId;
            const isEditing = editingId === file.id;
            const isDirty =
              file.savedContent !== undefined
                ? file.content !== file.savedContent
                : file.content.length > 0;
            return (
              <div
                key={file.id}
                className={cn(
                  "group relative flex h-7 min-w-[116px] max-w-[196px] shrink-0 items-center border transition-colors",
                  active
                    ? "border-border bg-surface text-foreground shadow-[inset_0_2px_0_0_var(--primary)]"
                    : "border-transparent bg-transparent text-muted-dim hover:border-border/70 hover:bg-surface/60 hover:text-foreground",
                )}
              >
                {isEditing ? (
                  <div className="flex flex-1 items-center gap-1.5 px-2">
                    <FileCode2
                      className={cn(
                        "size-3.5 shrink-0",
                        active ? "text-primary" : "text-muted-dim",
                      )}
                    />
                    <input
                      autoFocus
                      value={draft}
                      aria-label="Rename query file"
                      onChange={(event) => setDraft(event.target.value)}
                      onBlur={() => commitRename(file.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          commitRename(file.id);
                        } else if (event.key === "Escape") {
                          event.preventDefault();
                          setEditingId(null);
                        }
                      }}
                      className="h-5 w-28 min-w-0 flex-1 border border-primary bg-background px-1 font-sans text-[11.5px] text-foreground outline-none"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(file.id)}
                    onDoubleClick={() => {
                      setEditingId(file.id);
                      setDraft(file.name);
                    }}
                    className="flex h-full min-w-0 flex-1 items-center gap-1.5 pl-2.5 pr-1 text-left"
                  >
                    <FileCode2
                      className={cn(
                        "size-3.5 shrink-0 transition-colors",
                        active
                          ? "text-primary"
                          : "text-muted-dim group-hover:text-foreground/80",
                      )}
                    />
                    <span
                      className={cn(
                        "truncate text-[11.5px]",
                        active ? "font-medium text-foreground" : "font-normal",
                      )}
                    >
                      {file.name}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  aria-label={`Close ${file.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose(file.id);
                  }}
                  className="mr-1 flex size-5 shrink-0 items-center justify-center text-muted-dim transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  {isDirty ? (
                    <>
                      <span
                        className="size-1.5 bg-warning group-hover:hidden"
                        aria-label="Unsaved changes"
                      />
                      <X className="hidden size-3 group-hover:block" />
                    </>
                  ) : (
                    <X
                      className={cn(
                        "size-3 transition-opacity",
                        active
                          ? "opacity-65 group-hover:opacity-100"
                          : "opacity-0 group-hover:opacity-100",
                      )}
                    />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {savedNotice !== null ? (
        <span className="shrink-0 border border-success/30 bg-success/10 px-2 py-0.5 font-mono text-[10px] text-success">
          exported {savedNotice}
        </span>
      ) : null}
    </div>
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
          <kbd className="ml-1.5 border border-background/25 px-1 py-px font-mono text-[9px] text-background/85">
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
