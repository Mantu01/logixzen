'use client'

import { useState, useCallback, useRef } from 'react'
import { Upload, X, Download, FileText, Database, HelpCircle, Copy } from 'lucide-react'
import { useImportManager } from '@/features/import/useImportManager'
import { ValidationReport } from './ValidationReport'
import type { ValidationResult } from '@logixzen/shared/content'
import type { ImportSource, ImportTarget } from '@/features/import/validation'

const SOURCE_OPTIONS: { id: ImportSource; label: string; description: string; accept: string }[] = [
  { id: 'sql-file', label: 'SQL File', description: '.sql, .txt', accept: '.sql,.txt' },
  { id: 'csv-file', label: 'CSV File', description: '.csv', accept: '.csv' },
  { id: 'sqlite-file', label: 'SQLite DB', description: '.db, .sqlite', accept: '.db,.sqlite,.sqlite3' },
  { id: 'json-paste', label: 'Paste JSON', description: 'clipboard', accept: '' },
  { id: 'json-file', label: 'JSON File', description: '.json', accept: '.json' },
]

const TARGET_OPTIONS: { id: ImportTarget; label: string; description: string }[] = [
  { id: 'database', label: 'Database', description: 'Load into local SQLite' },
  { id: 'progress', label: 'Progress', description: 'Restore practice progress' },
  { id: 'questions', label: 'Questions', description: 'Import question sets' },
]

const TEMPLATE_PROMPTS = {
  database: `Generate a complete LogixZen database schema JSON. It must include:
- "id": unique dataset identifier
- "name": human-readable name
- "description": brief description
- "setupSql": all CREATE TABLE and INSERT statements as a single SQL string
- "tables": array of table metadata (name, columns with name/type/primaryKey/description, foreignKey references)

Example snippet for relationships:
"columns": [
  {"name": "id", "type": "INTEGER", "primaryKey": true},
  {"name": "user_id", "type": "INTEGER", "foreignKey": {"table": "users", "column": "id"}}
]`,
  questions: `Generate a LogixZen questions JSON for a topic. Include an array of questions like:
[
  {
    "id": "q001",
    "topicId": "select-basics",
    "type": "query",
    "difficulty": "easy",
    "title": "Find all users",
    "description": "Select all records from users",
    "datasetId": "my_dataset",
    "hints": ["Use SELECT *", "FROM the right table"],
    "explanation": "Basic SELECT query",
    "tags": ["select", "basic"],
    "points": 10,
    "solutionSql": "SELECT * FROM users",
    "testCases": [{"id": "tc1", "description": "Returns all rows", "expected": {"type": "fromSolution"}, "hidden": false}]
  }
]`,
  notes: `Generate LogixZen dialect notes JSON array with entries like:
[
  {
    "id": "case-sensitivity",
    "dialect": "postgresql",
    "title": "Identifier Case Sensitivity",
    "summary": "PostgreSQL lowercases unquoted identifiers.",
    "content": "Double quotes preserve case...",
    "tags": ["identifiers", "case"],
    "examples": [{"description": "Quoted vs unquoted", "query": "SELECT \"MyCol\" FROM my_table"}]
  }
]`
} as const

