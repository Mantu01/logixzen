"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_APP_ROUTE, loadSavedRoute } from "@/lib/workspace-route";

export default function RootEntryPage(): React.ReactElement {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const resolveInitialRoute = async (): Promise<void> => {
      const bridge = window.logixzen?.setup;
      if (bridge !== undefined) {
        try {
          const res = await bridge.installations();
          if (cancelled) return;
          if (res.ok) {
            const hasReady = res.data.some((inst) => inst.status === "ready");
            if (!hasReady) {
              router.replace("/setup");
              return;
            }
          }
        } catch {}
      }

      const savedRoute = await loadSavedRoute();
      if (!cancelled) {
        router.replace(savedRoute || DEFAULT_APP_ROUTE);
      }
    };

    void resolveInitialRoute();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return <div className="flex flex-1 bg-background" />;
}
