import { useCallback, useEffect, useRef, useState } from "react";
import { getElectronAPI } from "@/lib/electron";
import { useWorkspaceStore } from "@/store/workspace";
import type { ElectronAPI, GitStagedChange, GitUnstagedChange } from "@openade/shared";

export type GitChangedFile = {
  path: string;
  added: number;
  deleted: number;
};

export function useGitUnstagedChanges(): GitChangedFile[] {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const workspaceId = activeWorkspace?.id ?? null;
  const isGitWorkspace = !!activeWorkspace?.isGitRepository;

  const gitChangeVersion = useWorkspaceStore((s) =>
    workspaceId ? (s.gitChangeVersions[workspaceId] ?? 0) : 0
  );

  const [changes, setChanges] = useState<GitUnstagedChange[]>([]);

  const fetchChanges = useCallback(async () => {
    if (!workspaceId || !isGitWorkspace) {
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
  }, [isGitWorkspace, workspaceId]);

  useEffect(() => {
    fetchChanges();
  }, [fetchChanges, gitChangeVersion]);

  return changes;
}

export type GitStatus = {
  staged: GitStagedChange[];
  unstaged: GitUnstagedChange[];
  aheadCount: number;
  loading: boolean;
};

export function useGitStatus(): GitStatus {
  const activeWorkspace = useWorkspaceStore((s) => s.activeWorkspace);
  const workspaceId = activeWorkspace?.id ?? null;
  const isGitWorkspace = !!activeWorkspace?.isGitRepository;
  const gitChangeVersion = useWorkspaceStore((s) =>
    workspaceId ? (s.gitChangeVersions[workspaceId] ?? 0) : 0
  );

  const [staged, setStaged] = useState<GitStagedChange[]>([]);
  const [unstaged, setUnstaged] = useState<GitUnstagedChange[]>([]);
  const [aheadCount, setAheadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    hasLoadedRef.current = false;
  }, [workspaceId]);

  const fetch = useCallback(async () => {
    if (!workspaceId || !isGitWorkspace) {
      setStaged([]);
      setUnstaged([]);
      setAheadCount(0);
      return;
    }
    const api = getElectronAPI();
    if (!api) return;
    if (!hasLoadedRef.current) setLoading(true);
    try {
      const [unstagedRes, stagedRes, aheadRes] = await Promise.all([
        api.workspace.getUnstagedChanges(workspaceId),
        api.workspace.getStagedChanges(workspaceId),
        (api.workspace as ElectronAPI["workspace"]).getAheadCount(workspaceId),
      ]);
      setUnstaged(unstagedRes.success && unstagedRes.data ? unstagedRes.data : []);
      setStaged(stagedRes.success && stagedRes.data ? stagedRes.data : []);
      setAheadCount(aheadRes.success && typeof aheadRes.data === "number" ? aheadRes.data : 0);
      hasLoadedRef.current = true;
    } catch {
      // silently ignore — topbar badge is non-critical
    } finally {
      setLoading(false);
    }
  }, [isGitWorkspace, workspaceId]);

  useEffect(() => {
    fetch();
  }, [fetch, gitChangeVersion]);

  return { staged, unstaged, aheadCount, loading };
}
