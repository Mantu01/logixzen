"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProgressStore } from "@/stores/useProgressStore";
import { usePackStore } from "@/stores/usePackStore";
import { SETTINGS_NAV, WORKSPACE_NAV } from "@/lib/navigation";

const STORAGE_KEY = "logixzen.sidebar.collapsed";

export function AppSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(STORAGE_KEY) === "true",
  );
  const totalPoints = useProgressStore((state) => state.totalPoints);
  const solvedCount = useProgressStore((state) => state.solvedQuestions.size);
  const streak = useProgressStore((state) => state.streak.currentStreak);
  const questionCount = usePackStore((state) => state.questions.length);
  const datasetCount = usePackStore((state) => state.databases.length);

  const toggle = (): void => {
    setCollapsed((previous) => {
      window.localStorage.setItem(STORAGE_KEY, String(!previous));
      return !previous;
    });
  };

  const isActive = (href: string): boolean =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-150 ease-out",
        collapsed ? "w-12" : "w-[212px]",
      )}
    >
      <div className="flex h-9 items-center justify-between border-b border-sidebar-border pl-3">
        {!collapsed && <span className="section-label">Workspace</span>}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-9 w-9 items-center justify-center text-muted-dim transition-colors hover:bg-surface-hover hover:text-foreground"
        >
          {collapsed ? (
            <PanelLeft className="size-4" />
          ) : (
            <ChevronLeft className="size-3.5" />
          )}
        </button>
      </div>

      <nav
        aria-label="Main"
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1.5 py-2"
      >
        {WORKSPACE_NAV.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            {collapsed ? null : (
              <span className="section-label px-2 pb-1">{group.label}</span>
            )}
            {group.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              const count =
                item.href === "/learn"
                  ? questionCount
                  : item.href === "/schema"
                    ? datasetCount
                    : undefined;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group relative flex h-7 items-center gap-2 px-2 text-[12.5px] font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-sidebar-foreground hover:bg-surface-hover hover:text-foreground",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-primary transition-opacity",
                      active ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <Icon
                    className={cn(
                      "size-3.5 shrink-0",
                      active
                        ? "text-primary"
                        : "text-muted-dim group-hover:text-foreground",
                    )}
                  />
                  {collapsed ? null : (
                    <span className="flex flex-1 items-center justify-between gap-2">
                      <span className="truncate">{item.label}</span>
                      {count !== undefined && count > 0 ? (
                        <span className="numeric text-[10px] text-muted-dim">
                          {count}
                        </span>
                      ) : null}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-1.5">
        {collapsed ? null : (
          <div className="mb-1 grid grid-cols-3 divide-x divide-border border border-border bg-surface-alt">
            <Metric label="pts" value={totalPoints} />
            <Metric label="solved" value={solvedCount} />
            <Metric label="streak" value={streak} />
          </div>
        )}
        <Link
          href={SETTINGS_NAV.href}
          aria-current={isActive(SETTINGS_NAV.href) ? "page" : undefined}
          title={collapsed ? SETTINGS_NAV.label : undefined}
          className={cn(
            "group relative flex h-7 items-center gap-2 px-2 text-[12.5px] font-medium transition-colors",
            isActive(SETTINGS_NAV.href)
              ? "bg-accent text-accent-foreground"
              : "text-sidebar-foreground hover:bg-surface-hover hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          <SETTINGS_NAV.icon
            className={cn(
              "size-3.5 shrink-0",
              isActive(SETTINGS_NAV.href)
                ? "text-primary"
                : "text-muted-dim group-hover:text-foreground",
            )}
          />
          {collapsed ? null : <span>{SETTINGS_NAV.label}</span>}
        </Link>
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-1 py-1.5">
      <span className="numeric text-[12px] font-semibold text-foreground">
        {value}
      </span>
      <span className="text-[9px] uppercase tracking-wider text-muted-dim">
        {label}
      </span>
    </div>
  );
}
