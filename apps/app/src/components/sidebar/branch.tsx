import { useState, useEffect } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
} from "@openade/ui";
import { useWorkspaceStore } from "@/store/workspace";
import { useUIStore } from "@/store/ui";

export const CreateBranchDialog = () => {
  const [newBranchName, setNewBranchName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { open, workspaceId, query } = useUIStore((s) => s.createBranchDialog);
  const closeCreateBranchDialog = useUIStore((s) => s.closeCreateBranchDialog);
  const { createGitBranch } = useWorkspaceStore();

  useEffect(() => {
    if (open && query) {
      setNewBranchName(query);
    }
  }, [open, query]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setNewBranchName("");
      closeCreateBranchDialog();
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim() || !workspaceId) return;

    setIsLoading(true);
    try {
      await createGitBranch(workspaceId, newBranchName.trim());
      setNewBranchName("");
      closeCreateBranchDialog();
    } catch (error) {
      console.error("Failed to create branch:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCreateBranch();
  };

  const handleCancel = () => {
    setNewBranchName("");
    closeCreateBranchDialog();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Branch</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="Enter branch name..."
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateBranch}
              disabled={!newBranchName.trim() || isLoading}
            >
              {isLoading ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
