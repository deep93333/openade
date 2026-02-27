import type { Workspace } from "@agentide/shared";
import {
  Accordion,
  AccordionItem,
} from "@agentide/ui";
import { useWorkspaceItem } from "./use-workspace-item";
import { WorkspaceItemProvider } from "./workspace-item-context";
import { WorkspaceItemHeader } from "./workspace-item-header";
import { WorkspaceThreadList } from "./workspace-thread-list";
import { DeleteThreadDialog } from "./delete-thread-dialog";
import { RemoveWorkspaceDialog } from "./remove-workspace-dialog";

type WorkspaceItemProps = {
  workspace: Workspace;
};

export function WorkspaceItem({ workspace }: WorkspaceItemProps) {
  const { state, handlers, deleteState, removeWorkspaceState } = useWorkspaceItem(workspace);
  const { isActive } = state;
  const contextValue = { state, handlers, deleteState, removeWorkspaceState };

  return (
    <div className="px-2 w-full relative">
      <WorkspaceItemProvider value={contextValue}>
        <Accordion
          type="single"
          collapsible
          value={isActive ? workspace.id : ""}
          onValueChange={() => {}}
        >
          <AccordionItem value={workspace.id} className="border-none">
            <WorkspaceItemHeader />
            <WorkspaceThreadList />
          </AccordionItem>
        </Accordion>
        <DeleteThreadDialog />
        <RemoveWorkspaceDialog />
      </WorkspaceItemProvider>
    </div>
  );
}
