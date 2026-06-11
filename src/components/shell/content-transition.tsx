"use client";

import { motion } from "framer-motion";

import { easeOutCurve } from "@/lib/motion";

/**
 * Soft enter animation for the main pane, played when the section mounts.
 *
 * Deliberately NOT keyed by pathname: this wrapper lives inside the
 * section layouts, which already remount when you cross sections (chat,
 * session, settings, home), so the fade plays exactly then. Keying by
 * pathname would remount the page content, and therefore destroy client
 * state, on every URL change, including the in-place
 * history.replaceState that promotes a brand-new chat to /chat/{id}.
 */
export function ContentTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      // Between durations.fast and durations.base: present but unobtrusive.
      transition={{ duration: 0.18, ease: easeOutCurve }}
    >
      {children}
    </motion.div>
  );
}
