"use client";

import { useState } from "react";
import { Scanner, type IDetectedBarcode } from "@yudiel/react-qr-scanner";
import { Loader2, MapPin, QrCode, ScanLine } from "lucide-react";

import BottomSheet from "@/components/ui/BottomSheet";
import { useCheckInMutation } from "@/store/api/shiftsApi";
import type { CheckInMethod, Coordinates } from "@/types/shift";

/** Reads the device's current position for the check-in geofence proof. */
function getPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location isn't available on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          // Backend rejects accuracy worse than 100m; send it so it can guard.
          accuracy: pos.coords.accuracy,
        }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Enable location access to check in"
              : "Couldn't get your location. Try again.",
          ),
        ),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
}

/** Pulls a human message off an RTK/error object, with a fallback. */
function errMessage(err: unknown, fallback: string): string {
  return (
    (err as { data?: { message?: string } })?.data?.message ?? (err as Error)?.message ?? fallback
  );
}

type Step = "choose" | "scan";

/**
 * Live-attendance check-in sheet for an accepted shift. Both methods prove
 * presence with the GPS geofence (`coordinates`); QR layers the business's
 * rotating on-site code on top. Self-contained: it reads the device position,
 * scans the QR with the camera, runs the mutation, and reports the stamp back
 * via {@link onCheckedIn}. See /docs/api-guidelines.md → check-in.
 */
export default function CheckInSheet({
  open,
  onClose,
  applicationId,
  onCheckedIn,
}: {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  /** Called with `checked_in_at` once check-in succeeds. */
  onCheckedIn: (checkedInAt: string) => void;
}) {
  const [checkIn, { isLoading }] = useCheckInMutation();
  const [step, setStep] = useState<Step>("choose");
  const [error, setError] = useState<string | null>(null);
  // Local "busy" covers the position fetch too (before the mutation fires).
  const [busy, setBusy] = useState(false);
  const submitting = busy || isLoading;

  // Reset to a clean state whenever the sheet (re)opens — an adjust-state-on-
  // prop-change during render (not an effect), so it converges before paint.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setStep("choose");
      setError(null);
      setBusy(false);
    }
  }

  const submit = async (method: CheckInMethod, qr_token?: string) => {
    setError(null);
    setBusy(true);
    try {
      const coordinates = await getPosition();
      const res = await checkIn({ id: applicationId, method, coordinates, qr_token }).unwrap();
      onCheckedIn(res.checked_in_at);
      onClose();
    } catch (err) {
      setError(errMessage(err, "Check-in failed. Try again."));
      // Drop back to the chooser so the (now-stale) camera frame isn't left up.
      setStep("choose");
    } finally {
      setBusy(false);
    }
  };

  const onScan = (codes: IDetectedBarcode[]) => {
    if (submitting) return;
    const token = codes[0]?.rawValue?.trim();
    if (!token) return;
    submit("qr", token);
  };

  return (
    <BottomSheet open={open} onClose={onClose} locked={submitting}>
      <h2 className="text-[18px] font-bold text-ink">
        {step === "scan" ? "Scan the check-in code" : "Check in to this shift"}
      </h2>
      <p className="mt-1.5 text-[14px] leading-5 text-text-secondary">
        {step === "scan"
          ? "Point your camera at the code on the business's screen. You must be at the shift location."
          : "You must be within 200m of the shift. Choose how to confirm you're on site."}
      </p>

      {step === "choose" ? (
        <div className="mt-5 flex flex-col gap-2.5">
          <MethodButton
            icon={MapPin}
            title="Use my location"
            subtitle="Check in with GPS"
            loading={busy}
            disabled={submitting}
            onClick={() => submit("gps")}
          />
          <MethodButton
            icon={QrCode}
            title="Scan QR code"
            subtitle="The business shows a rotating code on site"
            disabled={submitting}
            onClick={() => {
              setError(null);
              setStep("scan");
            }}
          />
        </div>
      ) : (
        <div className="mt-5">
          <div className="relative overflow-hidden rounded-[20px] border border-border bg-black">
            <Scanner
              onScan={onScan}
              onError={(err) =>
                setError(errMessage(err, "Couldn't start the camera. Check permissions."))
              }
              formats={["qr_code"]}
              constraints={{ facingMode: "environment" }}
              paused={submitting}
              components={{ finder: false }}
              styles={{ container: { width: "100%", aspectRatio: "1 / 1" } }}
            />
            {/* Framing reticle. */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-2/3 w-2/3 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            {submitting ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
                <Loader2 size={26} className="animate-spin" />
              </div>
            ) : null}
          </div>

          <button
            type="button"
            disabled={submitting}
            onClick={() => setStep("choose")}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 text-[14px] font-semibold text-ink active:scale-[0.99] disabled:opacity-50"
          >
            <ScanLine size={16} /> Use location instead
          </button>
        </div>
      )}

      {error ? <p className="mt-3 text-[13px] font-medium text-danger">{error}</p> : null}
    </BottomSheet>
  );
}

function MethodButton({
  icon: Icon,
  title,
  subtitle,
  loading,
  disabled,
  onClick,
}: {
  icon: typeof MapPin;
  title: string;
  subtitle: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 text-left active:scale-[0.99] disabled:opacity-50"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-light text-ink">
        {loading ? <Loader2 size={20} className="animate-spin" /> : <Icon size={20} />}
      </span>
      <span className="min-w-0">
        <span className="block text-[15px] font-bold text-ink">{title}</span>
        <span className="block truncate text-[12px] text-text-secondary">{subtitle}</span>
      </span>
    </button>
  );
}
