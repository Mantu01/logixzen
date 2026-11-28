"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { getSubjectById, type SubjectId } from "@/lib/subjects";
import { isRestorableRoute, saveLastRoute } from "@/lib/workspace-route";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";

function RouteTracker(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const setLastRoute = useWorkspaceStore((state) => state.setLastRoute);
  const setActiveSubject = useWorkspaceStore((state) => state.setActiveSubject);

  useEffect(() => {
    const workspaceParam = searchParams.get("workspace");
    if (workspaceParam) {
      const subject = getSubjectById(workspaceParam);
      if (subject !== undefined && subject.state === "available") {
        setActiveSubject(subject.id as SubjectId);
      }
    }

    if (!isRestorableRoute(pathname)) return;
    const query = searchParams.toString();
    const fullRoute = query ? `${pathname}?${query}` : pathname;
    saveLastRoute(fullRoute);
    setLastRoute(fullRoute);
  }, [pathname, searchParams, setLastRoute, setActiveSubject]);

  return null;
}

export function RoutePersistence(): React.ReactElement {
  return (
    <Suspense fallback={null}>
      <RouteTracker />
    </Suspense>
  );
}
