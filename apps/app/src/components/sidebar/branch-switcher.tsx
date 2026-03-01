import { useState, useEffect, useRef } from "react";
import {
  Button,
  ChevronDownIcon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@agentide/ui";
import { IconGitBranch, IconPlus } from "@tabler/icons-react";
import { useWorkspaceStore } from "@/store/workspace.store";
import { useUIStore } from "@/store/ui.store";
import type { GitBranch } from "@agentide/shared";

type BranchSwitcherProps = {
  workspaceId: string;
  currentBranch?: string;
};

export const BranchSwitcher = ({ workspaceId, currentBranch }: BranchSwitcherProps) => {
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const createDialogOpen = useUIStore((s) => s.createBranchDialog.open);
  const openCreateBranchDialog = useUIStore((s) => s.openCreateBranchDialog);
  const prevCreateDialogOpen = useRef(createDialogOpen);
  const { getGitBranches, switchGitBranch, refreshGitInfo } = useWorkspaceStore();

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

  useEffect(() => {
    if (prevCreateDialogOpen.current && !createDialogOpen) loadBranches();
    prevCreateDialogOpen.current = createDialogOpen;
  }, [createDialogOpen]);

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
          <IconGitBranch className="size-3" />
          <span className="max-w-[80px] truncate text-xs">
            {isLoading ? "..." : (currentBranch || "Unknown")}
          </span>
          <ChevronDownIcon className="size-3" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[300px] p-0">
        <Command className="max-h-[300px]">
          <CommandInput placeholder="Search branches..." className="h-10 px-3 text-sm rounded-none border-b border-foreground/10" />
          <CommandList className="max-h-[400px]">
            <CommandEmpty>No branches found.</CommandEmpty>

            {branches.length > 0 && (
              <CommandGroup heading="Local Branches">
                {branches
                  .filter(branch => !branch.remote)
                  .map((branch) => (
                    <CommandItem
                      key={branch.name}
                      onSelect={() => handleSwitchBranch(branch.name)}
                      className="flex items-center justify-between rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <IconGitBranch stroke={1} size={12} className="size-3" />
                        <span className="truncate text-xs">{branch.name}</span>
                      </div>
                      {branch.current && (
                        <span className="text-xs text-accent">●</span>
                      )}
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}

            {branches.some(branch => branch.remote) && (
              <CommandGroup heading="Remote Branches">
                {branches
                  .filter(branch => branch.remote && !branches.some(b => b.name === branch.name && !b.remote))
                  .map((branch) => (
                    <CommandItem
                      key={`${branch.remote}/${branch.name}`}
                      onSelect={() => handleSwitchBranch(branch.name)}
                      className="text-muted-foreground rounded-lg"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <IconGitBranch stroke={1} size={12} className="size-3" />
                        <span className="truncate text-xs">
                          {branch.remote}/{branch.name}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}

            <CommandSeparator />

            <CommandGroup>
              <CommandItem className="rounded-lg" onSelect={() => openCreateBranchDialog(workspaceId)}>
                <IconPlus stroke={1} className="size-3 mr-2" />
                Create Branch
              </CommandItem>

              <CommandItem className="rounded-lg" onSelect={handleRefreshGitInfo} disabled={isLoading}>
                Refresh
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};