import type { Runtime } from "./ids.js";
import type { PermissionConfig, ToolConfig } from "./tools.js";

export type { Runtime } from "./ids.js";

export type McpServerConfig = {
  transport: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
};

export type SandboxConfig =
  | { mode: "full-access" }
  | { mode: "workspace-write"; networkAccess?: boolean }
  | { mode: "read-only" };

export type Profile = {
  id: Runtime;
  credentials: Record<string, string>;
  model?: string;
  cwd?: string;
  tools?: ToolConfig;
  permissions?: PermissionConfig;
  mcp?: Record<string, McpServerConfig>;
  sandbox?: SandboxConfig;
  raw?: Record<string, unknown>;
};

export type Suite = {
  runtimes: Record<Runtime, Profile>;
  defaultRuntime: Runtime;
  session?: {
    persistenceDir?: string;
  };
};
