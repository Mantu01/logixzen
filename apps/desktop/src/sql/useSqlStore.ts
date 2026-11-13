import { create } from "zustand";
import type { SqlResult, TableInfo } from "@logixzen/shared/sql-engine";
import type { Dataset } from "@logixzen/shared/content";
import { usePackStore } from "@/stores/usePackStore";

interface SqlStoreState {
  isInitialized: boolean;
  isLoading: boolean;
  lastResult: SqlResult[] | null;
  schema: TableInfo[];
  error: string | null;
  activeDatasetId: string | null;
}

interface SqlStoreActions {
  activateDataset: (datasetId: string | null) => Promise<void>;
  getActiveDataset: () => Dataset | null;
  execute: (sql: string) => Promise<void>;
  refreshSchema: () => Promise<void>;
  reseed: () => Promise<void>;
  clearError: () => void;
  clearResult: () => void;
}

const BRIDGE_ERROR = "Desktop bridge unavailable. Run the Electron app.";

function deriveDatasetFromSchema(tables: TableInfo[], id: string, name: string): Dataset {
  return {
    id,
    name,
    description: "Created from an imported database file.",
    setupSql: "",
    tables: tables.map((table) => ({
      name: table.name,
      description: undefined,
      columns: table.columns.map((column) => {
        const key = table.foreignKeys.find((relation) => relation.from === column.name);
        return {
          name: column.name,
          type: column.type,
          primaryKey: column.primaryKey,
          foreignKey: key ? { table: key.table, column: key.to } : undefined,
          description: undefined,
        };
      }),
    })),
  };
}

export const useSqlStore = create<SqlStoreState & SqlStoreActions>()((set, get) => ({
  isInitialized: false,
  isLoading: false,
  lastResult: null,
  schema: [],
  error: null,
  activeDatasetId: null,

  activateDataset: async (datasetId) => {
    const bridge = window.logixzen?.database;
    if (bridge === undefined) {
      set({ error: BRIDGE_ERROR, isInitialized: false });
      return;
    }
    set({ isLoading: true, error: null, lastResult: null, activeDatasetId: datasetId });
    const dataset = get().getActiveDataset();
    try {
      if (dataset && dataset.setupSql.trim().length > 0) {
        await bridge.initialize(dataset.setupSql);
      } else {
        await bridge.initialize();
      }
      set({ isInitialized: true, isLoading: false });
      await get().refreshSchema();
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
        isInitialized: false,
      });
    }
  },

  getActiveDataset: () => {
    const { activeDatasetId } = get();
    const databases = usePackStore.getState().databases;
    return databases.find((item) => item.id === activeDatasetId) ?? null;
  },

  execute: async (sql) => {
    const bridge = window.logixzen?.database;
    if (bridge === undefined) {
      set({ error: BRIDGE_ERROR });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const results = await bridge.execute(sql);
      const failed = results.find((result) => result.error !== undefined);
      set({ lastResult: results, isLoading: false, error: failed?.error ?? null });
      await get().refreshSchema();
    } catch (error: unknown) {
      set({
        error: error instanceof Error ? error.message : String(error),
        isLoading: false,
        lastResult: null,
      });
    }
  },

  refreshSchema: async () => {
    const bridge = window.logixzen?.database;
    if (bridge === undefined) return;
    try {
      const tables = await bridge.getSchema();
      set({ schema: tables, isInitialized: true });
      const { activeDatasetId } = get();
      if (activeDatasetId !== null) {
        syncDatasetTables(activeDatasetId, tables);
      }
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : String(error) });
    }
  },

  reseed: () => {
    const dataset = get().getActiveDataset();
    return get().activateDataset(dataset?.id ?? null);
  },

  clearError: () => set({ error: null }),
  clearResult: () => set({ lastResult: null }),
}));

function syncDatasetTables(datasetId: string, tables: TableInfo[]): void {
  const pack = usePackStore.getState();
  const dataset = pack.databases.find((item) => item.id === datasetId);
  if (!dataset) return;
  const derived = deriveDatasetFromSchema(tables, dataset.id, dataset.name);
  if (dataset.setupSql.trim().length === 0 || dataset.tables.length === 0) {
    pack.addDataset({ ...derived, setupSql: dataset.setupSql, description: dataset.description });
  }
}
