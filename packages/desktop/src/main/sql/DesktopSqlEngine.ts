import Database from 'better-sqlite3'
import type { SqlEngine, SqlResult, SqlRow, SchemaInfo } from '@logixzen/shared'
import { splitStatements } from '@logixzen/shared/sql-engine/statementSplitter'
import { translateError } from './ErrorTranslator'

interface TableSchema {
  name: string
  columns: ColumnInfo[]
  sampleData: SqlRow[][]
  primaryKey?: string[]
}

interface ColumnInfo {
  cid: number
  name: string
  type: string
  notNull: boolean
  defaultValue: unknown
  primaryKey: boolean
}

const MAX_ROWS = 1000
const SAMPLE_LIMIT = 5

export class DesktopSqlEngine implements SqlEngine {
  private db: Database.Database | null = null

  initialize(setupSql?: string): void {
    this.db = new Database.Database(':memory:')
    this.db.pragma('journal_mode = WAL')

    if (setupSql !== undefined) {
      this.executeSetup(setupSql)
    }
  }

  execute(sql: string): SqlResult[] {
    if (this.db === null) {
      throw new Error('Database not initialized')
    }

    const statements = splitStatements(sql)
    const results: SqlResult[] = []

    for (const statement of statements) {
      const startTime = performance.now()

      try {
        const isSelect = this.isSelectStatement(statement.sql)

        if (isSelect) {
          const result = this.executeSelect(statement.sql, statement.index)
          result.executionTimeMs = performance.now() - startTime
          results.push(result)
        } else {
          const result = this.executeNonSelect(statement.sql, statement.index)
          result.executionTimeMs = performance.now() - startTime
          results.push(result)
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

  getSchema(): SchemaInfo {
    if (this.db === null) {
      throw new Error('Database not initialized')
    }

    const tables = this.getTables()
    const tableDetails: TableSchema[] = []

    for (const tableName of tables) {
      const columns = this.getTableColumns(tableName)
      const sampleRows = this.getSampleRows(tableName, SAMPLE_LIMIT)
      const primaryKey = this.getPrimaryKey(tableName)

      tableDetails.push({
        name: tableName,
        columns,
        sampleData: sampleRows,
        primaryKey,
      })
    }

    return { tables: tableDetails }
  }

  close(): void {
    if (this.db !== null) {
      this.db.close()
      this.db = null
    }
  }

  serialize(): Buffer {
    if (this.db === null) {
      throw new Error('Database not initialized')
    }
    return this.db.serialize()
  }

  deserialize(data: Buffer): void {
    if (this.db !== null) {
      this.close()
    }
    this.db = new Database.Database(data)
  }

  private executeSelect(sql: string, index: number): SqlResult {
    if (this.db === null) {
      throw new Error('Database not initialized')
    }

    const stmt = this.db.prepare(sql)
    const info = stmt.info
    const columns = info.columns ?? []
    const rows: SqlRow[][] = []

    for (const row of stmt.iterate()) {
      if (rows.length >= MAX_ROWS) {
        break
      }
      rows.push(this.mapRow(row, columns))
    }

    return {
      columns,
      rows,
      rowsAffected: 0,
      statementIndex: index,
      isSelect: true,
      executionTimeMs: 0,
    }
  }

  private executeNonSelect(sql: string, index: number): SqlResult {
    if (this.db === null) {
      throw new Error('Database not initialized')
    }

    this.db.exec(sql)
    const changes = this.db.prepare('SELECT changes()').get() as Record<string, number>

    return {
      columns: [],
      rows: [],
      rowsAffected: changes?.changes ?? 0,
      statementIndex: index,
      isSelect: false,
      executionTimeMs: 0,
    }
  }

  private mapRow(row: Record<string, unknown>, columns: string[]): SqlRow {
    const result: SqlRow = []
    for (const col of columns) {
      result.push(row[col] ?? null)
    }
    return result
  }

  private isSelectStatement(sql: string): boolean {
    const trimmed = sql.trim().toUpperCase()
    return (
      trimmed.startsWith('SELECT') ||
      trimmed.startsWith('WITH') ||
      trimmed.startsWith('VALUES') ||
      trimmed.startsWith('PRAGMA')
    )
  }

  private getTables(): string[] {
    if (this.db === null) {
      throw new Error('Database not initialized')
    }

    const rows = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all() as Array<{ name: string }>

    return rows.map(row => row.name)
  }

  private getTableColumns(tableName: string): ColumnInfo[] {
    if (this.db === null) {
      throw new Error('Database not initialized')
    }

    const quotedName = this.quoteIdentifier(tableName)
    const rows = this.db.prepare(`PRAGMA table_info(${quotedName})`).all() as Array<{
      cid: number
      name: string
      type: string
      notnull: number
      dflt_value: unknown
      pk: number
    }>

    return rows.map(row => ({
      cid: row.cid,
      name: row.name,
      type: row.type,
      notNull: row.notnull === 1,
      defaultValue: row.dflt_value,
      primaryKey: row.pk !== 0,
    }))
  }

  private getSampleRows(tableName: string, limit: number): SqlRow[][] {
    if (this.db === null) {
      throw new Error('Database not initialized')
    }

    const quotedName = this.quoteIdentifier(tableName)
    const stmt = this.db.prepare(`SELECT * FROM ${quotedName} LIMIT ?`)
    return stmt.all(limit) as SqlRow[][]
  }

  private getPrimaryKey(tableName: string): string[] | undefined {
    if (this.db === null) {
      throw new Error('Database not initialized')
    }

    const columns = this.getTableColumns(tableName)
    const primaryKeys = columns
      .filter(col => col.primaryKey)
      .map(col => col.name)

    return primaryKeys.length > 0 ? primaryKeys : undefined
  }

  private executeSetup(sql: string): void {
    if (this.db === null) {
      throw new Error('Database not initialized')
    }

    const statements = splitStatements(sql)
    const transaction = this.db.transaction((stmts) => {
      for (const stmt of stmts) {
        this.db!.exec(stmt.sql)
      }
    })
    transaction(statements)
  }

  private quoteIdentifier(name: string): string {
    return `"${name.replace(/"/g, '""')}"`
  }
}
