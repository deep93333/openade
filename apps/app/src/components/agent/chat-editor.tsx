import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import type { SuggestionProps } from "@tiptap/suggestion";
import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import type { ImageAttachment } from "@agentide/shared";
import { FileMentionList, type FileMentionItem } from "./file-mention-list";
import { ImageAttachmentList } from "./image-attachment-preview";
import { useWorkspaceFiles } from "@/hooks/use-workspace-files";
import { useAgentSkills } from "@/hooks/use-agent-skills";
import { useAgentStore } from "@/store/agent.store";
import { useCostStore } from "@/store/cost.store";
import type { AgentMode } from "@agentide/shared";
import { filesToImageAttachments } from "@/utils/image-attachment";
import {
  ArrowUpIcon,
  Button,
  ChevronDownIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  ChatBubbleLineIcon,
  ImageIcon,
  LlmChatIcon,
  PlusIcon,
  StopIcon,
  Switch,
  TodoListIcon,
} from "@agentide/ui";
import { cn } from "@/lib/cn";
import { IconPaperclip, IconRepeat } from "@tabler/icons-react";
import { TokenUsagePopover } from "./chat-editor/token-usage-popover";

type ModelOption = { value: string; label: string };
type ThreadChangedFile = { path: string; added: number; deleted: number };

const AGENT_MODES: { value: AgentMode; label: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "agent", label: "Agent", description: "Full Claude Code agent with all tools", icon: LlmChatIcon },
  { value: "plan", label: "Plan", description: "Reads code and plans changes, no edits", icon: TodoListIcon },
  { value: "ask", label: "Ask", description: "Answers questions without using any tools", icon: ChatBubbleLineIcon },

];

const ModeSelector = ({
  selectedMode,
  onModeChange,
  disabled,
}: {
  selectedMode: AgentMode;
  onModeChange: (mode: AgentMode) => void;
  disabled?: boolean;
}) => (
  <div
    role="tablist"
    aria-label="Agent mode"
    className="flex h-7 gap-1 rounded-lg bg-foreground/5 p-0.5"
  >
    {AGENT_MODES.map((mode) => {
      const Icon = mode.icon;
      const isSelected = selectedMode === mode.value;
      return (
        <button
          key={mode.value}
          type="button"
          role="tab"
          aria-selected={isSelected}
          title={`${mode.label}: ${mode.description}`}
          disabled={disabled}
          onClick={() => onModeChange(mode.value)}
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
            isSelected ? "bg-background/80 shadow-card" : "hover:bg-foreground/5"
          )}
        >
          <Icon className="size-3.5 shrink-0" />
        </button>
      );
    })}
  </div>
);

type ChatEditorProps = {
  placeholder: string;
  editable: boolean;
  editorRef: React.MutableRefObject<Editor | null>;
  submitRef: React.MutableRefObject<(text: string, html: string, imageAttachments?: ImageAttachment[]) => void>;
  onPromptChange: (text: string) => void;
  isRunning: boolean;
  canSubmit: boolean;
  onStop: () => void;
  onSubmit: () => void;
  embedded?: boolean;
  modelOptions?: ModelOption[];
  onModelChange?: (model: string) => void;
  onNewChat?: () => void;
  canNewChat?: boolean;
  activeWorkspace?: { name: string; path: string; branch?: string } | null;
  threadChangedFiles?: ThreadChangedFile[];
  onThreadChangedFileSelect?: (path: string) => void;
  imageAttachments?: ImageAttachment[];
  onImageAttachmentsChange?: (attachments: ImageAttachment[]) => void;
};

