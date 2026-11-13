import * as SQLite from 'expo-sqlite'
import type { SqlResult, TableInfo, ColumnInfo, SqlRow } from '@logixzen/shared/sql-engine'
import { splitStatements } from '@logixzen/shared/sql-engine/statementSplitter'
import { translateError, isSafeStatement } from './ErrorTranslator'

const MAX_ROWS = 1000

export class ExpoSqlEngine {
  private db: SQLite.SQLiteDatabase | null = null
  private readonly maxRows: number = MAX_ROWS

  async initialize(setupSql?: string): Promise<void> {
    this.db = SQLite.openDatabaseSync(':memory:')
    if (setupSql !== undefined) {
      await this.executeSetup(setupSql)
    }
  }

  async execute(sql: string): Promise<SqlResult[]> {
    if (this.db === null) {
      throw new Error('Database not initialized')
    }
    if (!isSafeStatement(sql)) {
      throw new Error('This statement is not allowed for safety reasons')
    }
    const statements = splitStatements(sql)
    const results: SqlResult[] = []
    for (const statement of statements) {
      const startTime = Date.now()
      try {
        if (this.isSelectStatement(statement.sql)) {
          const result = await this.executeSelect(statement.sql, statement.index)
          result.executionTimeMs = Date.now() - startTime
          results.push(result)
        } else {
          const result = await this.executeNonSelect(statement.sql, statement.index)
          result.executionTimeMs = Date.now() - startTime
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

  async getSchema(): Promise<TableInfo[]> {
    if (this.db === null) {
      throw new Error('Database not initialized')
    }
    const tables = await this.getTables()
    const tableDetails = await Promise.all(
      tables.map(async (tableName) => ({
        name: tableName,
        columns: await this.getTableColumns(tableName),
        sampleRows: await this.getSampleRows(tableName, 5),
        primaryKey: await this.getPrimaryKey(tableName),
      }))
    )
    return tableDetails
  }

  async close(): Promise<void> {
    if (this.db !== null) {
      await this.db.closeAsync()
      this.db = null
    }
  }

  getDatabase(): SQLite.SQLiteDatabase | null {
    return this.db
  }

  private async executeSelect(sql: string, index: number): Promise<SqlResult> {
    const rows = (await this.db!.getAllAsync(sql)) as SqlRow[]
    const columns = rows.length > 0 ? Object.keys(rows[0]) : []
    return {
      columns,
      rows: rows.slice(0, this.maxRows),
      rowsAffected: 0,
      statementIndex: index,
      isSelect: true,
      executionTimeMs: 0,
    }
  }

  private async executeNonSelect(sql: string, index: number): Promise<SqlResult> {
    await this.db!.execAsync(sql)
    const changesResult = await this.db!.getFirstAsync<{ changes: number }>('SELECT changes()')
    const rowsAffected = changesResult?.changes ?? 0
    return {
      columns: [],
      rows: [],
      rowsAffected,
      statementIndex: index,
      isSelect: false,
      executionTimeMs: 0,
    }
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

  private async getTables(): Promise<string[]> {
    const result = await this.db!.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    return result.map((row) => row.name)
  }

  private async getTableColumns(tableName: string): Promise<ColumnInfo[]> {
    const resolved = await this.db!.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type=? AND name=?", ['table', tableName])
    if (!resolved) return []
    const cols = await this.db!.getAllAsync<ColumnInfo>(`PRAGMA table_info("${resolved.name}")`)
    return cols
  }

  private async getSampleRows(tableName: string, limit: number): Promise<SqlRow[]> {
    const resolved = await this.db!.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type=? AND name=?", ['table', tableName])
    if (!resolved) return []
    const rows = (await this.db!.getAllAsync(`SELECT * FROM "${resolved.name}" LIMIT ${limit}`)) as SqlRow[]
    return rows
  }

  private async getPrimaryKey(tableName: string): Promise<string[] | undefined> {
    const columns = await this.getTableColumns(tableName)
    const primaryKeys = columns.filter((col) => col.primaryKey).map((col) => col.name)
    return primaryKeys.length > 0 ? primaryKeys : undefined
  }

  private async executeSetup(sql: string): Promise<void> {
    const statements = splitStatements(sql)
    await this.db!.execAsync(statements.map((s) => s.sql).join('\n'))
  }
}
