import * as fs from "fs/promises";
import * as path from "node:path";
import type { ModelMessage } from "ai";
import {
  getLegacyThreadJsonlPath,
  getThreadJsonlPath,
  threadsStoredInWorkspace,
} from "./session-paths.js";

export function getThreadPath(
  workspacePath: string,
  threadId: string,
  workspaceId?: string,
): string {
  return getThreadJsonlPath(workspacePath, workspaceId, threadId);
}

export async function appendMessage(
  workspacePath: string,
  threadId: string,
  message: ModelMessage,
  workspaceId?: string,
): Promise<void> {
  const filePath = getThreadJsonlPath(workspacePath, workspaceId, threadId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const line = JSON.stringify(message) + "\n";
  await fs.appendFile(filePath, line, "utf-8");
}

export async function appendMessages(
  workspacePath: string,
  threadId: string,
  messages: ModelMessage[],
  workspaceId?: string,
): Promise<void> {
  if (messages.length === 0) return;
  const filePath = getThreadJsonlPath(workspacePath, workspaceId, threadId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const lines = messages.map((m) => JSON.stringify(m)).join("\n") + "\n";
  await fs.appendFile(filePath, lines, "utf-8");
}

async function readJsonlMessages(filePath: string): Promise<ModelMessage[]> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const messages: ModelMessage[] = [];
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        messages.push(JSON.parse(trimmed) as ModelMessage);
      } catch {
        //
      }
    }
    return messages;
  } catch {
    return [];
  }
}

export async function loadThread(
  workspacePath: string,
  threadId: string,
  workspaceId?: string,
): Promise<ModelMessage[]> {
  const primary = getThreadJsonlPath(workspacePath, workspaceId, threadId);
  const fromPrimary = await readJsonlMessages(primary);
  if (fromPrimary.length > 0) return fromPrimary;
  if (threadsStoredInWorkspace()) {
    const legacyWs = getLegacyThreadJsonlPath(workspacePath, threadId);
    const fromLegacyWs = await readJsonlMessages(legacyWs);
    if (fromLegacyWs.length > 0) return fromLegacyWs;
    return [];
  }
  const legacy = getLegacyThreadJsonlPath(workspacePath, threadId);
  return readJsonlMessages(legacy);
}

export async function threadExists(
  workspacePath: string,
  threadId: string,
  workspaceId?: string,
): Promise<boolean> {
  const primary = getThreadJsonlPath(workspacePath, workspaceId, threadId);
  try {
    await fs.access(primary);
    return true;
  } catch {
    //
  }
  if (threadsStoredInWorkspace()) {
    try {
      await fs.access(getLegacyThreadJsonlPath(workspacePath, threadId));
      return true;
    } catch {
      //
    }
    return false;
  }
  try {
    await fs.access(getLegacyThreadJsonlPath(workspacePath, threadId));
    return true;
  } catch {
    //
  }
  return false;
}
