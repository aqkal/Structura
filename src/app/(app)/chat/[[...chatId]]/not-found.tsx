import { LinkButton } from "@/components/ui/button";
import { SpotIllustration } from "@/components/ui/spot-illustration";

export default function ChatNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6 py-10">
      <div className="glass flex w-full max-w-sm flex-col items-center gap-4 rounded-[var(--radius-lg)] p-8 text-center">
        <SpotIllustration kind="missing" />
        <h1 className="font-semibold text-[color:var(--mint-900)] text-[var(--text-lg)]">
          This conversation is not here.
        </h1>
        <p className="text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
          It may have been deleted, or the link is off by a character.
        </p>
        <LinkButton size="sm" href="/chat">
          Start a new chat
        </LinkButton>
      </div>
    </div>
  );
}
