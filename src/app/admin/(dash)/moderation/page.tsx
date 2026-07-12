"use client";

import { useState } from "react";
import { CheckCircle2, ScrollText, XCircle } from "lucide-react";

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
import { useDecideShiftMutation, useGetModerationShiftsQuery } from "@/store/api/adminApi";
import { formatRelativeTime, formatShiftDate, formatTaka } from "@/lib/format";
import type { ModerationShift } from "@/types/admin";

function errMessage(err: unknown, fallback: string): string {
  return (err as { data?: { message?: string } })?.data?.message ?? fallback;
}

const HEAD = ["Shift", "Business", "Date", "Pay", "Workers", "Posted", ""] as const;

/**
 * Shift-post moderation. A post is invisible to workers until approved; a
 * rejection sends it back to `draft` **and refunds the business's escrow** in the
 * same transaction — so both decisions move money and neither is reversible here.
 */
export default function ModerationPage() {
  const [status, setStatus] = useState("pending_approval");
  const [page, setPage] = useState(1);
  const [review, setReview] = useState<ModerationShift | null>(null);

  const { data, isLoading } = useGetModerationShiftsQuery({ status, page });

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <>
      <PageHeader
        title="Shift posts"
        subtitle="Nothing reaches the worker feed until it's approved here."
        action={
          <Segmented
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { value: "pending_approval", label: "Awaiting review" },
              { value: "published", label: "Published" },
              { value: "draft", label: "Drafts" },
            ]}
          />
        }
      />

      <Card>
        {isLoading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : items.length === 0 ? (
          <EmptyState
            message={
              status === "pending_approval"
                ? "Queue is clear — no posts waiting for approval."
                : "Nothing here."
            }
            icon={ScrollText}
          />
        ) : (
          <>
            <Table head={HEAD}>
              {items.map((shift) => {
                const business = shift.business_profiles;
                const unverified = business?.verification_status !== "verified";
                return (
                  <Row key={shift.id}>
                    <Cell className="font-semibold">
                      {shift.title}
                      <span className="mt-0.5 block text-[11.5px] font-normal text-text-tertiary">
                        {shift.categories?.name ?? "—"} · {shift.zones?.name ?? "No zone"}
                      </span>
                    </Cell>
                    <Cell>
                      <span className="font-semibold text-ink">
                        {business?.business_name ?? "—"}
                      </span>
                      {unverified ? (
                        <span className="ml-2">
                          <Pill tone="danger">unverified</Pill>
                        </span>
                      ) : null}
                    </Cell>
                    <Cell className="text-text-secondary">{formatShiftDate(shift.shift_date)}</Cell>
                    <Cell className="font-bold">{formatTaka(shift.pay_amount)}</Cell>
                    <Cell className="text-text-secondary">{shift.workers_needed}</Cell>
                    <Cell className="text-text-secondary">
                      {formatRelativeTime(shift.created_at)}
                    </Cell>
                    <Cell className="text-right">
                      {status === "pending_approval" ? (
                        <Button size="sm" variant="secondary" onClick={() => setReview(shift)}>
                          Review
                        </Button>
                      ) : (
                        <Pill tone={shift.status === "published" ? "success" : "neutral"}>
                          {shift.status}
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

      <DecisionModal shift={review} onClose={() => setReview(null)} />
    </>
  );
}

function DecisionModal({
  shift,
  onClose,
}: {
  shift: ModerationShift | null;
  onClose: () => void;
}) {
  const [decide, { isLoading }] = useDecideShiftMutation();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (decision: "approve" | "reject") => {
    if (!shift) return;
    setError(null);
    if (decision === "reject" && note.trim().length === 0) {
      setError("A note is required to reject — the business needs to know what to change.");
      return;
    }
    try {
      await decide({ id: shift.id, decision, note: note.trim() || undefined }).unwrap();
      setNote("");
      onClose();
    } catch (err) {
      setError(errMessage(err, "Couldn't save the decision. Try again."));
    }
  };

  const cost = shift
    ? Number(shift.pay_amount) * shift.workers_needed
    : 0;

  return (
    <Modal open={Boolean(shift)} title={shift?.title ?? "Review post"} onClose={onClose}>
      {shift ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 rounded-input bg-black/[0.02] p-4 text-[13px]">
            <Info label="Business" value={shift.business_profiles?.business_name ?? "—"} />
            <Info label="Category" value={shift.categories?.name ?? "—"} />
            <Info label="Date" value={formatShiftDate(shift.shift_date)} />
            <Info label="Zone" value={shift.zones?.name ?? "—"} />
            <Info label="Pay per worker" value={formatTaka(shift.pay_amount)} />
            <Info label="Workers needed" value={String(shift.workers_needed)} />
          </div>

          <p className="text-[12.5px] leading-snug text-text-secondary">
            Approving publishes the post to the worker feed. Rejecting returns it to the business as
            a draft and <span className="font-semibold text-ink">refunds the held escrow</span> (
            {formatTaka(cost)} worker pay plus the platform fee).
          </p>

          <Field label="Note" hint="Required when rejecting.">
            <textarea
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Pay is below the category minimum."
              className={`${inputClass} resize-none`}
            />
          </Field>

          <ErrorNote message={error} />

          <div className="flex justify-end gap-2">
            <Button variant="danger" loading={isLoading} onClick={() => submit("reject")}>
              <XCircle size={15} /> Reject
            </Button>
            <Button loading={isLoading} onClick={() => submit("approve")}>
              <CheckCircle2 size={15} /> Approve & publish
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className="mt-0.5 font-semibold text-ink">{value}</p>
    </div>
  );
}
