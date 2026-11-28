"use client";

import { useCallback, useState } from "react";
import {
  Check,
  History,
  Loader2,
  Play,
  Save,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQueryHistoryStore } from "@/stores/useQueryHistoryStore";
import { useSnippetsStore } from "@/stores/useSnippetsStore";
import { cn } from "@/lib/utils";

interface ToolButtonProps {
  label: string;
  shortcut?: string;
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}

function ToolButton({
  label,
  shortcut,
  children,
  disabled,
  onClick,
}: ToolButtonProps): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut ? (
          <kbd className="ml-1.5 border border-background/25 px-1 py-px font-mono text-[9px] text-background/85">
            {shortcut}
          </kbd>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

function DialogCloseButton(): React.ReactElement {
  return (
    <DialogClose asChild>
      <Button variant="ghost" size="sm">
        <X data-icon="inline-start" /> Close
      </Button>
    </DialogClose>
  );
}

export function HistoryDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onPick: (sql: string) => void;
}): React.ReactElement {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;
  const history = useQueryHistoryStore((state) => state.history);
  const clearHistory = useQueryHistoryStore((state) => state.clearHistory);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <ToolButton
        label="Query history"
        shortcut="Ctrl+H"
        disabled={history.length === 0}
        onClick={() => setIsOpen(true)}
      >
        <History className="size-3.5" />
      </ToolButton>
      <DialogContent
        className="flex max-h-[80vh] max-w-xl flex-col gap-0 p-0"
        showCloseButton={false}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-border bg-surface-alt px-4 py-3">
          <div>
            <DialogTitle className="text-[13px]">Query history</DialogTitle>
            <DialogDescription className="mt-0.5 text-[11px]">
              Click an entry to place it in the editor.
            </DialogDescription>
          </div>
          <span className="numeric text-[10.5px] text-muted-dim">
            {history.length} entries
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12px] text-muted-dim">
              No history yet
            </p>
          ) : (
            history.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  onPick(entry.query);
                  setIsOpen(false);
                }}
                className="flex w-full items-start gap-3 border-b border-border/50 px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-surface-hover"
              >
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0",
                    entry.success ? "bg-success" : "bg-error",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[11.5px] text-foreground/90">
                    {entry.query}
                  </span>
                  <span className="text-[10px] text-muted-dim">
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2.5">
          <Button
            variant="ghost"
            size="xs"
            className="gap-1.5 text-destructive hover:text-destructive"
            disabled={history.length === 0}
            onClick={clearHistory}
          >
            <Trash2 className="size-3" /> Clear
          </Button>
          <DialogCloseButton />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SnippetsDialog({
  sql,
  open: controlledOpen,
  onOpenChange,
  onPick,
}: {
  sql: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onPick: (sql: string) => void;
}): React.ReactElement {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const snippets = useSnippetsStore((state) => state.snippets);
  const addSnippet = useSnippetsStore((state) => state.addSnippet);
  const removeSnippet = useSnippetsStore((state) => state.removeSnippet);
  const [saved, setSaved] = useState(false);

  const save = useCallback(() => {
    const content = sql.trim();
    if (content.length === 0) return;
    addSnippet({
      id: `snippet-${Date.now()}`,
      title: content.split("\n")[0].slice(0, 60),
      sql: content,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  }, [sql, addSnippet]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ToolButton
        label="Saved snippets"
        shortcut="Ctrl+Shift+S"
        onClick={() => setOpen(true)}
      >
        <Star className="size-3.5" />
      </ToolButton>
      <DialogContent
        className="flex max-h-[80vh] max-w-xl flex-col gap-0 p-0"
        showCloseButton={false}
      >
        <div className="flex shrink-0 items-start justify-between border-b border-border bg-surface-alt px-4 py-3">
          <div>
            <DialogTitle className="text-[13px]">Saved snippets</DialogTitle>
            <DialogDescription className="mt-0.5 text-[11px]">
              Keep useful queries around and reuse them.
            </DialogDescription>
          </div>
          <span className="numeric text-[10.5px] text-muted-dim">
            {snippets.length} saved
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {snippets.length === 0 ? (
            <p className="px-4 py-10 text-center text-[12px] text-muted-dim">
              Save the current SQL to build your library.
            </p>
          ) : (
            snippets.map((snippet) => (
              <div
                key={snippet.id}
                className="group flex items-start gap-2 border-b border-border/50 px-4 py-2.5 transition-colors last:border-b-0 hover:bg-surface-hover"
              >
                <button
                  type="button"
                  onClick={() => {
                    onPick(snippet.sql);
                    setOpen(false);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-[12px] font-medium text-foreground/90">
                    {snippet.title}
                  </span>
                  <span className="block truncate font-mono text-[10.5px] text-muted-dim">
                    {snippet.sql}
                  </span>
                </button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Delete snippet ${snippet.title}`}
                      className="mt-0.5 text-muted-dim opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      onClick={() => removeSnippet(snippet.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete snippet</TooltipContent>
                </Tooltip>
              </div>
            ))
          )}
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-4 py-2.5">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={saved || sql.trim().length === 0}
            onClick={save}
          >
            {saved ? (
              <Check className="size-3.5" />
            ) : (
              <Save className="size-3.5" />
            )}
            {saved ? "Saved" : "Save current SQL"}
          </Button>
          <DialogCloseButton />
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RunButton({
  onClick,
  isLoading,
  disabled = false,
}: {
  onClick: () => void;
  isLoading: boolean;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          onClick={onClick}
          disabled={isLoading || disabled}
          className="h-7 shrink-0 px-2.5 text-[11px] font-medium"
        >
          {isLoading ? (
            <Loader2 data-icon="inline-start" className="animate-spin" />
          ) : (
            <Play data-icon="inline-start" />
          )}
          Run
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Run SQL
        <kbd className="ml-1.5 border border-background/25 px-1 py-px font-mono text-[9px] text-background/85">
          Ctrl+Enter / F5
        </kbd>
      </TooltipContent>
    </Tooltip>
  );
}
