import type { Workspace } from "@agentide/shared";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  ConfirmDialog,
  TrashLineIcon,
  PlusIcon,
} from "@agentide/ui";
import { cn } from "@/lib/cn";
import { useWorkspaceStore } from "@/store/workspace.store";
import { useAgentStore } from "@/store/agent.store";
import { BranchSwitcher } from "./branch-switcher";

type WorkspaceItemProps = {
  workspace: Workspace;
};

function threadLabel(thread: { messages: { role: string; content: string }[] }): string {
  const first = thread.messages.find((m) => m.role === "user");
  if (first?.content) {
    const text = first.content.trim().replace(/\s+/g, " ");
    return text.length > 24 ? `${text.slice(0, 24)}…` : text;
  }
  return "New chat";
}

export const WorkspaceItem = ({ workspace }: WorkspaceItemProps) => {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  const clearActiveWorkspace = useWorkspaceStore((s) => s.clearActiveWorkspace);
  const deleteWorkspace = useWorkspaceStore((s) => s.deleteWorkspace);
  const status = useAgentStore((s) => s.status);
  const threads = useAgentStore((s) => s.threads);
  const activeThreadId = useAgentStore((s) => s.activeThreadId);
  const startNewThread = useAgentStore((s) => s.startNewThread);
  const switchThread = useAgentStore((s) => s.switchThread);
  const persistHistory = useAgentStore((s) => s.persistHistory);

  const isActive = activeWorkspace?.id === workspace.id;

  const handleNewChat = async () => {
    if (status === "running" || !activeWorkspace?.id) return;
    await startNewThread(activeWorkspace.id);
  };

  const handleSwitchThread = async (threadId: string) => {
    if (threadId === activeThreadId || status === "running") return;
    if (activeWorkspace?.id) await persistHistory(activeWorkspace.id);
    switchThread(threadId);
  };

  return (
    <Accordion
      type="single"
      collapsible
      value={isActive ? workspace.id : undefined}
      onValueChange={() => {}} // Remove the workspace selection logic from accordion
    >
      <AccordionItem value={workspace.id} className="border-none">
        <AccordionTrigger
          className={cn(
            "group flex text-foreground items-center gap-3 rounded-lg px-3 py-1",
            isActive && "bg-foreground/10"
          )}
          title={workspace.name}
          onClick={(e) => {
            e.preventDefault(); // Prevent default accordion behavior
            if (!isActive) {
              selectWorkspace(workspace.id);
            }
          }}
        >
          <div className="flex flex-1 items-center gap-3 min-w-0">
            <div className="flex flex-1 flex-col overflow-hidden text-left">
              <span className="truncate text-sm font-medium">{workspace.name}</span>
              {workspace.branch && (
                <div className="flex items-center gap-1 mt-0.5">
                  <BranchSwitcher
                    workspaceId={workspace.id}
                    currentBranch={workspace.branch}
                  />
                </div>
              )}
            </div>
          </div>

          <ConfirmDialog
            title="Delete project?"
            description={`Remove "${workspace.name}" from the list. This action cannot be undone.`}
            confirmText="Delete"
            cancelText="Cancel"
            variant="destructive"
            onConfirm={() => deleteWorkspace(workspace.id)}
          >
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <TrashLineIcon className="size-3 text-muted-foreground" />
            </Button>
          </ConfirmDialog>
        </AccordionTrigger>

        <AccordionContent className="p-1">
          <div className="flex flex-col gap-0.5">
            {isActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewChat}
                disabled={status === "running"}
                className="h-7 justify-start gap-2 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <PlusIcon className="size-3.5" />
                New chat
              </Button>
            )}
            {isActive &&
              threads.map((thread) => (
                <Button
                  key={thread.id}
                  variant={thread.id === activeThreadId ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => handleSwitchThread(thread.id)}
                  className="w-full justify-start text-xs"
                >
                  <span className="min-w-0 truncate">{threadLabel(thread)}</span>
                </Button>
              ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};
