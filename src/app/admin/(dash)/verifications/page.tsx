"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, ShieldX } from "lucide-react";

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
import {
  useDecideVerificationMutation,
  useGetVerificationsQuery,
} from "@/store/api/adminApi";
import { formatRelativeTime } from "@/lib/format";
import type { ProfileType, VerificationItem } from "@/types/admin";

function errMessage(err: unknown, fallback: string): string {
  return (err as { data?: { message?: string } })?.data?.message ?? fallback;
}

const STATUS_TONE = {
  pending: "warning",
  verified: "success",
  rejected: "danger",
  unverified: "neutral",
} as const;

const HEAD = ["Applicant", "Phone", "Documents", "Waiting", "Status", ""] as const;

export default function VerificationsPage() {
  return (
    <Suspense fallback={null}>
      <Verifications />
    </Suspense>
  );
}

function Verifications() {
  const params = useSearchParams();
  const initialType = params.get("type") === "business" ? "business" : "worker";

  const [type, setType] = useState<ProfileType>(initialType);
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [review, setReview] = useState<VerificationItem | null>(null);

  const { data, isLoading, isFetching } = useGetVerificationsQuery({ type, status, page, limit: 10 });

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  const switchTo = (next: Partial<{ type: ProfileType; status: string }>) => {
    if (next.type) setType(next.type);
    if (next.status) setStatus(next.status);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Verifications"
        subtitle="Approve identity documents. A worker can't apply — and a business can't settle — until they're verified."
        action={
          <div className="flex gap-2">
            <Segmented
              value={type}
              onChange={(v) => switchTo({ type: v })}
              options={[
                { value: "worker" as const, label: "Workers" },
                { value: "business" as const, label: "Businesses" },
              ]}
            />
            <Segmented
              value={status}
              onChange={(v) => switchTo({ status: v })}
              options={[
                { value: "pending", label: "Pending" },
                { value: "verified", label: "Verified" },
                { value: "rejected", label: "Rejected" },
              ]}
            />
          </div>
        }
      />

      <Card>
        {isLoading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : items.length === 0 ? (
          <EmptyState
            message={
              status === "pending"
                ? "Queue is clear — nothing waiting on review."
                : `No ${status} ${type} profiles.`
            }
            icon={BadgeCheck}
          />
        ) : (
          <>
            <Table head={HEAD}>
              {items.map((item) => {
                const name =
                  type === "worker" ? item.full_name : item.business_name;
                const docs = documentsOf(item, type);
                return (
                  <Row key={item.id}>
                    <Cell className="font-semibold">
                      {name ?? <span className="text-text-tertiary">Unnamed</span>}
                      {type === "business" && item.business_type ? (
                        <span className="ml-2 text-[12px] font-normal text-text-tertiary">
                          {item.business_type}
                        </span>
                      ) : null}
                    </Cell>
                    <Cell className="text-text-secondary">{item.users?.phone ?? "—"}</Cell>
                    <Cell>
                      <span
                        className={`text-[12.5px] font-semibold ${
                          docs.length ? "text-ink" : "text-danger"
                        }`}
                      >
                        {docs.length ? `${docs.length} uploaded` : "None uploaded"}
                      </span>
                    </Cell>
                    <Cell className="text-text-secondary">
                      {formatRelativeTime(item.updated_at ?? item.created_at)}
                    </Cell>
                    <Cell>
                      <Pill tone={STATUS_TONE[item.verification_status]}>
                        {item.verification_status}
                      </Pill>
                    </Cell>
                    <Cell className="text-right">
                      <Button size="sm" variant="secondary" onClick={() => setReview(item)}>
                        Review
                      </Button>
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
        {isFetching && !isLoading ? (
          <p className="border-t border-border px-5 py-2 text-[12px] text-text-tertiary">
            Refreshing…
          </p>
        ) : null}
      </Card>

      <ReviewModal
        item={review}
        type={type}
        onClose={() => setReview(null)}
      />
    </>
  );
}

/** The KYC images on a profile, labelled — worker rows and business rows differ. */
function documentsOf(item: VerificationItem, type: ProfileType): { label: string; url: string }[] {
  const pairs: [string, string | null | undefined][] =
    type === "worker"
      ? [
          ["NID front", item.nid_front_url],
          ["NID back", item.nid_back_url],
          ["Selfie", item.selfie_url],
          ["Student ID", item.student_id_url],
        ]
      : [
          ["Trade licence", item.trade_license_url],
          ["Business doc", item.business_doc_url],
        ];

  return pairs
    .filter((pair): pair is [string, string] => Boolean(pair[1]))
    .map(([label, url]) => ({ label, url }));
}

/**
 * Document review. Approving flips the profile to `verified` (unlocking the
 * account); rejecting stores the note and tells the owner what to re-upload — so
 * the note is mandatory, and the backend rejects a noteless rejection anyway.
 */
function ReviewModal({
  item,
  type,
  onClose,
}: {
  item: VerificationItem | null;
  type: ProfileType;
  onClose: () => void;
}) {
  const [decide, { isLoading }] = useDecideVerificationMutation();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (decision: "approve" | "reject") => {
    if (!item) return;
    setError(null);
    if (decision === "reject" && note.trim().length === 0) {
      setError("Tell them what to fix — a note is required to reject.");
      return;
    }
    try {
      await decide({
        id: item.id,
        type,
        decision,
        note: note.trim() || undefined,
      }).unwrap();
      setNote("");
      onClose();
    } catch (err) {
      setError(errMessage(err, "Couldn't save the decision. Try again."));
    }
  };

  const docs = item ? documentsOf(item, type) : [];
  const name = item ? (type === "worker" ? item.full_name : item.business_name) : null;

  return (
    <Modal
      open={Boolean(item)}
      title={name ?? "Review profile"}
      onClose={onClose}
      width="max-w-3xl"
    >
      {item ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 text-[13px]">
            <Info label="Phone" value={item.users?.phone ?? "—"} />
            <Info label="Submitted" value={formatRelativeTime(item.created_at)} />
            <Info label="Status" value={item.verification_status} />
            <Info label="Last note" value={item.verification_note ?? "—"} />
          </div>

          {docs.length === 0 ? (
            <p className="rounded-input bg-danger/10 px-3.5 py-2.5 text-[12.5px] font-medium text-danger">
              No documents uploaded — reject with a note asking for them.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {docs.map((doc) => (
                <a
                  key={doc.label}
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="group overflow-hidden rounded-input border border-border"
                >
                  {/* Cloudinary-hosted KYC scans — plain <img> keeps them out of
                      the Next image optimizer, which would cache them on disk. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={doc.url}
                    alt={doc.label}
                    className="h-32 w-full bg-black/[0.03] object-cover transition-transform group-hover:scale-105"
                  />
                  <span className="block border-t border-border px-2.5 py-1.5 text-[11.5px] font-semibold text-ink">
                    {doc.label}
                  </span>
                </a>
              ))}
            </div>
          )}

          <Field
            label="Note"
            hint="Required when rejecting — the owner sees it in their notification."
          >
            <textarea
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. NID photo is blurry, please re-upload."
              className={`${inputClass} resize-none`}
            />
          </Field>

          <ErrorNote message={error} />

          <div className="flex justify-end gap-2">
            <Button variant="danger" loading={isLoading} onClick={() => submit("reject")}>
              <ShieldX size={15} /> Reject
            </Button>
            <Button loading={isLoading} onClick={() => submit("approve")}>
              <BadgeCheck size={15} /> Approve
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
      <p className="mt-0.5 font-semibold capitalize text-ink">{value}</p>
    </div>
  );
}
