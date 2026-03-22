import { useMemo } from "react";
import type { AgentMessage } from "@openade/shared";

export type ThreadChangedFile = {
  path: string;
  added: number;
  deleted: number;
};

const MUTATING_TOOL_NAMES = new Set([
  "applypatch",
  "edit",
  "multiedit",
  "write",
  "delete",
  "editnotebook",
  "createfile",
  "rename",
  "move",
  "copy",
  "text_editor",
  "str_replace_editor",
]);

function normalizeWorkspacePath(path: string, workspacePath: string | null): string {
  const normalized = path.replace(/\\/g, "/").trim();
  if (!workspacePath) return normalized;
  const workspaceNormalized = workspacePath.replace(/\\/g, "/").replace(/\/+$/, "");
  if (normalized.startsWith(`${workspaceNormalized}/`)) {
    return normalized.slice(workspaceNormalized.length + 1);
  }
  return normalized;
}

function countLines(text: string): number {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

function extractPatchPaths(input: unknown): string[] {
  const source = typeof input === "string" ? input : typeof input === "object" && input ? JSON.stringify(input) : "";
  if (!source) return [];
  const matches = [...source.matchAll(/\*\*\* (?:Add|Update) File: (.+)/g)];
  return matches.map((m) => m[1].trim()).filter(Boolean);
}

function extractPatchStats(input: unknown): ThreadChangedFile[] {
  const source = typeof input === "string" ? input : typeof input === "object" && input ? JSON.stringify(input) : "";
  if (!source) return [];
  const rows = source.split(/\r?\n/);
  const byFile = new Map<string, ThreadChangedFile>();
  let currentPath = "";

  for (const row of rows) {
    const header = row.match(/^\*\*\* (?:Add|Update) File: (.+)$/);
    if (header) {
      currentPath = header[1].trim();
      if (!byFile.has(currentPath)) {
        byFile.set(currentPath, { path: currentPath, added: 0, deleted: 0 });
      }
      continue;
    }
    if (!currentPath) continue;
    if (row.startsWith("+") && !row.startsWith("+++")) {
      byFile.get(currentPath)!.added += 1;
      continue;
    }
    if (row.startsWith("-") && !row.startsWith("---")) {
      byFile.get(currentPath)!.deleted += 1;
    }
  }

  return [...byFile.values()];
}

function extractEditStats(input: unknown): ThreadChangedFile[] {
  if (!input || typeof input !== "object" || Array.isArray(input)) return [];
  const obj = input as Record<string, unknown>;
  const path = [
    obj.path,
    obj.file_path,
    obj.filepath,
    obj.target_file,
    obj.target_notebook,
  ].find((value): value is string => typeof value === "string" && value.trim().length > 0);

  if (!path) return [];

  const oldText = typeof obj.old_str === "string"
    ? obj.old_str
    : typeof obj.old_string === "string"
      ? obj.old_string
      : "";
  const newText = typeof obj.new_str === "string"
    ? obj.new_str
    : typeof obj.new_string === "string"
      ? obj.new_string
      : "";

  return [{
    path,
    added: countLines(newText),
    deleted: countLines(oldText),
  }];
}

function extractPathsFromInput(input: unknown): string[] {
  const found = new Set<string>();
  const visit = (value: unknown): void => {
    if (!value) return;
    if (typeof value === "string") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        const keyLower = key.toLowerCase();
        if (
          typeof child === "string" &&
          (keyLower === "path" ||
            keyLower === "filepath" ||
            keyLower === "file_path" ||
            keyLower === "target_file" ||
            keyLower === "target_notebook" ||
            keyLower === "new_path" ||
            keyLower === "old_path")
        ) {
          const cleaned = child.trim();
          if (cleaned) found.add(cleaned);
        }
        visit(child);
      }
    }
  };
  visit(input);
  return [...found];
}

export function useThreadChangedFiles(
  messages: AgentMessage[],
  workspacePath: string | null
): ThreadChangedFile[] {
  return useMemo(() => {
    const ordered = new Map<string, ThreadChangedFile>();
    for (const message of messages) {
      if (message.role !== "tool" || !message.toolName) continue;
      const toolName = message.toolName.toLowerCase();
      const stats: ThreadChangedFile[] =
        toolName === "applypatch"
          ? extractPatchStats(message.toolInput)
          : toolName === "edit" || toolName === "multiedit" || toolName === "editnotebook"
            ? extractEditStats(message.toolInput)
            : MUTATING_TOOL_NAMES.has(toolName)
              ? extractPathsFromInput(message.toolInput).map((path) => ({
                  path,
                  added: 0,
                  deleted: 0,
                }))
              : [];

      for (const stat of stats) {
        const normalized = normalizeWorkspacePath(stat.path, workspacePath);
        if (!normalized) continue;
        const prev = ordered.get(normalized);
        if (prev) {
          ordered.set(normalized, {
            path: normalized,
            added: prev.added + stat.added,
            deleted: prev.deleted + stat.deleted,
          });
        } else {
          ordered.set(normalized, {
            path: normalized,
            added: stat.added,
            deleted: stat.deleted,
          });
        }
      }
    }
    return [...ordered.values()];
  }, [messages, workspacePath]);
}
