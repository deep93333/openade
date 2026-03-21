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
import { IconFolder, IconPlus, IconLink } from "@tabler/icons-react";
import { useWorkspaceStore } from "@/store/workspace";
import { getElectronAPI, isElectron } from "@/lib/electron";
import { pickWebDirectoryDisplayName, supportsShowDirectoryPicker } from "@/lib/browser-directory-picker";

type CreateWorkspaceDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

type WorkspaceMode = "existing" | "empty" | "clone";

const OPTIONS: { value: WorkspaceMode; label: string }[] = [
  { value: "existing", label: "Existing Project" },
  { value: "empty", label: "New Project" },
  { value: "clone", label: "Git Clone" },
];

function OptionIcon({ value }: { value: WorkspaceMode }) {
  switch (value) {
    case "existing":
      return <IconFolder className="size-6" stroke={1} />;
    case "empty":
      return <IconPlus className="size-6" stroke={1} />;
    case "clone":
      return <IconLink className="size-6" stroke={1} />;
  }
}

function getProjectNameFromPath(dirPath: string): string {
  const normalized = dirPath.replace(/[/\\]+$/, "").split(/[/\\]/).filter(Boolean);
  return normalized[normalized.length - 1] ?? "project";
}

export const CreateWorkspaceDialog = ({ isOpen, onClose }: CreateWorkspaceDialogProps) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<WorkspaceMode | null>(null);
  const [path, setPath] = useState("");
  const [folderName, setFolderName] = useState("");
  const [cloneUrl, setCloneUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webFolderPickHint, setWebFolderPickHint] = useState<string | null>(null);
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const electronAPI = getElectronAPI();
  const canBrowseFolder = isElectron() || supportsShowDirectoryPicker();
  const hasProjectApi = Boolean(electronAPI?.project);

  const options = hasProjectApi ? OPTIONS : OPTIONS.slice(0, 1);

  const handleSelectFolder = async (): Promise<string | null> => {
    if (!isElectron()) return null;
    const api = getElectronAPI();
    if (!api?.dialog?.selectFolder) return null;
    const result = await api.dialog.selectFolder();
    return result.success && result.data ? result.data : null;
  };

  const handleBrowseFolderPath = async () => {
    if (isElectron()) {
      const selectedPath = await handleSelectFolder();
      if (selectedPath) setPath(selectedPath);
      return;
    }
    const name = await pickWebDirectoryDisplayName();
    if (name) setWebFolderPickHint(name);
  };

  const addWorkspaceFromPath = async (dirPath: string) => {
    const name = getProjectNameFromPath(dirPath);
    await createWorkspace(name, dirPath);
  };

  const reset = () => {
    setStep(1);
    setMode(null);
    setPath("");
    setFolderName("");
    setCloneUrl("");
    setError(null);
    setWebFolderPickHint(null);
  };

  const handleChooseOption = async (value: WorkspaceMode) => {
    setError(null);
    const api = getElectronAPI();
    if (!api) return;

    if (value === "existing") {
      if (isElectron()) {
        const selectedPath = await handleSelectFolder();
        if (selectedPath) {
          setIsSubmitting(true);
          try {
            await addWorkspaceFromPath(selectedPath);
            reset();
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add workspace");
          } finally {
            setIsSubmitting(false);
          }
        }
        return;
      }
      setMode("existing");
      setStep(2);
      return;
    }

    if (value === "empty") {
      if (isElectron()) {
        const parentPath = await handleSelectFolder();
        if (parentPath) {
          setPath(parentPath);
          setMode("empty");
          setStep(2);
        }
        return;
      }
      setMode("empty");
      setStep(2);
      return;
    }

    setMode(value);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    setMode(null);
    setPath("");
    setFolderName("");
    setCloneUrl("");
    setError(null);
    setWebFolderPickHint(null);
  };

  const onPathInputChange = (value: string) => {
    setPath(value);
    setWebFolderPickHint(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const api = getElectronAPI();
    if (!api || !mode) return;

    if (mode === "existing") {
      if (!path.trim()) return;
      setIsSubmitting(true);
      try {
        await addWorkspaceFromPath(path.trim());
        reset();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add workspace");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (mode === "empty") {
      if (!path.trim() || !folderName.trim()) return;
      setIsSubmitting(true);
      try {
        const result = await api.project.createEmpty(path.trim(), folderName.trim());
        if (!result.success || !result.data) {
          setError(result.error ?? "Failed to create project");
          return;
        }
        await addWorkspaceFromPath(result.data);
        reset();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create project");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (mode === "clone") {
      if (!path.trim() || !cloneUrl.trim()) return;
      setIsSubmitting(true);
      try {
        const result = await api.project.clone(cloneUrl.trim(), path.trim());
        if (!result.success || !result.data) {
          setError(result.error ?? "Failed to clone repository");
          return;
        }
        await addWorkspaceFromPath(result.data);
        reset();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to clone repository");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const canSubmit =
    mode === "existing"
      ? path.trim().length > 0
      : mode === "empty"
        ? path.trim().length > 0 && folderName.trim().length > 0
        : path.trim().length > 0 && cloneUrl.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && (reset(), onClose())}>
      <DialogContent className="w-[440px] p-4">
        <DialogTitle>Add Workspace</DialogTitle>
        <DialogDescription>
          {step === 1
            ? "Choose how you want to add a workspace."
            : mode === "existing"
              ? "Select an existing project folder. Name is taken from the folder."
              : mode === "empty"
                ? "Create a new folder with git init. Name is taken from the folder."
                : "Clone a repository. Name is taken from the cloned folder."}
        </DialogDescription>

        <form onSubmit={handleSubmit}>
          <DialogBody className="mt-5 flex flex-col gap-4">
            {step === 1 && (
              <div className="flex flex-col gap-4">
                <Label>What do you want to do?</Label>
                <div className="flex flex-row gap-2">
                  {options.map(({ value, label }) => (
                    <Button
                      key={value}
                      type="button"
                      variant="secondary"
                      onClick={() => handleChooseOption(value)}
                      className="flex flex-1 flex-col gap-1.5 h-24"
                    >
                      <OptionIcon value={value} />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && mode === "existing" && (
              <div className="flex flex-col gap-1.5">
                <Label>Directory</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={path}
                    onChange={(e) => onPathInputChange(e.target.value)}
                    placeholder={
                      canBrowseFolder
                        ? isElectron()
                          ? "Select a folder or paste path"
                          : "Paste absolute path (Browse opens the system folder picker)"
                        : "/Users/you/projects/my-project"
                    }
                  />
                  {canBrowseFolder && (
                    <Button type="button" variant="secondary" onClick={() => void handleBrowseFolderPath()}>
                      Browse…
                    </Button>
                  )}
                </div>
                {webFolderPickHint && !isElectron() && (
                  <p className="text-xs text-muted-foreground">
                    You chose folder &quot;{webFolderPickHint}&quot; in the picker. Paste its full path above so
                    the local server can open it.
                  </p>
                )}
                {path.trim() && (
                  <p className="text-xs text-muted-foreground">
                    Project name: {getProjectNameFromPath(path)}
                  </p>
                )}
              </div>
            )}

            {step === 2 && mode === "empty" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>Parent directory</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={path}
                      onChange={(e) => onPathInputChange(e.target.value)}
                      placeholder={
                        canBrowseFolder
                          ? isElectron()
                            ? "Select folder or paste path"
                            : "Paste absolute path (Browse opens the system folder picker)"
                          : "/Users/you/projects"
                      }
                    />
                    {canBrowseFolder && (
                      <Button type="button" variant="secondary" onClick={() => void handleBrowseFolderPath()}>
                        Browse…
                      </Button>
                    )}
                  </div>
                  {webFolderPickHint && !isElectron() && (
                    <p className="text-xs text-muted-foreground">
                      You chose folder &quot;{webFolderPickHint}&quot; in the picker. Paste its full path above so
                      the local server can open it.
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Folder name</Label>
                  <Input
                    type="text"
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    placeholder="my-project"
                  />
                </div>
              </>
            )}

            {step === 2 && mode === "clone" && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label>Clone into (parent directory)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={path}
                      onChange={(e) => onPathInputChange(e.target.value)}
                      placeholder={
                        canBrowseFolder
                          ? isElectron()
                            ? "Select folder or paste path"
                            : "Paste absolute path (Browse opens the system folder picker)"
                          : "/Users/you/projects"
                      }
                    />
                    {canBrowseFolder && (
                      <Button type="button" variant="secondary" onClick={() => void handleBrowseFolderPath()}>
                        Browse…
                      </Button>
                    )}
                  </div>
                  {webFolderPickHint && !isElectron() && (
                    <p className="text-xs text-muted-foreground">
                      You chose folder &quot;{webFolderPickHint}&quot; in the picker. Paste its full path above so
                      the local server can open it.
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Repository URL</Label>
                  <Input
                    type="text"
                    value={cloneUrl}
                    onChange={(e) => setCloneUrl(e.target.value)}
                    placeholder="https://github.com/user/repo.git"
                  />
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </DialogBody>

          <DialogFooter className="mt-6 justify-end gap-2">
            {step === 1 ? (
              <Button type="button" variant="ghost" onClick={() => (reset(), onClose())}>
                Cancel
              </Button>
            ) : (
              <>
                <Button type="button" variant="ghost" onClick={handleBack}>
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="brand"
                  disabled={!canSubmit || isSubmitting}
                >
                  {isSubmitting ? "Adding…" : mode === "existing" ? "Add" : "Create & add"}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
