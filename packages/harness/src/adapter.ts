import type { Profile } from "./framework.js";
import type { Runtime } from "./ids.js";
import type { PromptInput } from "./prompt.js";
import type { Turn } from "./response.js";
import type { Session } from "./session.js";
import type { Pulse } from "./stream.js";
import type { ToolKey } from "./tools.js";
import type { Verdict } from "./approval.js";

export type Traits = {
  streaming: boolean;
  structuredOutput: boolean;
  imageInput: boolean;
  subagents: boolean;
  sessionFork: boolean;
  hooks: boolean;
  inputModification: boolean;
  costTracking: boolean;
  sandboxModes: boolean;
  turnSteering: boolean;
  turnInterrupt: boolean;
  sessionSharing: boolean;
  permissionRemember: boolean;
  multiProvider: boolean;
  lsp: boolean;
};

export type Driver = {
  readonly id: Runtime;

  initialize(config: Profile): Promise<void>;
  dispose(): Promise<void>;

  createSession(opts?: { cwd?: string; title?: string }): Promise<Session>;
  resumeSession(sessionId: string): Promise<Session>;
  listSessions(): Promise<Session[]>;
  deleteSession(sessionId: string): Promise<void>;

  prompt(sessionId: string, input: PromptInput): Promise<Turn>;
  promptStreamed(sessionId: string, input: PromptInput): AsyncIterable<Pulse>;
  abort(sessionId: string): Promise<void>;

  approveToolCall(sessionId: string, requestId: string, verdict: Verdict): Promise<void>;

  getMessages(sessionId: string): Promise<Turn[]>;
  getSupportedTools(): ToolKey[];
  getCapabilities(): Traits;
};
