import * as fs from "fs/promises";
import * as path from "path";
import { IGNORE_DIRS } from "./constants.js";

const PROJECT_MARKERS = [
  "package.json",
  "Cargo.toml",
  "go.mod",
  "pyproject.toml",
  "requirements.txt",
  "Gemfile",
  "pom.xml",
  "build.gradle",
  "CMakeLists.txt",
  "Makefile",
  "docker-compose.yml",
  "Dockerfile",
  ".gitignore",
];

async function getShallowTree(dir: string, depth = 2, prefix = ""): Promise<string[]> {
  if (depth <= 0) return [];
  const lines: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const sorted = entries
      .filter((e) => !e.name.startsWith(".") || e.name === ".env.example")
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    for (const entry of sorted) {
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        lines.push(`${prefix}${entry.name}/`);
        const sub = await getShallowTree(path.join(dir, entry.name), depth - 1, prefix + "  ");
        lines.push(...sub);
      } else {
        lines.push(`${prefix}${entry.name}`);
      }
    }
  } catch {}
  return lines;
}

async function readProjectFile(dir: string, filename: string, maxLines = 20): Promise<string | null> {
  try {
    const filepath = path.join(dir, filename);
    const content = await fs.readFile(filepath, "utf-8");
    const lines = content.split("\n");
    if (lines.length <= maxLines) return content.trim();
    return lines.slice(0, maxLines).join("\n") + `\n... (${lines.length} total lines)`;
  } catch {
    return null;
  }
}

export async function detectProjectContext(workspacePath: string): Promise<string> {
  const sections: string[] = [];

  const tree = await getShallowTree(workspacePath, 2);
  if (tree.length > 0) {
    const maxTreeLines = 40;
    const truncated = tree.length > maxTreeLines;
    const display = truncated ? tree.slice(0, maxTreeLines) : tree;
    sections.push(
      "### Project Structure",
      "```",
      ...display,
      truncated ? `... (${tree.length} total entries)` : "",
      "```",
    );
  }

  for (const marker of PROJECT_MARKERS) {
    const content = await readProjectFile(workspacePath, marker);
    if (content) {
      sections.push(`### ${marker}`, "```", content, "```");
      break;
    }
  }

  const readme = await readProjectFile(workspacePath, "README.md", 20);
  if (readme) {
    sections.push("### README.md (excerpt)", readme);
  }

  return sections.filter(Boolean).join("\n");
}
