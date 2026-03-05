import type { ChatThread, TaskStatus } from "@agentide/shared";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  Button,
} from "@agentide/ui";
import { useWorkspaceItemContext } from "./context";
import { threadLabel, getTaskStatusIcon, getTaskStatusLabel, TASK_STATUSES } from "./utils";

type WorkspaceThreadRowProps = {
  thread: ChatThread;
};

export function WorkspaceThreadRow({ thread }: WorkspaceThreadRowProps) {
  const { state, handlers } = useWorkspaceItemContext();
  const { threads, activeThreadId } = state;

  const canDelete = threads.length > 1;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="group relative flex items-center">
          <Button
            variant={thread.id === activeThreadId ? "secondary" : "ghost"}
            onClick={() => handlers.handleSwitchThread(thread.id)}
            className="w-full justify-start gap-2 h-auto py-2"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="min-w-0 truncate text-xs flex-1 text-left">
                {threadLabel(thread)}
              </span>
            </div>
          </Button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuSub>
          <ContextMenuSubTrigger>Task status</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuRadioGroup
              value={thread.taskStatus ?? "backlog"}
              onValueChange={(value) =>
                handlers.handleTaskStatusChange(thread.id, value as TaskStatus)
              }
            >
              {TASK_STATUSES.map((status) => (
                <ContextMenuRadioItem key={status} value={status}>
                  <div className="flex items-center gap-2">
                    {getTaskStatusIcon(status)}
                    <span className="text-xs">{getTaskStatusLabel(status)}</span>
                  </div>
                </ContextMenuRadioItem>
              ))}
            </ContextMenuRadioGroup>
          </ContextMenuSubContent>
        </ContextMenuSub>
        {canDelete && (
          <ContextMenuItem onClick={(e) => handlers.handleDeleteThread(thread.id, e)}>
            Delete thread
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
