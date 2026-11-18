"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

export function SetupGate(): React.ReactElement | null {
  const router = useRouter();
  const pathname = usePathname();
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current || pathname === "/setup") return;
    checkedRef.current = true;

    const bridge = window.logixzen?.setup;
    if (!bridge) return;

    void bridge
      .installations()
      .then((res) => {
        if (res.ok) {
          const hasReadyEngine = res.data.some(
            (inst) => inst.status === "ready",
          );
          if (!hasReadyEngine) {
            router.push("/setup");
          }
        }
      })
      .catch(() => {});
  }, [pathname, router]);

  return null;
}
