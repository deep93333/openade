import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { AgentMessage, AgentModelOption, ImageAttachment } from "@agentide/shared";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  Button,
} from "@agentide/ui";
import { getElectronAPI } from "@/lib/electron";
import { useAgentStore } from "@/store/agent.store";
import { useFileContextStore, type FileContext, type MentionFilePayload } from "@/store/file-context.store";
import { useWorkspaceStore } from "@/store/workspace.store";
import { useUIStore } from "@/store/ui.store";
import { useAgentSkills } from "@/hooks/use-agent-skills";
import { ChatEditor } from "./chat-editor";
import { MessageList } from "./message-list";
import { JsonMessageViewer } from "./json-message-viewer";

type ViewMode = "chat" | "json";

const DEFAULT_MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
];

const CHAT_PLACEHOLDER = {
  withWorkspace: "Send a message to the agent...",
  noWorkspace: "Select a workspace first...",
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

type ThreadChangedFile = {
  path: string;
  added: number;
  deleted: number;
};

function normalizeWorkspacePath(path: string, workspacePath: string | null): string {
  const normalized = path.replace(/\\/g, "/").trim();
  if (!workspacePath) return normalized;
  const workspaceNormalized = workspacePath.replace(/\\/g, "/").replace(/\/+$/, "");
  if (normalized.startsWith(`${workspaceNormalized}/`)) {
    return normalized.slice(workspaceNormalized.length + 1);
  }
  return normalized;
}

function extractPatchPaths(input: unknown): string[] {
  const source = typeof input === "string" ? input : typeof input === "object" && input ? JSON.stringify(input) : "";
  if (!source) return [];
  const matches = [...source.matchAll(/\*\*\* (?:Add|Update) File: (.+)/g)];
  return matches.map((m) => m[1].trim()).filter(Boolean);
}

function countLines(text: string): number {
  if (!text) return 0;
  return text.split(/\r?\n/).length;
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

function getChangedFilesFromMessages(messages: AgentMessage[], workspacePath: string | null): ThreadChangedFile[] {
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
}

export const AgentPanel = () => {
  const [prompt, setPrompt] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>([]);
  const [allModelOptions, setAllModelOptions] = useState<AgentModelOption[]>(
    DEFAULT_MODEL_OPTIONS.map((m) => ({ ...m, provider: "claude" as const }))
  );
  const submitRef = useRef<(text: string, html: string, imageAttachments?: ImageAttachment[]) => void>(() => {});
  const editorRef = useRef<Editor | null>(null);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
  );

  const startAgent = useAgentStore((s) => s.startAgent);
  const stopAgent = useAgentStore((s) => s.stopAgent);
  const clearError = useAgentStore((s) => s.clearError);
  const persistWorkspace = useAgentStore((s) => s.persistWorkspace);
  const startNewThread = useAgentStore((s) => s.startNewThread);
  const setSelectedProviderAction = useAgentStore((s) => s.setSelectedProvider);
  const setSelectedModelAction = useAgentStore((s) => s.setSelectedModel);

  const runtime = useAgentStore((s) =>
    s.getActiveRuntime(activeWorkspaceId ?? "")
  );
  const activeThread = useAgentStore((s) =>
    s.getActiveThread(activeWorkspaceId ?? "")
  );
  const threadStatus = runtime.status;
  const threadError = runtime.error;
  const threadMessages = activeThread?.messages ?? [];
  const threadStreamingText = runtime.streamingText ?? "";

  const setAddContextHandler = useFileContextStore((s) => s.setAddContextHandler);
  const setMentionFileHandler = useFileContextStore((s) => s.setMentionFileHandler);
  const agentSkills = useAgentSkills();
  const openAgentLogDrawer = useUIStore((s) => s.openAgentLogDrawer);
  const openChangesViewer = useUIStore((s) => s.openChangesViewer);

  const handleAddContextToChat = useCallback(
    (ctx: FileContext) => {
      const insertContext = () => {
        const editor = editorRef.current;
        if (!editor) return;
        const fileName = ctx.filePath.split(/[/\\]/).pop() ?? ctx.filePath;
        const lineRange = ctx.startLine === ctx.endLine
          ? `:${ctx.startLine}`
          : `:${ctx.startLine}-${ctx.endLine}`;
        const end = editor.state.doc.content.size;
        const trimmedComment = ctx.comment?.trim();
        const mentionId = JSON.stringify({
          filePath: ctx.filePath,
          code: ctx.code,
          startLine: ctx.startLine,
          endLine: ctx.endLine,
          comment: trimmedComment || undefined,
        });
        const chain = editor
          .chain()
          .focus()
          .setTextSelection(end)
          .insertContent({
            type: "mention",
            attrs: {
              id: mentionId,
              label: `${fileName}${lineRange}`,
            },
          });
        if (trimmedComment) {
          chain.insertContent(` ${trimmedComment}`);
        }
        chain.insertContent(" ").run();
      };
      requestAnimationFrame(insertContext);
    },
    []
  );

  const mentionFileHandler = useCallback(
    (payload: MentionFilePayload) => {
      const insertMention = () => {
        const editor = editorRef.current;
        if (!editor) return;
        const workspacePath = payload.workspacePath ?? activeWorkspace?.path ?? null;
        const label = normalizeWorkspacePath(payload.filePath, workspacePath) || payload.filePath;
        editor
          .chain()
          .focus()
          .insertContent({
            type: "mention",
            attrs: {
              id: payload.filePath,
              label,
            },
          })
          .insertContent(" ")
          .run();
      };
      requestAnimationFrame(insertMention);
    },
    [activeWorkspace?.path]
  );

  useEffect(() => {
    setAddContextHandler(handleAddContextToChat);
    return () => setAddContextHandler(null);
  }, [setAddContextHandler, handleAddContextToChat]);

  useEffect(() => {
    setMentionFileHandler(mentionFileHandler);
    return () => setMentionFileHandler(null);
  }, [setMentionFileHandler, mentionFileHandler]);

  useEffect(() => {
    const api = getElectronAPI();
    if (!api?.agent?.getModels) return;
    api.agent.getModels().then((res) => {
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setAllModelOptions(res.data as AgentModelOption[]);
      }
    });
  }, []);

  const modelOptions = useMemo(
    () => allModelOptions.map((m) => ({ value: m.value, label: m.label })),
    [allModelOptions]
  );

  const handleModelChange = useCallback(
    (model: string) => {
      setSelectedModelAction(model);
      const match = allModelOptions.find((m) => m.value === model);
      if (match) setSelectedProviderAction(match.provider as "claude" | "codex");
    },
    [allModelOptions, setSelectedModelAction, setSelectedProviderAction]
  );

  const placeholder = activeWorkspace ? CHAT_PLACEHOLDER.withWorkspace : CHAT_PLACEHOLDER.noWorkspace;
  const editable = !!activeWorkspace && threadStatus !== "running";
  const threadChangedFiles = useMemo<ThreadChangedFile[]>(
    () => getChangedFilesFromMessages(threadMessages, activeWorkspace?.path ?? null),
    [threadMessages, activeWorkspace?.path]
  );
  const handleThreadChangedFileSelect = useCallback(
    (path: string) => {
      openChangesViewer(path);
    },
    [openChangesViewer]
  );

  useEffect(() => {
    if (activeWorkspaceId && !threadStreamingText) {
      persistWorkspace(activeWorkspaceId);
    }
  }, [activeWorkspaceId, threadMessages, threadStreamingText, persistWorkspace]);

  const extractMentionedSkillNames = useCallback((): string[] => {
    const json = editorRef.current?.getJSON();
    if (!json) return [];
    const skillMap = new Map(agentSkills.map((s) => [s.id, s.name]));
    const names: string[] = [];
    const walk = (node: Record<string, unknown>) => {
      if (node.type === "mention") {
        const id = (node.attrs as Record<string, string> | undefined)?.id;
        if (id && skillMap.has(id)) names.push(skillMap.get(id)!);
      }
      if (Array.isArray(node.content)) {
        for (const child of node.content) walk(child as Record<string, unknown>);
      }
    };
    walk(json as Record<string, unknown>);
    return [...new Set(names)];
  }, [agentSkills]);

  const withSkillHint = (text: string, skills: string[]): string => {
    if (skills.length === 0) return text;
    const hint = skills.length === 1
      ? `Use the "${skills[0]}" skill.`
      : `Use these skills: ${skills.map((n) => `"${n}"`).join(", ")}.`;
    return `${hint}\n\n${text}`;
  };

  const handleSubmitWithText = (text: string, html: string, attachments?: ImageAttachment[]) => {
    if ((!text.trim() && (!attachments || attachments.length === 0)) || !activeWorkspaceId || threadStatus === "running") return;
    const augmented = withSkillHint(text.trim(), extractMentionedSkillNames());
    const images = attachments?.length ? attachments : undefined;
    startAgent(activeWorkspaceId, augmented, {
      displayContent: html || undefined,
      imageAttachments: images,
    });
    setPrompt("");
    setImageAttachments([]);
  };

  const handleSubmit = () => {
    const text = editorRef.current?.getText().trim() ?? prompt.trim();
    if ((!text && imageAttachments.length === 0) || !activeWorkspaceId || threadStatus === "running") return;
    const html = editorRef.current?.getHTML();
    const augmented = withSkillHint(text, extractMentionedSkillNames());
    const images = imageAttachments.length ? imageAttachments : undefined;
    startAgent(activeWorkspaceId, augmented, {
      displayContent: html || undefined,
      imageAttachments: images,
    });
    editorRef.current?.commands.clearContent();
    setPrompt("");
    setImageAttachments([]);
  };

  const handleNewChat = async () => {
    if (!activeWorkspaceId) return;
    await startNewThread(activeWorkspaceId);
    editorRef.current?.commands.clearContent();
    setPrompt("");
    setImageAttachments([]);
  };

  useEffect(() => {
    submitRef.current = handleSubmitWithText;
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-end px-4 py-1.5 border-b border-border/30">
        <div className="flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode("chat")}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === "chat"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Chat
          </button>
          <button
            type="button"
            onClick={() => setViewMode("json")}
            className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === "json"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            JSON
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === "chat" ? <MessageList /> : <JsonMessageViewer />}
      </div>

      {threadError && (
        <Alert
          variant="destructive"
          className="mx-4 mb-2 border-red-500/30 bg-red-500/5 text-red-700"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <AlertDescription className="text-xs flex-1 min-w-0">
                <span className="whitespace-pre-wrap wrap-break-word">
                  {threadError.includes("\n") ? threadError.split("\n")[0] : threadError}
                </span>
              </AlertDescription>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="h-7 w-7 text-red-700 hover:bg-red-500/20"
                  onClick={() => void navigator.clipboard.writeText(threadError)}
                >
                  <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="h-7 w-7 text-red-700 hover:bg-red-500/20"
                  onClick={() => activeWorkspaceId && clearError(activeWorkspaceId)}
                >
                  <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  className="h-7 text-red-700 hover:bg-red-500/20"
                  onClick={openAgentLogDrawer}
                  title="View agent log for debugging"
                >
                  <span className="text-xs">Log</span>
                </Button>
              </div>
            </div>
            {threadError.startsWith("Claude Code process exited with code 1") && (
              <p className="text-[11px] text-red-600/90 mt-1">
                Common causes: auth (API key vs subscription), a tool returning too much data (e.g. search/grep), or the Resurf CLI not being on PATH in the agent environment. Try a shorter/simpler prompt or run the Resurf command in the workspace terminal to confirm it works.
              </p>
            )}
            {threadError.includes("\n") && (
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="details" className="border-red-500/20">
                  <AccordionTrigger className="py-2 text-xs text-red-700 hover:no-underline hover:text-red-800">
                    Details
                  </AccordionTrigger>
                  <AccordionContent className="pb-2 pt-0">
                    <pre className="text-[11px] font-mono whitespace-pre-wrap wrap-break-word max-h-48 overflow-auto rounded bg-red-500/10 p-2 text-red-800">
                      {threadError}
                    </pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        </Alert>
      )}

      <div className="mx-auto mb-4 w-full max-w-2xl shrink-0 px-2">
        <ChatEditor
          placeholder={placeholder}
          editable={editable}
          editorRef={editorRef}
          submitRef={submitRef}
          onPromptChange={setPrompt}
          isRunning={threadStatus === "running"}
          canSubmit={(!!prompt.trim() || imageAttachments.length > 0) && !!activeWorkspace}
          onStop={() => activeWorkspaceId && stopAgent(activeWorkspaceId)}
          onSubmit={handleSubmit}
          embedded
          modelOptions={modelOptions}
          onModelChange={handleModelChange}
          onNewChat={handleNewChat}
          canNewChat={!!activeWorkspace}
          activeWorkspace={activeWorkspace ? { name: activeWorkspace.name, path: activeWorkspace.path, branch: activeWorkspace.branch } : null}
          threadChangedFiles={threadChangedFiles}
          onThreadChangedFileSelect={handleThreadChangedFileSelect}
          imageAttachments={imageAttachments}
          onImageAttachmentsChange={setImageAttachments}
        />
      </div>
    </div>
  );
};
