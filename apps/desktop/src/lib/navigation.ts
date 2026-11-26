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

export interface NavItem {
  href: string;
  label: string;
  shortcut?: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const WORKSPACE_NAV: NavGroup[] = [
  {
    label: "Data",
    items: [
      {
        href: "/playground",
        label: "Editor",
        shortcut: "Ctrl+2",
        description: "Write and run queries against your active database",
        icon: Terminal,
      },
      {
        href: "/databases",
        label: "Databases",
        shortcut: "Ctrl+Shift+D",
        description: "Install, start, stop and verify database engines",
        icon: Database,
      },
      {
        href: "/schema",
        label: "Schema",
        shortcut: "Ctrl+4",
        description: "Inspect tables, foreign keys and ER diagrams",
        icon: Network,
      },
      {
        href: "/import",
        label: "Data Hub",
        shortcut: "Ctrl+I",
        description: "Import official bundles or custom workspace JSON",
        icon: Import,
      },
    ],
  },
  {
    label: "Learn",
    items: [
      {
        href: "/learn",
        label: "Practice",
        shortcut: "Ctrl+3",
        description: "Solve graded questions organized by category",
        icon: GraduationCap,
      },
      {
        href: "/notes",
        label: "Notes",
        shortcut: "Ctrl+6",
        description: "Study, write and filter reference notes",
        icon: BookOpen,
      },
      {
        href: "/progress",
        label: "Progress",
        shortcut: "Ctrl+5",
        description: "Review streaks, accuracy, activity and badges",
        icon: BarChart3,
      },
    ],
  },
];

export const SETTINGS_NAV: NavItem = {
  href: "/settings",
  label: "Settings",
  shortcut: "Ctrl+,",
  description: "Configure appearance, editor, grading and AI provider",
  icon: Settings2,
};

export const WORKSPACE_LINKS: NavItem[] = [
  ...WORKSPACE_NAV.flatMap((group) => group.items),
  SETTINGS_NAV,
];
