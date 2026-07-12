import "server-only";

import { createLogger } from "@/lib/logger";

const log = createLogger("backend");

/**
 * Base URL of the WorkforceBD REST API. Override with the `API_BASE_URL`
 * environment variable; falls back to the hosted cloud instance.
 */
export const API_BASE_URL =
  process.env.API_BASE_URL ?? "https://workforcebd.onrender.com/api/v1";

/**
 * Normalized outcome of a backend call. `body` is the parsed JSON envelope the
 * API returns (`{ success, message, data?, errors? }`).
 *
 * @typeParam T - Shape merged into the response envelope's data fields.
 */
export type BackendResult<T> = {
  /** `true` when the HTTP status is 2xx. */
  ok: boolean;
  /** HTTP status code (or `503` when the host is unreachable). */
  status: number;
  body: T & { success?: boolean; message?: string; errors?: unknown[] };
  /**
   * Raw `Set-Cookie` lines from the backend. The admin auth endpoints set their
   * refresh token this way; because the BFF — not the browser — is the client
   * here, that cookie lands on the server and has to be picked up explicitly.
   * Read it with {@link readSetCookie}.
   */
  setCookie: string[];
};

/** Options for a single {@link backend} request. */
type Options = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** JSON-serializable request body. Omit for `GET`. */
  body?: unknown;
  /** Bearer token injected as `Authorization`. Sourced from httpOnly cookies. */
  accessToken?: string;
  /** `Cookie` header value, e.g. `admin_refresh_token=…` for the admin auth routes. */
  cookie?: string;
};

/** Pulls one cookie's value out of a response's `Set-Cookie` lines. */
export function readSetCookie(setCookie: string[], name: string): string | undefined {
  for (const line of setCookie) {
    const pair = line.split(";", 1)[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq > 0 && pair.slice(0, eq).trim() === name) {
      const value = pair.slice(eq + 1).trim();
      if (value) return value;
    }
  }
  return undefined;
}

/**
 * Server-side gateway to the WorkforceBD REST API.
 *
 * Only the BFF route handlers (`src/app/api/auth/*`) call this — the browser
 * never reaches the backend directly, so access tokens stay in httpOnly cookies
 * and out of JS reach. Network failures are converted into a `503` result
 * instead of throwing, so callers branch on `result.ok` rather than try/catch.
 *
 * @typeParam T - Expected shape of the response `data`.
 * @param path - Path appended to {@link API_BASE_URL}, e.g. `"/auth/me"`.
 * @param options - Method, body, and optional bearer token. See {@link Options}.
 * @returns A {@link BackendResult} — always resolves, never rejects.
 */
export async function backend<T = Record<string, unknown>>(
  path: string,
  { method = "GET", body, accessToken, cookie }: Options = {},
): Promise<BackendResult<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  if (cookie) headers["Cookie"] = cookie;

  const startedAt = Date.now();
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch (err) {
    log.error("request failed (network)", {
      method,
      path,
      ms: Date.now() - startedAt,
      error: (err as Error)?.message,
    });
    return {
      ok: false,
      status: 503,
      body: { success: false, message: "Cannot reach the server. Try again." } as never,
      setCookie: [],
    };
  }

  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = { success: res.ok, message: res.statusText };
  }

  // Bodies are intentionally not logged here — they can carry tokens/OTPs.
  log.debug("request complete", {
    method,
    path,
    status: res.status,
    ms: Date.now() - startedAt,
  });

  return {
    ok: res.ok,
    status: res.status,
    body: parsed as BackendResult<T>["body"],
    setCookie: res.headers.getSetCookie(),
  };
}
