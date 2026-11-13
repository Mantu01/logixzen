"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function MenuNavigation(): null {
  const router = useRouter();

  useEffect(() => {
    const bridge = window.logixzen;
    if (bridge === undefined) return;
    return bridge.menu.onNavigate((path) => {
      router.push(path);
    });
  }, [router]);

  return null;
}
