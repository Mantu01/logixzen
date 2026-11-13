import type { StateStorage } from "zustand/middleware";

async function getNative(key: string): Promise<string | null> {
  const bridge = typeof window !== "undefined" ? window.logixzen : undefined;
  if (bridge === undefined) {
    return localStorage.getItem(key);
  }
  return (await bridge.storage.get(key)) ?? localStorage.getItem(key);
}

export const nativeStorage: StateStorage = {
  getItem: async (name) => getNative(name),
  setItem: async (name, value) => {
    const bridge = typeof window !== "undefined" ? window.logixzen : undefined;
    if (bridge !== undefined) {
      await bridge.storage.set(name, value);
    }
    localStorage.setItem(name, value);
  },
  removeItem: async (name) => {
    const bridge = typeof window !== "undefined" ? window.logixzen : undefined;
    if (bridge !== undefined) {
      await bridge.storage.delete(name);
    }
    localStorage.removeItem(name);
  },
};
