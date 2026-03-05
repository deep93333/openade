import { Terminal } from "lucide-react";
import type { ToolComponentProps } from "./types";
import { ToolContainer } from "./container";

function getBashResultText(result: unknown): string | null {
  if (result == null) return null;
  if (typeof result === "string") return result;
  if (typeof result !== "object" || Array.isArray(result)) return null;
  const obj = result as Record<string, unknown>;
  const stdout = obj.stdout ?? obj.output ?? obj.text;
  const stderr = obj.stderr;
  if (typeof stdout === "string" && !stderr) return stdout;
  if (typeof stderr === "string" && !stdout) return stderr;
  if (typeof stdout === "string" || typeof stderr === "string") {
    const out = typeof stdout === "string" ? `stdout:\n${stdout}` : "";
    const err = typeof stderr === "string" ? `stderr:\n${stderr}` : "";
    return [out, err].filter(Boolean).join("\n\n");
  }
  const content = obj.content;
  if (Array.isArray(content)) {
    const parts = content
      .filter((c): c is { type: string; text?: string } => c != null && typeof c === "object")
      .map((c) => (c.type === "text" && typeof c.text === "string" ? c.text : ""))
      .filter(Boolean);
    return parts.length > 0 ? parts.join("\n") : null;
  }
  return null;
}

export const BashTool = ({ toolInput, toolResult }: ToolComponentProps) => {
  const command = (toolInput.command as string) ?? "";
  const resultText = getBashResultText(toolResult);

  return (
    <ToolContainer
      icon={<Terminal className="size-3.5" strokeWidth={1.5} />}
      title="Bash"
      toolInput={toolInput}
    >
      <pre className="overflow-x-auto px-3 py-2 font-mono text-xs leading-relaxed text-foreground mx-2 mb-2">
        <code>{command}</code>
      </pre>
      {resultText != null && resultText !== "" && (
        <div className="mx-2 mb-2 rounded-md border border-border bg-secondary">
          <div className="border-b border-border px-2 py-1 text-[10px] font-medium text-muted-foreground">
            Output
          </div>
          <pre className="max-h-48 overflow-auto px-3 py-2 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap">
            {resultText}
          </pre>
        </div>
      )}
    </ToolContainer>
  );
};
