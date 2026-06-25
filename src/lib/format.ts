/**
 * Display formatters for shift data. Centralized so currency, date, and time
 * rendering stay consistent across the feed, detail, and home screens.
 */

const TAKA = "৳";

/** All real (instant) timestamps render in Bangladesh Standard Time (UTC+6). */
const DHAKA_TZ = "Asia/Dhaka";

/**
 * Calendar date → epoch ms at UTC midnight, for tz-stable date math. Accepts a
 * plain `YYYY-MM-DD` or a full ISO datetime (`2026-07-04T00:00:00.000Z`) — only
 * the date portion is used.
 */
function ymdToUTC(date: string): number {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Today's calendar date in Dhaka as `YYYY-MM-DD` (host-timezone independent). */
function dhakaTodayYMD(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DHAKA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** `"1500"` → `"৳1,500"`. Accepts string or number; tolerates junk. */
export function formatTaka(amount: string | number): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return `${TAKA}0`;
  return `${TAKA}${Math.round(n).toLocaleString("en-US")}`;
}

/**
 * Friendly shift date relative to today in Bangladesh: `Today`, `Tomorrow`, else
 * `Sat, 20 Jun`. Input is a `YYYY-MM-DD` calendar string; "today" is resolved in
 * Dhaka time so the label is correct regardless of the device's timezone.
 */
export function formatShiftDate(date: string): string {
  const dUTC = ymdToUTC(date);
  if (Number.isNaN(dUTC)) return date;

  const diffDays = Math.round((dUTC - ymdToUTC(dhakaTodayYMD())) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  // Format the calendar date itself — read it in UTC so it isn't shifted a day.
  return new Date(dUTC).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * The API returns shift times as time-only values on the `1970-01-01` epoch
 * date (ISO UTC). Read the UTC time portion only and format as 12-hour.
 */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const meridiem = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const mm = m.toString().padStart(2, "0");
  return `${h}:${mm} ${meridiem}`;
}

/** `"6:00 AM – 2:00 PM"` from the two epoch-time ISO strings. */
export function formatTimeRange(start: string, end: string): string {
  const a = formatTime(start);
  const b = formatTime(end);
  return a && b ? `${a} – ${b}` : a || b;
}

/**
 * Formats a real UTC timestamp (e.g. `checked_in_at`) as a 12-hour time in
 * Bangladesh time — e.g. `"6:00 PM"`. Use this for true instants, NOT for the
 * epoch-time shift values (those are wall-clock already; use {@link formatTime}).
 */
export function formatInstantTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DHAKA_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/**
 * Compact "time ago" for feed timestamps: `Now`, `5m`, `3h`, `2d`, else a
 * short date like `17 Jun`. Input is a full ISO datetime.
 */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));

  if (seconds < 60) return "Now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(then).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: DHAKA_TZ,
  });
}
