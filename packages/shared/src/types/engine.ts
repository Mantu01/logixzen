export interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowCount: number
  executionTimeMs: number
}

export interface QueryError {
  message: string
  code?: string
}

export interface EngineConfig {
  dialect: 'sqlite'
  version?: string
}

export interface EngineResponse {
  success: boolean
  result?: QueryResult
  error?: QueryError
}
