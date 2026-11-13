import { BrowserWindow, screen } from 'electron'

export class WindowManager {
  private mainWindow: BrowserWindow | null = null
  private readonly minWidth = 800
  private readonly minHeight = 600
  private readonly defaultWidth = 1400
  private readonly defaultHeight = 900

  createMainWindow(): BrowserWindow {
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize

    this.mainWindow = new BrowserWindow({
      width: Math.min(this.defaultWidth, width),
      height: Math.min(this.defaultHeight, height),
      minWidth: this.minWidth,
      minHeight: this.minHeight,
      frame: false,
      backgroundColor: '#0D1117',
      show: false,
      webPreferences: {
        preload: '',
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    this.mainWindow.on('ready-to-show', () => {
      this.mainWindow?.show()
    })

    return this.mainWindow
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  resizeToContent(): void {
    if (this.mainWindow === null) return
    this.mainWindow.setBounds({
      width: Math.min(this.defaultWidth, this.mainWindow.getBounds().width),
      height: Math.min(this.defaultHeight, this.mainWindow.getBounds().height),
    })
  }

  closeAll(): void {
    this.mainWindow?.close()
    this.mainWindow = null
  }
}
