import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import type { SuggestionProps } from "@tiptap/suggestion";
import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import type { FileMentionItem } from "../file-mention-list";
import { useWorkspaceFiles } from "@/hooks/use-workspace-files";
import { useAgentSkills } from "@/hooks/use-agent-skills";
import { filesToImageAttachments } from "@/utils/image-attachment";
import { ArrowUpIcon, Button, ImageIcon, StopIcon } from "@agentide/ui";
import { EditorArea } from "./editor-area";
import { ChangedFilesBar } from "./changed-files-bar";
import { EmbeddedToolbar } from "./embedded-toolbar";
import { TokenUsagePopover } from "./token-usage-popover";
import type { ChatEditorProps } from "./types";

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
  activeWorkspace = null,
  threadChangedFiles = [],
  onThreadChangedFileSelect,
  imageAttachments = [],
  onImageAttachmentsChange,
}: ChatEditorProps) => {
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

  const changedFilesSummary = useMemo(
    () =>
      threadChangedFiles.reduce(
        (acc, file) => ({ added: acc.added + file.added, deleted: acc.deleted + file.deleted }),
        { added: 0, deleted: 0 }
      ),
    [threadChangedFiles]
  );

  useEffect(() => {
    if (threadChangedFiles.length === 0 && isChangedFilesExpanded) {
      setIsChangedFilesExpanded(false);
    }
  }, [threadChangedFiles.length, isChangedFilesExpanded]);

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
      if (!onImageAttachmentsChange) return;
      setIsProcessingImages(true);
      try {
        const newAttachments = await filesToImageAttachments(files);
        onImageAttachmentsChange([...imageAttachments, ...newAttachments]);
      } catch (error) {
        console.error("Failed to process images:", error);
      } finally {
        setIsProcessingImages(false);
      }
    },
    [imageAttachments, onImageAttachmentsChange]
  );

  const handleRemoveImageAttachment = useCallback(
    (attachmentId: string) => {
      if (!onImageAttachmentsChange) return;
      onImageAttachmentsChange(imageAttachments.filter((att) => att.id !== attachmentId));
    },
    [imageAttachments, onImageAttachmentsChange]
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

  const submitWithContent = useCallback(() => {
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
    extensions: [StarterKit, Placeholder.configure({ placeholder }), mentionExtension],
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
      isMentionTriggered={isMentionTriggered}
      mentionProps={mentionProps}
      mentionItems={mentionItems}
      mentionSelectedIndex={mentionSelectedIndex}
      preventBlur={preventBlur}
      workspacePath={activeWorkspace?.path}
      fileInputRef={fileInputRef}
      onFileInputChange={handleFileInputChange}
    />
  );

  const editorRow =
    embedded ? (
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
          <Button size="icon-sm" variant="destructive" onClick={onStop} rounded="full">
            <StopIcon className="size-5" />
          </Button>
        ) : (
          <Button
            size="icon-sm"
            variant={canSubmit || imageAttachments.length > 0 ? "brand" : "secondary"}
            onClick={submitWithContent}
            disabled={!canSubmit && imageAttachments.length === 0}
            rounded="full"
          >
            <ArrowUpIcon className="size-5" />
          </Button>
        )}
      </div>
    );

  const showEmbeddedLayout = embedded && (modelOptions.length > 0 || onNewChat != null);

  if (showEmbeddedLayout) {
    return (
      <div className="flex flex-col w-full relative">
        <div>
          {activeWorkspace && (
            <ChangedFilesBar
              threadChangedFiles={threadChangedFiles}
              summary={changedFilesSummary}
              isExpanded={isChangedFilesExpanded}
              onToggleExpanded={() => setIsChangedFilesExpanded((prev) => !prev)}
              onFileSelect={onThreadChangedFileSelect}
              isRunning={isRunning}
            />
          )}

          <div className="rounded-xl w-full shadow-card overflow-hidden bg-background/50 dark:bg-secondary/50 dark:ring-1 dark:ring-foreground/10 dark:shadow-none backdrop-blur-xl">
            <div className="flex flex-col w-full p-2">{editorRow}</div>
            <EmbeddedToolbar
              isRunning={isRunning}
              canShowAttach={!!onImageAttachmentsChange}
              onAttachClick={openFileDialog}
              isProcessingImages={isProcessingImages}
              modelOptions={modelOptions}
              onModelChange={onModelChange}
              canSubmit={canSubmit}
              imageCount={imageAttachments.length}
              onStop={onStop}
              onSubmit={submitWithContent}
            />
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
};
