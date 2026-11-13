"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function useDesktopBridge(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => typeof window !== "undefined" && Boolean(window.logixzen),
    () => false,
  );
}
