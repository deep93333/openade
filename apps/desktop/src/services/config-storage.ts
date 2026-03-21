import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { app, safeStorage } from "electron";
import type { ApiKeyProvider, AuthMethod, GlobalSettings, MCPServerConfig } from "@agentide/shared";

type AppConfig = {
  activeWorkspaceId: string | null;
  encryptedApiKey: string | null;
  encryptedCodexApiKey: string | null;
  encryptedMinimaxApiKey: string | null;
  encryptedMoonshotApiKey: string | null;
  authMethod: AuthMethod;
  mcpServers: MCPServerConfig[];
  commitMessageModel?: string;
  commitMessageProvider?: GlobalSettings["commitMessageProvider"];
  moonshotBaseUrl?: string | null;
};

const getConfigPath = (): string => {
  const userData = app.getPath("userData");
  const dir = path.join(userData, "agentide");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, "config.json");
};

const DEFAULT_CONFIG: AppConfig = {
  activeWorkspaceId: null,
  encryptedApiKey: null,
  encryptedCodexApiKey: null,
  encryptedMinimaxApiKey: null,
  encryptedMoonshotApiKey: null,
  authMethod: "claude_login",
  mcpServers: [],
  commitMessageModel: undefined,
  commitMessageProvider: undefined,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inferMCPServerType(value: Record<string, unknown>): MCPServerConfig["type"] | null {
  if (typeof value.command === "string" && value.command.trim()) return "stdio";
  if (typeof value.url !== "string" || !value.url.trim()) return null;

  try {
    const url = new URL(value.url);
    const path = url.pathname.toLowerCase();
    if (path.endsWith("/sse") || path.includes("/sse/")) return "sse";
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
          Object.entries(value.env).filter((entry): entry is [string, string] => typeof entry[1] === "string")
        )
      : undefined;
    const cwd = typeof value.cwd === "string" ? value.cwd : undefined;

    return { id, name, type: "stdio", command: value.command, args, env, cwd };
  }

  if ((type === "http" || type === "sse") && typeof value.url === "string") {
    const headers = isRecord(value.headers)
      ? Object.fromEntries(
          Object.entries(value.headers).filter((entry): entry is [string, string] => typeof entry[1] === "string")
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
    return {
      activeWorkspaceId:
        typeof data?.activeWorkspaceId === "string" ? data.activeWorkspaceId : null,
      encryptedApiKey:
        typeof data?.encryptedApiKey === "string" ? data.encryptedApiKey : null,
      encryptedCodexApiKey:
        typeof data?.encryptedCodexApiKey === "string" ? data.encryptedCodexApiKey : null,
      encryptedMinimaxApiKey:
        typeof data?.encryptedMinimaxApiKey === "string" ? data.encryptedMinimaxApiKey : null,
      encryptedMoonshotApiKey:
        typeof data?.encryptedMoonshotApiKey === "string" ? data.encryptedMoonshotApiKey : null,
      moonshotBaseUrl:
        typeof data?.moonshotBaseUrl === "string" && data.moonshotBaseUrl.trim()
          ? data.moonshotBaseUrl.trim()
          : undefined,
      authMethod:
        data?.authMethod === "api_key" || data?.authMethod === "claude_login"
          ? data.authMethod
          : "claude_login",
      mcpServers: Array.isArray(data?.mcpServers)
        ? data.mcpServers
            .map((server) => normalizeMCPServerConfig(server))
            .filter((server): server is MCPServerConfig => server !== null)
        : [],
      commitMessageModel:
        typeof data?.commitMessageModel === "string" && data.commitMessageModel.trim()
          ? data.commitMessageModel
          : undefined,
      commitMessageProvider:
        data?.commitMessageProvider === "claude" ||
        data?.commitMessageProvider === "codex" ||
        data?.commitMessageProvider === "minimax" ||
        data?.commitMessageProvider === "moonshot"
          ? data.commitMessageProvider
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
    // ignore
  }
}

export function getApiKey(): string | null {
  try {
    const config = loadConfig();
    if (!config.encryptedApiKey) return null;
    if (!safeStorage.isEncryptionAvailable()) return null;
    const decrypted = safeStorage.decryptString(
      Buffer.from(config.encryptedApiKey, "base64")
    );
    return decrypted || null;
  } catch {
    return null;
  }
}

export function setApiKey(apiKey: string | null): void {
  try {
    const config = loadConfig();
    if (!apiKey) {
      config.encryptedApiKey = null;
    } else if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(apiKey);
      config.encryptedApiKey = encrypted.toString("base64");
    }
    saveConfig(config);
  } catch {
    // ignore
  }
}

export function getCodexApiKey(): string | null {
  try {
    const config = loadConfig();
    if (!config.encryptedCodexApiKey) return null;
    if (!safeStorage.isEncryptionAvailable()) return null;
    const decrypted = safeStorage.decryptString(
      Buffer.from(config.encryptedCodexApiKey, "base64")
    );
    return decrypted || null;
  } catch {
    return null;
  }
}

export function setCodexApiKey(apiKey: string | null): void {
  try {
    const config = loadConfig();
    if (!apiKey) {
      config.encryptedCodexApiKey = null;
    } else if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(apiKey);
      config.encryptedCodexApiKey = encrypted.toString("base64");
    }
    saveConfig(config);
  } catch {
    // ignore
  }
}

