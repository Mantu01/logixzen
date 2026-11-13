export interface Column {
  name: string
  type: string
  nullable: boolean
  description?: string
}

export interface Table {
  name: string
  columns: Column[]
  description?: string
  rowLimit?: number
}

export interface Dataset {
  id: string
  name: string
  description: string
  tables: Table[]
  setupSql: string
}
