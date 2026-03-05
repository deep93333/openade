import { useState } from "react";
import { GitFork, ChevronDownIcon, ChevronRightIcon, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { ToolComponentProps } from "./types";
import { ToolContainer } from "./container";
import { cn } from "@/lib/cn";

type TaskInput = {
  description: string;
  prompt: string;
};

type DelegateMetadata = {
  taskCount?: number;
  completedCount?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
};

function parseTaskSections(output: string): { description: string; status: string; body: string }[] {
  const sections = output.split(/\n---\n/).filter(Boolean);
  return sections.map((section) => {
    const descMatch = section.match(/^## Task: (.+)$/m);
    const statusMatch = section.match(/^Status: (.+)$/m);
    const description = descMatch?.[1] ?? "Unknown task";
    const status = statusMatch?.[1] ?? "unknown";
    const bodyStart = section.indexOf("\n\n");
    const body = bodyStart >= 0 ? section.slice(bodyStart + 2).trim() : "";
    return { description, status, body };
  });
}

const StatusIcon = ({ status }: { status: string }) => {
  if (status === "completed") return <CheckCircle2 className="size-3 text-emerald-500" />;
  if (status === "failed" || status === "rejected") return <XCircle className="size-3 text-red-500" />;
  return <Loader2 className="size-3 animate-spin text-muted-foreground" />;
};

const TaskSection = ({ description, status, body }: { description: string; status: string; body: string }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-secondary/50 transition-colors"
      >
        <StatusIcon status={status} />
        {expanded ? (
          <ChevronDownIcon className="size-3 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-3 text-muted-foreground" />
        )}
        <span className="font-medium text-foreground">{description}</span>
        <span className={cn(
          "ml-auto text-[10px] font-medium",
          status === "completed" ? "text-emerald-500" : status === "failed" ? "text-red-500" : "text-muted-foreground",
        )}>
          {status}
        </span>
      </button>
      {expanded && body && (
        <pre className="max-h-64 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground whitespace-pre-wrap bg-secondary/30">
          {body}
        </pre>
      )}
    </div>
  );
};

export const DelegateTool = ({ message, toolInput, toolResult }: ToolComponentProps) => {
  const tasks = (toolInput.tasks ?? []) as TaskInput[];
  const metadata = (toolResult ?? {}) as DelegateMetadata;
  const output = typeof message.content === "string" ? message.content : "";
  const sections = output ? parseTaskSections(output) : [];

  const isRunning = message.toolStatus === "running";
  const title = isRunning
    ? `Running ${tasks.length} sub-agent${tasks.length !== 1 ? "s" : ""}...`
    : `${metadata.completedCount ?? 0}/${metadata.taskCount ?? tasks.length} sub-agents completed`;

  return (
    <ToolContainer
      icon={<GitFork className="size-3.5" strokeWidth={1.5} />}
      title={title}
      toolInput={toolInput}
    >
      {isRunning && sections.length === 0 ? (
        <div className="mx-2 mb-2 rounded-md border border-border bg-secondary">
          {tasks.map((task, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs border-b border-border last:border-b-0">
              <Loader2 className="size-3 animate-spin text-muted-foreground" />
              <span className="text-foreground">{task.description}</span>
            </div>
          ))}
        </div>
      ) : (
        sections.length > 0 && (
          <div className="mx-2 mb-2 rounded-md border border-border bg-secondary overflow-hidden">
            {sections.map((section, i) => (
              <TaskSection key={i} {...section} />
            ))}
          </div>
        )
      )}

      {metadata.totalInputTokens != null && (
        <div className="mx-2 mb-2 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>{metadata.totalInputTokens.toLocaleString()} input tokens</span>
          <span>{(metadata.totalOutputTokens ?? 0).toLocaleString()} output tokens</span>
        </div>
      )}
    </ToolContainer>
  );
};
