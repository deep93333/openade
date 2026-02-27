import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import type { MentionNodeAttrs } from "@tiptap/extension-mention";
import type { SuggestionProps } from "@tiptap/suggestion";
import type { ChatThread, FileTreeNode, TaskStatus } from "@agentide/shared";
import {
  Badge,
  Button,
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
} from "@agentide/ui";
import {
  IconCircleCheckFilled,
  IconCircleDot,
  IconCircleDotted,
  IconDots,
  IconFile,
  IconPlus,
  IconProgress,
} from "@tabler/icons-react";
import { AppTopBar } from "@/components/app-top-bar";
import { FileMentionList, type FileMentionItem } from "@/components/agent/file-mention-list";
import { getElectronAPI } from "@/lib/electron";
import { useWorkspaceStore } from "@/store/workspace.store";
import { useAgentStore } from "@/store/agent.store";
import { useUIStore } from "@/store/ui.store";
import { getTaskStatusLabel } from "../shared/task-status-badge";

const taskStatuses: TaskStatus[] = ["backlog", "in_progress", "in_review", "completed"];

const taskStatusLabels: Record<TaskStatus, string> = {
  backlog: "To do",
  in_progress: "Doing",
  in_review: "Review",
  completed: "Done",
};

function getTaskStatusIcon(status: TaskStatus) {
  switch (status) {
    case "in_progress":
      return <IconProgress className="size-4 text-accent shrink-0" stroke={2} />;
    case "in_review":
      return <IconCircleDot className="size-4 text-amber-700 shrink-0" stroke={2} />;
    case "completed":
      return <IconCircleCheckFilled className="size-4 text-accent shrink-0" stroke={2} />;
    case "backlog":
    default:
      return <IconCircleDotted className="size-4 text-muted-foreground shrink-0" stroke={2} />;
  }
}

function getTaskTitle(thread: ChatThread): string {
  if (thread.title?.trim()) return thread.title.trim();
  const firstUserMessage = thread.messages.find((message) => message.role === "user");
  if (firstUserMessage?.content) {
    const text = firstUserMessage.content.trim().replace(/\s+/g, " ");
    if (text.length > 48) return `${text.slice(0, 48)}...`;
    return text;
  }
  return "Untitled task";
}

function getRelativeTimeLabel(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const isFuture = diffMs < 0;
  const absMs = Math.abs(diffMs);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;

  const nowDate = new Date(now);
  const targetDate = new Date(timestamp);
  const nowStartOfDay = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
  const targetStartOfDay = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate()
  ).getTime();
  const dayDiff = Math.round((nowStartOfDay - targetStartOfDay) / day);

  if (!isFuture && dayDiff === 0) {
    if (absMs < minute) return "just now";
    if (absMs < hour) return `${Math.max(1, Math.round(absMs / minute))}m ago`;
    if (absMs < 6 * hour) return `${Math.max(1, Math.round(absMs / hour))}h ago`;
    return "today";
  }

  if (!isFuture && dayDiff === 1) return "yesterday";

  if (absMs < minute) return "soon";
  if (absMs < hour) return isFuture ? `in ${Math.max(1, Math.round(absMs / minute))}m` : `${Math.max(1, Math.round(absMs / minute))}m ago`;
  if (absMs < day) return isFuture ? `in ${Math.max(1, Math.round(absMs / hour))}h` : `${Math.max(1, Math.round(absMs / hour))}h ago`;
  if (absMs < week) return isFuture ? `in ${Math.max(1, Math.round(absMs / day))}d` : `${Math.max(1, Math.round(absMs / day))}d ago`;
  if (absMs < month) return isFuture ? `in ${Math.max(1, Math.round(absMs / week))}w` : `${Math.max(1, Math.round(absMs / week))}w ago`;
  if (absMs < year) return isFuture ? `in ${Math.max(1, Math.round(absMs / month))}mo` : `${Math.max(1, Math.round(absMs / month))}mo ago`;
  return isFuture ? `in ${Math.max(1, Math.round(absMs / year))}y` : `${Math.max(1, Math.round(absMs / year))}y ago`;
}

type WorkspaceTask = {
  workspaceId: string;
  workspaceName: string;
  thread: ChatThread;
};

