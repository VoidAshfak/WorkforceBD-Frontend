import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { REFRESH_COOKIE } from "@/lib/server/authCookies";
import { createLogger } from "@/lib/logger";

const log = createLogger("proxy");

const AUTH_PATHS = ["/welcome", "/login", "/verify"];
const APP_PATHS = ["/", "/explore", "/activity", "/wallet", "/profile", "/onboarding"];

const isAppPath = (path: string) =>
  APP_PATHS.some((p) => path === p || (p !== "/" && path.startsWith(`${p}/`)));
const isAuthPath = (path: string) => AUTH_PATHS.some((p) => path.startsWith(p));

/**
 * Coarse client-side gate based on the presence of the refresh cookie.
 * The server stays the source of truth (BFF + `requireVerifiedProfile`); this
 * only keeps users from seeing the wrong shell on navigation.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(REFRESH_COOKIE)?.value);

  if (hasSession && isAuthPath(pathname)) {
    log.debug("authed user on auth route -> /", { pathname });
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (!hasSession && isAppPath(pathname)) {
    log.debug("guest on app route -> /welcome", { pathname });
    return NextResponse.redirect(new URL("/welcome", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
