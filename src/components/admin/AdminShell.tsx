"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  LogOut,
  ShieldCheck,
  TimerReset,
} from "lucide-react";

import { ADMIN_NAV } from "@/config/adminNav";
import {
  useAdminLogoutMutation,
  useAdminSessionQuery,
  useGetAdminDashboardQuery,
} from "@/store/api/adminApi";

/** Must mirror `IDLE_TIMEOUT_MS` in `@/lib/server/adminCookies` — the server is the enforcer. */
const IDLE_MS = 10 * 60 * 1000;
/** Warn the admin while they can still save the session. */
const WARN_AT_MS = 60 * 1000;
/** Don't ping the server more often than this while the admin is active. */
const HEARTBEAT_MS = 60 * 1000;

const COLLAPSE_KEY = "wfbd_admin_sidebar";

/**
 * The panel's collapsed state is a UI preference kept in localStorage. It's read
 * through an external store rather than an effect so the server render (always
 * expanded) hydrates cleanly and the preference applies without a flash.
 */
const collapseListeners = new Set<() => void>();

function subscribeCollapse(onChange: () => void): () => void {
  collapseListeners.add(onChange);
  return () => {
    collapseListeners.delete(onChange);
  };
}

function readCollapse(): boolean {
  return window.localStorage.getItem(COLLAPSE_KEY) === "1";
}

function writeCollapse(next: boolean): void {
  window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  for (const listener of collapseListeners) listener();
}

/**
 * Authenticated dashboard chrome: collapsible left panel, top bar, and the
 * session guard.
 *
 * Session rules (see `@/lib/server/adminCookies`): the token lives in httpOnly
 * browser-session cookies, so **closing the browser ends the session**, and the
 * server drops it after 10 minutes of inactivity. This component mirrors that
 * clock client-side — it slides the server deadline forward while the admin is
 * actually working, warns at one minute left, and signs out at zero rather than
 * letting them discover the dead session mid-action.
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const { data: admin, isLoading, isError, refetch } = useAdminSessionQuery();
  const { data: dashboard } = useGetAdminDashboardQuery(undefined, { skip: !admin });
  const [logout] = useAdminLogoutMutation();

  const collapsed = useSyncExternalStore(subscribeCollapse, readCollapse, () => false);
  const [msLeft, setMsLeft] = useState(IDLE_MS);

  // Seeded when the idle effect mounts — `Date.now()` can't be called during render.
  const lastActivity = useRef(0);
  const lastPing = useRef(0);

  const endSession = useCallback(
    async (reason?: string) => {
      try {
        await logout().unwrap();
      } catch {
        // Cookies are cleared server-side regardless; fall through to the redirect.
      }
      router.replace(reason ? `/admin/login?reason=${reason}` : "/admin/login");
    },
    [logout, router],
  );

  const toggleCollapsed = () => writeCollapse(!collapsed);

  // No session (never signed in, browser was closed, token revoked) → login.
  // A session that resolves to a non-admin is treated the same way: the console
  // never renders for a token that couldn't act on any of its endpoints anyway.
  useEffect(() => {
    if (isError) router.replace("/admin/login?reason=expired");
    else if (admin && !admin.roles.includes("admin")) void endSession("expired");
  }, [isError, admin, endSession, router]);

  // Idle clock. Real user input resets it; while the admin is active we ping the
  // session endpoint at most once a minute, which slides the server's deadline.
  useEffect(() => {
    if (!admin) return;

    // Arriving with a live session counts as activity — otherwise the first tick
    // would read a zeroed ref, see an infinite idle window, and sign us straight out.
    lastActivity.current = Date.now();
    lastPing.current = Date.now();

    const onActivity = () => {
      lastActivity.current = Date.now();
    };
    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"] as const;
    for (const e of events) window.addEventListener(e, onActivity, { passive: true });

    const tick = window.setInterval(() => {
      const idleFor = Date.now() - lastActivity.current;
      const remaining = IDLE_MS - idleFor;
      setMsLeft(remaining);

      if (remaining <= 0) {
        void endSession("timeout");
        return;
      }
      if (idleFor < HEARTBEAT_MS && Date.now() - lastPing.current > HEARTBEAT_MS) {
        lastPing.current = Date.now();
        void refetch();
      }
    }, 1000);

    return () => {
      for (const e of events) window.removeEventListener(e, onActivity);
      window.clearInterval(tick);
    };
  }, [admin, endSession, refetch]);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f4f5f7]">
        <Loader2 size={24} className="animate-spin text-text-tertiary" />
      </div>
    );
  }

  // The redirect effect is already in flight; render nothing rather than a flash
  // of empty dashboard chrome.
  if (!admin) return null;

  const warning = msLeft <= WARN_AT_MS;

  return (
    <div className="flex min-h-dvh bg-[#f4f5f7]">
      <aside
        className={`sticky top-0 flex h-dvh shrink-0 flex-col bg-ink text-white transition-[width] duration-200 ${
          collapsed ? "w-[76px]" : "w-[248px]"
        }`}
      >
        <div className="flex h-16 items-center gap-2.5 px-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-ink">
            <ShieldCheck size={19} />
          </span>
          {!collapsed ? (
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold leading-tight">WorkforceBD</span>
              <span className="block text-[11px] font-medium text-white/50">Admin console</span>
            </span>
          ) : null}
        </div>

        <nav className="mt-2 flex-1 space-y-1 px-3">
          {ADMIN_NAV.map((item) => {
            const active =
              item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            const count = dashboard && item.badge ? item.badge(dashboard) : 0;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors ${
                  active ? "bg-brand text-ink" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
                {count > 0 ? (
                  <span
                    className={`shrink-0 rounded-full text-[11px] font-bold ${
                      collapsed
                        ? "absolute ml-6 -mt-5 h-4 min-w-4 px-1 leading-4"
                        : "px-1.5 py-0.5"
                    } ${active ? "bg-ink text-brand" : "bg-danger text-white"}`}
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"}
          className="m-3 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-[13px] font-semibold text-white/60 hover:bg-white/10 hover:text-white"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          {!collapsed ? "Collapse" : null}
        </button>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-surface px-6">
          <IdleBadge msLeft={msLeft} warning={warning} />

          <div className="flex items-center gap-3">
            <span className="text-right">
              <span className="block text-[13px] font-bold leading-tight text-ink">
                {admin.username ?? "Admin"}
              </span>
              <span className="block text-[11px] text-text-tertiary">{admin.email ?? admin.phone}</span>
            </span>
            <button
              type="button"
              onClick={() => void endSession()}
              className="flex items-center gap-1.5 rounded-pill border border-border px-3 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-black/5"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

/** Live inactivity countdown — turns red in the last minute before auto sign-out. */
function IdleBadge({ msLeft, warning }: { msLeft: number; warning: boolean }) {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const mm = Math.floor(total / 60);
  const ss = String(total % 60).padStart(2, "0");

  return (
    <span
      className={`flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-[12px] font-semibold ${
        warning ? "bg-danger/10 text-danger" : "bg-black/[0.04] text-text-tertiary"
      }`}
    >
      <TimerReset size={14} />
      {warning ? `Signing out in ${mm}:${ss}` : `Session ${mm}:${ss}`}
    </span>
  );
}
