import Link from "next/link";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[var(--reading-max)] px-5 py-10 md:py-16">
      <header className="mb-10 flex items-center justify-between">
        <Link
          href="/"
          className="font-sans font-semibold tracking-tight text-[color:var(--mint-900)] text-[var(--text-lg)]"
        >
          Qualia
        </Link>
        <Link
          href="/"
          className="text-[color:var(--color-ink-subtle)] text-[var(--text-xs)] transition-colors hover:text-[color:var(--color-ink)]"
        >
          Back to Qualia
        </Link>
      </header>
      {children}
      <footer className="mt-12 flex items-center gap-4 border-t border-[color:var(--border-soft)] pt-5 text-[color:var(--color-ink-subtle)] text-[var(--text-xs)]">
        <Link href="/privacy" className="hover:text-[color:var(--color-ink)]">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-[color:var(--color-ink)]">
          Terms
        </Link>
      </footer>
    </div>
  );
}
