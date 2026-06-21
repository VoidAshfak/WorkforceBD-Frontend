import "server-only";

/**
 * Server-side gateway to the WorkforceBD REST API.
 * Only the BFF route handlers touch this — the browser never calls the backend
 * directly, so access tokens stay in httpOnly cookies and out of JS reach.
 */
export const API_BASE_URL =
  process.env.API_BASE_URL ?? "https://workforcebd.onrender.com/api/v1";

export type BackendResult<T> = {
  ok: boolean;
  status: number;
  body: T & { success?: boolean; message?: string; errors?: unknown[] };
};

type Options = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  accessToken?: string;
};

export async function backend<T = Record<string, unknown>>(
  path: string,
  { method = "GET", body, accessToken }: Options = {},
): Promise<BackendResult<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      status: 503,
      body: { success: false, message: "Cannot reach the server. Try again." } as never,
    };
  }

  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = { success: res.ok, message: res.statusText };
  }

  return { ok: res.ok, status: res.status, body: parsed as BackendResult<T>["body"] };
}
