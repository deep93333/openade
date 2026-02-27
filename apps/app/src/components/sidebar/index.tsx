import { useEffect, useState } from "react";
import { Button } from "@agentide/ui";
import { useWorkspaceStore } from "@/store/workspace.store";
import { useAgentStore } from "@/store/agent.store";
import { useUIStore } from "@/store/ui.store";
import { WorkspaceItem } from "./workspace-item";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";
import { cn } from "@/lib/cn";
import { CostDisplay } from "../cost-display";
import { IconBook, IconFolder, IconKey, IconPlus, IconList } from "@tabler/icons-react";

export const Sidebar = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);
  const initializeActiveWorkspace = useWorkspaceStore((s) => s.initializeActiveWorkspace);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const status = useAgentStore((s) =>
    activeWorkspaceId ? s.getActiveRuntime(activeWorkspaceId).status : "idle"
  );
  const centerPage = useUIStore((s) => s.centerPage);
  const setCenterPage = useUIStore((s) => s.setCenterPage);

  useEffect(() => {
    const init = async () => {
      await fetchWorkspaces();
      await initializeActiveWorkspace();
    };
    init();
  }, [fetchWorkspaces, initializeActiveWorkspace]);

  return (
    <>
      <aside className="flex w-[240px] shrink-0 flex-col">
        <div className="flex h-8 items-center justify-between px-4 drag-region">
          <div className="w-[70px]" />
         
        </div>


        <div className="flex flex-1 flex-col divide-y divide-foreground/5 overflow-y-auto">
       
          {workspaces.length === 0 ? (
            <div className="flex flex-1 p-2 flex-col items-center justify-center gap-3 px-4 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl">
                <IconFolder className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">No workspaces</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
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
            <div className="flex flex-col">
              <div className="flex flex-col gap-1 p-2 border-b border-foreground/5">
                <Button
                variant="ghost"
                  className="w-full justify-start"
                  onClick={() => setIsDialogOpen(true)}
                >
                  <IconPlus /> New Project
                </Button>
                <Button
                  variant={centerPage === "skills" ? "secondary" : "ghost"}
                  className={cn("w-full justify-start", centerPage === "skills" && "bg-foreground/5")}
                  onClick={() => setCenterPage("skills")}
                >
                  <IconBook className="size-4" /> Skills
                </Button>
                <Button
                  variant={centerPage === "tasks" ? "secondary" : "ghost"}
                  className={cn("w-full justify-start", centerPage === "tasks" && "bg-foreground/5")}
                  onClick={() => setCenterPage("tasks")}
                >
                  <IconList className="size-4" stroke={2} /> Tasks
                </Button>
              </div>
              <div className="flex flex-col divide-y divide-foreground/5">
            {(workspaces.map((workspace) => (
              <WorkspaceItem key={workspace.id} workspace={workspace} />
            )))}
            </div>
            </div>
          )}
        </div>

        <div className="border-t border-foreground/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${status === "running" ? "bg-violet-500 animate-pulse" : status === "error" ? "bg-red-500" : "bg-zinc-400"}`}
            />
            <span className="text-[10px] font-medium text-muted-foreground capitalize">
              {status}
            </span>
            <CostDisplay/>
            <button
              type="button"
              onClick={() => useUIStore.getState().setApiKeyDialogOpen(true)}
              className="ml-auto flex items-center justify-center size-6 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              title="API Key Settings"
            >
              <IconKey className="size-3.5" stroke={1.75} />
            </button>
          </div>
        </div>
      </aside>

      <CreateWorkspaceDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} />
    </>
  );
};
