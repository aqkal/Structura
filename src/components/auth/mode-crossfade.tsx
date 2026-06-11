"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useRef, useState, type ReactNode } from "react";

import { durations, easeOutCurve } from "@/lib/motion";

const PAD = 8;

export function ModeCrossfade({
  modeKey,
  children,
}: {
  modeKey: string;
  children: ReactNode;
}) {
  const observerRef = useRef<ResizeObserver | null>(null);
  const [height, setHeight] = useState<number | null>(null);

  const measureRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      setHeight(node.offsetHeight);
    });
    observer.observe(node);
    observerRef.current = observer;
  }, []);

  return (
    <motion.div
      className="relative -m-2 overflow-hidden p-2"
      animate={height === null ? undefined : { height: height + PAD * 2 }}
      transition={{ duration: durations.base, ease: easeOutCurve }}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={modeKey}
          ref={measureRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: durations.fast, ease: easeOutCurve }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
