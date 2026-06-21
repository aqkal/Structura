"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";

import { FEEDBACK_EXTERNAL_URL, LS_CHAT_DONE } from "./feedback-config";

// Chat feedback: a small non-blocking popup that links out to the Tally form
// in a new tab. Opening it marks "done" so it never shows again.
export function ChatFeedbackPrompt({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (open && typeof window !== "undefined") {
      window.localStorage.setItem(LS_CHAT_DONE, "1");
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-label="Share feedback"
          className="glass-strong fixed right-4 bottom-24 z-50 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 rounded-[var(--radius-lg)] p-4 shadow-[var(--shadow-card)]"
        >
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-[color:var(--color-ink)] text-[var(--text-sm)]">
              How are you finding Qualia?
            </p>
            <p className="text-[color:var(--color-ink-muted)] text-[var(--text-xs)]">
              We&apos;re in beta and your feedback shapes what comes next. Mind
              sharing a quick thought?
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                window.open(
                  FEEDBACK_EXTERNAL_URL,
                  "_blank",
                  "noopener,noreferrer",
                );
                onClose();
              }}
            >
              Leave feedback
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>
              Not now
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