type WorkspaceOption = { id: string; name: string; path: string };

function flattenFileTree(node: FileTreeNode, rootPath: string): FileMentionItem[] {
  const result: FileMentionItem[] = [];

  const relativePath = node.path.startsWith(rootPath)
    ? node.path.slice(rootPath.length).replace(/^\//, "")
    : node.name;

  if (relativePath && node.type === "file") {
    result.push({ id: node.path, label: relativePath, type: "file" });
  } else if (relativePath && node.type === "directory") {
    result.push({ id: node.path, label: relativePath, type: "directory" });
  }

  const children = node.children ?? [];
  for (const child of children) result.push(...flattenFileTree(child, rootPath));

  return result;
}

type TaskBacklogEditorProps = {
  workspacePath: string | null;
  placeholder: string;
  onTextChange: (value: string) => void;
  editorRef: React.MutableRefObject<Editor | null>;
};

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
        setWorkspaceFiles(flattenFileTree(res.data, workspacePath));
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
        setMentionSelectedIndex((index) =>
          Math.min(index + 1, Math.max(0, filteredFileMentionsRef.current.length - 1))
        );
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
        HTMLAttributes: { class: "rounded bg-background shadow-card px-1 py-0.5 text-foreground/50" },
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
            "min-h-[140px] w-full rounded-lg border border-foreground/10 bg-background px-3 py-2 text-sm outline-none",
        },
      },
      onUpdate: ({ editor: currentEditor }) => onTextChangeRef.current(currentEditor.getText()),
    },
    [placeholder]
  );

  useEffect(() => {
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [editor, editorRef]);

  const preventBlur = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="relative">
      {editor != null && <EditorContent editor={editor} />}
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

type NewTaskDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaces: WorkspaceOption[];
  defaultWorkspaceId: string | null;
  onCreate: (workspaceId: string, text: string) => Promise<void>;
};

function NewTaskDialog({
  open,
  onOpenChange,
  workspaces,
  defaultWorkspaceId,
  onCreate,
}: NewTaskDialogProps) {
  const [workspaceId, setWorkspaceId] = useState<string>(defaultWorkspaceId ?? "");
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const editorRef = useRef<Editor | null>(null);

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
      editorRef.current?.commands.clearContent();
    }
  }, [open]);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceId) ?? null,
    [workspaceId, workspaces]
  );

  const canSubmit = text.trim().length > 0 && workspaceId.length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    const value = editorRef.current?.getText().trim() ?? text.trim();
    if (!workspaceId || !value || isSubmitting) return;
    setIsSubmitting(true);
    await onCreate(workspaceId, value);
    setIsSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => onOpenChange(nextOpen)}>
      <DialogContent className="max-w-xl p-4">
        <DialogHeader className="flex-col gap-1">
          <DialogTitle className="flex flex-row items-center gap-2">New task   <DropdownMenu modal>
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
            </DropdownMenu></DialogTitle>
          <DialogDescription>
            Create a backlog task with context. Type <span className="font-medium">@</span> to reference files.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="mt-2 gap-3">
        
          <TaskBacklogEditor
            workspacePath={selectedWorkspace?.path ?? null}
            placeholder="Describe the task backlog. Use @ to reference files..."
            onTextChange={setText}
            editorRef={editorRef}
          />
        </DialogBody>
        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="brand" onClick={() => void handleSubmit()} disabled={!canSubmit}>
            Create task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type WorkspaceFilterDropdownProps = {
  workspaceFilter: string;
  workspaceFilterLabel: string;
  workspaces: { id: string; name: string }[];
  onWorkspaceFilterChange: (value: string) => void;
};

