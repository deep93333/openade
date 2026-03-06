import { createMCPClient } from "@ai-sdk/mcp";
import { Experimental_StdioMCPTransport } from "@ai-sdk/mcp/mcp-stdio";
import type { MCPServerConfig, MCPValidationResult } from "@agentide/shared";
import type { ToolSet } from "ai";
import type { MCPToolRuntime } from "./tool-types.js";

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

async function createMCPRuntime(config: MCPServerConfig): Promise<MCPToolRuntime> {
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

  return {
    config,
    tools,
    close: () => client.close(),
  };
}

export async function createMCPToolRuntimes(configs?: MCPServerConfig[]): Promise<MCPToolRuntime[]> {
  if (!configs?.length) return [];

  const uniqueConfigs = Array.from(new Map(configs.map((config) => [getMCPServerKey(config), config])).values());
  return Promise.all(uniqueConfigs.map((config) => createMCPRuntime(config)));
}

export function mergeMCPTools(baseTools: ToolSet, runtimes?: MCPToolRuntime[]): ToolSet {
  if (!runtimes?.length) return baseTools;

  const merged: ToolSet = { ...baseTools };
  for (const runtime of runtimes) {
    Object.assign(merged as Record<string, unknown>, runtime.tools as Record<string, unknown>);
  }
  return merged;
}

export async function closeMCPToolRuntimes(runtimes?: MCPToolRuntime[]): Promise<void> {
  if (!runtimes?.length) return;
  await Promise.allSettled(runtimes.map((runtime) => runtime.close()));
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
