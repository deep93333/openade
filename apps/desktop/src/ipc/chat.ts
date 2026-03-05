import { ipcMain } from "electron";
import { IPC } from "@agentide/shared";
import type { ChatData } from "@agentide/shared";
import * as chatStorage from "../services/chat";
import { workspaceManager } from "../services/workspace";
import { gitService } from "../services/git";

export function registerChatHandlers(): void {
  ipcMain.handle(IPC.CHAT_LOAD, async (_event, workspaceId: string) => {
    try {
      const data = chatStorage.getChat(workspaceId);
      return { success: true, data };
    } catch {
      return { success: false, error: "Failed to load chat" };
    }
  });

  ipcMain.handle(IPC.CHAT_SAVE, async (_event, workspaceId: string, data: ChatData) => {
    try {
      chatStorage.setChat(workspaceId, data);
      return { success: true };
    } catch {
      return { success: false, error: "Failed to save chat" };
    }
  });

  ipcMain.handle(IPC.CHAT_DELETE_THREAD, async (_event, workspaceId: string, threadId: string) => {
    try {
      chatStorage.deleteThread(workspaceId, threadId);
      const workspace = workspaceManager.get(workspaceId);
      if (workspace) {
        await gitService.deleteCheckpointRefs(workspace.path, threadId).catch(() => {});
      }
      return { success: true };
    } catch {
      return { success: false, error: "Failed to delete thread" };
    }
  });
}
