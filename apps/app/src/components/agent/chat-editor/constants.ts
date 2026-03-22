import type { AgentMode } from "@openade/shared";
import { ChatBubbleLineIcon, LlmChatIcon, TodoListIcon } from "@openade/ui";

export const AGENT_MODES: {
  value: AgentMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "ask", label: "Ask", description: "Answers questions without using any tools", icon: ChatBubbleLineIcon },
  { value: "plan", label: "Plan", description: "Creates a structured plan, then build from it", icon: TodoListIcon },
  { value: "agent", label: "Agent", description: "Full agent with all tools", icon: LlmChatIcon },
];
