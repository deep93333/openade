import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export function getOpenadeDataDir(): string {
  const raw =
    process.env.OPENADE_DATA_DIR?.trim() || process.env.AGENTIDE_DATA_DIR?.trim();
  const dir =
    raw && raw.length > 0 ? raw : path.join(os.homedir(), ".openade-server");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getAgentLogPath(): string {
  return path.join(getOpenadeDataDir(), "agent.log");
}
