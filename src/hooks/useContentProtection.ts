import { useState, useEffect, useCallback, useRef, useEffect as ReactUseEffect } from 'react';

/**
 * useContentProtection — best-effort copy/paste + screenshot deterrence.
 *
 * TASK 16 UPDATE: Now respects a user-toggleable setting stored in
 * localStorage key 'practicepro_content_protection'. When 'false',
 * ALL protection is disabled — the user can copy/paste and take
 * screenshots freely. This is needed because the user provides
 * screenshots to their LLM assistant and doesn't want to be
 * handicapped when the protection is on.
 *
 * The toggle is exposed in Settings → Data & Privacy.
 */

const STORAGE_KEY = 'practicepro_content_protection';
const DEFAULT_ENABLED = true; // ON by default for security

function readEnabledFromStorage(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'false') return false;
    return true; // default ON
  } catch {
    return DEFAULT_ENABLED;
  }
}

export function useContentProtection(enabled: boolean = true) {
  const [protectionEnabled, setProtectionEnabled] = useState(readEnabledFromStorage);
  const [showOverlay, setShowOverlay] = useState(false);
  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for changes to the localStorage setting (e.g. when the user
  // toggles it in Settings, this hook picks up the change immediately).
  useEffect(() => {
    const handler = () => setProtectionEnabled(readEnabledFromStorage());
    window.addEventListener('storage', handler);
    // Also poll every 500ms — storage event only fires across tabs, not
    // within the same tab. This ensures the hook picks up same-tab changes.
    const interval = setInterval(handler, 500);
    return () => {
      window.removeEventListener('storage', handler);
      clearInterval(interval);
    };
  }, []);

  // Only activate protection if BOTH `enabled` (user is authenticated)
  // AND `protectionEnabled` (user hasn't toggled it off in Settings).
  const shouldProtect = enabled && protectionEnabled;

  useEffect(() => {
    if (!shouldProtect) return;

    // ── 1. Copy / Cut / Paste prevention ──
    const handleCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (isEditable(target)) return;
      if (target.closest('.selectable')) return;
      e.preventDefault();
    };

    const handleCut = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (isEditable(target)) return;
      if (target.closest('.selectable')) return;
      e.preventDefault();
    };

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (isEditable(target)) return;
      e.preventDefault();
    };

    // ── 2. Right-click context menu prevention ──
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isEditable(target)) return;
      if (target.closest('.allow-context-menu')) return;
      e.preventDefault();
    };

    // ── 3. PrintScreen key detection ──
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        try {
          navigator.clipboard?.writeText('').catch(() => {});
        } catch {}
        // TASK 16: Show overlay INSTANTLY (no transition delay) to minimize
        // the window where content is visible. The overlay CSS transition
        // is 0.15s — we bypass it by adding 'visible' class immediately.
        setShowOverlay(true);
        if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
        overlayTimeoutRef.current = setTimeout(() => setShowOverlay(false), 3000);
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'u')) {
        const target = e.target as HTMLElement;
        if (!isEditable(target)) {
          e.preventDefault();
        }
      }
    };

    // ── 4. Window blur / visibility change ──
    // TASK 19: REMOVED the screenshot overlay. The overlay was giving a false
    // sense of security — it didn't actually prevent OS-level screenshots
    // (Windows Snipping Tool, macOS Cmd+Shift+3, mobile screenshot combos
    // all capture the frame buffer BEFORE the browser can react).
    //
    // The overlay only appeared on Alt-Tab / window blur, which is annoying
    // and doesn't prevent the actual screenshot. It's been removed entirely.
    //
    // What DOES work (kept active):
    //   - Copy/paste prevention (Ctrl+C, Ctrl+V, right-click)
    //   - PrintScreen key → clears clipboard (reduces easy pasting)
    //
    // What CANNOT work in a web app (honest limitation):
    //   - OS-level screenshots — impossible to block
    //   - Screen recording software — impossible to block
    //   - External cameras — impossible to block
    //
    // The toggle in Settings lets the user turn protection OFF when they
    // need to take screenshots (e.g. for support). This is the practical
    // solution for a web app.

    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    // NOTE: blur/focus/visibilitychange listeners removed — the overlay
    // they triggered didn't actually prevent screenshots (see comment above).

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    };
  }, [shouldProtect]);

  // showOverlay is always false now (overlay removed) but kept in the
  // return for backward compatibility with existing callers.
  return { showOverlay: false, protectionEnabled, setProtectionEnabled };
}

// Helper to set the content protection preference (used by Settings)
export function setContentProtectionEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
    // Dispatch a storage event so other tabs pick up the change
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: enabled ? 'true' : 'false' }));
  } catch {}
}

function isEditable(element: HTMLElement | null): boolean {
  if (!element) return false;
  const tag = element.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if (element.isContentEditable) return true;
  return false;
}
