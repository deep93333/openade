import type { TaskStatus } from "@agentide/shared";
import {
  Badge,
  Button,
  ChevronDownIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@agentide/ui";
import { taskStatuses, taskStatusLabels, getTaskStatusIcon } from "./task-utils";
import type { WorkspaceTask } from "./task-utils";

type WorkspaceFilterDropdownProps = {
  workspaceFilter: string;
  workspaceFilterLabel: string;
  workspaces: { id: string; name: string }[];
  onWorkspaceFilterChange: (value: string) => void;
};

export function WorkspaceFilterDropdown({
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

export function TaskStatusFilters({
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
