import { createHash } from "node:crypto";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename, unlink } from "node:fs/promises";
import { simpleGit, type SimpleGit, type StatusResult } from "simple-git";
import { getOpenadeDataDir } from "../lib/data-paths.js";

function workspaceDataKey(workspacePath: string): string {
  return createHash("sha256").update(path.resolve(workspacePath)).digest("hex").slice(0, 24);
}

export type GitBranch = {
  name: string;
  current: boolean;
  remote?: string;
};

export class GitService {
  private getGit(cwd: string): SimpleGit {
    return simpleGit(cwd);
  }

  async isGitRepository(workspacePath: string): Promise<boolean> {
    try {
      const gitDir = path.join(workspacePath, ".git");
      if (!existsSync(gitDir)) return false;
      const git = this.getGit(workspacePath);
      await git.revparse(["--git-dir"]);
      return true;
    } catch {
      return false;
    }
  }

  async getCurrentBranch(workspacePath: string): Promise<string | null> {
    try {
      const git = this.getGit(workspacePath);
      const status = await git.status();
      return status.current ?? null;
    } catch {
      return null;
    }
  }

  async getAllBranches(workspacePath: string): Promise<GitBranch[]> {
    try {
      const git = this.getGit(workspacePath);
      const branchSummary = await git.branch(["-a"]);
      const branches: GitBranch[] = [];

      for (const [name, branch] of Object.entries(branchSummary.branches)) {
        if (name.includes("HEAD ->")) continue;

        let branchName = name;
        let remote: string | undefined;

        if (name.startsWith("remotes/")) {
          const parts = name.replace("remotes/", "").split("/");
          if (parts.length >= 2) {
            remote = parts[0];
            branchName = parts.slice(1).join("/");
          }
        }

        const existing = branches.find((b) => b.name === branchName);
        if (existing) {
          if (!existing.remote && remote) existing.remote = remote;
        } else {
          branches.push({
            name: branchName,
            current: branch.current,
            remote,
          });
        }
      }

      return branches;
    } catch (error) {
      throw new Error(
        `Failed to get branches: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async switchBranch(workspacePath: string, branchName: string): Promise<void> {
    try {
      const git = this.getGit(workspacePath);
      await git.checkout(branchName);
    } catch (error) {
      throw new Error(
        `Failed to switch to branch ${branchName}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async createAndSwitchBranch(workspacePath: string, branchName: string): Promise<void> {
    try {
      const git = this.getGit(workspacePath);
      await git.checkoutLocalBranch(branchName);
    } catch (error) {
      throw new Error(
        `Failed to create and switch to branch ${branchName}: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async getUnstagedNumstat(
    workspacePath: string
  ): Promise<{ path: string; added: number; deleted: number }[]> {
    try {
      const git = this.getGit(workspacePath);
      const [status, diffSummary] = await Promise.all([
        git.status(),
        git.diffSummary().catch(() => ({ files: [] })),
      ]);

      const numstatMap = new Map<string, { added: number; deleted: number }>();
      for (const file of diffSummary.files) {
        if (!file.binary) {
          numstatMap.set(file.file, {
            added: file.insertions,
            deleted: file.deletions,
          });
        }
      }

      const result: { path: string; added: number; deleted: number }[] = [];
      for (const file of status.files) {
        if (file.working_dir === " " || file.working_dir === "?") {
          if (file.working_dir !== "?") continue;
        }
        if (file.working_dir === " ") continue;

        const filePath = file.path;
        if (filePath.endsWith("/")) continue;

        const counts = numstatMap.get(filePath);
        result.push({
          path: filePath,
          added: counts?.added ?? 0,
          deleted: counts?.deleted ?? 0,
        });
      }

      return result;
    } catch (error) {
      throw new Error(
        `Failed to get unstaged changes: ${error instanceof Error ? error.message : "Unknown"}`
      );
    }
  }

  async getStagedNumstat(
    workspacePath: string
  ): Promise<{ path: string; added: number; deleted: number }[]> {
    try {
      const git = this.getGit(workspacePath);
      const [status, diffSummary] = await Promise.all([
        git.status(),
        git.diffSummary(["--cached"]).catch(() => ({ files: [] })),
      ]);

      const numstatMap = new Map<string, { added: number; deleted: number }>();
      for (const file of diffSummary.files) {
        if (!file.binary) {
          numstatMap.set(file.file, {
            added: file.insertions,
            deleted: file.deletions,
          });
        }
      }

      const result: { path: string; added: number; deleted: number }[] = [];
      for (const file of status.files) {
        if (file.index === " " || file.index === "?") continue;

        const filePath = file.path;
        if (filePath.endsWith("/")) continue;

        const counts = numstatMap.get(filePath);
        result.push({
          path: filePath,
          added: counts?.added ?? 0,
          deleted: counts?.deleted ?? 0,
        });
      }

      return result;
    } catch (error) {
      throw new Error(
        `Failed to get staged changes: ${error instanceof Error ? error.message : "Unknown"}`
      );
    }
  }

  async stageFile(workspacePath: string, relativePath: string): Promise<void> {
    const git = this.getGit(workspacePath);
    await git.add(relativePath);
  }

  async unstageFile(workspacePath: string, relativePath: string): Promise<void> {
    const git = this.getGit(workspacePath);
    await git.reset(["HEAD", "--", relativePath]);
  }

  async commit(workspacePath: string, message: string): Promise<void> {
    const git = this.getGit(workspacePath);
    await git.commit(message);
  }

  async push(workspacePath: string): Promise<void> {
    const git = this.getGit(workspacePath);
    await git.push();
  }

  async getAheadCount(workspacePath: string): Promise<number> {
    try {
      const git = this.getGit(workspacePath);
      const count = await git.raw(["rev-list", "--count", "@{u}..HEAD"]);
      const n = parseInt(count.trim(), 10);
      return Number.isNaN(n) ? 0 : n;
    } catch {
      return 0;
    }
  }

  async getFileDiffContent(
    workspacePath: string,
    relativePath: string,
    staged = false
  ): Promise<{ oldContent: string; newContent: string; patch?: string }> {
    const fullPath = path.join(workspacePath, relativePath);
    const git = this.getGit(workspacePath);

    let oldContent = "";
    let newContent = "";
    let patch = "";

    if (staged) {
      try {
        oldContent = await git.show([`HEAD:${relativePath}`]);
      } catch {
        oldContent = "";
      }
      try {
        newContent = await git.show([`:${relativePath}`]);
      } catch {
        newContent = "";
      }
      try {
        patch = await git.diff(["--cached", "--", relativePath]);
      } catch {
        patch = "";
      }
    } else {
      try {
        oldContent = await git.show([`:${relativePath}`]);
      } catch {
        try {
          oldContent = await git.show([`HEAD:${relativePath}`]);
        } catch {
          oldContent = "";
        }
      }
      try {
        if (existsSync(fullPath)) {
          newContent = readFileSync(fullPath, "utf-8");
        }
      } catch {
        newContent = "";
      }
      try {
        patch = await git.diff(["--", relativePath]);
      } catch {
        patch = "";
      }
    }

    return { oldContent, newContent, patch };
  }

  async getStagedPatch(workspacePath: string, relativePath: string): Promise<string> {
    const git = this.getGit(workspacePath);
    try {
      return await git.diff(["--cached", "--", relativePath]);
    } catch {
      return "";
    }
  }

  async revertUnstagedFile(workspacePath: string, relativePath: string): Promise<void> {
    const git = this.getGit(workspacePath);
    await git.checkout(["--", relativePath]);
  }

  async hasChanges(workspacePath: string): Promise<boolean> {
    try {
      const git = this.getGit(workspacePath);
      const status = await git.status();
      return !status.isClean();
    } catch {
      return false;
    }
  }

  async getCurrentHead(workspacePath: string): Promise<string | null> {
    try {
      const git = this.getGit(workspacePath);
      const sha = await git.revparse(["HEAD"]);
      return sha.length > 0 ? sha : null;
    } catch {
      return null;
    }
  }

  async stashCreate(workspacePath: string): Promise<string | null> {
    try {
      const git = this.getGit(workspacePath);
      const ref = await git.raw(["stash", "create"]);
      return ref.trim().length > 0 ? ref.trim() : null;
    } catch {
      return null;
    }
  }

  async createRef(workspacePath: string, refName: string, sha: string): Promise<void> {
    const git = this.getGit(workspacePath);
    await git.raw(["update-ref", refName, sha]);
  }

  async deleteCheckpointRefs(workspacePath: string, threadId: string): Promise<void> {
    const git = this.getGit(workspacePath);
    const prefix = `refs/checkpoints/${threadId}/`;
    const output = await git.raw(["for-each-ref", "--format=%(refname)", prefix]).catch(() => "");
    const refs = output
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);
    await Promise.allSettled(refs.map((ref) => git.raw(["update-ref", "-d", ref])));
  }

  async stashApply(workspacePath: string, stashRef: string): Promise<void> {
    const git = this.getGit(workspacePath);
    await git.checkout([stashRef, "--", "."]);
  }

  async restoreToHead(workspacePath: string): Promise<void> {
    const git = this.getGit(workspacePath);
    await git.checkout(["HEAD", "--", "."]);
  }

  async getUntrackedFiles(workspacePath: string): Promise<string[]> {
    try {
      const git = this.getGit(workspacePath);
      const status = await git.status();
      return status.not_added;
    } catch {
      return [];
    }
  }

  async getModifiedFilesBetween(
    workspacePath: string,
    fromRef: string | null,
    toRef: string | null
  ): Promise<string[]> {
    try {
      const git = this.getGit(workspacePath);
      const args = toRef ? [fromRef ?? "HEAD", toRef] : [fromRef ?? "HEAD"];
      const diff = await git.diffSummary(args);
      return diff.files.map((f) => f.file);
    } catch {
      return [];
    }
  }

  async getModifiedFilesSince(
    workspacePath: string,
    ref: string | null,
    untrackedAtCheckpoint: string[] = []
  ): Promise<{ modified: string[]; created: string[] }> {
    const modified = await this.getModifiedFilesBetween(workspacePath, ref, null);
    const currentUntracked = await this.getUntrackedFiles(workspacePath);
    const baseline = new Set(untrackedAtCheckpoint);
    const created = currentUntracked.filter((f) => !baseline.has(f));
    return { modified, created };
  }

  async restoreFiles(workspacePath: string, ref: string | null, files: string[]): Promise<void> {
    if (files.length === 0) return;
    const git = this.getGit(workspacePath);
    await git.checkout([ref ?? "HEAD", "--", ...files]);
  }

  async safeDeleteFiles(workspacePath: string, files: string[]): Promise<void> {
    if (files.length === 0) return;
    const trashDir = path.join(
      getOpenadeDataDir(),
      "checkpoint-trash",
      workspaceDataKey(workspacePath),
    );
    await mkdir(trashDir, { recursive: true }).catch(() => {});
    const untracked = new Set(await this.getUntrackedFiles(workspacePath).catch(() => []));
    await Promise.allSettled(
      files.map(async (f) => {
        if (!untracked.has(f)) return;
        const src = path.join(workspacePath, f);
        const dest = path.join(trashDir, `${f.replace(/[/\\]/g, "_")}_${Date.now()}`);
        try {
          await rename(src, dest);
        } catch {
          await unlink(src).catch(() => {});
        }
      })
    );
  }

  async getGitStatus(workspacePath: string): Promise<{
    staged: string[];
    unstaged: string[];
    untracked: string[];
  }> {
    try {
      const git = this.getGit(workspacePath);
      const status: StatusResult = await git.status();

      const staged: string[] = [];
      const unstaged: string[] = [];
      const untracked: string[] = status.not_added;

      for (const file of status.files) {
        if (file.index !== " " && file.index !== "?") {
          staged.push(file.path);
        }
        if (file.working_dir !== " " && file.working_dir !== "?") {
          unstaged.push(file.path);
        }
      }

      return { staged, unstaged, untracked };
    } catch (error) {
      throw new Error(
        `Failed to get git status: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async init(workspacePath: string): Promise<void> {
    try {
      const git = this.getGit(workspacePath);
      await git.init();
    } catch (error) {
      throw new Error(
        `Failed to init git: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async clone(repoUrl: string, targetPath: string): Promise<void> {
    try {
      const git = simpleGit();
      await git.clone(repoUrl, targetPath);
    } catch (error) {
      throw new Error(
        `Failed to clone: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

export const gitService = new GitService();
