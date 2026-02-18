import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Alert, AlertDescription } from "@agentide/ui";
import { useAgentStore } from "@/store/agent.store";
import { useFileContextStore } from "@/store/file-context.store";
import { useWorkspaceStore } from "@/store/workspace.store";
import { ChatEditor } from "./chat-editor";
import { MessageList } from "./message-list";
import { ToolApprovalBar } from "./tool-approval-bar";

const MODEL_OPTIONS = [
  { value: "claude-opus-4-6", label: "Claude Opus 4.6 (latest)" },
  { value: "claude-opus-4-1", label: "Claude Opus 4.1" },
  { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
  { value: "claude-3-opus-20240229", label: "Claude 3 Opus" },
];

const CHAT_PLACEHOLDER = {
  withWorkspace: "Send a message to the agent...",
  noWorkspace: "Select a workspace first...",
};

export const AgentPanel = () => {
  const [prompt, setPrompt] = useState("");
  const submitRef = useRef<(text: string) => void>(() => {});
  const editorRef = useRef<Editor | null>(null);

  const startAgent = useAgentStore((s) => s.startAgent);
  const stopAgent = useAgentStore((s) => s.stopAgent);
  const status = useAgentStore((s) => s.status);
  const totalCostUsd = useAgentStore((s) => s.totalCostUsd);
  const error = useAgentStore((s) => s.error);
  const messages = useAgentStore((s) => s.messages);
  const streamingText = useAgentStore((s) => s.streamingText);
  const initListeners = useAgentStore((s) => s.initListeners);
  const persistHistory = useAgentStore((s) => s.persistHistory);
  const loadHistory = useAgentStore((s) => s.loadHistory);
  const startNewThread = useAgentStore((s) => s.startNewThread);
  const selectedModel = useAgentStore((s) => s.selectedModel);
  const setSelectedModel = useAgentStore((s) => s.setSelectedModel);
  const requireApproval = useAgentStore((s) => s.requireApproval);
  const setRequireApproval = useAgentStore((s) => s.setRequireApproval);
  const pendingToolApproval = useAgentStore((s) => s.pendingToolApproval);
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const setAddContextHandler = useFileContextStore((s) => s.setAddContextHandler);

  const handleAddContextToChat = useCallback(
    (ctx: { filePath: string; code: string; startLine: number; endLine: number }) => {
      const editor = editorRef.current;
      if (!editor) return;
      const fileName = ctx.filePath.split(/[/\\]/).pop() ?? ctx.filePath;
      const lineRange = ctx.startLine === ctx.endLine
        ? `:${ctx.startLine}`
        : `:${ctx.startLine}-${ctx.endLine}`;
      const end = editor.state.doc.content.size;
      editor
        .chain()
        .focus()
        .setTextSelection(end)
        .insertContent({
          type: "mention",
          attrs: {
            id: JSON.stringify({ filePath: ctx.filePath, code: ctx.code, startLine: ctx.startLine, endLine: ctx.endLine }),
            label: `${fileName}${lineRange}`,
          },
        })
        .insertContent(" ")
        .run();
    },
    []
  );

  useEffect(() => {
    setAddContextHandler(handleAddContextToChat);
    return () => setAddContextHandler(null);
  }, [setAddContextHandler, handleAddContextToChat]);

  const placeholder = activeWorkspace ? CHAT_PLACEHOLDER.withWorkspace : CHAT_PLACEHOLDER.noWorkspace;
  const editable = !!activeWorkspace && status !== "running";

  useEffect(() => {
    const cleanup = initListeners();
    return cleanup;
  }, [initListeners]);

  useEffect(() => {
    if (activeWorkspace?.id) {
      loadHistory(activeWorkspace.id);
    }
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (activeWorkspace?.id && !streamingText) {
      persistHistory(activeWorkspace.id);
    }
  }, [activeWorkspace?.id, messages, streamingText, persistHistory]);

  const handleSubmitWithText = (text: string) => {
    if (!text.trim() || !activeWorkspace || status === "running") return;
    startAgent(text.trim(), activeWorkspace.id);
    setPrompt("");
  };

  const handleSubmit = () => {
    const text = editorRef.current?.getText().trim() ?? prompt.trim();
    if (!text || !activeWorkspace || status === "running") return;
    const html = editorRef.current?.getHTML();
    startAgent(text, activeWorkspace.id, html ? { displayContent: html } : undefined);
    editorRef.current?.commands.clearContent();
    setPrompt("");
  };

  const handleNewChat = async () => {
    if (status === "running" || !activeWorkspace?.id) return;
    await startNewThread(activeWorkspace.id);
    editorRef.current?.commands.clearContent();
    setPrompt("");
  };

  useEffect(() => {
    submitRef.current = handleSubmitWithText;
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <MessageList />

      {error && (
        <Alert variant="destructive" className="mx-4 mb-2 border-red-500/30 bg-red-500/5 text-red-700">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}


      <div className="shrink-0 mx-auto w-full max-w-2xl px-3 mb-3">
        <ChatEditor
          placeholder={placeholder}
          editable={editable}
          editorRef={editorRef}
          submitRef={submitRef}
          onPromptChange={setPrompt}
          isRunning={status === "running"}
          canSubmit={!!prompt.trim() && !!activeWorkspace}
          onStop={stopAgent}
          onSubmit={handleSubmit}
          embedded
          modelOptions={MODEL_OPTIONS}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          onNewChat={handleNewChat}
          requireApproval={requireApproval}
          setRequireApproval={setRequireApproval}
          totalCostUsd={totalCostUsd}
          canNewChat={!!activeWorkspace}
          activeWorkspace={activeWorkspace ? { name: activeWorkspace.name, path: activeWorkspace.path } : null}
        />
      </div>
    </div>
  );
};
