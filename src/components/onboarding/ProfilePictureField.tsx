"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";

import { useFileUpload } from "@/hooks/useFileUpload";

/** Circular avatar picker: pick → preview → upload to Cloudinary → hosted URL. */
export default function ProfilePictureField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const upload = useFileUpload();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;

    setError(null);
    setBusy(true);
    setPreview(URL.createObjectURL(file));
    try {
      onChange(await upload(file, "profile_picture"));
    } catch (err) {
      setPreview(null);
      onChange(null);
      setError((err as Error)?.message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const shown = preview ?? value;

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label="Add profile photo"
        className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-cream"
      >
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="Profile" className="h-full w-full object-cover" />
        ) : (
          <Camera size={22} className="text-text-secondary" />
        )}
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 size={20} className="animate-spin text-ink" />
          </span>
        ) : null}
        <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white">
          <Camera size={12} />
        </span>
      </button>
      <p className="text-[12px] text-text-secondary">
        {error ?? (shown ? "Tap to change your photo." : "A clear face photo builds trust with businesses.")}
      </p>

      <input ref={inputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
    </div>
  );
}
