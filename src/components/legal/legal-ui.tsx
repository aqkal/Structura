import Link from "next/link";

export function DraftNotice() {
  return (
    <div className="mb-8 rounded-[var(--radius-md)] border border-[color:var(--lavender-300)] bg-[color:var(--lavender-100)]/60 p-4 leading-relaxed text-[color:var(--color-ink-muted)] text-[var(--text-xs)]">
      <strong className="text-[color:var(--color-ink)]">
        Draft for review.
      </strong>{" "}
      This document is a starting template, not legal advice. Have a qualified
      lawyer review and adapt it for your business before relying on it.
      Bracketed placeholders like [COMPANY] must be filled in.
    </div>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="mb-2 font-semibold tracking-[-0.02em] text-[color:var(--mint-900)] text-[var(--text-2xl)]">
      {children}
    </h1>
  );
}

export function Updated({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-8 text-[color:var(--color-ink-subtle)] text-[var(--text-xs)]">
      {children}
    </p>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-8 mb-2 font-semibold text-[color:var(--color-ink)] text-[var(--text-lg)]">
      {children}
    </h2>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 leading-relaxed text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
      {children}
    </p>
  );
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mb-3 flex list-disc flex-col gap-1.5 pl-5 leading-relaxed text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
      {children}
    </ul>
  );
}

export function A({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const className =
    "text-[color:var(--lavender-800)] underline underline-offset-2";
  if (href.startsWith("http")) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
