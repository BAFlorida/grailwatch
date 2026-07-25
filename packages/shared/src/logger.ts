export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

let globalLevel: LogLevel = "info";
const fromEnv = process.env.LOG_LEVEL as LogLevel | undefined;
if (fromEnv && fromEnv in LEVEL_RANK) globalLevel = fromEnv;

export function setLogLevel(level: LogLevel): void {
  globalLevel = level;
}

function write(level: LogLevel, scope: string, msg: string, extra?: unknown): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[globalLevel]) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${msg}`;
  const method = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (extra !== undefined) method(line, extra);
  else method(line);
}

export interface Logger {
  debug(msg: string, extra?: unknown): void;
  info(msg: string, extra?: unknown): void;
  warn(msg: string, extra?: unknown): void;
  error(msg: string, extra?: unknown): void;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (m, e) => write("debug", scope, m, e),
    info: (m, e) => write("info", scope, m, e),
    warn: (m, e) => write("warn", scope, m, e),
    error: (m, e) => write("error", scope, m, e),
  };
}
