'use client'

import { useState, useEffect, useCallback } from 'react'
import type { TableInfo } from '@logixzen/shared/sql-engine'

interface NodePos { x: number; y: number }

export interface ForeignKeyRel {
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
}

const TW = 200
const TH = 32
const HH = 36
const GRID = 20

function snap(v: number) { return Math.round(v / GRID) * GRID }

function layoutTables(tables: TableInfo[]): NodePos[] {
  const n = tables.length
  if (n === 0) return []
  const H = window.innerHeight - 180
  const W = window.innerWidth - 220
  const cols = Math.ceil(Math.sqrt(n * W / (TW + 28)))
  const rows = Math.ceil(n / cols)
  const sx = Math.max(28, Math.floor((W - cols * (TW + 28)) / 2))
  const sy = Math.max(28, Math.floor((H - rows * (TH + HH + 20)) / 2))
  return tables.map((_, i) => {
    const c = i % cols
    const r = Math.floor(i / cols)
    return { x: snap(sx + c * (TW + 28)), y: snap(sy + r * (TH + HH + 20)) }
  })
}

function edgePts(
  fx: number, fy: number, tx: number, ty: number,
  tw: number, th: number
): { sx: number; sy: number; ex: number; ey: number; cx1: number; cy1: number; cx2: number; cy2: number } {
  const dx = tx - fx
  const dy = ty - fy
  let sx = fx
  let sy = fy
  let ex = tx
  let ey = ty
  if (Math.abs(dx) * th > Math.abs(dy) * tw) {
    sx = dx > 0 ? tx - tw / 2 : tx + tw / 2
    ex = dx > 0 ? fx + tw / 2 : fx - tw / 2
  } else {
    sy = dy > 0 ? ty - th / 2 : ty + th / 2
    ey = dy > 0 ? fy - th / 2 : fy + th / 2
  }
  const kx = (ex - sx) !== 0 ? (ey - sy) / (ex - sx) * 0.35 : 0
  const ky = (ey - sy) !== 0 ? (ex - sx) / (ey - sy) * 0.35 : 0
  return { sx, sy, ex, ey, cx1: sx + kx * (ex - sx), cy1: sy + ky * (ey - sy), cx2: ex - kx * (ex - sx), cy2: ey - ky * (ey - sy) }
}

/* ---- Component ---- */

interface Props {
  tables: TableInfo[]
  relations?: ForeignKeyRel[]
}

