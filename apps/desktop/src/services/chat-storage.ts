import type { AgentMessage, ChatData, ChatThread } from "@agentide/shared";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { app } from "electron";
import { ulid } from "ulid";

const getChatsDir = (): string => {
  const userData = app.getPath("userData");
  const dir = path.join(userData, "agentide", "chats");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const getChatPath = (workspaceId: string): string =>
  path.join(getChatsDir(), `${workspaceId}.json`);

export function removeChat(workspaceId: string): void {
  try {
    const filePath = getChatPath(workspaceId);
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch {
    // ignore
  }
}

function migrateLegacy(data: {
  messages?: AgentMessage[];
  sdkSessionId?: string;
  threads?: ChatThread[];
  activeThreadId?: string;
}): ChatData {
  if (Array.isArray(data?.threads) && typeof data?.activeThreadId === "string") {
    const sdkSessionId =
      typeof data.sdkSessionId === "string" ? data.sdkSessionId : undefined;
    return {
      threads: data.threads,
      activeThreadId: data.activeThreadId,
      sdkSessionId,
    };
  }
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const threadId = ulid();
  const threads: ChatThread[] = [
    { id: threadId, messages, createdAt: Date.now() },
  ];
  const sdkSessionId =
    typeof data?.sdkSessionId === "string" ? data.sdkSessionId : undefined;
  return { threads, activeThreadId: threadId, sdkSessionId };
}

export function getChat(workspaceId: string): ChatData {
  try {
    const filePath = getChatPath(workspaceId);
    if (!existsSync(filePath)) {
      console.log("[chat-storage] getChat no file", { workspaceId, filePath });
      return { threads: [], activeThreadId: "", sdkSessionId: undefined };
    }
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as Parameters<typeof migrateLegacy>[0];
    const result = migrateLegacy(data);
    console.log("[chat-storage] getChat", { workspaceId, filePath, threadsCount: result.threads.length, activeThreadId: result.activeThreadId });
    return result;
  } catch (err) {
    console.log("[chat-storage] getChat error", { workspaceId, err });
    return { threads: [], activeThreadId: "", sdkSessionId: undefined };
  }
}

export function setChat(
  workspaceId: string,
  updates: Partial<ChatData> & { sdkSessionId?: string }
): void {
  try {
    const current = getChat(workspaceId);
    let threads = updates.threads ?? current.threads;
    if (updates.threads) {
      threads = updates.threads.map((incoming) => {
        const existing = current.threads.find((t) => t.id === incoming.id);
        return {
          ...incoming,
          sdkSessionId:
            incoming.sdkSessionId ?? existing?.sdkSessionId,
        };
      });
    }
    const activeThreadId =
      updates.activeThreadId !== undefined
        ? updates.activeThreadId
        : current.activeThreadId;
    const sdkSessionId =
      updates.sdkSessionId !== undefined
        ? updates.sdkSessionId
        : current.sdkSessionId;
    const filePath = getChatPath(workspaceId);
    writeFileSync(
      filePath,
      JSON.stringify({ threads, activeThreadId, sdkSessionId }, null, 0),
      "utf-8"
    );
    console.log("[chat-storage] setChat", { workspaceId, filePath, threadsCount: threads.length });
  } catch {
    // ignore
  }
}

export function deleteThread(workspaceId: string, threadId: string): void {
  try {
    const current = getChat(workspaceId);
    const threads = current.threads.filter((t) => t.id !== threadId);

    // If we deleted the active thread, switch to another thread or empty string
    let activeThreadId = current.activeThreadId;
    if (activeThreadId === threadId) {
      activeThreadId = threads.length > 0 ? threads[0].id : "";
    }

    const filePath = getChatPath(workspaceId);
    writeFileSync(
      filePath,
      JSON.stringify({
        threads,
        activeThreadId,
        sdkSessionId: current.sdkSessionId
      }, null, 0),
      "utf-8"
    );
    console.log("[chat-storage] deleteThread", {
      workspaceId,
      threadId,
      threadsCount: threads.length,
      newActiveThreadId: activeThreadId
    });
  } catch (err) {
    console.error("[chat-storage] deleteThread error", { workspaceId, threadId, err });
  }
}
