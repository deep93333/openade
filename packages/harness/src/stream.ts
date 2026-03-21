import type { Turn } from "./response.js";
import type { Session } from "./session.js";

export type Pulse =
  | { type: "session.created"; session: Session }
  | { type: "text.delta"; text: string }
  | {
      type: "tool_call.start";
      tool: string;
      input: Record<string, unknown>;
      callId?: string;
      parentCallId?: string;
    }
  | {
      type: "tool_call.complete";
      tool: string;
      output: string;
      callId?: string;
      parentCallId?: string;
      error?: string;
      status?: "ok" | "error" | "cancelled";
    }
  | {
      type: "approval.required";
      requestId: string;
      tool: string;
      input: Record<string, unknown>;
      callId?: string;
      parentCallId?: string;
    }
  | { type: "response.complete"; response: Turn }
  | { type: "error"; code: string; message: string };
