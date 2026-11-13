"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Group, Panel, Separator } from "react-resizable-panels";
import type { SqlResult } from "@logixzen/shared/sql-engine";
import { PageShell } from "@/components/app-shell/page-shell";
import { SqlCodeEditor } from "@/components/editor/SqlCodeEditor";
import { SchemaPanel } from "@/components/playground/SchemaPanel";
import { PlaygroundResultPanel } from "@/components/playground/ResultPanel";
import { CopySqlButton, HistoryDialog, RunButton, SnippetsDialog } from "@/components/playground/tool-dialogs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePackStore } from "@/stores/usePackStore";
import { useProgressStore } from "@/stores/useProgressStore";
import { useQueryHistoryStore } from "@/stores/useQueryHistoryStore";
import { useSqlStore } from "@/sql/useSqlStore";
import { exportToCsv, exportToJson } from "@/lib/exportUtils";
import { saveTextFile } from "@/lib/save-file";
import { ErDiagram } from "@/features/schema/er-diagram";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

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
  const params = useSearchParams();
  const databases = usePackStore((state) => state.databases);
  const hydrated = usePackStore((state) => state.hydrated);
  const schema = useSqlStore((state) => state.schema);
  const isLoading = useSqlStore((state) => state.isLoading);
  const activeDatasetId = useSqlStore((state) => state.activeDatasetId);
  const execute = useSqlStore((state) => state.execute);
  const activateDataset = useSqlStore((state) => state.activateDataset);
  const clearError = useSqlStore((state) => state.clearError);
  const addToHistory = useQueryHistoryStore((state) => state.addToHistory);
  const editorFontSize = useProgressStore((state) => state.settings.editorFontSize);

  const [sql, setSql] = useState(() => params.get("sql") ?? "");
  const [results, setResults] = useState<SqlResult[]>([]);
  const [resultIndex, setResultIndex] = useState(0);
  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [diagramOpen, setDiagramOpen] = useState(false);

  useEffect(() => {
    if (activeDatasetId !== null || databases.length === 0) return;
    void activateDataset(databases[0]?.id ?? null);
  }, [activeDatasetId, databases, activateDataset]);

  const run = useCallback(async () => {
    const text = sql.trim();
    if (text.length === 0) return;
    clearError();
    setRunError(null);
    await execute(text);
    const state = useSqlStore.getState();
    setResults(state.lastResult ?? []);
    setResultIndex(0);
    const failedStatement = state.lastResult?.find((result) => result.error !== undefined);
    setRunError(failedStatement?.error ?? state.error ?? null);
    addToHistory(text, failedStatement === undefined);
  }, [sql, execute, clearError, addToHistory]);

  const current = useMemo(() => results[resultIndex] ?? null, [results, resultIndex]);

  const tableMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const table of schema) {
      map[table.name] = table.columns.map((column) => column.name);
    }
    return map;
  }, [schema]);

  const activeDataset = databases.find((item) => item.id === activeDatasetId);

  const download = useCallback(
    async (format: "csv" | "json") => {
      if (!current) return;
      const content = format === "csv" ? exportToCsv(current) : exportToJson(current);
      await saveTextFile(`logixzen-result.${format}`, content, [
        { name: format.toUpperCase(), extensions: [format] },
      ]);
    },
    [current],
  );

  return (
    <PageShell
      title="Editor"
      subtitle={activeDataset ? activeDataset.name : hydrated ? "No database selected" : undefined}
      actions={
        <>
          <Select value={activeDatasetId ?? ""} onValueChange={(value) => void activateDataset(value)}>
            <SelectTrigger size="sm" className="w-52" aria-label="Active database">
              <SelectValue placeholder="Select database" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {databases.length === 0 ? (
                  <div className="px-2 py-1.5 text-[11.5px] text-muted-dim">No databases imported yet</div>
                ) : null}
                {databases.map((dataset) => (
                  <SelectItem key={dataset.id} value={dataset.id}>
                    {dataset.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setDiagramOpen(true)} disabled={schema.length === 0}>
            ER view
          </Button>
          <HistoryDialog onPick={(picked) => setSql(picked)} />
          <SnippetsDialog sql={sql} onPick={(picked) => setSql(picked)} />
          <CopySqlButton sql={sql} />
          <RunButton onClick={() => void run()} isLoading={isLoading} />
        </>
      }
      bodyClassName="overflow-hidden"
    >
      <div className="flex h-full min-h-0">
        <Group id="playground-horizontal" defaultLayout={{ editor: 72, schema: 28 }}>
          <Panel id="editor" defaultSize="72%" minSize="40%">
            <Group id="playground-vertical" orientation="vertical" defaultLayout={{ query: 45, results: 55 }}>
              <Panel id="query" defaultSize="45%" minSize="15%">
                <div className="flex h-full min-h-0 flex-col bg-editor">
                  <div className="flex h-7 shrink-0 items-center justify-between border-b border-border bg-surface px-3">
                    <span className="section-label">query.sql</span>
                    <span className="font-mono text-[9.5px] text-muted-dim">
                      {sql.length} chars · {sql.split("\n").length} lines
                    </span>
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <SqlCodeEditor
                      value={sql}
                      onChange={(value) => setSql(value)}
                      onRun={() => void run()}
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
                <div className="h-full min-h-0 bg-surface">
                  {results.length > 1 ? (
                    <ResultTabs
                      results={results}
                      index={resultIndex}
                      onSelect={setResultIndex}
                      error={runError}
                    />
                  ) : null}
                  <PlaygroundResultPanel
                    result={current}
                    error={runError ?? undefined}
                    isLoading={isLoading}
                    onExportCsv={() => void download("csv")}
                    onExportJson={() => void download("json")}
                    onCopy={() => {
                      if (current) void navigator.clipboard.writeText(exportToCsv(current));
                    }}
                  />
                </div>
              </Panel>
            </Group>
          </Panel>
          <Separator className="w-px bg-border transition-colors hover:bg-primary/60" />
          <Panel id="schema" defaultSize="28%" minSize="14%" collapsible collapsedSize="4%">
            <SchemaPanel tables={schema} activeTable={activeTable} onSelectTable={setActiveTable} />
          </Panel>
        </Group>
      </div>

      <Dialog open={diagramOpen} onOpenChange={setDiagramOpen}>
        <DialogContent className="h-[80vh] max-w-5xl">
          <DialogTitle className="text-[13px]">{activeDataset?.name ?? "Schema"} — ER diagram</DialogTitle>
          <DialogDescription className="sr-only">Entity relationship diagram</DialogDescription>
          <div className="h-[calc(100%-3rem)] min-h-0 border border-border">
            <ErDiagram tables={schema} />
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function ResultTabs({
  results,
  index,
  onSelect,
  error,
}: {
  results: SqlResult[];
  index: number;
  onSelect: (index: number) => void;
  error: string | null;
}): React.ReactElement {
  return (
    <div className="flex h-7 shrink-0 items-stretch overflow-x-auto border-b border-border bg-surface-alt">
      {results.map((result, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          className={cn(
            "flex items-center gap-1.5 border-r border-border px-3 text-[11px] transition-colors",
            i === index ? "bg-surface text-foreground" : "text-muted-dim hover:text-foreground",
          )}
        >
          <span className="font-mono">#{i + 1}</span>
          {result.error !== undefined || (error !== null && i === index) ? (
            <span className="size-1.5 bg-error" />
          ) : result.isSelect ? (
            <span className="numeric text-muted-dim">{result.rows.length}</span>
          ) : (
            <span className="numeric text-muted-dim">{result.rowsAffected}w</span>
          )}
        </button>
      ))}
    </div>
  );
}
