import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from "@agentide/ui";
import { useWorkspaceItemContext } from "./workspace-item-context";

export function RemoveWorkspaceDialog() {
  const { state, removeWorkspaceState } = useWorkspaceItemContext();
  const { workspace } = state;
  const { showRemoveWorkspaceConfirm, setShowRemoveWorkspaceConfirm, confirmRemoveWorkspace } =
    removeWorkspaceState;

  return (
    <Dialog
      open={showRemoveWorkspaceConfirm}
      onOpenChange={setShowRemoveWorkspaceConfirm}
    >
      <DialogContent className="max-w-[300px]">
        <DialogHeader>
          <DialogTitle>Remove workspace</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Remove &quot;{workspace.name}&quot; from the sidebar? Your project files are not
          deleted.
        </DialogDescription>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setShowRemoveWorkspaceConfirm(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmRemoveWorkspace}>
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
