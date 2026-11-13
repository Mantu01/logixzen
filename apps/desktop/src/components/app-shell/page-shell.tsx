import { cn } from "@/lib/utils";

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  toolbar?: React.ReactNode;
}

export function PageShell({
  title,
  subtitle,
  actions,
  children,
  className,
  bodyClassName,
  toolbar,
}: PageShellProps): React.ReactElement {
  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h1 className="truncate text-[13.5px] font-semibold text-foreground">{title}</h1>
          {subtitle ? (
            <span className="truncate text-[11px] text-muted-dim">{subtitle}</span>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </div>
      {toolbar ? (
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface-alt/50 px-4">
          {toolbar}
        </div>
      ) : null}
      <div className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>{children}</div>
    </div>
  );
}
