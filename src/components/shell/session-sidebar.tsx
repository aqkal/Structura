import { LinkButton } from "@/components/ui/button";
import { SpotIllustration } from "@/components/ui/spot-illustration";
import {
  SessionSidebarItem,
  type SidebarSession,
} from "@/components/shell/session-sidebar-item";
import { listUserSessions, type SessionRow } from "@/lib/server/sessions";

export function timeAgo(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function toSidebarSession(s: SessionRow): SidebarSession {
  return {
    id: s.id,
    problemText: s.problemText,
    subjectSlug: s.subjectSlug,
    status: s.status,
    timeAgo: timeAgo(s.startedAt),
  };
}

export async function SessionSidebar({ userId }: { userId: string }) {
  const sessions = await listUserSessions(userId, 12);
  const current = sessions.filter((s) => s.status === "active");
  const recent = sessions.filter((s) => s.status !== "active").slice(0, 8);

  return (
    <div className="flex min-h-full flex-col gap-[var(--space-5)]">
      {sessions.length === 0 && (
        <div className="flex flex-col items-center gap-3 px-2 py-8 text-center">
          <SpotIllustration kind="compass" className="opacity-80" />
          <p className="text-[color:var(--color-ink-subtle)] text-[var(--text-xs)]">
            No sessions yet. Bring a problem and reason it through.
          </p>
        </div>
      )}

      {current.length > 0 && (
        <SidebarSection
          label="Current"
          sessions={current.map(toSidebarSession)}
        />
      )}
      {recent.length > 0 && (
        <SidebarSection
          label="Recent"
          sessions={recent.map(toSidebarSession)}
        />
      )}

      <div className="mt-auto pt-[var(--space-4)]">
        <LinkButton
          href="/session/new"
          size="sm"
          variant="secondary"
          className="w-full"
        >
          + New problem
        </LinkButton>
      </div>
    </div>
  );
}

function SidebarSection({
  label,
  sessions,
}: {
  label: string;
  sessions: SidebarSession[];
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <div className="px-2 font-semibold tracking-[0.18em] text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase">
        {label}
      </div>
      <ul className="flex flex-col gap-0.5">
        {sessions.map((s) => (
          <SessionSidebarItem key={s.id} session={s} />
        ))}
      </ul>
    </section>
  );
}
