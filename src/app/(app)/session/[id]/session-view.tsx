"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import { ActiveStep, type SaveState } from "@/components/session/active-step";
import { ModelSelect } from "@/components/chat/model-select";
import { Completion } from "@/components/session/completion";
import { ConfidenceGate } from "@/components/session/confidence-track";
import { SessionPanel } from "@/components/session/session-panel";
import { StepBlock } from "@/components/session/step-block";
import { StepProgress } from "@/components/session/step-progress";
import { Thinking } from "@/components/session/thinking";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_CHAT_MODEL,
  isChatModelId,
  type ChatModelId,
} from "@/lib/chat-models";
import { streamPost, StreamTimeoutError } from "@/lib/stream";

const MODEL_STORAGE_KEY = "structura-session-model";

export type SSession = {
  id: string;
  problemText: string;
  subjectSlug: string;
  scaffoldMode: "guided" | "questions_only" | "with_examples";
  status: "active" | "completed" | "abandoned";
  totalSteps: number;
  currentStep: number;
  hintsUsed: number;
  rewrites: number;
  startedAt: string;
  endedAt: string | null;
  elapsedSeconds: number;
};

export type SStep = {
  stepNum: number;
  question: string;
  userResponse: string | null;
  aiFeedback: string | null;
  completedAt: string | null;
  revisionCount: number;
};

export type SessionInitial = {
  session: SSession;
  steps: SStep[];
  hintsByStep: Record<number, string[]>;
  confidence: { start?: number; mid?: number; end?: number };
};

type Phase =
  | "gate-start"
  | "loading-question"
  | "answering"
  | "streaming-feedback"
  | "gate-mid"
  | "gate-end"
  | "completing"
  | "done"
  | "error-question";

type ConfidencePoint = "start" | "mid" | "end";

const GATE_PROMPTS: Record<ConfidencePoint, string> = {
  start: "Before you begin, how confident do you feel about this problem?",
  mid: "Quick checkpoint. How confident do you feel now?",
  end: "Last check. How confident are you that you could explain this to someone else?",
};

const STREAM_IDLE_MS = 30000;

function completedOf(steps: SStep[]): SStep[] {
  return steps.filter((s) => s.completedAt !== null);
}

function pendingOf(steps: SStep[]): SStep | null {
  return steps.find((s) => s.completedAt === null) ?? null;
}

function deriveInitialPhase(initial: SessionInitial): Phase {
  const { session, steps, confidence } = initial;
  if (session.status === "completed") return "done";
  if (confidence.start === undefined) return "gate-start";
  if (pendingOf(steps)) return "answering";
  const done = completedOf(steps).length;
  if (done >= session.totalSteps) {
    return confidence.end === undefined ? "gate-end" : "completing";
  }
  if (done === 2 && confidence.mid === undefined) return "gate-mid";
  return "loading-question";
}

