import type { AgentMessage, ChatData, ChatThread } from "@agentide/shared";
import { existsSync, readFileSync, unlinkSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ulid } from "ulid";
import { getAgentideDataDir } from "../lib/data-paths.js";

function getChatsDir(): string {
  const dir = path.join(getAgentideDataDir(), "chats");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const getChatPath = (workspaceId: string): string =>
  path.join(getChatsDir(), `${workspaceId}.json`);

export function removeChat(workspaceId: string): void {
  try {
    const filePath = getChatPath(workspaceId);
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch {
    //
  }
}

function migrateLegacy(data: {
  messages?: AgentMessage[];
  sdkSessionId?: string;
  threads?: ChatThread[];
  activeThreadId?: string;
}): ChatData {
  if (Array.isArray(data?.threads) && typeof data?.activeThreadId === "string") {
    const sdkSessionId = typeof data.sdkSessionId === "string" ? data.sdkSessionId : undefined;
    return {
      threads: data.threads,
      activeThreadId: data.activeThreadId,
      sdkSessionId,
    };
  }
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const threadId = ulid();
  const threads: ChatThread[] = [
    { id: threadId, messages, createdAt: Date.now(), updatedAt: Date.now() },
  ];
  const sdkSessionId = typeof data?.sdkSessionId === "string" ? data.sdkSessionId : undefined;
  return { threads, activeThreadId: threadId, sdkSessionId };
}

export function getChat(workspaceId: string): ChatData {
  try {
    const filePath = getChatPath(workspaceId);
    if (!existsSync(filePath)) {
      return { threads: [], activeThreadId: "", sdkSessionId: undefined };
    }
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as Parameters<typeof migrateLegacy>[0];
    return migrateLegacy(data);
  } catch {
    return { threads: [], activeThreadId: "", sdkSessionId: undefined };
  }
}

export function setChat(workspaceId: string, updates: Partial<ChatData> & { sdkSessionId?: string }): void {
  try {
    const current = getChat(workspaceId);
    let threads = updates.threads ?? current.threads;
    if (updates.threads) {
      threads = updates.threads.map((incoming) => {
        const existing = current.threads.find((t) => t.id === incoming.id);
        return {
          ...incoming,
          sdkSessionId: incoming.sdkSessionId ?? existing?.sdkSessionId,
        };
      });
    }
    const activeThreadId =
      updates.activeThreadId !== undefined ? updates.activeThreadId : current.activeThreadId;
    const sdkSessionId =
      updates.sdkSessionId !== undefined ? updates.sdkSessionId : current.sdkSessionId;
    const filePath = getChatPath(workspaceId);
    writeFileSync(
      filePath,
      JSON.stringify({ threads, activeThreadId, sdkSessionId }, null, 0),
      "utf-8",
    );
  } catch {
    //
  }
}

export function updateMessage(
  workspaceId: string,
  threadId: string,
  messageId: string,
  updates: Partial<Pick<AgentMessage, "content" | "planContent" | "reviewContent">>,
): void {
  const current = getChat(workspaceId);
  const thread = current.threads.find((t) => t.id === threadId);
  if (!thread) return;

  const msgIndex = thread.messages.findIndex((m) => m.id === messageId);
  if (msgIndex === -1) return;

  thread.messages[msgIndex] = { ...thread.messages[msgIndex], ...updates };

  const filePath = getChatPath(workspaceId);
  writeFileSync(
    filePath,
    JSON.stringify(
      {
        threads: current.threads,
        activeThreadId: current.activeThreadId,
        sdkSessionId: current.sdkSessionId,
      },
      null,
      0,
    ),
    "utf-8",
  );
}

export function deleteThread(workspaceId: string, threadId: string): void {
  try {
    const current = getChat(workspaceId);
    const threads = current.threads.filter((t) => t.id !== threadId);

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
        sdkSessionId: current.sdkSessionId,
      }, null, 0),
      "utf-8",
    );
  } catch {
    //
  }
}
