import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { app, safeStorage } from "electron";
import type { ApiKeyProvider, AuthMethod } from "@agentide/shared";

type AppConfig = {
  activeWorkspaceId: string | null;
  encryptedApiKey: string | null;
  encryptedCodexApiKey: string | null;
  encryptedMinimaxApiKey: string | null;
  authMethod: AuthMethod;
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
  authMethod: "claude_login",
};

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
      authMethod:
        data?.authMethod === "api_key" || data?.authMethod === "claude_login"
          ? data.authMethod
          : "claude_login",
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

export function getApiKeyByProvider(provider: ApiKeyProvider): string | null {
  switch (provider) {
    case "claude":
      return getApiKey();
    case "codex":
      return getCodexApiKey();
    case "minimax":
      return getMinimaxApiKey();
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
