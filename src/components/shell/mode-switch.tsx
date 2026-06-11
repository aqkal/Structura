"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { springSnappy } from "@/lib/motion";

type Mode = {
  label: string;
  href: string;
  match: (pathname: string) => boolean;
};

const MODES: Mode[] = [
  { label: "Chat", href: "/chat", match: (p) => p.startsWith("/chat") },
  {
    label: "Guided",
    href: "/session/new",
    match: (p) => p.startsWith("/session"),
  },
];

export function ModeSwitch() {
  const pathname = usePathname() ?? "";
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  return (
    <div
      className={cn(
        "glass-soft inline-flex items-center gap-0.5 rounded-full p-0.5",
      )}
      role="navigation"
      aria-label="Mode"
    >
      {MODES.map((mode) => {
        const active = pendingHref
          ? mode.href === pendingHref
          : mode.match(pathname);
        return (
          <Link
            key={mode.href}
            href={mode.href}
            onClick={() => setPendingHref(mode.href)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative rounded-full px-3.5 py-1.5 font-medium text-[var(--text-xs)] transition-colors",
              active
                ? "text-[color:var(--color-ink)]"
                : "text-[color:var(--color-ink-subtle)] hover:text-[color:var(--color-ink)]",
            )}
          >
            {active && (
              <motion.span
                layoutId="mode-switch-pill"
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-white/85 shadow-[var(--shadow-glass)]"
                transition={springSnappy}
              />
            )}
            <span className="relative">{mode.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
