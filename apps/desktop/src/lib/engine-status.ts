import type { InstallMethod, LifecycleStatus } from "@/shared/engines";

const STATUS_LABELS: Record<LifecycleStatus, string> = {
  "not-installed": "Not installed",
  detected: "Detected",
  activating: "Activating",
  installing: "Installing",
  installed: "Installed",
  verifying: "Verifying",
  ready: "Ready",
  stopped: "Stopped",
  "needs-repair": "Needs repair",
  uninstalling: "Uninstalling",
  failed: "Failed",
};

const METHOD_LABELS: Record<InstallMethod, string> = {
  bundled: "Bundled",
  native: "Local server",
  "native-windows": "Windows service",
  "native-macos": "macOS service",
  container: "Container",
};

export function statusLabel(status: LifecycleStatus): string {
  return STATUS_LABELS[status];
}

export function methodLabel(method: InstallMethod): string {
  return METHOD_LABELS[method];
}
