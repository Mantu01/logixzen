// Web SQL Engine - SQLite via WASM
import type { SqlResult, TableInfo, ColumnInfo, SqlRow } from '@logixzen/shared/sql-engine'
import { splitStatements } from './statementSplitter'
import { translateError, isSafeStatement } from './ErrorTranslator'
import { loadSqlWasm } from './WasmLoader'

const MAX_ROWS = 1000

export class WebSqlEngine {
  private db: import('sql.js').Database | null = null
  private initialized = false

  async initialize(setupSql?: string): Promise<void> {
    if (this.initialized) return

    const SQL = await loadSqlWasm()
    this.db = new SQL.Database()
    this.initialized = true

    if (setupSql !== undefined) {
      await this.executeSetup(setupSql)
    }
  }

  async execute(sql: string): Promise<SqlResult[]> {
    if (!this.initialized) await this.initialize()
    if (!isSafeStatement(sql)) throw new Error('This statement is not allowed for safety reasons')

    const statements = splitStatements(sql)
    const results: SqlResult[] = []

    for (const statement of statements) {
      const startTime = performance.now()
      try {
        if (this.isSelectStatement(statement.sql)) {
          const result = this.executeSelect(statement.sql, statement.index)
          result.executionTimeMs = performance.now() - startTime
          results.push(result)
        } else {
          this.db!.run(statement.sql)
          const rowsAffected = this.db!.getRowsModified()
          results.push({
            columns: [],
            rows: [],
            rowsAffected,
            statementIndex: statement.index,
            isSelect: false,
            executionTimeMs: performance.now() - startTime,
          })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        results.push({
          columns: [],
          rows: [],
          rowsAffected: 0,
          error: translateError(errorMessage),
          statementIndex: statement.index,
          isSelect: false,
          executionTimeMs: 0,
        })
      }
    }

    return results
  }

  async getSchema(): Promise<TableInfo[]> {
    if (!this.initialized) await this.initialize()

    const tables = await this.getTables()
    return Promise.all(
      tables.map(async (tableName) => ({
        name: tableName,
        columns: await this.getTableColumns(tableName),
        sampleRows: await this.getSampleRows(tableName, 5),
        primaryKey: await this.getPrimaryKey(tableName),
      }))
    )
  }

  async close(): Promise<void> {
    if (this.db !== null) {
      this.db.close()
      this.db = null
      this.initialized = false
    }
  }

  serialize(): Uint8Array {
    if (this.db === null) throw new Error('Database not initialized')
    return this.db.export()
  }

  async deserialize(data: Uint8Array): Promise<void> {
    if (this.db !== null) this.db.close()
    const SQL = await loadSqlWasm()
    this.db = new SQL.Database(data)
    this.initialized = true
  }

  getDatabase(): import('sql.js').Database | null {
    return this.db
  }

  private executeSelect(sql: string, index: number): SqlResult {
    const stmt = this.db!.prepare(sql)
    const columns: string[] = stmt.getColumnNames()
    const rows: SqlRow[] = []

    while (stmt.step()) {
      const row = stmt.getAsObject() as SqlRow
      rows.push(row)
      if (rows.length >= MAX_ROWS) break
    }

    stmt.free()
    return { columns, rows, rowsAffected: 0, statementIndex: index, isSelect: true, executionTimeMs: 0 }
  }

  private isSelectStatement(sql: string): boolean {
    const trimmed = sql.trim().toUpperCase()
    return trimmed.startsWith('SELECT') || trimmed.startsWith('WITH') || trimmed.startsWith('VALUES') || trimmed.startsWith('PRAGMA')
  }

  private async getTables(): Promise<string[]> {
    const result = this.db!.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    const firstResult = result[0]
    if (!firstResult || !firstResult.values) return []
    return firstResult.values.map((row) => row[0] as string)
  }

  private async getTableColumns(tableName: string): Promise<ColumnInfo[]> {
    const result = this.db!.exec(`PRAGMA table_info("${tableName}")`)
    return (result[0]?.values ?? []).map((row) => ({
      cid: row[0] as number,
      name: row[1] as string,
      type: row[2] as string,
      notNull: Boolean(row[3] as number),
      defaultValue: row[4],
      primaryKey: Boolean(row[5] as number),
    }))
  }

  private async getSampleRows(tableName: string, limit: number): Promise<SqlRow[]> {
    const result = this.db!.exec(`SELECT * FROM "${tableName}" LIMIT ${limit}`)
    if (result.length === 0 || !result[0] || !result[0].values || result[0].values.length === 0) return []
    const columns = result[0].columns ?? []
    return result[0].values.map((row) => {
      const rowObj: SqlRow = {}
      columns.forEach((col, i) => { if (row[i] !== undefined && col) rowObj[col] = row[i] })
      return rowObj
    })
  }

  private async getPrimaryKey(tableName: string): Promise<string[] | undefined> {
    const columns = await this.getTableColumns(tableName)
    const primaryKeys = columns.filter((col) => col.primaryKey).map((col) => col.name)
    return primaryKeys.length > 0 ? primaryKeys : undefined
  }

  private async executeSetup(sql: string): Promise<void> {
    const statements = splitStatements(sql)
    statements.forEach((s) => {
      if (this.isSelectStatement(s.sql)) void this.executeSelect(s.sql, s.index)
      else this.db!.run(s.sql)
    })
  }
}
