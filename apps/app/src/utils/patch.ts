export function buildUnifiedPatch(
  path: string,
  oldContent: string,
  newContent: string
): string {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const oldCount = oldLines.length;
  const newCount = newLines.length;
  const fileLabel = path || "file";
  const header = `--- a/${fileLabel}\n+++ b/${fileLabel}\n`;
  const hunkMeta = `@@ -1,${oldCount} +1,${newCount} @@\n`;
  const minusLines = oldLines.map((line) => `-${line}`).join("\n");
  const plusLines = newLines.map((line) => `+${line}`).join("\n");
  const body = [minusLines, plusLines].filter(Boolean).join("\n");
  return header + hunkMeta + (body ? `${body}\n` : "");
}
