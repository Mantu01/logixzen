import { AlertTriangle, Check } from "lucide-react";
import type { PackIssue } from "@/lib/packs/types";

export interface InstallStatus {
  ok: boolean;
  issues: PackIssue[];
}

export function InstallReport({
  status,
  message,
}: {
  status: InstallStatus | null;
  message: string | null;
}): React.ReactElement | null {
  if (status === null) return null;
  if (!status.ok) {
    return (
      <div className="mt-3 border border-error/40 bg-error/5 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-error">
          <AlertTriangle className="size-3.5" /> Validation failed
        </div>
        {status.issues.length === 0 ? (
          <p className="mt-1 font-mono text-[11px] text-error/80">
            Unknown error
          </p>
        ) : (
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {status.issues.slice(0, 12).map((issue, index) => (
              <li key={index} className="font-mono text-[10.5px] text-error/85">
                {issue.path}: {issue.message}
              </li>
            ))}
          </ul>
        )}
        {status.issues.length > 12 ? (
          <p className="mt-1 text-[10.5px] text-muted-dim">
            and {status.issues.length - 12} more issues
          </p>
        ) : null}
      </div>
    );
  }
  if (message === null) return null;
  return (
    <div className="mt-3 flex items-center gap-2 border border-success/40 bg-success/5 px-3 py-2.5 text-[12px] text-success">
      <Check className="size-3.5 shrink-0" />
      <span className="font-medium">{message}</span>
    </div>
  );
}
