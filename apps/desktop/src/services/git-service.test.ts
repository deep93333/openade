import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { gitService } from "./git-service";

describe("GitService checkpoint (stash) operations", () => {
  let tmpDir: string;

  function runGit(cwd: string, args: string[]) {
    execSync(`git ${args.join(" ")}`, { cwd, encoding: "utf-8" });
  }

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "git-service-test-"));
    runGit(tmpDir, ["init"]);
    runGit(tmpDir, ["config", "user.email", "test@test.com"]);
    runGit(tmpDir, ["config", "user.name", "Test"]);
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("hasChanges", () => {
    it("returns false for clean working tree", async () => {
      const result = await gitService.hasChanges(tmpDir);
      expect(result).toBe(false);
    });

    it("returns true when there are unstaged changes", async () => {
      writeFileSync(join(tmpDir, "file.txt"), "hello");
      const result = await gitService.hasChanges(tmpDir);
      expect(result).toBe(true);
    });

    it("returns true when there are staged changes", async () => {
      writeFileSync(join(tmpDir, "file.txt"), "hello");
      runGit(tmpDir, ["add", "file.txt"]);
      const result = await gitService.hasChanges(tmpDir);
      expect(result).toBe(true);
    });
  });

  describe("stashCreate", () => {
    it("returns a non-empty ref when there are uncommitted changes", async () => {
      writeFileSync(join(tmpDir, "file.txt"), "original");
      runGit(tmpDir, ["add", "file.txt"]);
      runGit(tmpDir, ["commit", "-m", "initial"]);
      writeFileSync(join(tmpDir, "file.txt"), "modified");

      const ref = await gitService.stashCreate(tmpDir);
      expect(ref).toBeTruthy();
      expect(typeof ref).toBe("string");
      expect(ref!.length).toBeGreaterThan(0);
    });

    it("returns null when there are no changes", async () => {
      writeFileSync(join(tmpDir, "file.txt"), "content");
      runGit(tmpDir, ["add", "file.txt"]);
      runGit(tmpDir, ["commit", "-m", "initial"]);

      const ref = await gitService.stashCreate(tmpDir);
      expect(ref).toBeNull();
    });

    it("returns null or throws when not a git repo", async () => {
      const notRepo = mkdtempSync(join(tmpdir(), "not-repo-"));
      try {
        const ref = await gitService.stashCreate(notRepo);
        expect(ref).toBeNull();
      } catch {
        // allowed to throw
      } finally {
        rmSync(notRepo, { recursive: true, force: true });
      }
    });
  });

  describe("stashApply", () => {
    it("restores working tree from stash ref", async () => {
      writeFileSync(join(tmpDir, "file.txt"), "original");
      runGit(tmpDir, ["add", "file.txt"]);
      runGit(tmpDir, ["commit", "-m", "initial"]);
      writeFileSync(join(tmpDir, "file.txt"), "modified");

      const ref = await gitService.stashCreate(tmpDir);
      expect(ref).toBeTruthy();

      writeFileSync(join(tmpDir, "file.txt"), "changed again");
      await gitService.stashApply(tmpDir, ref!);

      const content = readFileSync(join(tmpDir, "file.txt"), "utf-8");
      expect(content.trim()).toBe("modified");
    });

    it("throws on invalid ref", async () => {
      await expect(
        gitService.stashApply(tmpDir, "invalid-ref-000000")
      ).rejects.toThrow();
    });
  });
});
