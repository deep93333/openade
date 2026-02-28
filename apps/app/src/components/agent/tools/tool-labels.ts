export const normalizeToolName = (rawToolName: string | undefined): string =>
  (rawToolName ?? "").toLowerCase().trim();

const activeLabels: Record<string, string> = {
  read: "Reading",
  write: "Writing",
  edit: "Editing",
  multiedit: "Editing",
  delete: "Deleting",
  glob: "Searching",
  grep: "Searching",
  search: "Searching",
  ripgrep: "Searching",
  bash: "Running",
  ls: "Listing",
  listdir: "Listing",
  todowrite: "Updating todos",
  todo_write: "Updating todos",
  ask_question: "Asking",
  readlints: "Checking lints",
  str_replace_editor: "Editing",
  texteditor: "Editing",
  text_editor: "Editing",
  applydiff: "Applying diff",
  applypatch: "Applying patch",
  websearch: "Searching web",
  webfetch: "Fetching",
  diff: "Diffing",
  "file.read": "Reading",
  "file.edit": "Editing",
  "file.glob": "Searching",
};

const doneLabels: Record<string, string> = {
  read: "Read",
  write: "Wrote",
  edit: "Edited",
  multiedit: "Edited",
  delete: "Deleted",
  glob: "Searched",
  grep: "Searched",
  search: "Searched",
  ripgrep: "Searched",
  bash: "Ran",
  ls: "Listed",
  listdir: "Listed",
  todowrite: "Updated todos",
  todo_write: "Updated todos",
  ask_question: "Asked",
  readlints: "Checked lints",
  str_replace_editor: "Edited",
  texteditor: "Edited",
  text_editor: "Edited",
  applydiff: "Applied diff",
  applypatch: "Applied patch",
  websearch: "Searched web",
  webfetch: "Fetched",
  diff: "Diffed",
  "file.read": "Read",
  "file.edit": "Edited",
  "file.glob": "Searched",
};

const titleCase = (value: string) =>
  value
    .split(/[_\-.\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getFileTarget = (toolInput: Record<string, unknown>): string | null => {
  const raw = toolInput.path ?? toolInput.file_path ?? toolInput.glob_pattern;
  if (typeof raw !== "string" || raw.length === 0) return null;
  return raw.split("/").pop() ?? raw;
};

const getCommandTarget = (toolInput: Record<string, unknown>): string | null => {
  const command = toolInput.command;
  if (typeof command !== "string" || command.length === 0) return null;
  const first = command.split("\n")[0];
  return first.length > 60 ? `${first.slice(0, 57)}...` : first;
};

const getSearchTarget = (toolInput: Record<string, unknown>): string | null => {
  const pattern = toolInput.pattern ?? toolInput.query ?? toolInput.search_term ?? toolInput.glob_pattern;
  if (typeof pattern !== "string" || pattern.length === 0) return null;
  return pattern.length > 40 ? `${pattern.slice(0, 37)}...` : pattern;
};

const getToolTarget = (toolName: string, toolInput: Record<string, unknown>): string | null => {
  if (["read", "write", "edit", "multiedit", "delete", "file.read", "file.edit"].includes(toolName)) {
    return getFileTarget(toolInput);
  }
  if (toolName === "bash") {
    return getCommandTarget(toolInput);
  }
  if (["grep", "search", "ripgrep", "glob", "websearch", "file.glob"].includes(toolName)) {
    return getSearchTarget(toolInput);
  }
  if (["str_replace_editor", "texteditor", "text_editor"].includes(toolName)) {
    return getFileTarget(toolInput);
  }
  return null;
};

export const getToolLabel = (rawToolName: string | undefined, isActive = false): string => {
  const toolName = normalizeToolName(rawToolName);
  const map = isActive ? activeLabels : doneLabels;
  return map[toolName] ?? titleCase(toolName || "Tool");
};

export type ToolTitleParts = {
  label: string;
  target: string | null;
};

export const getToolTitleParts = (
  rawToolName: string | undefined,
  toolInput: Record<string, unknown>,
  isActive = false,
): ToolTitleParts => {
  const label = getToolLabel(rawToolName, isActive);
  const toolName = normalizeToolName(rawToolName);
  const target = getToolTarget(toolName, toolInput);
  return { label, target };
};

export const getToolTitle = (
  rawToolName: string | undefined,
  toolInput: Record<string, unknown>,
  isActive = false,
): string => {
  const { label, target } = getToolTitleParts(rawToolName, toolInput, isActive);
  if (!target) return label;
  return `${label} ${target}`;
};

export type ToolGroupKey =
  | "file-read"
  | "file-write"
  | "file-edit"
  | "search"
  | "bash"
  | "todo"
  | "lint"
  | "other";

export const getToolGroupKey = (rawToolName: string | undefined): ToolGroupKey => {
  const name = normalizeToolName(rawToolName);
  if (["read", "file.read"].includes(name)) return "file-read";
  if (["write", "texteditor", "text_editor", "str_replace_editor"].includes(name)) return "file-write";
  if (["edit", "multiedit", "file.edit", "applydiff", "applypatch", "diff"].includes(name)) return "file-edit";
  if (["grep", "search", "ripgrep", "glob", "websearch", "webfetch", "file.glob", "ls", "listdir"].includes(name)) return "search";
  if (name === "bash") return "bash";
  if (["todowrite", "todo_write"].includes(name)) return "todo";
  if (["readlints", "lints"].includes(name)) return "lint";
  return "other";
};
