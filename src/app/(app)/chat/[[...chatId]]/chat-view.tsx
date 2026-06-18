"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import { AttachmentChip } from "@/components/chat/attachment-chip";
import { emitChatCreated, emitChatTitled } from "@/components/chat/chat-events";
import type { ChatAttachment, ChatMessage } from "@/components/chat/chat-types";
import { MessageRow } from "@/components/chat/message-row";
import { ModelSelect } from "@/components/chat/model-select";
import { TypingDots } from "@/components/chat/typing-dots";
import { Markdown } from "@/components/render/markdown";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_CHAT_MODEL,
  isChatModelId,
  type ChatModelId,
} from "@/lib/chat-models";
import {
  durations,
  easeOutCurve,
  fadeUp,
  springSnappy,
  staggerContainer,
} from "@/lib/motion";
import { streamPost, StreamTimeoutError } from "@/lib/stream";

export type { ChatAttachment, ChatMessage } from "@/components/chat/chat-types";

export type ChatViewInitial = {
  chatId: string | null;
  messages: ChatMessage[];
};

type ChatViewProps = {
  initial: ChatViewInitial;
  userId: string;

  userName?: string | null;
};

const MODEL_STORAGE_KEY = "structura-chat-model";
const MAX_PENDING = 3;
const MAX_BYTES = 10 * 1024 * 1024;
const IDLE_TIMEOUT_MS = 30000;
const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const SUGGESTIONS = [
  {
    label: "A math problem",
    text: "I'm stuck on a quadratic equation. Can you help me figure out where my reasoning goes wrong?",
  },
  {
    label: "A physics concept",
    text: "I want to reason through Newton's second law. Ask me questions to check my understanding.",
  },
  {
    label: "An essay thesis",
    text: "My essay thesis feels weak. Can you question it so I can make it stronger?",
  },
] as const;

type PendingFile = {
  localId: string;
  file: File;
  status: "uploading" | "done" | "error";
  attachmentId?: string;
  previewUrl?: string;

  errorReason?: string;

  canRetry?: boolean;
};

type StreamMode = "send" | "regenerate";

function isBudgetError(err: unknown): boolean {
  return err instanceof Error && /budget/i.test(err.message);
}

function autoSize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
}

