import { app } from "electron";
import { appendFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

export type AgentLogSource = "Agent";

const LOG_DIR = app?.isPackaged
  ? path.join(app.getPath("userData"), "logs")
  : path.join(process.cwd(), "logs");

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

export function getAgentLogPath(): string {
  return path.join(LOG_DIR, "agent.log");
}

export function getAgentLogDir(): string {
  return LOG_DIR;
}

export function writeAgentLog(
  level: "INFO" | "WARN" | "ERROR",
  source: AgentLogSource,
  ...args: unknown[]
): void {
  const ts = new Date().toISOString();
  const payload = args.map((a) =>
    typeof a === "string" ? a : JSON.stringify(a, null, 2)
  ).join(" ");
  const line = `${ts} [${level}] [${source}] ${payload}\n`;
  try {
    ensureLogDir();
    appendFileSync(getAgentLogPath(), line);
  } catch {
    // no-op
  }
  if (level === "ERROR") {
    console.error(`[${source}Backend]`, ...args);
  } else {
    console.log(`[${source}Backend]`, ...args);
  }
}
