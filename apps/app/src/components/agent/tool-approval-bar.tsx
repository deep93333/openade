import type { ToolApprovalRequest } from "@agentide/shared";
import { Button, KeyIcon } from "@agentide/ui";
import { useAgentStore } from "@/store/agent.store";
import { cn } from "@/lib/cn";

type ToolApprovalBarProps = {
  request: ToolApprovalRequest;
};

export const ToolApprovalBar = ({ request }: ToolApprovalBarProps) => {
  const respondToolApproval = useAgentStore((s) => s.respondToolApproval);

  const inputDisplay =
    request.toolName === "Bash" && request.input && typeof request.input === "object" && "command" in request.input
      ? (request.input as { command: string }).command
      : typeof request.input === "string"
        ? request.input
        : JSON.stringify(request.input, null, 2);

  return (
    <div className="mx-2 mb-2 rounded-xl bg-background shadow-popover p-3">
      <div className="mb-3 flex items-center gap-2">
    
        <span className="text-sm font-medium text-muted-foreground">
          Approve tool <span className="font-semibold text-foreground">{request.toolName}</span>
        </span>
      </div>
      <pre
        className={cn(
          "mb-4 max-h-32 overflow-auto rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-700",
          "scrollbar-thin scrollbar-thumb-zinc-300"
        )}
      >max-w-2xl
        {inputDisplay}
      </pre>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => respondToolApproval(false, "Denied by user")}
        >
          Deny
        </Button>
        <Button
          type="button"
          size="sm"
          variant="brand"
          onClick={() => respondToolApproval(true)}
        >
          Allow
        </Button>
      </div>
    </div>
  );
};
