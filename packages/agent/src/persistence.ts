import * as fs from "fs/promises";
import * as path from "path";
import type { ModelMessage } from "ai";

const THREADS_DIR = ".agentide/threads";

export function getThreadPath(workspacePath: string, threadId: string): string {
  return path.join(workspacePath, THREADS_DIR, `${threadId}.jsonl`);
}

export async function appendMessage(
  workspacePath: string,
  threadId: string,
  message: ModelMessage,
): Promise<void> {
  const filePath = getThreadPath(workspacePath, threadId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const line = JSON.stringify(message) + "\n";
  await fs.appendFile(filePath, line, "utf-8");
}

export async function appendMessages(
  workspacePath: string,
  threadId: string,
  messages: ModelMessage[],
): Promise<void> {
  if (messages.length === 0) return;
  const filePath = getThreadPath(workspacePath, threadId);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const lines = messages.map(m => JSON.stringify(m)).join("\n") + "\n";
  await fs.appendFile(filePath, lines, "utf-8");
}

export async function loadThread(
  workspacePath: string,
  threadId: string,
): Promise<ModelMessage[]> {
  const filePath = getThreadPath(workspacePath, threadId);
  try {
    const content = await fs.readFile(filePath, "utf-8");
    const messages: ModelMessage[] = [];
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        messages.push(JSON.parse(trimmed) as ModelMessage);
      } catch {
        // skip malformed lines
      }
    }
    return messages;
  } catch {
    return [];
  }
}

export async function threadExists(
  workspacePath: string,
  threadId: string,
): Promise<boolean> {
  try {
    await fs.access(getThreadPath(workspacePath, threadId));
    return true;
  } catch {
    return false;
  }
}
