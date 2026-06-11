"use client";

import { memo, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { AttachmentChip } from "@/components/chat/attachment-chip";
import type { ChatMessage } from "@/components/chat/chat-types";
import { Markdown } from "@/components/render/markdown";
import { springSnappy } from "@/lib/motion";
import { cn } from "@/lib/utils";

type MessageRowProps = {
  message: ChatMessage;
  chatId: string | null;
  isLastAssistant: boolean;
  isLastUser: boolean;
  busy: boolean;
  onRegenerate: () => void;
  onEditLastUser: () => void;
};

export const MessageRow = memo(function MessageRow({
  message,
  chatId,
  isLastAssistant,
  isLastUser,
  busy,
  onRegenerate,
  onEditLastUser,
}: MessageRowProps) {
  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.15 } }}
        transition={springSnappy}
        className="group ml-auto flex max-w-[80%] flex-col items-end gap-1.5"
      >
        {message.attachments && message.attachments.length > 0 ? (
          <div className="flex flex-wrap justify-end gap-2">
            {message.attachments.map((att) => (
              <AttachmentChip
                key={att.id}
                fileName={att.fileName}
                mediaType={att.mediaType}
                previewUrl={
                  chatId
                    ? `/api/chat/${chatId}/attachment/${att.id}`
                    : undefined
                }
              />
            ))}
          </div>
        ) : null}
        {message.content.length > 0 ? (
          <div className="rounded-[var(--radius-lg)] rounded-br-md bg-[color:var(--mint-100)]/70 px-4 py-2.5 whitespace-pre-wrap text-[color:var(--color-ink)] text-[var(--text-sm)]">
            {message.content}
          </div>
        ) : null}
        {isLastUser && !busy ? (
          <ActionRow align="end">
            <ActionButton
              label="Edit and resend"
              onClick={onEditLastUser}
              icon={<PencilIcon />}
            />
          </ActionRow>
        ) : null}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={false}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      className="group flex flex-col gap-1.5"
    >
      <div className="font-semibold tracking-[0.18em] text-[color:var(--lavender-800)] text-[var(--text-2xs)] uppercase">
        Structura
      </div>
      <Markdown className="text-[color:var(--color-ink)] text-[var(--text-sm)]">
        {message.content}
      </Markdown>
      <ActionRow align="start">
        <CopyButton content={message.content} />
        {isLastAssistant && !busy ? (
          <ActionButton
            label="Regenerate response"
            onClick={onRegenerate}
            icon={<RefreshIcon />}
          />
        ) : null}
      </ActionRow>
    </motion.div>
  );
});

function ActionRow({
  align,
  children,
}: {
  align: "start" | "end";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-0.5",
        align === "end" ? "justify-end" : "justify-start",
        "opacity-0 transition-opacity duration-150",
        "group-hover:opacity-100 focus-within:opacity-100",
        "[@media(hover:none)]:opacity-100",
      )}
    >
      {children}
    </div>
  );
}

const actionButtonClass = cn(
  "inline-flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)]",
  "text-[color:var(--color-ink-subtle)] transition-colors",
  "hover:bg-white/50 hover:text-[color:var(--color-ink)]",
  "[@media(hover:none)]:h-11 [@media(hover:none)]:w-11",
);

function ActionButton({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={actionButtonClass}
    >
      {icon}
    </button>
  );
}

function CopyButton({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? "Copied" : "Copy message"}
      title="Copy message"
      className={actionButtonClass}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.span
            key="check"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={springSnappy}
            className="text-[color:var(--mint-700)]"
          >
            <CheckIcon />
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.1 }}
          >
            <CopyIcon />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="4.5"
        y="4.5"
        width="7"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M9.5 4.5V3.25A.75.75 0 0 0 8.75 2.5h-5.5a.75.75 0 0 0-.75.75v5.5c0 .414.336.75.75.75H4.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.75 7.5 5.5 10.25 11.25 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M11.5 7a4.5 4.5 0 1 1-1.32-3.18M11.5 2.5v2.25H9.25"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m2.5 11.5.4-2.4 6.35-6.35a1.2 1.2 0 0 1 1.7 0l.3.3a1.2 1.2 0 0 1 0 1.7L4.9 11.1l-2.4.4Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="m8.25 3.75 2 2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
