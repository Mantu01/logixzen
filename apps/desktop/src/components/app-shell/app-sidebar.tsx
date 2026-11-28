"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Layers, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePackStore } from "@/stores/usePackStore";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { DEFAULT_WORKSPACE_ID } from "@/lib/categories";
import {
  getSubjectDefaultHref,
  getSubjectNavGroups,
  SETTINGS_NAV,
} from "@/lib/navigation";
import {
  getSubjectById,
  SUBJECT_REGISTRY,
  type SubjectId,
} from "@/lib/subjects";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STORAGE_KEY = "logixzen.sidebar.collapsed";
const COMPACT_BREAKPOINT = 960;

export function AppSidebar(): React.ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.localStorage.getItem(STORAGE_KEY) === "true" ||
        (window.localStorage.getItem(STORAGE_KEY) === null &&
          window.innerWidth < COMPACT_BREAKPOINT)),
  );
  const navRef = useRef<HTMLElement | null>(null);
  const activeSubjectId = useWorkspaceStore((state) => state.activeSubjectId);
  const setActiveSubject = useWorkspaceStore((state) => state.setActiveSubject);
  const workspaces = usePackStore((state) => state.workspaces);
  const activeWorkspaceId = usePackStore((state) => state.activeWorkspaceId);
  const setActiveWorkspace = usePackStore((state) => state.setActiveWorkspace);
  const questions = usePackStore((state) => state.questions);
  const questionWorkspace = usePackStore((state) => state.questionWorkspace);
  const datasetCount = usePackStore((state) => state.databases.length);
  const notes = usePackStore((state) => state.notes);
  const noteWorkspace = usePackStore((state) => state.noteWorkspace);

  const activeSubject = useMemo(
    () => getSubjectById(activeSubjectId) ?? SUBJECT_REGISTRY[0],
    [activeSubjectId],
  );

  const navGroups = useMemo(
    () => getSubjectNavGroups(activeSubject.id),
    [activeSubject.id],
  );

  const currentWorkspaceId = useMemo(() => {
    const active = workspaces.find((w) => w.id === activeWorkspaceId);
    if (active && active.subjectId === activeSubject.id) return active.id;
    const match = workspaces.find((w) => w.subjectId === activeSubject.id);
    return match?.id ?? activeWorkspaceId ?? DEFAULT_WORKSPACE_ID;
  }, [workspaces, activeWorkspaceId, activeSubject.id]);

  const questionCount = questions.filter(
    (q) =>
      (questionWorkspace[q.id] ?? DEFAULT_WORKSPACE_ID) === currentWorkspaceId,
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

  const handleSubjectChange = (nextId: string): void => {
    const subject = getSubjectById(nextId);
    if (subject === undefined || subject.state !== "available") return;
    setActiveSubject(subject.id as SubjectId);
    const matchingWorkspace = workspaces.find(
      (w) => w.subjectId === subject.id,
    );
    if (matchingWorkspace !== undefined) {
      setActiveWorkspace(matchingWorkspace.id);
    }
    router.push(getSubjectDefaultHref(subject.id as SubjectId));
  };

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

  const isActive = (matchPath: string): boolean =>
    pathname === matchPath || pathname.startsWith(`${matchPath}/`);

  const countFor = (matchPath: string): number | undefined => {
    if (matchPath === "/learn") return questionCount;
    if (matchPath === "/schema") return datasetCount;
    if (matchPath === "/notes") return noteCount;
    return undefined;
  };

  return (
    <aside
      aria-label={`${activeSubject.shortLabel} workspace sidebar`}
      className={cn(
        "flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-150 ease-out",
        collapsed ? "w-12" : "w-[216px]",
      )}
    >
      <div className="flex h-10 items-center justify-between gap-1 border-b border-sidebar-border px-1.5">
        {collapsed ? null : (
          <Select value={activeSubject.id} onValueChange={handleSubjectChange}>
            <SelectTrigger
              size="sm"
              aria-label="Workspace selector"
              className="h-7 min-w-0 flex-1 border-sidebar-border bg-surface-alt px-2 text-[11px] font-medium"
            >
              <Layers className="size-3 shrink-0 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectGroup>
                {SUBJECT_REGISTRY.map((subject) => (
                  <SelectItem
                    key={subject.id}
                    value={subject.id}
                    disabled={subject.state !== "available"}
                    className="text-[11.5px]"
                  >
                    <span className="flex w-full items-center justify-between gap-3">
                      <span className="truncate">{subject.label}</span>
                      {subject.state !== "available" ? (
                        <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-dim">
                          Soon
                        </span>
                      ) : null}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className={cn(
            "flex h-7 shrink-0 items-center justify-center text-muted-dim transition-colors hover:bg-surface-hover hover:text-foreground",
            collapsed ? "w-full" : "w-7",
          )}
        >
          {collapsed ? (
            <PanelLeft className="size-4" />
          ) : (
            <ChevronLeft className="size-3.5" />
          )}
        </button>
      </div>

      {collapsed ? (
        <div className="flex h-7 items-center justify-center border-b border-sidebar-border font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
          {activeSubject.shortLabel}
        </div>
      ) : null}

      <nav
        ref={navRef}
        aria-label={`${activeSubject.shortLabel} Workspace`}
        onKeyDown={handleNavKeyDown}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1.5 py-2"
      >
        {navGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            {collapsed ? null : (
              <span className="section-label px-2 pb-1">{group.label}</span>
            )}
            {group.items.map((item) => {
              const matchPath = item.activeMatch ?? item.href.split("?")[0]!;
              const active = isActive(matchPath);
              const Icon = item.icon;
              const count = countFor(matchPath);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
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
        <Link
          href={SETTINGS_NAV.href}
          aria-current={isActive(SETTINGS_NAV.href) ? "page" : undefined}
          aria-label={SETTINGS_NAV.label}
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
