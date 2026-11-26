import { Menu, app, shell } from "electron";
import type { MenuItemConstructorOptions } from "electron";

const isMac = process.platform === "darwin";

export function buildApplicationMenu(navigate: (path: string) => void): void {
  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          } satisfies MenuItemConstructorOptions,
        ]
      : []),
    {
      label: "File",
      submenu: [
        {
          label: "Import / Data Hub…",
          accelerator: "CmdOrCtrl+I",
          click: () => navigate("/import"),
        },
        {
          label: "Our Resources…",
          accelerator: "CmdOrCtrl+Shift+I",
          click: () => navigate("/import/resources"),
        },
        {
          label: "Settings",
          accelerator: "CmdOrCtrl+,",
          click: () => navigate("/settings"),
        },
        { type: "separator" },
        isMac ? { role: "close" } : { role: "quit" },
      ],
    },
    {
      label: "Go",
      submenu: [
        {
          label: "Home",
          accelerator: "CmdOrCtrl+1",
          click: () => navigate("/"),
        },
        {
          label: "Playground",
          accelerator: "CmdOrCtrl+2",
          click: () => navigate("/playground"),
        },
        {
          label: "Practice",
          accelerator: "CmdOrCtrl+3",
          click: () => navigate("/learn"),
        },
        {
          label: "Databases",
          accelerator: "CmdOrCtrl+Shift+D",
          click: () => navigate("/databases"),
        },
        {
          label: "Schema",
          accelerator: "CmdOrCtrl+4",
          click: () => navigate("/schema"),
        },
        {
          label: "Progress",
          accelerator: "CmdOrCtrl+5",
          click: () => navigate("/progress"),
        },
        {
          label: "Notes",
          accelerator: "CmdOrCtrl+6",
          click: () => navigate("/notes"),
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac ? [{ role: "front" as const }] : []),
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "LogixZen Website",
          click: () => {
            void shell.openExternal("https://logixzen.com");
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
