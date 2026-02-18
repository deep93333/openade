import type { ComponentType } from "react";
import type { ToolComponentProps } from "./types";
import { BashTool } from "./bash-tool";
import { TextEditorTool } from "./text-editor-tool";
import { FileTool } from "./file-tool";
import { SearchTool } from "./search-tool";
import { DiffTool } from "./diff-tool";

const registry: Record<string, ComponentType<ToolComponentProps>> = {
  Bash: BashTool,
  bash: BashTool,

  TextEditor: TextEditorTool,
  text_editor: TextEditorTool,
  Write: TextEditorTool,
  str_replace_editor: TextEditorTool,

  Read: FileTool,
  Edit: FileTool,
  MultiEdit: FileTool,
  Glob: FileTool,
  LS: FileTool,
  ListDir: FileTool,

  Grep: SearchTool,
  Search: SearchTool,
  RipGrep: SearchTool,
  WebSearch: SearchTool,

  Diff: DiffTool,
  ApplyDiff: DiffTool,
  ApplyPatch: DiffTool,
};

export const getToolComponent = (toolName: string): ComponentType<ToolComponentProps> | null => {
  return registry[toolName] ?? null;
};
