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
      { href: "/playground", label: "Editor", icon: Terminal },
      { href: "/databases", label: "Databases", icon: Database },
      { href: "/schema", label: "Schema", icon: Network },
      { href: "/import", label: "Data Hub", icon: Import },
    ],
  },
  {
    label: "Learn",
    items: [
      { href: "/learn", label: "Practice", icon: GraduationCap },
      { href: "/notes", label: "Notes", icon: BookOpen },
      { href: "/progress", label: "Progress", icon: BarChart3 },
    ],
  },
];

export const SETTINGS_NAV: NavItem = {
  href: "/settings",
  label: "Settings",
  icon: Settings2,
};

export const WORKSPACE_LINKS: NavItem[] = [
  ...WORKSPACE_NAV.flatMap((group) => group.items),
  SETTINGS_NAV,
];
