import { IpcMain, ipcMain } from 'electron'
import { StorageHandler } from './storage'
import { SecretsHandler } from './secrets'
import { DatabaseHandler } from './database'
import { DialogHandler } from './fileDialogs'

export function registerIpcHandlers(ipc: IpcMain): void {
  const storage = new StorageHandler(ipc)
  const secrets = new SecretsHandler(ipc)
  const database = new DatabaseHandler(ipc)
  const dialogs = new DialogHandler(ipc)

  storage.register()
  secrets.register()
  database.register()
  dialogs.register()
}
