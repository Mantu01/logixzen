import { IpcMainInvokeEvent, ipcMain } from 'electron'
import type { SqlResult, SchemaInfo } from '@logixzen/shared'
import { DesktopSqlEngine } from '../sql/DesktopSqlEngine'
import { checkSafety } from '../sql/SafetyChecker'

export class DatabaseHandler {
  private engine: DesktopSqlEngine | null = null

  constructor(private ipc: typeof ipcMain) {}

  register(): void {
    this.ipc.handle('database:execute', (_event: IpcMainInvokeEvent, sql: string): SqlResult[] => {
      const safety = checkSafety(sql)
      if (!safety.safe) {
        throw new Error(`Unsafe SQL pattern detected: ${safety.violations.map(v => v.pattern).join(', ')}`)
      }

      if (this.engine === null) {
        this.engine = new DesktopSqlEngine()
        this.engine.initialize()
      }
      return this.engine.execute(sql)
    })

    this.ipc.handle('database:getSchema', (_event: IpcMainInvokeEvent): SchemaInfo => {
      if (this.engine === null) {
        throw new Error('Database not initialized')
      }
      return this.engine.getSchema()
    })

    this.ipc.handle('database:close', (): void => {
      this.engine?.close()
      this.engine = null
    })

    this.ipc.handle('database:reset', (): void => {
      this.engine?.close()
      this.engine = new DesktopSqlEngine()
      this.engine.initialize()
    })
  }
}
