import { spawn } from "node:child_process";
import path from "node:path";
import { existsSync } from "node:fs";

export type GitBranch = {
  name: string;
  current: boolean;
  remote?: string;
};

export class GitService {
  private execGitCommand(cwd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const git = spawn("git", args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32'
      });

      let stdout = "";
      let stderr = "";

      git.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      git.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      git.on("close", (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(stderr.trim() || `Git command failed with code ${code}`));
        }
      });

      git.on("error", (error) => {
        reject(error);
      });
    });
  }

  async isGitRepository(workspacePath: string): Promise<boolean> {
    try {
      const gitDir = path.join(workspacePath, ".git");
      if (!existsSync(gitDir)) {
        return false;
      }
      await this.execGitCommand(workspacePath, ["rev-parse", "--git-dir"]);
      return true;
    } catch {
      return false;
    }
  }

  async getCurrentBranch(workspacePath: string): Promise<string | null> {
    try {
      const branch = await this.execGitCommand(workspacePath, ["branch", "--show-current"]);
      return branch || null;
    } catch {
      return null;
    }
  }

  async getAllBranches(workspacePath: string): Promise<GitBranch[]> {
    try {
      const output = await this.execGitCommand(workspacePath, ["branch", "-a"]);
      const branches: GitBranch[] = [];
      const lines = output.split("\n").filter(line => line.trim());

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const current = trimmed.startsWith("*");
        let name = current ? trimmed.substring(1).trim() : trimmed;

        // Skip HEAD references
        if (name.includes("HEAD ->")) continue;

        // Handle remote branches
        let remote: string | undefined;
        if (name.startsWith("remotes/")) {
          const parts = name.replace("remotes/", "").split("/");
          if (parts.length >= 2) {
            remote = parts[0];
            name = parts.slice(1).join("/");
          }
        }

        // Check if this branch already exists (to avoid duplicates between local and remote)
        const existing = branches.find(b => b.name === name);
        if (existing) {
          if (!existing.remote && remote) {
            existing.remote = remote;
          }
        } else {
          branches.push({
            name,
            current,
            remote,
          });
        }
      }

      return branches;
    } catch (error) {
      throw new Error(`Failed to get branches: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async switchBranch(workspacePath: string, branchName: string): Promise<void> {
    try {
      await this.execGitCommand(workspacePath, ["checkout", branchName]);
    } catch (error) {
      throw new Error(`Failed to switch to branch ${branchName}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async createAndSwitchBranch(workspacePath: string, branchName: string): Promise<void> {
    try {
      await this.execGitCommand(workspacePath, ["checkout", "-b", branchName]);
    } catch (error) {
      throw new Error(`Failed to create and switch to branch ${branchName}: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async getGitStatus(workspacePath: string): Promise<{
    staged: string[];
    unstaged: string[];
    untracked: string[];
  }> {
    try {
      const output = await this.execGitCommand(workspacePath, ["status", "--porcelain"]);
      const staged: string[] = [];
      const unstaged: string[] = [];
      const untracked: string[] = [];

      const lines = output.split("\n").filter(line => line.trim());
      for (const line of lines) {
        if (line.length < 3) continue;

        const statusCode = line.substring(0, 2);
        const fileName = line.substring(3);

        if (statusCode[0] !== " " && statusCode[0] !== "?") {
          staged.push(fileName);
        }
        if (statusCode[1] !== " " && statusCode[1] !== "?") {
          unstaged.push(fileName);
        }
        if (statusCode === "??") {
          untracked.push(fileName);
        }
      }

      return { staged, unstaged, untracked };
    } catch (error) {
      throw new Error(`Failed to get git status: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

export const gitService = new GitService();