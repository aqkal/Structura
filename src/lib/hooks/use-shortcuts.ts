"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Platform detection for keyboard shortcuts: Cmd on Apple devices, Ctrl
 * everywhere else. Safe to call on the server (returns false).
 */
export function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform ?? "";
  const ua = navigator.userAgent ?? "";
  return /mac|iphone|ipad|ipod/i.test(platform) || /Mac OS X/i.test(ua);
}

/**
 * Hydration-safe Mac detection for rendering key labels. Starts false on
 * the server render and settles after mount.
 */
export function useIsMac(): boolean {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMac(isMacPlatform()), 0);
    return () => clearTimeout(t);
  }, []);
  return mac;
}

/** True when the event target is an input, textarea, or contenteditable. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

type ShortcutHandlers = {
  /** When false, no listener is registered (signed-out pages). */
  enabled?: boolean;
  /** Ctrl/Cmd+K. */
  onCommandPalette?: () => void;
  /** Ctrl/Cmd+/. */
  onShortcutsDialog?: () => void;
  /** Ctrl/Cmd+Shift+O. */
  onNewChat?: () => void;
};

/**
 * Global keyboard shortcuts. Register once, in the shell, so listeners
 * never stack across route changes.
 *
 * Every combo here requires the platform modifier (Cmd on Mac, Ctrl
 * elsewhere), so they are deliberately allowed to fire even when focus is
 * in an input, textarea, or contenteditable region: plain typing never
 * carries the modifier. Any future modifier-less shortcut must check
 * `isEditableTarget(e.target)` and bail.
 */
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
