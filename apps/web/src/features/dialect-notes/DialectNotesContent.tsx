'use client'

import { useState } from 'react'
import { getAllDialectNotes, getDialectNote } from '@/features/dialect-notes/dialectNotes'
import { BookOpen } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'

interface Props {
  noteId?: string
}

export function DialectNotesContent({ noteId }: Props): React.ReactElement {
  const [allNotes] = useState(() => getAllDialectNotes())
  const selectedNote = noteId ? getDialectNote(noteId) : allNotes[0]

  if (!selectedNote) {
    return (
      <div className="flex flex-col h-full">
        <PageHeader />
        <div className="page-content">
          <div className="text-center py-12">
            <p className="font-mono text-muted mb-4">Note not found</p>
            <a href="/dialect-notes" className="text-accent hover:underline font-mono text-sm">
              ← Back to all notes
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader />
      <div className="page-content overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="grid grid-cols-[180px_1fr] gap-4">
            {/* Note list sidebar */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
                <BookOpen size={14} className="text-accent" />
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted">Notes</span>
              </div>
              {allNotes.map(note => (
                <button
                  key={note.id}
                  onClick={() => window.location.href = `/dialect-notes?note=${note.id}`}
                  className={`w-full text-left px-3 py-2 text-xs font-mono transition-fast border ${
                    selectedNote.id === note.id
                      ? 'border-accent bg-accent-dim text-accent'
                      : 'border-border hover:bg-hover text-secondary'
                  }`}
                >
                  {note.title}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="border border-border rounded-sm p-4 bg-primary">
              <div className="flex items-start justify-between mb-4">
                <h2 className="font-mono text-sm font-semibold">{selectedNote.title}</h2>
                <div className="flex gap-1">
                  {selectedNote.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 text-[9px] font-mono bg-tertiary border border-border text-muted">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <pre className="text-xs font-mono text-secondary bg-base rounded-sm p-3 whitespace-pre-wrap overflow-x-auto">
                {selectedNote.content}
              </pre>
              <div className="flex items-center justify-between mt-4">
                <NavBtn
                  label="Previous"
                  disabled={allNotes.indexOf(selectedNote) === 0}
                  onClick={() => {
                    const idx = allNotes.findIndex(n => n.id === selectedNote.id)
                    if (idx > 0) window.location.href = `/dialect-notes?note=${allNotes[idx - 1].id}`
                  }}
                />
                <NavBtn
                  label="Next"
                  right
                  disabled={allNotes.indexOf(selectedNote) === allNotes.length - 1}
                  onClick={() => {
                    const idx = allNotes.findIndex(n => n.id === selectedNote.id)
                    if (idx < allNotes.length - 1) window.location.href = `/dialect-notes?note=${allNotes[idx + 1].id}`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function NavBtn({ label, right, disabled, onClick }: {
  label: string
  right?: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 px-3 py-1.5 text-xs font-mono border border-border hover:bg-hover disabled:opacity-50 transition-fast"
    >
      {!right && <span className="text-[10px]">←</span>}
      {label}
      {right && <span className="text-[10px]">→</span>}
    </button>
  )
}
