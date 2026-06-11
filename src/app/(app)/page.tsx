import { FirstRunPanel } from "@/components/onboarding/first-run";
import { HeroItem, HeroReveal } from "@/components/onboarding/hero-reveal";
import { HowItWorks } from "@/components/onboarding/how-it-works";
import { ResumeCard } from "@/components/onboarding/resume-card";
import { SampleProblemCards } from "@/components/onboarding/sample-problems";
import { ShellContent } from "@/components/shell/app-shell";
import { SessionSidebar, timeAgo } from "@/components/shell/session-sidebar";
import { StatsPanel } from "@/components/shell/stats-panel";
import { LinkButton } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { listUserSessions } from "@/lib/server/sessions";
import { getUserStats } from "@/lib/server/stats";

const eyebrowClass =
  "text-[var(--text-2xs)] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-ink-subtle)]";

export default async function HomePage() {
  const user = await getCurrentUser();

  if (!user) {
    return <SignedOutLanding />;
  }

  const [sessions, stats] = await Promise.all([
    listUserSessions(user.id, 12),
    getUserStats(user.id),
  ]);
  const activeSession = sessions.find((s) => s.status === "active") ?? null;
  const firstRun = sessions.length === 0;
  const showStats = stats.completedSessions > 0;

  return (
    <ShellContent
      sidebar={<SessionSidebar userId={user.id} />}
      rightPanel={
        showStats ? <StatsPanel stats={stats} variant="panel" /> : undefined
      }
    >
      <HeroReveal className="flex flex-col gap-10" stagger={0.08}>
        <HeroItem variant="fadeUp">
          <header className="flex flex-col gap-4">
            <div className={eyebrowClass}>Dashboard</div>
            <h1 className="leading-[1.02] font-semibold tracking-[-0.025em] text-[color:var(--mint-900)] text-[var(--text-3xl)]">
              Hello, {user.name ?? user.email}.
            </h1>
            <p
              className="leading-relaxed text-[color:var(--color-ink-muted)] text-[var(--text-base)]"
              style={{ maxWidth: "var(--reading-max)" }}
            >
              Structura is a thinking scaffold, not an answer key. It asks the
              questions that make you slow down, then keeps the record of how
              you reasoned, not just what you got right.
            </p>
          </header>
        </HeroItem>

        {showStats && (
          <HeroItem variant="fadeUp" className="lg:hidden">
            <StatsPanel stats={stats} variant="row" />
          </HeroItem>
        )}

        {firstRun ? (
          <FirstRunPanel />
        ) : activeSession ? (
          <ResumeCard
            id={activeSession.id}
            problemText={activeSession.problemText}
            startedLabel={timeAgo(activeSession.startedAt)}
            currentStep={activeSession.currentStep}
            totalSteps={activeSession.totalSteps}
          />
        ) : (
          <HeroItem variant="fadeUp">
            <div className="flex flex-wrap gap-3">
              <LinkButton href="/session/new" size="lg">
                Start a problem
                <Arrow />
              </LinkButton>
            </div>
          </HeroItem>
        )}
      </HeroReveal>
    </ShellContent>
  );
}

function SignedOutLanding() {
  return (
    <ShellContent signedIn={false}>
      <div className="flex flex-col gap-12">
        <HeroReveal className="flex flex-col gap-10" stagger={0.08}>
          <div className="flex flex-col gap-4">
            <HeroItem>
              <div className={eyebrowClass}>Welcome</div>
            </HeroItem>
            <HeroItem>
              <h1 className="text-hero-gradient leading-[1.02] font-semibold tracking-[-0.025em] text-[var(--text-3xl)]">
                Reason it through.
              </h1>
            </HeroItem>
            <HeroItem>
              <p
                className="leading-relaxed text-[color:var(--color-ink-muted)] text-[var(--text-base)]"
                style={{ maxWidth: "var(--reading-max)" }}
              >
                Structura is a thinking scaffold, not an answer key. It asks the
                questions that make you slow down, then keeps the record of how
                you reasoned, not just what you got right.
              </p>
            </HeroItem>
            <HeroItem>
              <div className="flex flex-wrap gap-3 pt-1">
                <LinkButton href="/auth/sign-in" size="lg">
                  Sign in to start
                  <Arrow />
                </LinkButton>
              </div>
            </HeroItem>
          </div>

          <HeroItem variant="fadeUp">
            <section className="flex flex-col gap-4">
              <h2 className={eyebrowClass}>Or try a sample problem</h2>
              <SampleProblemCards showSignInNote />
            </section>
          </HeroItem>
        </HeroReveal>

        <HowItWorks />
      </div>
    </ShellContent>
  );
}

function Arrow() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
