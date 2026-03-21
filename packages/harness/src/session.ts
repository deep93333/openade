import type { Runtime } from "./ids.js";

export type SessionMetadata = Record<string, unknown> & {
  cwd?: string;
  title?: string;
  claudeSessionId?: string;
  codexThreadId?: string;
  opencodeSessionId?: string;
};

export type Session = {
  id: string;
  runtime: Runtime;
  createdAt: number;
  metadata: SessionMetadata;
};
