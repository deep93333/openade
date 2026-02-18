import type { AgentMessage } from "@agentide/shared";
import { cn } from "@/lib/cn";
import { getToolComponent } from "./tools";
import { GenericTool } from "./tools/generic-tool";
import { MarkdownMessage } from "./markdown-message";

const isHtmlWithMentions = (content: string) =>
  content.includes("data-type=\"mention\"") || content.startsWith("<p>");

type MessageBubbleProps = {
  message: AgentMessage;
};

const parseToolInput = (input: unknown): Record<string, unknown> => {
  if (input && typeof input === "object" && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // not json
    }
    return { command: input };
  }
  return { value: input };
};

const ToolMessage = ({ message }: { message: AgentMessage }) => {
  const toolName = message.toolName ?? "";
  const toolInput = parseToolInput(message.toolInput);
  const ToolComponent = getToolComponent(toolName);
  const Component = ToolComponent ?? GenericTool;

  return (
    <div className="px-4 py-2">
      <Component message={message} toolInput={toolInput} />
    </div>
  );
};

export const MessageBubble = ({ message }: MessageBubbleProps) => {
  const isUser = message.role === "user";

  if (message.role === "tool") {
    return <ToolMessage message={message} />;
  }

  return (
    <div className="flex gap-3 px-4 py-3 w-full">
      <div
        className={cn(
          "max-w-2xl rounded-lg super-ellipse px-3 py-1 text-sm leading-relaxed",
          isUser
            ? "bg-accent/30 !text-white [&_[data-type=mention]]:bg-accent-hover [&_[data-type=mention]]:rounded [&_[data-type=mention]]:px-1"
            : "bg-secondary w-full px-0 py-0 text-foreground [&_[data-type=mention]]:bg-accent/20 [&_[data-type=mention]]:text-accent-foreground [&_[data-type=mention]]:rounded [&_[data-type=mention]]:px-1"
        )}
      >
        <MarkdownMessage content={message.content} />
      </div>
    </div>
  );
};
