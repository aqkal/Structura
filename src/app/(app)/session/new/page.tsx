import { redirect } from "next/navigation";

import { HeroItem, HeroReveal } from "@/components/onboarding/hero-reveal";
import { getSampleProblem } from "@/components/onboarding/sample-data";
import { getCurrentUser } from "@/lib/auth";

import { NewSessionForm } from "./new-session-form";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ sample?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in");

  const { sample } = await searchParams;
  const sampleKey = typeof sample === "string" ? sample : undefined;
  const preset = getSampleProblem(sampleKey);

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <HeroReveal>
        <HeroItem variant="fadeUp">
          <div className="glass flex flex-col gap-6 rounded-[var(--radius-lg)] p-[var(--space-6)] sm:p-[var(--space-8)]">
            <header className="flex flex-col gap-3">
              <div className="font-semibold tracking-[0.18em] text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase">
                New problem
              </div>
              <h1 className="font-semibold tracking-[-0.02em] text-[color:var(--mint-900)] text-[var(--text-2xl)]">
                What are you working on?
              </h1>
              <p className="leading-relaxed text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
                Write the problem in plain language. Qualia guides your
                thinking, it never solves it for you.
              </p>
            </header>

            <NewSessionForm
              initialTopic={preset?.problem}
              initialIntention={preset?.intention}
            />
          </div>
        </HeroItem>
      </HeroReveal>
    </div>
  );
}
