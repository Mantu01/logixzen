import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { WindowManager } from './windows/windowManager'
import { registerIpcHandlers } from './ipc'
import { MenuBuilder } from './menu/menuBuilder'
import { isDev, getAppPath } from './utils/env'

let mainWindow: BrowserWindow | null = null
let windowManager: WindowManager | null = null

function getPreloadPath(): string {
  if (isDev()) {
    return join(getAppPath(), 'packages/desktop/src/preload/index.js')
  }
  return join(__dirname, '../preload/index.js')
}

function createWindow(): void {
  windowManager = new WindowManager()
  mainWindow = windowManager.createMainWindow()

  mainWindow.loadURL('http://localhost:3000')

  mainWindow.webContents.setPreloadScript(getPreloadPath())

  mainWindow.on('closed', () => {
    mainWindow = null
    windowManager = null
  })
}

app.whenReady().then(() => {
  registerIpcHandlers(ipcMain)
  createWindow()
  new MenuBuilder().build()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  windowManager?.closeAll()
})
