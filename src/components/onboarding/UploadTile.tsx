"use client";

import { useRef, useState } from "react";
import { Camera, Check, Loader2, RotateCcw } from "lucide-react";

import { useFileUpload } from "@/hooks/useFileUpload";
import type { PresignPurpose } from "@/types/worker";

type Props = {
  label: string;
  hint: string;
  emoji: string;
  purpose: PresignPurpose;
  /** Hosted URL once uploaded, or `null` when empty. */
  value: string | null;
  onChange: (url: string | null) => void;
  optional?: boolean;
};

/**
 * Single KYC photo tile: pick → preview → upload to Cloudinary → done. Owns its
 * upload lifecycle and reports the hosted `secure_url` upward via `onChange`.
 * The binary goes straight to Cloudinary, never through our server.
 */
export default function UploadTile({
  label,
  hint,
  emoji,
  purpose,
  value,
  onChange,
  optional,
}: Props) {
  const upload = useFileUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;

    setError(null);
    setBusy(true);
    setPreview(URL.createObjectURL(file));
    try {
      const url = await upload(file, purpose);
      onChange(url);
    } catch (err) {
      setPreview(null);
      onChange(null);
      setError((err as Error)?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const done = Boolean(value);

  return (
    <div>
      <button
        type="button"
        onClick={pick}
        disabled={busy}
        className={`relative flex h-32 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${
          done
            ? "border-emerald bg-emerald/5"
            : error
              ? "border-danger bg-danger/5"
              : "border-border bg-cream hover:border-ink/30"
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-text-secondary">
            <span className="text-2xl">{emoji}</span>
            <span className="flex items-center gap-1 text-[13px] font-semibold">
              <Camera size={14} /> Tap to add
            </span>
          </span>
        )}

        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 size={22} className="animate-spin text-ink" />
          </span>
        ) : null}

        {done && !busy ? (
          <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald text-white">
            <Check size={14} />
          </span>
        ) : null}

        {done && !busy ? (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-ink/80 px-2 py-1 text-[11px] font-medium text-white">
            <RotateCcw size={11} /> Retake
          </span>
        ) : null}
      </button>

      <div className="mt-1.5 flex items-baseline justify-between">
        <p className="text-[13px] font-semibold text-ink">
          {label}
          {optional ? <span className="font-normal text-text-tertiary"> · optional</span> : null}
        </p>
      </div>
      <p className="text-[12px] text-text-secondary">{error ?? hint}</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFile}
        className="hidden"
      />
    </div>
  );
}
