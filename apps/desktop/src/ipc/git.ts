import { ipcMain } from "electron";
import { IPC } from "@openade/shared";
import { workspaceManager } from "../services/workspace-manager";
import { gitService } from "../services/git-service";
import * as path from "path";
import * as fs from "fs/promises";

export function registerGitHandlers(): void {
  ipcMain.handle(IPC.WORKSPACE_GIT_REFRESH, async (_event, id: string) => {
    try {
      const workspace = await workspaceManager.refreshGitInfo(id);
      return { success: true, data: workspace };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to refresh git info" };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_GIT_BRANCHES, async (_event, id: string) => {
    try {
      const branches = await workspaceManager.getGitBranches(id);
      return { success: true, data: branches };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to get git branches" };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_GIT_SWITCH_BRANCH, async (_event, id: string, branchName: string) => {
    try {
      const workspace = await workspaceManager.switchGitBranch(id, branchName);
      return { success: true, data: workspace };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to switch branch" };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_GIT_CREATE_BRANCH, async (_event, id: string, branchName: string) => {
    try {
      const workspace = await workspaceManager.createGitBranch(id, branchName);
      return { success: true, data: workspace };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to create branch" };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_GIT_INIT, async (_event, id: string) => {
    try {
      const workspace = await workspaceManager.initializeGitRepository(id);
      return { success: true, data: workspace };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to initialize git repository" };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_GIT_UNSTAGED_CHANGES, async (_event, id: string) => {
    try {
      const workspace = workspaceManager.get(id);
      if (!workspace) return { success: false, error: "Workspace not found" };
      const isGit = await gitService.isGitRepository(workspace.path);
      if (!isGit) return { success: true, data: [] };
      const changes = await gitService.getUnstagedNumstat(workspace.path);
      return { success: true, data: changes };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to get unstaged changes" };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_GET_FILE_DIFF, async (_event, workspaceId: string, filePath: string, staged = false) => {
    try {
      const workspace = workspaceManager.get(workspaceId);
      if (!workspace) return { success: false, error: "Workspace not found" };
      const data = await gitService.getFileDiffContent(workspace.path, filePath, staged);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to get file diff" };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_REVERT_FILE_CHANGE, async (_event, workspaceId: string, filePath: string) => {
    try {
      const workspace = workspaceManager.get(workspaceId);
      if (!workspace) return { success: false, error: "Workspace not found" };
      await gitService.revertUnstagedFile(workspace.path, filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to revert file" };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_GIT_STAGED_CHANGES, async (_event, id: string) => {
    try {
      const workspace = workspaceManager.get(id);
      if (!workspace) return { success: false, error: "Workspace not found" };
      const isGit = await gitService.isGitRepository(workspace.path);
      if (!isGit) return { success: true, data: [] };
      const changes = await gitService.getStagedNumstat(workspace.path);
      return { success: true, data: changes };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to get staged changes" };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_GIT_STAGE_FILE, async (_event, workspaceId: string, filePath: string) => {
    try {
      const workspace = workspaceManager.get(workspaceId);
      if (!workspace) return { success: false, error: "Workspace not found" };
      await gitService.stageFile(workspace.path, filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to stage file" };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_GIT_UNSTAGE_FILE, async (_event, workspaceId: string, filePath: string) => {
    try {
      const workspace = workspaceManager.get(workspaceId);
      if (!workspace) return { success: false, error: "Workspace not found" };
      await gitService.unstageFile(workspace.path, filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to unstage file" };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_GIT_COMMIT, async (_event, workspaceId: string, message: string) => {
    try {
      const workspace = workspaceManager.get(workspaceId);
      if (!workspace) return { success: false, error: "Workspace not found" };
      await gitService.commit(workspace.path, message);
      await workspaceManager.refreshGitInfo(workspace.id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to commit" };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_GIT_PUSH, async (_event, workspaceId: string) => {
    try {
      const workspace = workspaceManager.get(workspaceId);
      if (!workspace) return { success: false, error: "Workspace not found" };
      await gitService.push(workspace.path);
      await workspaceManager.refreshGitInfo(workspace.id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to push" };
    }
  });

  ipcMain.handle(IPC.WORKSPACE_GIT_AHEAD_COUNT, async (_event, workspaceId: string) => {
    try {
      const workspace = workspaceManager.get(workspaceId);
      if (!workspace) return { success: false, error: "Workspace not found" };
      const count = await gitService.getAheadCount(workspace.path);
      return { success: true, data: count };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to get ahead count" };
    }
  });

  ipcMain.handle(IPC.PROJECT_CREATE_EMPTY, async (_event, parentDir: string, folderName: string) => {
    try {
      const targetPath = path.join(parentDir, folderName.trim());
      if (targetPath === parentDir || !folderName.trim()) {
        return { success: false, error: "Invalid folder name" };
      }
      await fs.mkdir(targetPath, { recursive: true });
      await gitService.init(targetPath);
      return { success: true, data: targetPath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to create project" };
    }
  });

  ipcMain.handle(IPC.PROJECT_CLONE, async (_event, repoUrl: string, parentDir: string) => {
    try {
      const trimmed = repoUrl.trim();
      if (!trimmed) return { success: false, error: "Repository URL is required" };
      const baseName = path.basename(trimmed.replace(/\.git$/i, ""));
      if (!baseName) return { success: false, error: "Invalid repository URL" };
      const targetPath = path.join(parentDir, baseName);
      await gitService.clone(trimmed, targetPath);
      return { success: true, data: targetPath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to clone repository" };
    }
  });
}
