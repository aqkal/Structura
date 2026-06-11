import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "subtle";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full select-none " +
  "transition-[transform,background-color,box-shadow] duration-150 active:translate-y-px " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender-400 " +
  "tracking-[-0.01em]";

const variants: Record<Variant, string> = {
  primary:
    "bg-[#0d3320] shadow-[var(--shadow-btn)] hover:bg-[#16482c] active:bg-[#0d3320]",
  secondary:
    "bg-white/75 text-[color:var(--color-ink)] border border-[color:var(--border-soft)] hover:bg-white",
  ghost:
    "bg-transparent text-[color:var(--color-ink-muted)] hover:bg-white/40 hover:text-[color:var(--color-ink)]",
  subtle:
    "bg-[color:var(--lavender-200)]/70 text-[color:var(--lavender-800)] hover:bg-[color:var(--lavender-200)]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[var(--text-sm)] font-medium",
  md: "h-11 px-5 text-[var(--text-base)] font-medium",
  lg: "h-12 px-6 text-[var(--text-base)] font-medium",
};

const variantStyle = (variant: Variant): React.CSSProperties | undefined =>
  variant === "primary" ? { color: "#ffffff" } : undefined;

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = CommonProps & {
  loading?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps>;

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  style,
  loading,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      style={{ ...variantStyle(variant), ...style }}
      className={cn(base, variants[variant], sizes[size], className)}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}

type LinkButtonProps = CommonProps & {
  href: string;
  prefetch?: boolean;
};

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  children,
  href,
  prefetch,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      style={variantStyle(variant)}
      className={cn(base, variants[variant], sizes[size], className)}
    >
      {children}
    </Link>
  );
}
