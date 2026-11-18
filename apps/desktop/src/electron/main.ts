import { BrowserWindow, app, ipcMain, net, protocol, shell } from "electron";
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { registerIpcHandlers } from "./ipc";
import { buildApplicationMenu } from "./menu";
import { prepareInstallState } from "./state/startup";
import { createTray, destroyTray } from "./tray";
import { connectionRegistry } from "./sql/registry";

const DEV_SERVER_URL = "http://localhost:3000";
const APP_SCHEME = "logixzen";
const APP_ORIGIN = `${APP_SCHEME}://app`;
const EXPORT_DIR = join(__dirname, "../../out");
const MAX_DEV_ATTEMPTS = 60;
const DEV_RETRY_MS = 500;

let mainWindow: BrowserWindow | null = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

function delay(ms: number): Promise<void> {
  return new Promise((done) => {
    setTimeout(done, ms);
  });
}

function resolveExportFile(pathname: string): string {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.startsWith("/") ? decoded.slice(1) : decoded;
  const candidates = [
    relative,
    `${relative}.html`,
    join(relative, "index.html"),
  ];

  for (const candidate of candidates) {
    const file = resolve(EXPORT_DIR, candidate);
    if (!file.startsWith(resolve(EXPORT_DIR))) {
      continue;
    }
    if (existsSync(file) && statSync(file).isFile()) {
      return file;
    }
  }

  return join(EXPORT_DIR, "index.html");
}

function registerAppProtocol(): void {
  protocol.handle(APP_SCHEME, (request) => {
    const { pathname } = new URL(request.url);
    return net.fetch(pathToFileURL(resolveExportFile(pathname)).toString());
  });
}

function navigate(path: string): void {
  const window = mainWindow;
  if (window === null) {
    return;
  }
  window.show();
  window.focus();
  if (app.isPackaged) {
    window.webContents.send("navigate", path);
  } else {
    void window.loadURL(`${DEV_SERVER_URL}${path}`);
  }
}

async function loadDevServer(window: BrowserWindow): Promise<void> {
  for (let attempt = 0; attempt < MAX_DEV_ATTEMPTS; attempt += 1) {
    if (window.isDestroyed()) {
      return;
    }
    try {
      await window.loadURL(DEV_SERVER_URL);
      return;
    } catch {
      await delay(DEV_RETRY_MS);
    }
  }

  const message =
    "Could not reach http://localhost:3000. Start the dev server with `pnpm dev`.";
  await window.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(message)}`,
  );
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    backgroundColor: "#0d1117",
    title: "LogixZen",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow = window;

  window.once("ready-to-show", () => {
    window.show();
  });

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  window.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [
            "default-src 'self' logixzen:; script-src 'self' 'unsafe-eval' 'unsafe-inline' logixzen:; style-src 'self' 'unsafe-inline' logixzen:; img-src 'self' data: logixzen:; font-src 'self' data: logixzen:; connect-src 'self' logixzen: ws://localhost:* http://localhost:*;",
          ],
        },
      });
    },
  );

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  if (app.isPackaged) {
    void window.loadURL(`${APP_ORIGIN}/index.html`);
  } else {
    void loadDevServer(window);
    window.webContents.openDevTools({ mode: "detach" });
  }

  return window;
}

const instanceLock = app.requestSingleInstanceLock();

if (!instanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow === null) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    registerAppProtocol();
    registerIpcHandlers(ipcMain);
    buildApplicationMenu(navigate);
    await prepareInstallState();
    createWindow();
    createTray(
      () => mainWindow,
      (path) => {
        if (mainWindow === null) {
          mainWindow = createWindow();
        }
        navigate(path);
      },
    );

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on("before-quit", () => {
  destroyTray();
  void connectionRegistry.disposeAll();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
