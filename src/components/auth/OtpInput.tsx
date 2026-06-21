"use client";

import { useRef } from "react";

type Props = {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  disabled?: boolean;
  error?: boolean;
};

/** Six-box OTP field. Digits only, auto-advance, backspace-aware, paste-friendly. */
export default function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  error,
}: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.split("");

  const setAt = (index: number, digit: string) => {
    const next = value.split("");
    next[index] = digit;
    onChange(next.join("").slice(0, length));
  };

  const handleChange = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "");
    if (!digit) return;
    if (digit.length > 1) {
      // pasted chunk
      onChange((value.slice(0, index) + digit).replace(/\D/g, "").slice(0, length));
      const last = Math.min(index + digit.length, length - 1);
      refs.current[last]?.focus();
      return;
    }
    setAt(index, digit);
    if (index < length - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[index]) {
        setAt(index, "");
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
        setAt(index - 1, "");
      }
    }
    if (e.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < length - 1) refs.current[index + 1]?.focus();
  };

  return (
    <div className="flex justify-between gap-2">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          autoFocus={i === 0}
          disabled={disabled}
          value={digits[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={`h-14 w-12 rounded-xl border bg-surface text-center text-xl font-bold text-ink outline-none transition-colors disabled:opacity-50 ${
            error
              ? "border-danger"
              : digits[i]
                ? "border-ink focus:border-sky"
                : "border-border focus:border-sky"
          }`}
        />
      ))}
    </div>
  );
}