export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }): React.ReactElement | null {
  const [source, setSource] = useState<ImportSource>('json-file')
  const [target, setTarget] = useState<ImportTarget>('database')
  const [content, setContent] = useState('')
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [importResult, setImportResult] = useState<{ success: boolean; importedItems: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [showTemplate, setShowTemplate] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { importFile, importPaste, isImporting } = useImportManager({
    onImport: (result) => {
      setImportResult({ success: result.success, importedItems: result.importedItems })
      setValidation(result.validation)
    },
  })

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const result = await importFile(source, target, file)
    setValidation(result.validation)
    setImportResult({ success: result.success, importedItems: result.importedItems })
  }, [source, target, importFile])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const result = await importFile(source, target, file)
    setValidation(result.validation)
    setImportResult({ success: result.success, importedItems: result.importedItems })
  }, [source, target, importFile])

  const handleValidate = useCallback(() => {
    import('@/features/import/validation').then(({ validateContent }) => {
      setValidation(validateContent(source, target, content))
    })
  }, [source, target, content])

  const handleRunImport = useCallback(async () => {
    const result = await importPaste(source, target, content)
    setImportResult({ success: result.success, importedItems: result.importedItems })
  }, [source, target, importPaste, content])

  const downloadTemplate = (format: 'database' | 'questions' | 'notes') => {
    const skeletons: Record<string, string> = {
      database: JSON.stringify({
        version: 2,
        datasets: [
          {
            id: 'my_database',
            name: 'My Database',
            description: 'A sample database for learning SQL',
            setupSql: `CREATE TABLE users (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL,\n  email TEXT UNIQUE\n);\n\nINSERT INTO users (name, email) VALUES ('Alice', 'alice@example.com');`,
            tables: [
              {
                name: 'users',
                description: 'Application users',
                columns: [
                  { name: 'id', type: 'INTEGER', primaryKey: true, description: 'Unique user ID' },
                  { name: 'name', type: 'TEXT', notNull: true, description: 'Full name' },
                  { name: 'email', type: 'TEXT', unique: true, description: 'Email address' }
                ]
              }
            ]
          }
        ]
      }, null, 2),
      questions: JSON.stringify({
        version: 2,
        topics: [
          { id: 'select-basics', title: 'SELECT Basics', description: 'Learn fundamental SELECT queries' }
        ],
        questions: [
          {
            id: 'q001',
            topicId: 'select-basics',
            type: 'query',
            difficulty: 'easy',
            title: 'Select All Users',
            description: 'Write a query to select all columns from the users table.',
            datasetId: 'my_database',
            hints: ['Use the SELECT keyword', 'Specify * for all columns'],
            explanation: 'A basic SELECT query retrieves all columns from a table.',
            tags: ['select', 'basics'],
            points: 10,
            solutionSql: 'SELECT * FROM users',
            testCases: [
              {
                id: 'tc1',
                description: 'Returns all rows and columns',
                expected: { type: 'fromSolution' },
                hidden: false
              }
            ]
          }
        ]
      }, null, 2),
      notes: JSON.stringify({
        version: 2,
        notes: [
          {
            id: 'select-distinct',
            dialect: 'all',
            title: 'DISTINCT Keyword',
            summary: 'Remove duplicate rows from query results.',
            content: 'The DISTINCT keyword eliminates duplicate rows from the result set. Use it after SELECT to get only unique values.\n\n```sql\nSELECT DISTINCT department FROM employees;\n```',
            tags: ['select', 'distinct'],
            examples: [
              {
                description: 'Get unique departments',
                query: 'SELECT DISTINCT department FROM employees'
              }
            ]
          }
        ]
      }, null, 2)
    }

    const blob = new Blob([skeletons[format]], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const names: Record<string, string> = { database: 'schema-template.json', questions: 'questions-template.json', notes: 'notes-template.json' }
    a.download = names[format]
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyPrompt = useCallback((key: 'database' | 'questions' | 'notes') => {
    navigator.clipboard.writeText(TEMPLATE_PROMPTS[key])
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }, [])

  const currentPrompt = TEMPLATE_PROMPTS[target === 'database' ? 'database' : target === 'questions' ? 'questions' : 'notes'] as string

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-primary border border-border-strong w-full max-w-xl mx-4 max-h-[90vh] overflow-auto rounded-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-primary z-10">
          <div className="flex items-center gap-2">
            <Upload size={16} className="text-accent" />
            <span className="font-mono text-sm font-semibold">Import Data</span>
          </div>
          <button onClick={onClose} className="text-muted hover-text transition-fast"><X size={16} /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Source + Target row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono text-muted mb-1.5 block">Source</label>
              <select value={source} onChange={e => setSource(e.target.value as ImportSource)} className="input w-full text-xs font-mono">
                {SOURCE_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-mono text-muted mb-1.5 block">Target</label>
              <select value={target} onChange={e => setTarget(e.target.value as ImportTarget)} className="input w-full text-xs font-mono">
                {TARGET_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {/* Template section */}
          <div className="border border-border p-3 bg-secondary">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle size={14} className="text-accent" />
              <span className="text-xs font-mono font-semibold text-muted uppercase tracking-wider">Download Templates</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => downloadTemplate('database')} className="btn btn-default btn-xs flex items-center gap-1">
                <Download size={11} /> Schema JSON
              </button>
              <button onClick={() => downloadTemplate('questions')} className="btn btn-default btn-xs flex items-center gap-1">
                <Download size={11} /> Questions JSON
              </button>
              <button onClick={() => downloadTemplate('notes')} className="btn btn-default btn-xs flex items-center gap-1">
                <Download size={11} /> Notes JSON
              </button>
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-mono text-muted">AI Prompt:</span>
                <button onClick={() => copyPrompt(target === 'database' ? 'database' : target === 'questions' ? 'questions' : 'notes')} className="btn btn-ghost btn-xs flex items-center gap-1">
                  <Copy size={11} />{copied === (target === 'database' ? 'database' : target === 'questions' ? 'questions' : 'notes') ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="text-[10px] font-mono text-muted whitespace-pre-wrap break-all bg-base p-2 border border-border max-h-24 overflow-auto">
                {currentPrompt.slice(0, 400)}...
              </pre>
            </div>
          </div>

          {/* Drop zone or textarea */}
          {source !== 'json-paste' ? (
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed p-6 text-center cursor-pointer transition-fast ${isDragging ? 'border-accent bg-accent-dim' : 'border-border hover:border-border-strong'}`}
            >
              <input ref={fileInputRef} type="file" accept={SOURCE_OPTIONS.find(o => o.id === source)?.accept ?? ''} onChange={handleFileSelect} className="hidden" />
              <Database size={24} className="mx-auto mb-2 opacity-40 text-muted" />
              <div className="text-xs font-mono text-muted">
                {isDragging ? 'Drop file here' : `Drop or click to select (${SOURCE_OPTIONS.find(o => o.id === source)?.description})`}
              </div>
            </div>
          ) : (
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Paste your JSON here..."
              className="input w-full h-32 text-xs font-mono resize-none"
            />
          )}

          {/* Validation */}
          {validation && <ValidationReport result={validation} />}

          {/* Import result */}
          {importResult && (
            <div className={`p-2 text-xs font-mono ${importResult.success ? 'bg-success-dim text-success' : 'bg-error-dim text-error'}`}>
              {importResult.success
                ? `✓ Imported ${importResult.importedItems} item(s)`
                : 'Import failed — check validation above'}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {source === 'json-paste' && content.length > 0 && (
              <button onClick={handleValidate} disabled={isImporting} className="btn btn-default btn-sm flex-1">Validate</button>
            )}
            <button
              onClick={handleRunImport}
              disabled={(source === 'json-paste' && !content) || isImporting}
              className="btn btn-primary btn-sm flex-1 flex items-center justify-center gap-1.5"
            >
              {isImporting
                ? <><span className="inline-block w-3 h-3 border border-t-transparent rounded-full border-current animate-spin" /> Importing...</>
                : <><Download size={14} /> Import</>}
            </button>
            <button onClick={onClose} className="btn btn-default btn-sm">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}
