import { app } from "electron";
import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createFileAgentLogger, type AgentLogger } from "@agentide/agent";

const LOG_DIR = app?.isPackaged
  ? path.join(app.getPath("userData"), "logs")
  : path.join(process.cwd(), "logs");

function ensureLogDir(filePath: string) {
  const dir = path.dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function getAgentLogPath(): string {
  return path.join(LOG_DIR, "agent.log");
}

export function getAgentLogDir(): string {
  return LOG_DIR;
}

export const agentLogger: AgentLogger = createFileAgentLogger({
  getFilePath: getAgentLogPath,
  mirrorToConsole: true,
  ensureDir: ensureLogDir,
  appendLine: (filePath, line) => {
    appendFileSync(filePath, line);
  },
});
