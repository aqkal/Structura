/**
 * Shared motion vocabulary.
 *
 * Single source of truth for animation timing so every surface moves with
 * the same personality: quick, soft, settled. Client components import
 * these into framer-motion props. `<MotionConfig reducedMotion="user">`
 * is mounted once in the root layout, so variants here automatically
 * respect prefers-reduced-motion.
 */
import type { Transition, Variants } from "framer-motion";

/** Snappy spring for small elements: buttons, chips, pills, icons. */
export const springSnappy: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
};

/** Soft spring for large surfaces: cards, drawers, panels. */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 26,
};

/** Duration tokens in seconds, matching the CSS 150ms convention. */
export const durations = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
} as const;

/** Cubic bezier matching the CSS --ease-out token. */
export const easeOutCurve: [number, number, number, number] = [
  0.2, 0.7, 0.2, 1,
];

/** Fade + rise. The default entrance for cards and list items. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.base, ease: easeOutCurve },
  },
};

/** Plain fade for surfaces where movement would distract. */
export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: durations.base, ease: easeOutCurve },
  },
};

/** Scale-settle for popovers, dialogs, and menus. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: springSoft },
};

/** Hero entrance: blur clears as the line rises. */
export const blurUp: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: durations.slow, ease: easeOutCurve },
  },
};

/**
 * Parent that staggers its children's `hidden` -> `visible` variants.
 * Children must declare their own variants (e.g. `fadeUp`).
 */
export const staggerContainer = (
  stagger = 0.06,
  delayChildren = 0,
): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});
