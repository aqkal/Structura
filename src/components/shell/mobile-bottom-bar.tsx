"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { springSnappy } from "@/lib/motion";

type Tab = {
  label: string;
  href: string;
  match: (pathname: string) => boolean;
  icon: React.ReactNode;
};

const TABS: Tab[] = [
  {
    label: "Chat",
    href: "/chat",
    match: (p) => p.startsWith("/chat"),
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 4.5h12a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5H8l-3.5 3v-3H3A1.5 1.5 0 0 1 1.5 11V6A1.5 1.5 0 0 1 3 4.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Guided",
    href: "/session/new",
    match: (p) => p.startsWith("/session"),
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="9"
          cy="9"
          r="6.75"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path
          d="m11.5 6.5-1.6 3.4-3.4 1.6 1.6-3.4 3.4-1.6Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

export function MobileBottomBar() {
  const pathname = usePathname() ?? "";
  const onChatRoute = pathname.startsWith("/chat");
  const newHref = onChatRoute ? "/chat" : "/session/new";
  const newLabel = onChatRoute ? "New chat" : "New problem";

  return (
    <nav
      aria-label="Primary"
      className="glass-soft fixed inset-x-0 bottom-0 z-40 border-t lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex h-14 items-stretch">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5",
                "font-medium text-[var(--text-2xs)] transition-colors",
                active
                  ? "text-[color:var(--color-ink)]"
                  : "text-[color:var(--color-ink-subtle)]",
              )}
            >
              {active && (
                <motion.span
                  layoutId="bottom-bar-active"
                  aria-hidden="true"
                  className="absolute inset-x-3 inset-y-1.5 rounded-full bg-white/70 shadow-[var(--shadow-glass)]"
                  transition={springSnappy}
                />
              )}
              <span className="relative">{tab.icon}</span>
              <span className="relative">{tab.label}</span>
            </Link>
          );
        })}

        <Link
          href={newHref}
          aria-label={newLabel}
          className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 font-medium text-[color:var(--mint-700)] text-[var(--text-2xs)] transition-colors"
        >
          <span className="relative">
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="9"
                cy="9"
                r="6.75"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M9 6v6M6 9h6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span className="relative">New</span>
        </Link>
      </div>
    </nav>
  );
}
