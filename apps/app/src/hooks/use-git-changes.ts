import { useCallback, useEffect, useState } from "react";
import { getElectronAPI } from "@/lib/electron";
import { useWorkspaceStore } from "@/store/workspace";
import type { GitUnstagedChange } from "@agentide/shared";

export type GitChangedFile = {
  path: string;
  added: number;
  deleted: number;
};

export function useGitUnstagedChanges(): GitChangedFile[] {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const workspaceId = activeWorkspace?.id ?? null;

  const gitChangeVersion = useWorkspaceStore((s) =>
    workspaceId ? (s.gitChangeVersions[workspaceId] ?? 0) : 0
  );

  const [changes, setChanges] = useState<GitUnstagedChange[]>([]);

  const fetchChanges = useCallback(async () => {
    if (!workspaceId) {
      setChanges([]);
      return;
    }

    const api = getElectronAPI();
    if (!api) {
      setChanges([]);
      return;
    }

    try {
      const result = await api.workspace.getUnstagedChanges(workspaceId);
      if (result.success && result.data) {
        setChanges(result.data);
      } else {
        setChanges([]);
      }
    } catch {
      setChanges([]);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchChanges();
  }, [fetchChanges, gitChangeVersion]);

  return changes;
}
