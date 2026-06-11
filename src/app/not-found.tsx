import { LinkButton } from "@/components/ui/button";
import { SpotIllustration } from "@/components/ui/spot-illustration";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="glass flex w-full max-w-sm flex-col items-center gap-4 rounded-[var(--radius-lg)] p-[var(--space-8)] text-center">
        <SpotIllustration kind="missing" />
        <h1 className="font-semibold text-[color:var(--mint-900)] text-[var(--text-lg)]">
          This page is not here.
        </h1>
        <p className="text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
          It may have moved, or it may never have existed. Either way, home is
          close.
        </p>
        <LinkButton href="/">Back home</LinkButton>
      </div>
    </div>
  );
}
