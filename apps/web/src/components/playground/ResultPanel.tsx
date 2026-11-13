'use client'

import { useState, useCallback } from 'react'
import type { SqlResult } from '@logixzen/shared/sql-engine'
import { ArrowDown, ArrowUp, ClipboardCopy, Download } from 'lucide-react'

interface Props {
  results: SqlResult[]
}

type SortDir = 'asc' | 'desc' | null

export default function ResultPanel({ results }: Props): React.ReactElement {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortD, setSortD] = useState<SortDir>(null)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const size = 50

  const result = [...results].reverse().find(r => r.isSelect) ?? results[results.length - 1]

  if (!result || result.error) {
    return (
      <div className="p-3 text-xs font-mono text-error bg-error-dim border-l-2 border-error">
        {result?.error ?? 'No results'}
      </div>
    )
  }

  if (result.rows.length === 0 && result.rowsAffected !== undefined && result.rowsAffected > 0) {
    return (
      <div className="p-3 text-xs font-mono text-success bg-success-dim border-l-2 border-success">
        {' '} rows affected
      </div>
    )
  }

  if (!result.columns || result.columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-muted font-mono bg-secondary">
        No columns — non-SELECT statement
      </div>
    )
  }

  const cols = result.columns
  const allRows = result.rows

  const filtered = filter
    ? allRows.filter(row => cols.some(c => String(row[c] ?? '').toLowerCase().includes(filter.toLowerCase())))
    : allRows

  const sorted = sortCol && sortD
    ? [...filtered].sort((a, b) => {
        const x = a[sortCol]
        const y = b[sortCol]
        if (x === y) return 0
        if (x == null) return 1
        if (y == null) return -1
        const c = String(x).localeCompare(String(y))
        return sortD === 'asc' ? c : -c
      })
    : filtered

  const totalPages = Math.ceil(sorted.length / size)
  const rows = sorted.slice((page - 1) * size, page * size)

  const handleSort = (col: string) => {
    if (sortCol === col) {
      if (sortD === 'asc') setSortD('desc')
      else { setSortCol(null); setSortD(null) }
    } else {
      setSortCol(col)
      setSortD('asc')
    }
    setPage(1)
  }

  const execTime = result.executionTimeMs ? `${result.executionTimeMs.toFixed(2)}ms` : null

  const doCopy = () => {
    if (!cols.length) return
    const header = `| ${cols.join(' | ')} |`
    const sep = `| ${cols.map(() => '---').join(' | ')} |`
    const dataRows = rows.map(r => `| ${cols.map(c => String(r[c] ?? '')).join(' | ')} |`)
    navigator.clipboard.writeText([header, sep, ...dataRows].join('\n'))
  }

  const doCsv = () => {
    if (!cols.length) return
    const csv = [cols.join(','), ...rows.map(r => cols.map(c => `"${String(r[c] ?? '')}"`).join(','))]
    download(new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8' }), 'result.csv')
  }

  const doJson = () => {
    download(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }), 'result.json')
  }

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}-${Date.now()}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-secondary shrink-0">
        <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted">Results</span>
        <span className="text-[10px] text-muted font-mono">{sorted.length} rows</span>
        {execTime && <span className="text-[10px] text-muted font-mono">{execTime}</span>}
        <div className="flex-1" />
        <input type="text" placeholder="Filter..." value={filter} onChange={e => { setFilter(e.target.value); setPage(1) }} className="input input-sm w-32" />
        <button onClick={doCopy} className="btn btn-ghost btn-icon" title="Copy"><ClipboardCopy size={12} /></button>
        <button onClick={doCsv} className="btn btn-ghost btn-icon" title="Export CSV"><Download size={12} /></button>
        <button onClick={doJson} className="btn btn-ghost btn-icon" title="Export JSON"><Download size={12} /></button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-8">#</th>
              {cols.map(c => (
                <th key={c} onClick={() => handleSort(c)} className="cursor-pointer hover-text transition-fast select-none">
                  <span className="flex items-center gap-1">
                    {c}
                    {sortCol === c && sortD === 'asc' && <ArrowUp size={10} />}
                    {sortCol === c && sortD === 'desc' && <ArrowDown size={10} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className="transition-fast hover-bg">
                <td className="text-muted text-[10px] opacity-60">{(page - 1) * size + idx + 1}</td>
                {cols.map(c => (
                  <td key={c} className="max-w-[200px]" title={String(row[c] ?? '')}>
                    {row[c] !== undefined && row[c] !== null ? String(row[c]) : <span className="text-muted italic">null</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-secondary shrink-0">
          <span className="text-[10px] text-muted font-mono">Page {page} of {totalPages}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} className="btn btn-default btn-xs" disabled={page === 1}>Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="btn btn-default btn-xs" disabled={page === totalPages}>Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
