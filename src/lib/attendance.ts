import type { Application } from "@/types/shift";

/**
 * Worker attendance can't be read from the raw `checked_in_at` / `checked_out_at`
 * stamps alone — they aren't reliably serialized (`GET /shifts/:id` carries none,
 * and the `GET /applications` row omits them in practice). Derive the booleans the
 * check-in/out buttons need from the always-present enriched fields
 * (`activity_status`, `next_action`, `completion_status`), falling back to any
 * stamps that happen to be present. Without this, a worker mid-shift sees "Check
 * in" again after a refresh instead of "Check out".
 */
export function deriveAttendance(record: Application | undefined | null): {
  checkedIn: boolean;
  checkedOut: boolean;
} {
  if (!record) return { checkedIn: false, checkedOut: false };
  const a = record.activity_status;
  const na = record.next_action;
  const cs = record.completion_status;

  const outByCompletion =
    cs === "worker_done" || cs === "business_done" || cs === "confirmed" || cs === "resolved";
  const checkedOut =
    Boolean(record.checked_out_at) ||
    outByCompletion ||
    na === "confirm_checkout" ||
    a === "awaiting_confirmation" ||
    a === "confirm_needed" ||
    a === "completed";
  const checkedIn =
    checkedOut ||
    Boolean(record.checked_in_at) ||
    na === "check_out" ||
    a === "in_progress" ||
    a === "disputed";
  return { checkedIn, checkedOut };
}
