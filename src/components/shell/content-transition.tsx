"use client";

import { motion } from "framer-motion";

import { easeOutCurve } from "@/lib/motion";

export function ContentTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: easeOutCurve }}
    >
      {children}
    </motion.div>
  );
}
