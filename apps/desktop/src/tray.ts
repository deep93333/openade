import { Menu, Tray, app, nativeImage } from "electron";
import path from "node:path";
import fs from "node:fs";
import { createAppWindow } from "./windows/app-window";
import { createNewTaskWindow } from "./windows/new-task-window";

let tray: Tray | null = null;

const resolveTrayIconPath = (): string => {
  const iconName = "agentide.icns";
  const candidates = [
    path.join(process.resourcesPath, "icons", iconName),
    path.join(app.getAppPath(), "src", "icons", iconName),
    path.join(__dirname, "icons", iconName),
    path.join(__dirname, "..", "icons", iconName),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[candidates.length - 1];
};

export const createTray = (): Tray => {
  if (tray && !tray.isDestroyed()) return tray;

  const iconPath = resolveTrayIconPath();
  const icon = nativeImage.createFromPath(iconPath);
  if (process.platform === "darwin") {
    icon.setTemplateImage(true);
  }

  tray = new Tray(icon);
  tray.setToolTip("AgentIDE");

  const menu = Menu.buildFromTemplate([
    {
      label: "New Task",
      click: () => createNewTaskWindow(),
    },
    {
      label: "Open AgentIDE",
      click: () => createAppWindow(),
    },
    { type: "separator" },
    { role: "quit" },
  ]);

  tray.setContextMenu(menu);
  tray.on("click", () => createAppWindow());

  return tray;
};
