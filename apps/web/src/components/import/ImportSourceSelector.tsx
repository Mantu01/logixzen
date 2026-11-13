'use client'

import type { ImportSource } from '@/features/import/validation'

interface ImportSourceSelectorProps {
  value: ImportSource
  onChange: (source: ImportSource) => void
}

const SOURCES: { id: ImportSource; label: string; description: string; icon: string }[] = [
  { id: 'sql-file', label: 'SQL', description: 'Query files (.sql)', icon: '◇' },
  { id: 'csv-file', label: 'CSV', description: 'Data files (.csv)', icon: '⊞' },
  { id: 'sqlite-file', label: 'SQLite', description: 'Database dumps (.db)', icon: '⬡' },
  { id: 'json-paste', label: 'Paste', description: 'JSON from clipboard', icon: '▤' },
]

export function ImportSourceSelector({ value, onChange }: ImportSourceSelectorProps): React.ReactElement {
  return (
    <div className="grid grid-cols-4 gap-2">
      {SOURCES.map((src) => (
        <button
          key={src.id}
          onClick={() => onChange(src.id)}
          className={`flex flex-col items-center gap-1 p-2 rounded border transition-colors text-xs ${
            value === src.id
              ? 'border-primary bg-primary/15 text-primary'
              : 'border-border hover:border-primary/50 text-muted'
          }`}
        >
          <span className="text-base">{src.icon}</span>
          <span className="font-mono font-semibold">{src.label}</span>
          <span className="text-[10px] leading-none">{src.description.split(' ')[0]}</span>
        </button>
      ))}
    </div>
  )
}
