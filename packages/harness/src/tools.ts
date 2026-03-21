import type { Runtime } from "./ids.js";

export const TOOL_ALIASES = {
  "file.read": { claude: "Read", codex: "read", opencode: "read" },
  "file.write": { claude: "Write", codex: "write", opencode: "write" },
  "file.edit": { claude: "Edit", codex: "edit", opencode: "edit" },
  "file.glob": { claude: "Glob", codex: "glob", opencode: "glob" },
  "file.list": { claude: "Glob", codex: "list", opencode: "list" },
  "file.patch": { claude: "Edit", codex: "patch", opencode: "patch" },
  "shell.bash": { claude: "Bash", codex: "bash", opencode: "bash" },
  "search.grep": { claude: "Grep", codex: "grep", opencode: "grep" },
  "search.web": { claude: "WebSearch", codex: "web_search", opencode: "websearch" },
  "fetch.web": { claude: "WebFetch", codex: "web_fetch", opencode: "webfetch" },
  "user.question": { claude: "AskUserQuestion", codex: "question", opencode: "question" },
  "agent.invoke": { claude: "Agent", codex: "agent", opencode: "agent" },
  "skill.invoke": { claude: "Skill", codex: "skill", opencode: "skill" },
  "todo.write": { claude: "TodoWrite", codex: "todowrite", opencode: "todowrite" },
  "todo.read": { claude: "TodoRead", codex: "todoread", opencode: "todoread" },
} as const satisfies Record<string, Record<Runtime, string>>;

export type BuiltinToolKey = keyof typeof TOOL_ALIASES;

export type McpToolKey = `mcp:${string}:${string}`;

export type ToolKey = BuiltinToolKey | McpToolKey | "lsp.query";

export type ToolConfig = {
  allowed?: ToolKey[];
  denied?: ToolKey[];
};

export type PermissionConfig = {
  defaults: "allow" | "deny" | "ask";
  overrides?: Record<string, "allow" | "deny" | "ask">;
};

export type SubagentDef = {
  id: string;
  description: string;
  prompt: string;
  runtime?: Runtime;
  model?: string;
  tools?: ToolKey[];
};

export function mcpToolKey(server: string, tool: string): McpToolKey {
  return `mcp:${server}:${tool}`;
}