export function SessionView({ initial }: { initial: SessionInitial }) {
  const session = initial.session;
  const sessionUrl = `/api/session/${session.id}`;
  const startedAtMs = new Date(session.startedAt).getTime();

  const [phase, setPhase] = useState<Phase>(() => deriveInitialPhase(initial));
  const [steps, setSteps] = useState<SStep[]>(initial.steps);
  const [hintsByStep, setHintsByStep] = useState<Record<number, string[]>>(
    initial.hintsByStep,
  );
  const [confidence, setConfidence] = useState(initial.confidence);
  const [hintsUsed, setHintsUsed] = useState(session.hintsUsed);
  const [rewrites, setRewrites] = useState(session.rewrites);

  const [draft, setDraft] = useState("");
  const [streamedQuestion, setStreamedQuestion] = useState("");
  const [streamingFeedback, setStreamingFeedback] = useState("");
  const [streamingHint, setStreamingHint] = useState<string | null>(null);
  const [hintBusy, setHintBusy] = useState(false);
  const [gateBusy, setGateBusy] = useState(false);
  const [completion, setCompletion] = useState<{
    elapsedSeconds: number;
    deepSession: boolean;
  } | null>(null);
  const [completeError, setCompleteError] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [staleDraft, setStaleDraft] = useState(false);
  const [model, setModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL);
  const [aiUsage, setAiUsage] = useState<{
    used: number;
    budget: number;
  } | null>(null);

  // Live clock for the timer pill and panel.
  const [nowMs, setNowMs] = useState(() => Date.now());

  const [submittedDraft, setSubmittedDraft] = useState("");

  const questionInFlight = useRef(false);
  const completeInFlight = useRef(false);
  const submitInFlight = useRef(false);
  const tryAgainInFlight = useRef(false);
  const lastSavedRef = useRef("");
  const saveFailuresRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const hintAbortRef = useRef<AbortController | null>(null);
  const stoppedByUserRef = useRef(false);
  // Read inside async callbacks so streams always use the latest pick.
  const modelRef = useRef<ChatModelId>(DEFAULT_CHAT_MODEL);

  const completed = completedOf(steps);
  const pending = pendingOf(steps);
  const activeStepNum = pending?.stepNum ?? completed.length + 1;
  const draftKey = `structura-draft-${session.id}-${activeStepNum}`;

  const elapsedSeconds =
    phase === "done"
      ? (completion?.elapsedSeconds ?? session.elapsedSeconds)
      : Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  const deepSession =
    phase === "done"
      ? (completion?.deepSession ?? session.elapsedSeconds >= 2700)
      : elapsedSeconds >= 2700;

  /* ── shared stream options: idle timeout + budget headers ─ */
  const readBudgetHeaders = useCallback((headers: Headers) => {
    const used = Number(headers.get("x-ai-used"));
    const budget = Number(headers.get("x-ai-budget"));
    if (Number.isFinite(used) && Number.isFinite(budget) && budget > 0) {
      setAiUsage({ used, budget });
    }
  }, []);

  /* ── timer ─────────────────────────────────────────────── */
  useEffect(() => {
    if (phase === "done") return;
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  /* ── abort in-flight streams on unmount ────────────────── */
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      hintAbortRef.current?.abort();
    };
  }, []);

  /* ── restore the model pick for guided streams ─────────── */
  useEffect(() => {
    const t = setTimeout(() => {
      const stored = localStorage.getItem(MODEL_STORAGE_KEY);
      if (isChatModelId(stored)) {
        modelRef.current = stored;
        setModel(stored);
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function changeModel(id: ChatModelId) {
    modelRef.current = id;
    setModel(id);
    try {
      localStorage.setItem(MODEL_STORAGE_KEY, id);
    } catch {
      // Storage may be unavailable; the pick still applies this visit.
    }
  }

  /* ── one-time draft restore on mount: DB copy, then local ─ */
  useEffect(() => {
    const t = setTimeout(() => {
      setDraft((current) => {
        if (current.length > 0) return current;
        const p = pendingOf(initial.steps);
        if (!p) return current;
        const fromLocal = localStorage.getItem(
          `structura-draft-${initial.session.id}-${p.stepNum}`,
        );
        return p.userResponse ?? fromLocal ?? "";
      });
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── autosave: localStorage on keystroke, server every 3s ─ */
  useEffect(() => {
    if (phase !== "answering" || !pending) return;
    if (typeof window !== "undefined") {
      localStorage.setItem(draftKey, draft);
    }
    const t = setTimeout(() => {
      if (draft === lastSavedRef.current || draft.trim().length === 0) return;
      lastSavedRef.current = draft;
      setSaveState("saving");
      fetch(`${sessionUrl}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepNum: pending.stepNum, text: draft }),
      })
        .then((res) => {
          if (!res.ok) throw new Error("save failed");
          saveFailuresRef.current = 0;
          setSaveState("saved");
        })
        .catch(() => {
          // Autosave is best effort; localStorage still has the text.
          saveFailuresRef.current += 1;
          setSaveState("offline");
          if (saveFailuresRef.current === 3) {
            toast.message(
              "Sync is struggling. Your draft is safe on this device.",
            );
          }
        });
    }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, phase, pending?.stepNum]);

  /* ── question generation ───────────────────────────────── */
  const generateQuestion = useCallback(async () => {
    if (questionInFlight.current) return;
    questionInFlight.current = true;
    stoppedByUserRef.current = false;
    setStreamedQuestion("");
    setQuestionError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { text, headers } = await streamPost(
        `${sessionUrl}/next-step`,
        { model: modelRef.current },
        (full) => setStreamedQuestion(full),
        controller.signal,
        { idleTimeoutMs: STREAM_IDLE_MS, onHeaders: readBudgetHeaders },
      );
      const stepNum =
        Number(headers.get("x-step-num")) || completedOf(steps).length + 1;
      setSteps((prev) => {
        const without = prev.filter((s) => s.stepNum !== stepNum);
        return [
          ...without,
          {
            stepNum,
            question: text,
            userResponse: null,
            aiFeedback: null,
            completedAt: null,
            revisionCount: 0,
          },
        ].sort((a, b) => a.stepNum - b.stepNum);
      });
      setDraft("");
      lastSavedRef.current = "";
      setSaveState("idle");
      setStaleDraft(false);
      setPhase("answering");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        if (stoppedByUserRef.current) {
          setQuestionError("Generation stopped.");
          setPhase("error-question");
        }
        return;
      }
      setQuestionError(
        err instanceof StreamTimeoutError
          ? "That took too long."
          : err instanceof Error
            ? err.message
            : "Something went wrong.",
      );
      setPhase("error-question");
    } finally {
      questionInFlight.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionUrl]);

  useEffect(() => {
    if (phase !== "loading-question") return;
    const t = setTimeout(() => void generateQuestion(), 0);
    return () => clearTimeout(t);
  }, [phase, generateQuestion]);

  /* ── stop button: abort whatever main stream is running ── */
  function stopStreaming() {
    stoppedByUserRef.current = true;
    abortRef.current?.abort();
  }

  /* ── completion call ───────────────────────────────────── */
  const completeSession = useCallback(async () => {
    if (completeInFlight.current) return;
    completeInFlight.current = true;
    setCompleteError(false);
    try {
      const res = await fetch(`${sessionUrl}/complete`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(data?.error?.message ?? "Could not complete session.");
      }
      const data = (await res.json()) as {
        elapsedSeconds: number;
        deepSession: boolean;
      };
      setCompletion(data);
      setPhase("done");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      setCompleteError(true);
    } finally {
      completeInFlight.current = false;
    }
  }, [sessionUrl]);

  useEffect(() => {
    if (phase !== "completing") return;
    const t = setTimeout(() => void completeSession(), 0);
    return () => clearTimeout(t);
  }, [phase, completeSession]);

  /* ── submit a response for feedback ────────────────────── */
  async function submitResponse() {
    if (!pending || draft.trim().length === 0) return;
    if (submitInFlight.current) return;
    submitInFlight.current = true;
    stoppedByUserRef.current = false;
    const stepNum = pending.stepNum;
    const response = draft;
    setSubmittedDraft(response);
    setPhase("streaming-feedback");
    setStreamingFeedback("");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const { text } = await streamPost(
        `${sessionUrl}/feedback`,
        { stepNum, response, model: modelRef.current },
        (full) => setStreamingFeedback(full),
        controller.signal,
        { idleTimeoutMs: STREAM_IDLE_MS, onHeaders: readBudgetHeaders },
      );
      const completedAt = new Date().toISOString();
      setSteps((prev) =>
        prev
          .filter((s) => s.stepNum <= stepNum)
          .map((s) =>
            s.stepNum === stepNum
              ? { ...s, userResponse: response, aiFeedback: text, completedAt }
              : s,
          ),
      );
      if (typeof window !== "undefined") {
        localStorage.removeItem(`structura-draft-${session.id}-${stepNum}`);
      }
      setDraft("");
      lastSavedRef.current = "";
      setSaveState("idle");
      setStaleDraft(false);

      if (stepNum >= session.totalSteps) {
        setPhase(confidence.end === undefined ? "gate-end" : "completing");
      } else if (stepNum === 2 && confidence.mid === undefined) {
        setPhase("gate-mid");
      } else {
        setPhase("loading-question");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        if (stoppedByUserRef.current) {
          setDraft(response);
          setPhase("answering");
        }
        return;
      }
      toast.error(
        err instanceof StreamTimeoutError
          ? "That took too long. Your answer is still in the editor."
          : err instanceof Error
            ? err.message
            : "Something went wrong.",
      );
      setDraft(response);
      setPhase("answering");
    } finally {
      submitInFlight.current = false;
    }
  }

  /* ── hints ─────────────────────────────────────────────── */
  async function requestHint() {
    if (!pending || hintBusy) return;
    const stepNum = pending.stepNum;
    setHintBusy(true);
    setStreamingHint("");
    const controller = new AbortController();
    hintAbortRef.current = controller;
    try {
      const { text } = await streamPost(
        `${sessionUrl}/hint`,
        { stepNum, draft, model: modelRef.current },
        (full) => setStreamingHint(full),
        controller.signal,
        { idleTimeoutMs: STREAM_IDLE_MS, onHeaders: readBudgetHeaders },
      );
      setHintsByStep((prev) => ({
        ...prev,
        [stepNum]: [...(prev[stepNum] ?? []), text],
      }));
      setHintsUsed((h) => h + 1);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(
        err instanceof StreamTimeoutError
          ? "That took too long. Try asking again."
          : err instanceof Error
            ? err.message
            : "Something went wrong.",
      );
    } finally {
      setStreamingHint(null);
      setHintBusy(false);
    }
  }

  /* ── try again on a completed step ─────────────────────── */
  async function tryAgain(stepNum: number) {
    const target = steps.find((s) => s.stepNum === stepNum);
    if (!target || phase === "streaming-feedback") return;
    if (tryAgainInFlight.current) return;
    tryAgainInFlight.current = true;
    try {
      // Persist the reset BEFORE touching the UI: deletes later steps,
      // clears this step's completion, bumps the rewrite counter. Without
      // this, a reload before resubmitting would resurrect the old answer.
      const res = await fetch(`${sessionUrl}/reset-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepNum }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(data?.error?.message ?? "Could not reset the step.");
      }
      setSteps((prev) =>
        prev
          .filter((s) => s.stepNum < stepNum)
          .concat([
            {
              ...target,
              aiFeedback: null,
              completedAt: null,
              revisionCount: target.revisionCount + 1,
            },
          ])
          .sort((a, b) => a.stepNum - b.stepNum),
      );
      setRewrites((r) => r + 1);
      setDraft(target.userResponse ?? "");
      setStaleDraft((target.userResponse ?? "").length > 0);
      setPhase("answering");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      tryAgainInFlight.current = false;
    }
  }

  /* ── confidence gates ──────────────────────────────────── */
  async function submitConfidence(point: ConfidencePoint, rating: number) {
    setGateBusy(true);
    try {
      const res = await fetch(`${sessionUrl}/confidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ point, rating }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(data?.error?.message ?? "Could not save your rating.");
      }
      setConfidence((c) => ({ ...c, [point]: rating }));
      if (point === "end") {
        setPhase("completing");
      } else {
        setPhase(pending ? "answering" : "loading-question");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGateBusy(false);
    }
  }

  /* ── render ────────────────────────────────────────────── */
  const busy = phase === "streaming-feedback" || phase === "loading-question";
  const stepPillNum = Math.min(
    completed.length + (phase === "done" ? 0 : 1),
    session.totalSteps,
  );
  const subjectLabel =
    session.subjectSlug.charAt(0).toUpperCase() + session.subjectSlug.slice(1);

  const activeGate: ConfidencePoint | null =
    phase === "gate-start"
      ? "start"
      : phase === "gate-mid"
        ? "mid"
        : phase === "gate-end"
          ? "end"
          : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_var(--rightpanel-w)]">
      <div className="flex min-w-0 flex-col gap-5">
        {/* header */}
        <header className="flex flex-col gap-3">
          <div>
            <span className="inline-flex items-center rounded-full bg-[color:var(--lavender-200)]/70 px-3 py-1 font-semibold tracking-[0.18em] text-[color:var(--lavender-800)] text-[var(--text-2xs)] uppercase">
              {subjectLabel}
            </span>
          </div>
          <h1 className="leading-snug font-semibold tracking-[-0.01em] break-words text-[color:var(--color-ink)] text-[var(--text-lg)]">
            {session.problemText}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="pill">
              <span
                aria-hidden="true"
                className="h-[6px] w-[6px] rounded-full bg-[color:var(--mint-500)]"
              />
              {formatClock(elapsedSeconds)} elapsed
            </span>
            <span className="pill">
              Step {stepPillNum} of {session.totalSteps}
            </span>
            {deepSession && (
              <span
                title="You stayed with one problem for 45 minutes or more"
                className="inline-flex items-center rounded-full bg-gradient-to-r from-[color:var(--lavender-200)] to-[color:var(--lavender-300)] px-3 py-1 font-semibold text-[color:var(--lavender-800)] text-[var(--text-2xs)]"
              >
                Deep session
              </span>
            )}
            {phase !== "done" && (
              <span className="ml-auto">
                <ModelSelect
                  value={model}
                  onChange={changeModel}
                  direction="down"
                />
              </span>
            )}
          </div>
          <div className="pt-1">
            <StepProgress
              total={session.totalSteps}
              completed={completed.length}
              activeStep={phase === "done" ? null : activeStepNum}
              halfStep={phase === "streaming-feedback"}
            />
          </div>
        </header>

        {phase === "done" && (
          <Completion
            sessionId={session.id}
            elapsedSeconds={elapsedSeconds}
            hintsUsed={hintsUsed}
            rewrites={rewrites}
            confidenceStart={confidence.start}
            confidenceEnd={confidence.end}
            deepSession={deepSession}
          />
        )}

        {/* completed step log */}
        <AnimatePresence initial={false}>
          {completed.map((step) => (
            <motion.div
              key={`step-${step.stepNum}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <StepBlock
                step={step}
                hints={hintsByStep[step.stepNum] ?? []}
                onTryAgain={() => tryAgain(step.stepNum)}
                disabled={busy || phase === "done" || activeGate !== null}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* response under review */}
        {phase === "streaming-feedback" && pending && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-3"
            aria-live="polite"
            aria-busy={streamingFeedback.length === 0}
          >
            <StepBlock
              step={{
                stepNum: pending.stepNum,
                question: pending.question,
                userResponse: submittedDraft,
                aiFeedback:
                  streamingFeedback.length > 0 ? streamingFeedback : null,
              }}
              hints={hintsByStep[pending.stepNum] ?? []}
              onTryAgain={() => undefined}
              disabled
            />
            <div className="flex items-center gap-3">
              <div className="flex-1">
                {streamingFeedback.length === 0 && <Thinking />}
              </div>
              <Button variant="ghost" size="sm" onClick={stopStreaming}>
                Stop
              </Button>
            </div>
          </motion.div>
        )}

        {/* confidence gates */}
        {activeGate && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <ConfidenceGate
              prompt={GATE_PROMPTS[activeGate]}
              busy={gateBusy}
              onSubmit={(rating) => void submitConfidence(activeGate, rating)}
            />
          </motion.div>
        )}

        {/* active step */}
        {(phase === "answering" || phase === "loading-question") && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <ActiveStep
              stepNum={activeStepNum}
              totalSteps={session.totalSteps}
              question={
                phase === "loading-question"
                  ? streamedQuestion
                  : (pending?.question ?? "")
              }
              isStreamingQuestion={phase === "loading-question"}
              hints={hintsByStep[activeStepNum] ?? []}
              streamingHint={streamingHint}
              hintsAllowed={session.scaffoldMode !== "questions_only"}
              hintBusy={hintBusy}
              draft={draft}
              submitDisabled={
                phase !== "answering" || draft.trim().length === 0 || hintBusy
              }
              saveState={saveState}
              staleDraft={staleDraft}
              onDismissStale={() => setStaleDraft(false)}
              onStop={phase === "loading-question" ? stopStreaming : undefined}
              onDraftChange={(text) => {
                if (staleDraft && text !== draft) setStaleDraft(false);
                setDraft(text);
              }}
              onHint={() => void requestHint()}
              onSubmit={() => void submitResponse()}
            />
          </motion.div>
        )}

        {/* question generation failed or was stopped */}
        {phase === "error-question" && (
          <div className="glass flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-[color:var(--lavender-300)]/60 p-5">
            <p className="text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
              {questionError ?? "Structura could not load the next step."} Your
              progress is safe.
            </p>
            <Button size="sm" onClick={() => setPhase("loading-question")}>
              Try again
            </Button>
          </div>
        )}

        {/* wrapping up */}
        {phase === "completing" && (
          <div className="glass flex flex-col items-start gap-3 rounded-[var(--radius-lg)] p-5">
            {completeError ? (
              <>
                <p className="text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
                  Could not finish saving the session.
                </p>
                <Button size="sm" onClick={() => void completeSession()}>
                  Retry
                </Button>
              </>
            ) : (
              <Thinking label="Wrapping up your session" />
            )}
          </div>
        )}
      </div>

      {/* right companion panel */}
      <div className="hidden lg:block">
        <SessionPanel
          scaffoldMode={session.scaffoldMode}
          elapsedSeconds={elapsedSeconds}
          stepsDone={completed.length}
          totalSteps={session.totalSteps}
          hintsUsed={hintsUsed}
          rewrites={rewrites}
          aiUsage={aiUsage}
        />
      </div>
    </div>
  );
}

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
