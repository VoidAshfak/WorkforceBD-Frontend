"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Banknote, Landmark, Smartphone, Wallet } from "lucide-react";

import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import { useRequestPayoutMutation } from "@/store/api/paymentsApi";
import { payoutSchema, type PayoutFormInput, type PayoutInput } from "@/lib/validation/payments";
import { formatTaka } from "@/lib/format";
import type { PayoutMethod } from "@/types/payments";

const METHODS: { value: PayoutMethod; label: string; icon: typeof Smartphone }[] = [
  { value: "bkash", label: "bKash", icon: Smartphone },
  { value: "nagad", label: "Nagad", icon: Smartphone },
  { value: "bank_transfer", label: "Bank", icon: Landmark },
];

/** Pulls a human message off an RTK error, with a fallback. */
function errMessage(err: unknown, fallback: string): string {
  return (err as { data?: { message?: string } })?.data?.message ?? (err as Error)?.message ?? fallback;
}

/**
 * Withdrawal request sheet. The amount is held (debited) immediately on the
 * backend, so the balance is passed in to cap the request client-side; the
 * backend re-checks balance + verification and its message is surfaced on error.
 */
export default function PayoutSheet({
  open,
  balance,
  onClose,
  onDone,
}: {
  open: boolean;
  /** Withdrawable balance (decimal string) — caps the amount field. */
  balance: string;
  onClose: () => void;
  /** Called after a successful request (with confirmation copy). */
  onDone: (message: string) => void;
}) {
  const [requestPayout, { isLoading }] = useRequestPayoutMutation();
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<PayoutFormInput, unknown, PayoutInput>({
    resolver: zodResolver(payoutSchema),
    defaultValues: { method: "bkash", amount: "", account_number: "", account_name: "" },
  });

  const max = Number(balance);

  const close = () => {
    reset();
    setActionError(null);
    onClose();
  };

  const submit = handleSubmit(async (values) => {
    setActionError(null);
    if (values.amount > max) {
      setActionError(`You can withdraw up to ${formatTaka(balance)}.`);
      return;
    }
    try {
      await requestPayout(values).unwrap();
      onDone("Withdrawal requested — you'll be notified once it's sent.");
      reset();
    } catch (err) {
      setActionError(errMessage(err, "Couldn't request the payout. Try again."));
    }
  });

  return (
    <BottomSheet open={open} onClose={close} locked={isLoading} className="max-h-[88vh] overflow-y-auto">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald/10 text-emerald">
        <Wallet size={22} />
      </span>
      <h2 className="text-[18px] font-bold text-ink">Withdraw earnings</h2>
      <p className="mt-1 text-[13px] text-text-secondary">
        {formatTaka(balance)} available · minimum ৳50
      </p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-ink">Amount</label>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 focus-within:border-emerald">
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
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-ink">Send to</label>
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

        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-ink">Account number</label>
          <input
            inputMode="numeric"
            placeholder="01XXXXXXXXX"
            {...register("account_number")}
            className="h-[46px] w-full rounded-xl border border-border bg-surface px-4 text-[15px] text-ink outline-none focus:border-emerald"
          />
          {errors.account_number ? (
            <p className="mt-1 text-[12px] font-medium text-danger">{errors.account_number.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-ink">
            Account name <span className="font-normal text-text-tertiary">(optional)</span>
          </label>
          <input
            placeholder="As registered"
            {...register("account_name")}
            className="h-[46px] w-full rounded-xl border border-border bg-surface px-4 text-[15px] text-ink outline-none focus:border-emerald"
          />
        </div>

        {actionError ? <p className="text-[13px] font-medium text-danger">{actionError}</p> : null}

        <div className="flex flex-col gap-2.5 pt-1">
          <Button type="submit" fullWidth loading={isLoading}>
            <Banknote size={18} /> Request withdrawal
          </Button>
          <Button type="button" variant="ghost" fullWidth disabled={isLoading} onClick={close}>
            Cancel
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
