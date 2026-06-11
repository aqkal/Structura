"use client";

import { Button, LinkButton } from "@/components/ui/button";
import { SpotIllustration } from "@/components/ui/spot-illustration";

export default function ChatConversationError({
  error: _error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-10">
      <div className="glass flex w-full max-w-sm flex-col items-center gap-4 rounded-[var(--radius-lg)] p-8 text-center">
        <SpotIllustration kind="sparkle" />
        <h1 className="font-semibold text-[color:var(--mint-900)] text-[var(--text-lg)]">
          This conversation did not load.
        </h1>
        <p className="text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
          Something went wrong on our side. Nothing you wrote is lost.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm" onClick={() => unstable_retry()}>
            Try again
          </Button>
          <LinkButton size="sm" variant="ghost" href="/chat">
            Start a new chat
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
