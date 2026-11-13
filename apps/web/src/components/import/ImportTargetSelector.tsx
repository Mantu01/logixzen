'use client'

import type { ImportTarget } from '@/features/import/validation'

interface ImportTargetSelectorProps {
  value: ImportTarget
  onChange: (target: ImportTarget) => void
}

const TARGETS: { id: ImportTarget; label: string; description: string }[] = [
  { id: 'database', label: 'Database', description: 'Load into SQLite' },
  { id: 'progress', label: 'Progress', description: 'Restore practice state' },
]

export function ImportTargetSelector({ value, onChange }: ImportTargetSelectorProps): React.ReactElement {
  return (
    <div className="flex gap-2">
      {TARGETS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`flex-1 p-2 rounded border text-left transition-colors ${
            value === t.id
              ? 'border-primary bg-primary/15 text-primary'
              : 'border-border hover:border-primary/50 text-muted'
          }`}
        >
          <div className="font-mono text-xs font-semibold">{t.label}</div>
          <div className="text-[10px] leading-none mt-0.5">{t.description}</div>
        </button>
      ))}
    </div>
  )
}
