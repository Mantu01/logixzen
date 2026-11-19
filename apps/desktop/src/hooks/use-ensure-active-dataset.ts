"use client";

import { useEffect } from "react";
import { usePackStore } from "@/stores/usePackStore";
import { useSqlStore } from "@/sql/useSqlStore";

export function useEnsureActiveDataset(): void {
  const databases = usePackStore((state) => state.databases);
  const activeDatasetId = useSqlStore((state) => state.activeDatasetId);
  const activateDataset = useSqlStore((state) => state.activateDataset);

  useEffect(() => {
    if (activeDatasetId !== null || databases.length === 0) return;
    void activateDataset(databases[0]?.id ?? null);
  }, [activeDatasetId, databases, activateDataset]);
}