import { IpcMainInvokeEvent, ipcMain, dialog, BrowserWindow } from 'electron'
import type { FileFilter } from 'electron'

export interface OpenFileOptions {
  title?: string
  filters?: FileFilter[]
  multiple?: boolean
  defaultPath?: string
}

export interface SaveFileOptions {
  title?: string
  filters?: FileFilter[]
  defaultPath?: string
  defaultExtension?: string
}

export interface OpenDirectoryOptions {
  title?: string
  defaultPath?: string
}

export class DialogHandler {
  constructor(private ipc: typeof ipcMain) {}

  register(): void {
    this.ipc.handle('dialogs:openFile', async (_event: IpcMainInvokeEvent, options?: OpenFileOptions): Promise<string | null> => {
      const window = BrowserWindow.getFocusedWindow()
      if (window === null) {
        return null
      }

      const result = await dialog.showOpenDialog(window, {
        title: options?.title,
        filters: options?.filters ?? [
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: options?.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
        defaultPath: options?.defaultPath,
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }
      return result.filePaths[0]
    })

    this.ipc.handle('dialogs:openFiles', async (_event: IpcMainInvokeEvent, options?: OpenFileOptions): Promise<string[] | null> => {
      const window = BrowserWindow.getFocusedWindow()
      if (window === null) {
        return null
      }

      const result = await dialog.showOpenDialog(window, {
        title: options?.title,
        filters: options?.filters ?? [
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['openFile', 'multiSelections'],
        defaultPath: options?.defaultPath,
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }
      return result.filePaths
    })

    this.ipc.handle('dialogs:saveFile', async (_event: IpcMainInvokeEvent, options?: SaveFileOptions): Promise<string | null> => {
      const window = BrowserWindow.getFocusedWindow()
      if (window === null) {
        return null
      }

      const result = await dialog.showSaveDialog(window, {
        title: options?.title,
        filters: options?.filters ?? [
          { name: 'All Files', extensions: ['*'] },
        ],
        defaultPath: options?.defaultPath,
        defaultExtension: options?.defaultExtension,
      })

      if (result.canceled || result.filePath === undefined) {
        return null
      }
      return result.filePath
    })

    this.ipc.handle('dialogs:openDirectory', async (_event: IpcMainInvokeEvent, options?: OpenDirectoryOptions): Promise<string | null> => {
      const window = BrowserWindow.getFocusedWindow()
      if (window === null) {
        return null
      }

      const result = await dialog.showOpenDialog(window, {
        title: options?.title,
        properties: ['openDirectory'],
        defaultPath: options?.defaultPath,
      })

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }
      return result.filePaths[0]
    })
  }
}
