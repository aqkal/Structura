import type { Transition, Variants } from "framer-motion";

export const springSnappy: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
};

export const springSoft: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 26,
};

export const durations = {
  fast: 0.15,
  base: 0.25,
  slow: 0.4,
} as const;

export const easeOutCurve: [number, number, number, number] = [
  0.2, 0.7, 0.2, 1,
];

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.base, ease: easeOutCurve },
  },
};

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: durations.base, ease: easeOutCurve },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: springSoft },
};

export const blurUp: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: durations.slow, ease: easeOutCurve },
  },
};

export const staggerContainer = (
  stagger = 0.06,
  delayChildren = 0,
): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});
