import { z } from "zod";
import { createReadStream } from "fs";
import * as fs from "fs/promises";
import * as path from "path";
import { createInterface } from "readline";
import type { ToolDefinition, ToolResult } from "./tool-types.js";
import { truncateOutput } from "./tool-types.js";

const DEFAULT_LIMIT = 500;
const MAX_LINE_LENGTH = 2000;
const MAX_BYTES = 30 * 1024;

export const readParameters = z.object({
  file_path: z.string().describe("Absolute path to the file or directory to read"),
  offset: z.coerce
    .number()
    .optional()
    .describe("Line number to start reading from (1-indexed)"),
  limit: z.coerce
    .number()
    .optional()
    .describe("Max lines to read (default 500). Use offset+limit for targeted reads."),
});

async function isBinaryFile(filepath: string, size: number): Promise<boolean> {
  const ext = path.extname(filepath).toLowerCase();
  const binaryExts = new Set([
    ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".class", ".jar",
    ".war", ".7z", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".bin", ".dat", ".obj", ".o", ".a", ".lib", ".wasm", ".pyc", ".pyo",
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".mp3",
    ".mp4", ".avi", ".mov", ".pdf",
  ]);
  if (binaryExts.has(ext)) return true;
  if (size === 0) return false;

  const fh = await fs.open(filepath, "r");
  try {
    const sampleSize = Math.min(4096, size);
    const bytes = Buffer.alloc(sampleSize);
    const result = await fh.read(bytes, 0, sampleSize, 0);
    if (result.bytesRead === 0) return false;
    let nonPrintable = 0;
    for (let i = 0; i < result.bytesRead; i++) {
      if (bytes[i] === 0) return true;
      if (bytes[i] < 9 || (bytes[i] > 13 && bytes[i] < 32)) nonPrintable++;
    }
    return nonPrintable / result.bytesRead > 0.3;
  } finally {
    await fh.close();
  }
}

export const readTool: ToolDefinition<typeof readParameters> = {
  id: "read",
  description: `Read a file (line-numbered) or list a directory. Use absolute paths. For large files, use offset and limit to read only the section you need — avoid reading entire files when possible.`,
  parameters: readParameters,
  async execute(args, ctx): Promise<ToolResult> {
    let filepath = args.file_path;
    if (!path.isAbsolute(filepath)) {
      filepath = path.resolve(ctx.workspacePath, filepath);
    }
    const title = path.relative(ctx.workspacePath, filepath);

    let stat;
    try {
      stat = await fs.stat(filepath);
    } catch {
      const dir = path.dirname(filepath);
      const base = path.basename(filepath);
      let suggestions: string[] = [];
      try {
        const entries = await fs.readdir(dir);
        suggestions = entries
          .filter(
            (e) =>
              e.toLowerCase().includes(base.toLowerCase()) ||
              base.toLowerCase().includes(e.toLowerCase()),
          )
          .map((e) => path.join(dir, e))
          .slice(0, 3);
      } catch {}
      const hint =
        suggestions.length > 0
          ? `\n\nDid you mean one of these?\n${suggestions.join("\n")}`
          : "";
      throw new Error(`File not found: ${filepath}${hint}`);
    }

    if (stat.isDirectory()) {
      const dirents = await fs.readdir(filepath, { withFileTypes: true });
      const entries = dirents.map((d) =>
        d.isDirectory() ? d.name + "/" : d.name,
      );
      entries.sort((a, b) => a.localeCompare(b));
      const limit = args.limit ?? DEFAULT_LIMIT;
      const offset = args.offset ?? 1;
      const start = offset - 1;
      const sliced = entries.slice(start, start + limit);
      const truncated = start + sliced.length < entries.length;

      const output = [
        `<directory path="${filepath}">`,
        sliced.join("\n"),
        truncated
          ? `\n(Showing ${sliced.length} of ${entries.length} entries. Use offset=${offset + sliced.length} to see more.)`
          : `\n(${entries.length} entries)`,
        "</directory>",
      ].join("\n");

      return {
        title,
        output,
        metadata: { preview: sliced.slice(0, 20).join("\n"), truncated },
      };
    }

    if (await isBinaryFile(filepath, Number(stat.size))) {
      throw new Error(`Cannot read binary file: ${filepath}`);
    }

    const stream = createReadStream(filepath, { encoding: "utf8" });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    const limit = args.limit ?? DEFAULT_LIMIT;
    const offset = args.offset ?? 1;
    const start = offset - 1;
    const raw: string[] = [];
    let bytes = 0;
    let lines = 0;
    let truncatedByBytes = false;
    let hasMoreLines = false;

    try {
      for await (const text of rl) {
        lines += 1;
        if (lines <= start) continue;
        if (raw.length >= limit) {
          hasMoreLines = true;
          continue;
        }
        const line =
          text.length > MAX_LINE_LENGTH
            ? text.substring(0, MAX_LINE_LENGTH) + `... (line truncated)`
            : text;
        const size = Buffer.byteLength(line, "utf-8") + (raw.length > 0 ? 1 : 0);
        if (bytes + size > MAX_BYTES) {
          truncatedByBytes = true;
          hasMoreLines = true;
          break;
        }
        raw.push(line);
        bytes += size;
      }
    } finally {
      rl.close();
      stream.destroy();
    }

    if (lines < offset && !(lines === 0 && offset === 1)) {
      throw new Error(`Offset ${offset} is out of range (file has ${lines} lines)`);
    }

    const content = raw.map((line, i) => `${i + offset}: ${line}`);
    let output = `<file path="${filepath}">\n` + content.join("\n");
    const lastReadLine = offset + raw.length - 1;
    const nextOffset = lastReadLine + 1;
    const truncated = hasMoreLines || truncatedByBytes;

    if (truncatedByBytes) {
      output += `\n\n(Output capped at ${MAX_BYTES / 1024}KB. Showing lines ${offset}-${lastReadLine}. Use offset=${nextOffset} to continue.)`;
    } else if (hasMoreLines) {
      output += `\n\n(Showing lines ${offset}-${lastReadLine} of ${lines}. Use offset=${nextOffset} to continue.)`;
    } else {
      output += `\n\n(End of file — total ${lines} lines)`;
    }
    output += "\n</file>";

    return {
      title,
      output: truncateOutput(output),
      metadata: {
        preview: raw.slice(0, 20).join("\n"),
        truncated,
      },
    };
  },
};
