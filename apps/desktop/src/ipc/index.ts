import { registerWorkspaceHandlers } from "./workspace";
import { registerGitHandlers } from "./git";
import { registerChatHandlers } from "./chat";
import { registerAuthHandlers } from "./auth";
import { registerTerminalHandlers } from "./terminal";
import { registerCheckpointHandlers } from "./checkpoint";
import { registerFilesystemHandlers } from "./filesystem";
import { initWorkspaceEvents } from "../services/workspace-events";
import { getAppWindow } from "../windows/app-window";

export function registerIpcHandlers(): void {
  initWorkspaceEvents((channel, payload) => {
    const window = getAppWindow();
    if (window) window.webContents.send(channel, payload);
  });

  registerWorkspaceHandlers();
  registerGitHandlers();
  registerChatHandlers();
  registerAuthHandlers();
  registerTerminalHandlers();
  registerCheckpointHandlers();
  registerFilesystemHandlers();
}
