"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Banknote,
  Briefcase,
  Building2,
  HandCoins,
  Landmark,
  ScrollText,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardHeader, PageHeader, Segmented, TableSkeleton } from "@/components/admin/ui";
import { useGetAdminAnalyticsQuery, useGetAdminDashboardQuery } from "@/store/api/adminApi";
import { formatTaka } from "@/lib/format";
import type { AdminDashboard } from "@/types/admin";

/**
 * Chart palette. Read off the theme tokens rather than hard-coded hexes so a
 * re-theme in globals.css carries into the graphs (Recharts needs real color
 * values, not Tailwind classes, hence the CSS-variable indirection).
 */
const C = {
  brand: "var(--color-brand)",
  ink: "var(--color-ink)",
  emerald: "var(--color-emerald)",
  sky: "var(--color-sky)",
  danger: "var(--color-danger)",
  border: "var(--color-border)",
  muted: "var(--color-text-tertiary)",
};

/** Short axis label — `2026-07-12` → `Jul 12`. */
const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

export default function AdminOverviewPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);

  const { data: dash, isLoading } = useGetAdminDashboardQuery();
  const { data: analytics, isFetching } = useGetAdminAnalyticsQuery({ days });

  const series = (analytics?.series ?? []).map((p) => ({ ...p, label: shortDate(p.date) }));

  return (
    <>
      <PageHeader
        title="Platform overview"
        subtitle="Live counters, work queues, and the last few weeks of activity."
        action={
          <Segmented
            value={days}
            onChange={(v) => setDays(v)}
            options={[
              { value: 7, label: "7 days" },
              { value: 30, label: "30 days" },
              { value: 90, label: "90 days" },
            ]}
          />
        }
      />

      {isLoading || !dash ? (
        <Card>
          <TableSkeleton rows={4} cols={4} />
        </Card>
      ) : (
        <>
          <ActionQueues dash={dash} />

          <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Stat
              icon={Users}
              label="Users"
              value={String(dash.users.total)}
              foot={`${dash.users.workers} workers · ${dash.users.businesses} businesses`}
            />
            <Stat
              icon={Briefcase}
              label="Shifts"
              value={String(dash.shifts.total)}
              foot={`${dash.shifts.open} open · ${dash.shifts.live} live`}
            />
            <Stat
              icon={Landmark}
              label="Escrow held"
              value={formatTaka(dash.money.escrow_held)}
              foot="Committed to unsettled shifts"
              tone="brand"
            />
            <Stat
              icon={HandCoins}
              label="Fee revenue"
              value={formatTaka(dash.money.platform_fee_collected)}
              foot={`Worker earnings ${formatTaka(dash.money.worker_earnings_total)}`}
              tone="emerald"
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Marketplace supply & demand"
                hint={isFetching ? "Refreshing…" : `Last ${days} days`}
              />
              <div className="h-[280px] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gSignups" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.sky} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={C.sky} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gShifts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={C.brand} stopOpacity={0.7} />
                        <stop offset="100%" stopColor={C.brand} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: C.muted }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: C.muted }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend iconType="circle" wrapperStyle={legendStyle} />
                    <Area
                      type="monotone"
                      dataKey="signups"
                      name="Signups"
                      stroke={C.sky}
                      fill="url(#gSignups)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="shifts_created"
                      name="Shifts posted"
                      stroke={C.ink}
                      fill="url(#gShifts)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardHeader title="Who's on the platform" />
              <div className="h-[280px] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Workers", value: dash.users.workers, fill: C.brand },
                        { name: "Businesses", value: dash.users.businesses, fill: C.ink },
                        { name: "Blocked", value: dash.users.blocked, fill: C.danger },
                      ].filter((d) => d.value > 0)}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={58}
                      outerRadius={92}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {[C.brand, C.ink, C.danger].map((fill) => (
                        <Cell key={fill} fill={fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend iconType="circle" wrapperStyle={legendStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader title="Money out vs. fee earned" hint="Taka per day" />
              <div className="h-[260px] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: C.muted }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: C.muted }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatTaka(Number(v))} />
                    <Legend iconType="circle" wrapperStyle={legendStyle} />
                    <Bar
                      dataKey="payouts_amount"
                      name="Worker payouts"
                      fill={C.emerald}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={26}
                    />
                    <Bar
                      dataKey="fee_amount"
                      name="Platform fee"
                      fill={C.brand}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={26}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <CardHeader title="Trust signal" hint="Disputes raised per day" />
              <div className="h-[260px] p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke={C.border} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: C.muted }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: C.muted }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="disputes_raised"
                      name="Disputes"
                      stroke={C.danger}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  fontSize: 12,
  boxShadow: "0 12px 30px -14px rgba(0,0,0,0.35)",
} as const;

const legendStyle = { fontSize: 12, paddingTop: 8 } as const;

/**
 * The queue strip — the first thing an admin should see, because these are the
 * only numbers that demand an action today. Each tile deep-links to its screen.
 */
function ActionQueues({ dash }: { dash: AdminDashboard }) {
  const p = dash.pending_review;
  const queues: {
    label: string;
    count: number;
    href: string;
    icon: LucideIcon;
    hint: string;
  }[] = [
    {
      label: "Worker KYC",
      count: p.worker_verifications,
      href: "/admin/verifications?type=worker",
      icon: BadgeCheck,
      hint: "Waiting on ID review",
    },
    {
      label: "Business KYC",
      count: p.business_verifications,
      href: "/admin/verifications?type=business",
      icon: Building2,
      hint: "Trade licence review",
    },
    {
      label: "Shift posts",
      count: p.shift_posts,
      href: "/admin/moderation",
      icon: ScrollText,
      hint: "Not visible until approved",
    },
    {
      label: "Open disputes",
      count: p.open_disputes,
      href: "/admin/disputes",
      icon: ShieldAlert,
      hint: "Payment frozen",
    },
    {
      label: "Handshakes",
      count: p.handshakes_awaiting_confirm,
      href: "/admin/disputes",
      icon: Activity,
      hint: "Awaiting confirm",
    },
    {
      label: "Payouts",
      count: 0,
      href: "/admin/payouts",
      icon: Banknote,
      hint: "Queue to disburse",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {queues.map((q) => {
        const Icon = q.icon;
        const hot = q.count > 0;
        return (
          <Link
            key={q.label}
            href={q.href}
            className={`group rounded-card border p-4 transition-colors ${
              hot
                ? "border-brand bg-brand-light/60 hover:bg-brand-light"
                : "border-border bg-surface hover:bg-black/[0.02]"
            }`}
          >
            <div className="flex items-center justify-between">
              <Icon size={17} className={hot ? "text-ink" : "text-text-tertiary"} />
              <ArrowRight
                size={14}
                className="text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100"
              />
            </div>
            <p className="mt-2.5 text-[22px] font-bold leading-none text-ink">{q.count}</p>
            <p className="mt-1.5 text-[12.5px] font-bold text-ink">{q.label}</p>
            <p className="text-[11px] text-text-tertiary">{q.hint}</p>
          </Link>
        );
      })}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  foot,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  foot: string;
  tone?: "neutral" | "brand" | "emerald";
}) {
  const chip =
    tone === "brand"
      ? "bg-brand text-ink"
      : tone === "emerald"
        ? "bg-emerald/10 text-emerald"
        : "bg-black/[0.05] text-text-secondary";

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${chip}`}>
          <Icon size={16} />
        </span>
        <span className="text-[12px] font-bold uppercase tracking-wide text-text-tertiary">
          {label}
        </span>
      </div>
      <p className="mt-3 text-[26px] font-bold leading-none text-ink">{value}</p>
      <p className="mt-1.5 text-[12px] text-text-secondary">{foot}</p>
    </Card>
  );
}
