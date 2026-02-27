import { app, BrowserWindow } from "electron";
import fixPath from "fix-path";
import { createAppWindow } from "./windows/app-window";
import { registerIpcHandlers } from "./ipc";
import { setApplicationMenu } from "./menu";

fixPath();

app.whenReady().then(() => {
  registerIpcHandlers();
  setApplicationMenu();
  createAppWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createAppWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
