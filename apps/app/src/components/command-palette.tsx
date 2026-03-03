import { useEffect, useState, useCallback } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from "@agentide/ui";
import {
  IconMessagePlus,
  IconGitBranch,
  IconFolderPlus,
  IconSearch,
  IconPlayerStop,
  IconList,
  IconBrowser,
  IconFileText,
} from "@tabler/icons-react";
import { useAgentStore } from "@/store/agent.store";
import { useWorkspaceStore } from "@/store/workspace.store";
import { useUIStore } from "@/store/ui.store";

export const CommandPalette = () => {
  const [open, setOpen] = useState(false);

  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const activeWorkspace = useWorkspaceStore((s) =>
    s.workspaces.find((w) => w.id === s.activeWorkspaceId) ?? null
  );
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  const status = useAgentStore((s) =>
    activeWorkspaceId
      ? Object.values(s.getWorkspaceState(activeWorkspaceId).threadRuntime).some(
          (runtime) => runtime.status === "running"
        )
        ? "running"
        : "idle"
      : "idle"
  );
  const startNewThread = useAgentStore((s) => s.startNewThread);
  const stopAgent = useAgentStore((s) => s.stopAgent);
  const openCreateBranchDialog = useUIStore((s) => s.openCreateBranchDialog);
  const setCenterPage = useUIStore((s) => s.setCenterPage);
  const openWebView = useUIStore((s) => s.openWebView);
  const openAgentLogDrawer = useUIStore((s) => s.openAgentLogDrawer);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (e.key === "n" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const workspaceId = useWorkspaceStore.getState().activeWorkspaceId;
        if (!workspaceId) return;
        useUIStore.getState().setCenterPage("chat");
        const agent = useAgentStore.getState();
        void agent.loadWorkspace(workspaceId).then(() => agent.startNewThread(workspaceId));
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runAndClose = useCallback(
    (fn: () => void) => {
      fn();
      setOpen(false);
    },
    []
  );

  const handleNewChat = () => {
    if (!activeWorkspace?.id) return;
    runAndClose(() => startNewThread(activeWorkspace.id));
  };

  const handleStopAgent = () => {
    if (status !== "running" || !activeWorkspaceId) return;
    runAndClose(() => stopAgent(activeWorkspaceId));
  };

  const handleCreateBranch = () => {
    if (!activeWorkspace?.id) return;
    runAndClose(() => openCreateBranchDialog(activeWorkspace.id));
  };

  const handleSwitchWorkspace = (id: string) => {
    runAndClose(() => selectWorkspace(id));
  };

  const handleOpenTasks = () => {
    runAndClose(() => setCenterPage("tasks"));
  };

  const handleOpenWebView = () => {
    runAndClose(() => openWebView());
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput className="px-4" placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Chat">
          <CommandItem onSelect={handleNewChat} disabled={!activeWorkspace}>
            <IconMessagePlus stroke={1} className="size-4 opacity-60" />
            <span>New Chat</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          {status === "running" && (
            <CommandItem onSelect={handleStopAgent}>
              <IconPlayerStop stroke={1} className="size-4 opacity-60" />
              <span>Stop Agent</span>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="View">
          <CommandItem onSelect={handleOpenTasks}>
            <IconList stroke={1} className="size-4 opacity-60" />
            <span>Open Tasks</span>
          </CommandItem>
          <CommandItem onSelect={handleOpenWebView}>
            <IconBrowser stroke={1} className="size-4 opacity-60" />
            <span>Open Web View</span>
          </CommandItem>
          <CommandItem onSelect={() => runAndClose(openAgentLogDrawer)}>
            <IconFileText stroke={1} className="size-4 opacity-60" />
            <span>Open Agent Log</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Git">
          <CommandItem
            onSelect={handleCreateBranch}
            disabled={!activeWorkspace}
          >
            <IconGitBranch stroke={1} className="size-4 opacity-60" />
            <span>Create Branch</span>
          </CommandItem>
        </CommandGroup>

        {workspaces.length > 1 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Switch Workspace">
              {workspaces
                .filter((w) => w.id !== activeWorkspace?.id)
                .map((w) => (
                  <CommandItem
                    key={w.id}
                    onSelect={() => handleSwitchWorkspace(w.id)}
                  >
                    <IconFolderPlus stroke={1} className="size-4 opacity-60" />
                    <span>{w.name}</span>
                    <span className="truncate text-muted-foreground text-xs max-w-[200px]">
                      {w.path}
                    </span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};
