"use client";

import { Button, LinkButton } from "@/components/ui/button";

export function PrintControls() {
  return (
    <div
      data-no-print
      className="mx-auto flex w-full max-w-[560px] flex-wrap items-center justify-between gap-3"
    >
      <LinkButton href="/portfolio" variant="ghost" size="sm">
        Back to portfolio
      </LinkButton>
      <Button variant="subtle" size="sm" onClick={() => window.print()}>
        Download as PDF
      </Button>
    </div>
  );
}
