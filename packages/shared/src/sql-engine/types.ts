export interface SqlRow {
  [key: string]: unknown
}

export interface SqlResult {
  columns: string[]
  rows: SqlRow[]
  rowsAffected: number
  error?: string
  statementIndex: number
  isSelect: boolean
  executionTimeMs: number
}

export interface ColumnInfo {
  cid: number
  name: string
  type: string
  notNull: boolean
  defaultValue: unknown
  primaryKey: boolean
}

export interface TableInfo {
  name: string
  columns: ColumnInfo[]
  sampleRows: SqlRow[]
  primaryKey?: string[]
  foreignKeys: Array<{ from: string; table: string; to: string }>
}

export interface SchemaInfo {
  tables: TableInfo[]
}
