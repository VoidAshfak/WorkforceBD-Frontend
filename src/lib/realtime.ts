/**
 * Browser-side realtime helpers. The Socket.IO server shares the backend host
 * (path `/socket.io`); only the socket *origin* is public — the access token
 * never leaves the BFF. Override the origin with `NEXT_PUBLIC_SOCKET_URL`.
 */

export const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "https://workforcebd.onrender.com";

/**
 * Fetches a fresh ~60s socket ticket from the BFF (which signs the request with
 * the session's access token). Throws on a dead/expired session.
 */
export async function fetchSocketTicket(): Promise<string> {
  const res = await fetch("/api/realtime/ticket", {
    method: "POST",
    credentials: "same-origin",
  });
  if (!res.ok) throw new Error(`socket ticket request failed (${res.status})`);
  const json = (await res.json()) as { data?: { ticket?: string } };
  const ticket = json?.data?.ticket;
  if (!ticket) throw new Error("socket ticket missing from response");
  return ticket;
}
