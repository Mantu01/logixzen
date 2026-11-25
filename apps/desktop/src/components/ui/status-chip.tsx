import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "success" | "warning" | "danger" | "info";

const TONES: Record<StatusTone, string> = {
  neutral: "border-border bg-surface-alt text-muted",
  success: "border-success/35 bg-success/10 text-success",
  warning: "border-warning/35 bg-warning/10 text-warning",
  danger: "border-destructive/35 bg-destructive/10 text-destructive",
  info: "border-primary/35 bg-primary/10 text-primary",
};

export function StatusChip({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wider",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({
  tone = "neutral",
  pulse = false,
}: {
  tone?: StatusTone;
  pulse?: boolean;
}): React.ReactElement {
  const colors: Record<StatusTone, string> = {
    neutral: "bg-muted-dim",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-destructive",
    info: "bg-primary",
  };
  return (
    <span
      aria-hidden="true"
      className={cn("size-1.5 shrink-0", colors[tone], pulse && "animate-pulse")}
    />
  );
}
