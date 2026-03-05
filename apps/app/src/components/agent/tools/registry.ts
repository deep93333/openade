import type { ComponentType } from "react";
import type { ToolComponentProps } from "./types";
import { BashTool } from "./bash";
import { TextEditorTool } from "./editor";
import { FileTool } from "./file";
import { SearchTool } from "./search";
import { DiffTool } from "./diff";
import { TodoWriteTool } from "./todo";
import { LintsTool } from "./lints";
import { AskQuestionTool } from "./ask";
import { DelegateTool } from "./delegate";

const registry: Record<string, ComponentType<ToolComponentProps>> = {
  bash: BashTool,
  todowrite: TodoWriteTool,
  todo_write: TodoWriteTool,
  texteditor: TextEditorTool,
  text_editor: TextEditorTool,
  write: FileTool,
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
  delegate: DelegateTool,
};

export const getToolComponent = (toolName: string): ComponentType<ToolComponentProps> | null => {
  const key = toolName.toLowerCase().trim();
  return registry[key] ?? null;
};
