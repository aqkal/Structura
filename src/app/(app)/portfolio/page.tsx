import Link from "next/link";
import { redirect } from "next/navigation";

import { HeroItem, HeroReveal } from "@/components/onboarding/hero-reveal";
import { ShellContent } from "@/components/shell/app-shell";
import { LinkButton } from "@/components/ui/button";
import { SpotIllustration } from "@/components/ui/spot-illustration";
import { getCurrentUser } from "@/lib/auth";
import { INTENTIONS, isIntentionKey } from "@/lib/guided";
import { listPortfolio } from "@/lib/server/sessions";

export const metadata = { title: "Portfolio of proof" };

export default async function PortfolioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-in?next=/portfolio");

  const entries = await listPortfolio(user.id);

  return (
    <ShellContent>
      <HeroReveal className="flex flex-col gap-8">
        <HeroItem variant="fadeUp">
          <header className="flex flex-col gap-3">
            <div className="font-semibold tracking-[0.18em] text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase">
              Portfolio of proof
            </div>
            <h1 className="font-semibold tracking-[-0.025em] text-[color:var(--mint-900)] text-[var(--text-2xl)]">
              A record of how you think.
            </h1>
            <p
              className="leading-relaxed text-[color:var(--color-ink-muted)] text-[var(--text-base)]"
              style={{ maxWidth: "var(--reading-max)" }}
            >
              Every guided session you finish becomes a proof of your reasoning,
              not just your answer. Qualia asked the questions. The thinking is
              yours.
            </p>
          </header>
        </HeroItem>

        {entries.length === 0 ? (
          <HeroItem variant="fadeUp">
            <div className="glass flex flex-col items-center gap-4 rounded-[var(--radius-lg)] p-10 text-center">
              <SpotIllustration kind="sparkle" />
              <p className="text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
                No proofs yet. Finish a guided session and it lands here.
              </p>
              <LinkButton href="/session/new">Start thinking</LinkButton>
            </div>
          </HeroItem>
        ) : (
          <HeroItem variant="fadeUp">
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {entries.map((e) => {
                const label = isIntentionKey(e.intention)
                  ? INTENTIONS[e.intention].label
                  : "Guided session";
                return (
                  <li key={e.id}>
                    <Link
                      href={`/proof/${e.id}`}
                      className="glass flex h-full flex-col gap-3 rounded-[var(--radius-lg)] p-5 transition-transform hover:-translate-y-0.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold tracking-[0.16em] text-[color:var(--lavender-800)] text-[var(--text-2xs)] uppercase">
                          {label}
                        </span>
                        {e.pasted && (
                          <span className="text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
                            dimmed
                          </span>
                        )}
                      </div>
                      <h2 className="line-clamp-2 font-semibold text-[color:var(--color-ink)] text-[var(--text-sm)]">
                        {e.topic}
                      </h2>
                      {e.summary?.position && (
                        <p className="line-clamp-3 border-l-2 border-[color:var(--lavender-400)] pl-3 text-[color:var(--color-ink-muted)] text-[var(--text-xs)]">
                          {e.summary.position}
                        </p>
                      )}
                      <div className="mt-auto flex items-center gap-2 pt-1">
                        {e.summary?.persist && <Pill>Persist</Pill>}
                        {e.summary?.articulate && <Pill>Articulate</Pill>}
                        <span className="ml-auto text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
                          {e.answeredCount} responses
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </HeroItem>
        )}
      </HeroReveal>
    </ShellContent>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[color:var(--mint-300)]/40 to-[color:var(--lavender-300)]/40 px-2.5 py-0.5 font-semibold text-[color:var(--mint-700)] text-[var(--text-2xs)]">
      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--mint-500)]" />
      {children}
    </span>
  );
}
