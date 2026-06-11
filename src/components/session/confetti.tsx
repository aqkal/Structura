"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const COLORS = [
  "var(--mint-300)",
  "var(--mint-500)",
  "var(--lavender-300)",
  "var(--lavender-400)",
];

type Particle = {
  id: number;
  x: number;
  drift: number;
  size: number;
  round: boolean;
  delay: number;
  duration: number;
  rotate: number;
  color: string;
};

export function Confetti({ count = 40 }: { count?: number }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const t = setTimeout(() => {
      setParticles(
        Array.from({ length: count }, (_, i) => ({
          id: i,
          x: 5 + Math.random() * 90,
          drift: (Math.random() - 0.5) * 90,
          size: 4 + Math.random() * 4,
          round: Math.random() > 0.5,
          delay: Math.random() * 0.3,
          duration: 1.2 + Math.random() * 0.8,
          rotate: (Math.random() - 0.5) * 540,
          color: COLORS[i % COLORS.length],
        })),
      );
    }, 0);
    return () => clearTimeout(t);
  }, [count]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-[300px] overflow-hidden"
    >
      {particles.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: -12, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: 300, x: p.drift, rotate: p.rotate, opacity: [1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: 0,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.round ? "50%" : 2,
          }}
        />
      ))}
    </div>
  );
}
