import { IconTool } from "@tabler/icons-react";
import type { ToolComponentProps } from "./types";
import { ToolContainer } from "./container";

export const GenericTool = ({ message, toolInput, toolResult }: ToolComponentProps) => {
  const inputDisplay =
    typeof toolInput === "object" && toolInput !== null && !Array.isArray(toolInput)
      ? JSON.stringify(toolInput, null, 2)
      : String(toolInput);

  const resultDisplay =
    toolResult !== undefined && toolResult !== null
      ? typeof toolResult === "string"
        ? toolResult
        : JSON.stringify(toolResult, null, 2)
      : null;

  return (
    <ToolContainer
      icon={<IconTool className="size-3.5" stroke={2} />}
      title={message.toolName ?? "Tool"}
      toolInput={toolInput}
    >
      <pre className="max-h-48 max-w-full overflow-auto rounded-md border border-border bg-secondary px-3 py-2 font-mono text-xs leading-relaxed text-foreground mx-2 mb-2">
        {inputDisplay}
      </pre>
      {resultDisplay != null && (
        <div className="mx-2 mb-2 rounded-md border border-border bg-secondary">
          <div className="border-b border-border px-2 py-1 text-[10px] font-medium text-muted-foreground">
            Result
          </div>
          <pre className="max-h-48 max-w-full overflow-auto px-3 py-2 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap">
            {resultDisplay}
          </pre>
        </div>
      )}
    </ToolContainer>
  );
};
