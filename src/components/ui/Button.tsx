import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary:
    "bg-ink text-white hover:opacity-90 active:bg-ink-soft disabled:opacity-40",
  secondary:
    "bg-white/80 text-text-secondary border border-black/[0.08] hover:bg-white active:opacity-70 disabled:opacity-40",
  ghost: "bg-transparent text-ink hover:bg-black/5 active:bg-black/10 disabled:opacity-40",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  fullWidth?: boolean;
  loading?: boolean;
};

/** Brand button (see /docs/DESIGN.md → Buttons). 50px height, pill radius. */
const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", fullWidth, loading, disabled, className = "", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`flex h-[50px] items-center justify-center gap-2 rounded-[25px] px-6 text-[16px] font-medium transition-colors disabled:cursor-not-allowed ${
        variants[variant]
      } ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
});

export default Button;
