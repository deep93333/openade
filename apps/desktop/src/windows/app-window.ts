import { BrowserWindow } from "electron";
import path from "node:path";

let appWindow: BrowserWindow | null = null;

const getAppUrl = (route: string = "/"): string => {
  if (process.env.NODE_ENV === "development") {
    return `http://localhost:3010${route}`;
  }
  return `file://${path.join(__dirname, "../app/dist/index.html")}#${route}`;
};

export const createAppWindow = (): BrowserWindow => {
  if (appWindow && !appWindow.isDestroyed()) {
    appWindow.focus();
    return appWindow;
  }

  appWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    backgroundColor: "#09090b",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  appWindow.loadURL(getAppUrl("/"));

  if (process.env.NODE_ENV === "development") {
    appWindow.webContents.openDevTools({ mode: "detach" });
  }

  appWindow.on("closed", () => {
    appWindow = null;
  });

  return appWindow;
};

export const getAppWindow = (): BrowserWindow | null => appWindow;
