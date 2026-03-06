export type AgentLogLevel = "INFO" | "WARN" | "ERROR";

export type AgentLogEntry = {
  level: AgentLogLevel;
  source: string;
  timestamp: string;
  args: unknown[];
};

export type AgentLogger = {
  log: (entry: AgentLogEntry) => void;
};

export type AgentLogWriter = (
  level: AgentLogLevel,
  source: string,
  ...args: unknown[]
) => void;

const noopLogger: AgentLogger = {
  log: () => {},
};

export function createAgentLogger(log?: AgentLogger | AgentLogWriter): AgentLogger {
  if (!log) return noopLogger;
  if (typeof log === "function") {
    return {
      log: ({ level, source, args }) => {
        log(level, source, ...args);
      },
    };
  }
  return log;
}

export function logAgentEvent(
  logger: AgentLogger | undefined,
  level: AgentLogLevel,
  source: string,
  ...args: unknown[]
): void {
  createAgentLogger(logger).log({
    level,
    source,
    timestamp: new Date().toISOString(),
    args,
  });
}

export type FileAgentLoggerOptions = {
  getFilePath: () => string;
  mirrorToConsole?: boolean;
  ensureDir?: (filePath: string) => void;
  appendLine?: (filePath: string, line: string) => void;
};

function stringifyArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  try {
    return JSON.stringify(arg, null, 2);
  } catch {
    return String(arg);
  }
}

export function formatAgentLogEntry(entry: AgentLogEntry): string {
  const payload = entry.args.map(stringifyArg).join(" ");
  return `${entry.timestamp} [${entry.level}] [${entry.source}] ${payload}`;
}

export function createFileAgentLogger(options: FileAgentLoggerOptions): AgentLogger {
  return {
    log(entry) {
      const line = `${formatAgentLogEntry(entry)}\n`;
      try {
        options.ensureDir?.(options.getFilePath());
        options.appendLine?.(options.getFilePath(), line);
      } catch {
        // ignore logging failures
      }
      if (options.mirrorToConsole) {
        const label = `[${entry.source}Backend]`;
        if (entry.level === "ERROR") {
          console.error(label, ...entry.args);
        } else if (entry.level === "WARN") {
          console.warn(label, ...entry.args);
        } else {
          console.log(label, ...entry.args);
        }
      }
    },
  };
}
