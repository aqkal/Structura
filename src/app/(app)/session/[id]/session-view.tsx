"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import { Completion } from "@/components/session/completion";
import { ThinkingMap } from "@/components/session/thinking-map";
import { ModelSelect } from "@/components/chat/model-select";
import { Markdown } from "@/components/render/markdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DEFAULT_CHAT_MODEL,
  isChatModelId,
  type ChatModelId,
} from "@/lib/chat-models";
import {
  INTENTIONS,
  MIN_MOVES_BEFORE_END,
  MOVE_LABEL,
  type IntentionKey,
  type MoveKind,
} from "@/lib/guided";
import type { ProofSummary } from "@/lib/server/ai/guided";
import { fadeUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type SMove = {
  stepNum: number;
  kind: string | null;
  question: string;
  answer: string | null;
};

export type SessionInitial = {
  session: {
    id: string;
    topic: string;
    intention: IntentionKey;
    status: "active" | "completed" | "abandoned";
    totalSteps: number;
    pasted: boolean;
    summary: ProofSummary | null;
    startedAt: string;
    elapsedSeconds: number;
  };
  moves: SMove[];
};

type Phase = "loading-move" | "answering" | "ending" | "done" | "error";

function moveLabel(kind: string | null): string {
  return kind && kind in MOVE_LABEL
    ? MOVE_LABEL[kind as MoveKind]
    : "Your move";
}

function friendlyError(err: unknown, fallback: string): string {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return "That took too long. Please try again.";
  }
  return err instanceof Error ? err.message : fallback;
}

