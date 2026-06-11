"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function RetrospectiveForm({ sessionId }: { sessionId: string }) {
  const [content, setContent] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "skipped">(
    "idle",
  );

  async function save() {
    const text = content.trim();
    if (text.length === 0 || state === "saving") return;
    setState("saving");
    try {
      const res = await fetch(`/api/session/${sessionId}/retrospective`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(data?.error?.message ?? "Could not save that.");
      }
      setState("saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
      setState("idle");
    }
  }

  if (state === "skipped") return null;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {state === "saved" ? (
        <motion.figure
          key="saved"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex w-full flex-col gap-1 border-l-2 border-[color:var(--lavender-400)] pl-4 text-left"
        >
          <figcaption className="flex items-center gap-1.5 font-semibold tracking-widest text-[color:var(--lavender-800)] text-[var(--text-2xs)] uppercase">
            <SavedCheck />
            Your note to yesterday-you
          </figcaption>
          <blockquote className="whitespace-pre-wrap text-[color:var(--color-ink-muted)] text-[var(--text-sm)]">
            {content.trim()}
          </blockquote>
        </motion.figure>
      ) : (
        <motion.div
          key="form"
          initial={false}
          exit={{ opacity: 0, height: 0 }}
          className="flex w-full flex-col gap-3 text-left"
        >
          <div className="font-medium text-[color:var(--color-ink)] text-[var(--text-sm)]">
            One last thing. What would you tell yesterday-you about this
            problem?
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="The thing that finally made it click was..."
            aria-label="Your reflection"
            className="w-full resize-y rounded-[var(--radius-md)] border border-[color:var(--border-soft)] bg-white/70 p-3 text-[color:var(--color-ink)] text-[var(--text-sm)] placeholder:text-[color:var(--color-ink-subtle)] focus:bg-white focus:ring-2 focus:ring-[color:var(--lavender-400)]/60 focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="subtle"
              loading={state === "saving"}
              disabled={content.trim().length === 0}
              onClick={() => void save()}
            >
              Save reflection
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setState("skipped")}
            >
              Skip
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SavedCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <motion.path
        d="M2.5 6.5 5 9l4.5-6"
        stroke="var(--lavender-800)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      />
    </svg>
  );
}
