"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageShellProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  backHref?: string;
  showBack?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  toolbar?: React.ReactNode;
}

export function PageShell({
  title,
  subtitle,
  breadcrumbs,
  backHref,
  showBack = false,
  actions,
  children,
  className,
  bodyClassName,
  toolbar,
}: PageShellProps): React.ReactElement {
  const router = useRouter();

  const handleBack = (): void => {
    if (backHref) {
      router.push(backHref);
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/playground");
  };

  return (
    <div className={cn("flex h-full min-h-0 w-full flex-col", className)}>
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4">
        <div className="flex min-w-0 items-center gap-2">
          {showBack || backHref ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Go back"
                  onClick={handleBack}
                  className="-ml-1 shrink-0 text-muted-dim hover:text-foreground"
                >
                  <ArrowLeft className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {backHref ? `Back to ${backHref}` : "Go back"}
              </TooltipContent>
            </Tooltip>
          ) : null}

          <div className="min-w-0 flex flex-col justify-center">
            {breadcrumbs && breadcrumbs.length > 0 ? (
              <nav
                aria-label="Breadcrumb"
                className="flex items-center gap-1 text-[10px] text-muted-dim"
              >
                {breadcrumbs.map((crumb, index) => (
                  <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                    {index > 0 ? <ChevronRight className="size-2.5 shrink-0" /> : null}
                    {crumb.href ? (
                      <Link
                        href={crumb.href}
                        className="truncate transition-colors hover:text-foreground"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="truncate text-muted">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            ) : null}
            <div className="flex min-w-0 items-baseline gap-2.5">
              <h1 className="truncate text-[13.5px] font-semibold text-foreground">
                {title}
              </h1>
              {subtitle ? (
                <span className="hidden truncate text-[11px] text-muted-dim sm:inline">
                  {subtitle}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
        ) : null}
      </header>
      {toolbar ? (
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface-alt/50 px-4">
          {toolbar}
        </div>
      ) : null}
      <div className={cn("min-h-0 flex-1 overflow-y-auto", bodyClassName)}>
        {children}
      </div>
    </div>
  );
}
