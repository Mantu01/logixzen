"use client";

import { useCallback, useState } from "react";
import { Check, Copy, History, Loader2, Play, Save, Star, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQueryHistoryStore } from "@/stores/useQueryHistoryStore";
import { useSnippetsStore } from "@/stores/useSnippetsStore";
import { cn } from "@/lib/utils";

export function HistoryDialog({ onPick }: { onPick: (sql: string) => void }): React.ReactElement {
  const history = useQueryHistoryStore((state) => state.history);
  const clearHistory = useQueryHistoryStore((state) => state.clearHistory);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5" disabled={history.length === 0}>
          <History className="size-3.5" /> History
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Query history</DialogTitle>
          <DialogDescription>Click a query to place it in the editor.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 divide-y divide-border overflow-y-auto border border-border">
          {history.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] text-muted-dim">No history yet</p>
          ) : null}
          {history.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onPick(entry.query)}
              className="flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-hover"
            >
              <span className={cn("mt-1 size-1.5 shrink-0", entry.success ? "bg-success" : "bg-error")} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[11.5px]">{entry.query}</span>
                <span className="text-[10px] text-muted-dim">{new Date(entry.timestamp).toLocaleString()}</span>
              </span>
            </button>
          ))}
        </div>
        {history.length > 0 ? (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={clearHistory}>
              <Trash2 className="size-3.5" /> Clear history
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function SnippetsDialog({ sql, onPick }: { sql: string; onPick: (sql: string) => void }): React.ReactElement {
  const snippets = useSnippetsStore((state) => state.snippets);
  const addSnippet = useSnippetsStore((state) => state.addSnippet);
  const removeSnippet = useSnippetsStore((state) => state.removeSnippet);
  const [saving, setSaving] = useState(false);

  const save = useCallback(() => {
    const content = sql.trim();
    if (content.length === 0) return;
    addSnippet({ id: `snippet-${Date.now()}`, title: content.split("\n")[0].slice(0, 60), sql: content });
    setSaving(true);
    window.setTimeout(() => setSaving(false), 1200);
  }, [sql, addSnippet]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Star className="size-3.5" /> Snippets
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Saved snippets</DialogTitle>
          <DialogDescription>Keep useful queries around and reuse them.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 divide-y divide-border overflow-y-auto border border-border">
          {snippets.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] text-muted-dim">No snippets saved</p>
          ) : null}
          {snippets.map((snippet) => (
            <div key={snippet.id} className="flex items-start gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => onPick(snippet.sql)}
                className="min-w-0 flex-1 text-left transition-colors hover:text-primary"
              >
                <span className="block truncate text-[12px] font-medium">{snippet.title}</span>
                <span className="block truncate font-mono text-[10.5px] text-muted-dim">{snippet.sql}</span>
              </button>
              <Button variant="ghost" size="icon-xs" aria-label="Delete snippet" onClick={() => removeSnippet(snippet.id)}>
                <X className="size-3" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button size="sm" className="gap-1.5" disabled={saving} onClick={save}>
            {saving ? <Check className="size-3.5" /> : <Save className="size-3.5" />}
            {saving ? "Saved" : "Save current SQL"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RunButton({
  onClick,
  isLoading,
}: {
  onClick: () => void;
  isLoading: boolean;
}): React.ReactElement {
  return (
    <Button size="sm" onClick={onClick} disabled={isLoading} className="gap-1.5">
      {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
      {isLoading ? "Running" : "Run"}
      <kbd className="ml-1 border border-primary-foreground/25 bg-primary-foreground/10 px-1 font-mono text-[9px] font-normal">
        Ctrl Enter
      </kbd>
    </Button>
  );
}

export function CopySqlButton({ sql }: { sql: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5"
      disabled={sql.trim().length === 0}
      onClick={() => {
        void navigator.clipboard.writeText(sql);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
