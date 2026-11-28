import { create } from "zustand";
import type { SqlResult, TableInfo } from "@/shared/desktop-api";
import type { Dataset } from "@logixzen/shared/content";
import type { EngineDialect, EngineOptionId } from "@/shared/engines";
import { ENGINE_CATALOG } from "@/shared/engine-catalog";
import {
  parseCreateDatabase,
  parseDropDatabase,
  parseUseStatement,
  splitBatches,
  splitSqlStatements,
} from "@/shared/sql";
import { usePackStore } from "@/stores/usePackStore";
import {
  adaptSchemaSqlToDialect,
  looksLikeSqliteSchema,
} from "@/shared/dialect-sql";
import {
  isDatasetForEngine,
  slugify,
  tablesToDatasetTables,
} from "@/lib/dataset-from-sql";

type ConnectionState = "connecting" | "ready" | "failed" | "needs-repair";

interface SqlStoreState {
  isInitialized: boolean;
  isLoading: boolean;
  lastResult: SqlResult[] | null;
  resultVersion: number;
  schema: TableInfo[];
  error: string | null;
  activeDatasetId: string | null;
  activeOptionId: EngineOptionId;
  activeEngineName: string;
  activeDialect: EngineDialect;
  connectionStatus: ConnectionState;
  engineInstalled: boolean;
}

interface SqlStoreActions {
  autoConnect: () => Promise<void>;
  activateDataset: (
    datasetId: string | null,
    options?: { reset?: boolean },
  ) => Promise<void>;
  getActiveDataset: () => Dataset | null;
  execute: (sql: string) => Promise<void>;
  refreshSchema: () => Promise<void>;
  reseed: () => Promise<void>;
  clearError: () => void;
}

const BRIDGE_ERROR = "Desktop bridge unavailable. Run the Electron app.";
const SYSTEM_DATABASES = new Set(["postgres", "master", "tempdb", "model", "msdb"]);

