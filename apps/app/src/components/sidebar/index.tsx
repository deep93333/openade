import { useEffect, useState } from "react";
import { Button } from "@agentide/ui";
import { FolderIcon, PlusIcon } from "@agentide/ui";
import { useWorkspaceStore } from "@/store/workspace.store";
import { useAgentStore } from "@/store/agent.store";
import { WorkspaceItem } from "./workspace-item";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";

export const Sidebar = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);
  const initializeActiveWorkspace = useWorkspaceStore((s) => s.initializeActiveWorkspace);
  const status = useAgentStore((s) => s.status);

  useEffect(() => {
    const init = async () => {
      await fetchWorkspaces();
      await initializeActiveWorkspace();
    };
    init();
  }, [fetchWorkspaces, initializeActiveWorkspace]);

  return (
    <>
      <aside className="flex w-[240px] shrink-0 flex-col border-r border-foreground/5 bg-secondary">
        <div className="flex h-10 items-center justify-between border-b border-zinc-200 px-4 drag-region">
          <div className="w-[70px]" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsDialogOpen(true)}
          >
            <PlusIcon /> New Project
          </Button>
        </div>

        <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {workspaces.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100">
                <FolderIcon className="size-5 text-zinc-500" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-600">No workspaces</p>
                <p className="mt-0.5 text-[10px] text-zinc-500">
                  Add a project directory to get started
                </p>
              </div>
              <Button
                variant="brand"
                size="sm"
                onClick={() => setIsDialogOpen(true)}
                className="mt-1"
              >
                Add Workspace
              </Button>
            </div>
          ) : (
            workspaces.map((workspace) => (
              <WorkspaceItem key={workspace.id} workspace={workspace} />
            ))
          )}
        </div>

        <div className="border-t border-zinc-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${status === "running" ? "bg-violet-500 animate-pulse" : status === "error" ? "bg-red-500" : "bg-zinc-400"}`}
            />
            <span className="text-[10px] font-medium text-zinc-600 capitalize">
              {status}
            </span>
          </div>
        </div>
      </aside>

      <CreateWorkspaceDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} />
    </>
  );
};
