import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from "@agentide/ui";
import { useWorkspaceItemContext } from "./context";

export function DeleteThreadDialog() {
  const { deleteState } = useWorkspaceItemContext();
  const { threadToDelete, setThreadToDelete, confirmDeleteThread } = deleteState;

  return (
    <Dialog open={!!threadToDelete} onOpenChange={() => setThreadToDelete(null)}>
      <DialogContent className="max-w-[300px]">
        <DialogHeader>
          <DialogTitle>Delete thread</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Are you sure you want to delete the thread &quot;{threadToDelete?.name}&quot;? This
          action cannot be undone.
        </DialogDescription>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setThreadToDelete(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmDeleteThread}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
