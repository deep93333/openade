import { createAgentManager, createCustomAgentBackend } from "@agentide/agent";
import * as configStorage from "./config-storage";
import { writeAgentLog } from "./agent-log";

const backend = createCustomAgentBackend({
  getApiKey: () => configStorage.getApiKey(),
  getCodexApiKey: () => configStorage.getCodexApiKey(),
  getMinimaxApiKey: () => configStorage.getMinimaxApiKey(),
  writeAgentLog,
});

export const agentManager = createAgentManager({
  writeAgentLog,
  backends: [
    ["claude", backend],
    ["codex", backend],
    ["minimax", backend],
  ],
});

export function getAllModels() {
  return agentManager.getAllModels();
}
