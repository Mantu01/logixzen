import { IpcMainInvokeEvent, ipcMain } from 'electron'

export class MenuHandler {
  constructor(private ipc: typeof ipcMain) {}

  register(): void {
    this.ipc.handle('menu:importDatabase', (_event: IpcMainInvokeEvent): void => {
      // Triggered by menu, handled by dialog handler
    })

    this.ipc.handle('menu:importQuestions', (_event: IpcMainInvokeEvent): void => {
      // Triggered by menu
    })

    this.ipc.handle('menu:exportProgress', (_event: IpcMainInvokeEvent): void => {
      // Triggered by menu
    })

    this.ipc.handle('menu:resetDatabase', (_event: IpcMainInvokeEvent): void => {
      // Triggered by menu
    })

    this.ipc.handle('menu:openSettings', (_event: IpcMainInvokeEvent): void => {
      // Navigate to settings page
    })
  }
}
