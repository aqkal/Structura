"use client";

import { useEffect, useState } from "react";

import {
  FEEDBACK_EMBED_URL,
  GUIDED_SESSION_THRESHOLD,
  LS_GUIDED_DONE,
  LS_GUIDED_SESSION_IDS,
} from "./feedback-config";

const TALLY_SCRIPT = "https://tally.so/widgets/embed.js";

type TallyWindow = Window & { Tally?: { loadEmbeds: () => void } };

function loadTallyEmbeds() {
  const w = window as TallyWindow;
  if (w.Tally) {
    w.Tally.loadEmbeds();
    return;
  }
  document
    .querySelectorAll<HTMLIFrameElement>("iframe[data-tally-src]:not([src])")
    .forEach((el) => {
      el.src = el.dataset.tallySrc ?? "";
    });
}

// Guided feedback: an embedded Tally form shown on the completion screen once
// the user has finished GUIDED_SESSION_THRESHOLD distinct sessions. Shows once.
export function GuidedFeedbackEmbed({ sessionId }: { sessionId: string }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(LS_GUIDED_DONE)) return;

    let ids: string[] = [];
    try {
      const raw = window.localStorage.getItem(LS_GUIDED_SESSION_IDS);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        ids = parsed.filter((x): x is string => typeof x === "string");
      }
    } catch {
      ids = [];
    }

    if (!ids.includes(sessionId)) {
      ids.push(sessionId);
      window.localStorage.setItem(LS_GUIDED_SESSION_IDS, JSON.stringify(ids));
    }

    if (ids.length >= GUIDED_SESSION_THRESHOLD) {
      window.localStorage.setItem(LS_GUIDED_DONE, "1");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only, so the show decision can only be made after mount
      setShow(true);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!show) return;
    const w = window as TallyWindow;
    if (w.Tally) {
      loadTallyEmbeds();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${TALLY_SCRIPT}"]`,
    );
    if (existing) {
      existing.addEventListener("load", loadTallyEmbeds);
      loadTallyEmbeds();
      return;
    }
    const script = document.createElement("script");
    script.src = TALLY_SCRIPT;
    script.onload = loadTallyEmbeds;
    script.onerror = loadTallyEmbeds;
    document.body.appendChild(script);
  }, [show]);

  if (!show) return null;

  return (
    <div className="glass flex w-full flex-col gap-3 rounded-[var(--radius-lg)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-[color:var(--color-ink)] text-[var(--text-sm)]">
            How is Qualia working for you?
          </p>
          <p className="text-[color:var(--color-ink-muted)] text-[var(--text-xs)]">
            You&apos;ve finished a couple of sessions. A few quick questions
            would really help while we&apos;re in beta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="shrink-0 text-[color:var(--color-ink-subtle)] text-[var(--text-2xs)] transition-colors hover:text-[color:var(--color-ink)]"
        >
          Dismiss
        </button>
      </div>
      <iframe
        data-tally-src={FEEDBACK_EMBED_URL}
        loading="lazy"
        width="100%"
        height={320}
        title="Qualia feedback"
        style={{ border: 0 }}
      />
    </div>
  );
}
