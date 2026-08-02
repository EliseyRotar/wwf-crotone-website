"use client";

import { useEffect } from "react";

/**
 * F27: Keyboard shortcut hook.
 *
 * Registers a keymap of `key → handler` against the document. Modifiers
 * (alt/ctrl/meta/shift) are checked separately; the basic key is the
 * lowercased `e.key`. Skipped when focus is inside an input, textarea,
 * select, or contenteditable element.
 *
 * Usage:
 *   useKeyboardShortcuts({ "k": openSearch, "/": focusSearch });
 */
export type ShortcutMap = Record<string, (e: KeyboardEvent) => void>;

export function useKeyboardShortcuts(map: ShortcutMap) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (target.isContentEditable) return;
      }
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      const handler = map[k];
      if (handler) {
        e.preventDefault();
        handler(e);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [map]);
}
