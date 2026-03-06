import { ipcMain } from "electron";
import { IPC } from "@agentide/shared";
import type { AgentStartParams, CommitMessageParams, ThreadTitleParams, ToolApprovalResponse } from "@agentide/shared";
import type { ToolApprovalResult } from "@agentide/agent";
import { ulid } from "ulid";
import { agentManager, generateCommitMessage, generateThreadTitle, getAllModels } from "../services/agent-manager";
import * as chatStorage from "../services/chat-storage";
import * as configStorage from "../services/config-storage";
import { gitService } from "../services/git-service";
import { workspaceManager } from "../services/workspace-manager";
import { getAppWindow } from "../windows/app-window";

type ToolApprovalEntry = {
  resolve: (r: ToolApprovalResult) => void;
  input: unknown;
};

const pendingToolApprovals = new Map<string, ToolApprovalEntry>();

type PostRunSnapshot = { untracked: string[]; stashSha: string | null };
const postRunSnapshotPromises = new Map<string, Promise<PostRunSnapshot>>();

export { postRunSnapshotPromises };

export function registerAgentHandlers(): void {
  ipcMain.handle(IPC.AGENT_START, async (_event, params: AgentStartParams) => {
    try {
      const workspace = workspaceManager.get(params.workspaceId);
      if (!workspace) return { success: false, error: "Workspace not found" };

      const window = getAppWindow();
      if (!window) return { success: false, error: "App window not found" };

      const ALWAYS_APPROVE_BYPASS = new Set(["ask_question"]);

      const canUseTool = async (sessionId: string, toolName: string, input: unknown): Promise<ToolApprovalResult> => {
        if (!params.requireApproval && !ALWAYS_APPROVE_BYPASS.has(toolName)) {
          return { behavior: "allow", updatedInput: input };
        }
        const requestId = ulid();
        return new Promise<ToolApprovalResult>((resolve) => {
          pendingToolApprovals.set(requestId, { resolve, input });
          window.webContents.send(IPC.AGENT_TOOL_APPROVAL_REQUEST, {
            requestId, toolName, input, sessionId, workspaceId: params.workspaceId,
          });
        });
      };

      const chat = chatStorage.getChat(params.workspaceId);
      const provider = params.provider ?? "claude";
      const activeThread = params.activeThreadId
        ? chat.threads.find((t) => t.id === params.activeThreadId)
        : undefined;
      const resumeSessionId = activeThread
        ? (activeThread.provider === provider ? activeThread.sdkSessionId : undefined)
        : chat.sdkSessionId;

      const sessionId = await agentManager.start({
        prompt: params.prompt,
        existingMessages: params.existingMessages,
        workspaceId: params.workspaceId,
        workspacePath: workspace.path,
        provider,
        model: params.model,
        mode: params.mode,
        resumeSessionId,
        imageAttachments: params.imageAttachments,
        mcpServers: params.mcpServers ?? configStorage.getGlobalSettings().mcpServers,
        canUseTool,
        onMessage: (message) => {
          window.webContents.send(IPC.AGENT_MESSAGE, message);
        },
        onResult: (result) => {
          if (result.success && params.activeThreadId) {
            const key = `${params.workspaceId}:${params.activeThreadId}`;
            postRunSnapshotPromises.set(
              key,
              Promise.all([
                gitService.getUntrackedFiles(workspace.path).catch(() => [] as string[]),
                gitService.stashCreate(workspace.path).catch(() => null as string | null),
              ]).then(([untracked, stashSha]) => ({ untracked, stashSha })),
            );
          }
          window.webContents.send(IPC.AGENT_RESULT, result);
        },
        onError: (payload) => {
          window.webContents.send(IPC.AGENT_ERROR, {
            ...payload,
            workspaceId: params.workspaceId,
          });
        },
        onSdkSessionId: (sdkSessionId) => {
          if (params.activeThreadId) {
            const latest = chatStorage.getChat(params.workspaceId);
            const updated = latest.threads.map((t) =>
              t.id === params.activeThreadId ? { ...t, sdkSessionId, provider } : t,
            );
            chatStorage.setChat(params.workspaceId, { threads: updated });
          } else {
            chatStorage.setChat(params.workspaceId, { sdkSessionId });
          }
          window.webContents.send(IPC.AGENT_SDK_SESSION_ID, {
            sdkSessionId, threadId: params.activeThreadId ?? "", workspaceId: params.workspaceId, provider,
          });
        },
      });

      return { success: true, data: { sessionId } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to start agent" };
    }
  });

  ipcMain.handle(IPC.AGENT_STOP, async (_event, sessionId: string) => {
    try {
      await agentManager.stop(sessionId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to stop agent" };
    }
  });

  ipcMain.handle(IPC.AGENT_STATUS, async () => {
    const status = agentManager.getStatus();
    return { success: true, data: status };
  });

  ipcMain.handle(IPC.AGENT_GET_MODELS, async () => {
    try {
      return { success: true, data: getAllModels() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to get models" };
    }
  });

  ipcMain.handle(IPC.AGENT_GENERATE_THREAD_TITLE, async (_event, params: ThreadTitleParams) => {
    try {
      const title = await generateThreadTitle(params);
      return { success: true, data: title };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to generate thread title" };
    }
  });

  ipcMain.handle(IPC.AGENT_GENERATE_COMMIT_MESSAGE, async (_event, params: CommitMessageParams) => {
    try {
      const message = await generateCommitMessage(params);
      return { success: true, data: message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to generate commit message" };
    }
  });

  ipcMain.handle(IPC.AGENT_TOOL_APPROVAL_RESPONSE, async (_event, response: ToolApprovalResponse) => {
    const pending = pendingToolApprovals.get(response.requestId);
    if (!pending) return;
    pendingToolApprovals.delete(response.requestId);
    if (response.allow) {
      pending.resolve({ behavior: "allow", updatedInput: response.updatedInput ?? pending.input });
    } else {
      pending.resolve({ behavior: "deny", message: response.message ?? "Denied" });
    }
  });
}
