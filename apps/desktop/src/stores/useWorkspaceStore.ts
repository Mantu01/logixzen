"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { nativeStorage } from "@/lib/native-storage";
import { getSubjectById, type SubjectId } from "@/lib/subjects";
import { DEFAULT_APP_ROUTE } from "@/lib/workspace-route";

interface WorkspaceStoreState {
  activeSubjectId: SubjectId;
  lastRoute: string;
  hydrated: boolean;
  setActiveSubject: (subjectId: SubjectId) => void;
  setLastRoute: (route: string) => void;
}

export const useWorkspaceStore = create<WorkspaceStoreState>()(
  persist(
    (set) => ({
      activeSubjectId: "sql",
      lastRoute: DEFAULT_APP_ROUTE,
      hydrated: false,
      setActiveSubject: (subjectId) => {
        const subject = getSubjectById(subjectId);
        if (subject === undefined || subject.state !== "available") return;
        set({ activeSubjectId: subjectId });
      },
      setLastRoute: (route) => set({ lastRoute: route }),
    }),
    {
      name: "logixzen.workspace",
      storage: createJSONStorage(() => nativeStorage),
      partialize: (state) => ({
        activeSubjectId: state.activeSubjectId,
        lastRoute: state.lastRoute,
      }),
      onRehydrateStorage: () => (state) => {
        if (state !== undefined) {
          useWorkspaceStore.setState({ hydrated: true });
        }
      },
    },
  ),
);
