import { History, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { QueryHistoryItem } from '@/stores/useQueryHistoryStore'

interface QueryHistoryPanelProps {
  history: QueryHistoryItem[]
  onReuse: (query: string) => void
  onClear: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function QueryHistoryPanel({
  history,
  onReuse,
  onClear,
  collapsed = false,
  onToggleCollapse,
}: QueryHistoryPanelProps): React.ReactElement {
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = history.filter(item =>
    item.query.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-muted hover-text transition-fast border-t border-border"
        title="Expand history"
      >
        <History size={14} />
        <span>History</span>
        {history.length > 0 && (
          <span className="ml-auto text-[10px] bg-tertiary px-1.5 py-0.5">
            {history.length}
          </span>
        )}
        <span className="ml-1">▸</span>
      </button>
    )
  }

  return (
    <div className="flex flex-col h-full border-t border-border">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary">
        <History size={13} className="text-muted" />
        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted flex-1">
          History
        </span>
        <span className="text-[10px] text-muted font-mono">{history.length}</span>
        <button
          onClick={onToggleCollapse}
          className="text-muted hover-text transition-fast"
          title="Collapse history"
        >
          ▸
        </button>
      </div>

      <div className="px-3 py-1.5 border-b border-border/50">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input input-sm w-full"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-3 text-xs text-muted font-mono text-center">No queries yet</div>
        ) : (
          filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => onReuse(item.query)}
              className="w-full text-left px-3 py-2 border-b border-border/30 hover-bg transition-fast group"
            >
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 w-1.5 h-1.5 shrink-0 ${item.success ? 'bg-success' : 'bg-error'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono truncate">{item.query}</p>
                  <p className="text-[10px] text-muted mt-0.5">{formatTime(item.timestamp)}</p>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {history.length > 0 && (
        <div className="p-2 border-t border-border">
          <Button
            onClick={onClear}
            variant="ghost"
            size="sm"
            className="w-full h-7 text-xs font-mono text-error/70 hover-text hover:bg-error-dim"
          >
            <Trash2 size={12} className="mr-1" />
            Clear History
          </Button>
        </div>
      )}
    </div>
  )
}
