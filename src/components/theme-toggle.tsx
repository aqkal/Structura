"use client";

import { useEffect, useId, useState } from "react";
import { motion } from "framer-motion";

import { springSnappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type ThemeChoice = "light" | "system" | "dark";

const STORAGE_KEY = "structura-theme";

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyTheme(choice: ThemeChoice) {
  const dark =
    choice === "dark" || (choice === "system" && systemPrefersDark());
  if (dark) document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
}

export function ThemeToggle({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const [choice, setChoice] = useState<ThemeChoice | null>(null);
  const instanceId = useId();

  useEffect(() => {
    const t = setTimeout(() => {
      const stored = localStorage.getItem(STORAGE_KEY);
      setChoice(
        stored === "light" || stored === "dark" || stored === "system"
          ? stored
          : "system",
      );
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  function select(next: ThemeChoice) {
    setChoice(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  const options: {
    value: ThemeChoice;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { value: "light", label: "Light", icon: <SunIcon /> },
    { value: "system", label: "System", icon: <MonitorIcon /> },
    { value: "dark", label: "Dark", icon: <MoonIcon /> },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "glass-soft inline-flex gap-0.5 rounded-full p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const active = choice === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${opt.label} theme`}
            title={compact ? `${opt.label} theme` : undefined}
            onClick={() => select(opt.value)}
            className={cn(
              "relative inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-full font-medium text-[var(--text-xs)] transition-colors",
              compact ? "flex-1 px-2.5 py-1.5" : "px-3.5 py-1.5",
              active
                ? "text-[color:var(--color-ink)]"
                : "text-[color:var(--color-ink-subtle)] hover:text-[color:var(--color-ink)]",
            )}
          >
            {active && choice !== null && (
              <motion.span
                layoutId={`theme-toggle-pill-${instanceId}`}
                transition={springSnappy}
                className="absolute inset-0 rounded-full bg-white/85"
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {opt.icon}
              {!compact && opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1.5v1.7M8 12.8v1.7M14.5 8h-1.7M3.2 8H1.5M12.6 3.4l-1.2 1.2M4.6 11.4l-1.2 1.2M12.6 12.6l-1.2-1.2M4.6 4.6 3.4 3.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect
        x="1.8"
        y="3"
        width="12.4"
        height="8"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M6 13.5h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M13.5 9.8A6 6 0 0 1 6.2 2.5a6 6 0 1 0 7.3 7.3Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}
