import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import type { SuggestionProps } from "@tiptap/suggestion";
import {
  ArrowUpIcon,
  Button,
  ButtonGroup,
  CheckmarkSmallIcon,
  ChevronDownIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@openade/ui";
import { cn } from "@/lib/cn";
import { FileMentionList, type FileMentionItem } from "../mentions";
import { useAgentStore } from "@/store/agent";
import { useWorkspaceStore } from "@/store/workspace";
import { useUIStore } from "@/store/ui";
import { getElectronAPI } from "@/lib/electron";
import type { FileTreeNode, AgentMode, TaskStatus } from "@openade/shared";

const MODE_OPTIONS: { value: AgentMode; label: string; status: TaskStatus; description: string }[] = [
  { value: "ask", label: "Ask", status: "brainstorm", description: "Quick questions without changing status" },
  { value: "plan", label: "Plan", status: "planning", description: "Create a plan before executing" },
  { value: "agent", label: "Agent", status: "in_progress", description: "Execute tasks automatically" },
];

// Default mode based on task status
const STATUS_TO_MODE: Record<TaskStatus, AgentMode> = {
  brainstorm: "ask",
  planning: "plan",
  in_progress: "agent",
  backlog: "agent",
  agent_review: "agent",
  in_review: "agent",
  completed: "agent",
  archived: "agent",
};


function flattenFileTree(node: FileTreeNode, rootPath: string): FileMentionItem[] {
  const files: FileMentionItem[] = [];
  const dirs: FileMentionItem[] = [];
  const queue: FileTreeNode[] = [node];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const relativePath = current.path.startsWith(rootPath)
      ? current.path.slice(rootPath.length).replace(/^\//, "")
      : current.name;

    if (relativePath) {
      const item: FileMentionItem = {
        id: current.path,
        label: relativePath,
        type: current.type === "file" ? "file" : "directory",
      };
      if (current.type === "file") files.push(item);
      else dirs.push(item);
    }

    if (current.children) queue.push(...current.children);
  }

  return [...files, ...dirs];
}

type PopoverChatEditorProps = {
  workspaceId: string;
  threadId: string;
  workspacePath: string | null;
  navigateOnSend?: boolean;
  onSent?: () => void;
  mode?: AgentMode;
};

export const PopoverChatEditor = ({
  workspaceId,
  threadId,
  workspacePath,
  navigateOnSend = true,
  onSent,
  mode: modeProp,
}: PopoverChatEditorProps) => {
  const [workspaceFiles, setWorkspaceFiles] = useState<FileMentionItem[]>([]);
  const [selectedMode, setSelectedMode] = useState<AgentMode>(() => {
    // Initialize from thread status if available
    return modeProp ?? "agent";
  });
  const [mentionProps, setMentionProps] = useState<SuggestionProps<FileMentionItem, MentionNodeAttrs> | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [isMentionTriggered, setIsMentionTriggered] = useState(false);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const mentionSelectedIndexRef = useRef(0);
  mentionSelectedIndexRef.current = mentionSelectedIndex;

  const loadWorkspace = useAgentStore((s) => s.loadWorkspace);
  const startAgent = useAgentStore((s) => s.startAgent);
  const isRunning = useAgentStore((s) => s.getThreadRuntime(workspaceId, threadId).status === "running");
  const threadTaskStatus = useAgentStore((s) => {
    const ws = s.workspaces[workspaceId];
    const thread = ws?.threads.find((t) => t.id === threadId);
    return thread?.taskStatus;
  });
  const setCenterPage = useUIStore((s) => s.setCenterPage);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  const switchThread = useAgentStore((s) => s.switchThread);
  const persistWorkspace = useAgentStore((s) => s.persistWorkspace);
  const updateThreadTaskStatus = useAgentStore((s) => s.updateThreadTaskStatus);

  // Update selected mode when thread status changes or modeProp changes
  useEffect(() => {
    if (modeProp) {
      setSelectedMode(modeProp);
    } else if (threadTaskStatus) {
      setSelectedMode(STATUS_TO_MODE[threadTaskStatus] ?? "agent");
    }
  }, [threadTaskStatus, modeProp]);

  useEffect(() => {
    if (!workspacePath) {
      setWorkspaceFiles([]);
      return;
    }
    const api = getElectronAPI();
    if (!api?.filesystem?.readDirectoryTree) {
      setWorkspaceFiles([]);
      return;
    }

    void api.filesystem.readDirectoryTree(workspacePath).then((res) => {
      if (res.success && res.data) {
        setWorkspaceFiles(flattenFileTree(res.data, workspacePath));
      } else {
        setWorkspaceFiles([]);
      }
    });
  }, [workspacePath]);

  const filteredFileMentions = useMemo(() => {
    const query = mentionQuery.trim().toLowerCase();
    if (!query) return workspaceFiles.slice(0, 15);
    return workspaceFiles
      .filter((f) => f.label.toLowerCase().includes(query) || f.id.toLowerCase().includes(query))
      .sort((a, b) => {
        const aName = a.label.split("/").pop()?.toLowerCase() ?? "";
        const bName = b.label.split("/").pop()?.toLowerCase() ?? "";
        const aMatch = aName.includes(query);
        const bMatch = bName.includes(query);
        if (aMatch !== bMatch) return aMatch ? -1 : 1;
        const aStarts = aName.startsWith(query);
        const bStarts = bName.startsWith(query);
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return a.label.length - b.label.length;
      })
      .slice(0, 15);
  }, [workspaceFiles, mentionQuery]);

  const filteredFileMentionsRef = useRef<FileMentionItem[]>([]);
  filteredFileMentionsRef.current = filteredFileMentions;

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

  const mentionPropsRef = useRef<SuggestionProps<FileMentionItem, MentionNodeAttrs> | null>(null);
  mentionPropsRef.current = mentionProps;

  const handleMentionKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!mentionStateRef.current.isMentionTriggered) return false;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionSelectedIndex((i) =>
          Math.min(i + 1, Math.max(0, filteredFileMentionsRef.current.length - 1))
        );
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionSelectedIndex((i) => Math.max(i - 1, 0));
        return true;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const item = filteredFileMentionsRef.current[mentionSelectedIndexRef.current];
        if (item && mentionPropsRef.current) {
          mentionPropsRef.current.command(item);
          editorRef.current?.commands.focus();
        }
        mentionStateRef.current.setIsMentionTriggered(false);
        mentionStateRef.current.setMentionProps(null);
        mentionStateRef.current.setMentionQuery("");
        return true;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        mentionStateRef.current.setIsMentionTriggered(false);
        mentionStateRef.current.setMentionProps(null);
        mentionStateRef.current.setMentionQuery("");
        return true;
      }
      return false;
    },
    []
  );
  mentionStateRef.current.handleMentionKeyDown = handleMentionKeyDown;

  useEffect(() => {
    if (!isMentionTriggered) return;
    const listener = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === "Escape") {
        const handled = mentionStateRef.current.handleMentionKeyDown(e);
        if (handled) e.stopPropagation();
      }
    };
    document.addEventListener("keydown", listener, true);
    return () => document.removeEventListener("keydown", listener, true);
  }, [isMentionTriggered]);

  useEffect(() => {
    if (isMentionTriggered) setMentionSelectedIndex(0);
  }, [isMentionTriggered]);

  const mentionExtension = useMemo(
    () =>
      Mention.configure({
        HTMLAttributes: {
          class:
              "inline-flex items-center gap-0.5 rounded-md bg-accent/20 border border-accent/30 px-1.5 py-0.5 text-xs font-medium text-accent-foreground leading-none",
          "data-type": "mention",
        },
        suggestion: {
          char: "@",
          items: () => [],
          render: () => ({
            onStart: (props) => {
              mentionStateRef.current.setMentionProps(props);
              mentionStateRef.current.setMentionQuery(props.text?.slice(1) ?? "");
              mentionStateRef.current.setIsMentionTriggered(true);
            },
            onUpdate: (props) => {
              mentionStateRef.current.setMentionProps(props);
              mentionStateRef.current.setMentionQuery(props.text?.slice(1) ?? "");
            },
            onExit: () => {
              mentionStateRef.current.setIsMentionTriggered(false);
              mentionStateRef.current.setMentionProps(null);
              mentionStateRef.current.setMentionQuery("");
            },
            onKeyDown: (props) => mentionStateRef.current.handleMentionKeyDown(props.event),
          }),
        },
      }),
    []
  );

  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);
  const handleSubmit = useCallback(async (modeToUse?: AgentMode) => {
    const ed = editorRef.current;
    if (!ed || isRunning) return;

    const text = ed.getText().trim();
    const html = ed.getHTML();
    if (!text) return;

    await loadWorkspace(workspaceId);

    const mode: AgentMode | undefined = modeToUse ?? selectedMode ?? modeProp ?? (threadTaskStatus === "planning" ? "plan" : undefined);

    // Update task status based on the mode being used
    const targetStatus = MODE_OPTIONS.find((o) => o.value === mode)?.status ?? "in_progress";
    if (targetStatus !== threadTaskStatus) {
      await updateThreadTaskStatus(workspaceId, threadId, targetStatus);
    }

    await startAgent(workspaceId, text, {
      displayContent: html || undefined,
      threadId,
      mode,
    });

    ed.commands.clearContent();
    await persistWorkspace(workspaceId);
    if (navigateOnSend) {
      await selectWorkspace(workspaceId);
      switchThread(workspaceId, threadId);
      setCenterPage("chat");
    }
    onSent?.();
  }, [workspaceId, threadId, isRunning, loadWorkspace, startAgent, persistWorkspace, navigateOnSend, selectWorkspace, switchThread, setCenterPage, onSent, threadTaskStatus, selectedMode, modeProp, updateThreadTaskStatus]);

  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: "Add a follow-up..." }),
        mentionExtension,
      ],
      content: "",
      editable: !isRunning,
      editorProps: {
        attributes: {
          class: "outline-none",
        },
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
            void handleSubmit();
            return true;
          }
          return false;
        },
      },
    },
    [mentionExtension, isRunning]
  );

  useEffect(() => {
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [editor]);

  const preventBlur = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
  }, []);

  const canSubmit = !!workspacePath && !isRunning;

  // Get button style based on SELECTED MODE (not task status)
  const currentModeLabel = MODE_OPTIONS.find((o) => o.value === selectedMode)?.label ?? "Agent";

  return (
    <div className="relative shrink-0 border-t border-foreground/10 p-2">
      <div className="flex items-end gap-1.5">
        <div
          className="flex min-w-0 flex-1 items-center"
          onClick={() => editor?.commands.focus()}
        >
          {editor && (
            <EditorContent
              editor={editor}
              className={cn(
                "w-full [&_.tiptap]:min-h-[32px] [&_.tiptap]:max-h-[100px] [&_.tiptap]:overflow-y-auto [&_.tiptap]:px-2 [&_.tiptap]:py-1.5 [&_.tiptap]:text-sm [&_.tiptap]:text-foreground [&_.tiptap]:outline-none [&_.tiptap]:caret-accent [&_.tiptap]:cursor-text",
                "[&_.tiptap_.ProseMirror]:caret-accent [&_.tiptap_.ProseMirror]:cursor-text",
                "[&_.tiptap_.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_.is-editor-empty:first-child::before]:float-left [&_.tiptap_.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_.is-editor-empty:first-child::before]:h-0"
              )}
            />
          )}
        </div>
        <ButtonGroup>
          <Button
            variant={selectedMode === "plan" ? "purple" : selectedMode === "ask" ? "orange" : "brand"}
            size="icon-sm"
            rounded="full"
            onClick={() => void handleSubmit(selectedMode)}
            disabled={!canSubmit}
          
   
          >
            <ArrowUpIcon className="size-4" />
          </Button>
          <DropdownMenu modal>
            <DropdownMenuTrigger asChild>
              <Button
            variant={selectedMode === "plan" ? "purple" : selectedMode === "ask" ? "orange" : "brand"}
            size="icon-sm"
            rounded="full"
                disabled={!canSubmit}
                className="border-l border-white/20"
                aria-label="Select send mode"
            
              >
                <ChevronDownIcon className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
             
              {MODE_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => {
                    setSelectedMode(option.value);
                    void handleSubmit(option.value);
                  }}
                  className="flex items-start justify-between gap-2"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{option.label}</span>
                  </div>
                  {selectedMode === option.value && (
                    <CheckmarkSmallIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </div>
      {isMentionTriggered && mentionProps && (
        <FileMentionList
          items={filteredFileMentions}
          selectedIndex={Math.min(mentionSelectedIndex, Math.max(0, filteredFileMentions.length - 1))}
          command={mentionProps.command}
          clientRect={mentionProps.clientRect}
          onSelect={() => editor?.commands.focus()}
          preventBlur={preventBlur}
          workspacePath={workspacePath ?? undefined}
          zIndexClassName="z-[10500]"
        />
      )}
    </div>
  );
};
