import type { AgentMode } from "@agentide/shared";
import { ChatBubbleLineIcon, LlmChatIcon, TodoListIcon } from "@agentide/ui";

export const AGENT_MODES: {
  value: AgentMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "agent", label: "Agent", description: "Full Claude Code agent with all tools", icon: LlmChatIcon },
  // TODO: re-enable when ready
  // { value: "plan", label: "Plan", description: "Reads code and plans changes, no edits", icon: TodoListIcon },
  // { value: "ask", label: "Ask", description: "Answers questions without using any tools", icon: ChatBubbleLineIcon },
];
