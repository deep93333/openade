import type {
  ApiKeyProvider,
  AuthMethod,
  GlobalSettings,
  MCPServerConfig,
  ThemeAppearance,
} from "@agentide/shared";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getAgentideDataDir } from "../lib/data-paths.js";

type AppConfig = {
  activeWorkspaceId: string | null;
  apiKey: string | null;
  codexApiKey: string | null;
  minimaxApiKey: string | null;
  moonshotApiKey: string | null;
  moonshotBaseUrl?: string | null;
  authMethod: AuthMethod;
  mcpServers: MCPServerConfig[];
  commitMessageModel?: string;
  commitMessageProvider?: GlobalSettings["commitMessageProvider"];
  appearance?: ThemeAppearance;
};

const DEFAULT_CONFIG: AppConfig = {
  activeWorkspaceId: null,
  apiKey: null,
  codexApiKey: null,
  minimaxApiKey: null,
  moonshotApiKey: null,
  authMethod: "api_key",
  mcpServers: [],
};

function getConfigPath(): string {
  return path.join(getAgentideDataDir(), "config.json");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inferMCPServerType(value: Record<string, unknown>): MCPServerConfig["type"] | null {
  if (typeof value.command === "string" && value.command.trim()) return "stdio";
  if (typeof value.url !== "string" || !value.url.trim()) return null;
  try {
    const url = new URL(value.url);
    const p = url.pathname.toLowerCase();
    if (p.endsWith("/sse") || p.includes("/sse/")) return "sse";
  } catch {
    if (value.url.toLowerCase().includes("/sse")) return "sse";
  }
  return "http";
}

function normalizeMCPServerConfig(value: unknown): MCPServerConfig | null {
  if (!isRecord(value)) return null;
  const id = typeof value.id === "string" ? value.id : undefined;
  const name = typeof value.name === "string" ? value.name : undefined;
  const explicitType = value.type;
  const type =
    explicitType === "stdio" || explicitType === "http" || explicitType === "sse"
      ? explicitType
      : explicitType === undefined
        ? inferMCPServerType(value)
        : null;

  if (type === "stdio" && typeof value.command === "string") {
    const args = Array.isArray(value.args)
      ? value.args.filter((item): item is string => typeof item === "string")
      : undefined;
    const env = isRecord(value.env)
      ? Object.fromEntries(
          Object.entries(value.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        )
      : undefined;
    const cwd = typeof value.cwd === "string" ? value.cwd : undefined;
    return { id, name, type: "stdio", command: value.command, args, env, cwd };
  }

  if ((type === "http" || type === "sse") && typeof value.url === "string") {
    const headers = isRecord(value.headers)
      ? Object.fromEntries(
          Object.entries(value.headers).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        )
      : undefined;
    return { id, name, type, url: value.url, headers };
  }

  return null;
}

function loadConfig(): AppConfig {
  try {
    const filePath = getConfigPath();
    if (!existsSync(filePath)) return { ...DEFAULT_CONFIG };
    const raw = readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as Partial<AppConfig>;
    const authMethod = data.authMethod;
    const validAuth: AuthMethod =
      authMethod === "api_key" ||
      authMethod === "claude_login" ||
      authMethod === "codex_api_key" ||
      authMethod === "codex_login"
        ? authMethod
        : "api_key";
    return {
      activeWorkspaceId: typeof data.activeWorkspaceId === "string" ? data.activeWorkspaceId : null,
      apiKey: typeof data.apiKey === "string" ? data.apiKey : null,
      codexApiKey: typeof data.codexApiKey === "string" ? data.codexApiKey : null,
      minimaxApiKey: typeof data.minimaxApiKey === "string" ? data.minimaxApiKey : null,
      moonshotApiKey: typeof data.moonshotApiKey === "string" ? data.moonshotApiKey : null,
      moonshotBaseUrl:
        typeof data.moonshotBaseUrl === "string" && data.moonshotBaseUrl.trim()
          ? data.moonshotBaseUrl.trim()
          : undefined,
      authMethod: validAuth,
      mcpServers: Array.isArray(data.mcpServers)
        ? data.mcpServers.map((s) => normalizeMCPServerConfig(s)).filter((s): s is MCPServerConfig => s !== null)
        : [],
      commitMessageModel:
        typeof data.commitMessageModel === "string" && data.commitMessageModel.trim()
          ? data.commitMessageModel
          : undefined,
      commitMessageProvider:
        data.commitMessageProvider === "claude" ||
        data.commitMessageProvider === "codex" ||
        data.commitMessageProvider === "minimax" ||
        data.commitMessageProvider === "moonshot"
          ? data.commitMessageProvider
          : undefined,
      appearance:
        data.appearance === "light" || data.appearance === "dark" || data.appearance === "system"
          ? data.appearance
          : undefined,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(config: AppConfig): void {
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 0), "utf-8");
}

export function getActiveWorkspaceId(): string | null {
  return loadConfig().activeWorkspaceId;
}

export function setActiveWorkspaceId(workspaceId: string | null): void {
  try {
    const config = loadConfig();
    config.activeWorkspaceId = workspaceId;
    saveConfig(config);
  } catch {
    //
  }
}

export function getApiKey(): string | null {
  return loadConfig().apiKey;
}

export function setApiKey(apiKey: string | null): void {
  try {
    const config = loadConfig();
    config.apiKey = apiKey;
    saveConfig(config);
  } catch {
    //
  }
}

export function hasApiKey(): boolean {
  return !!loadConfig().apiKey;
}

export function getCodexApiKey(): string | null {
  return loadConfig().codexApiKey;
}

export function setCodexApiKey(apiKey: string | null): void {
  try {
    const config = loadConfig();
    config.codexApiKey = apiKey;
    saveConfig(config);
  } catch {
    //
  }
}

export function hasCodexApiKey(): boolean {
  return !!loadConfig().codexApiKey;
}

export function getMinimaxApiKey(): string | null {
  return loadConfig().minimaxApiKey;
}

export function setMinimaxApiKey(apiKey: string | null): void {
  try {
    const config = loadConfig();
    config.minimaxApiKey = apiKey;
    saveConfig(config);
  } catch {
    //
  }
}

export function hasMinimaxApiKey(): boolean {
  return !!loadConfig().minimaxApiKey;
}

export function getMoonshotApiKey(): string | null {
  return loadConfig().moonshotApiKey;
}

export function setMoonshotApiKey(apiKey: string | null): void {
  try {
    const config = loadConfig();
    config.moonshotApiKey = apiKey;
    saveConfig(config);
  } catch {
    //
  }
}

export function hasMoonshotApiKey(): boolean {
  return !!loadConfig().moonshotApiKey;
}

export function getApiKeyByProvider(provider: ApiKeyProvider): string | null {
  switch (provider) {
    case "claude":
      return getApiKey();
    case "codex":
      return getCodexApiKey();
    case "minimax":
      return getMinimaxApiKey();
    case "moonshot":
      return getMoonshotApiKey();
  }
}

export function setApiKeyByProvider(provider: ApiKeyProvider, apiKey: string | null): void {
  switch (provider) {
    case "claude":
      return setApiKey(apiKey);
    case "codex":
      return setCodexApiKey(apiKey);
    case "minimax":
      return setMinimaxApiKey(apiKey);
    case "moonshot":
      return setMoonshotApiKey(apiKey);
  }
}

export function hasApiKeyByProvider(provider: ApiKeyProvider): boolean {
  switch (provider) {
    case "claude":
      return hasApiKey();
    case "codex":
      return hasCodexApiKey();
    case "minimax":
      return hasMinimaxApiKey();
    case "moonshot":
      return hasMoonshotApiKey();
  }
}

export function getAuthMethod(): AuthMethod {
  return loadConfig().authMethod;
}

export function setAuthMethod(method: AuthMethod): void {
  try {
    const config = loadConfig();
    config.authMethod = method;
    saveConfig(config);
  } catch {
    //
  }
}

export function getGlobalSettings(): GlobalSettings {
  const config = loadConfig();
  return {
    mcpServers: config.mcpServers,
    commitMessageModel: config.commitMessageModel,
    commitMessageProvider: config.commitMessageProvider,
    moonshotBaseUrl: config.moonshotBaseUrl ?? undefined,
    appearance: config.appearance ?? "dark",
  };
}

export function setGlobalSettings(settings: GlobalSettings): void {
  try {
    const config = loadConfig();
    config.mcpServers = settings.mcpServers
      .map((server) => normalizeMCPServerConfig(server))
      .filter((server): server is MCPServerConfig => server !== null);
    config.commitMessageModel = settings.commitMessageModel?.trim() || undefined;
    config.commitMessageProvider = settings.commitMessageProvider;
    config.moonshotBaseUrl = settings.moonshotBaseUrl?.trim() || undefined;
    if (settings.appearance !== undefined) {
      config.appearance = settings.appearance;
    }
    saveConfig(config);
  } catch {
    //
  }
}

export async function checkCliLogin(): Promise<{ loggedIn: boolean; email?: string }> {
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync("claude", ["auth", "status"], {
      timeout: 5000,
      env: process.env,
    });
    const parsed = JSON.parse(stdout.trim()) as { loggedIn?: boolean; email?: string };
    return {
      loggedIn: parsed.loggedIn === true,
      email: parsed.email ?? undefined,
    };
  } catch {
    return { loggedIn: false };
  }
}
