import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import type { MCPServerConfig, MCPValidationResult } from "@agentide/shared";
import type { ToolSet } from "ai";
import type { MCPToolRuntime } from "./tool-types.js";
import { logAgentEvent, type AgentLogger } from "../logger.js";

function getMCPServerKey(config: MCPServerConfig): string {
  if (config.type === "stdio") {
    return JSON.stringify({
      type: config.type,
      command: config.command,
      args: config.args ?? [],
      env: config.env ?? {},
      cwd: config.cwd ?? "",
    });
  }

  return JSON.stringify({
    type: config.type,
    url: config.url,
    headers: config.headers ?? {},
  });
}

async function createMCPRuntime(config: MCPServerConfig, logger?: AgentLogger): Promise<MCPToolRuntime> {
  const serverName = config.name ?? config.id ?? (config.type === "stdio" ? config.command : "MCP");
  try {
    const client = await createMCPClient({
      transport: config.type === "stdio"
        ? new Experimental_StdioMCPTransport({
            command: config.command,
            args: config.args,
            env: config.env,
            cwd: config.cwd,
          })
        : config,
    });

    const tools = await client.tools() as ToolSet;
    logAgentEvent(logger, "DEBUG", "MCP", "server_connected", {
      serverName,
      toolCount: Object.keys(tools).length,
      toolNames: Object.keys(tools),
    });

    return {
      config,
      tools,
      close: () => client.close(),
    };
  } catch (err) {
    logAgentEvent(logger, "ERROR", "MCP", "server_connect_failed", {
      serverName,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
    });
    throw err;
  }
}

export async function createMCPToolRuntimes(configs?: MCPServerConfig[], logger?: AgentLogger): Promise<MCPToolRuntime[]> {
  if (!configs?.length) return [];

  const uniqueConfigs = Array.from(new Map(configs.map((config) => [getMCPServerKey(config), config])).values());
  logAgentEvent(logger, "DEBUG", "MCP", "init_start", { serverCount: uniqueConfigs.length });
  const runtimes = await Promise.all(uniqueConfigs.map((config) => createMCPRuntime(config, logger)));
  logAgentEvent(logger, "DEBUG", "MCP", "init_complete", {
    totalTools: runtimes.reduce((sum, r) => sum + Object.keys(r.tools).length, 0),
  });
  return runtimes;
}

export function mergeMCPTools(baseTools: ToolSet, runtimes?: MCPToolRuntime[]): ToolSet {
  if (!runtimes?.length) return baseTools;

  const merged: ToolSet = { ...baseTools };
  for (const runtime of runtimes) {
    Object.assign(merged as Record<string, unknown>, runtime.tools as Record<string, unknown>);
  }
  return merged;
}

export async function closeMCPToolRuntimes(
  runtimes?: MCPToolRuntime[],
  logger?: AgentLogger,
): Promise<void> {
  if (!runtimes?.length) return;
  const results = await Promise.allSettled(runtimes.map((runtime) => runtime.close()));
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "rejected") {
      logAgentEvent(logger, "WARN", "MCP", "server_close_failed", {
        serverName: runtimes![i]?.config.name ?? runtimes![i]?.config.id ?? "unknown",
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  }
}

export async function validateMCPServers(configs: MCPServerConfig[]): Promise<MCPValidationResult> {
  const runtimes = await createMCPToolRuntimes(configs);
  try {
    return {
      servers: runtimes.map((runtime) => ({
        name: runtime.config.name ?? runtime.config.id ?? "Unnamed server",
        type: runtime.config.type,
        toolNames: Object.keys(runtime.tools).sort(),
        toolCount: Object.keys(runtime.tools).length,
      })),
      warnings: runtimes.flatMap((runtime) => {
        if (runtime.config.type !== "stdio") return [];
        const command = runtime.config.command.trim();
        if (command === "npx" || command === "bunx" || command === "pnpm" || command === "node") return [];
        return [`${runtime.config.name ?? command}: make sure \`${command}\` is available on PATH in the desktop app environment.`];
      }),
    };
  } finally {
    await closeMCPToolRuntimes(runtimes);
  }
}
