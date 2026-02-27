import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogBody,
  Input,
  Label,
} from "@agentide/ui";
import { useWorkspaceStore } from "@/store/workspace.store";
import { getElectronAPI } from "@/lib/electron";

type CreateWorkspaceDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const CreateWorkspaceDialog = ({ isOpen, onClose }: CreateWorkspaceDialogProps) => {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const electronAPI = getElectronAPI();
  const hasFolderPicker = Boolean(electronAPI?.dialog?.selectFolder);

  const handleSelectFolder = async () => {
    const api = getElectronAPI();
    if (!api?.dialog?.selectFolder) return;
    const result = await api.dialog.selectFolder();
    if (result.success && result.data) setPath(result.data);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !path.trim()) return;
    await createWorkspace(name.trim(), path.trim());
    setName("");
    setPath("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[440px] p-4">
        <DialogTitle>New Workspace</DialogTitle>
        <DialogDescription>
          Add a directory to work with the agent.
        </DialogDescription>

        <form onSubmit={handleSubmit}>
          <DialogBody className="mt-5 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-project"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Directory</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder={
                    hasFolderPicker
                      ? "Select a folder or paste path"
                      : "/Users/you/projects/my-project"
                  }
                />
                {hasFolderPicker && (
                  <Button type="button" variant="secondary" onClick={handleSelectFolder}>
                    Browse…
                  </Button>
                )}
              </div>
            </div>
          </DialogBody>

          <DialogFooter className="mt-6 justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={!name.trim() || !path.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
