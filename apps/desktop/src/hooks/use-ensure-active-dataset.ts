"use client";

import { useEffect } from "react";
import { usePackStore } from "@/stores/usePackStore";
import { useSqlStore } from "@/sql/useSqlStore";
import { filterDatasetsForEngine } from "@/lib/dataset-from-sql";

export function useEnsureActiveDataset(): void {
  const databases = usePackStore((state) => state.databases);
  const activeDatasetId = useSqlStore((state) => state.activeDatasetId);
  const activeOptionId = useSqlStore((state) => state.activeOptionId);
  const connectionStatus = useSqlStore((state) => state.connectionStatus);
  const schema = useSqlStore((state) => state.schema);
  const activateDataset = useSqlStore((state) => state.activateDataset);

  useEffect(() => {
    if (connectionStatus !== "ready") return;
    if (activeDatasetId !== null) return;
    const compatible = filterDatasetsForEngine(databases, activeOptionId);
    if (compatible.length === 0) return;
    if (schema.length > 0) return;
    void activateDataset(compatible[0]?.id ?? null);
  }, [
    connectionStatus,
    activeDatasetId,
    activeOptionId,
    databases,
    schema.length,
    activateDataset,
  ]);
}
