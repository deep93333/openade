import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import type { SuggestionProps } from "@tiptap/suggestion";
import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import type { FileMentionItem } from "../mentions";
import { useWorkspaceFiles } from "@/hooks/use-workspace-files";
import { useAgentSkills } from "@/hooks/use-agent-skills";
import { useSkillHint } from "@/hooks/use-skill-hint";
import { useThreadChangedFiles } from "@/hooks/use-thread-changed-files";
import { useGitUnstagedChanges } from "@/hooks/use-git-changes";
import { filesToImageAttachments } from "@/utils/image-attachment";
import { ArrowUpIcon, Button, ImageIcon, StopIcon } from "@agentide/ui";
import { useAgentStore } from "@/store/agent";
import { useWorkspaceStore } from "@/store/workspace";
import { useChatEditorStore } from "@/store/editor";
import { useUIStore } from "@/store/ui";
import { useFileContextStore, type FileContext, type MentionFilePayload, type MentionElementPayload } from "@/store/context";
import { FileMentionList } from "../mentions";
import { EditorArea } from "./editor-area";
import { ChangedFilesBar } from "./changes";
import { EmbeddedToolbar } from "./toolbar";

import type { AgentMessage } from "@agentide/shared";
import type { ChatEditorProps } from "./types";

const CHAT_PLACEHOLDER = "Send a message to the agent...";
const NO_WORKSPACE_PLACEHOLDER = "Select a workspace first...";

const EMPTY_THREAD_MESSAGES: AgentMessage[] = [];

