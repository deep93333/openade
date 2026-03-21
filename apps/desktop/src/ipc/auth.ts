import { ipcMain } from "electron";
import { validateMCPServers } from "@agentide/agent";
import { IPC } from "@agentide/shared";
import type { ApiKeyProvider, GlobalSettings, MCPServerConfig } from "@agentide/shared";
import * as configStorage from "../services/config-storage";

export function registerAuthHandlers(): void {
  ipcMain.handle(IPC.AUTH_LOGIN, async () => {
    try {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const execFileAsync = promisify(execFile);
      await execFileAsync("claude", ["login"], { timeout: 120_000, env: process.env });
      const cli = await configStorage.checkCliLogin();
      if (cli.loggedIn) {
        configStorage.setAuthMethod("claude_login");
        return { success: true, data: { email: cli.email } };
      }
      return { success: false, error: "Login did not complete" };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "Login failed" };
    }
  });

  ipcMain.handle(IPC.AUTH_STATUS, async () => {
    try {
      const method = configStorage.getAuthMethod();
      const hasKey = configStorage.hasApiKey();
      const cli = await configStorage.checkCliLogin();
      return {
        success: true,
        data: { method, hasApiKey: hasKey, cliLoggedIn: cli.loggedIn, cliEmail: cli.email },
      };
    } catch {
      return { success: false, error: "Failed to get auth status" };
    }
  });

  ipcMain.handle(IPC.AUTH_SET_METHOD, async (_event, method: string) => {
    try {
      if (method !== "api_key" && method !== "claude_login") {
        return { success: false, error: "Invalid auth method" };
      }
      configStorage.setAuthMethod(method);
      return { success: true };
    } catch {
      return { success: false, error: "Failed to set auth method" };
    }
  });

  ipcMain.handle(IPC.API_KEY_GET, async () => {
    try {
      return { success: true, data: configStorage.getApiKey() };
    } catch {
      return { success: false, error: "Failed to get API key" };
    }
  });

  ipcMain.handle(IPC.API_KEY_SET, async (_event, apiKey: string | null) => {
    try {
      configStorage.setApiKey(apiKey);
      return { success: true };
    } catch {
      return { success: false, error: "Failed to save API key" };
    }
  });

  ipcMain.handle(IPC.API_KEY_HAS, async () => {
    try {
      return { success: true, data: configStorage.hasApiKey() };
    } catch {
      return { success: false, error: "Failed to check API key" };
    }
  });

  ipcMain.handle(IPC.CODEX_API_KEY_GET, async () => {
    try {
      return { success: true, data: configStorage.getCodexApiKey() };
    } catch {
      return { success: false, error: "Failed to get Codex API key" };
    }
  });

  ipcMain.handle(IPC.CODEX_API_KEY_SET, async (_event, apiKey: string | null) => {
    try {
      configStorage.setCodexApiKey(apiKey);
      return { success: true };
    } catch {
      return { success: false, error: "Failed to save Codex API key" };
    }
  });

  ipcMain.handle(IPC.CODEX_API_KEY_HAS, async () => {
    try {
      return { success: true, data: configStorage.hasCodexApiKey() };
    } catch {
      return { success: false, error: "Failed to check Codex API key" };
    }
  });

  ipcMain.handle(IPC.MINIMAX_API_KEY_GET, async () => {
    try {
      return { success: true, data: configStorage.getMinimaxApiKey() };
    } catch {
      return { success: false, error: "Failed to get MiniMax API key" };
    }
  });

  ipcMain.handle(IPC.MINIMAX_API_KEY_SET, async (_event, apiKey: string | null) => {
    try {
      configStorage.setMinimaxApiKey(apiKey);
      return { success: true };
    } catch {
      return { success: false, error: "Failed to save MiniMax API key" };
    }
  });

  ipcMain.handle(IPC.MINIMAX_API_KEY_HAS, async () => {
    try {
      return { success: true, data: configStorage.hasMinimaxApiKey() };
    } catch {
      return { success: false, error: "Failed to check MiniMax API key" };
    }
  });

  ipcMain.handle(IPC.API_KEYS_GET, async (_event, provider: ApiKeyProvider) => {
    try {
      return { success: true, data: configStorage.getApiKeyByProvider(provider) };
    } catch {
      return { success: false, error: `Failed to get API key for ${provider}` };
    }
  });

  ipcMain.handle(IPC.API_KEYS_SET, async (_event, provider: ApiKeyProvider, apiKey: string | null) => {
    try {
      configStorage.setApiKeyByProvider(provider, apiKey);
      return { success: true };
    } catch {
      return { success: false, error: `Failed to save API key for ${provider}` };
    }
  });

  ipcMain.handle(IPC.API_KEYS_HAS, async (_event, provider: ApiKeyProvider) => {
    try {
      return { success: true, data: configStorage.hasApiKeyByProvider(provider) };
    } catch {
      return { success: false, error: `Failed to check API key for ${provider}` };
    }
  });

  ipcMain.handle(IPC.SETTINGS_GET, async () => {
    try {
      return { success: true, data: configStorage.getGlobalSettings() };
    } catch {
      return { success: false, error: "Failed to load settings" };
    }
  });

  ipcMain.handle(IPC.SETTINGS_SET, async (_event, settings: GlobalSettings) => {
    try {
      configStorage.setGlobalSettings(settings);
      return { success: true };
    } catch {
      return { success: false, error: "Failed to save settings" };
    }
  });

  ipcMain.handle(IPC.SETTINGS_VALIDATE_MCP_SERVERS, async (_event, servers: MCPServerConfig[]) => {
    try {
      const result = await validateMCPServers(servers);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to connect to MCP server",
      };
    }
  });

  ipcMain.handle(IPC.CONFIG_GET_ACTIVE_WORKSPACE, async () => {
    try {
      return { success: true, data: configStorage.getActiveWorkspaceId() };
    } catch {
      return { success: false, error: "Failed to load config" };
    }
  });

  ipcMain.handle(IPC.CONFIG_SET_ACTIVE_WORKSPACE, async (_event, workspaceId: string | null) => {
    try {
      configStorage.setActiveWorkspaceId(workspaceId);
      return { success: true };
    } catch {
      return { success: false, error: "Failed to save config" };
    }
  });
}
