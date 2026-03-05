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
import { useWorkspaceStore } from "@/store/workspace";
import { useUIStore } from "@/store/ui";
import type { GitBranch } from "@agentide/shared";

type BranchSwitcherProps = {
  workspaceId: string;
  currentBranch?: string;
};

export const BranchSwitcher = ({ workspaceId, currentBranch }: BranchSwitcherProps) => {
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const createDialogOpen = useUIStore((s) => s.createBranchDialog.open);
  const openCreateBranchDialog = useUIStore((s) => s.openCreateBranchDialog);
  const prevCreateDialogOpen = useRef(createDialogOpen);
  const { getGitBranches, switchGitBranch } = useWorkspaceStore();

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
    if (prevCreateDialogOpen.current && !createDialogOpen) {
      loadBranches();
      setSearchQuery("");
    }
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

  // Filter branches by search query
  const filteredBranches = branches.filter((branch) =>
    branch.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const localBranches = filteredBranches.filter((branch) => !branch.remote);
  const remoteBranches = filteredBranches.filter(
    (branch) => branch.remote && !filteredBranches.some((b) => b.name === branch.name && !b.remote)
  );

  // Show create branch option when search query doesn't match any branches
  const showCreateOption = searchQuery.trim().length > 0 && filteredBranches.length === 0;
  const trimmedSearchQuery = searchQuery.trim();

  // If no current branch, it's probably not a git repository
  if (!currentBranch && branches.length === 0) {
    return null;
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (open) {
          loadBranches();
        }
      }}>
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
          <CommandInput
            placeholder="Search branches..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            className="h-10 px-3 text-sm rounded-none border-b border-foreground/10"
          />
          <CommandList className="max-h-[400px]">
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              No branches found.
            </CommandEmpty>

            {showCreateOption && (
              <CommandGroup>
                <CommandItem
                  onSelect={() => openCreateBranchDialog(workspaceId, trimmedSearchQuery)}
                  className="rounded-lg"
                >
                  <IconPlus stroke={1} className="size-3 mr-2" />
                  <span className="truncate text-xs">Create branch "{trimmedSearchQuery}"</span>
                </CommandItem>
              </CommandGroup>
            )}

            {localBranches.length > 0 && (
              <CommandGroup heading="Local Branches">
                {localBranches.map((branch) => (
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

            {remoteBranches.length > 0 && (
              <CommandGroup heading="Remote Branches">
                {remoteBranches.map((branch) => (
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
              {!showCreateOption && (
                <CommandItem className="rounded-lg" onSelect={() => openCreateBranchDialog(workspaceId)}>
                  <IconPlus stroke={1} className="size-3" />
                  <span className="text-xs">Create Branch</span>
                </CommandItem>
              )}

              </CommandGroup>
          </CommandList>
        </Command>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
