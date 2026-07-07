"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2, Wallet } from "lucide-react";

import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import {
  useDeleteShiftMutation,
  useGetCancellationPreviewQuery,
} from "@/store/api/businessApi";
import { formatTaka } from "@/lib/format";
import type { CancellationPreview } from "@/types/business";

/** Human copy for each free-delete reason. */
const FREE_REASON: Record<string, string> = {
  no_workers_hired: "No workers are hired yet, so your full escrow is refunded.",
  shift_expired: "This shift has already expired, so your full escrow is refunded.",
  outside_notice_window: "You're cancelling outside the 24-hour notice window — full refund.",
};

/** Pulls a human message off an RTK error, with a fallback. */
function errMessage(err: unknown, fallback: string): string {
  return (err as { data?: { message?: string } })?.data?.message ?? (err as Error)?.message ?? fallback;
}

/**
 * Swipe-to-delete confirmation for an owned shift. Fetches the cancellation
 * preview on open (dry-run — moves no money), shows a free-refund note or a full
 * penalty breakdown with a warning, and only then executes
 * `DELETE /business/shifts/:id` (passing `acknowledge_penalty` when money moves).
 */
export default function CancelShiftSheet({
  open,
  shiftId,
  shiftTitle,
  onClose,
  onDeleted,
}: {
  open: boolean;
  shiftId: string | null;
  shiftTitle: string;
  onClose: () => void;
  /** Called after a successful delete (with the backend's confirmation copy). */
  onDeleted: (message: string) => void;
}) {
  const {
    data: preview,
    isFetching,
    isError,
    error,
  } = useGetCancellationPreviewQuery(shiftId ?? "", { skip: !open || !shiftId });
  const [deleteShift, { isLoading: deleting }] = useDeleteShiftMutation();
  const [actionError, setActionError] = useState<string | null>(null);

  const penalty = preview?.penalty_applies ? preview.penalty : null;

  const onConfirm = async () => {
    if (!shiftId || !preview) return;
    setActionError(null);
    try {
      const res = await deleteShift({
        id: shiftId,
        acknowledge_penalty: preview.penalty_applies,
      }).unwrap();
      onDeleted(res.message || "Shift removed");
    } catch (err) {
      setActionError(errMessage(err, "Couldn't delete the shift. Try again."));
    }
  };

  // Preview 409 (terminal state) → can't cancel; surface the reason, no confirm.
  const blocked = isError;

  return (
    <BottomSheet open={open} onClose={onClose} locked={deleting} className="max-h-[85vh] overflow-y-auto">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
        {penalty ? <AlertTriangle size={22} /> : <Trash2 size={22} />}
      </span>

      <h2 className="text-[18px] font-bold text-ink">
        {penalty ? "Cancel & compensate workers?" : "Delete this shift?"}
      </h2>
      <p className="mt-1 truncate text-[13px] font-medium text-text-secondary">{shiftTitle}</p>

      {isFetching ? (
        <div className="flex items-center gap-2 py-8 text-[14px] text-text-secondary">
          <Loader2 size={16} className="animate-spin" /> Calculating charges…
        </div>
      ) : blocked ? (
        <p className="mt-4 rounded-card bg-danger/5 p-3 text-[13px] font-medium text-danger">
          {errMessage(error, "This shift can no longer be cancelled.")}
        </p>
      ) : preview ? (
        <Breakdown preview={preview} penalty={penalty} />
      ) : null}

      {actionError ? <p className="mt-3 text-[13px] font-medium text-danger">{actionError}</p> : null}

      <div className="mt-6 flex flex-col gap-2.5">
        {!blocked && preview ? (
          <Button
            fullWidth
            loading={deleting}
            onClick={onConfirm}
            className="bg-danger text-white hover:opacity-90 active:opacity-80"
          >
            {penalty ? `Pay ${formatTaka(penalty.total_penalty)} & cancel` : "Delete shift"}
          </Button>
        ) : null}
        <Button variant="ghost" fullWidth disabled={deleting} onClick={onClose}>
          {blocked ? "Close" : "Keep shift"}
        </Button>
      </div>
    </BottomSheet>
  );
}

function Breakdown({
  preview,
  penalty,
}: {
  preview: CancellationPreview;
  penalty: CancellationPreview["penalty"];
}) {
  if (!penalty) {
    return (
      <div className="mt-4 space-y-3">
        <p className="text-[14px] leading-5 text-text-secondary">
          {FREE_REASON[preview.reason] ?? "No cancellation charge applies."}
        </p>
        <div className="flex items-center justify-between rounded-card border border-emerald/30 bg-emerald/5 px-3.5 py-3">
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-emerald">
            <Wallet size={15} /> Refunded to wallet
          </span>
          <span className="text-[15px] font-bold text-emerald">
            {formatTaka(preview.refund_to_business)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-start gap-2.5 rounded-card border border-danger/25 bg-danger/5 p-3">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-danger" />
        <p className="text-[13px] leading-5 text-text-muted">
          {preview.hired_count} worker{preview.hired_count === 1 ? "" : "s"} already hired. Cancelling
          {preview.hours_to_start > 0 ? ` ${preview.hours_to_start.toFixed(1)}h before start` : " now"} pays
          each a compensation from your escrow. This can&apos;t be undone.
        </p>
      </div>

      {/* Per-worker compensation */}
      <ul className="divide-y divide-border rounded-card border border-border">
        {penalty.workers.map((w) => (
          <li key={w.worker_profile_id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-ink">{w.full_name ?? "Worker"}</p>
              <p className="text-[11px] text-text-tertiary">{Math.round(w.rate * 100)}% of pay</p>
            </div>
            <span className="shrink-0 text-[14px] font-bold text-danger">{formatTaka(w.amount)}</span>
          </li>
        ))}
      </ul>

      {/* Totals */}
      <div className="space-y-1.5 rounded-card border border-border bg-black/[0.02] px-3.5 py-3 text-[13px]">
        <Row label="Escrow held" value={formatTaka(preview.escrow_amount)} />
        <Row label="Paid to workers" value={`− ${formatTaka(penalty.total_penalty)}`} tone="text-danger" />
        <div className="flex items-center justify-between border-t border-border pt-1.5">
          <span className="font-semibold text-ink">Back to your wallet</span>
          <span className="font-bold text-emerald">{formatTaka(preview.refund_to_business)}</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-secondary">{label}</span>
      <span className={`font-semibold ${tone ?? "text-ink"}`}>{value}</span>
    </div>
  );
}
