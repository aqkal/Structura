"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { springSoft } from "@/lib/motion";

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={springSoft}
      className="glass w-full max-w-[460px] rounded-[var(--radius-lg)] p-8"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {children}
    </motion.div>
  );
}