export default function SchemaDiagram({ tables, relations }: Props): React.ReactElement {
  const [positions, setPositions] = useState<NodePos[]>(() => layoutTables(tables))
  const [dragging, setDragging] = useState<{ idx: number; ox: number; oy: number } | null>(null)
  const [hoveredConn, setHoveredConn] = useState<string | null>(null)

  const tableH = () => Math.max(TH + HH + 5, TH + HH + Math.max(0, ...tables.map(t => t.columns.length)))

  const posMap = new Map<string, NodePos>()
  tables.forEach((t, i) => { if (positions[i]) posMap.set(t.name, positions[i]) })

  const handleMouseDown = useCallback((e: React.MouseEvent, idx: number) => {
    e.preventDefault()
    setDragging({ idx, ox: e.clientX - positions[idx].x, oy: e.clientY - positions[idx].y })
  }, [positions])

  useEffect(() => {
    if (!dragging) return
    const move = (e: MouseEvent) => {
      setPositions(prev => prev.map((p, i) => i === dragging.idx ? { x: snap(e.clientX - dragging.ox), y: snap(e.clientY - dragging.oy) } : p))
    }
    const up = () => setDragging(null)
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
    return () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
  }, [dragging])

  // Recompute initial layout when tables change
  useEffect(() => {
    setPositions(layoutTables(tables))
  }, [tables])

  if (tables.length === 0) {
    return <div className="flex items-center justify-center h-48 text-xs font-mono text-muted">No tables to diagram</div>
  }

  const th = tableH()

  return (
    <div className="relative w-full h-[520px] overflow-auto bg-base border border-border rounded-sm">
      <svg
        className="absolute inset-0"
        style={{ width: 'max-content', height: Math.max(500, positions.length ? Math.max(...positions.map(p => p.y)) + th + 60 : 500) }}
      >
        <defs>
          <marker id="arr-fk" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,1 L10,5 L0,9 Z" fill="#f59e0b" /></marker>
          <marker id="arr-pk" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,1 L10,5 L0,9 Z" fill="#10b981" /></marker>
        </defs>

        {/* Relations */}
        {(relations ?? []).map((rel, ri) => {
          const fp = posMap.get(rel.fromTable)
          const tp = posMap.get(rel.toTable)
          if (!fp || !tp) return null
          const ft = tables.find(t => t.name === rel.fromTable)
          const tt = tables.find(t => t.name === rel.toTable)
          if (!ft || !tt) return null
          const fcIdx = ft.columns.findIndex(c => c.name === rel.fromColumn)
          const tcIdx = tt.columns.findIndex(c => c.name === rel.toColumn)
          const fy = fp.y + HH + Math.max(0, fcIdx) * TH + TH / 2
          const ty = tp.y + HH + Math.max(0, tcIdx) * TH + TH / 2
          const px1 = fp.x + tableW / 2
          const px2 = tp.x + tableW / 2
          const pt = edgePts(px1, fy, px2, ty, tableW, th)
          const key = `${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`
          const h = hoveredConn === key
          return (
            <g key={ri}>
              <path d={`M${pt.sx},${pt.sy} C${pt.cx1},${pt.cy1} ${pt.cx2},${pt.cy2} ${pt.ex},${pt.ey}`}
                fill="none" stroke={h ? '#22d3ee' : '#374151'} strokeWidth={h ? 2 : 1.2}
                markerEnd="url(#arr-fk)" opacity={h ? 1 : 0.7} />
              <rect x={(pt.sx + pt.ex) / 2 - 30} y={(pt.sy + pt.ey) / 2 - 9} width="60" height="18"
                fill="#0f172a" stroke={h ? '#22d3ee' : '#374151'} strokeWidth={1} />
              <text x={(pt.sx + pt.ex) / 2} y={(pt.sy + pt.ey) / 2 + 4} textAnchor="middle"
                fill={h ? '#22d3ee' : '#9ca3af'} fontSize="9" fontFamily="monospace">FK</text>
              {/* Hover zones around lines */}
              <line x1={pt.sx} y1={pt.sy} x2={pt.ex} y2={pt.ey} stroke="transparent" strokeWidth="12"
                onMouseEnter={() => setHoveredConn(key)} onMouseLeave={() => setHoveredConn(null)} style={{ cursor: 'pointer' }} />
            </g>
          )
        })}

        {/* Tables */}
        {tables.map((table, i) => {
          const p = positions[i]
          if (!p) return null
          return (
            <g key={table.name}>
              {/* Card background */}
              <rect x={p.x} y={p.y} width={tableW} height={th} fill="#0f172a" stroke="#374151" strokeWidth={1} />
              {/* Header */}
              <rect x={p.x} y={p.y} width={tableW} height={HH} fill="#1e293b" />
              <line x1={p.x} y1={p.y + HH} x2={p.x + tableW} y2={p.y + HH} stroke="#374151" strokeWidth={1} />
              <text x={p.x + 8} y={p.y + HH / 2 + 4} fill="#e2e8f0" fontSize="11" fontWeight="bold" fontFamily="monospace">{table.name}</text>
              <text x={p.x + tableW - 8} y={p.y + HH / 2 + 3} fill="#6b7280" fontSize="9" fontFamily="monospace" textAnchor="end">{table.columns.length}</text>
              {/* Column rows */}
              {table.columns.map((col, ci) => {
                const cy = p.y + HH + ci * TH
                const isPk = col.primaryKey
                const hasFk = Boolean((col as unknown as { foreignKey?: { table: string; column: string } }).foreignKey)
                return (
                  <g key={col.name}>
                    <line x1={p.x} y1={cy} x2={p.x + tableW} y2={cy} stroke="#1e293b" strokeWidth={1} />
                    <rect x={p.x} y={cy} width={hasFk ? 3 : isPk ? 3 : 0} height={TH} fill={isPk ? '#f59e0b' : '#22d3ee'} />
                    <text x={p.x + (isPk || hasFk ? 10 : 8)} y={cy + TH / 2 + 4}
                      fill={isPk ? '#f59e0b' : hasFk ? '#22d3ee' : '#e2e8f0'} fontSize="10" fontFamily="monospace">
                      {(isPk ? 'PK ' : '')}{(hasFk ? 'FK ' : '')}{col.name}
                    </text>
                    <text x={p.x + tableW - 8} y={cy + TH / 2 + 3} fill="#6b7280" fontSize="9" fontFamily="monospace" textAnchor="end">{col.type || 'TEXT'}</text>
                    {col.notNull && <text x={p.x + tableW - 28} y={cy + TH / 2 + 3} fill="#ef4444" fontSize="8" fontFamily="monospace" textAnchor="end">NN</text>}
                  </g>
                )
              })}
              {/* Drag handle */}
              <rect x={p.x} y={p.y} width={tableW} height={HH} fill="transparent"
                onMouseDown={e => handleMouseDown(e, i)} style={{ cursor: 'grab' }} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

const tableW = 200