export function getMinimaxApiKey(): string | null {
  try {
    const config = loadConfig();
    if (!config.encryptedMinimaxApiKey) return null;
    if (!safeStorage.isEncryptionAvailable()) return null;
    const decrypted = safeStorage.decryptString(
      Buffer.from(config.encryptedMinimaxApiKey, "base64")
    );
    return decrypted || null;
  } catch {
    return null;
  }
}

export function setMinimaxApiKey(apiKey: string | null): void {
  try {
    const config = loadConfig();
    if (!apiKey) {
      config.encryptedMinimaxApiKey = null;
    } else if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(apiKey);
      config.encryptedMinimaxApiKey = encrypted.toString("base64");
    }
    saveConfig(config);
  } catch {
    // ignore
  }
}

export function getMoonshotApiKey(): string | null {
  try {
    const config = loadConfig();
    if (!config.encryptedMoonshotApiKey) return null;
    if (!safeStorage.isEncryptionAvailable()) return null;
    const decrypted = safeStorage.decryptString(
      Buffer.from(config.encryptedMoonshotApiKey, "base64")
    );
    return decrypted || null;
  } catch {
    return null;
  }
}

export function setMoonshotApiKey(apiKey: string | null): void {
  try {
    const config = loadConfig();
    if (!apiKey) {
      config.encryptedMoonshotApiKey = null;
    } else if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(apiKey);
      config.encryptedMoonshotApiKey = encrypted.toString("base64");
    }
    saveConfig(config);
  } catch {
    // ignore
  }
}

export function hasApiKey(): boolean {
  const config = loadConfig();
  return !!config.encryptedApiKey;
}

export function hasCodexApiKey(): boolean {
  const config = loadConfig();
  return !!config.encryptedCodexApiKey;
}

export function hasMinimaxApiKey(): boolean {
  const config = loadConfig();
  return !!config.encryptedMinimaxApiKey;
}

export function hasMoonshotApiKey(): boolean {
  const config = loadConfig();
  return !!config.encryptedMoonshotApiKey;
}

export function getMoonshotBaseUrl(): string | null {
  const config = loadConfig();
  return config.moonshotBaseUrl ?? null;
}

export function setMoonshotBaseUrl(url: string | null): void {
  try {
    const config = loadConfig();
    config.moonshotBaseUrl = url?.trim() || undefined;
    saveConfig(config);
  } catch {
    // ignore
  }
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

export function getGlobalSettings(): GlobalSettings {
  const config = loadConfig();
  return {
    mcpServers: config.mcpServers,
    commitMessageModel: config.commitMessageModel,
    commitMessageProvider: config.commitMessageProvider,
    moonshotBaseUrl: config.moonshotBaseUrl ?? undefined,
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
    saveConfig(config);
  } catch {
    // ignore
  }
}

export function setAuthMethod(method: AuthMethod): void {
  try {
    const config = loadConfig();
    config.authMethod = method;
    saveConfig(config);
  } catch {
    // ignore
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
    const parsed = JSON.parse(stdout.trim());
    return {
      loggedIn: parsed.loggedIn === true,
      email: parsed.email ?? undefined,
    };
  } catch {
    return { loggedIn: false };
  }
}
