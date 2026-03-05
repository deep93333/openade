import { dialog, ipcMain, shell } from "electron";
import { IPC } from "@agentide/shared";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { readDirectoryTree, readDirectoryChildren } from "../services/filesystem";
import { loadSkillsFromDir, getSkillContent } from "../services/skills";
import { openFileInExternalEditor } from "../services/editor";
import { getAgentLogPath, getAgentLogDir } from "../services/logging";
import type { AgentSkillItem } from "@agentide/shared";

export function registerFilesystemHandlers(): void {
  ipcMain.handle(IPC.DIALOG_SELECT_FOLDER, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Select project directory",
    });
    if (canceled || filePaths.length === 0) return { success: true, data: null };
    return { success: true, data: filePaths[0] ?? null };
  });

  ipcMain.handle(IPC.READ_DIRECTORY_TREE, async (_event, dirPath: string, maxDepth?: number) => {
    try {
      const tree = await readDirectoryTree(dirPath, maxDepth ?? 10);
      return { success: true, data: tree };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to read directory tree" };
    }
  });

  ipcMain.handle(IPC.READ_DIRECTORY_CHILDREN, async (_event, dirPath: string) => {
    try {
      const children = await readDirectoryChildren(dirPath);
      return { success: true, data: children };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to read directory children" };
    }
  });

  ipcMain.handle(IPC.READ_FILE, async (_event, filePath: string) => {
    try {
      const stat = await fs.stat(filePath);
      if (!stat.isFile()) return { success: false, error: "Path is not a file" };
      const content = await fs.readFile(filePath, "utf-8");
      return { success: true, data: content };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to read file" };
    }
  });

  ipcMain.handle(IPC.SKILLS_LIST, async () => {
    try {
      const home = os.homedir();
      const cursorSkills = await loadSkillsFromDir(path.join(home, ".cursor", "skills"));
      const claudeSkills = await loadSkillsFromDir(path.join(home, ".claude", "skills"));
      const byId = new Map<string, AgentSkillItem>();
      for (const s of [...cursorSkills, ...claudeSkills]) {
        if (!byId.has(s.id)) byId.set(s.id, s);
      }
      return { success: true, data: Array.from(byId.values()) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to list skills" };
    }
  });

  ipcMain.handle(IPC.SKILLS_GET_CONTENT, async (_event, skillId: string) => {
    try {
      const home = os.homedir();
      const dirs = [path.join(home, ".cursor", "skills"), path.join(home, ".claude", "skills")];
      const content = await getSkillContent(skillId, dirs);
      if (!content) return { success: false, error: `Skill "${skillId}" not found` };
      return { success: true, data: content };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to read skill" };
    }
  });

  ipcMain.handle(IPC.EDITOR_OPEN_FILE, async (_event, filePath: string, line?: number) => {
    try {
      return await openFileInExternalEditor(filePath, line);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to open file in editor" };
    }
  });

  ipcMain.handle(IPC.AGENT_LOG_GET_PATH, async () => {
    try {
      return { success: true as const, data: getAgentLogPath() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to get log path" };
    }
  });

  ipcMain.handle(IPC.AGENT_LOG_READ, async () => {
    try {
      const logPath = getAgentLogPath();
      const content = await fs.readFile(logPath, "utf-8").catch(() => "");
      return { success: true as const, data: content };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to read log" };
    }
  });

  ipcMain.handle(IPC.AGENT_LOG_OPEN_FOLDER, async () => {
    try {
      await shell.openPath(getAgentLogDir());
      return { success: true as const };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Failed to open log folder" };
    }
  });
}
