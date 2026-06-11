"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { SpotIllustration } from "@/components/ui/spot-illustration";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="glass flex w-full max-w-sm flex-col items-center gap-4 rounded-[var(--radius-lg)] p-[var(--space-8)] text-center">
        <SpotIllustration kind="sparkle" />
        <h1 className="font-semibold text-[color:var(--mint-900)] text-[var(--text-lg)]">
          That did not load.
        </h1>
        <p className="text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
          Not your fault. Something slipped on our side. Your work is not lost.
        </p>
        <Button onClick={() => unstable_retry()}>Try again</Button>
      </div>
    </div>
  );
}