export function SessionView({ initial }: { initial: SessionInitial }) {
  const session = initial.session;
  const url = `/api/session/${session.id}`;
  const total = session.totalSteps;
  const intention = INTENTIONS[session.intention];

  const [moves, setMoves] = useState<SMove[]>(initial.moves);
  const [draft, setDraft] = useState("");
  const [phase, setPhase] = useState<Phase>(() => {
    if (session.status === "completed") return "done";
    const last = initial.moves[initial.moves.length - 1];
    if (!initial.moves.length || (last && last.answer !== null)) {
      return initial.moves.length >= total ? "ending" : "loading-move";
    }
    return "answering";
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pasted, setPasted] = useState(session.pasted);
  const [busy, setBusy] = useState(false);
  const [completion, setCompletion] = useState<{
    summary: ProofSummary;
    elapsedSeconds: number;
  } | null>(
    session.summary
      ? { summary: session.summary, elapsedSeconds: session.elapsedSeconds }
      : null,
  );

  const router = useRouter();
  const moveInFlight = useRef(false);
  const endInFlight = useRef(false);
  const pastedRef = useRef(session.pasted);

  const [model, setModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL);
  const modelRef = useRef<ChatModelId>(DEFAULT_CHAT_MODEL);
  useEffect(() => {
    const t = setTimeout(() => {
      const saved = localStorage.getItem("structura-session-model");
      if (isChatModelId(saved)) {
        modelRef.current = saved;
        setModel(saved);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  function changeModel(id: ChatModelId) {
    modelRef.current = id;
    setModel(id);
    try {
      localStorage.setItem("structura-session-model", id);
    } catch {
      void 0;
    }
  }

  useEffect(() => {
    if (initial.moves.length > 0) return;
    const t = setTimeout(() => router.refresh(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answered = moves.filter((m) => m.answer !== null);
  const pending = moves.find((m) => m.answer === null) ?? null;
  const completedCount = answered.length;
  const canEnd = completedCount >= MIN_MOVES_BEFORE_END;
  const lastAnswered = answered[answered.length - 1] ?? null;
  const draftKey = `qualia-draft-${session.id}-${pending?.stepNum ?? "x"}`;

  useEffect(() => {
    if (!pending) return;
    const t = setTimeout(() => {
      const saved = localStorage.getItem(
        `qualia-draft-${session.id}-${pending.stepNum}`,
      );
      if (saved) setDraft((d) => (d.length === 0 ? saved : d));
    }, 0);
    return () => clearTimeout(t);
  }, [pending?.stepNum]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pending && draft.length > 0) {
      localStorage.setItem(draftKey, draft);
    }
  }, [draft, draftKey, pending]);

  const loadMove = useCallback(async () => {
    if (moveInFlight.current) return;
    moveInFlight.current = true;
    setErrorMsg(null);
    try {
      const res = await fetch(`${url}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelRef.current }),
        signal: AbortSignal.timeout(60000),
      });
      if (res.status === 409) {
        setPhase("ending");
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          data?.error?.message ?? "Could not load the next move.",
        );
      }
      const data = (await res.json()) as {
        stepNum: number;
        kind: string | null;
        question: string;
      };
      setMoves((prev) => {
        if (prev.some((m) => m.stepNum === data.stepNum)) return prev;
        return [...prev, { ...data, answer: null }];
      });
      setDraft("");
      setPhase("answering");
    } catch (err) {
      setErrorMsg(friendlyError(err, "Could not load the next move."));
      setPhase("error");
    } finally {
      moveInFlight.current = false;
    }
  }, [url]);

  useEffect(() => {
    if (phase !== "loading-move") return;
    const t = setTimeout(() => void loadMove(), 0);
    return () => clearTimeout(t);
  }, [phase, loadMove]);

  async function submitAnswer() {
    if (!pending || draft.trim().length === 0 || busy) return;
    setBusy(true);
    const stepNum = pending.stepNum;
    const answer = draft;
    try {
      const res = await fetch(`${url}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepNum, answer }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(data?.error?.message ?? "Could not save your answer.");
      }
      localStorage.removeItem(draftKey);
      setMoves((prev) =>
        prev.map((m) => (m.stepNum === stepNum ? { ...m, answer } : m)),
      );
      setDraft("");
      if (stepNum + 1 >= total) setPhase("ending");
      else setPhase("loading-move");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const endSession = useCallback(async () => {
    if (endInFlight.current) return;
    endInFlight.current = true;
    setPhase("ending");
    try {
      const res = await fetch(`${url}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pasted: pastedRef.current,
          model: modelRef.current,
        }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(data?.error?.message ?? "Could not end the session.");
      }
      const data = (await res.json()) as {
        summary: ProofSummary;
        elapsedSeconds: number;
      };
      setCompletion(data);
      setPhase("done");
    } catch (err) {
      setErrorMsg(friendlyError(err, "Could not write your proof."));
      setPhase("error");
    } finally {
      endInFlight.current = false;
    }
  }, [url]);

  useEffect(() => {
    if (phase !== "ending") return;
    const t = setTimeout(() => void endSession(), 0);
    return () => clearTimeout(t);
  }, [phase, endSession]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submitAnswer();
    }
  }

  const progressPct = Math.round((completedCount / total) * 100);
  const activeNum = pending
    ? pending.stepNum + 1
    : Math.min(completedCount + 1, total);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_var(--rightpanel-w)]">
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex w-fit items-center rounded-full bg-[color:var(--lavender-200)]/70 px-3 py-1 font-semibold tracking-[0.18em] text-[color:var(--lavender-800)] text-[var(--text-2xs)] uppercase">
              {intention.label}
            </span>
            {phase !== "done" && (
              <ModelSelect
                value={model}
                onChange={changeModel}
                direction="down"
              />
            )}
          </div>
          <h1 className="leading-snug font-semibold tracking-[-0.01em] break-words text-[color:var(--color-ink)] text-[var(--text-lg)]">
            {session.topic}
          </h1>
        </header>

        {phase === "done" && completion ? (
          <Completion
            sessionId={session.id}
            topic={session.topic}
            summary={completion.summary}
            elapsedSeconds={completion.elapsedSeconds}
            movesAnswered={completedCount}
            pasted={pasted}
          />
        ) : (
          <div className="glass flex flex-col gap-5 rounded-[var(--radius-lg)] p-5 ring-1 ring-[color:var(--lavender-300)]">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
                <span className="font-semibold">
                  Move {activeNum} of {total}
                  <span className="px-1.5 text-[color:var(--lavender-400)]">
                    &middot;
                  </span>
                  {moveLabel(pending?.kind ?? lastAnswered?.kind ?? null)}
                </span>
                {canEnd && phase !== "ending" && (
                  <button
                    type="button"
                    onClick={() => void endSession()}
                    className="font-semibold text-[color:var(--color-ink-subtle)] transition-colors hover:text-[color:var(--color-ink)]"
                  >
                    End session
                  </button>
                )}
              </div>
              <div className="h-[3px] overflow-hidden rounded-full bg-[color:var(--lavender-300)]/20">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[color:var(--mint-300)] to-[color:var(--lavender-400)] transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {lastAnswered && phase === "answering" && (
              <div className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[color:var(--border-soft)] bg-white/45 p-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--mint-700)] text-[color:var(--color-bg)]">
                  <Check />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-semibold tracking-widest text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase">
                    {moveLabel(lastAnswered.kind)}
                  </span>
                  <p className="line-clamp-3 whitespace-pre-wrap text-[color:var(--color-ink-muted)] text-[var(--text-xs)]">
                    {lastAnswered.answer}
                  </p>
                </div>
              </div>
            )}

            <div aria-live="polite" aria-busy={phase === "loading-move"}>
              <AnimatePresence mode="wait" initial={false}>
                {phase === "loading-move" || phase === "ending" ? (
                  <motion.div
                    key="loading"
                    exit={{ opacity: 0 }}
                    className="flex flex-col gap-2"
                  >
                    <Skeleton className="h-4 w-[88%] bg-white/50" />
                    <Skeleton className="h-4 w-[64%] bg-white/50" />
                    <p className="pt-1 text-[color:var(--color-ink-subtle)] text-[var(--text-xs)]">
                      {phase === "ending"
                        ? "Writing your reasoning proof..."
                        : "Qualia is thinking of the next move..."}
                    </p>
                  </motion.div>
                ) : phase === "error" ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-start gap-3"
                  >
                    <p className="text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
                      {errorMsg ?? "That did not work."} Your progress is safe.
                    </p>
                    <Button
                      size="sm"
                      onClick={() =>
                        setPhase(
                          completedCount >= total ? "ending" : "loading-move",
                        )
                      }
                    >
                      Try again
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`q-${pending?.stepNum}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Markdown className="font-medium text-[color:var(--color-ink)] text-[var(--text-base)]">
                      {pending?.question ?? ""}
                    </Markdown>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {phase === "answering" && (
              <>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={() => {
                    setPasted(true);
                    pastedRef.current = true;
                  }}
                  placeholder="Write your thinking here. Your own words build the path."
                  aria-label="Your response"
                  className="min-h-[120px] w-full resize-y rounded-[var(--radius-md)] border border-[color:var(--border-soft)] bg-white/70 p-4 text-[16px] text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-subtle)] focus:bg-white focus:ring-2 focus:ring-[color:var(--lavender-400)]/60 focus:outline-none md:text-[var(--text-sm)]"
                />
                <div className="flex items-center justify-end">
                  <Button
                    size="md"
                    onClick={() => void submitAnswer()}
                    loading={busy}
                    disabled={draft.trim().length === 0}
                  >
                    {pending && pending.stepNum + 1 >= total
                      ? "Submit final response"
                      : "Submit response"}
                    <Arrow />
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="hidden lg:block">
        <div className="flex flex-col gap-4">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="glass flex flex-col gap-3 rounded-[var(--radius-lg)] p-4"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-[color:var(--color-ink)] text-[var(--text-sm)]">
                Your thinking
              </span>
              <span className="text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
                Grows with each response
              </span>
            </div>
            <ThinkingMap completedCount={completedCount} pasted={pasted} />
            <div className="flex items-center justify-between border-t border-[color:var(--border-soft)] pt-3 text-[var(--text-2xs)]">
              <span className="text-[color:var(--color-ink-subtle)]">
                {completedCount} of {total} responses
              </span>
              <span
                className={cn(
                  "flex items-center gap-1.5 font-semibold",
                  pasted
                    ? "text-[color:var(--lavender-800)]"
                    : "text-[color:var(--mint-700)]",
                )}
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    pasted
                      ? "bg-[color:var(--lavender-600)]"
                      : "animate-pulse bg-[color:var(--mint-500)]",
                  )}
                />
                {pasted ? "Dimmed" : "Growing"}
              </span>
            </div>
          </motion.div>

          <AnimatePresence>
            {pasted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-[var(--radius-md)] border border-[color:var(--lavender-300)] bg-[color:var(--lavender-100)]/70 p-3 text-center text-[color:var(--lavender-800)] text-[var(--text-2xs)]"
              >
                Pasted text dims your map. Honest, first-person reasoning is
                what this records.
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M2.5 6.5 5 9l4.5-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
