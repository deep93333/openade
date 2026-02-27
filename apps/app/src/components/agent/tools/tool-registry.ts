import type { ComponentType } from "react";
import type { ToolComponentProps } from "./types";
import { BashTool } from "./bash-tool";
import { TextEditorTool } from "./text-editor-tool";
import { FileTool } from "./file-tool";
import { SearchTool } from "./search-tool";
import { DiffTool } from "./diff-tool";
import { TodoWriteTool } from "./todo-write";
import { LintsTool } from "./lints-tool";
import { AskQuestionTool } from "./ask-question-tool";

const registry: Record<string, ComponentType<ToolComponentProps>> = {
  bash: BashTool,
  todowrite: TodoWriteTool,
  todo_write: TodoWriteTool,
  texteditor: TextEditorTool,
  text_editor: TextEditorTool,
  write: TextEditorTool,
  str_replace_editor: TextEditorTool,
  read: FileTool,
  edit: FileTool,
  multiedit: FileTool,
  glob: FileTool,
  ls: FileTool,
  listdir: FileTool,
  "file.read": FileTool,
  "file.edit": FileTool,
  "file.glob": FileTool,
  grep: SearchTool,
  search: SearchTool,
  ripgrep: SearchTool,
  websearch: SearchTool,
  webfetch: SearchTool,
  diff: DiffTool,
  applydiff: DiffTool,
  applypatch: DiffTool,
  delete: FileTool,
  readlints: LintsTool,
  lints: LintsTool,
  ask_question: AskQuestionTool,
};

export const getToolComponent = (toolName: string): ComponentType<ToolComponentProps> | null => {
  const key = toolName.toLowerCase().trim();
  return registry[key] ?? null;
};
