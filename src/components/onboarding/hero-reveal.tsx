"use client";

import { motion } from "framer-motion";

import { blurUp, fadeUp, staggerContainer } from "@/lib/motion";

export function HeroReveal({
  children,
  className,
  stagger = 0.08,
  delayChildren = 0,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  delayChildren?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer(stagger, delayChildren)}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function HeroItem({
  children,
  className,
  variant = "blurUp",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "blurUp" | "fadeUp";
}) {
  return (
    <motion.div
      className={className}
      variants={variant === "blurUp" ? blurUp : fadeUp}
    >
      {children}
    </motion.div>
  );
}
