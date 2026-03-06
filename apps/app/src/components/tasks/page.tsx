import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { TaskStatus } from "@agentide/shared";
import { useWorkspaceStore } from "@/store/workspace";
import { useAgentStore } from "@/store/agent";
import { useUIStore } from "@/store/ui";
import { NewTaskDialog } from "./new-task-dialog";
import { TaskDialogProvider } from "./task-dialog-provider";
import { KanbanColumn } from "./kanban-column";
import { TaskRow } from "./task-row";
import { TaskStatusFilters } from "./status-filters";
import { TaskThreadDialog } from "./task-popover";
import { taskStatuses } from "./task-utils";
import type { WorkspaceTask } from "./task-utils";

export const TasksPage = () => {
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const selectWorkspace = useWorkspaceStore((state) => state.selectWorkspace);
  const agentWorkspaces = useAgentStore((state) => state.workspaces);
  const loadWorkspace = useAgentStore((state) => state.loadWorkspace);
  const createTaskThread = useAgentStore((state) => state.createTaskThread);
  const createBrainstormThread = useAgentStore((state) => state.createBrainstormThread);
  const updateThreadTaskStatus = useAgentStore((state) => state.updateThreadTaskStatus);
  const deleteThread = useAgentStore((state) => state.deleteThread);
  const switchThread = useAgentStore((state) => state.switchThread);
  const persistWorkspace = useAgentStore((state) => state.persistWorkspace);
  const setCenterPage = useUIStore((state) => state.setCenterPage);
  const workspaceFilter = useUIStore((state) => state.tasksWorkspaceFilter);
  const setWorkspaceFilter = useUIStore((state) => state.setTasksWorkspaceFilter);
  const viewMode = useUIStore((state) => state.tasksViewMode);
  const newTaskDialogOpen = useUIStore((state) => state.tasksNewTaskDialogOpen);
  const setNewTaskDialogOpen = useUIStore((state) => state.setTasksNewTaskDialogOpen);
  const setTasksCount = useUIStore((state) => state.setTasksCount);

  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [brainstormDialog, setBrainstormDialog] = useState<{ workspaceId: string; threadId: string } | null>(null);

  const kanbanScrollRef = useRef<HTMLDivElement>(null);
  const [kanbanClip, setKanbanClip] = useState({ left: false, right: true });

  const updateKanbanClip = useCallback(() => {
    const el = kanbanScrollRef.current;
    if (!el) return;
    setKanbanClip({
      left: el.scrollLeft > 0,
      right: el.scrollLeft < el.scrollWidth - el.clientWidth - 1,
    });
  }, []);

  useEffect(() => {
    const el = kanbanScrollRef.current;
    if (!el) return;
    updateKanbanClip();
    el.addEventListener("scroll", updateKanbanClip, { passive: true });
    const ro = new ResizeObserver(updateKanbanClip);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateKanbanClip);
      ro.disconnect();
    };
  }, [updateKanbanClip]);

  const workspaceFilterLabel =
    workspaceFilter === "all"
      ? "All workspaces"
      : (workspaces.find((w) => w.id === workspaceFilter)?.name ?? "All workspaces");

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
    const hasWorkspace = workspaces.some((w) => w.id === workspaceFilter);
    if (!hasWorkspace) setWorkspaceFilter("all");
  }, [workspaceFilter, workspaces, setWorkspaceFilter]);

  useEffect(() => {
    if (activeWorkspaceId) setWorkspaceFilter(activeWorkspaceId);
    else setWorkspaceFilter("all");
  }, [activeWorkspaceId, setWorkspaceFilter]);

  const allTasks = useMemo(() => {
    const tasks: WorkspaceTask[] = [];
    for (const workspace of workspaces) {
      if (workspaceFilter !== "all" && workspace.id !== workspaceFilter) continue;
      const workspaceState = agentWorkspaces[workspace.id];
      if (!workspaceState) continue;
      for (const thread of workspaceState.threads) {
        const isArchived = thread.taskStatus === "archived";
        if (isArchived && !showArchived) continue;
        if (!isArchived && showArchived) continue;
        tasks.push({
          workspaceId: workspace.id,
          workspaceName: workspace.name,
          workspacePath: workspace.path,
          thread,
        });
      }
    }
    tasks.sort((a, b) => {
      const aTime = a.thread.updatedAt ?? a.thread.createdAt;
      const bTime = b.thread.updatedAt ?? b.thread.createdAt;
      const aValid = Number.isFinite(aTime);
      const bValid = Number.isFinite(bTime);
      if (aValid && bValid) return bTime - aTime;
      if (aValid) return -1;
      if (bValid) return 1;
      return 0;
    });
    return tasks;
  }, [agentWorkspaces, showArchived, workspaceFilter, workspaces]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, WorkspaceTask[]> = {
      brainstorm: [],
      backlog: [],
      planning: [],
      in_progress: [],
      agent_review: [],
      in_review: [],
      completed: [],
      archived: [],
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
    () => workspaces.map((w) => ({ id: w.id, name: w.name, path: w.path })),
    [workspaces]
  );

  const archivedCount = useMemo(() => {
    let count = 0;
    for (const workspace of workspaces) {
      if (workspaceFilter !== "all" && workspace.id !== workspaceFilter) continue;
      const workspaceState = agentWorkspaces[workspace.id];
      if (!workspaceState) continue;
      for (const thread of workspaceState.threads) {
        if (thread.taskStatus === "archived") count++;
      }
    }
    return count;
  }, [agentWorkspaces, workspaceFilter, workspaces]);

  useEffect(() => {
    setTasksCount(allTasks.length);
  }, [allTasks.length, setTasksCount]);

  const handleCreateTask = useCallback(
    async (
      workspaceId: string,
      text: string,
      model?: string,
      initialStatus?: TaskStatus,
      provider?: import("@agentide/shared").AgentProvider
    ) => {
      const threadId = await createTaskThread(workspaceId, text, undefined, model, provider);
      if (initialStatus && threadId) {
        await updateThreadTaskStatus(workspaceId, threadId, initialStatus, { autoStart: true });
      }
    },
    [createTaskThread, updateThreadTaskStatus]
  );

  const handleStatusChange = useCallback(
    async (workspaceId: string, threadId: string, nextStatus: TaskStatus) => {
      await updateThreadTaskStatus(workspaceId, threadId, nextStatus);
    },
    [updateThreadTaskStatus]
  );

  const handleOpenChat = useCallback(
    async (workspaceId: string, threadId: string) => {
      await selectWorkspace(workspaceId);
      await persistWorkspace(workspaceId);
      switchThread(workspaceId, threadId);
      setCenterPage("chat");
    },
    [selectWorkspace, persistWorkspace, switchThread, setCenterPage]
  );

  const handleDeleteTask = useCallback(
    async (workspaceId: string, threadId: string) => {
      await deleteThread(workspaceId, threadId);
    },
    [deleteThread]
  );

  const handleStartAgent = useCallback(
    async (workspaceId: string, threadId: string) => {
      await updateThreadTaskStatus(workspaceId, threadId, "in_progress");
    },
    [updateThreadTaskStatus]
  );

  const handleNewBrainstorm = useCallback(
    async (workspaceId: string) => {
      const threadId = await createBrainstormThread(workspaceId);
      setBrainstormDialog({ workspaceId, threadId });
    },
    [createBrainstormThread]
  );

  return (
    <TaskDialogProvider>
      <div className="flex min-h-0 h-full flex-col">
        <div className={`flex min-h-0 flex-1 flex-col ${viewMode === "kanban" ? "overflow-hidden" : "overflow-auto"}`}>
          {viewMode === "list" && (
            <TaskStatusFilters
              statusFilter={statusFilter}
              allTasksCount={allTasks.length}
              tasksByStatus={tasksByStatus}
              onStatusFilterChange={(s) => { setShowArchived(false); setStatusFilter(s); }}
              archivedCount={archivedCount}
              showArchived={showArchived}
              onToggleArchived={() => { setShowArchived((v) => !v); setStatusFilter("all"); }}
            />
          )}
          {!showArchived && viewMode === "list" &&
            (visibleTasks.length === 0 ? (
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
                    onOpenChat={handleOpenChat}
                    onStatusChange={handleStatusChange}
                    onDeleteTask={handleDeleteTask}
                    onStartAgent={handleStartAgent}
                  />
                ))}
              </div>
            ))}
          {!showArchived && viewMode === "kanban" && (
            <div className="relative min-h-0 flex-1 h-full">
            <div
              ref={kanbanScrollRef}
              className="flex min-h-0 h-full divide-x divide-foreground/2 divide-dashed overflow-x-auto"
              style={
                {
                  maskImage: `linear-gradient(to right, ${kanbanClip.left ? "transparent 0%, black 4%" : "black 0%"}, ${kanbanClip.right ? "black 96%, transparent 100%" : "black 100%"})`,
                  WebkitMaskImage: `linear-gradient(to right, ${kanbanClip.left ? "transparent 0%, black 4%" : "black 0%"}, ${kanbanClip.right ? "black 96%, transparent 100%" : "black 100%"})`,
                  maskSize: "100% 100%",
                  WebkitMaskSize: "100% 100%",
                } as CSSProperties
              }
            >
              {taskStatuses.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={tasksByStatus[status]}
                  canDelete={(task) => (agentWorkspaces[task.workspaceId]?.threads.length ?? 0) > 1}
                  onOpenChat={handleOpenChat}
                  onStatusChange={handleStatusChange}
                  onDeleteTask={handleDeleteTask}
                  onStartAgent={handleStartAgent}
                  onNewTask={status === "backlog" ? () => setNewTaskDialogOpen(true) : undefined}
                  onNewBrainstorm={
                    status === "brainstorm" && activeWorkspaceId
                      ? () => void handleNewBrainstorm(activeWorkspaceId)
                      : undefined
                  }
                  archivedCount={status === "completed" ? archivedCount : undefined}
                  showArchived={status === "completed" ? showArchived : undefined}
                  onToggleArchived={
                    status === "completed"
                      ? () => { setShowArchived((v) => !v); setStatusFilter("all"); }
                      : undefined
                  }
                />
              ))}
            </div>
            </div>
          )}
          {showArchived &&
            (allTasks.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-foreground/10 p-4 text-sm text-muted-foreground">
                No archived tasks.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {allTasks.map((task) => (
                  <TaskRow
                    key={task.thread.id}
                    task={task}
                    canDelete={(agentWorkspaces[task.workspaceId]?.threads.length ?? 0) > 1}
                    onOpenChat={handleOpenChat}
                    onStatusChange={handleStatusChange}
                    onDeleteTask={handleDeleteTask}
                    onStartAgent={handleStartAgent}
                  />
                ))}
              </div>
            ))}
        </div>
        <NewTaskDialog
          open={newTaskDialogOpen}
          onOpenChange={setNewTaskDialogOpen}
          workspaces={workspaceOptions}
          defaultWorkspaceId={activeWorkspaceId}
          onCreate={handleCreateTask}
        />
        {brainstormDialog && (() => {
          const thread = agentWorkspaces[brainstormDialog.workspaceId]?.threads.find(
            (t) => t.id === brainstormDialog.threadId
          );
          const ws = workspaces.find((w) => w.id === brainstormDialog.workspaceId);
          return thread ? (
            <TaskThreadDialog
              thread={thread}
              workspaceId={brainstormDialog.workspaceId}
              workspacePath={ws?.path ?? null}
              open={true}
              onOpenChange={(open) => { if (!open) setBrainstormDialog(null); }}
            />
          ) : null;
        })()}
      </div>
    </TaskDialogProvider>
  );
};

export { WorkspaceFilterDropdown } from "./status-filters";
