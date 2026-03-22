import type { Workspace } from "@openade/shared";
import {
  Accordion,
  AccordionItem,
} from "@openade/ui";
import { useWorkspaceItem } from "./hook";
import { WorkspaceItemProvider } from "./context";
import { WorkspaceItemHeader } from "./header";
import { WorkspaceThreadList } from "./threads";
import { DeleteThreadDialog } from "./deletethread";
import { RemoveWorkspaceDialog } from "./removeworkspace";

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
