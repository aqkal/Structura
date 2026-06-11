"use client";

import { motion } from "framer-motion";

export function TypingDots({
  label = "Structura is thinking",
}: {
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className="glass-soft inline-flex w-fit items-center gap-1.5 rounded-[var(--radius-lg)] rounded-bl-md px-3.5 py-3"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className="block h-1.5 w-1.5 rounded-full bg-[color:var(--lavender-600)]"
          animate={{ y: [1, -3] }}
          transition={{
            duration: 0.4,
            repeat: Infinity,
            repeatType: "mirror",
            ease: "easeInOut",
            delay: i * 0.15,
          }}
        />
      ))}
    </div>
  );
}
