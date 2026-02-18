import type { AgentMessage } from "@agentide/shared";

export type ToolComponentProps = {
  message: AgentMessage;
  toolInput: Record<string, unknown>;
};
