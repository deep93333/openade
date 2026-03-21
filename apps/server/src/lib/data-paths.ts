import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export function getAgentideDataDir(): string {
  const dir = process.env.AGENTIDE_DATA_DIR ?? path.join(os.homedir(), ".agentide-server");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getAgentLogPath(): string {
  return path.join(getAgentideDataDir(), "agent.log");
}
