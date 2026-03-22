import type { AgentMessage } from "@openade/shared";

export type ToolComponentProps = {
  message: AgentMessage;
  toolInput: Record<string, unknown>;
  toolResult?: unknown;
};
