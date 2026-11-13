import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { Snippet } from '@/stores/useSnippetsStore'

interface SnippetPanelProps {
  snippets: Snippet[]
  onInsert: (snippet: Snippet) => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function SnippetPanel({
  snippets,
  onInsert,
  onDelete,
  onRename,
  collapsed = false,
  onToggleCollapse,
}: SnippetPanelProps): React.ReactElement {
  const [newTitle, setNewTitle] = useState('')
  const [newSql, setNewSql] = useState('')
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const handleCreate = () => {
    if (!newTitle.trim() || !newSql.trim()) return
    const snippet: Snippet = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      sql: newSql.trim(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    onInsert(snippet)
    setNewTitle('')
    setNewSql('')
    setOpen(false)
  }

  const startEdit = (snippet: Snippet) => {
    setEditingId(snippet.id)
    setEditTitle(snippet.title)
  }

  const saveEdit = () => {
    if (editingId && editTitle.trim()) {
      onRename(editingId, editTitle.trim())
      setEditingId(null)
    }
  }

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-muted hover-text transition-fast border-t border-border"
        title="Expand snippets"
      >
        <Pencil size={14} />
        <span>Snippets</span>
        {snippets.length > 0 && (
          <span className="ml-auto text-[10px] bg-tertiary px-1.5 py-0.5">
            {snippets.length}
          </span>
        )}
        <span className="ml-1">▸</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col h-full border-t border-border">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary">
        <Pencil size={13} className="text-muted" />
        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted flex-1">
          Snippets
        </span>
        <span className="text-[10px] text-muted font-mono">{snippets.length}</span>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted hover-text"
              title="New snippet"
            >
              <Plus size={13} />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-primary border-border-strong max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-mono text-sm">New Snippet</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono text-muted mb-1 block">Title</label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="My snippet"
                  className="bg-base border-border text-primary font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-muted mb-1 block">SQL</label>
                <Textarea
                  value={newSql}
                  onChange={(e) => setNewSql(e.target.value)}
                  placeholder="SELECT * FROM ..."
                  rows={6}
                  className="bg-base border-border text-primary font-mono text-xs resize-none"
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={!newTitle.trim() || !newSql.trim()}
                className="w-full bg-accent hover:opacity-90 text-background font-mono text-xs"
              >
                Save Snippet
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        <button
          onClick={onToggleCollapse}
          className="text-muted hover-text transition-fast"
          title="Collapse snippets"
        >
          ▸
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {snippets.length === 0 ? (
          <div className="p-3 text-xs text-muted font-mono text-center">No snippets saved</div>
        ) : (
          snippets.map((snippet) => (
            <div
              key={snippet.id}
              className="group border border-border hover-border-strong transition-fast p-2"
            >
              <div className="flex items-center gap-1 mb-1">
                {editingId === snippet.id ? (
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    className="flex-1 text-xs font-mono bg-base border border-border px-1 py-0.5 text-primary outline-none"
                    autoFocus
                  />
                ) : (
                  <span
                    className="flex-1 text-xs font-mono font-medium truncate cursor-pointer hover:text-accent"
                    onDoubleClick={() => startEdit(snippet)}
                    title="Double-click to rename"
                  >
                    {snippet.title}
                  </span>
                )}
                <button
                  onClick={() => startEdit(snippet)}
                  className="opacity-0 group-hover:opacity-100 text-muted hover-text transition-all"
                  title="Rename"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={() => onDelete(snippet.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted hover-text-error transition-all"
                  title="Delete"
                >
                  <Trash2 size={11} />
                </button>
              </div>
              <pre className="text-[11px] font-mono text-muted whitespace-pre-wrap break-all">
                {snippet.sql}
              </pre>
              <button
                onClick={() => onInsert(snippet)}
                className="mt-1.5 text-[10px] font-mono text-accent hover:underline"
              >
                Insert →
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
