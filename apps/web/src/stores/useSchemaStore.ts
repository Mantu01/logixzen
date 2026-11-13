import { create } from 'zustand'
import type { TableInfo, ColumnInfo } from '@logixzen/shared/sql-engine'
import type { ForeignKeyRel } from '@/components/schema/SchemaDiagram'

interface SchemaState {
  selectedTable: string | null
  searchQuery: string
  expandedTables: Set<string>
  activeTab: 'explorer' | 'diagram'
}

interface SchemaActions {
  setSelectedTable: (name: string | null) => void
  setSearchQuery: (query: string) => void
  toggleTable: (name: string) => void
  setActiveTab: (tab: 'explorer' | 'diagram') => void
}

type SchemaStore = SchemaState & SchemaActions

export const useSchemaStore = create<SchemaStore>()((set, get) => ({
  selectedTable: null,
  searchQuery: '',
  expandedTables: new Set(),
  activeTab: 'explorer',

  setSelectedTable: (name) => set({ selectedTable: name }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleTable: (name) => {
    const { expandedTables } = get()
    const next = new Set(expandedTables)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    set({ expandedTables: next })
  },
  setActiveTab: (tab) => set({ activeTab: tab }),
}))

export function inferRelations(tables: TableInfo[]): ForeignKeyRel[] {
  const rels: ForeignKeyRel[] = []
  const seen = new Set<string>()
  for (const t of tables) {
    for (const col of t.columns) {
      const c = col.name.toLowerCase()
      if (!c.endsWith('_id')) continue
      const refTable = c.slice(0, -3)
      const other = tables.find(o => o.name.toLowerCase() === refTable)
      if (!other) continue
      const hasId = other.columns.some(fc => fc.name.toLowerCase() === 'id' && fc.primaryKey)
      if (!hasId) continue
      const key = `${t.name}.${col.name}→${other.name}.id`
      if (seen.has(key)) continue
      seen.add(key)
      rels.push({ fromTable: t.name, fromColumn: col.name, toTable: other.name, toColumn: 'id' })
    }
  }
  return rels
}
