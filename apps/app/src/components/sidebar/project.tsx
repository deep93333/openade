import { useState } from "react";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  Input,
  Label,
} from "@openade/ui";
import { IconFolder, IconLink, IconPlus } from "@tabler/icons-react";
import { getElectronAPI, isElectron } from "@/lib/electron";
import {
  pickWebDirectoryDisplayName,
  supportsShowDirectoryPicker,
} from "@/lib/browser-directory-picker";
import { useWorkspaceStore } from "@/store/workspace";

type CreateWorkspaceDialogProps = {
  isOpen: boolean;
  onClose: () => void;
};

type WorkspaceMode = "existing" | "empty" | "clone";
type WorkspaceCreateFlowVariant = "dialog" | "screen";

type WorkspaceCreateFlowProps = {
  onClose?: () => void;
  variant: WorkspaceCreateFlowVariant;
};

type WorkspaceCreateContentProps = {
  title: string;
  description: string;
  fields: React.ReactNode;
  footer: React.ReactNode;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
};

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
  const normalized = dirPath
    .replace(/[/\\]+$/, "")
    .split(/[/\\]/)
    .filter(Boolean);
  return normalized[normalized.length - 1] ?? "project";
}

function WorkspaceCreateContent({
  title,
  description,
  fields,
  footer,
  handleSubmit,
}: WorkspaceCreateContentProps) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-base text-center leading-none font-medium text-foreground">{title}</h2>
      <p className="text-muted-foreground text-xs text-center font-normal">{description}</p>

      <form onSubmit={handleSubmit}>
        <DialogBody className="my-4 flex flex-col gap-4">{fields}</DialogBody>
        {footer}
      </form>
    </div>
  );
}

function WorkspaceCreateFlow({ onClose, variant }: WorkspaceCreateFlowProps) {
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
  const isScreen = variant === "screen";
  const options = hasProjectApi ? OPTIONS : OPTIONS.slice(0, 1);

  const reset = () => {
    setStep(1);
    setMode(null);
    setPath("");
    setFolderName("");
    setCloneUrl("");
    setError(null);
    setWebFolderPickHint(null);
  };

  const close = () => {
    reset();
    onClose?.();
  };

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
            close();
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
        close();
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
        close();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create project");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!path.trim() || !cloneUrl.trim()) return;
    setIsSubmitting(true);
    try {
      const result = await api.project.clone(cloneUrl.trim(), path.trim());
      if (!result.success || !result.data) {
        setError(result.error ?? "Failed to clone repository");
        return;
      }
      await addWorkspaceFromPath(result.data);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clone repository");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    mode === "existing"
      ? path.trim().length > 0
      : mode === "empty"
        ? path.trim().length > 0 && folderName.trim().length > 0
        : path.trim().length > 0 && cloneUrl.trim().length > 0;

  const title =
    step === 1
      ? isScreen
        ? "Add your first workspace"
        : "Add Workspace"
      : mode === "existing"
        ? "Open an existing project"
        : mode === "empty"
          ? "Create a new project"
          : "Clone a repository";

  const description =
    step === 1
      ? isScreen
        ? "Choose how you want to add a workspace."
        : "Choose how you want to add a workspace."
      : mode === "existing"
        ? "Select an existing project folder. The workspace name comes from the folder."
        : mode === "empty"
          ? "Create a new folder with git init. The workspace name comes from the folder."
          : "Clone a repository into a parent directory. The workspace name comes from the cloned folder.";

  const fields = (
    <>
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <Label>What do you want to do?</Label>
          <div className="flex flex-row gap-2">
            {options.map(({ value, label }) => (
              <Button
                key={value}
                type="button"
                variant="secondary"
                onClick={() => void handleChooseOption(value)}
                className="flex min-h-24 flex-1 flex-col gap-1.5"
              >
                <OptionIcon value={value} />
                <span>{label}</span>
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
              variant="secondary"
              size="sm"
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
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleBrowseFolderPath()}
              >
                Browse...
              </Button>
            )}
          </div>
          {webFolderPickHint && !isElectron() && (
            <p className="text-xs text-muted-foreground">
              You chose folder "{webFolderPickHint}" in the picker. Paste its full path above so the
              local server can open it.
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
                variant="secondary"
                size="sm"
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
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleBrowseFolderPath()}
                >
                  Browse...
                </Button>
              )}
            </div>
            {webFolderPickHint && !isElectron() && (
              <p className="text-xs text-muted-foreground">
                You chose folder "{webFolderPickHint}" in the picker. Paste its full path above so
                the local server can open it.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Folder name</Label>
            <Input
              type="text"
              variant="secondary"
              size="sm"
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
                variant="secondary"
                size="sm"
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
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleBrowseFolderPath()}
                >
                  Browse...
                </Button>
              )}
            </div>
            {webFolderPickHint && !isElectron() && (
              <p className="text-xs text-muted-foreground">
                You chose folder "{webFolderPickHint}" in the picker. Paste its full path above so
                the local server can open it.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Repository URL</Label>
            <Input
              type="text"
              variant="secondary"
              size="sm"
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
    </>
  );

  const footer = (
    <DialogFooter className={isScreen ? "mt-4 justify-end gap-2" : "mt-6 justify-end gap-2"}>
      {step === 1 ? (
        onClose ? (
          <Button type="button" className="w-full" variant="ghost" onClick={close}>
            Cancel
          </Button>
        ) : null
      ) : (
        <>
          <Button className="w-full" type="button" variant="secondary" onClick={handleBack}>
            Back
          </Button>
          <Button className="w-full" type="submit" variant="brand" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Adding..." : mode === "existing" ? "Add" : "Create & add"}
          </Button>
        </>
      )}
    </DialogFooter>
  );

  if (isScreen) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-quaternary px-6 py-10 dark:bg-background">
        <div className="w-full max-w-[400px]">
          <WorkspaceCreateContent
            title={title}
            description={description}
            fields={fields}
            footer={footer}
            handleSubmit={handleSubmit}
          />
        </div>
      </div>
    );
  }

  return (
    <DialogContent className="w-[440px] p-4">
      <WorkspaceCreateContent
        title={title}
        description={description}
        fields={fields}
        footer={footer}
        handleSubmit={handleSubmit}
      />
    </DialogContent>
  );
}

export const CreateWorkspaceDialog = ({ isOpen, onClose }: CreateWorkspaceDialogProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <WorkspaceCreateFlow variant="dialog" onClose={onClose} />
    </Dialog>
  );
};

export function WorkspaceCreateScreen() {
  return <WorkspaceCreateFlow variant="screen" />;
}
