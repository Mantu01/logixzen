import { IpcMainInvokeEvent, ipcMain } from 'electron'
import Store from 'electron-store'

interface StorageStoreSchema {
  settings: Record<string, unknown>
  progress: Record<string, unknown>
  cache: Record<string, unknown>
}

const store = new Store<StorageStoreSchema>({
  name: 'logixzen-data',
  encryptionKey: process.env.ENCRYPTION_KEY ?? '',
})

export class StorageHandler {
  constructor(private ipc: typeof ipcMain) {}

  register(): void {
    this.ipc.handle('storage:get', (_event: IpcMainInvokeEvent, key: string): unknown => {
      return store.get(key)
    })

    this.ipc.handle('storage:set', (_event: IpcMainInvokeEvent, key: string, value: unknown): void => {
      store.set(key, value)
    })

    this.ipc.handle('storage:remove', (_event: IpcMainInvokeEvent, key: string): void => {
      store.delete(key)
    })

    this.ipc.handle('storage:getAll', (_event: IpcMainInvokeEvent): Record<string, unknown> => {
      const all = store.store as Record<string, unknown>
      return { ...all }
    })

    this.ipc.handle('storage:clear', (_event: IpcMainInvokeEvent): void => {
      store.clear()
    })
  }
}
