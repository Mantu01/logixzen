import { BrowserWindow, dialog, ipcMain } from "electron";
import type { OpenFileOptions, SaveFileOptions } from "../shared/desktop-api";

function ownerWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? undefined;
}

export function registerDialogHandlers(): void {
  ipcMain.handle(
    "dialog:open-file",
    async (_event, options?: OpenFileOptions) => {
      const openOptions: Electron.OpenDialogOptions = {
        title: options?.title,
        filters: options?.filters,
        properties: ["openFile"],
      };
      const owner = ownerWindow();
      const result = owner
        ? await dialog.showOpenDialog(owner, openOptions)
        : await dialog.showOpenDialog(openOptions);

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }
      return result.filePaths[0] ?? null;
    },
  );

  ipcMain.handle(
    "dialog:save-file",
    async (_event, options?: SaveFileOptions) => {
      const saveOptions: Electron.SaveDialogOptions = {
        title: options?.title,
        defaultPath: options?.defaultPath,
        filters: options?.filters,
      };
      const owner = ownerWindow();
      const result = owner
        ? await dialog.showSaveDialog(owner, saveOptions)
        : await dialog.showSaveDialog(saveOptions);

      if (result.canceled || result.filePath === undefined) {
        return null;
      }
      return result.filePath;
    },
  );
}