export function ChatView({ initial, userName }: ChatViewProps) {
  const [chatId, setChatId] = useState<string | null>(initial.chatId);
  const [messages, setMessages] = useState<ChatMessage[]>(initial.messages);
  const [input, setInput] = useState("");
  const [streamingText, setStreamingText] = useState("");
  const [streamMode, setStreamMode] = useState<StreamMode | null>(null);
  const [model, setModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [showJump, setShowJump] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [budget, setBudget] = useState<{ used: number; budget: number } | null>(
    null,
  );
  const [budgetExhausted, setBudgetExhausted] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const streamInFlightRef = useRef(false);
  const ensureChatPromiseRef = useRef<Promise<string> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);

  const pinnedRef = useRef(true);

  const streamTextRef = useRef("");

  const lastUserContentRef = useRef("");
  const dragCounterRef = useRef(0);

  const objectUrlsRef = useRef<Set<string>>(new Set());

  const freshChatRef = useRef(initial.chatId === null);

  const chatIdRef = useRef<string | null>(initial.chatId);

  const streaming = streamMode !== null;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(MODEL_STORAGE_KEY);
    if (!isChatModelId(saved)) return;
    const t = setTimeout(() => setModel(saved), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      abortRef.current?.abort();
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
      urls.clear();
    };
  }, []);

  useEffect(() => {
    const scroller = rootRef.current?.closest("main");
    if (!scroller) return;
    scrollerRef.current = scroller;

    const onScroll = () => {
      const nearBottom =
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
      pinnedRef.current = nearBottom;
      if (nearBottom) setShowJump(false);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (pinnedRef.current) {
      const scroller = scrollerRef.current;
      if (scroller) {
        scroller.scrollTo({ top: scroller.scrollHeight, behavior: "auto" });
      } else {
        bottomRef.current?.scrollIntoView({ block: "end" });
      }
      return;
    }
    const t = setTimeout(() => setShowJump(true), 0);
    return () => clearTimeout(t);
  }, [messages, streamingText]);

  useEffect(() => {
    if (!pinnedRef.current) return;
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: "auto" });
    }
  }, [pendingFiles]);

  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, []);

  function persistModel(id: ChatModelId) {
    setModel(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(MODEL_STORAGE_KEY, id);
    }
  }

  function revokeUrl(url: string | undefined) {
    if (!url) return;
    URL.revokeObjectURL(url);
    objectUrlsRef.current.delete(url);
  }

  const readBudgetHeaders = useCallback((headers: Headers) => {
    const used = Number(headers.get("x-ai-used"));
    const total = Number(headers.get("x-ai-budget"));
    if (Number.isFinite(used) && Number.isFinite(total) && total > 0) {
      setBudget({ used, budget: total });
    }
  }, []);

  const finalizePartial = useCallback(() => {
    const partial = streamTextRef.current;
    if (partial.length > 0) {
      setMessages((prev) => [...prev, { role: "assistant", content: partial }]);
    }
    setStreamingText("");
    streamTextRef.current = "";
  }, []);

  const restoreOrKeepPartial = useCallback((backup: ChatMessage) => {
    const partial = streamTextRef.current;
    setMessages((prev) => [
      ...prev,
      partial.length > 0 ? { role: "assistant", content: partial } : backup,
    ]);
    setStreamingText("");
    streamTextRef.current = "";
  }, []);

  const maybeRefreshFreshChat = useCallback(() => {
    if (!freshChatRef.current) return;
    const id = chatIdRef.current;
    if (id === null) return;
    freshChatRef.current = false;
    window.history.replaceState(null, "", `/chat/${id}`);
    void fetch(`/api/chat/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { id: string; title: string } | null) => {
        if (data?.title && data.title !== "New chat") {
          emitChatTitled({ id, title: data.title });
        }
      })
      .catch(() => {});
  }, []);

  const pathname = usePathname();
  useEffect(() => {
    if (initial.chatId !== null) return;
    if (pathname !== "/chat" || chatIdRef.current === null) return;
    const t = setTimeout(() => {
      abortRef.current?.abort();
      chatIdRef.current = null;
      freshChatRef.current = true;
      ensureChatPromiseRef.current = null;
      streamTextRef.current = "";
      lastUserContentRef.current = "";
      pinnedRef.current = true;
      setChatId(null);
      setMessages([]);
      setInput("");
      setStreamingText("");
      setStreamMode(null);
      setPendingFiles((prev) => {
        for (const p of prev) revokeUrl(p.previewUrl);
        return [];
      });
      setShowJump(false);
      setTimedOut(false);
      setBudgetExhausted(false);
    }, 0);
    return () => clearTimeout(t);
  }, [pathname, initial.chatId]);

  function ensureChat(): Promise<string> {
    if (chatId !== null) return Promise.resolve(chatId);
    if (ensureChatPromiseRef.current) return ensureChatPromiseRef.current;

    const creation = (async () => {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(
          data?.error?.message ?? "Could not start the conversation.",
        );
      }
      const created = (await res.json()) as { id: string };
      setChatId(created.id);
      chatIdRef.current = created.id;
      freshChatRef.current = true;
      emitChatCreated({ id: created.id });
      return created.id;
    })();

    ensureChatPromiseRef.current = creation;
    creation.catch(() => {
      ensureChatPromiseRef.current = null;
    });
    return creation;
  }

  async function uploadPending(targetChatId: string, pending: PendingFile) {
    const form = new FormData();
    form.append("file", pending.file);

    try {
      const res = await fetch(`/api/chat/${targetChatId}/upload`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(data?.error?.message ?? "Upload failed");
      }
      const result = (await res.json()) as { id: string };
      setPendingFiles((prev) =>
        prev.map((p) =>
          p.localId === pending.localId
            ? {
                ...p,
                status: "done",
                attachmentId: result.id,
                errorReason: undefined,
              }
            : p,
        ),
      );
    } catch (err) {
      setPendingFiles((prev) =>
        prev.map((p) =>
          p.localId === pending.localId
            ? {
                ...p,
                status: "error",
                errorReason:
                  err instanceof Error ? err.message : "Upload failed",
                canRetry: true,
              }
            : p,
        ),
      );
    }
  }

  async function handleFilesPicked(fileList: FileList | File[] | null) {
    if (!fileList) return;
    const picked = Array.from(fileList);
    if (picked.length === 0) return;

    const slotsLeft = MAX_PENDING - pendingFiles.length;
    if (slotsLeft <= 0) {
      toast.error("You can attach up to 3 files per message.");
      return;
    }

    const accepted: PendingFile[] = [];
    const invalid: PendingFile[] = [];
    for (const file of picked) {
      if (accepted.length + invalid.length >= slotsLeft) {
        toast.error("You can attach up to 3 files per message.");
        break;
      }
      const localId = `${Date.now()}-${accepted.length + invalid.length}-${file.name}`;
      if (!ALLOWED_TYPES.includes(file.type)) {
        invalid.push({
          localId,
          file,
          status: "error",
          errorReason: "Not an image or PDF",
        });
        continue;
      }
      if (file.size > MAX_BYTES) {
        invalid.push({
          localId,
          file,
          status: "error",
          errorReason: "Too large. 10 MB max",
        });
        continue;
      }
      let previewUrl: string | undefined;
      if (file.type.startsWith("image/")) {
        previewUrl = URL.createObjectURL(file);
        objectUrlsRef.current.add(previewUrl);
      }
      accepted.push({ localId, file, status: "uploading", previewUrl });
    }

    if (accepted.length === 0 && invalid.length === 0) return;
    setPendingFiles((prev) => [...prev, ...invalid, ...accepted]);
    if (accepted.length === 0) return;

    try {
      const targetChatId = await ensureChat();
      await Promise.all(accepted.map((p) => uploadPending(targetChatId, p)));
    } catch (err) {
      const ids = new Set(accepted.map((p) => p.localId));
      setPendingFiles((prev) =>
        prev.map((p) =>
          ids.has(p.localId)
            ? {
                ...p,
                status: "error",
                errorReason: "Could not start the chat",
                canRetry: true,
              }
            : p,
        ),
      );
      toast.error(
        err instanceof Error
          ? err.message
          : "Could not start the conversation.",
      );
    }
  }

  async function retryPending(localId: string) {
    const target = pendingFiles.find((p) => p.localId === localId);
    if (!target || target.status !== "error" || !target.canRetry) return;

    setPendingFiles((prev) =>
      prev.map((p) =>
        p.localId === localId
          ? { ...p, status: "uploading", errorReason: undefined }
          : p,
      ),
    );
    try {
      const targetChatId = await ensureChat();
      await uploadPending(targetChatId, target);
    } catch {
      setPendingFiles((prev) =>
        prev.map((p) =>
          p.localId === localId
            ? {
                ...p,
                status: "error",
                errorReason: "Could not start the chat",
                canRetry: true,
              }
            : p,
        ),
      );
    }
  }

  function removePending(localId: string) {
    setPendingFiles((prev) => {
      const target = prev.find((p) => p.localId === localId);
      revokeUrl(target?.previewUrl);
      return prev.filter((p) => p.localId !== localId);
    });
  }

  const uploading = pendingFiles.some((p) => p.status === "uploading");

  async function sendMessage(content: string) {
    if (streamInFlightRef.current) return;
    streamInFlightRef.current = true;

    const sentFiles = pendingFiles;
    const attachmentIds = sentFiles
      .filter((p) => p.status === "done" && p.attachmentId)
      .map((p) => p.attachmentId as string);
    const optimisticAttachments: ChatAttachment[] = sentFiles
      .filter((p) => p.status === "done" && p.attachmentId)
      .map((p) => ({
        id: p.attachmentId as string,
        mediaType: p.file.type,
        fileName: p.file.name,
      }));

    setStreamMode("send");
    setTimedOut(false);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content,
        attachments:
          optimisticAttachments.length > 0 ? optimisticAttachments : undefined,
      },
    ]);
    setStreamingText("");
    streamTextRef.current = "";
    setPendingFiles([]);
    lastUserContentRef.current = content;

    pinnedRef.current = true;
    setShowJump(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const id = await ensureChat();

      const { text } = await streamPost(
        `/api/chat/${id}/message`,
        { content, model, attachmentIds },
        (full) => {
          streamTextRef.current = full;
          setStreamingText(full);
        },
        controller.signal,
        { idleTimeoutMs: IDLE_TIMEOUT_MS, onHeaders: readBudgetHeaders },
      );

      setMessages((prev) => [...prev, { role: "assistant", content: text }]);
      setStreamingText("");
      streamTextRef.current = "";

      for (const p of sentFiles) revokeUrl(p.previewUrl);

      maybeRefreshFreshChat();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        finalizePartial();
        for (const p of sentFiles) revokeUrl(p.previewUrl);
        maybeRefreshFreshChat();
        return;
      }
      if (err instanceof StreamTimeoutError) {
        finalizePartial();
        for (const p of sentFiles) revokeUrl(p.previewUrl);
        setTimedOut(true);
        return;
      }

      setMessages((prev) => {
        const next = [...prev];
        if (next.length > 0 && next[next.length - 1].role === "user") {
          next.pop();
        }
        return next;
      });
      setInput(content);
      setPendingFiles(sentFiles);
      setStreamingText("");
      streamTextRef.current = "";
      if (isBudgetError(err)) {
        setBudgetExhausted(true);
      } else {
        toast.error(
          err instanceof Error ? err.message : "Something went wrong.",
        );
      }
    } finally {
      setStreamMode(null);
      streamInFlightRef.current = false;
      abortRef.current = null;
    }
  }

  async function send() {
    const content = input.trim();
    if (content.length === 0 || streaming || uploading) return;
    await sendMessage(content);
  }

  const regenerate = useCallback(async () => {
    if (streamInFlightRef.current || chatId === null) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    streamInFlightRef.current = true;

    const backup = last;
    setMessages((prev) => prev.slice(0, -1));
    setStreamMode("regenerate");
    setTimedOut(false);
    setStreamingText("");
    streamTextRef.current = "";
    pinnedRef.current = true;
    setShowJump(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { text } = await streamPost(
        `/api/chat/${chatId}/regenerate`,
        {},
        (full) => {
          streamTextRef.current = full;
          setStreamingText(full);
        },
        controller.signal,
        { idleTimeoutMs: IDLE_TIMEOUT_MS, onHeaders: readBudgetHeaders },
      );
      setMessages((prev) => [...prev, { role: "assistant", content: text }]);
      setStreamingText("");
      streamTextRef.current = "";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        restoreOrKeepPartial(backup);
        return;
      }
      if (err instanceof StreamTimeoutError) {
        restoreOrKeepPartial(backup);
        setTimedOut(true);
        return;
      }

      setMessages((prev) => [...prev, backup]);
      setStreamingText("");
      streamTextRef.current = "";
      if (isBudgetError(err)) {
        setBudgetExhausted(true);
      } else {
        toast(err instanceof Error ? err.message : "Could not regenerate.");
      }
    } finally {
      setStreamMode(null);
      streamInFlightRef.current = false;
      abortRef.current = null;
    }
  }, [chatId, messages, readBudgetHeaders, restoreOrKeepPartial]);

  const editLastUser = useCallback(async () => {
    if (streamInFlightRef.current || chatId === null) return;
    try {
      const res = await fetch(`/api/chat/${chatId}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        userContent?: string;
        error?: { message?: string };
      } | null;
      if (!res.ok) {
        toast(data?.error?.message ?? "Nothing to edit right now.");
        return;
      }
      setMessages((prev) => {
        const next = [...prev];
        while (next.length > 0 && next[next.length - 1].role === "assistant") {
          next.pop();
        }
        if (next.length > 0 && next[next.length - 1].role === "user") {
          next.pop();
        }
        return next;
      });
      setInput(data?.userContent ?? "");
      setTimedOut(false);
      setTimeout(() => {
        const el = textareaRef.current;
        if (el) {
          el.focus();
          autoSize(el);
        }
      }, 0);
    } catch {
      toast.error("Could not edit that message.");
    }
  }, [chatId]);

  async function retryAfterTimeout() {
    if (streamInFlightRef.current) return;
    setTimedOut(false);

    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && chatId !== null) {
      await regenerate();
      return;
    }

    const content = lastUserContentRef.current;
    if (chatId === null || content.length === 0) return;
    try {
      await fetch(`/api/chat/${chatId}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {}
    setMessages((prev) => {
      const next = [...prev];
      while (next.length > 0 && next[next.length - 1].role === "assistant") {
        next.pop();
      }
      if (next.length > 0 && next[next.length - 1].role === "user") {
        next.pop();
      }
      return next;
    });
    await sendMessage(content);
  }

  function stopStreaming() {
    abortRef.current?.abort();
  }

  function jumpToLatest() {
    pinnedRef.current = true;
    setShowJump(false);
    const scroller = scrollerRef.current;
    if (scroller) {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    } else {
      bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    }
  }

  function prefillSuggestion(text: string) {
    setInput(text);
    const el = textareaRef.current;
    if (el) {
      el.focus();
      requestAnimationFrame(() => autoSize(el));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!streaming) void send();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData?.files ?? []);
    if (files.length === 0) return;
    e.preventDefault();
    void handleFilesPicked(files);
  }

  function hasFiles(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).includes("Files");
  }
  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setDragActive(true);
  }
  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    if (!hasFiles(e)) return;
    e.preventDefault();
  }
  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (!hasFiles(e)) return;
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setDragActive(false);
  }
  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setDragActive(false);
    void handleFilesPicked(e.dataTransfer.files);
  }

  const empty = messages.length === 0 && !streaming;
  const canSend = input.trim().length > 0 && !streaming && !uploading;

  const trimmedName = userName?.trim() ?? "";
  const firstName = trimmedName.length > 0 ? trimmedName.split(/\s+/)[0] : null;

  let lastAssistantIndex = -1;
  let lastUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (lastAssistantIndex === -1 && messages[i].role === "assistant") {
      lastAssistantIndex = i;
    }
    if (lastUserIndex === -1 && messages[i].role === "user") {
      lastUserIndex = i;
    }
    if (lastAssistantIndex !== -1 && lastUserIndex !== -1) break;
  }

  const showBudgetLine =
    budget !== null && budget.budget > 0 && budget.used >= budget.budget * 0.5;

  return (
    <div
      ref={rootRef}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex min-h-[calc(100dvh-12rem)] flex-1 flex-col"
    >
      <AnimatePresence>
        {dragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: durations.fast }}
            className="glass-soft pointer-events-none absolute inset-0 z-30 rounded-[var(--radius-lg)] border-2 border-dashed border-[color:var(--lavender-400)]"
          >
            <div className="sticky top-[35dvh] flex flex-col items-center gap-2 px-6 text-center">
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M8 4.5h10L26.5 13v13a2 2 0 0 1-2 2h-16.5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2Z"
                  stroke="var(--mint-700)"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="M18 5v8h8"
                  stroke="var(--mint-700)"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="M16 24v-7m0 0-3 3m3-3 3 3"
                  stroke="var(--lavender-600)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="font-medium text-[color:var(--color-ink)] text-[var(--text-sm)]">
                Drop images or PDFs
              </p>
              <p className="text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
                Up to 3 files, 10 MB each
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1">
        {empty ? (
          <motion.div
            variants={staggerContainer(0.08)}
            initial="hidden"
            animate="visible"
            className="flex min-h-[40dvh] flex-col items-center justify-center gap-3 text-center"
          >
            <motion.h1
              variants={fadeUp}
              className="font-semibold tracking-[-0.02em] text-[color:var(--mint-900)] text-[var(--text-2xl)]"
            >
              {firstName
                ? `What are you working on, ${firstName}?`
                : "What are you working on?"}
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="text-[color:var(--color-ink-muted)] text-[var(--text-base)]"
            >
              I won&apos;t hand you the answer. I&apos;ll help you find it.
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="mt-2 flex flex-wrap items-center justify-center gap-2"
            >
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => prefillSuggestion(s.text)}
                  className="pill transition-colors hover:bg-white/60 hover:text-[color:var(--color-ink)]"
                >
                  {s.label}
                </button>
              ))}
            </motion.div>
          </motion.div>
        ) : (
          <div className="mx-auto flex w-full max-w-[var(--reading-max)] flex-col gap-5">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <MessageRow
                  key={`m-${i}`}
                  message={m}
                  chatId={chatId}
                  isLastAssistant={
                    m.role === "assistant" && i === lastAssistantIndex
                  }
                  isLastUser={m.role === "user" && i === lastUserIndex}
                  busy={streaming}
                  onRegenerate={regenerate}
                  onEditLastUser={editLastUser}
                />
              ))}
            </AnimatePresence>

            {streaming && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: durations.base, ease: easeOutCurve }}
                className="flex flex-col gap-1.5"
                aria-live="polite"
                aria-busy="true"
              >
                <div className="font-semibold tracking-[0.18em] text-[color:var(--lavender-800)] text-[var(--text-2xs)] uppercase">
                  Qualia
                </div>
                <AnimatePresence mode="wait" initial={false}>
                  {streamingText.length > 0 ? (
                    <motion.div
                      key="text"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={{ duration: durations.fast }}
                    >
                      <Markdown className="text-[color:var(--color-ink)] text-[var(--text-sm)]">
                        {streamingText}
                      </Markdown>
                      <span className="stream-caret" aria-hidden="true" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="dots"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      transition={{ duration: durations.fast }}
                    >
                      <TypingDots />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            <AnimatePresence>
              {timedOut && !streaming && (
                <motion.div
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  className="glass-soft flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] px-4 py-3"
                >
                  <p className="text-[color:var(--color-ink-muted)] text-[var(--text-xs)]">
                    That took too long. Want to try again?
                  </p>
                  <Button
                    size="sm"
                    variant="subtle"
                    onClick={() => void retryAfterTimeout()}
                  >
                    Retry
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 mt-5 pb-2">
        <div className="relative mx-auto w-full max-w-[var(--reading-max)]">
          <AnimatePresence>
            {showJump && (
              <motion.button
                key="jump"
                type="button"
                onClick={jumpToLatest}
                initial={{ opacity: 0, y: 8, x: "-50%" }}
                animate={{ opacity: 1, y: 0, x: "-50%" }}
                exit={{
                  opacity: 0,
                  y: 6,
                  x: "-50%",
                  transition: { duration: 0.15 },
                }}
                transition={{ duration: durations.base, ease: easeOutCurve }}
                className="glass absolute -top-14 left-1/2 z-20 inline-flex h-10 items-center gap-2 rounded-[var(--radius-pill)] px-4 font-medium text-[color:var(--color-ink-muted)] text-[var(--text-xs)] transition-colors hover:text-[color:var(--color-ink)]"
              >
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-[color:var(--mint-500)]"
                />
                Jump to latest
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {budgetExhausted && (
              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                className="glass mb-2 flex flex-col gap-1.5 rounded-[var(--radius-lg)] p-4"
              >
                <p className="font-medium text-[color:var(--color-ink)] text-[var(--text-sm)]">
                  You have used today&apos;s AI budget.
                </p>
                <p className="text-[color:var(--color-ink-muted)] text-[var(--text-xs)]">
                  It resets at midnight UTC. Your work here is saved.
                </p>
                <div className="mt-1">
                  <Button
                    size="sm"
                    variant="subtle"
                    onClick={() => setBudgetExhausted(false)}
                  >
                    Okay
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {pendingFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {pendingFiles.map((p) => (
                <motion.div
                  key={`${p.localId}-${p.status}`}
                  initial={p.status === "done" ? { scale: 0.92 } : false}
                  animate={{ scale: 1 }}
                  transition={springSnappy}
                >
                  <AttachmentChip
                    fileName={p.file.name}
                    mediaType={p.file.type}
                    previewUrl={p.previewUrl}
                    status={p.status}
                    errorReason={p.errorReason}
                    onRetry={
                      p.canRetry
                        ? () => void retryPending(p.localId)
                        : undefined
                    }
                    onRemove={() => removePending(p.localId)}
                  />
                </motion.div>
              ))}
            </div>
          )}

          <div className="glass flex flex-col gap-2 rounded-[var(--radius-lg)] p-2">
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
                className="hidden"
                onChange={(e) => {
                  void handleFilesPicked(e.target.files);

                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={streaming || pendingFiles.length >= MAX_PENDING}
                aria-label="Attach a file"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--color-ink-muted)] transition-colors hover:bg-white/40 hover:text-[color:var(--color-ink)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M14.5 8.5L8.7 14.3a3.5 3.5 0 0 1-4.95-4.95l5.8-5.8a2.33 2.33 0 0 1 3.3 3.3l-5.8 5.8a1.17 1.17 0 0 1-1.65-1.65l5.3-5.3"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  autoSize(e.target);
                }}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                rows={1}
                placeholder="Ask, or tell me what you're stuck on."
                aria-label="Message Qualia"
                className="max-h-[200px] min-h-[2.5rem] flex-1 resize-none bg-transparent px-3 py-2 text-[16px] text-[color:var(--color-ink)] placeholder:text-[color:var(--color-ink-subtle)] focus:outline-none sm:text-[var(--text-sm)]"
              />
              <motion.button
                type="button"
                layout
                onClick={streaming ? stopStreaming : () => void send()}
                disabled={!streaming && !canSend}
                aria-label={streaming ? "Stop generating" : "Send message"}
                initial={false}
                animate={{ borderRadius: streaming ? 8 : 20 }}
                transition={springSnappy}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center bg-[#0d3320] text-[#f5fbf7] shadow-[var(--shadow-btn)] transition-colors hover:bg-[#16482c] disabled:cursor-not-allowed disabled:opacity-50 [@media(hover:none)]:h-11 [@media(hover:none)]:w-11"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {streaming ? (
                    <motion.span
                      key="stop"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ duration: 0.12 }}
                      className="inline-flex"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        aria-hidden="true"
                      >
                        <rect
                          x="3"
                          y="3"
                          width="8"
                          height="8"
                          rx="1.5"
                          fill="currentColor"
                        />
                      </svg>
                    </motion.span>
                  ) : (
                    <motion.span
                      key="send"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ duration: 0.12 }}
                      className="inline-flex"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        aria-hidden="true"
                      >
                        <path
                          d="M8 13V3M3.5 7.5 8 3l4.5 4.5"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
            <div className="flex items-center justify-between gap-2 px-1">
              <ModelSelect value={model} onChange={persistModel} />
              {showBudgetLine && budget ? (
                <span className="text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)]">
                  AI calls today: {Math.min(budget.used, budget.budget)} of{" "}
                  {budget.budget}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
