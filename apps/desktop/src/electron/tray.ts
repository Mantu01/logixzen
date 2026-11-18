import { BrowserWindow, Menu, Tray, app, nativeImage } from "electron";
import { join } from "node:path";

let tray: Tray | null = null;

export function createTray(
  getWindow: () => BrowserWindow | null,
  onNavigate: (path: string) => void,
): void {
  const iconPath = join(__dirname, "../../logo.png");
  const image = nativeImage.createFromPath(iconPath);
  tray = new Tray(
    image.isEmpty()
      ? nativeImage.createEmpty()
      : image.resize({ width: 16, height: 16 }),
  );

  tray.setToolTip("LogixZen — SQL Practice");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show LogixZen",
        click: () => {
          const window = getWindow();
          if (window === null) {
            return;
          }
          window.show();
          window.focus();
        },
      },
      {
        label: "Playground",
        click: () => {
          const window = getWindow();
          window?.show();
          onNavigate("/playground");
        },
      },
      {
        label: "Practice",
        click: () => {
          const window = getWindow();
          window?.show();
          onNavigate("/learn");
        },
      },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]),
  );

  tray.on("click", () => {
    const window = getWindow();
    if (window === null) {
      return;
    }
    if (window.isVisible()) {
      window.hide();
    } else {
      window.show();
      window.focus();
    }
  });
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}
