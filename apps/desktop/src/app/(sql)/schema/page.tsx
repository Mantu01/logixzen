"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Group,
  Panel as ResizablePanel,
  Separator,
  usePanelRef,
  type PanelSize,
} from "react-resizable-panels";
import {
  Grid2x2,
  Loader2,
  Network,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import type { Dataset } from "@logixzen/shared/content";
import type { TableInfo } from "@/shared/desktop-api";
import { parseCreateDatabase, splitSqlStatements } from "@/shared/sql";
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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SchemaPanel } from "@/components/playground/SchemaPanel";
import { useEnsureActiveDataset } from "@/hooks/use-ensure-active-dataset";
import { usePackStore } from "@/stores/usePackStore";
import { useSqlStore } from "@/sql/useSqlStore";
import {
  filterDatasetsForEngine,
  isDatasetForEngine,
  slugify,
  tablesFromDataset,
} from "@/lib/dataset-from-sql";
import { dialectLabel } from "@/lib/sql-editor";
import { cn } from "@/lib/utils";

const SqlCodeEditor = dynamic(
  () =>
    import("@/components/editor/SqlCodeEditor").then((m) => m.SqlCodeEditor),
  { ssr: false },
);

const ErDiagram = dynamic(
  () => import("@/features/schema/er-diagram").then((m) => m.ErDiagram),
  { ssr: false },
);

type ViewMode = "diagram" | "tables";

const EMPTY_TABLES: Record<string, string[]> = {};
const SCHEMA_COLLAPSED_KEY = "logixzen.schemaPanel.collapsed";

