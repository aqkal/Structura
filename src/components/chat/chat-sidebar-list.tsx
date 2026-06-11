"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";

import { SpotIllustration } from "@/components/ui/spot-illustration";
import { durations, easeOutCurve } from "@/lib/motion";

import { onChatCreated, onChatTitled } from "./chat-events";
import { ChatSidebarItem } from "./chat-sidebar-item";
import { NewChatButton } from "./new-chat-button";

export type SidebarChat = {
  id: string;
  title: string;
  updatedAt: string;
};

type ChatSidebarListProps = {
  chats: SidebarChat[];
};

type Group = {
  label: string;
  chats: SidebarChat[];
};

const UNDO_MS = 5000;

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function groupByRecency(chats: SidebarChat[]): Group[] {
  const today = startOfToday();
  const day = 24 * 60 * 60 * 1000;
  const yesterday = today - day;
  const sevenDaysAgo = today - 7 * day;

  const buckets: Record<string, SidebarChat[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    Older: [],
  };

  for (const chat of chats) {
    const t = new Date(chat.updatedAt).getTime();
    if (t >= today) buckets.Today.push(chat);
    else if (t >= yesterday) buckets.Yesterday.push(chat);
    else if (t >= sevenDaysAgo) buckets["Previous 7 days"].push(chat);
    else buckets.Older.push(chat);
  }

  return (["Today", "Yesterday", "Previous 7 days", "Older"] as const)
    .map((label) => ({ label, chats: buckets[label] }))
    .filter((g) => g.chats.length > 0);
}

export function ChatSidebarList({ chats }: ChatSidebarListProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const activeChatId = pathname.startsWith("/chat/")
    ? pathname.slice("/chat/".length).split("/")[0]
    : undefined;

  const [optimistic, setOptimistic] = useState<SidebarChat[]>([]);
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());

  const pendingDeletesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    return onChatCreated(({ id }) => {
      setOptimistic((prev) =>
        prev.some((c) => c.id === id)
          ? prev
          : [
              { id, title: "New chat", updatedAt: new Date().toISOString() },
              ...prev,
            ],
      );
    });
  }, []);

  const [titleOverrides, setTitleOverrides] = useState<
    ReadonlyMap<string, string>
  >(new Map());
  useEffect(() => {
    return onChatTitled(({ id, title }) => {
      setTitleOverrides((prev) => new Map(prev).set(id, title));
    });
  }, []);

  useEffect(() => {
    const pending = pendingDeletesRef.current;
    return () => {
      for (const [id, timer] of pending) {
        clearTimeout(timer);
        void fetch(`/api/chat/${id}`, { method: "DELETE", keepalive: true });
      }
      pending.clear();
    };
  }, []);

  const commitDelete = useCallback(
    async (id: string) => {
      pendingDeletesRef.current.delete(id);
      try {
        const res = await fetch(`/api/chat/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as {
            error?: { message?: string };
          } | null;
          throw new Error(data?.error?.message ?? "Could not delete the chat.");
        }
        router.refresh();
      } catch (err) {
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        toast.error(
          err instanceof Error ? err.message : "Could not delete the chat.",
        );
      }
    },
    [router],
  );

  const handleDelete = useCallback(
    (id: string) => {
      setHiddenIds((prev) => new Set(prev).add(id));

      const timer = setTimeout(() => {
        void commitDelete(id);
      }, UNDO_MS);
      pendingDeletesRef.current.set(id, timer);

      toast("Chat deleted", {
        duration: UNDO_MS - 500,
        action: {
          label: "Undo",
          onClick: () => {
            const pending = pendingDeletesRef.current.get(id);
            if (pending) clearTimeout(pending);
            pendingDeletesRef.current.delete(id);
            setHiddenIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          },
        },
      });

      if (id === activeChatId) {
        router.push("/chat");
      }
    },
    [activeChatId, commitDelete, router],
  );

  const serverIds = new Set(chats.map((c) => c.id));
  const merged = [...optimistic.filter((c) => !serverIds.has(c.id)), ...chats]
    .filter((c) => !hiddenIds.has(c.id))
    .map((c) => {
      const override = titleOverrides.get(c.id);
      return override && c.title === "New chat" ? { ...c, title: override } : c;
    });

  const groups = groupByRecency(merged);

  return (
    <div className="flex min-h-full flex-col gap-[var(--space-5)]">
      <NewChatButton />

      {merged.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: durations.base, ease: easeOutCurve }}
          className="flex flex-col items-center gap-2 px-2 pt-6 text-center"
        >
          <SpotIllustration kind="chat" />
          <p className="text-[color:var(--color-ink-subtle)] text-[var(--text-xs)]">
            No conversations yet. Ask your first question.
          </p>
        </motion.div>
      ) : (
        <div className="flex flex-col gap-[var(--space-4)]">
          <AnimatePresence initial={false}>
            {groups.map((group) => (
              <motion.section
                key={group.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: durations.base, ease: easeOutCurve }}
                className="flex flex-col gap-1"
              >
                <div className="px-2 font-semibold tracking-[0.18em] text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] uppercase">
                  {group.label}
                </div>
                <ul className="flex flex-col gap-0.5">
                  <AnimatePresence initial={false}>
                    {group.chats.map((chat) => (
                      <motion.li
                        key={chat.id}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{
                          opacity: 0,
                          height: 0,
                          transition: { duration: 0.18 },
                        }}
                        transition={{
                          duration: durations.base,
                          ease: easeOutCurve,
                        }}
                        style={{ overflow: "hidden" }}
                      >
                        <ChatSidebarItem
                          id={chat.id}
                          title={chat.title}
                          active={chat.id === activeChatId}
                          onDelete={handleDelete}
                        />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </motion.section>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
