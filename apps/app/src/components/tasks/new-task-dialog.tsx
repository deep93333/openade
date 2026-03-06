import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, MutableRefObject } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import type { SuggestionProps } from "@tiptap/suggestion";
import type { FileTreeNode, TaskStatus } from "@agentide/shared";
import {
  Button,
  ButtonGroup,
  ChevronDownIcon,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  cn,
} from "@agentide/ui";
import { FileMentionList, type FileMentionItem } from "@/components/agent/mentions";
import { getElectronAPI } from "@/lib/electron";
import { useAgentStore } from "@/store/agent";
import { useChatEditorStore } from "@/store/editor";

type WorkspaceOption = { id: string; name: string; path: string };

type TaskBacklogEditorProps = {
  workspacePath: string | null;
  placeholder: string;
  onTextChange: (value: string) => void;
  editorRef: MutableRefObject<Editor | null>;
};

function flattenFileTreeBreadthFirst(node: FileTreeNode, rootPath: string): FileMentionItem[] {
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

function TaskBacklogEditor({ workspacePath, placeholder, onTextChange, editorRef }: TaskBacklogEditorProps) {
  const [workspaceFiles, setWorkspaceFiles] = useState<FileMentionItem[]>([]);
  const [mentionProps, setMentionProps] = useState<SuggestionProps<FileMentionItem, MentionNodeAttrs> | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [isMentionTriggered, setIsMentionTriggered] = useState(false);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const mentionSelectedIndexRef = useRef(0);
  mentionSelectedIndexRef.current = mentionSelectedIndex;

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
        setWorkspaceFiles(flattenFileTreeBreadthFirst(res.data, workspacePath));
        return;
      }
      setWorkspaceFiles([]);
    });
  }, [workspacePath]);

  const filteredFileMentions = useMemo(() => {
    const query = mentionQuery.trim().toLowerCase();
    if (!query) return workspaceFiles.slice(0, 15);
    return workspaceFiles
      .filter((file) => file.label.toLowerCase().includes(query) || file.id.toLowerCase().includes(query))
      .sort((a, b) => {
        const aName = a.label.split("/").pop()?.toLowerCase() ?? "";
        const bName = b.label.split("/").pop()?.toLowerCase() ?? "";
        const aNameMatch = aName.includes(query);
        const bNameMatch = bName.includes(query);
        if (aNameMatch !== bNameMatch) return aNameMatch ? -1 : 1;
        const aStartsWith = aName.startsWith(query);
        const bStartsWith = bName.startsWith(query);
        if (aStartsWith !== bStartsWith) return aStartsWith ? -1 : 1;
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
    handleMentionKeyDown: (_event: KeyboardEvent) => false as boolean,
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
        setMentionSelectedIndex((index) => Math.min(index + 1, Math.max(0, filteredFileMentionsRef.current.length - 1)));
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionSelectedIndex((index) => Math.max(index - 1, 0));
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
    [editorRef]
  );
  mentionStateRef.current.handleMentionKeyDown = handleMentionKeyDown;

  useEffect(() => {
    if (!isMentionTriggered) return;
    const listener = (event: KeyboardEvent) => {
      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowUp" ||
        event.key === "Enter" ||
        event.key === "Escape"
      ) {
        const handled = mentionStateRef.current.handleMentionKeyDown(event);
        if (handled) event.stopPropagation();
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
              "inline-flex items-center gap-0.5 rounded-md bg-quaternary shadow-card px-1.5 py-0.5 text-xs font-medium text-foreground leading-none",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const onTextChangeRef = useRef(onTextChange);
  onTextChangeRef.current = onTextChange;

  const editor = useEditor(
    {
      extensions: [StarterKit, Placeholder.configure({ placeholder }), mentionExtension],
      content: "",
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
          return false;
        },
        attributes: {
          class:
            "min-h-[100px] max-h-[100px] w-full overflow-y-auto text-base outline-none",
        },
      },
      onUpdate: ({ editor: current }) => {
        onTextChangeRef.current(current.getText());
      },
    },
    [placeholder]
  );

  useEffect(() => {
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [editor, editorRef]);

  const preventBlur = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="relative">
      {editor != null && (
        <EditorContent
          editor={editor}
          className="[&_.tiptap_.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_.is-editor-empty:first-child::before]:float-left [&_.tiptap_.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_.is-editor-empty:first-child::before]:h-0"
        />
      )}
      {isMentionTriggered && mentionProps && (
        <FileMentionList
          items={filteredFileMentions}
          selectedIndex={Math.min(mentionSelectedIndex, Math.max(0, filteredFileMentions.length - 1))}
          command={mentionProps.command}
          clientRect={mentionProps.clientRect}
          onSelect={() => editor?.commands.focus()}
          preventBlur={preventBlur}
          workspacePath={workspacePath ?? undefined}
          zIndexClassName="z-[10400]"
        />
      )}
    </div>
  );
}

type NewTaskFormProps = {
  open: boolean;
  workspaces: WorkspaceOption[];
  defaultWorkspaceId: string | null;
  onCreate: (workspaceId: string, text: string, model?: string, initialStatus?: TaskStatus, provider?: import("@agentide/shared").AgentProvider) => Promise<void>;
  onClose: () => void;
};

function NewTaskForm({ open, workspaces, defaultWorkspaceId, onCreate, onClose }: NewTaskFormProps) {
  const [workspaceId, setWorkspaceId] = useState<string>(defaultWorkspaceId ?? "");
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const editorRef = useRef<Editor | null>(null);

  const agentSelectedModel = useAgentStore((s) => s.selectedModel);
  const setSelectedProvider = useAgentStore((s) => s.setSelectedProvider);
  const modelOptions = useChatEditorStore((s) => s.modelOptions);
  const fetchModelOptions = useChatEditorStore((s) => s.fetchModelOptions);

  useEffect(() => {
    if (open) void fetchModelOptions();
  }, [open, fetchModelOptions]);

  useEffect(() => {
    if (!open) return;
    if (defaultWorkspaceId) {
      setWorkspaceId(defaultWorkspaceId);
      return;
    }
    if (workspaces[0]?.id) setWorkspaceId(workspaces[0].id);
  }, [defaultWorkspaceId, open, workspaces]);

  useEffect(() => {
    if (!open) {
      setText("");
      setSelectedModel("");
      editorRef.current?.commands.clearContent();
    } else {
      setSelectedModel(agentSelectedModel || "");
    }
  }, [open, agentSelectedModel]);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceId) ?? null,
    [workspaceId, workspaces]
  );

  const modelOptionsFormatted = useMemo(
    () => modelOptions.map((m) => ({ value: m.value, label: m.label, provider: m.provider })),
    [modelOptions]
  );

  const canSubmit = text.trim().length > 0 && workspaceId.length > 0 && !isSubmitting;

  useHotkeys(
    "mod+enter",
    () => {
      if (canSubmit) void handleSubmit();
    },
    [canSubmit]
  );

  const handleSubmit = async (initialStatus?: TaskStatus) => {
    const value = editorRef.current?.getText().trim() ?? text.trim();
    if (!workspaceId || !value || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const modelToUse = selectedModel || agentSelectedModel || undefined;
      const providerToUse = modelToUse
        ? modelOptionsFormatted.find((o) => o.value === modelToUse)?.provider
        : undefined;
      await onCreate(workspaceId, value, modelToUse, initialStatus, providerToUse);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader className="flex-col gap-1">
       
        <DialogTitle className="flex border-b border-foreground/5 pb-3 flex-row items-center gap-2">
        New task
        <DropdownMenu modal>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <span className="truncate">{selectedWorkspace?.name ?? "Select workspace"}</span>
                <ChevronDownIcon className="size-3.5 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[260px]">
              <DropdownMenuRadioGroup value={workspaceId} onValueChange={setWorkspaceId}>
                {workspaces.map((workspace) => (
                  <DropdownMenuRadioItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu> 
        </DialogTitle>
       
      </DialogHeader>
      <DialogBody className="pt-6 gap-3">
        <TaskBacklogEditor
          workspacePath={selectedWorkspace?.path ?? null}
          placeholder="Describe the task backlog. Use @ to reference files..."
          onTextChange={setText}
          editorRef={editorRef}
        />
      </DialogBody>
      <DialogFooter className="mt-2">
      
        
          {modelOptionsFormatted.length > 0 && (
            <DropdownMenu modal>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <span className="truncate">
                    {(modelOptionsFormatted.find((o) => o.value === selectedModel)?.label ?? selectedModel) ||
                      "Select model"}
                  </span>
                  <ChevronDownIcon className="size-3.5 shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[220px]">
                <DropdownMenuRadioGroup
                  value={selectedModel || agentSelectedModel}
                  onValueChange={(value) => {
                    setSelectedModel(value);
                    const opt = modelOptionsFormatted.find((o) => o.value === value);
                    if (opt?.provider) setSelectedProvider(opt.provider);
                  }}
                >
                  {modelOptionsFormatted.map((opt) => (
                    <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <div className="flex-1"/>
        <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <ButtonGroup>
          <Button variant="brand" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            Create task
          </Button>
          <DropdownMenu modal>
            <DropdownMenuTrigger asChild>
              <Button variant="brand" size="icon" className="h-7.5! w-7.5! border-l border-brand-foreground/20" disabled={!canSubmit} aria-label="More options">
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void handleSubmit("in_progress")}>
                Start in progress
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleSubmit("planning")}>
                Plan first
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void handleSubmit("brainstorm")}>
                Brainstorm
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </DialogFooter>
    </>
  );
}

export type NewTaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaces: WorkspaceOption[];
  defaultWorkspaceId: string | null;
  onCreate: (workspaceId: string, text: string, model?: string, initialStatus?: TaskStatus, provider?: import("@agentide/shared").AgentProvider) => Promise<void>;
  contentClassName?: string;
  overlayClassName?: string;
  showCloseButton?: boolean;
};

export function NewTaskDialog({
  open,
  onOpenChange,
  workspaces,
  defaultWorkspaceId,
  onCreate,
  contentClassName,
  overlayClassName,
  showCloseButton = true,
}: NewTaskDialogProps) {
  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-w-xl p-4", contentClassName)}
        overlayClassName={overlayClassName}
        showCloseButton={showCloseButton}
      >
        <NewTaskForm
          open={open}
          workspaces={workspaces}
          defaultWorkspaceId={defaultWorkspaceId}
          onCreate={onCreate}
          onClose={handleClose}
        />
      </DialogContent>
    </Dialog>
  );
}
