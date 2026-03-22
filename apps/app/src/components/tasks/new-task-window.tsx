import { useMemo, useState } from "react";
import type { TaskStatus } from "@openade/shared";
import { NewTaskDialog } from "./new-task-dialog";
import { useWorkspaceStore } from "@/store/workspace";
import { useAgentStore } from "@/store/agent";

export const NewTaskWindow = () => {
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);

  const createTaskThread = useAgentStore((state) => state.createTaskThread);
  const updateThreadTaskStatus = useAgentStore((state) => state.updateThreadTaskStatus);
  const loadWorkspace = useAgentStore((state) => state.loadWorkspace);

  const [dialogOpen, setDialogOpen] = useState(true);

  const workspaceOptions = useMemo(
    () => workspaces.map((workspace) => ({ id: workspace.id, name: workspace.name, path: workspace.path })),
    [workspaces]
  );

  const handleCreateTask = async (
    workspaceId: string,
    text: string,
    model?: string,
    initialStatus?: TaskStatus,
    provider?: import("@openade/shared").AgentProvider
  ) => {
    await loadWorkspace(workspaceId);
    const threadId = await createTaskThread(workspaceId, text, undefined, model, provider);
    if (initialStatus && threadId) {
      await updateThreadTaskStatus(workspaceId, threadId, initialStatus, { autoStart: true });
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setDialogOpen(nextOpen);
    if (!nextOpen && typeof window !== "undefined") {
      window.close();
    }
  };

  return (
    <div className="h-screen w-full bg-background">
      <NewTaskDialog
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        workspaces={workspaceOptions}
        defaultWorkspaceId={activeWorkspaceId}
        onCreate={handleCreateTask}
        overlayClassName="hidden"
      />
    </div>
  );
};
