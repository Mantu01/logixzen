import { Menu, MenuItemConstructorOptions, app, shell } from 'electron'

export class MenuBuilder {
  private template: MenuItemConstructorOptions[]

  constructor() {
    this.template = [
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideothers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'File',
        submenu: [
          {
            label: 'Import Database',
            accelerator: 'CmdOrCtrl+O',
            click: () => {
              // Triggered via IPC
            },
          },
          {
            label: 'Import Questions',
            click: () => {
              // Triggered via IPC
            },
          },
          { type: 'separator' },
          {
            label: 'Export Progress',
            click: () => {
              // Triggered via IPC
            },
          },
          { type: 'separator' },
          {
            label: 'Reset Database',
            click: () => {
              // Triggered via IPC
            },
          },
        ],
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'pasteandmatchstyle' },
          { role: 'delete' },
          { role: 'selectall' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forcereload' },
          { type: 'separator' },
          { role: 'resetzoom' },
          { role: 'zoomin' },
          { role: 'zoomout' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
          { type: 'separator' },
          { role: 'toggledevtools' },
        ],
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' },
        ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Documentation',
            click: async () => {
              await shell.openExternal('https://logixzen.com/docs')
            },
          },
          {
            label: 'Report Issue',
            click: async () => {
              await shell.openExternal('https://github.com/logixzen/logixzen/issues')
            },
          },
        ],
      },
    ]
  }

  build(): Menu {
    const menu = Menu.buildFromTemplate(this.template)
    Menu.setApplicationMenu(menu)
    return menu
  }
}
