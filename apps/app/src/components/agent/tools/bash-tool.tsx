import type { ToolComponentProps } from "./types";

export const BashTool = ({ toolInput }: ToolComponentProps) => {
  const command = (toolInput.command as string) ?? "";

  return (
    <div className="flex flex-col gap-1.5 bg-background ring-1 ring-foreground/10 rounded-lg p-2">
      <p className="text-xs font-medium text-muted-foreground w-full border-b border-foreground/10 pb-2">
        
        Bash
      </p>
        
        <pre className="overflow-x-auto px-2 py-1 text-foreground font-mono text-xs leading-relaxed">
          <code>{command}</code>
        </pre>
    </div>
  );
};
