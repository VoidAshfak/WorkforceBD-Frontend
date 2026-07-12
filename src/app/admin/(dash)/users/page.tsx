"use client";

import { useEffect, useState } from "react";
import { Ban, RotateCcw, Search, Users as UsersIcon } from "lucide-react";

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
  useBlockUserMutation,
  useGetAdminUserQuery,
  useGetAdminUsersQuery,
  useUnblockUserMutation,
} from "@/store/api/adminApi";
import { formatRelativeTime, formatTaka } from "@/lib/format";
import type { AdminUserRow } from "@/types/admin";

function errMessage(err: unknown, fallback: string): string {
  return (err as { data?: { message?: string } })?.data?.message ?? fallback;
}

const HEAD = ["User", "Roles", "Verification", "Reliability", "Joined", ""] as const;

/** Display name for a row — the account's `full_name` is usually null. */
function nameOf(u: AdminUserRow): string {
  return (
    u.worker_profiles?.full_name ??
    u.business_profiles?.business_name ??
    u.full_name ??
    "Unnamed"
  );
}

export default function UsersPage() {
  const [role, setRole] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Debounce the search so a fast typist doesn't fire a request per keystroke.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useGetAdminUsersQuery({
    role,
    status,
    search: query || undefined,
    page,
    limit: 10,
  });

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Everyone on the platform. Blocking is account-wide — a dual-role user loses both sides."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={role}
              onChange={(v) => {
                setRole(v);
                setPage(1);
              }}
              options={[
                { value: undefined, label: "All" },
                { value: "worker", label: "Workers" },
                { value: "business", label: "Businesses" },
                { value: "admin", label: "Admins" },
              ]}
            />
            <Segmented
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              options={[
                { value: undefined, label: "Any" },
                { value: "active", label: "Active" },
                { value: "blocked", label: "Blocked" },
              ]}
            />
          </div>
        }
      />

      <Card>
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <Search size={16} className="text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search phone, name, email, or business…"
            className="w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-text-tertiary"
          />
        </div>

        {isLoading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : items.length === 0 ? (
          <EmptyState message="No users match those filters." icon={UsersIcon} />
        ) : (
          <>
            <Table head={HEAD}>
              {items.map((u) => {
                const verification =
                  u.worker_profiles?.verification_status ??
                  u.business_profiles?.verification_status;
                const score = u.worker_profiles?.reliability_score;
                return (
                  <Row key={u.id}>
                    <Cell className="font-semibold">
                      {nameOf(u)}
                      <span className="mt-0.5 block text-[11.5px] font-normal text-text-tertiary">
                        {u.phone}
                      </span>
                    </Cell>
                    <Cell>
                      <span className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Pill key={r} tone={r === "admin" ? "brand" : "neutral"}>
                            {r}
                          </Pill>
                        ))}
                      </span>
                    </Cell>
                    <Cell>
                      {verification ? (
                        <Pill
                          tone={
                            verification === "verified"
                              ? "success"
                              : verification === "rejected"
                                ? "danger"
                                : "warning"
                          }
                        >
                          {verification}
                        </Pill>
                      ) : (
                        <span className="text-text-tertiary">—</span>
                      )}
                    </Cell>
                    <Cell className="text-text-secondary">
                      {score ? `${Number(score).toFixed(1)} / 5` : "—"}
                    </Cell>
                    <Cell className="text-text-secondary">{formatRelativeTime(u.created_at)}</Cell>
                    <Cell className="text-right">
                      <span className="flex items-center justify-end gap-2">
                        {!u.is_active ? <Pill tone="danger">blocked</Pill> : null}
                        <Button size="sm" variant="secondary" onClick={() => setDetailId(u.id)}>
                          Open
                        </Button>
                      </span>
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

      <UserDetail id={detailId} onClose={() => setDetailId(null)} />
    </>
  );
}

/** Full user record with sanction history, plus the block/unblock action. */
function UserDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: user, isLoading } = useGetAdminUserQuery(id ?? "", { skip: !id });
  const [block, { isLoading: blocking }] = useBlockUserMutation();
  const [unblock, { isLoading: unblocking }] = useUnblockUserMutation();

  const [reason, setReason] = useState("");
  const [severity, setSeverity] = useState("high");
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.roles.includes("admin") ?? false;

  const doBlock = async () => {
    if (!user) return;
    setError(null);
    if (reason.trim().length === 0) {
      setError("A reason is required — it's stored on the sanction.");
      return;
    }
    try {
      await block({ id: user.id, reason: reason.trim(), severity }).unwrap();
      setReason("");
    } catch (err) {
      setError(errMessage(err, "Couldn't block the user."));
    }
  };

  const doUnblock = async () => {
    if (!user) return;
    setError(null);
    try {
      await unblock({ id: user.id, note: reason.trim() || undefined }).unwrap();
      setReason("");
    } catch (err) {
      setError(errMessage(err, "Couldn't unblock the user."));
    }
  };

  return (
    <Modal
      open={Boolean(id)}
      title={user ? nameOf(user) : "User"}
      onClose={onClose}
      width="max-w-2xl"
    >
      {isLoading || !user ? (
        <TableSkeleton rows={4} cols={2} />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 rounded-input bg-black/[0.02] p-4 text-[13px] md:grid-cols-4">
            <Info label="Phone" value={user.phone} />
            <Info label="Status" value={user.is_active ? "Active" : "Blocked"} />
            <Info
              label="Completed"
              value={String(user.worker_profiles?.completed_shift_count ?? 0)}
            />
            <Info label="No-shows" value={String(user.worker_profiles?.no_show_count ?? 0)} />
            <Info
              label="Reliability"
              value={
                user.worker_profiles?.reliability_score
                  ? `${Number(user.worker_profiles.reliability_score).toFixed(1)} / 5`
                  : "—"
              }
            />
            <Info label="Wallet" value={formatTaka(user.wallets?.balance ?? 0)} />
            <Info label="Earned" value={formatTaka(user.wallets?.total_earned ?? 0)} />
            <Info label="Joined" value={formatRelativeTime(user.created_at)} />
          </div>

          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-text-tertiary">
              Sanction history
            </p>
            {user.sanctions.length === 0 ? (
              <p className="text-[13px] text-text-secondary">Clean record — no sanctions.</p>
            ) : (
              <ul className="space-y-2">
                {user.sanctions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-start justify-between gap-3 rounded-input border border-border px-3.5 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-ink">{s.reason}</span>
                      <span className="block text-[11.5px] text-text-tertiary">
                        {s.sanction_type} · {s.severity} · {formatRelativeTime(s.created_at)}
                      </span>
                    </span>
                    <Pill tone={s.is_active ? "danger" : "neutral"}>
                      {s.is_active ? "active" : "closed"}
                    </Pill>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isAdmin ? (
            <p className="rounded-input bg-black/[0.03] px-3.5 py-2.5 text-[12.5px] text-text-secondary">
              Admin accounts can&apos;t be blocked from the console.
            </p>
          ) : (
            <>
              <Field
                label={user.is_active ? "Reason for blocking" : "Note (optional)"}
                hint={
                  user.is_active
                    ? "Blocking deactivates the account and kills every live session immediately."
                    : "Included in the notification telling them they're back."
                }
              >
                <textarea
                  rows={2}
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    user.is_active
                      ? "e.g. Repeated no-shows after being warned."
                      : "e.g. Appeal upheld."
                  }
                  className={`${inputClass} resize-none`}
                />
              </Field>

              {user.is_active ? (
                <Field label="Severity">
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className={inputClass}
                  >
                    {["low", "medium", "high", "critical"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}

              <ErrorNote message={error} />

              <div className="flex justify-end">
                {user.is_active ? (
                  <Button variant="danger" loading={blocking} onClick={doBlock}>
                    <Ban size={15} /> Block user
                  </Button>
                ) : (
                  <Button loading={unblocking} onClick={doUnblock}>
                    <RotateCcw size={15} /> Unblock user
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      )}
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
