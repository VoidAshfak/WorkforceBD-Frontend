"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Landmark, Plus, Smartphone } from "lucide-react";

import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import { useTopupWalletMutation } from "@/store/api/businessApi";
import { topupSchema, type TopupFormInput, type TopupInput } from "@/lib/validation/business";
import { formatTaka } from "@/lib/format";

type Method = "bkash" | "nagad" | "bank_transfer";

const METHODS: { value: Method; label: string; icon: typeof Smartphone }[] = [
  { value: "bkash", label: "bKash", icon: Smartphone },
  { value: "nagad", label: "Nagad", icon: Smartphone },
  { value: "bank_transfer", label: "Bank", icon: Landmark },
];

const QUICK = [500, 1000, 2000, 5000];

/** Pulls a human message off an RTK error, with a fallback. */
function errMessage(err: unknown, fallback: string): string {
  return (err as { data?: { message?: string } })?.data?.message ?? (err as Error)?.message ?? fallback;
}

/**
 * Add-funds sheet. Placeholder funding (credited instantly, no external
 * capture); the backend re-checks the ৳100 minimum + verification and its
 * message is surfaced on error.
 */
export default function TopupSheet({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after a successful top-up (with confirmation copy). */
  onDone: (message: string) => void;
}) {
  const [topup, { isLoading }] = useTopupWalletMutation();
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors },
  } = useForm<TopupFormInput, unknown, TopupInput>({
    resolver: zodResolver(topupSchema),
    defaultValues: { method: "bkash", amount: "" },
  });

  const close = () => {
    reset();
    setActionError(null);
    onClose();
  };

  const submit = handleSubmit(async (values) => {
    setActionError(null);
    try {
      const wallet = await topup(values).unwrap();
      onDone(`Wallet topped up — balance ${formatTaka(wallet.balance)}.`);
      reset();
    } catch (err) {
      setActionError(errMessage(err, "Couldn't add funds. Try again."));
    }
  });

  return (
    <BottomSheet open={open} onClose={close} locked={isLoading} className="max-h-[88vh] overflow-y-auto">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand/25 text-ink">
        <Plus size={22} />
      </span>
      <h2 className="text-[18px] font-bold text-ink">Add funds</h2>
      <p className="mt-1 text-[13px] text-text-secondary">
        Funds cover shift escrow when you post · minimum ৳100
      </p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-ink">Amount</label>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 focus-within:border-ink">
            <span className="text-[16px] font-bold text-text-tertiary">৳</span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="0"
              {...register("amount")}
              className="h-[46px] w-full bg-transparent text-[16px] font-semibold text-ink outline-none"
            />
          </div>
          {errors.amount ? (
            <p className="mt-1 text-[12px] font-medium text-danger">{errors.amount.message}</p>
          ) : null}
          <div className="mt-2 flex gap-2">
            {QUICK.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setValue("amount", v, { shouldValidate: true })}
                className="flex-1 rounded-lg border border-border bg-surface py-1.5 text-[12px] font-bold text-text-secondary active:scale-95"
              >
                {formatTaka(v)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-ink">Pay with</label>
          <Controller
            control={control}
            name="method"
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-2">
                {METHODS.map((m) => {
                  const active = field.value === m.value;
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => field.onChange(m.value)}
                      className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-[13px] font-semibold transition-colors ${
                        active
                          ? "border-ink bg-ink text-white"
                          : "border-border bg-surface text-text-secondary"
                      }`}
                    >
                      <Icon size={16} />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            )}
          />
        </div>

        {actionError ? <p className="text-[13px] font-medium text-danger">{actionError}</p> : null}

        <div className="flex flex-col gap-2.5 pt-1">
          <Button type="submit" fullWidth loading={isLoading}>
            <Plus size={18} /> Add funds
          </Button>
          <Button type="button" variant="ghost" fullWidth disabled={isLoading} onClick={close}>
            Cancel
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
