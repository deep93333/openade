import * as fs from "fs/promises";
import * as path from "path";
import type { AgentSkillItem } from "@openade/shared";

const SKILL_MD = "SKILL.md";
const frontmatterRe = /^---\s*\n([\s\S]*?)\n---/;

export async function loadSkillsFromDir(skillsDir: string): Promise<AgentSkillItem[]> {
  const result: AgentSkillItem[] = [];
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillPath = path.join(skillsDir, entry.name);
      const skillMdPath = path.join(skillPath, SKILL_MD);
      try {
        const stat = await fs.stat(skillMdPath);
        if (!stat.isFile()) continue;
      } catch {
        continue;
      }
      const content = await fs.readFile(skillMdPath, "utf-8");
      const match = content.match(frontmatterRe);
      const name =
        match?.[1]?.match(/name:\s*(.+)/)?.[1]?.trim() ?? entry.name;
      const description =
        match?.[1]?.match(/description:\s*(.+)/)?.[1]?.trim() ?? "";
      result.push({
        id: entry.name,
        name,
        description,
        skillPath: skillMdPath,
      });
    }
  } catch {
    // directory may not exist
  }
  return result;
}

export async function getSkillContent(
  skillId: string,
  dirs: string[],
): Promise<string | null> {
  for (const dir of dirs) {
    const skillMdPath = path.join(dir, skillId, SKILL_MD);
    try {
      const stat = await fs.stat(skillMdPath);
      if (stat.isFile()) {
        return await fs.readFile(skillMdPath, "utf-8");
      }
    } catch {
      continue;
    }
  }
  return null;
}