export default function SchemaPage(): React.ReactElement {
  const databases = usePackStore((state) => state.databases);
  const hydrated = usePackStore((state) => state.hydrated);
  const addDataset = usePackStore((state) => state.addDataset);
  const removeDataset = usePackStore((state) => state.removeDataset);

  const schema = useSqlStore((state) => state.schema);
  const isInitialized = useSqlStore((state) => state.isInitialized);
  const isLoading = useSqlStore((state) => state.isLoading);
  const error = useSqlStore((state) => state.error);
  const activeDatasetId = useSqlStore((state) => state.activeDatasetId);
  const activeOptionId = useSqlStore((state) => state.activeOptionId);
  const activeEngineName = useSqlStore((state) => state.activeEngineName);
  const activeDialect = useSqlStore((state) => state.activeDialect);
  const activateDataset = useSqlStore((state) => state.activateDataset);
  const reseed = useSqlStore((state) => state.reseed);

  const [view, setView] = useState<ViewMode>("diagram");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const schemaPanelRef = usePanelRef();
  const [schemaCollapsed, setSchemaCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(SCHEMA_COLLAPSED_KEY) === "true",
  );
  const collapsedRef = useRef(schemaCollapsed);

  const activeDataset = useMemo(
    () =>
      databases.find(
        (item) =>
          item.id === activeDatasetId &&
          isDatasetForEngine(item, activeOptionId),
      ) ?? null,
    [databases, activeDatasetId, activeOptionId],
  );

  const displayTables = useMemo<TableInfo[]>(() => {
    if (schema.length > 0 && isInitialized) return schema;
    if (activeDataset) return tablesFromDataset(activeDataset);
    return [];
  }, [schema, isInitialized, activeDataset]);

  useEnsureActiveDataset();

  const toggleSchemaPanel = useCallback((): void => {
    const panel = schemaPanelRef.current;
    if (!panel) return;
    if (collapsedRef.current) {
      panel.expand();
    } else {
      panel.collapse();
    }
  }, [schemaPanelRef]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && !event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSchemaPanel();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSchemaPanel]);

  const handleResize = useCallback((size: PanelSize): void => {
    const collapsed = size.inPixels <= 40;
    collapsedRef.current = collapsed;
    setSchemaCollapsed(collapsed);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SCHEMA_COLLAPSED_KEY, String(collapsed));
    }
  }, []);

  return (
    <PageShell
      title="Schema"
      subtitle={
        activeDataset
          ? `${activeDataset.name} · ${dialectLabel(activeDialect)} · ${displayTables.length} tables`
          : isInitialized
            ? `${activeEngineName} · ${displayTables.length} tables`
            : hydrated
              ? `${dialectLabel(activeDialect)} · No database selected`
              : undefined
      }
      actions={
        <>
          <div className="flex border border-border">
            <ViewTab
              active={view === "diagram"}
              onClick={() => setView("diagram")}
              icon={<Network className="size-3.5" />}
              label="ER diagram"
            />
            <ViewTab
              active={view === "tables"}
              onClick={() => setView("tables")}
              icon={<Grid2x2 className="size-3.5" />}
              label="Tables"
            />
          </div>
          {isInitialized && activeDatasetId !== null ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void reseed()}
              disabled={isLoading}
            >
              <RotateCcw data-icon="inline-start" /> Reset data
            </Button>
          ) : null}
          {activeDataset ? (
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove ${activeDataset.name}`}
                      className="text-muted-dim hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Remove {activeDataset.name} from library
                </TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Remove {activeDataset.name}?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    The database and its schema leave your library. Questions
                    that reference it stop working until it is imported again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      removeDataset(activeDataset.id);
                      const remaining = filterDatasetsForEngine(
                        databases.filter((item) => item.id !== activeDataset.id),
                        activeOptionId,
                      );
                      void activateDataset(remaining[0]?.id ?? null);
                    }}
                  >
                    Remove database
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          <NewDatabaseDialog
            onCreate={async (dataset) => {
              addDataset(dataset);
              await activateDataset(dataset.id);
            }}
          />
        </>
      }
      bodyClassName="overflow-hidden"
    >
      <Group orientation="horizontal" className="h-full min-h-0">
        <ResizablePanel minSize={300}>
          <div className="flex h-full min-h-0">
            {error ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6">
                <p className="max-w-md text-center font-mono text-[12px] text-error">
                  {error}
                </p>
                <Button variant="outline" size="sm" onClick={() => void reseed()}>
                  <RotateCcw data-icon="inline-start" /> Rebuild database
                </Button>
              </div>
            ) : displayTables.length === 0 && hydrated ? (
              <EmptyDatabases />
            ) : view === "diagram" ? (
              <div className="min-w-0 flex-1">
                <ErDiagram
                  tables={displayTables}
                  highlightTable={selectedTable}
                  onTableClick={setSelectedTable}
                />
              </div>
            ) : (
              <TableInspector
                tables={displayTables}
                selected={selectedTable}
                search={search}
                onSearch={setSearch}
                onSelect={setSelectedTable}
              />
            )}
          </div>
        </ResizablePanel>

        <Separator className="w-px bg-border transition-colors hover:bg-primary/50" />

        <ResizablePanel
          panelRef={schemaPanelRef}
          defaultSize={schemaCollapsed ? 32 : 264}
          minSize={210}
          maxSize={380}
          collapsible
          collapsedSize={32}
          onResize={handleResize}
        >
          <SchemaPanel
            side="right"
            tables={displayTables}
            activeTable={selectedTable}
            onSelectTable={setSelectedTable}
            collapsed={schemaCollapsed}
            onToggleCollapsed={toggleSchemaPanel}
            databases={databases}
            activeDatasetId={activeDatasetId}
            activeOptionId={activeOptionId}
            onSelectDatabase={(datasetId) => void activateDataset(datasetId)}
          />
        </ResizablePanel>
      </Group>
    </PageShell>
  );
}

function ViewTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-7 items-center gap-1.5 px-2.5 text-[11.5px] transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-dim hover:bg-surface-hover hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyDatabases(): React.ReactElement {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <Network className="size-8 text-muted-dim" />
      <div>
        <p className="text-[13px] font-medium">No tables or database active</p>
        <p className="mx-auto mt-1 max-w-sm text-[11.5px] text-muted-dim">
          Select a database from the Schema sidebar, import a pack from the
          Data Hub, or create one using New database.
        </p>
      </div>
    </div>
  );
}

function TableInspector({
  tables,
  selected,
  search,
  onSearch,
  onSelect,
}: {
  tables: TableInfo[];
  selected: string | null;
  search: string;
  onSearch: (value: string) => void;
  onSelect: (name: string) => void;
}): React.ReactElement {
  const term = search.trim().toLowerCase();
  const visible =
    term === ""
      ? tables
      : tables.filter((table) => table.name.toLowerCase().includes(term));
  const current =
    tables.find((table) => table.name === selected) ?? visible[0] ?? null;

  if (!current) {
    return (
      <div className="flex min-w-0 flex-1 items-center justify-center text-[12px] text-muted-dim">
        No tables match
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
        <Search className="size-3 text-muted-dim" />
        <Input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Filter tables"
          aria-label="Filter tables"
          className="h-6 w-48 bg-transparent px-1 text-[11.5px]"
        />
        <div className="ml-auto flex items-center gap-1">
          {visible.slice(0, 12).map((table) => (
            <button
              key={table.name}
              type="button"
              onClick={() => onSelect(table.name)}
              className={cn(
                "h-6 border px-2 font-mono text-[10.5px] transition-colors",
                table.name === current.name
                  ? "border-primary/50 bg-primary/10 text-foreground"
                  : "border-border text-muted-dim hover:text-foreground",
              )}
            >
              {table.name}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          <div>
            <h2 className="font-mono text-[15px] font-semibold">
              {current.name}
            </h2>
            {current.primaryKey && current.primaryKey.length > 0 ? (
              <p className="mt-0.5 font-mono text-[11px] text-muted-dim">
                primary key: {current.primaryKey.join(", ")}
              </p>
            ) : null}
          </div>

          <section>
            <div className="section-label mb-1.5">Columns</div>
            <div className="border border-border">
              {current.columns.map((column, index) => {
                const fk = current.foreignKeys.find(
                  (relation) => relation.from === column.name,
                );
                return (
                  <div
                    key={column.name}
                    className={cn(
                      "flex h-8 items-center gap-3 px-3 font-mono text-[11.5px]",
                      index % 2 === 1 && "bg-surface-alt/60",
                    )}
                  >
                    <span className="w-44 truncate font-medium">
                      {column.name}
                    </span>
                    <span className="text-muted-dim">{column.type}</span>
                    <span className="text-[9.5px] uppercase text-muted-dim">
                      {column.primaryKey ? "PK" : ""}{" "}
                      {column.notNull ? "NOT NULL" : ""}
                    </span>
                    {fk ? (
                      <span className="ml-auto text-[10.5px] text-primary">
                        → {fk.table}.{fk.to}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {current.sampleRows.length > 0 ? (
            <section>
              <div className="section-label mb-1.5">Sample rows</div>
              <div className="overflow-x-auto border border-border">
                <table className="w-full font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-border bg-surface-alt">
                      {current.columns.map((column) => (
                        <th
                          key={column.name}
                          className="px-2.5 py-1.5 text-left font-medium text-muted-dim"
                        >
                          {column.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {current.sampleRows.map((row, index) => (
                      <tr
                        key={index}
                        className="border-b border-border/60 last:border-0"
                      >
                        {current.columns.map((column) => (
                          <td key={column.name} className="px-2.5 py-1.5">
                            {row[column.name] === null ? (
                              <span className="text-muted-dim">NULL</span>
                            ) : (
                              String(row[column.name] ?? "")
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function NewDatabaseDialog({
  onCreate,
}: {
  onCreate: (dataset: Dataset) => Promise<void>;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [sql, setSql] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialect = useSqlStore((state) => state.activeDialect);
  const activeOptionId = useSqlStore((state) => state.activeOptionId);
  const activeEngineName = useSqlStore((state) => state.activeEngineName);

  const derivedName = useMemo(() => {
    for (const statement of splitSqlStatements(sql)) {
      const target = parseCreateDatabase(statement.sql);
      if (target !== null) return target.name;
    }
    return null;
  }, [sql]);

  const create = async (): Promise<void> => {
    const bridge = window.logixzen?.database;
    if (bridge === undefined) {
      setError("Desktop bridge unavailable. Run the Electron app.");
      return;
    }
    if (derivedName === null) {
      setError("Start the script with CREATE DATABASE <name>.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const results = await bridge.execute(sql);
      const failed = results.find((result) => result.error !== undefined);
      if (failed !== undefined)
        throw new Error(failed.error ?? "The script failed.");
      const schemaPart = splitSqlStatements(sql)
        .filter((statement) => {
          const upper = statement.sql.toUpperCase();
          return (
            !upper.startsWith("CREATE DATABASE") && !upper.startsWith("USE ")
          );
        })
        .map((statement) => statement.sql)
        .join(";\n");
      const dataset: Dataset = {
        id: `${activeOptionId}-${slugify(derivedName)}`,
        name: derivedName,
        description: `Created on ${activeEngineName}.`,
        setupSql: schemaPart,
        tables: [],
        engineId: activeOptionId,
        dialect,
      };
      await onCreate(dataset);
      setOpen(false);
      setSql("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus data-icon="inline-start" /> New database
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[86vh] max-w-2xl flex-col gap-0 p-0"
        showCloseButton={false}
      >
        <div className="shrink-0 border-b border-border bg-surface-alt px-4 py-3">
          <DialogTitle className="text-[13px]">
            New database ({activeEngineName})
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-[11px]">
            Start with CREATE DATABASE, then USE, then your schema statements.
            This database stays isolated to {activeEngineName}.
          </DialogDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between gap-3 pb-2 text-[11px]">
            <span className="text-muted-dim">
              Selected with{" "}
              <code className="font-mono">USE {derivedName ?? "<name>"}</code>
            </span>
            <span
              className={cn(
                "font-mono",
                derivedName === null ? "text-muted-dim" : "text-success",
              )}
            >
              {derivedName === null
                ? "no CREATE DATABASE yet"
                : `database: ${derivedName}`}
            </span>
          </div>
          <div className="min-h-0">
            <SqlCodeEditor
              value={sql}
              onChange={setSql}
              dialect={dialect}
              fontSize={12}
              tables={EMPTY_TABLES}
              placeholder={
                dialect === "tsql"
                  ? "CREATE DATABASE crm;\nGO\nUSE crm;\nCREATE TABLE customers (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(100) NOT NULL);"
                  : dialect === "postgres"
                    ? "CREATE DATABASE crm;\nUSE crm;\nCREATE TABLE customers (id SERIAL PRIMARY KEY, name TEXT NOT NULL);"
                    : dialect === "mysql"
                      ? "CREATE DATABASE crm;\nUSE crm;\nCREATE TABLE customers (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL);"
                      : "CREATE DATABASE crm;\nUSE crm;\nCREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL);"
              }
              minHeight="260px"
            />
          </div>
          {error ? (
            <p className="mt-3 border border-error/40 bg-error/5 px-2.5 py-1.5 font-mono text-[11px] text-error">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-2.5">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={busy || derivedName === null}
            onClick={() => void create()}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Plus className="size-3.5" />
            )}
            Create database
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
