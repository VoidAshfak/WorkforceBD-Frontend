"use client";

import { useState } from "react";
import { Gavel, ShieldAlert } from "lucide-react";

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
import { useGetAdminDisputesQuery, useRuleDisputeMutation } from "@/store/api/adminApi";
import { formatInstantTime, formatRelativeTime, formatTaka } from "@/lib/format";
import type { AdminDispute } from "@/types/admin";

function errMessage(err: unknown, fallback: string): string {
  return (err as { data?: { message?: string } })?.data?.message ?? fallback;
}

const HEAD = ["Shift", "Worker", "Business", "Attendance", "Pay", "Raised", ""] as const;

type Decision = "pay_full" | "pay_partial" | "deny";

/**
 * Dispute queue. An open dispute freezes the assignment's payment — the escrow
 * sits held and neither side can move until a ruling lands here, so this queue is
 * the platform's bottleneck for trust.
 */
export default function DisputesPage() {
  const [status, setStatus] = useState("open");
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<AdminDispute | null>(null);

  const { data, isLoading } = useGetAdminDisputesQuery({ status, page });

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <>
      <PageHeader
        title="Disputes"
        subtitle="Payment is frozen while a dispute is open. Rule to release it."
        action={
          <Segmented
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { value: "open", label: "Open" },
              { value: "under_review", label: "Under review" },
              { value: "resolved", label: "Resolved" },
              { value: "dismissed", label: "Dismissed" },
            ]}
          />
        }
      />

      <Card>
        {isLoading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : items.length === 0 ? (
          <EmptyState
            message={status === "open" ? "No open disputes — money is flowing." : "Nothing here."}
            icon={ShieldAlert}
          />
        ) : (
          <>
            <Table head={HEAD}>
              {items.map((d) => {
                const a = d.worker_assignments;
                return (
                  <Row key={d.id}>
                    <Cell className="font-semibold">
                      {d.shifts?.title ?? "—"}
                      <span className="mt-0.5 block max-w-[280px] truncate text-[11.5px] font-normal text-text-tertiary">
                        {d.description}
                      </span>
                    </Cell>
                    <Cell className="text-text-secondary">{d.worker?.full_name ?? "—"}</Cell>
                    <Cell className="text-text-secondary">{d.business?.business_name ?? "—"}</Cell>
                    <Cell className="text-[12px] text-text-secondary">
                      {a?.checked_in_at ? `In ${formatInstantTime(a.checked_in_at)}` : "No check-in"}
                      <span className="block">
                        {a?.checked_out_at
                          ? `Out ${formatInstantTime(a.checked_out_at)}`
                          : "No check-out"}
                      </span>
                    </Cell>
                    <Cell className="font-bold">{formatTaka(d.shifts?.pay_amount ?? 0)}</Cell>
                    <Cell className="text-text-secondary">{formatRelativeTime(d.created_at)}</Cell>
                    <Cell className="text-right">
                      {d.status === "open" || d.status === "under_review" ? (
                        <Button size="sm" onClick={() => setActive(d)}>
                          <Gavel size={14} /> Rule
                        </Button>
                      ) : (
                        <Pill tone={d.status === "resolved" ? "success" : "neutral"}>
                          {d.decision ?? d.status}
                        </Pill>
                      )}
                    </Cell>
                  </Row>
                );
              })}
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

      <RulingModal dispute={active} onClose={() => setActive(null)} />
    </>
  );
}

/**
 * The ruling is executed atomically by the backend: it pays the worker, settles
 * the escrow slice, unfreezes the assignment, notifies both parties, and closes
 * the shift if this was the last open handshake. There is no undo, so the modal
 * spells out the money consequence before the button.
 */
function RulingModal({
  dispute,
  onClose,
}: {
  dispute: AdminDispute | null;
  onClose: () => void;
}) {
  const [rule, { isLoading }] = useRuleDisputeMutation();
  const [decision, setDecision] = useState<Decision>("pay_full");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pay = Number(dispute?.shifts?.pay_amount ?? 0);
  const partial = Number(amount);

  const submit = async () => {
    if (!dispute) return;
    setError(null);

    if (note.trim().length === 0) {
      setError("Explain the ruling — both parties see this note.");
      return;
    }
    if (decision === "pay_partial" && !(partial > 0 && partial < pay)) {
      setError(`A partial amount must be between 0 and the shift pay (${formatTaka(pay)}).`);
      return;
    }

    try {
      await rule({
        id: dispute.id,
        decision,
        amount: decision === "pay_partial" ? partial : undefined,
        resolution_note: note.trim(),
      }).unwrap();
      setNote("");
      setAmount("");
      setDecision("pay_full");
      onClose();
    } catch (err) {
      setError(errMessage(err, "Couldn't record the ruling. Try again."));
    }
  };

  const payout =
    decision === "pay_full" ? pay : decision === "pay_partial" ? partial || 0 : 0;

  return (
    <Modal open={Boolean(dispute)} title="Rule on dispute" onClose={onClose} width="max-w-2xl">
      {dispute ? (
        <div className="space-y-5">
          <div className="rounded-input bg-black/[0.02] p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-text-tertiary">
              What was reported
            </p>
            <p className="mt-1.5 text-[13.5px] leading-snug text-ink">{dispute.description}</p>
            <p className="mt-3 text-[12px] text-text-tertiary">
              {dispute.shifts?.title} · {dispute.worker?.full_name ?? "worker"} vs{" "}
              {dispute.business?.business_name ?? "business"} · shift pay{" "}
              <span className="font-bold text-ink">{formatTaka(pay)}</span>
            </p>
          </div>

          <Field label="Decision">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { value: "pay_full", label: "Pay in full", hint: formatTaka(pay) },
                  { value: "pay_partial", label: "Pay partial", hint: "Split the difference" },
                  { value: "deny", label: "Deny", hint: "৳0 to the worker" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDecision(opt.value)}
                  className={`rounded-input border px-3 py-2.5 text-left transition-colors ${
                    decision === opt.value
                      ? "border-ink bg-brand-light"
                      : "border-border hover:bg-black/[0.02]"
                  }`}
                >
                  <span className="block text-[13px] font-bold text-ink">{opt.label}</span>
                  <span className="block text-[11px] text-text-tertiary">{opt.hint}</span>
                </button>
              ))}
            </div>
          </Field>

          {decision === "pay_partial" ? (
            <Field label="Amount to pay the worker" hint={`Must be above 0 and below ${formatTaka(pay)}.`}>
              <input
                type="number"
                min={1}
                max={Math.max(1, pay - 1)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputClass}
                placeholder="e.g. 600"
              />
            </Field>
          ) : null}

          <Field label="Resolution note" hint="Both parties see this. Say why.">
            <textarea
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Attendance log confirms the worker was on site for the full shift."
              className={`${inputClass} resize-none`}
            />
          </Field>

          <p className="rounded-input bg-warning/20 px-3.5 py-2.5 text-[12.5px] leading-snug text-text-muted">
            This pays the worker <span className="font-bold text-ink">{formatTaka(payout)}</span> and
            returns the rest of the escrow slice to the business. It settles immediately and can&apos;t
            be undone.
            {dispute.worker_assignments?.completion_status === "no_show"
              ? " This assignment was marked a no-show, so its escrow was already refunded — paying now charges the amount plus its platform fee back to the business wallet."
              : ""}
          </p>

          <ErrorNote message={error} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={isLoading} onClick={submit}>
              <Gavel size={15} /> Execute ruling
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
