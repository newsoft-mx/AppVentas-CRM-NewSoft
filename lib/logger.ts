type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: string;
  error?: unknown;
  timestamp: string;
}

function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] [${entry.level.toUpperCase()}]${entry.context ? ` [${entry.context}]` : ""} ${entry.message}`;
  if (entry.error instanceof Error) {
    return `${base}\n  ${entry.error.stack ?? entry.error.message}`;
  }
  if (entry.error !== undefined) {
    return `${base}\n  ${JSON.stringify(entry.error)}`;
  }
  return base;
}

function log(level: LogLevel, message: string, context?: string, error?: unknown) {
  const entry: LogEntry = {
    level,
    message,
    context,
    error,
    timestamp: new Date().toISOString(),
  };

  const formatted = formatEntry(entry);

  if (level === "error") {
    console.error(formatted);
  } else if (level === "warn") {
    console.warn(formatted);
  } else {
    console.log(formatted);
  }
}

export const logger = {
  info: (message: string, context?: string) => log("info", message, context),
  warn: (message: string, context?: string, error?: unknown) => log("warn", message, context, error),
  error: (message: string, context?: string, error?: unknown) => log("error", message, context, error),
};
