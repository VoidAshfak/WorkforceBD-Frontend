"use client";

import { useState } from "react";
import { Banknote, Check, Copy, X } from "lucide-react";

import {
  Button,
  Card,
  Cell,
  EmptyState,
  ErrorNote,
  Field,
  Modal,
  PageHeader,
  Pager,
  Pill,
  Row,
  Segmented,
  Table,
  TableSkeleton,
  inputClass,
} from "@/components/admin/ui";
import { useDecidePayoutMutation, useGetAdminPayoutsQuery } from "@/store/api/adminApi";
import { formatRelativeTime, formatTaka } from "@/lib/format";
import type { AdminPayout } from "@/types/admin";

function errMessage(err: unknown, fallback: string): string {
  return (err as { data?: { message?: string } })?.data?.message ?? fallback;
}

const HEAD = ["Worker", "Method", "Account", "Amount", "Requested", ""] as const;

const STATUS_TONE = { pending: "warning", sent: "success", failed: "danger" } as const;

/**
 * Payout queue. The money is already held out of the worker's balance — approving
 * marks it sent (after the admin disburses by hand through bKash/Nagad/bank), and
 * rejecting credits it straight back to their wallet.
 */
export default function PayoutsPage() {
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<{ payout: AdminPayout; decision: "approve" | "reject" } | null>(
    null,
  );

  const { data, isLoading } = useGetAdminPayoutsQuery({ status, page });

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  const pendingTotal = items
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return (
    <>
      <PageHeader
        title="Payouts"
        subtitle={
          status === "pending" && items.length > 0
            ? `${formatTaka(pendingTotal)} waiting to be disbursed on this page.`
            : "Disburse worker withdrawals, then mark them sent."
        }
        action={
          <Segmented
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { value: "pending", label: "Pending" },
              { value: "sent", label: "Sent" },
              { value: "failed", label: "Failed" },
            ]}
          />
        }
      />

      <Card>
        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : items.length === 0 ? (
          <EmptyState
            message={status === "pending" ? "Nothing to disburse right now." : "Nothing here."}
            icon={Banknote}
          />
        ) : (
          <>
            <Table head={HEAD}>
              {items.map((p) => (
                <Row key={p.id}>
                  <Cell className="font-semibold">
                    {p.account_name}
                    <span className="mt-0.5 block text-[11.5px] font-normal text-text-tertiary">
                      {p.users_payout_requests_user_idTousers?.phone ?? "—"}
                    </span>
                  </Cell>
                  <Cell>
                    <Pill tone="info">{p.method}</Pill>
                  </Cell>
                  <Cell>
                    <AccountNumber value={p.account_number} />
                  </Cell>
                  <Cell className="text-[15px] font-bold">{formatTaka(p.amount)}</Cell>
                  <Cell className="text-text-secondary">{formatRelativeTime(p.created_at)}</Cell>
                  <Cell className="text-right">
                    {p.status === "pending" ? (
                      <span className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setActive({ payout: p, decision: "reject" })}
                        >
                          <X size={14} /> Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setActive({ payout: p, decision: "approve" })}
                        >
                          <Check size={14} /> Mark sent
                        </Button>
                      </span>
                    ) : (
                      <Pill tone={STATUS_TONE[p.status]}>{p.status}</Pill>
                    )}
                  </Cell>
                </Row>
              ))}
            </Table>
            {pagination ? (
              <Pager
                page={pagination.page}
                totalPages={pagination.total_pages}
                total={pagination.total}
                onPage={setPage}
              />
            ) : null}
          </>
        )}
      </Card>

      <DecisionModal target={active} onClose={() => setActive(null)} />
    </>
  );
}

/** Full account number with a copy button — the admin pastes it into the payment app. */
function AccountNumber({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context) — the number is on screen anyway.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="group inline-flex items-center gap-1.5 font-mono text-[13px] text-ink"
    >
      {value}
      {copied ? (
        <Check size={13} className="text-emerald" />
      ) : (
        <Copy size={13} className="text-text-tertiary opacity-0 group-hover:opacity-100" />
      )}
    </button>
  );
}

function DecisionModal({
  target,
  onClose,
}: {
  target: { payout: AdminPayout; decision: "approve" | "reject" } | null;
  onClose: () => void;
}) {
  const [decide, { isLoading }] = useDecidePayoutMutation();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const rejecting = target?.decision === "reject";

  const submit = async () => {
    if (!target) return;
    setError(null);
    if (rejecting && reason.trim().length === 0) {
      setError("Give the worker a reason — they'll see it.");
      return;
    }
    try {
      await decide({
        id: target.payout.id,
        decision: target.decision,
        failure_reason: rejecting ? reason.trim() : undefined,
      }).unwrap();
      setReason("");
      onClose();
    } catch (err) {
      setError(errMessage(err, "Couldn't update the payout. Try again."));
    }
  };

  return (
    <Modal
      open={Boolean(target)}
      title={rejecting ? "Reject payout" : "Mark payout sent"}
      onClose={onClose}
    >
      {target ? (
        <div className="space-y-5">
          <div className="rounded-input bg-black/[0.02] p-4 text-[13px]">
            <p className="text-[20px] font-bold text-ink">{formatTaka(target.payout.amount)}</p>
            <p className="mt-1 text-text-secondary">
              {target.payout.method} · {target.payout.account_number} ·{" "}
              {target.payout.account_name}
            </p>
          </div>

          <p className="text-[12.5px] leading-snug text-text-secondary">
            {rejecting
              ? "The held amount is credited straight back to the worker's wallet balance and they're notified."
              : "Confirm only after the money has actually left your payment account. This finalizes the worker's total withdrawn — it can't be undone."}
          </p>

          {rejecting ? (
            <Field label="Reason" hint="Shown to the worker.">
              <textarea
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. bKash number is invalid — please update and request again."
                className={`${inputClass} resize-none`}
              />
            </Field>
          ) : null}

          <ErrorNote message={error} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant={rejecting ? "danger" : "primary"}
              loading={isLoading}
              onClick={submit}
            >
              {rejecting ? "Reject & refund" : "Confirm sent"}
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
