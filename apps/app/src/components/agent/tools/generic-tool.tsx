import { KeyIcon } from "@agentide/ui";
import type { ToolComponentProps } from "./types";

export const GenericTool = ({ message, toolInput }: ToolComponentProps) => {
  const display =
    typeof toolInput === "string"
      ? toolInput
      : JSON.stringify(toolInput, null, 2);

  return (
    <div className="flex flex-col gap-1.5 rounded-lg bg-background p-2 ring-1 ring-foreground/10">
      <p className="flex w-full items-center gap-2 border-b border-foreground/10 pb-2 text-xs font-medium text-muted-foreground">
        <KeyIcon className="size-3.5" />
        {message.toolName ?? "Tool"}
      </p>
      <pre className="max-h-48 max-w-full overflow-auto rounded-md border border-border bg-secondary px-3 py-2 font-mono text-xs leading-relaxed text-foreground">
        {display}
      </pre>
    </div>
  );
};
