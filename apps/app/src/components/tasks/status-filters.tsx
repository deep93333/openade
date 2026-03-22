import type { TaskStatus } from "@openade/shared";
import {
  Badge,
  Button,
  ChevronDownIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@openade/ui";
import { IconArchive } from "@tabler/icons-react";
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
  archivedCount?: number;
  showArchived?: boolean;
  onToggleArchived?: () => void;
};

export function TaskStatusFilters({
  statusFilter,
  allTasksCount,
  tasksByStatus,
  onStatusFilterChange,
  archivedCount = 0,
  showArchived = false,
  onToggleArchived,
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
      {onToggleArchived && (
        <Button
          size="sm"
          variant={showArchived ? "secondary" : "ghost"}
          className="text-muted-foreground"
          onClick={onToggleArchived}
        >
          <IconArchive className="size-3.5" stroke={2} />
          Archived
          {archivedCount > 0 && (
            <Badge variant="outline" size="sm">
              {archivedCount}
            </Badge>
          )}
        </Button>
      )}
    </div>
  );
}
