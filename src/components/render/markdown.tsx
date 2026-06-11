"use client";

import { Component, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import { cn } from "@/lib/utils";

function normalizeMath(source: string): string {
  return source
    .replace(/\\\[/g, () => "\n$$\n")
    .replace(/\\\]/g, () => "\n$$\n")
    .replace(/\\\(/g, () => "$")
    .replace(/\\\)/g, () => "$");
}

const KATEX_OPTIONS = {
  strict: "ignore" as const,
  errorColor: "var(--lavender-600)",
};

class MarkdownErrorBoundary extends Component<
  { raw: string; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <p className="whitespace-pre-wrap text-[color:var(--color-ink)]">
          {this.props.raw}
        </p>
      );
    }
    return this.props.children;
  }
}

function PreWithCopy({
  node: _node,
  children,
  ...rest
}: React.HTMLAttributes<HTMLPreElement> & { node?: unknown }) {
  const preRef = useRef<HTMLPreElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function copy() {
    const text = preRef.current?.textContent ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  return (
    <div className="group/code relative">
      <pre ref={preRef} {...rest}>
        {children}
      </pre>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={copied ? "Copied" : "Copy code"}
        title="Copy code"
        className={cn(
          "absolute top-1.5 right-1.5 inline-flex h-7 w-7 items-center justify-center",
          "rounded-[var(--radius-sm)] border border-[color:var(--border-soft)] bg-white/80",
          "text-[color:var(--color-ink-muted)] backdrop-blur-sm transition-opacity",
          "hover:text-[color:var(--color-ink)]",
          "opacity-0 group-hover/code:opacity-100 focus-visible:opacity-100",
          "[@media(hover:none)]:opacity-100",
        )}
      >
        {copied ? (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2.5 6.5 4.75 8.75 9.5 3.5"
              stroke="var(--mint-700)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="4"
              y="4"
              width="6"
              height="6"
              rx="1.2"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path
              d="M8 4V2.75A.75.75 0 0 0 7.25 2h-4.5a.75.75 0 0 0-.75.75v4.5c0 .414.336.75.75.75H4"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

const MARKDOWN_COMPONENTS = {
  pre: PreWithCopy,
};

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("md-body", className)}>
      <MarkdownErrorBoundary raw={children}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[[rehypeKatex, KATEX_OPTIONS]]}
          components={MARKDOWN_COMPONENTS}
        >
          {normalizeMath(children)}
        </ReactMarkdown>
      </MarkdownErrorBoundary>
    </div>
  );
}
