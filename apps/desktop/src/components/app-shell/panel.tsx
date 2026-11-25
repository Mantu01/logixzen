import { cn } from "@/lib/utils";

interface PanelProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: PanelProps): React.ReactElement {
  return (
    <section className={cn("border border-border bg-surface", className)}>
      {title !== undefined || actions !== undefined ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
          <div className="min-w-0">
            {title !== undefined ? (
              <h2 className="text-[12px] font-semibold leading-5 text-foreground">
                {title}
              </h2>
            ) : null}
            {description !== undefined ? (
              <p className="text-[11px] leading-4 text-muted">{description}</p>
            ) : null}
          </div>
          {actions !== undefined ? (
            <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
          ) : null}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
