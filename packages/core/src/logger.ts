type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const threshold = LEVELS[(process.env.GDP_LOG_LEVEL as Level) ?? "info"] ?? 20;

function emit(level: Level, scope: string, msg: string, meta?: unknown) {
  if (LEVELS[level] < threshold) return;
  const line = { t: new Date().toISOString(), level, scope, msg, ...(meta ? { meta } : {}) };
  const text = process.env.GDP_LOG_PRETTY === "false" ? JSON.stringify(line) : `[${level}] ${scope}: ${msg}${meta ? " " + JSON.stringify(meta) : ""}`;
  if (level === "error") console.error(text);
  else if (level === "warn") console.warn(text);
  else console.log(text);
}

export interface Logger {
  debug(msg: string, meta?: unknown): void;
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
  child(scope: string): Logger;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (m, meta) => emit("debug", scope, m, meta),
    info: (m, meta) => emit("info", scope, m, meta),
    warn: (m, meta) => emit("warn", scope, m, meta),
    error: (m, meta) => emit("error", scope, m, meta),
    child: (sub) => createLogger(`${scope}:${sub}`),
  };
}

export const log = createLogger("gdp");
