import { BrowserWindow, Menu, nativeTheme } from "electron";
import path from "node:path";
import { getAppUrl } from "./app-window";

let newTaskWindow: BrowserWindow | null = null;

export const createNewTaskWindow = (): BrowserWindow => {
  if (newTaskWindow && !newTaskWindow.isDestroyed()) {
    newTaskWindow.focus();
    return newTaskWindow;
  }

  nativeTheme.themeSource = "dark";

  newTaskWindow = new BrowserWindow({
    width: 560,
    height: 640,
    minWidth: 480,
    minHeight: 520,
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

  newTaskWindow.loadURL(getAppUrl("/new-task"));

  if (process.env.NODE_ENV === "development") {
    newTaskWindow.webContents.openDevTools({ mode: "detach" });
  }

  newTaskWindow.webContents.on("context-menu", (_e, params) => {
    Menu.buildFromTemplate([
      {
        label: "Inspect Element",
        click: () => {
          newTaskWindow?.webContents.inspectElement(params.x, params.y);
        },
      },
    ]).popup();
  });

  newTaskWindow.on("closed", () => {
    newTaskWindow = null;
  });

  return newTaskWindow;
};
