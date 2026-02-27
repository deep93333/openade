import { useCallback, useState } from "react";
import type { GitUnstagedChange } from "@agentide/shared";
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
  CircleCheckIcon,
} from "@agentide/ui";
import { getElectronAPI } from "@/lib/electron";

type GitCommitDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  stagedChanges: GitUnstagedChange[];
  branchName?: string;
  onSuccess: () => void;
};

type Step = "commit" | "push";

export function GitCommitDialog({
  open,
  onOpenChange,
  workspaceId,
  stagedChanges,
  branchName,
  onSuccess,
}: GitCommitDialogProps) {
  const [step, setStep] = useState<Step>("commit");
  const [commitMessage, setCommitMessage] = useState("");
  const [commitLoading, setCommitLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAdded = stagedChanges.reduce((sum, c) => sum + c.added, 0);
  const totalDeleted = stagedChanges.reduce((sum, c) => sum + c.deleted, 0);

  const handleCommit = useCallback(async () => {
    const api = getElectronAPI();
    const commit = (
      api?.workspace as {
        commit?: (
          w: string,
          m: string
        ) => Promise<{ success?: boolean; error?: string }>;
      }
    )?.commit;

    if (!commit || !workspaceId || !commitMessage.trim()) return;

    setCommitLoading(true);
    setError(null);

    const result = await commit(workspaceId, commitMessage.trim());
    setCommitLoading(false);

    if (result?.success) {
      setStep("push");
    } else if (result?.error) {
      setError(result.error);
    }
  }, [workspaceId, commitMessage]);

  const handlePush = useCallback(async () => {
    const api = getElectronAPI();
    const push = (
      api?.workspace as {
        push?: (w: string) => Promise<{ success?: boolean; error?: string }>;
      }
    )?.push;

    if (!push || !workspaceId) return;

    setPushLoading(true);
    setError(null);

    const result = await push(workspaceId);
    setPushLoading(false);

    if (result?.success) {
      handleClose();
      onSuccess();
    } else if (result?.error) {
      setError(result.error);
    }
  }, [workspaceId, onSuccess]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(() => {
      setStep("commit");
      setCommitMessage("");
      setError(null);
    }, 200);
  }, [onOpenChange]);

  const handleDone = useCallback(() => {
    handleClose();
    onSuccess();
  }, [handleClose, onSuccess]);

  const handleBack = useCallback(() => {
    setStep("commit");
    setError(null);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" showCloseButton={false}>
        <DialogHeader className="flex-row items-center justify-between">
          <DialogTitle>
            {step === "commit" ? "Commit Changes" : "Push Changes"}
          </DialogTitle>
          <span className="text-xs text-muted-foreground">
            {step === "commit" ? "1" : "2"}/2
          </span>
        </DialogHeader>

        <DialogBody className="gap-4 py-4">
          {step === "commit" ? (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {stagedChanges.length} file{stagedChanges.length !== 1 ? "s" : ""} staged
                </span>
                <span className="text-xs">
                  (
                  {totalAdded > 0 && (
                    <span className="text-green-600 dark:text-green-400">
                      +{totalAdded}
                    </span>
                  )}
                  {totalAdded > 0 && totalDeleted > 0 && " / "}
                  {totalDeleted > 0 && (
                    <span className="text-red-600 dark:text-red-400">
                      -{totalDeleted}
                    </span>
                  )}
                  {totalAdded === 0 && totalDeleted === 0 && "no line changes"}
                  )
                </span>
              </div>

              <Textarea
                placeholder="feat: add new feature&#10;&#10;Describe your changes..."
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="min-h-[120px] resize-none text-sm"
                rows={5}
                autoFocus
              />

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-lg bg-green-500/10 p-3">
                <CircleCheckIcon className="size-5 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  Committed successfully
                </span>
              </div>

              <div className="text-sm text-muted-foreground">
                Push to{" "}
                <span className="font-medium text-foreground">
                  {branchName || "remote"}
                </span>
                ?
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          {step === "commit" ? (
            <>
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleCommit}
                disabled={!commitMessage.trim() || commitLoading}
                loading={commitLoading}
              >
                Commit
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={handleBack}>
                Back
              </Button>
              <Button variant="secondary" onClick={handleDone}>
                Done
              </Button>
              <Button
                onClick={handlePush}
                disabled={pushLoading}
                loading={pushLoading}
              >
                Push to Remote
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