export const ChatEditor = ({ embedded = false }: ChatEditorProps) => {
  const [mentionProps, setMentionProps] = useState<SuggestionProps<FileMentionItem, MentionNodeAttrs> | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [isMentionTriggered, setIsMentionTriggered] = useState(false);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const mentionSelectedIndexRef = useRef(0);
  mentionSelectedIndexRef.current = mentionSelectedIndex;

  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [isChangedFilesExpanded, setIsChangedFilesExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);

  const mentionStateRef = useRef({
    setMentionProps,
    setMentionQuery,
    setIsMentionTriggered,
    isMentionTriggered: false,
    handleMentionKeyDown: (_e: KeyboardEvent) => false as boolean,
  });
  mentionStateRef.current.setMentionProps = setMentionProps;
  mentionStateRef.current.setMentionQuery = setMentionQuery;
  mentionStateRef.current.setIsMentionTriggered = setIsMentionTriggered;
  mentionStateRef.current.isMentionTriggered = isMentionTriggered;

  const workspaceFiles = useWorkspaceFiles();
  const agentSkills = useAgentSkills();
  const { augmentWithSkillHint } = useSkillHint();

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
  );

  const runtime = useAgentStore((s) =>
    s.getActiveRuntime(activeWorkspaceId ?? "")
  );
  const threadStatus = runtime.status;
  const isRunning = threadStatus === "running";

  const startAgent = useAgentStore((s) => s.startAgent);
  const loadWorkspace = useAgentStore((s) => s.loadWorkspace);
  const stopAgent = useAgentStore((s) => s.stopAgent);

  const { modelOptions, imageAttachments, addImageAttachments, removeImageAttachment, clearImageAttachments } =
    useChatEditorStore();

  const openDiffViewer = useUIStore((s) => s.openDiffViewer);

  const threadMessages = useAgentStore((s) => {
    const wsId = activeWorkspaceId ?? "";
    const thread = s.getActiveThread(wsId);
    return thread?.messages ?? EMPTY_THREAD_MESSAGES;
  });

  const threadChangedFiles = useThreadChangedFiles(threadMessages, activeWorkspace?.path ?? null);
  const unstagedChanges = useGitUnstagedChanges();

  const filteredThreadChangedFiles = useMemo(() => {
    const unstagedPaths = new Set(unstagedChanges.map((c) => c.path));
    return threadChangedFiles.filter((f) => unstagedPaths.has(f.path));
  }, [threadChangedFiles, unstagedChanges]);

  const changedFilesSummary = useMemo(
    () =>
      filteredThreadChangedFiles.reduce<{ added: number; deleted: number }>(
        (acc, file) => ({ added: acc.added + file.added, deleted: acc.deleted + file.deleted }),
        { added: 0, deleted: 0 }
      ),
    [filteredThreadChangedFiles]
  );

  useEffect(() => {
    if (filteredThreadChangedFiles.length === 0 && isChangedFilesExpanded) {
      setIsChangedFilesExpanded(false);
    }
  }, [filteredThreadChangedFiles.length, isChangedFilesExpanded]);

  const placeholder = activeWorkspace ? CHAT_PLACEHOLDER : NO_WORKSPACE_PLACEHOLDER;
  const canSubmit = !!activeWorkspaceId && !isRunning;

  const setAddContextHandler = useFileContextStore((s) => s.setAddContextHandler);
  const setMentionFileHandler = useFileContextStore((s) => s.setMentionFileHandler);
  const setMentionElementHandler = useFileContextStore((s) => s.setMentionElementHandler);

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
        const normalizeWorkspacePathInner = (path: string, wsPath: string | null): string => {
          const normalized = path.replace(/\\/g, "/").trim();
          if (!wsPath) return normalized;
          const workspaceNormalized = wsPath.replace(/\\/g, "/").replace(/\/+$/, "");
          if (normalized.startsWith(`${workspaceNormalized}/`)) {
            return normalized.slice(workspaceNormalized.length + 1);
          }
          return normalized;
        };
        const label = normalizeWorkspacePathInner(payload.filePath, workspacePath) || payload.filePath;
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

  const mentionElementHandler = useCallback((payload: MentionElementPayload) => {
    const insertMention = () => {
      const editor = editorRef.current;
      if (!editor) return;
      const shortLabel =
        payload.react.component
          ? `<${payload.react.component} />`
          : payload.id
            ? `${payload.tagName}#${payload.id}`
            : payload.classList.length > 0
              ? `${payload.tagName}.${payload.classList.slice(0, 2).join(".")}`
              : payload.selector;
      const mentionId = JSON.stringify({
        type: "element",
        ...payload,
      });
      editor
        .chain()
        .focus()
        .insertContent({
          type: "mention",
          attrs: {
            id: mentionId,
            label: shortLabel,
          },
        })
        .insertContent(" ")
        .run();
    };
    requestAnimationFrame(insertMention);
  }, []);

  useEffect(() => {
    setAddContextHandler(handleAddContextToChat);
    return () => setAddContextHandler(null);
  }, [setAddContextHandler, handleAddContextToChat]);

  useEffect(() => {
    setMentionFileHandler(mentionFileHandler);
    return () => setMentionFileHandler(null);
  }, [setMentionFileHandler, mentionFileHandler]);

  useEffect(() => {
    setMentionElementHandler(mentionElementHandler);
    return () => setMentionElementHandler(null);
  }, [setMentionElementHandler, mentionElementHandler]);

  const handleMentionStart = useCallback((props: SuggestionProps<FileMentionItem, MentionNodeAttrs>) => {
    mentionStateRef.current.setMentionProps(props);
    mentionStateRef.current.setMentionQuery(props.text?.slice(1) ?? "");
    mentionStateRef.current.setIsMentionTriggered(true);
  }, []);

  const handleMentionUpdate = useCallback((props: SuggestionProps<FileMentionItem, MentionNodeAttrs>) => {
    mentionStateRef.current.setMentionProps(props);
    mentionStateRef.current.setMentionQuery(props.text?.slice(1) ?? "");
  }, []);

  const handleMentionExit = useCallback(() => {
    mentionStateRef.current.setIsMentionTriggered(false);
    mentionStateRef.current.setMentionProps(null);
    mentionStateRef.current.setMentionQuery("");
  }, []);

  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!mentionQuery.trim()) {
      setDebouncedQuery("");
      return;
    }
    debounceRef.current = setTimeout(() => setDebouncedQuery(mentionQuery), 80);
    return () => clearTimeout(debounceRef.current);
  }, [mentionQuery]);

  const filteredFileMentions = useMemo(() => {
    if (!debouncedQuery.trim()) return workspaceFiles.slice(0, 15);
    const q = debouncedQuery.toLowerCase();
    return workspaceFiles
      .filter((f) => f.label.toLowerCase().includes(q) || f.id.toLowerCase().includes(q))
      .sort((a, b) => {
        const aName = a.label.split("/").pop()?.toLowerCase() ?? "";
        const bName = b.label.split("/").pop()?.toLowerCase() ?? "";
        const aNameMatch = aName.includes(q);
        const bNameMatch = bName.includes(q);
        if (aNameMatch !== bNameMatch) return aNameMatch ? -1 : 1;
        const aStartsWith = aName.startsWith(q);
        const bStartsWith = bName.startsWith(q);
        if (aStartsWith !== bStartsWith) return aStartsWith ? -1 : 1;
        return a.label.length - b.label.length;
      })
      .slice(0, 15);
  }, [workspaceFiles, debouncedQuery]);

  const filteredSkillMentions = useMemo((): FileMentionItem[] => {
    const q = mentionQuery.trim().toLowerCase();
    return agentSkills
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
      )
      .slice(0, 10)
      .map((s) => ({ id: s.id, label: s.name, type: "skill" as const }));
  }, [agentSkills, mentionQuery]);

  const mentionItems = useMemo(
    () => [...filteredSkillMentions, ...filteredFileMentions],
    [filteredSkillMentions, filteredFileMentions]
  );

  const handleMentionKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const items = mentionItems;
      const idx = mentionSelectedIndexRef.current;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionSelectedIndex((i) => Math.min(i + 1, items.length - 1));
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionSelectedIndex((i) => Math.max(i - 1, 0));
        return true;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = items[idx];
        if (item && mentionProps) {
          mentionProps.command(item);
          editorRef.current?.commands.focus();
          handleMentionExit();
        }
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleMentionExit();
        return true;
      }
      return false;
    },
    [mentionItems, mentionProps, handleMentionExit]
  );

  mentionStateRef.current.handleMentionKeyDown = handleMentionKeyDown;

  const mentionExtension = useMemo(
    () =>
      Mention.configure({
        HTMLAttributes: { class: "font-medium text-accent-foreground", "data-type": "mention" },
        renderHTML({ options, node }) {
          const id = node.attrs.id ?? "";
          let isElement = false;
          try {
            const parsed = JSON.parse(id);
            isElement = parsed?.type === "element";
          } catch {
            /* not element */
          }
          const baseAttrs = {
            ...options.HTMLAttributes,
            "data-id": id,
            "data-label": node.attrs.label ?? "",
            ...(isElement && { "data-mention-type": "element" }),
          };
          const label = node.attrs.label ?? "";
          if (isElement) {
            return [
              "span",
              baseAttrs,
              ["span", { class: "codicon codicon-code inline-block align-middle mr-1 opacity-70 text-[0.75em]" }],
              label,
            ];
          }
          return ["span", baseAttrs, label];
        },
        suggestion: {
          char: "@",
          items: () => [],
          render: () => ({
            onStart: handleMentionStart,
            onUpdate: handleMentionUpdate,
            onExit: handleMentionExit,
            onKeyDown: (props) => mentionStateRef.current.handleMentionKeyDown(props.event),
          }),
        },
      }),
    [handleMentionStart, handleMentionUpdate, handleMentionExit]
  );

  useEffect(() => {
    if (isMentionTriggered) setMentionSelectedIndex(0);
  }, [isMentionTriggered]);

  useEffect(() => {
    if (!isMentionTriggered) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === "Escape") {
        const handled = mentionStateRef.current.handleMentionKeyDown(e);
        if (handled) e.stopPropagation();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [isMentionTriggered]);

  const preventBlur = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
  }, []);

  const handleImageFiles = useCallback(
    async (files: FileList | File[]) => {
      setIsProcessingImages(true);
      try {
        const newAttachments = await filesToImageAttachments(files);
        addImageAttachments(newAttachments);
      } catch (error) {
        console.error("Failed to process images:", error);
      } finally {
        setIsProcessingImages(false);
      }
    },
    [addImageAttachments]
  );

  const handleRemoveImageAttachment = useCallback(
    (attachmentId: string) => {
      removeImageAttachment(attachmentId);
    },
    [removeImageAttachment]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files?.length) handleImageFiles(files);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [handleImageFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) handleImageFiles(files);
    },
    [handleImageFiles]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const imageFiles = Array.from(e.clipboardData.items)
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);
      if (imageFiles.length > 0) {
        e.preventDefault();
        handleImageFiles(imageFiles);
        return;
      }
      const text = e.clipboardData.getData("text/plain");
      if (text && editorRef.current) {
        e.preventDefault();
        editorRef.current.commands.insertContent(text);
      }
    },
    [handleImageFiles]
  );

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSubmit = useCallback(async () => {
    const ed = editorRef.current;
    if (!ed || isRunning) return;

    const currentWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;
    if (!currentWorkspaceId) return;

    const text = ed.getText().trim();
    const html = ed.getHTML();
    if (!text && imageAttachments.length === 0) return;

    await loadWorkspace(currentWorkspaceId);

    const augmentedText = augmentWithSkillHint(ed, text);
    const images = imageAttachments.length ? imageAttachments : undefined;

    startAgent(currentWorkspaceId, augmentedText, {
      displayContent: html || undefined,
      imageAttachments: images,
    });

    ed.commands.clearContent();
    clearImageAttachments();
  }, [isRunning, imageAttachments, augmentWithSkillHint, loadWorkspace, startAgent, clearImageAttachments]);

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder }), mentionExtension],
    content: "",
    editable: !isRunning,
    editorProps: {
      handleKeyDown: (_view, event) => {
        if (mentionStateRef.current.isMentionTriggered) {
          if (
            event.key === "ArrowDown" ||
            event.key === "ArrowUp" ||
            event.key === "Enter" ||
            event.key === "Escape"
          ) {
            const handled = mentionStateRef.current.handleMentionKeyDown(event);
            if (handled) return true;
          }
        }
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          handleSubmit();
          return true;
        }
        return false;
      },
    },
  }, [placeholder, isRunning]);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  const editorArea = (
    <EditorArea
      editor={editor}
      
      embedded={embedded}
      imageAttachments={imageAttachments}
      onRemoveImage={handleRemoveImageAttachment}
      isDragOver={isDragOver}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      fileInputRef={fileInputRef}
      onFileInputChange={handleFileInputChange}
    />
  );

  const mentionListOverlay =
    isMentionTriggered &&
    mentionProps && (
      <div className="absolute left-0 right-0 top-0 z-10 pt-2 flex justify-center pointer-events-none *:pointer-events-auto">
        <FileMentionList
          items={mentionItems}
          selectedIndex={Math.min(mentionSelectedIndex, Math.max(0, mentionItems.length - 1))}
          command={mentionProps.command}
          preventBlur={preventBlur}
          onSelect={() => editor?.commands.focus()}
          workspacePath={activeWorkspace?.path}
          anchorTop
        />
      </div>
    );

  const editorRow =
    embedded ? (
      editorArea
    ) : (
      <div className="flex flex-1 items-end gap-2 w-full">
        {editorArea}
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={openFileDialog}
          disabled={isRunning || isProcessingImages}
          title="Attach images"
        >
          <ImageIcon className="size-5" />
        </Button>
        {isRunning ? (
          <Button size="icon-sm" variant="destructive" onClick={() => activeWorkspaceId && stopAgent(activeWorkspaceId)} rounded="full">
            <StopIcon className="size-5" />
          </Button>
        ) : (
          <Button
            size="icon-sm"
            variant={canSubmit || imageAttachments.length > 0 ? "brand" : "secondary"}
            onClick={handleSubmit}
            disabled={!canSubmit && imageAttachments.length === 0}
            rounded="full"
          >
            <ArrowUpIcon className="size-5" />
          </Button>
        )}
      </div>
    );

  const showEmbeddedLayout = embedded;

  if (showEmbeddedLayout) {
    return (
      <div className="flex flex-col w-full relative">
        <div>
          {activeWorkspace && (
            <ChangedFilesBar
              threadChangedFiles={filteredThreadChangedFiles}
              summary={changedFilesSummary}
              isExpanded={isChangedFilesExpanded}
              onToggleExpanded={() => setIsChangedFilesExpanded((prev) => !prev)}
              onFileSelect={openDiffViewer}
              isRunning={isRunning}
            />
          )}

          <div className="relative z-10 w-full">
            {mentionListOverlay}
          </div>
          <div className="rounded-xl w-full shadow-card bg-background dark:bg-background dark:ring-1 dark:ring-foreground/10 dark:shadow-none relative">
            <div className="flex flex-col w-full p-2">{editorRow}</div>
            <EmbeddedToolbar
              isRunning={isRunning}
              canShowAttach
              onAttachClick={openFileDialog}
              isProcessingImages={isProcessingImages}
              canSubmit={canSubmit}
              imageCount={imageAttachments.length}
              onStop={() => activeWorkspaceId && stopAgent(activeWorkspaceId)}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col relative">
      {mentionListOverlay}
      {editorRow}
    </div>
  );
};
