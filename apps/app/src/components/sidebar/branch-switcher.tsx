import { useState, useEffect } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  ChevronDownIcon,
  GithubIcon,
  PlusIcon,
} from "@agentide/ui";
import { useWorkspaceStore } from "@/store/workspace.store";
import type { GitBranch } from "@agentide/shared";

type BranchSwitcherProps = {
  workspaceId: string;
  currentBranch?: string;
};

export const BranchSwitcher = ({ workspaceId, currentBranch }: BranchSwitcherProps) => {
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { getGitBranches, switchGitBranch, createGitBranch, refreshGitInfo } = useWorkspaceStore();

  const loadBranches = async () => {
    setIsLoading(true);
    try {
      const gitBranches = await getGitBranches(workspaceId);
      setBranches(gitBranches);
    } catch (error) {
      console.error("Failed to load git branches:", error);
      setBranches([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, [workspaceId]);

  const handleSwitchBranch = async (branchName: string) => {
    if (branchName === currentBranch) return;

    setIsLoading(true);
    try {
      await switchGitBranch(workspaceId, branchName);
      await loadBranches();
    } catch (error) {
      console.error("Failed to switch branch:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;

    setIsLoading(true);
    try {
      await createGitBranch(workspaceId, newBranchName.trim());
      await loadBranches();
      setNewBranchName("");
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Failed to create branch:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshGitInfo = async () => {
    setIsLoading(true);
    try {
      await refreshGitInfo(workspaceId);
      await loadBranches();
    } catch (error) {
      console.error("Failed to refresh git info:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // If no current branch, it's probably not a git repository
  if (!currentBranch && branches.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          disabled={isLoading}
        >
          <GithubIcon className="size-3" />
          <span className="max-w-[80px] truncate">
            {isLoading ? "..." : (currentBranch || "Unknown")}
          </span>
          <ChevronDownIcon className="size-3" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-48">
        <div className="px-2 py-1 text-xs text-muted-foreground">
          Switch Branch
        </div>
        <DropdownMenuSeparator />

        {branches.length === 0 && !isLoading ? (
          <DropdownMenuItem disabled>
            No branches found
          </DropdownMenuItem>
        ) : (
          branches
            .filter(branch => !branch.remote) // Show only local branches first
            .map((branch) => (
              <DropdownMenuItem
                key={branch.name}
                onClick={() => handleSwitchBranch(branch.name)}
                className="flex items-center justify-between"
              >
                <span className="truncate">{branch.name}</span>
                {branch.current && (
                  <span className="text-xs text-green-600">●</span>
                )}
              </DropdownMenuItem>
            ))
        )}

        {branches.some(branch => branch.remote) && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1 text-xs text-muted-foreground">
              Remote Branches
            </div>
            {branches
              .filter(branch => branch.remote && !branches.some(b => b.name === branch.name && !b.remote))
              .map((branch) => (
                <DropdownMenuItem
                  key={`${branch.remote}/${branch.name}`}
                  onClick={() => handleSwitchBranch(branch.name)}
                  className="text-muted-foreground"
                >
                  <span className="truncate">
                    {branch.remote}/{branch.name}
                  </span>
                </DropdownMenuItem>
              ))
            }
          </>
        )}

        <DropdownMenuSeparator />

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <PlusIcon className="size-3 mr-2" />
              Create Branch
            </DropdownMenuItem>
          </DialogTrigger>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Branch</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Enter branch name..."
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateBranch();
                  }
                }}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreateBranch}
                  disabled={!newBranchName.trim() || isLoading}
                >
                  Create
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <DropdownMenuItem onClick={handleRefreshGitInfo} disabled={isLoading}>
          Refresh
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};