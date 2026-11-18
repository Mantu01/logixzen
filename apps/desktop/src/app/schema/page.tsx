"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Grid2x2,
  Network,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Table2,
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
import { SchemaPanel } from "@/components/playground/SchemaPanel";
import { SqlCodeEditor } from "@/components/editor/SqlCodeEditor";
import { ErDiagram } from "@/features/schema/er-diagram";
import { usePackStore } from "@/stores/usePackStore";
import { useSqlStore } from "@/sql/useSqlStore";
import { tablesFromDataset } from "@/lib/dataset-from-sql";
import { activeSubject } from "@/lib/subjects";
import { cn } from "@/lib/utils";

type ViewMode = "diagram" | "tables";

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
  const activeEngineName = useSqlStore((state) => state.activeEngineName);
  const activateDataset = useSqlStore((state) => state.activateDataset);
  const autoConnect = useSqlStore((state) => state.autoConnect);
  const reseed = useSqlStore((state) => state.reseed);

  const [view, setView] = useState<ViewMode>("diagram");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const activeDataset = useMemo(
    () => databases.find((item) => item.id === activeDatasetId) ?? null,
    [databases, activeDatasetId],
  );

  const displayTables = useMemo<TableInfo[]>(() => {
    if (schema.length > 0 && isInitialized) return schema;
    if (activeDataset) return tablesFromDataset(activeDataset);
    return [];
  }, [schema, isInitialized, activeDataset]);
  useEffect(() => {
    void autoConnect();
  }, [autoConnect]);

  useEffect(() => {
    if (activeDatasetId !== null || databases.length === 0) return;
    void activateDataset(databases[0]?.id ?? null);
  }, [activeDatasetId, databases, activateDataset]);

  return (
    <PageShell
      title={activeSubject.dataLabel}
      subtitle={
        activeDataset
          ? `${activeDataset.name} · ${displayTables.length} tables`
          : isInitialized
            ? `${activeEngineName} · ${displayTables.length} tables`
            : hydrated
              ? "No database selected"
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
              className="gap-1.5"
              onClick={() => void reseed()}
              disabled={isLoading}
            >
              <RotateCcw className="size-3.5" /> Reset data
            </Button>
          ) : null}
          <NewDatabaseDialog
            onCreate={async (dataset) => {
              addDataset(dataset);
              await activateDataset(dataset.id);
            }}
          />
        </>
      }
      toolbar={
        <>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
            {databases.length === 0 ? (
              <span className="text-[11.5px] text-muted-dim">
                No databases yet — import a pack or create one
              </span>
            ) : null}
            {databases.map((dataset) => (
              <button
                key={dataset.id}
                type="button"
                onClick={() => void activateDataset(dataset.id)}
                className={cn(
                  "flex h-6 shrink-0 items-center gap-1.5 border px-2 text-[11.5px] transition-colors",
                  dataset.id === activeDatasetId
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border text-muted hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <Table2 className="size-3 shrink-0 text-primary" />
                <span className="max-w-40 truncate">{dataset.name}</span>
                {dataset.id === activeDatasetId && isInitialized ? (
                  <span
                    className="size-1.5 shrink-0 bg-success"
                    aria-label="active"
                  />
                ) : null}
              </button>
            ))}
          </div>
          {activeDataset && activeDatasetId ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Remove database"
                  className="text-muted-dim hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                </Button>
              </AlertDialogTrigger>
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
                      const remaining = databases.filter(
                        (item) => item.id !== activeDataset.id,
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
        </>
      }
      bodyClassName="overflow-hidden"
    >
      <div className="flex h-full min-h-0">
        <div className="w-56 shrink-0 border-r border-border">
          <SchemaPanel
            tables={displayTables}
            activeTable={selectedTable}
            onSelectTable={setSelectedTable}
          />
        </div>

        {error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6">
            <p className="max-w-md text-center font-mono text-[12px] text-error">
              {error}
            </p>
            <Button variant="outline" size="sm" onClick={() => void reseed()}>
              <RotateCcw className="size-3.5" /> Rebuild database
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
        <p className="text-[13px] font-medium">No databases yet</p>
        <p className="mx-auto mt-1 max-w-sm text-[11.5px] text-muted-dim">
          Import a dataset from the Data Hub, or create one from a query with
          CREATE DATABASE.
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
        <div className="mx-auto max-w-3xl space-y-5">
          <div>
            <h2 className="font-mono text-[15px] font-semibold">
              {current.name}
            </h2>
            {current.primaryKey ? (
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
                          <td
                            key={column.name}
                            className="max-w-56 truncate px-2.5 py-1.5"
                          >
                            {row[column.name] === null ||
                            row[column.name] === undefined ? (
                              <span className="italic text-muted-dim">
                                null
                              </span>
                            ) : (
                              String(row[column.name])
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
        id:
          derivedName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "") || "db",
        name: derivedName,
        description: "Created from a query.",
        setupSql: schemaPart,
        tables: [],
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
        <Button size="sm" className="gap-1.5">
          <Plus className="size-3.5" /> New database
        </Button>
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[86vh] max-w-2xl flex-col gap-0 p-0"
        showCloseButton={false}
      >
        <div className="shrink-0 border-b border-border bg-surface-alt px-4 py-3">
          <DialogTitle className="text-[13px]">New database</DialogTitle>
          <DialogDescription className="mt-0.5 text-[11px]">
            Write the script exactly like SQL Server: CREATE DATABASE, then USE,
            then your schema. The database starts empty — tables are created by
            the queries themselves.
          </DialogDescription>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between gap-3 pb-2 text-[11px]">
            <span className="text-muted-dim">
              Selected with{" "}
              <code className="font-mono">USE {derivedName ?? "<name>"}</code>{" "}
              everywhere
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
              dialect={useSqlStore.getState().activeDialect}
              fontSize={12}
              tables={{}}
              placeholder={
                "CREATE DATABASE crm;\nGO\nUSE crm;\nCREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL);"
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
