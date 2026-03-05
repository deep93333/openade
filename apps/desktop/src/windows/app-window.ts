import { BrowserWindow, Menu, nativeTheme, app } from "electron";
import path from "node:path";

let appWindow: BrowserWindow | null = null;

const useStaticApp =
  process.env.NODE_ENV !== "development" || process.env.USE_STATIC_APP === "1";

const getAppDistPath = (): string => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "dist");
  }
  return path.resolve(__dirname, "..", "..", "app", "dist");
};

export const getAppUrl = (route: string = "/"): string => {
  if (!useStaticApp) {
    return `http://localhost:3010${route}`;
  }
  const indexHtml = path.join(getAppDistPath(), "index.html");
  return `file://${indexHtml}#${route}`;
};

export const createAppWindow = (): BrowserWindow => {
  if (appWindow && !appWindow.isDestroyed()) {
    appWindow.focus();
    return appWindow;
  }

  nativeTheme.themeSource = "dark";

  appWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: "#1E231F",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
  });

  appWindow.loadURL(getAppUrl("/"));

  if (process.env.NODE_ENV === "development") {
    appWindow.webContents.openDevTools({ mode: "detach" });
  }

  appWindow.webContents.on("context-menu", (_e, params) => {
    Menu.buildFromTemplate([
      {
        label: "Inspect Element",
        click: () => {
          appWindow?.webContents.inspectElement(params.x, params.y);
        },
      },
    ]).popup();
  });

  appWindow.on("closed", () => {
    appWindow = null;
  });

  return appWindow;
};

export const getAppWindow = (): BrowserWindow | null => appWindow;
