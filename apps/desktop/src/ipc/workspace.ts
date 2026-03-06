import { ipcMain } from "electron";
import { IPC } from "@agentide/shared";
import * as chatStorage from "../services/chat-storage";
import { workspaceManager } from "../services/workspace-manager";
import {
  setActiveWorkspace,
  clearActiveWorkspace,
  getActiveWorkspaceId,
} from "../services/workspace-events";

export function registerWorkspaceHandlers(): void {
  ipcMain.handle(IPC.WORKSPACE_LIST, async () => {
    const workspaces = workspaceManager.list();
    const refreshed = await Promise.all(
      workspaces.map(async (w) => {
        try {
          return await workspaceManager.refreshGitInfo(w.id);
        } catch {
          return w;
        }
      }),
    );
    return { success: true, data: refreshed };
  });

  ipcMain.handle(IPC.WORKSPACE_CREATE, async (_event, params: { name: string; path: string }) => {
    try {
      const workspace = await workspaceManager.create(params.name, params.path);
      return { success: true, data: workspace };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to create workspace" };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_DELETE, async (_event, id: string) => {
    try {
      if (getActiveWorkspaceId() === id) clearActiveWorkspace();
      chatStorage.removeChat(id);
      workspaceManager.remove(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to delete workspace" };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_SELECT, async (_event, id: string) => {
    const workspace = workspaceManager.get(id);
    if (!workspace) return { success: false, error: "Workspace not found" };
    try {
      const refreshed = await workspaceManager.refreshGitInfo(id);
      setActiveWorkspace(refreshed.id, refreshed.path);
      return { success: true, data: refreshed };
    } catch {
      setActiveWorkspace(workspace.id, workspace.path);
      return { success: true, data: workspace };
    }
  });
}
