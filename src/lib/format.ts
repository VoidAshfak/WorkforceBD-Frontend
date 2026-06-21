/**
 * Display formatters for shift data. Centralized so currency, date, and time
 * rendering stay consistent across the feed, detail, and home screens.
 */

const TAKA = "৳";

/** `"1500"` → `"৳1,500"`. Accepts string or number; tolerates junk. */
export function formatTaka(amount: string | number): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return `${TAKA}0`;
  return `${TAKA}${Math.round(n).toLocaleString("en-US")}`;
}

/**
 * Friendly shift date relative to today: `Today`, `Tomorrow`, else `Sat, 20 Jun`.
 * Input is a `YYYY-MM-DD` string.
 */
export function formatShiftDate(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
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
