export const LAST_ROUTE_KEY = "logixzen.lastRoute";
export const DEFAULT_APP_ROUTE = "/playground";

const RESTORABLE_PREFIXES = [
  "/playground",
  "/databases",
  "/schema",
  "/import",
  "/learn",
  "/notes",
  "/progress",
  "/settings",
];

export function isRestorableRoute(pathname: string): boolean {
  if (!pathname || pathname === "/" || pathname.startsWith("/setup")) {
    return false;
  }
  return RESTORABLE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function normalizeRestorableRoute(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_APP_ROUTE;
  const trimmed = raw.trim();
  const qIndex = trimmed.indexOf("?");
  const pathname = qIndex === -1 ? trimmed : trimmed.slice(0, qIndex);
  if (!isRestorableRoute(pathname)) return DEFAULT_APP_ROUTE;
  return trimmed;
}

export async function loadSavedRoute(): Promise<string> {
  if (typeof window === "undefined") return DEFAULT_APP_ROUTE;
  try {
    const nativeValue = await window.logixzen?.storage?.get(LAST_ROUTE_KEY);
    if (nativeValue) return normalizeRestorableRoute(nativeValue);
  } catch {}
  try {
    return normalizeRestorableRoute(window.localStorage.getItem(LAST_ROUTE_KEY));
  } catch {
    return DEFAULT_APP_ROUTE;
  }
}

export function saveLastRoute(route: string): void {
  if (typeof window === "undefined") return;
  const normalized = normalizeRestorableRoute(route);
  try {
    window.localStorage.setItem(LAST_ROUTE_KEY, normalized);
  } catch {}
  try {
    void window.logixzen?.storage?.set(LAST_ROUTE_KEY, normalized);
  } catch {}
}
