"use client";

import { FolderKanban } from "lucide-react";
import { DEFAULT_WORKSPACE_ID } from "@/lib/categories";
import { usePackStore } from "@/stores/usePackStore";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function WorkspaceSwitcher({
  className,
}: {
  className?: string;
}): React.ReactElement | null {
  const workspaces = usePackStore((state) => state.workspaces);
  const activeWorkspaceId =
    usePackStore((state) => state.activeWorkspaceId) || DEFAULT_WORKSPACE_ID;
  const setActiveWorkspace = usePackStore((state) => state.setActiveWorkspace);

  if (workspaces.length <= 1) return null;

  return (
    <Select value={activeWorkspaceId} onValueChange={setActiveWorkspace}>
      <SelectTrigger
        size="sm"
        aria-label="Active workspace"
        className={className ?? "h-7 w-44 border-border bg-surface text-[11px]"}
      >
        <FolderKanban className="size-3 shrink-0 text-primary" />
        <SelectValue placeholder="Workspace" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {workspaces.map((ws) => (
            <SelectItem key={ws.id} value={ws.id} className="text-[11.5px]">
              {ws.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
