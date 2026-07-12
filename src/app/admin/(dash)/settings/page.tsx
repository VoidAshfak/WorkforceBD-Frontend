"use client";

import { useState } from "react";
import { RotateCcw, Save, SlidersHorizontal } from "lucide-react";

import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorNote,
  PageHeader,
  Pill,
  TableSkeleton,
  inputClass,
} from "@/components/admin/ui";
import {
  useGetSettingsQuery,
  useResetSettingMutation,
  useUpdateSettingMutation,
} from "@/store/api/adminApi";
import type { PlatformSetting } from "@/types/admin";

function errMessage(err: unknown, fallback: string): string {
  return (err as { data?: { message?: string } })?.data?.message ?? fallback;
}

/**
 * Runtime platform constants. Edits apply without a redeploy — instantly in the
 * process that takes the write, within 60 seconds everywhere else. Fee changes
 * only affect **future** money: escrow already held keeps its submit-time rate.
 */
export default function SettingsPage() {
  const { data, isLoading } = useGetSettingsQuery();

  const settings = data ?? [];

  return (
    <>
      <PageHeader
        title="Platform settings"
        subtitle="Live constants. Changes take effect within a minute — no redeploy, no restart."
      />

      <Card>
        <CardHeader
          title="Tunable constants"
          hint={`${settings.filter((s) => s.is_overridden).length} overridden`}
        />
        {isLoading ? (
          <TableSkeleton rows={6} cols={3} />
        ) : settings.length === 0 ? (
          <EmptyState message="No tunable settings exposed." icon={SlidersHorizontal} />
        ) : (
          <ul className="divide-y divide-border">
            {settings.map((setting) => (
              <SettingRow key={setting.key} setting={setting} />
            ))}
          </ul>
        )}
      </Card>

      <p className="mt-3 text-[12px] text-text-tertiary">
        Escrow already held keeps the platform fee captured at its submit-time rate — a fee change
        only prices new shifts.
      </p>
    </>
  );
}

function SettingRow({ setting }: { setting: PlatformSetting }) {
  const [update, { isLoading: saving }] = useUpdateSettingMutation();
  const [reset, { isLoading: resetting }] = useResetSettingMutation();

  const [value, setValue] = useState(String(setting.value));
  const [error, setError] = useState<string | null>(null);

  const parsed = Number(value);
  const dirty = value !== String(setting.value);
  const outOfRange = !Number.isFinite(parsed) || parsed < setting.min || parsed > setting.max;

  const save = async () => {
    setError(null);
    if (outOfRange) {
      setError(`Value must be between ${setting.min} and ${setting.max}.`);
      return;
    }
    try {
      await update({ key: setting.key, value: parsed }).unwrap();
    } catch (err) {
      setError(errMessage(err, "Couldn't save the setting."));
    }
  };

  const revert = async () => {
    setError(null);
    try {
      const fresh = await reset(setting.key).unwrap();
      setValue(String(fresh.value));
    } catch (err) {
      setError(errMessage(err, "Couldn't reset the setting."));
    }
  };

  return (
    <li className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[13px] font-bold text-ink">{setting.key}</span>
          {setting.is_overridden ? <Pill tone="brand">overridden</Pill> : null}
        </div>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-snug text-text-secondary">
          {setting.description}
        </p>
        <p className="mt-1 text-[11.5px] text-text-tertiary">
          Default {setting.default} · allowed {setting.min}–{setting.max}
        </p>
        <ErrorNote message={error} />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={setting.min}
          max={setting.max}
          onChange={(e) => setValue(e.target.value)}
          className={`${inputClass} w-28 text-right`}
        />
        <Button size="sm" loading={saving} disabled={!dirty} onClick={save}>
          <Save size={14} /> Save
        </Button>
        {setting.is_overridden ? (
          <Button size="sm" variant="secondary" loading={resetting} onClick={revert}>
            <RotateCcw size={14} /> Default
          </Button>
        ) : null}
      </div>
    </li>
  );
}
