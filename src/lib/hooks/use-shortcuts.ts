"use client";

import { useEffect, useRef, useState } from "react";

export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform ?? "";
  const ua = navigator.userAgent ?? "";
  return /mac|iphone|ipad|ipod/i.test(platform) || /Mac OS X/i.test(ua);
}

export function useIsMac(): boolean {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMac(isMacPlatform()), 0);
    return () => clearTimeout(t);
  }, []);
  return mac;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

type ShortcutHandlers = {
  enabled?: boolean;

  onCommandPalette?: () => void;

  onShortcutsDialog?: () => void;

  onNewChat?: () => void;
};

export function useShortcuts({
  enabled = true,
  onCommandPalette,
  onShortcutsDialog,
  onNewChat,
}: ShortcutHandlers): void {
  const handlers = useRef({ onCommandPalette, onShortcutsDialog, onNewChat });
  useEffect(() => {
    handlers.current = { onCommandPalette, onShortcutsDialog, onNewChat };
  });

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent) {
      const mod = isMacPlatform() ? e.metaKey : e.ctrlKey;
      if (!mod || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === "k" && !e.shiftKey) {
        e.preventDefault();
        handlers.current.onCommandPalette?.();
      } else if (key === "/" && !e.shiftKey) {
        e.preventDefault();
        handlers.current.onShortcutsDialog?.();
      } else if (key === "o" && e.shiftKey) {
        e.preventDefault();
        handlers.current.onNewChat?.();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