function WorkspaceFilterDropdown({
  workspaceFilter,
  workspaceFilterLabel,
  workspaces,
  onWorkspaceFilterChange,
}: WorkspaceFilterDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 justify-between text-xs">
          <span className="truncate">{workspaceFilterLabel}</span>
          <ChevronDownIcon className="size-3.5 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[240px]">
        <DropdownMenuRadioGroup value={workspaceFilter} onValueChange={onWorkspaceFilterChange}>
          <DropdownMenuRadioItem value="all">All workspaces</DropdownMenuRadioItem>
          {workspaces.map((workspace) => (
            <DropdownMenuRadioItem key={workspace.id} value={workspace.id}>
              {workspace.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type TaskStatusFiltersProps = {
  statusFilter: "all" | TaskStatus;
  allTasksCount: number;
  tasksByStatus: Record<TaskStatus, WorkspaceTask[]>;
  onStatusFilterChange: (status: "all" | TaskStatus) => void;
};

function TaskStatusFilters({
  statusFilter,
  allTasksCount,
  tasksByStatus,
  onStatusFilterChange,
}: TaskStatusFiltersProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant={statusFilter === "all" ? "secondary" : "ghost"}
        onClick={() => onStatusFilterChange("all")}
      >
        All
        <Badge variant="outline" size="sm">
          {allTasksCount}
        </Badge>
      </Button>
      {taskStatuses.map((status) => (
        <Button
          key={status}
          size="sm"
          variant={statusFilter === status ? "secondary" : "ghost"}
          onClick={() => onStatusFilterChange(status)}
        >
          {getTaskStatusIcon(status)}
          {taskStatusLabels[status]}
          <Badge variant="outline" size="sm">
            {tasksByStatus[status].length}
          </Badge>
        </Button>
      ))}
    </div>
  );
}

type TaskRowProps = {
  task: WorkspaceTask;
  canDelete: boolean;
  isRunning: boolean;
  onOpenChat: (workspaceId: string, threadId: string) => Promise<void>;
  onStatusChange: (workspaceId: string, threadId: string, nextStatus: TaskStatus) => Promise<void>;
  onDeleteTask: (workspaceId: string, threadId: string) => Promise<void>;
};

function TaskRow({ task, canDelete, isRunning, onOpenChat, onStatusChange, onDeleteTask }: TaskRowProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-foreground/5">
      <button
        type="button"
        onClick={() => void onOpenChat(task.workspaceId, task.thread.id)}
        className="flex min-w-0 flex-1  items-center gap-3 rounded-lg px-2 py-1 text-left"
      >
        <span className="w-20 shrink-0 text-xs text-muted-foreground">
          {getRelativeTimeLabel(task.thread.createdAt)}
        </span>
        <span className="truncate flex-1 text-sm font-medium">{getTaskTitle(task.thread)}</span>
        
      </button>

      {isRunning && (
        <Badge variant="outline" size="sm">
          <IconProgress className="size-3.5 animate-pulse" stroke={2} />
          Running
        </Badge>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            {getTaskStatusIcon(task.thread.taskStatus ?? "backlog")}
            {getTaskStatusLabel(task.thread.taskStatus ?? "backlog")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {taskStatuses.map((taskStatus) => (
            <DropdownMenuItem
              key={taskStatus}
              onSelect={() => void onStatusChange(task.workspaceId, task.thread.id, taskStatus)}
            >
              {getTaskStatusIcon(taskStatus)}
              {taskStatusLabels[taskStatus]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Task actions">
            <IconDots className="size-4" stroke={2} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={!canDelete}
            onSelect={() => void onDeleteTask(task.workspaceId, task.thread.id)}
          >
            Delete task
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export const TasksPage = () => {
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const selectWorkspace = useWorkspaceStore((state) => state.selectWorkspace);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const agentWorkspaces = useAgentStore((state) => state.workspaces);
  const loadWorkspace = useAgentStore((state) => state.loadWorkspace);
  const createTaskThread = useAgentStore((state) => state.createTaskThread);
  const updateThreadTaskStatus = useAgentStore((state) => state.updateThreadTaskStatus);
  const deleteThread = useAgentStore((state) => state.deleteThread);
  const switchThread = useAgentStore((state) => state.switchThread);
  const persistWorkspace = useAgentStore((state) => state.persistWorkspace);
  const setCenterPage = useUIStore((state) => state.setCenterPage);

  const [workspaceFilter, setWorkspaceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [newTaskDialogOpen, setNewTaskDialogOpen] = useState(false);
  const workspaceFilterLabel =
    workspaceFilter === "all"
      ? "All workspaces"
      : workspaces.find((workspace) => workspace.id === workspaceFilter)?.name ?? "All workspaces";

  useEffect(() => {
    if (workspaceFilter !== "all") return;
    for (const workspace of workspaces) {
      if (!agentWorkspaces[workspace.id]) {
        void loadWorkspace(workspace.id);
      }
    }
  }, [agentWorkspaces, loadWorkspace, workspaceFilter, workspaces]);

  useEffect(() => {
    if (workspaceFilter === "all") return;
    const hasWorkspace = workspaces.some((workspace) => workspace.id === workspaceFilter);
    if (!hasWorkspace) {
      setWorkspaceFilter("all");
    }
  }, [workspaceFilter, workspaces]);

  const allTasks = useMemo(() => {
    const tasks: WorkspaceTask[] = [];
    for (const workspace of workspaces) {
      if (workspaceFilter !== "all" && workspace.id !== workspaceFilter) continue;
      const workspaceState = agentWorkspaces[workspace.id];
      if (!workspaceState) continue;
      for (const thread of workspaceState.threads) {
        tasks.push({
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          thread,
        });
      }
    }
    tasks.sort((a, b) => b.thread.createdAt - a.thread.createdAt);
    return tasks;
  }, [agentWorkspaces, workspaceFilter, workspaces]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, WorkspaceTask[]> = {
      backlog: [],
      in_progress: [],
      in_review: [],
      completed: [],
    };

    for (const task of allTasks) {
      const status = task.thread.taskStatus ?? "backlog";
      grouped[status].push(task);
    }

    return grouped;
  }, [allTasks]);

  const visibleTasks = useMemo(() => {
    if (statusFilter === "all") return allTasks;
    return tasksByStatus[statusFilter];
  }, [allTasks, statusFilter, tasksByStatus]);

  const workspaceOptions = useMemo(
    () => workspaces.map((workspace) => ({ id: workspace.id, name: workspace.name, path: workspace.path })),
    [workspaces]
  );

  const handleCreateTask = async (workspaceId: string, text: string) => {
    await createTaskThread(workspaceId, text);
  };

  const handleStatusChange = async (
    workspaceId: string,
    threadId: string,
    nextStatus: TaskStatus
  ) => {
    await updateThreadTaskStatus(workspaceId, threadId, nextStatus);
  };

  const handleOpenChat = async (workspaceId: string, threadId: string) => {
    await selectWorkspace(workspaceId);
    await persistWorkspace(workspaceId);
    switchThread(workspaceId, threadId);
    setCenterPage("chat");
  };

  const handleDeleteTask = async (workspaceId: string, threadId: string) => {
    await deleteThread(workspaceId, threadId);
  };

  return (
    <div className="flex h-full flex-col">
      <AppTopBar
        title="Tasks"
        left={
          <WorkspaceFilterDropdown
            workspaceFilter={workspaceFilter}
            workspaceFilterLabel={workspaceFilterLabel}
            workspaces={workspaces}
            onWorkspaceFilterChange={setWorkspaceFilter}
          />
        }
        right={
          <div className="flex items-center gap-2">
            <Badge variant="bordered">{allTasks.length} tasks</Badge>
            <Button size="sm" onClick={() => setNewTaskDialogOpen(true)} disabled={workspaceOptions.length === 0}>
              <IconPlus className="size-4" stroke={2} />
              New task
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-4">
        <TaskStatusFilters
          statusFilter={statusFilter}
          allTasksCount={allTasks.length}
          tasksByStatus={tasksByStatus}
          onStatusFilterChange={setStatusFilter}
        />
        {visibleTasks.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-foreground/10 p-4 text-sm text-muted-foreground">
            No tasks found for this filter.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {visibleTasks.map((task) => (
              <TaskRow
                key={task.thread.id}
                task={task}
                canDelete={(agentWorkspaces[task.workspaceId]?.threads.length ?? 0) > 1}
                isRunning={agentWorkspaces[task.workspaceId]?.threadRuntime[task.thread.id]?.status === "running"}
                onOpenChat={handleOpenChat}
                onStatusChange={handleStatusChange}
                onDeleteTask={handleDeleteTask}
              />
            ))}
          </div>
        )}
      </div>
      <NewTaskDialog
        open={newTaskDialogOpen}
        onOpenChange={setNewTaskDialogOpen}
        workspaces={workspaceOptions}
        defaultWorkspaceId={activeWorkspaceId}
        onCreate={handleCreateTask}
      />
    </div>
  );
};
