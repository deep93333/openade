import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import type { SuggestionProps } from "@tiptap/suggestion";
import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import { FileMentionList } from "./file-mention-list";
import { ToolApprovalBar } from "./tool-approval-bar";
import { useWorkspaceFiles } from "@/hooks/use-workspace-files";
import { useAgentStore } from "@/store/agent.store";
import {
  ArrowUpIcon,
  Button,
  ChevronDownIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  PlusIcon,
  StopIcon,
  Switch,
} from "@agentide/ui";
import { cn } from "@/lib/cn";

type ModelOption = { value: string; label: string };

type ChatEditorProps = {
  placeholder: string;
  editable: boolean;
  editorRef: React.MutableRefObject<Editor | null>;
  submitRef: React.MutableRefObject<(text: string) => void>;
  onPromptChange: (text: string) => void;
  isRunning: boolean;
  canSubmit: boolean;
  onStop: () => void;
  onSubmit: () => void;
  embedded?: boolean;
  modelOptions?: ModelOption[];
  selectedModel?: string;
  setSelectedModel?: (value: string) => void;
  onNewChat?: () => void;
  requireApproval?: boolean;
  setRequireApproval?: (value: boolean) => void;
  totalCostUsd?: number;
  canNewChat?: boolean;
  activeWorkspace?: { name: string; path: string } | null;
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
  selectedModel = "",
  setSelectedModel,
  onNewChat,
  requireApproval = false,
  setRequireApproval,
  totalCostUsd = 0,
  canNewChat = false,
  activeWorkspace = null,
}: ChatEditorProps) => {
  const [mentionProps, setMentionProps] = useState<SuggestionProps<
    { id: string; label: string },
    MentionNodeAttrs
  > | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [isMentionTriggered, setIsMentionTriggered] = useState(false);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const mentionSelectedIndexRef = useRef(0);
  mentionSelectedIndexRef.current = mentionSelectedIndex;

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
  const pendingToolApproval = useAgentStore((s) => s.pendingToolApproval);

  const handleMentionStart = useCallback(
    (props: SuggestionProps<{ id: string; label: string }, MentionNodeAttrs>) => {
      mentionStateRef.current.setMentionProps(props);
      mentionStateRef.current.setMentionQuery(props.text?.slice(1) ?? "");
      mentionStateRef.current.setIsMentionTriggered(true);
    },
    []
  );

  const handleMentionUpdate = useCallback(
    (props: SuggestionProps<{ id: string; label: string }, MentionNodeAttrs>) => {
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

  const handleMentionKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const items = filteredFileMentions;
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
    [filteredFileMentions, mentionProps, handleMentionExit, editorRef]
  );

  mentionStateRef.current.handleMentionKeyDown = handleMentionKeyDown;

  const mentionExtension = useMemo(
    () =>
      Mention.configure({
        HTMLAttributes: { class: "rounded bg-violet-100 px-1 py-0.5 text-violet-800" },
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
          if (text) {
            ed?.commands.clearContent();
            submitRef.current(text);
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
        embedded
          ? "min-h-[44px] bg-transparent"
          : "rounded-xl border border-zinc-300 bg-white"
      )}
      onClick={() => editor?.commands.focus()}
    >
      {editor && (
        <EditorContent
          editor={editor}
          className={cn(
            "[&_.tiptap]:min-h-[34px] [&_.tiptap]:px-2 [&_.tiptap]:py-2 [&_.tiptap]:text-sm [&_.tiptap]:text-zinc-800 [&_.tiptap]:outline-none [&_.tiptap]:caret-zinc-900 [&_.tiptap]:cursor-text",
            "[&_.tiptap_.ProseMirror]:caret-zinc-900 [&_.tiptap_.ProseMirror]:cursor-text",
            "[&_.tiptap_.is-editor-empty:first-child::before]:text-zinc-500 [&_.tiptap_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_.is-editor-empty:first-child::before]:float-left [&_.tiptap_.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_.is-editor-empty:first-child::before]:h-0"
          )}
        />
      )}
      {isMentionTriggered && mentionProps && (
        <FileMentionList
          items={filteredFileMentions}
          selectedIndex={Math.min(
            mentionSelectedIndex,
            Math.max(0, filteredFileMentions.length - 1)
          )}
          command={mentionProps.command}
          clientRect={mentionProps.clientRect}
          preventBlur={preventBlur}
          onSelect={() => editor?.commands.focus()}
        />
      )}
    </div>
  );

  const editorRow = embedded ? (
    editorArea
  ) : (
    <div className="flex flex-1 items-end gap-2 w-full">
      {editorArea}
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
          variant={canSubmit ? "brand" : "secondary"}
          onClick={onSubmit}
          disabled={!canSubmit}
          rounded="full"
        >
          <ArrowUpIcon className="size-5" />
        </Button>
      )}
    </div>
  );

  if (embedded && (modelOptions.length > 0 || onNewChat != null)) {
    return (
      <div className="flex flex-col w-full">
          {activeWorkspace && !pendingToolApproval && (
          <div className=" flex items-center gap-1.5 mx-2 px-3 py-2 bg-tertiary rounded-t-xl text-xs text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-green-600" />
            {activeWorkspace.name}
            <span className="text-muted-foreground">-</span>
            <span className="truncate max-w-[300px]">{activeWorkspace.path}</span>
          </div>
        )}

{pendingToolApproval && (
          <ToolApprovalBar request={pendingToolApproval} />
        )}
      <div className="rounded-xl w-full shadow-popover overflow-hidden bg-background">
       
        <div className="flex flex-col w-full p-2">{editorRow}</div>
        <div className="flex flex-wrap items-center gap-2 pb-2 px-2">
        
          {modelOptions.length > 0 && setSelectedModel != null && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  disabled={isRunning}
                >
                  <span className="truncate text-left">
                    {modelOptions.find((o) => o.value === selectedModel)?.label ?? selectedModel}
                  </span>
                  <ChevronDownIcon className="size-4 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[220px]">
                <DropdownMenuRadioGroup value={selectedModel} onValueChange={setSelectedModel}>
                  {modelOptions.map((opt) => (
                    <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <div className="ml-auto flex items-center gap-2">
            {setRequireApproval != null && (
              <label className="flex cursor-pointer items-center gap-1.5 py-1.5">
                <Switch
                  checked={requireApproval}
                  onCheckedChange={(checked) => setRequireApproval(checked === true)}
                  disabled={isRunning}
                />
                <span className="text-xs text-zinc-600">Require approval</span>
              </label>
            )}
            {totalCostUsd > 0 && (
              <span className="text-[10px] text-zinc-500">${totalCostUsd.toFixed(4)}</span>
            )}
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
                variant={canSubmit ? "brand" : "secondary"}
                onClick={onSubmit}
                disabled={!canSubmit}
              >
                <ArrowUpIcon className="size-4" />
              </Button>
            )}
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