export const useSqlStore = create<SqlStoreState & SqlStoreActions>()(
  (set, get) => ({
    isInitialized: false,
    isLoading: false,
    lastResult: null,
    resultVersion: 0,
    schema: [],
    error: null,
    activeDatasetId: null,
    activeOptionId: "sqlite",
    activeEngineName: "No engine",
    activeDialect: "sqlite",
    connectionStatus: "connecting",
    engineInstalled: false,

    autoConnect: async () => {
      const bridge = window.logixzen?.database;
      const setupBridge = window.logixzen?.setup;
      if (!bridge) {
        set({
          connectionStatus: "failed",
          error: BRIDGE_ERROR,
          isInitialized: false,
        });
        return;
      }

      set({ connectionStatus: "connecting", error: null });

      let optionId: EngineOptionId | null = null;
      if (setupBridge?.getActiveEngine) {
        try {
          const activeRes = await setupBridge.getActiveEngine();
          if (activeRes.ok && activeRes.data) {
            optionId = activeRes.data;
          }
        } catch {
          optionId = null;
        }
      }

      if (!optionId) {
        set({
          activeOptionId: "sqlite",
          activeEngineName: "No engine",
          activeDialect: "sqlite",
          connectionStatus: "failed",
          engineInstalled: false,
          isInitialized: false,
          activeDatasetId: null,
          schema: [],
          error:
            "No database engine is currently installed. Visit Setup to install an engine.",
        });
        return;
      }

      const entry = ENGINE_CATALOG.find((c) => c.id === optionId);
      const engineName = entry?.displayName ?? optionId;
      const dialect = entry?.dialect ?? "sqlite";

      const prevDatasetId = get().activeDatasetId;
      const prevDataset = prevDatasetId
        ? usePackStore.getState().databases.find((d) => d.id === prevDatasetId)
        : undefined;
      const nextDatasetId =
        prevDataset && isDatasetForEngine(prevDataset, optionId)
          ? prevDataset.id
          : null;

      set({
        activeOptionId: optionId,
        activeEngineName: engineName,
        activeDialect: dialect,
        engineInstalled: true,
        activeDatasetId: nextDatasetId,
      });

      try {
        const tables = await bridge.getSchema();
        const activeName = await bridge.active();
        set({
          schema: tables,
          isInitialized: true,
          connectionStatus: "ready",
          error: null,
        });
        await reconcileDatabases();
        syncActiveDataset(activeName, optionId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        set({
          connectionStatus: "failed",
          isInitialized: false,
          error: `Could not connect to ${engineName}: ${msg}`,
        });
      }
    },

    activateDataset: async (datasetId, options) => {
      const bridge = window.logixzen?.database;
      if (bridge === undefined) {
        set({ error: BRIDGE_ERROR, isInitialized: false });
        return;
      }
      const dataset =
        usePackStore
          .getState()
          .databases.find((item) => item.id === datasetId) ?? null;
      const activeOptionId = get().activeOptionId;
      if (dataset && !isDatasetForEngine(dataset, activeOptionId)) {
        set({
          error: `Database "${dataset.name}" belongs to ${dataset.engineId}. Switch engine before activating it.`,
        });
        return;
      }
      set({
        isLoading: true,
        error: null,
        lastResult: null,
        activeDatasetId: datasetId,
      });
      try {
        const activeDialect = get().activeDialect;
        const initSql =
          dataset?.setupSql &&
          activeDialect !== (dataset.dialect ?? "sqlite") &&
          ((dataset.dialect ?? "sqlite") === "sqlite" ||
            looksLikeSqliteSchema(dataset.setupSql))
            ? adaptSchemaSqlToDialect(dataset.setupSql, activeDialect)
            : dataset?.setupSql;
        await bridge.initialize(
          initSql,
          dataset?.name,
          options?.reset === true,
        );
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
      const { activeDatasetId, activeOptionId } = get();
      const databases = usePackStore.getState().databases;
      const dataset = databases.find((item) => item.id === activeDatasetId);
      if (!dataset || !isDatasetForEngine(dataset, activeOptionId)) {
        return null;
      }
      return dataset;
    },

    execute: async (sql) => {
      const prepared = await prepareDatabases(sql);
      if (!prepared) return;
      const outcome = await runSql(sql);
      if (outcome === null) return;
      await reconcileDatabases();
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
      if (dataset === null) return Promise.resolve();
      return get().activateDataset(dataset.id, { reset: true });
    },

    clearError: () => set({ error: null }),
  }),
);

async function runSql(sql: string): Promise<{ results: SqlResult[] } | null> {
  const bridge = window.logixzen?.database;
  if (bridge === undefined) {
    useSqlStore.setState({ error: BRIDGE_ERROR });
    return null;
  }
  useSqlStore.setState({ isLoading: true, error: null });
  try {
    const results = await bridge.execute(sql);
    const failed = results.find((result) => result.error !== undefined);
    useSqlStore.setState({
      lastResult: results,
      resultVersion: useSqlStore.getState().resultVersion + 1,
      isLoading: false,
      error: failed?.error ?? null,
    });
    const active = await bridge.active();
    syncActiveDataset(active, useSqlStore.getState().activeOptionId);
    return { results };
  } catch (error: unknown) {
    useSqlStore.setState({
      error: error instanceof Error ? error.message : String(error),
      isLoading: false,
      lastResult: null,
      resultVersion: useSqlStore.getState().resultVersion + 1,
    });
    return null;
  }
}

function collectDatabaseTargets(sql: string): string[] {
  const names: string[] = [];
  for (const batch of splitBatches(sql)) {
    for (const statement of splitSqlStatements(batch.join("\n"))) {
      const use = parseUseStatement(statement.sql);
      if (use !== null) {
        names.push(use);
        continue;
      }
      const created = parseCreateDatabase(statement.sql);
      if (created !== null) {
        names.push(created.name);
        continue;
      }
      const dropped = parseDropDatabase(statement.sql);
      if (dropped !== null) names.push(dropped.name);
    }
  }
  return names;
}

async function prepareDatabases(sql: string): Promise<boolean> {
  const bridge = window.logixzen?.database;
  if (bridge === undefined) {
    useSqlStore.setState({ error: BRIDGE_ERROR });
    return false;
  }
  const activeOptionId = useSqlStore.getState().activeOptionId;
  const targets = collectDatabaseTargets(sql);
  if (targets.length === 0) return true;

  const loaded = new Set(
    (await bridge.list()).map((name) => name.toLowerCase()),
  );
  const active = await bridge.active();
  const store = usePackStore.getState();
  let loadedAny = false;

  for (const name of targets) {
    const key = name.toLowerCase();
    if (loaded.has(key)) continue;
    const dataset = store.databases.find(
      (item) =>
        isDatasetForEngine(item, activeOptionId) &&
        item.name.toLowerCase() === key &&
        item.setupSql.trim().length > 0,
    );
    if (dataset === undefined) continue;
    const activeDialect = useSqlStore.getState().activeDialect;
    const initSql =
      activeDialect !== (dataset.dialect ?? "sqlite") &&
      ((dataset.dialect ?? "sqlite") === "sqlite" ||
        looksLikeSqliteSchema(dataset.setupSql))
        ? adaptSchemaSqlToDialect(dataset.setupSql, activeDialect)
        : dataset.setupSql;
    await bridge.initialize(initSql, dataset.name);
    loaded.add(key);
    loadedAny = true;
  }

  if (loadedAny && active !== null) {
    try {
      await bridge.use(active);
    } catch {
      const dataset = usePackStore
        .getState()
        .databases.find(
          (item) =>
            isDatasetForEngine(item, activeOptionId) &&
            item.name.toLowerCase() === active.toLowerCase(),
        );
      if (dataset !== undefined) {
        useSqlStore.setState({ activeDatasetId: dataset.id });
      }
    }
  }
  return true;
}

async function reconcileDatabases(): Promise<void> {
  const bridge = window.logixzen?.database;
  if (bridge === undefined) return;
  const { activeOptionId, activeEngineName, activeDialect } =
    useSqlStore.getState();
  const loadedNames = await bridge.list();
  const loaded = new Set(loadedNames.map((name) => name.toLowerCase()));
  const store = usePackStore.getState();

  for (const rawName of loadedNames) {
    const lower = rawName.toLowerCase();
    if (SYSTEM_DATABASES.has(lower)) continue;
    const existsForEngine = store.databases.some(
      (item) =>
        item.name.toLowerCase() === lower &&
        (item.engineId === activeOptionId || !item.engineId),
    );
    if (existsForEngine) continue;
    const label = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    store.addDataset({
      id: `${activeOptionId}-${slugify(rawName)}`,
      name: label,
      description: `Database on ${activeEngineName}.`,
      setupSql: "",
      tables: [],
      engineId: activeOptionId,
      dialect: activeDialect,
    });
  }

  for (const dataset of store.databases) {
    if (dataset.engineId !== activeOptionId) continue;
    if (dataset.setupSql.trim().length > 0) continue;
    if (!loaded.has(dataset.name.toLowerCase())) {
      store.removeDataset(dataset.id);
    }
  }

  const activeName = await bridge.active();
  syncActiveDataset(activeName, activeOptionId);
  await useSqlStore.getState().refreshSchema();
}

function syncActiveDataset(
  activeName: string | null,
  activeOptionId: EngineOptionId,
): void {
  if (activeName === null) return;
  const databases = usePackStore.getState().databases;
  const dataset =
    databases.find(
      (item) =>
        item.engineId === activeOptionId &&
        item.name.toLowerCase() === activeName.toLowerCase(),
    ) ??
    databases.find(
      (item) =>
        !item.engineId &&
        item.name.toLowerCase() === activeName.toLowerCase(),
    );
  if (
    dataset === undefined ||
    dataset.id === useSqlStore.getState().activeDatasetId
  ) {
    return;
  }
  useSqlStore.setState({ activeDatasetId: dataset.id });
}

function syncDatasetTables(datasetId: string, tables: TableInfo[]): void {
  const pack = usePackStore.getState();
  const activeOptionId = useSqlStore.getState().activeOptionId;
  const dataset = pack.databases.find((item) => item.id === datasetId);
  if (!dataset || !isDatasetForEngine(dataset, activeOptionId)) return;
  if (dataset.setupSql.trim().length > 0 && dataset.tables.length > 0) return;
  pack.addDataset({
    ...dataset,
    tables: tablesToDatasetTables(tables),
  });
}
