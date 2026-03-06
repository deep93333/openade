import {
  createAgentManager,
  createCustomAgentBackend,
  generateThreadTitle as generateThreadTitleForBackend,
  type AgentBackendConfig,
} from "@agentide/agent";
import type { ThreadTitleParams } from "@agentide/shared";
import * as configStorage from "./config-storage";
import { agentLogger } from "./agent-log";

const backendConfig: AgentBackendConfig = {
  getApiKey: () => configStorage.getApiKey(),
  getCodexApiKey: () => configStorage.getCodexApiKey(),
  getMinimaxApiKey: () => configStorage.getMinimaxApiKey(),
  logger: agentLogger,
};

const backend = createCustomAgentBackend(backendConfig);

export const agentManager = createAgentManager({
  logger: agentLogger,
  backends: [
    ["claude", backend],
    ["codex", backend],
    ["minimax", backend],
  ],
});

export function getAllModels() {
  return agentManager.getAllModels();
}

export async function generateThreadTitle(params: ThreadTitleParams) {
  return generateThreadTitleForBackend(backendConfig, params);
}
