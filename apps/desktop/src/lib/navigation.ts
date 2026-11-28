import {
  BarChart3,
  BookOpen,
  Database,
  GraduationCap,
  Import,
  Network,
  Settings2,
  Terminal,
} from "lucide-react";
import { getSubjectById, type SubjectId } from "@/lib/subjects";

export interface NavItem {
  href: string;
  activeMatch?: string;
  label: string;
  shortcut?: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export function getSubjectDefaultHref(subjectId: SubjectId): string {
  const subject = getSubjectById(subjectId);
  if (!subject) return "/playground";
  return subject.features.editor ? subject.routePrefix : `/learn?workspace=${subject.id}`;
}

export function getSubjectNavGroups(subjectId: SubjectId): NavGroup[] {
  const subject = getSubjectById(subjectId) ?? getSubjectById("sql")!;
  const editorHref = subject.routePrefix;

  const subjectItems: NavItem[] = [];
  if (subject.features.editor) {
    subjectItems.push({
      href: editorHref,
      activeMatch: editorHref,
      label: "Editor",
      shortcut: "Ctrl+1",
      description: "Write and run queries against your active database",
      icon: Terminal,
    });
  }
  if (subject.features.databases) {
    subjectItems.push({
      href: "/databases",
      activeMatch: "/databases",
      label: "Databases",
      shortcut: "Ctrl+Shift+D",
      description: "Install, start, stop and verify database engines",
      icon: Database,
    });
  }
  if (subject.features.schema) {
    subjectItems.push({
      href: "/schema",
      activeMatch: "/schema",
      label: "Schema",
      shortcut: "Ctrl+4",
      description: "Inspect tables, foreign keys and ER diagrams",
      icon: Network,
    });
  }
  if (subject.features.dataHub) {
    subjectItems.push({
      href: "/import",
      activeMatch: "/import",
      label: "Data Hub",
      shortcut: "Ctrl+I",
      description: "Import official bundles or custom workspace JSON",
      icon: Import,
    });
  }

  const learnItems: NavItem[] = [
    {
      href: `/learn?workspace=${subject.id}`,
      activeMatch: "/learn",
      label: "Practice",
      shortcut: "Ctrl+3",
      description: "Solve graded questions organized by category",
      icon: GraduationCap,
    },
    {
      href: `/notes?workspace=${subject.id}`,
      activeMatch: "/notes",
      label: "Notes",
      shortcut: "Ctrl+6",
      description: "Study, write and filter reference notes",
      icon: BookOpen,
    },
    {
      href: "/progress",
      activeMatch: "/progress",
      label: "Progress",
      shortcut: "Ctrl+5",
      description: "Review streaks, accuracy, activity and badges",
      icon: BarChart3,
    },
  ];

  const groups: NavGroup[] = [];
  if (subjectItems.length > 0) {
    groups.push({ label: subject.shortLabel, items: subjectItems });
  }
  groups.push({ label: "Learn", items: learnItems });
  return groups;
}

export const WORKSPACE_NAV: NavGroup[] = getSubjectNavGroups("sql");

export const SETTINGS_NAV: NavItem = {
  href: "/settings",
  activeMatch: "/settings",
  label: "Settings",
  shortcut: "Ctrl+,",
  description: "Configure appearance, editor, grading and AI provider",
  icon: Settings2,
};

export const WORKSPACE_LINKS: NavItem[] = [
  ...WORKSPACE_NAV.flatMap((group) => group.items),
  SETTINGS_NAV,
];
