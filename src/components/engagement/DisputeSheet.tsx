"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldAlert } from "lucide-react";

import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import { useRaiseDisputeMutation } from "@/store/api/engagementApi";
import { disputeSchema, type DisputeInput } from "@/lib/validation/engagement";

/** Pulls a human message off an RTK error, with a fallback. */
function errMessage(err: unknown, fallback: string): string {
  return (err as { data?: { message?: string } })?.data?.message ?? (err as Error)?.message ?? fallback;
}

/**
 * Raise-a-dispute sheet, shared by both parties (worker or business). Freezes the
 * assignment's completion handshake until an admin rules. The backend re-checks
 * party membership + assignment state and its message is surfaced on error.
 */
export default function DisputeSheet({
  open,
  assignmentId,
  title,
  hint,
  onClose,
  onDone,
}: {
  open: boolean;
  /** Roster assignment the dispute is filed against. */
  assignmentId: string;
  /** Shift title, shown for context. */
  title?: string;
  /** One-line lead-in tailored to the caller's side. */
  hint?: string;
  onClose: () => void;
  /** Called after a successful filing (with confirmation copy). */
  onDone: (message: string) => void;
}) {
  const [raise, { isLoading }] = useRaiseDisputeMutation();
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<DisputeInput>({
    resolver: zodResolver(disputeSchema),
    defaultValues: { assignment_id: assignmentId, description: "" },
  });

  // Keep the hidden assignment_id in sync when the sheet is reused across rows.
  const [prevId, setPrevId] = useState(assignmentId);
  if (assignmentId !== prevId) {
    setPrevId(assignmentId);
    reset({ assignment_id: assignmentId, description: "" });
  }

  const description = useWatch({ control, name: "description" }) ?? "";

  const close = () => {
    reset({ assignment_id: assignmentId, description: "" });
    setActionError(null);
    onClose();
  };

  const submit = handleSubmit(async (values) => {
    setActionError(null);
    try {
      await raise(values).unwrap();
      onDone("Dispute raised — payment is frozen until an admin resolves it.");
      reset({ assignment_id: assignmentId, description: "" });
    } catch (err) {
      setActionError(errMessage(err, "Couldn't raise the dispute. Try again."));
    }
  });

  return (
    <BottomSheet open={open} onClose={close} locked={isLoading} className="max-h-[88vh] overflow-y-auto">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
        <ShieldAlert size={22} />
      </span>
      <h2 className="text-[18px] font-bold text-ink">Raise a dispute</h2>
      <p className="mt-1 text-[13px] leading-5 text-text-secondary">
        {hint ?? "Tell us what went wrong."}
        {title ? <> · <span className="font-semibold text-ink">{title}</span></> : null}
      </p>

      <form onSubmit={submit} className="mt-5 space-y-4">
        <input type="hidden" {...register("assignment_id")} />

        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-ink">What happened?</label>
          <textarea
            rows={5}
            placeholder="Describe the issue in detail so an admin can resolve it fairly."
            {...register("description")}
            className="w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-[15px] text-ink outline-none focus:border-danger"
          />
          <div className="mt-1 flex items-center justify-between">
            {errors.description ? (
              <p className="text-[12px] font-medium text-danger">{errors.description.message}</p>
            ) : (
              <span className="text-[11px] text-text-tertiary">Minimum 10 characters</span>
            )}
            <span className="text-[11px] text-text-tertiary">{description.length}/2000</span>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-warning/10 px-3.5 py-2.5 text-[12px] text-text-secondary">
          <ShieldAlert size={14} className="mt-0.5 shrink-0 text-text-tertiary" />
          <span>Raising a dispute pauses the auto-confirm timer. No payment moves until an admin rules.</span>
        </div>

        {actionError ? <p className="text-[13px] font-medium text-danger">{actionError}</p> : null}

        <div className="flex flex-col gap-2.5 pt-1">
          <Button type="submit" fullWidth loading={isLoading} className="bg-danger text-white">
            <ShieldAlert size={18} /> Submit dispute
          </Button>
          <Button type="button" variant="ghost" fullWidth disabled={isLoading} onClick={close}>
            Cancel
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
