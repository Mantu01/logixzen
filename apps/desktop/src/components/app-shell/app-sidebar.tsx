"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, FolderKanban, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProgressStore } from "@/stores/useProgressStore";
import { usePackStore } from "@/stores/usePackStore";
import { DEFAULT_WORKSPACE_ID } from "@/lib/categories";
import { SETTINGS_NAV, WORKSPACE_NAV } from "@/lib/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const STORAGE_KEY = "logixzen.sidebar.collapsed";
const COMPACT_BREAKPOINT = 960;

export function AppSidebar(): React.ReactElement {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.localStorage.getItem(STORAGE_KEY) === "true" ||
        (window.localStorage.getItem(STORAGE_KEY) === null &&
          window.innerWidth < COMPACT_BREAKPOINT)),
  );
  const navRef = useRef<HTMLElement | null>(null);
  const totalPoints = useProgressStore((state) => state.totalPoints);
  const solvedCount = useProgressStore((state) => state.solvedQuestions.size);
  const streak = useProgressStore((state) => state.streak.currentStreak);
  const workspaces = usePackStore((state) => state.workspaces);
  const activeWorkspaceId = usePackStore((state) => state.activeWorkspaceId);
  const setActiveWorkspace = usePackStore((state) => state.setActiveWorkspace);
  const questions = usePackStore((state) => state.questions);
  const questionWorkspace = usePackStore((state) => state.questionWorkspace);
  const datasetCount = usePackStore((state) => state.databases.length);
  const notes = usePackStore((state) => state.notes);
  const noteWorkspace = usePackStore((state) => state.noteWorkspace);

  const currentWorkspaceId = activeWorkspaceId || DEFAULT_WORKSPACE_ID;
  const questionCount = questions.filter(
    (q) => (questionWorkspace[q.id] ?? DEFAULT_WORKSPACE_ID) === currentWorkspaceId,
  ).length;
  const noteCount = notes.filter(
    (n) => (noteWorkspace[n.id] ?? DEFAULT_WORKSPACE_ID) === currentWorkspaceId,
  ).length;

  const toggle = useCallback((): void => {
    setCollapsed((previous) => {
      const next = !previous;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key === "\\") {
        event.preventDefault();
        toggle();
        return;
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  useEffect(() => {
    const onResize = (): void => {
      if (
        window.localStorage.getItem(STORAGE_KEY) === null &&
        window.innerWidth < COMPACT_BREAKPOINT
      ) {
        setCollapsed(true);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const handleNavKeyDown = (event: React.KeyboardEvent<HTMLElement>): void => {
    if (!navRef.current) return;
    if (
      event.key !== "ArrowDown" &&
      event.key !== "ArrowUp" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    const links = Array.from(
      navRef.current.querySelectorAll<HTMLAnchorElement>("a[href]"),
    );
    if (links.length === 0) return;
    const currentIndex = links.indexOf(
      document.activeElement as HTMLAnchorElement,
    );
    event.preventDefault();
    if (event.key === "Home") {
      links[0]?.focus();
      return;
    }
    if (event.key === "End") {
      links[links.length - 1]?.focus();
      return;
    }
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex =
      currentIndex === -1
        ? 0
        : (currentIndex + delta + links.length) % links.length;
    links[nextIndex]?.focus();
  };

  const isActive = (href: string): boolean =>
    pathname === href || pathname.startsWith(`${href}/`);

  const countFor = (href: string): number | undefined => {
    if (href === "/learn") return questionCount;
    if (href === "/schema") return datasetCount;
    if (href === "/notes") return noteCount;
    return undefined;
  };

  return (
    <aside
      aria-label="SQL workspace sidebar"
      className={cn(
        "flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-150 ease-out",
        collapsed ? "w-12" : "w-[216px]",
      )}
    >
      <div className="flex h-9 items-center justify-between border-b border-sidebar-border px-1.5">
        {collapsed ? null : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/"
                className="flex h-7 items-center gap-1.5 px-1.5 text-[11px] font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                <ArrowLeft className="size-3" />
                <span>Subjects</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Return to Home & Workspaces</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              className={cn(
                "flex h-7 items-center justify-center text-muted-dim transition-colors hover:bg-surface-hover hover:text-foreground",
                collapsed ? "w-full" : "w-7",
              )}
            >
              {collapsed ? (
                <PanelLeft className="size-4" />
              ) : (
                <ChevronLeft className="size-3.5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? "Expand sidebar (Ctrl+\\)" : "Collapse sidebar (Ctrl+\\)"}
          </TooltipContent>
        </Tooltip>
      </div>

      {collapsed ? null : workspaces.length > 0 ? (
        <div className="border-b border-sidebar-border px-1.5 py-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <Select
                  value={currentWorkspaceId}
                  onValueChange={(value) => setActiveWorkspace(value)}
                >
                  <SelectTrigger
                    aria-label="Active workspace"
                    className="h-7 w-full gap-1.5 border-border bg-surface px-2 text-[11px] font-medium"
                  >
                    <FolderKanban className="size-3 shrink-0 text-primary" />
                    <SelectValue placeholder="Workspace" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map((ws) => (
                      <SelectItem key={ws.id} value={ws.id}>
                        {ws.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              Active workspace (scopes categories, questions & notes)
            </TooltipContent>
          </Tooltip>
        </div>
      ) : null}

      <nav
        ref={navRef}
        aria-label="SQL Workspace"
        onKeyDown={handleNavKeyDown}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1.5 py-2"
      >
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/"
                aria-label="All subjects"
                className="flex h-7 items-center justify-center text-muted-dim transition-colors hover:bg-surface-hover hover:text-foreground"
              >
                <ArrowLeft className="size-3.5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              All Subjects & Workspaces
            </TooltipContent>
          </Tooltip>
        ) : null}

        {WORKSPACE_NAV.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            {collapsed ? null : (
              <span className="section-label px-2 pb-1">{group.label}</span>
            )}
            {group.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              const count = countFor(item.href);
              const link = (
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
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

              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">
                        {item.label}
                        {item.shortcut ? ` (${item.shortcut})` : ""}
                      </span>
                      <span className="text-[10.5px] opacity-80">
                        {item.description}
                      </span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-1.5">
        {collapsed ? null : (
          <div className="mb-1 grid grid-cols-3 divide-x divide-border border border-border bg-surface-alt">
            <Metric
              label="pts"
              value={totalPoints}
              tooltip="Total practice points earned"
            />
            <Metric
              label="solved"
              value={solvedCount}
              tooltip="Unique questions solved"
            />
            <Metric
              label="streak"
              value={streak}
              tooltip="Consecutive practice days"
            />
          </div>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href={SETTINGS_NAV.href}
              aria-current={isActive(SETTINGS_NAV.href) ? "page" : undefined}
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
          </TooltipTrigger>
          <TooltipContent side="right">
            {SETTINGS_NAV.label} ({SETTINGS_NAV.shortcut})
          </TooltipContent>
        </Tooltip>
      </div>
    </aside>
  );
}

function Metric({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: number;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex cursor-default flex-col items-center gap-0.5 px-1 py-1.5">
          <span className="numeric text-[12px] font-semibold text-foreground">
            {value}
          </span>
          <span className="text-[9px] uppercase tracking-wider text-muted-dim">
            {label}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}
