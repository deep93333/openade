import type { Workspace } from "@openade/shared";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ulid } from "ulid";
import { getOpenadeDataDir } from "../lib/data-paths.js";
import { gitService } from "./git-service.js";

function getStoragePath(): string {
  const dir = getOpenadeDataDir();
  return path.join(dir, "workspaces.json");
}

class WorkspaceManager {
  private workspaces: Map<string, Workspace> = new Map();
  private loaded = false;

  private loadFromDisk(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const filePath = getStoragePath();
      if (!existsSync(filePath)) return;
      const raw = readFileSync(filePath, "utf-8");
      const data = JSON.parse(raw) as { workspaces: Workspace[] };
      if (Array.isArray(data?.workspaces)) {
        for (const w of data.workspaces) {
          if (w?.id && w?.name != null && w?.path) {
            this.workspaces.set(w.id, {
              id: w.id,
              name: w.name,
              path: w.path,
              createdAt: w.createdAt ?? Date.now(),
              isGitRepository: w.isGitRepository ?? !!w.branch,
              branch: w.branch,
            });
          }
        }
      }
    } catch {
      //
    }
  }

  private saveToDisk(): void {
    try {
      const workspaces = Array.from(this.workspaces.values());
      writeFileSync(getStoragePath(), JSON.stringify({ workspaces }, null, 0), "utf-8");
    } catch {
      //
    }
  }

  list(): Workspace[] {
    this.loadFromDisk();
    return Array.from(this.workspaces.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  get(id: string): Workspace | undefined {
    this.loadFromDisk();
    return this.workspaces.get(id);
  }

  async create(name: string, dirPath: string): Promise<Workspace> {
    this.loadFromDisk();
    if (!existsSync(dirPath)) {
      throw new Error(`Directory does not exist: ${dirPath}`);
    }

    let isGitRepository = false;
    let branch: string | undefined;
    try {
      isGitRepository = await gitService.isGitRepository(dirPath);
      if (isGitRepository) {
        branch = (await gitService.getCurrentBranch(dirPath)) || undefined;
      }
    } catch {
      //
    }

    const workspace: Workspace = {
      id: ulid(),
      name,
      path: dirPath,
      createdAt: Date.now(),
      isGitRepository,
      branch,
    };

    this.workspaces.set(workspace.id, workspace);
    this.saveToDisk();
    return workspace;
  }

  remove(id: string): void {
    this.loadFromDisk();
    if (!this.workspaces.has(id)) {
      throw new Error(`Workspace not found: ${id}`);
    }
    this.workspaces.delete(id);
    this.saveToDisk();
  }

  update(id: string, updates: Partial<Pick<Workspace, "name" | "branch" | "isGitRepository">>): Workspace {
    this.loadFromDisk();
    const workspace = this.workspaces.get(id);
    if (!workspace) {
      throw new Error(`Workspace not found: ${id}`);
    }

    const updated = { ...workspace, ...updates };
    this.workspaces.set(id, updated);
    this.saveToDisk();
    return updated;
  }

  async refreshGitInfo(id: string): Promise<Workspace> {
    this.loadFromDisk();
    const workspace = this.workspaces.get(id);
    if (!workspace) {
      throw new Error(`Workspace not found: ${id}`);
    }

    try {
      const isGitRepository = await gitService.isGitRepository(workspace.path);
      if (isGitRepository) {
        const currentBranch = await gitService.getCurrentBranch(workspace.path);
        return this.update(id, {
          isGitRepository: true,
          branch: currentBranch || undefined,
        });
      }
      return this.update(id, {
        isGitRepository: false,
        branch: undefined,
      });
    } catch (error) {
      throw new Error(`Failed to refresh git info: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async getGitBranches(id: string) {
    this.loadFromDisk();
    const workspace = this.workspaces.get(id);
    if (!workspace) {
      throw new Error(`Workspace not found: ${id}`);
    }

    try {
      const isGitRepo = await gitService.isGitRepository(workspace.path);
      if (!isGitRepo) {
        throw new Error("Not a git repository");
      }

      return await gitService.getAllBranches(workspace.path);
    } catch (error) {
      throw new Error(`Failed to get git branches: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async switchGitBranch(id: string, branchName: string): Promise<Workspace> {
    this.loadFromDisk();
    const workspace = this.workspaces.get(id);
    if (!workspace) {
      throw new Error(`Workspace not found: ${id}`);
    }

    try {
      const isGitRepo = await gitService.isGitRepository(workspace.path);
      if (!isGitRepo) {
        throw new Error("Not a git repository");
      }

      await gitService.switchBranch(workspace.path, branchName);
      return this.update(id, { isGitRepository: true, branch: branchName });
    } catch (error) {
      throw new Error(`Failed to switch branch: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async createGitBranch(id: string, branchName: string): Promise<Workspace> {
    this.loadFromDisk();
    const workspace = this.workspaces.get(id);
    if (!workspace) {
      throw new Error(`Workspace not found: ${id}`);
    }

    try {
      const isGitRepo = await gitService.isGitRepository(workspace.path);
      if (!isGitRepo) {
        throw new Error("Not a git repository");
      }

      await gitService.createAndSwitchBranch(workspace.path, branchName);
      return this.update(id, { isGitRepository: true, branch: branchName });
    } catch (error) {
      throw new Error(`Failed to create branch: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async initializeGitRepository(id: string): Promise<Workspace> {
    this.loadFromDisk();
    const workspace = this.workspaces.get(id);
    if (!workspace) {
      throw new Error(`Workspace not found: ${id}`);
    }

    try {
      await gitService.init(workspace.path);
      return await this.refreshGitInfo(id);
    } catch (error) {
      throw new Error(`Failed to initialize git repository: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

export const workspaceManager = new WorkspaceManager();
