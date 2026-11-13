"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Eraser,
  FileText,
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
import type { TableInfo } from "@logixzen/shared/sql-engine";
import { PageShell } from "@/components/app-shell/page-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SchemaPanel } from "@/components/playground/SchemaPanel";
import { ErDiagram } from "@/features/schema/er-diagram";
import { usePackStore } from "@/stores/usePackStore";
import { useSqlStore } from "@/sql/useSqlStore";
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
  const activateDataset = useSqlStore((state) => state.activateDataset);
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
    if (activeDatasetId !== null || databases.length === 0) return;
    void activateDataset(databases[0]?.id ?? null);
  }, [activeDatasetId, databases, activateDataset]);

  return (
    <PageShell
      title="Databases"
      subtitle={activeDataset ? `${activeDataset.name} · ${displayTables.length} tables` : hydrated ? "No database selected" : undefined}
      actions={
        <>
          <div className="flex border border-border">
            <ViewTab active={view === "diagram"} onClick={() => setView("diagram")} icon={<Network className="size-3.5" />} label="ER diagram" />
            <ViewTab active={view === "tables"} onClick={() => setView("tables")} icon={<Grid2x2 className="size-3.5" />} label="Tables" />
          </div>
          {isInitialized && activeDatasetId !== null ? (
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => void reseed()} disabled={isLoading}>
              <RotateCcw className="size-3.5" /> Reset data
            </Button>
          ) : null}
          <AddDatabaseDialog onCreate={(dataset) => addDataset(dataset)} />
        </>
      }
      toolbar={
        <>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
            {databases.length === 0 ? (
              <span className="text-[11.5px] text-muted-dim">No databases yet — import a pack or create one</span>
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
                  <span className="size-1.5 shrink-0 bg-success" aria-label="active" />
                ) : null}
              </button>
            ))}
          </div>
          {activeDataset && activeDatasetId ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Remove database"
              className="text-muted-dim hover:text-destructive"
              onClick={() => {
                removeDataset(activeDataset.id);
                const remaining = databases.filter((item) => item.id !== activeDataset.id);
                void activateDataset(remaining[0]?.id ?? null);
              }}
            >
              <Trash2 className="size-3" />
            </Button>
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
            <p className="max-w-md text-center font-mono text-[12px] text-error">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void reseed()}>
              <RotateCcw className="size-3.5" /> Rebuild database
            </Button>
          </div>
        ) : displayTables.length === 0 && hydrated ? (
          <EmptyDatabases />
        ) : view === "diagram" ? (
          <div className="min-w-0 flex-1">
            <ErDiagram tables={displayTables} />
          </div>
        ) : (
          <TableInspector tables={displayTables} selected={selectedTable} search={search} onSearch={setSearch} onSelect={setSelectedTable} />
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
        active ? "bg-accent text-accent-foreground" : "text-muted-dim hover:bg-surface-hover hover:text-foreground",
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
          Import the databases pack from the Data Hub, upload a .sql or .sqlite file, or create a schema by hand.
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
  const visible = term === "" ? tables : tables.filter((table) => table.name.toLowerCase().includes(term));
  const current = tables.find((table) => table.name === selected) ?? visible[0] ?? null;

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
            <h2 className="font-mono text-[15px] font-semibold">{current.name}</h2>
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
                const fk = current.foreignKeys.find((relation) => relation.from === column.name);
                return (
                  <div
                    key={column.name}
                    className={cn(
                      "flex h-8 items-center gap-3 px-3 font-mono text-[11.5px]",
                      index % 2 === 1 && "bg-surface-alt/60",
                    )}
                  >
                    <span className="w-44 truncate font-medium">{column.name}</span>
                    <span className="text-muted-dim">{column.type}</span>
                    <span className="text-[9.5px] uppercase text-muted-dim">
                      {column.primaryKey ? "PK" : ""} {column.notNull ? "NOT NULL" : ""}
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
                        <th key={column.name} className="px-2.5 py-1.5 text-left font-medium text-muted-dim">
                          {column.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {current.sampleRows.map((row, index) => (
                      <tr key={index} className="border-b border-border/60 last:border-0">
                        {current.columns.map((column) => (
                          <td key={column.name} className="max-w-56 truncate px-2.5 py-1.5">
                            {row[column.name] === null || row[column.name] === undefined ? (
                              <span className="italic text-muted-dim">null</span>
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

function AddDatabaseDialog({ onCreate }: { onCreate: (dataset: Dataset) => void }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"sql" | "file">("sql");
  const [name, setName] = useState("");
  const [sqlText, setSqlText] = useState("");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const id = slugify(name || "my-database");
      let setupSql = sqlText;
      if (mode === "file" && filePath !== null) {
        const content = await window.logixzen?.files.readText(filePath);
        if (typeof content !== "string") throw new Error("File could not be read");
        setupSql = content;
      }
      const bridge = window.logixzen?.database;
      if (bridge === undefined) throw new Error("Desktop bridge unavailable");
      await bridge.initialize(setupSql);
      const tables = await bridge.getSchema();
      const dataset: Dataset = {
        id,
        name: name.trim() || id,
        description: "User-created database.",
        setupSql,
        tables: tables.map((table) => ({
          name: table.name,
          description: undefined,
          columns: table.columns.map((column) => {
            const fk = table.foreignKeys.find((relation) => relation.from === column.name);
            return {
              name: column.name,
              type: column.type,
              primaryKey: column.primaryKey,
              foreignKey: fk ? { table: fk.table, column: fk.to } : undefined,
              description: undefined,
            };
          }),
        })),
      };
      await onCreate(dataset);
      setOpen(false);
      setName("");
      setSqlText("");
      setFilePath(null);
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
      <DialogContent className="max-w-xl">
        <DialogTitle>New database</DialogTitle>
        <DialogDescription>
          Define a schema with SQL, or load a .sql file. The database is validated by running it on the local engine.
        </DialogDescription>
        <div className="space-y-3">
          <div className="flex gap-1">
            {(
              [
                { key: "sql", label: "Write SQL", icon: <FileText className="size-3" /> },
                { key: "file", label: "Load .sql file", icon: <Download className="size-3" /> },
              ] as const
            ).map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setMode(entry.key)}
                className={cn(
                  "flex h-7 items-center gap-1.5 border px-2.5 text-[11.5px] transition-colors",
                  mode === entry.key ? "border-primary/50 bg-primary/10" : "border-border text-muted-dim hover:text-foreground",
                )}
              >
                {entry.icon} {entry.label}
              </button>
            ))}
          </div>
          <div>
            <Label htmlFor="db-name" className="text-[11.5px]">Name</Label>
            <Input
              id="db-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="crm"
              className="mt-1 h-8"
            />
          </div>
          {mode === "sql" ? (
            <Textarea
              value={sqlText}
              onChange={(event) => setSqlText(event.target.value)}
              placeholder={"CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL);\nINSERT INTO users VALUES (1, 'Ada');"}
              className="min-h-48 resize-none font-mono text-[11.5px]"
            />
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const path = await window.logixzen?.dialog.openFile({
                    title: "Open SQL file",
                    filters: [{ name: "SQL", extensions: ["sql", "txt"] }],
                  });
                  setFilePath(path ?? null);
                }}
              >
                <FileText className="size-3.5" /> Choose file
              </Button>
              <span className="truncate text-[11px] text-muted-dim">{filePath ?? "No file selected"}</span>
            </div>
          )}
          {error ? <p className="font-mono text-[11px] text-error">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
            <Eraser className="size-3.5" /> Cancel
          </Button>
          <Button size="sm" disabled={busy || name.trim().length === 0} onClick={() => void create()}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Validate & create
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function tablesFromDataset(dataset: Dataset): TableInfo[] {
  return dataset.tables.map((table) => ({
    name: table.name,
    columns: table.columns.map((column, index) => ({
      cid: index,
      name: column.name,
      type: column.type,
      notNull: Boolean(column.primaryKey),
      defaultValue: null,
      primaryKey: Boolean(column.primaryKey),
    })),
    sampleRows: [],
    primaryKey: table.columns.filter((column) => column.primaryKey).map((column) => column.name),
    foreignKeys: table.columns
      .filter((column) => column.foreignKey !== undefined)
      .map((column) => ({ from: column.name, table: column.foreignKey!.table, to: column.foreignKey!.column })),
  }));
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "db";
}
