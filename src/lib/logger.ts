/**
 * Lightweight, isomorphic structured logger.
 *
 * Works in every Next.js runtime — Node route handlers, the Edge proxy, and the
 * browser — by building only on `console`. (A Node-only lib such as `pino` would
 * crash the Edge `proxy.ts` bundle, so we deliberately avoid one.)
 *
 * Server output is a single JSON line per event (friendly to log aggregators);
 * browser output is a namespaced, colorized console line.
 *
 * @example
 * const log = createLogger("auth:verify-otp");
 * log.info("otp verified", { role });
 * log.error("backend unreachable", { status });
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const isServer = typeof window === "undefined";
const isProd = process.env.NODE_ENV === "production";

/**
 * Minimum level that will be emitted. Override with `LOG_LEVEL` (server) or
 * `NEXT_PUBLIC_LOG_LEVEL` (browser). Defaults to `debug` in dev, `info` in prod.
 */
function resolveThreshold(): LogLevel {
  const raw = (isServer ? process.env.LOG_LEVEL : process.env.NEXT_PUBLIC_LOG_LEVEL) as
    | LogLevel
    | undefined;
  if (raw && raw in LEVEL_WEIGHT) return raw;
  return isProd ? "info" : "debug";
}

const THRESHOLD = LEVEL_WEIGHT[resolveThreshold()];

/** Keys whose values must never be written to logs (tokens, secrets). */
const REDACTED_KEYS = new Set([
  "accessToken",
  "refreshToken",
  "refresh_token",
  "otp_code",
  "authorization",
  "password",
]);

/** Replaces sensitive values with `***` so secrets never reach the log sink. */
function redact(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    out[key] = REDACTED_KEYS.has(key) ? "***" : value;
  }
  return out;
}

const BROWSER_STYLE: Record<LogLevel, string> = {
  debug: "color:#6b6b6b",
  info: "color:#1f98f9",
  warn: "color:#ffc629",
  error: "color:#cd2e0f",
};

function emit(
  namespace: string,
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
): void {
  if (LEVEL_WEIGHT[level] < THRESHOLD) return;

  const safe = redact(context);

  // `console.debug` is noisy/absent in some sinks — route it through `console.log`.
  const sink = level === "debug" ? console.log : console[level];

  if (isServer) {
    sink(
      JSON.stringify({
        t: new Date().toISOString(),
        level,
        ns: namespace,
        msg: message,
        ...(safe ? { ctx: safe } : {}),
      }),
    );
    return;
  }

  sink(`%c${namespace}%c ${message}`, BROWSER_STYLE[level], "color:inherit", safe ?? "");
}

export type Logger = {
  debug: (message: string, context?: Record<string, unknown>) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  /** Derives a nested logger, e.g. `auth` → `auth:verify-otp`. */
  child: (suffix: string) => Logger;
};

/**
 * Creates a namespaced logger.
 *
 * @param namespace Dot/colon-separated scope shown on every line, e.g. `"auth:me"`.
 * @returns A {@link Logger} with level methods and a `child` factory.
 */
export function createLogger(namespace: string): Logger {
  return {
    debug: (message, context) => emit(namespace, "debug", message, context),
    info: (message, context) => emit(namespace, "info", message, context),
    warn: (message, context) => emit(namespace, "warn", message, context),
    error: (message, context) => emit(namespace, "error", message, context),
    child: (suffix) => createLogger(`${namespace}:${suffix}`),
  };
}

/** Root application logger. Prefer a namespaced child via {@link createLogger}. */
export const logger = createLogger("app");
