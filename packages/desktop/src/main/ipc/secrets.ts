import { IpcMainInvokeEvent, ipcMain } from 'electron'
import keytar from 'keytar'

const SERVICE_NAME = 'com.logixzen.app'

export class SecretsHandler {
  constructor(private ipc: typeof ipcMain) {}

  register(): void {
    this.ipc.handle('secrets:get', async (_event: IpcMainInvokeEvent, key: string): Promise<string | null> => {
      try {
        const value = await keytar.getPassword(SERVICE_NAME, key)
        return value ?? null
      } catch {
        return null
      }
    })

    this.ipc.handle('secrets:set', async (_event: IpcMainInvokeEvent, key: string, value: string): Promise<void> => {
      try {
        await keytar.setPassword(SERVICE_NAME, key, value)
      } catch (error) {
        throw new Error(`Failed to store secret: ${error instanceof Error ? error.message : String(error)}`)
      }
    })

    this.ipc.handle('secrets:delete', async (_event: IpcMainInvokeEvent, key: string): Promise<void> => {
      try {
        await keytar.deletePassword(SERVICE_NAME, key)
      } catch {
        // Ignore deletion errors
      }
    })

    this.ipc.handle('secrets:clearAll', async (): Promise<void> => {
      try {
        await keytar.replacePassword(SERVICE_NAME, '', '')
      } catch {
        // Ignore clear errors
      }
    })
  }
}
