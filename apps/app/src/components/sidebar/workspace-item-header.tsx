import {
  AccordionTrigger,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@agentide/ui";
import { IconFolder, IconPlus, IconDots, IconTrash } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { useWorkspaceItemContext } from "./workspace-item-context";

export function WorkspaceItemHeader() {
  const { state, handlers } = useWorkspaceItemContext();
  const { workspace, isActive } = state;

  return (
    <AccordionTrigger
      asChild
      className={cn(
        "group flex text-foreground items-center gap-3 rounded-lg px-2 py-2",
        isActive && "bg-transparent"
      )}
      title={workspace.name}
      onClick={handlers.handleWorkspaceSelect}
    >
      <div className="flex flex-1 items-center gap-3 min-w-0">
        <div className="flex relative flex-1 flex-row gap-2 items-center text-left">
          <IconFolder className="size-4 text-muted-foreground" stroke={1} />
          <span className="truncate text-sm font-medium">{workspace.name}</span>
          {isActive && <div className="size-2 rounded-full bg-accent" />}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" onClick={handlers.handleNewChat}>
            <IconPlus className="size-3.5 text-muted-foreground" stroke={1} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <IconDots className="size-3.5 text-muted-foreground" stroke={1} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={handlers.handleRemoveWorkspaceClick}
              >
                <IconTrash className="size-4" stroke={2} />
                Remove workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </AccordionTrigger>
  );
}