export const ChatEditor = ({
  placeholder,
  editable,
  editorRef,
  submitRef,
  onPromptChange,
  isRunning,
  canSubmit,
  onStop,
  onSubmit,
  embedded = false,
  modelOptions = [],
  onModelChange,
  onNewChat,
  canNewChat = false,
  activeWorkspace = null,
  threadChangedFiles = [],
  onThreadChangedFileSelect,
  imageAttachments = [],
  onImageAttachmentsChange,
}: ChatEditorProps) => {
  const [mentionProps, setMentionProps] = useState<SuggestionProps<
    FileMentionItem,
    MentionNodeAttrs
  > | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [isMentionTriggered, setIsMentionTriggered] = useState(false);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const mentionSelectedIndexRef = useRef(0);
  mentionSelectedIndexRef.current = mentionSelectedIndex;

  // Image attachment state
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [isChangedFilesExpanded, setIsChangedFilesExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const selectedModel = useAgentStore((s) => s.selectedModel);
  const setSelectedModel = useAgentStore((s) => s.setSelectedModel);
  const selectedMode = useAgentStore((s) => s.selectedMode);
  const setSelectedMode = useAgentStore((s) => s.setSelectedMode);
  const requireApproval = useAgentStore((s) => s.requireApproval);
  const setRequireApproval = useAgentStore((s) => s.setRequireApproval);
  const totalCostUsd = useCostStore((s) => s.totalCostUsd);
  const changedFilesSummary = useMemo(() => {
    return threadChangedFiles.reduce(
      (acc, file) => ({ added: acc.added + file.added, deleted: acc.deleted + file.deleted }),
      { added: 0, deleted: 0 }
    );
  }, [threadChangedFiles]);

  useEffect(() => {
    if (threadChangedFiles.length === 0 && isChangedFilesExpanded) {
      setIsChangedFilesExpanded(false);
    }
  }, [threadChangedFiles.length, isChangedFilesExpanded]);

  const handleMentionStart = useCallback(
    (props: SuggestionProps<FileMentionItem, MentionNodeAttrs>) => {
      mentionStateRef.current.setMentionProps(props);
      mentionStateRef.current.setMentionQuery(props.text?.slice(1) ?? "");
      mentionStateRef.current.setIsMentionTriggered(true);
    },
    []
  );

  const handleMentionUpdate = useCallback(
    (props: SuggestionProps<FileMentionItem, MentionNodeAttrs>) => {
      mentionStateRef.current.setMentionProps(props);
      mentionStateRef.current.setMentionQuery(props.text?.slice(1) ?? "");
    },
    []
  );

  const handleMentionExit = useCallback(() => {
    mentionStateRef.current.setIsMentionTriggered(false);
    mentionStateRef.current.setMentionProps(null);
    mentionStateRef.current.setMentionQuery("");
  }, []);

  const filteredFileMentions = useMemo(() => {
    if (!mentionQuery.trim()) return workspaceFiles.slice(0, 15);
    const q = mentionQuery.toLowerCase();
    return workspaceFiles
      .filter((f) => f.label.toLowerCase().includes(q) || f.id.toLowerCase().includes(q))
      .slice(0, 15);
  }, [workspaceFiles, mentionQuery]);

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
    [mentionItems, mentionProps, handleMentionExit, editorRef]
  );

  mentionStateRef.current.handleMentionKeyDown = handleMentionKeyDown;

  const mentionExtension = useMemo(
    () =>
      Mention.configure({
        HTMLAttributes: { class: "rounded bg-background shadow-card px-1 py-0.5 text-foreground/50" },
        suggestion: {
          char: "@",
          items: () => [],
          render: () => ({
            onStart: handleMentionStart,
            onUpdate: handleMentionUpdate,
            onExit: handleMentionExit,
            onKeyDown: (props) =>
              mentionStateRef.current.handleMentionKeyDown(props.event),
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
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Enter" ||
        e.key === "Escape"
      ) {
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

  // Image attachment handlers
  const handleImageFiles = useCallback(async (files: FileList | File[]) => {
    if (!onImageAttachmentsChange) return;

    setIsProcessingImages(true);
    try {
      const newAttachments = await filesToImageAttachments(files);
      const updatedAttachments = [...imageAttachments, ...newAttachments];
      onImageAttachmentsChange(updatedAttachments);
    } catch (error) {
      console.error('Failed to process images:', error);
      // TODO: Show error toast
    } finally {
      setIsProcessingImages(false);
    }
  }, [imageAttachments, onImageAttachmentsChange]);

  const handleRemoveImageAttachment = useCallback((attachmentId: string) => {
    if (!onImageAttachmentsChange) return;
    const updatedAttachments = imageAttachments.filter(att => att.id !== attachmentId);
    onImageAttachmentsChange(updatedAttachments);
  }, [imageAttachments, onImageAttachmentsChange]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleImageFiles(files);
    }
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleImageFiles]);

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleImageFiles(files);
    }
  }, [handleImageFiles]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageFiles = items
      .filter(item => item.type.startsWith('image/'))
      .map(item => item.getAsFile())
      .filter(file => file !== null) as File[];

    if (imageFiles.length > 0) {
      e.preventDefault();
      handleImageFiles(imageFiles);
      return;
    }
    const text = e.clipboardData.getData('text/plain');
    if (text && editorRef.current) {
      e.preventDefault();
      editorRef.current.commands.insertContent(text);
    }
  }, [handleImageFiles]);

  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleSubmit = useCallback(() => {
    const ed = editorRef.current;
    const text = ed?.getText().trim() ?? "";
    const html = ed?.getHTML() ?? "";
    if (text || imageAttachments.length > 0) {
      ed?.commands.clearContent();
      submitRef.current(text, html, imageAttachments);
      onImageAttachmentsChange?.([]);
    }
    onSubmit();
  }, [editorRef, submitRef, imageAttachments, onImageAttachmentsChange, onSubmit]);

  const onPromptChangeRef = useRef(onPromptChange);
  onPromptChangeRef.current = onPromptChange;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      mentionExtension,
    ],
    content: "",
    editable: true,
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
          const ed = editorRef.current;
          const text = ed?.getText().trim() ?? "";
          const html = ed?.getHTML() ?? "";
          if (text || imageAttachments.length > 0) {
            ed?.commands.clearContent();
            submitRef.current(text, html, imageAttachments);
            onImageAttachmentsChange?.([]);
          }
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => onPromptChangeRef.current(ed.getText()),
  }, [placeholder]);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  const editorArea = (
    <div
      className={cn(
        "relative w-full min-w-0 scrollbar-thin scrollbar-thumb-zinc-300",
        "focus-within:outline-none focus-within:ring-0 focus-within:border-zinc-300 cursor-text",
        "transition-colors duration-200",
        embedded
          ? "min-h-[44px] bg-transparent"
          : "rounded-xl border border-zinc-300 bg-white",
        isDragOver && "border-blue-400 bg-blue-50 dark:bg-blue-950/20"
      )}
      onClick={() => editor?.commands.focus()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      {imageAttachments.length > 0 && (
        <div className="px-2 pt-2">
          <ImageAttachmentList
            attachments={imageAttachments}
            onRemove={handleRemoveImageAttachment}
          />
        </div>
      )}

      {editor && (
        <EditorContent
          editor={editor}
          className={cn(
            "[&_.tiptap]:min-h-[34px] [&_.tiptap]:px-2 [&_.tiptap]:py-2 [&_.tiptap]:text-sm [&_.tiptap]:text-foreground [&_.tiptap]:outline-none [&_.tiptap]:caret-accent [&_.tiptap]:cursor-text",
            "[&_.tiptap_.ProseMirror]:caret-accent [&_.tiptap_.ProseMirror]:cursor-text",
            "[&_.tiptap_.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_.is-editor-empty:first-child::before]:float-left [&_.tiptap_.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_.is-editor-empty:first-child::before]:h-0",
            imageAttachments.length > 0 && "[&_.tiptap]:pt-1"
          )}
        />
      )}

      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-50/90 dark:bg-blue-950/30 rounded-xl border-2 border-dashed border-blue-400">
          <div className="text-center">
            <ImageIcon className="mx-auto h-8 w-8 text-blue-500 mb-2" />
            <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              Drop images here to attach
            </p>
          </div>
        </div>
      )}

      {isMentionTriggered && mentionProps && (
        <FileMentionList
          items={mentionItems}
          selectedIndex={Math.min(mentionSelectedIndex, Math.max(0, mentionItems.length - 1))}
          command={mentionProps.command}
          clientRect={mentionProps.clientRect}
          preventBlur={preventBlur}
          onSelect={() => editor?.commands.focus()}
          workspacePath={activeWorkspace?.path}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />
    </div>
  );

  const editorRow = embedded ? (
    editorArea
  ) : (
    <div className="flex flex-1 items-end gap-2 w-full">
      {editorArea}
      {onImageAttachmentsChange && (
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={openFileDialog}
          disabled={isRunning || isProcessingImages}
          title="Attach images"
        >
          <ImageIcon className="size-5" />
        </Button>
      )}
      <TokenUsagePopover />
      {isRunning ? (
        <Button
          size="icon-sm"
          variant="destructive"
          onClick={onStop}
          rounded="full"
        >
          <StopIcon className="size-5" />
        </Button>
      ) : (
        <Button
          size="icon-sm"
          variant={canSubmit || imageAttachments.length > 0 ? "brand" : "secondary"}
          onClick={onSubmit}
          disabled={!canSubmit && imageAttachments.length === 0}
          rounded="full"
        >
          <ArrowUpIcon className="size-5" />
        </Button>
      )}
    </div>
  );

  if (embedded && (modelOptions.length > 0 || onNewChat != null)) {
    return (
      <div className="flex flex-col w-full relative">
        <div>
          {activeWorkspace && (
            <div className="mx-2 px-3 py-0.5 min-h-9 bg-tertiary/90 dark:bg-background backdrop-blur-xl ring-1 ring-foreground/10 rounded-t-xl text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5 w-full">
                <button
                  type="button"
                  className="inline-flex cursor-pointer shrink-0 flex-1 items-center gap-1.5 text-xs text-foreground/70 hover:text-foreground transition-colors"
                  onClick={() => setIsChangedFilesExpanded((prev) => !prev)}
                  disabled={isRunning}
                >
                  <span className="truncate">
                    Changed files ({threadChangedFiles.length})
                  </span>
                  {(changedFilesSummary.added > 0 || changedFilesSummary.deleted > 0) && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      {changedFilesSummary.added > 0 && (
                        <span className="rounded bg-green-500/15 px-1 text-green-700 dark:text-green-400">
                          +{changedFilesSummary.added}
                        </span>
                      )}
                      {changedFilesSummary.deleted > 0 && (
                        <span className="rounded bg-red-500/15 px-1 text-red-700 dark:text-red-400">
                          -{changedFilesSummary.deleted}
                        </span>
                      )}
                    </span>
                  )}
                  <div className="flex-1" />
                  <ChevronDownIcon
                    className={cn(
                      "size-3.5 shrink-0 opacity-60 transition-transform",
                      isChangedFilesExpanded && "rotate-180"
                    )}
                  />
                </button>
                {setRequireApproval != null && (
                  <label className="flex cursor-pointer items-center gap-1.5 py-1.5">
                    <IconRepeat stroke={1.75} className="size-3.5 text-foreground/50" />
                    <span className="text-xs text-foreground/50">Auto mode</span>
                    <Switch
                      checked={!requireApproval}
                      onCheckedChange={(checked) => setRequireApproval(checked !== true)}
                      disabled={isRunning}
                    />
                  </label>
                )}
              </div>
              {threadChangedFiles.length > 0 && isChangedFilesExpanded && (
                <div className="max-h-[180px] my-1 overflow-y-auto bg-background/50 dark:bg-foreground/5 backdrop-blur-xl rounded-lg p-1 ring-1 ring-foreground/10">
                  {threadChangedFiles.map((file) => (
                    <button
                      key={file.path}
                      type="button"
                      onClick={() => onThreadChangedFileSelect?.(file.path)}
                      className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-foreground/5"
                    >
                      <span className="min-w-0 flex-1 truncate text-xs text-foreground/80">{file.path}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        {file.added > 0 && (
                          <span className="rounded bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-400">
                            +{file.added}
                          </span>
                        )}
                        {file.deleted > 0 && (
                          <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:text-red-400">
                            -{file.deleted}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl w-full shadow-card overflow-hidden bg-background/50 dark:bg-secondary dark:ring-1 dark:ring-foreground/10 dark:shadow-none backdrop-blur-xl">
       
        <div className="flex flex-col w-full p-2">{editorRow}</div>
        <div className="flex flex-wrap items-center gap-2 pb-2 px-2">

<div className="flex items-center gap-2">
          <ModeSelector
            selectedMode={selectedMode}
            onModeChange={setSelectedMode}
            disabled={isRunning}
          />
            {onImageAttachmentsChange && (
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={openFileDialog}
                disabled={isRunning || isProcessingImages}
                title="Attach images"
              >
                <IconPaperclip stroke={1.5} className="size-4" />
              </Button>
            )}
            </div>

          <div className="ml-auto flex items-center gap-2">
            {modelOptions.length > 0 && setSelectedModel != null && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="xs"
                    disabled={isRunning}
                  >
                    <span className="truncate text-xs text-left">
                      {modelOptions.find((o) => o.value === selectedModel)?.label ?? selectedModel}
                    </span>
                    <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[220px]">
                  <DropdownMenuRadioGroup value={selectedModel} onValueChange={onModelChange ?? setSelectedModel}>
                    {modelOptions.map((opt) => (
                      <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          

          <TokenUsagePopover />
            {isRunning ? (
              <Button
                size="icon-sm"
                rounded="full"
                variant="secondary"
                onClick={onStop}
              >
                <StopIcon className="size-4" />
              </Button>
            ) : (
              <Button
                size="icon-sm"
                rounded="full"
                variant={canSubmit || imageAttachments.length > 0 ? "brand" : "secondary"}
                onClick={onSubmit}
                disabled={!canSubmit && imageAttachments.length === 0}
              >
                <ArrowUpIcon className="size-4" />
              </Button>
            )}
          </div>
        </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col">
    
      {editorRow}
    </div>
  );
}
