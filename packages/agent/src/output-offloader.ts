import * as fs from "fs/promises";
import * as path from "node:path";
import { ulid } from "ulid";
import { getContextDir } from "./session-paths.js";

const LONG_OUTPUT_THRESHOLD = 4000;

export type OffloadedFile = {
  id: string;
  type: "tool_output";
  path: string;
  originalSize: number;
  createdAt: number;
};

export type OffloaderState = {
  workspacePath: string;
  contextDir: string;
  files: OffloadedFile[];
};

export async function initOffloader(
  workspacePath: string,
  workspaceId?: string,
): Promise<OffloaderState> {
  const contextDir = getContextDir(workspacePath, workspaceId);
  await fs.mkdir(contextDir, { recursive: true });
  return {
    workspacePath,
    contextDir,
    files: [],
  };
}

export async function offloadToolOutput(
  state: OffloaderState,
  toolName: string,
  output: string,
): Promise<{ output: string; fileRef?: OffloadedFile }> {
  if (output.length <= LONG_OUTPUT_THRESHOLD) {
    return { output };
  }

  const fileId = ulid();
  const fileName = `${toolName}_${fileId}.txt`;
  const filePath = path.join(state.contextDir, fileName);
  const resolvedWs = path.resolve(state.workspacePath);
  const resolvedFile = path.resolve(filePath);
  const underWorkspace =
    resolvedFile === resolvedWs || resolvedFile.startsWith(resolvedWs + path.sep);
  const readHintPath = underWorkspace ? path.relative(state.workspacePath, filePath) : filePath;

  await fs.writeFile(filePath, output, "utf-8");

  const fileRef: OffloadedFile = {
    id: fileId,
    type: "tool_output",
    path: readHintPath,
    originalSize: output.length,
    createdAt: Date.now(),
  };

  state.files.push(fileRef);

  const preview = output.slice(0, 500);
  const lines = output.split("\n").length;
  const tokens = Math.ceil(output.length / 4);

  const compressedOutput = `[Output written to file: ${readHintPath}]
[${lines} lines, ~${tokens} tokens, ${output.length} chars]

Preview (first 500 chars):
${preview}${output.length > 500 ? "\n..." : ""}

Use 'read' tool with path "${readHintPath}" to see full output, or 'grep' to search within it.`;

  return { output: compressedOutput, fileRef };
}
