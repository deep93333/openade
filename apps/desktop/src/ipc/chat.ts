import { ipcMain } from "electron";
import { IPC } from "@agentide/shared";
import type { AgentMessage, ChatData } from "@agentide/shared";
import * as chatStorage from "../services/chat-storage";
import { workspaceManager } from "../services/workspace-manager";
import { gitService } from "../services/git-service";
import { deleteThreadSnapshots } from "../services/snapshot-store";

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
      await deleteThreadSnapshots(workspaceId, threadId).catch(() => {});
      return { success: true };
    } catch {
      return { success: false, error: "Failed to delete thread" };
    }
  });

  ipcMain.handle(
    IPC.CHAT_UPDATE_MESSAGE,
    async (
      _event,
      workspaceId: string,
      threadId: string,
      messageId: string,
      updates: Partial<Pick<AgentMessage, "content" | "planContent" | "reviewContent">>
    ) => {
      try {
        chatStorage.updateMessage(workspaceId, threadId, messageId, updates);
        return { success: true };
      } catch {
        return { success: false, error: "Failed to update message" };
      }
    }
  );
}
