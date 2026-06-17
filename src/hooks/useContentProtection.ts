import { useEffect, useState, useRef } from 'react';

/**
 * useContentProtection — best-effort copy/paste + screenshot deterrence.
 *
 * USER REQUEST:
 *   "when the user in the app, i dont want them to be able to copy and paste
 *    except where allowed but we can relax this for the landing pages."
 *   "there can be no screengrabbing or screenshot taking on the app but you
 *    can in the landing pages."
 *
 * WHAT THIS HOOK DOES:
 *   1. Copy/Paste prevention:
 *      - Disables text selection via the .app-protected CSS class
 *      - Intercepts copy, cut, and paste events and prevents them
 *      - Disables the right-click context menu
 *      - Inputs/textareas/contentEditable are exempted (users still need to type)
 *
 *   2. Screenshot deterrence (BEST-EFFORT — see limitations below):
 *      - Detects the PrintScreen key and attempts to clear the clipboard
 *      - When the window loses focus (some capture tools trigger this),
 *        shows a black overlay to hide the content
 *      - When the document visibility changes (tab switch, some capture tools),
 *        shows the overlay
 *
 * LIMITATIONS — IMPORTANT TO UNDERSTAND:
 *   Web browsers CANNOT truly prevent OS-level screenshots. The OS captures
 *   the rendered frame buffer at the graphics level, before the browser can
 *   react. This is fundamentally different from native apps (like Netflix's
 *   desktop app) which use OS-level DRM APIs.
 *
 *   The Netflix black-screen approach works for VIDEO content because it uses
 *   Encrypted Media Extensions (EME) with hardware-level DRM. For general
 *   HTML/CSS/JS content, there is no equivalent.
 *
 *   What this hook catches:
 *     - Casual copy/paste via keyboard shortcuts (Ctrl+C, Ctrl+V)
 *     - Right-click → "Copy" context menu
 *     - PrintScreen key (clears clipboard AFTER the screenshot is taken —
 *       the screenshot itself is not prevented)
 *     - Some screen capture browser extensions that trigger visibilitychange
 *
 *   What this hook CANNOT catch:
 *     - OS-level screenshots (Windows Snipping Tool, macOS Cmd+Shift+3/4,
 *       Linux gnome-screenshot, mobile screenshot combos)
 *     - Third-party screen recording software (OBS, Camtasia, etc.)
 *     - External cameras pointed at the screen
 *     - Browser DevTools (can disable all JS protection)
 *
 *   For TRUE screenshot prevention, you would need:
 *     - A native desktop app (Electron/Tauri) with OS-level window protection
 *     - DRM-protected content (only works for video, not general UI)
 *     - Enterprise device management (MDM) policies
 *
 * USAGE:
 *   const { showOverlay } = useContentProtection();
 *   // Render {showOverlay && <div className="screenshot-overlay visible" />} in your component
 *
 *   The hook returns showOverlay so the component can render the overlay div.
 *   The .app-protected CSS class should be added to the same component's
 *   outermost div.
 */

export function useContentProtection(enabled: boolean = true) {
  const [showOverlay, setShowOverlay] = useState(false);
  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // ── 1. Copy / Cut / Paste prevention ──
    const handleCopy = (e: ClipboardEvent) => {
      // Allow if the target is an input, textarea, or contentEditable
      const target = e.target as HTMLElement;
      if (isEditable(target)) return;
      // Allow if the target is explicitly marked as selectable
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
      // Allow paste in editable elements (users need to paste into forms)
      const target = e.target as HTMLElement;
      if (isEditable(target)) return;
      // Block paste everywhere else
      e.preventDefault();
    };

    // ── 2. Right-click context menu prevention ──
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Allow context menu on inputs, textareas, and explicitly marked elements
      if (isEditable(target)) return;
      if (target.closest('.allow-context-menu')) return;
      e.preventDefault();
    };

    // ── 3. PrintScreen key detection ──
    // NOTE: This does NOT prevent the screenshot — the OS has already captured
    // the screen by the time the keydown event fires. What we CAN do is clear
    // the clipboard immediately after, so the screenshot isn't left in the
    // clipboard for easy pasting.
    const handleKeyDown = (e: KeyboardEvent) => {
      // PrintScreen key
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        // Attempt to clear the clipboard
        try {
          navigator.clipboard?.writeText('').catch(() => {});
        } catch {
          // Clipboard API might not be available
        }
        // Show the overlay briefly to hide content
        setShowOverlay(true);
        if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
        overlayTimeoutRef.current = setTimeout(() => setShowOverlay(false), 2000);
      }

      // Block Ctrl+S (save page), Ctrl+U (view source), Ctrl+Shift+I (devtools)
      // on non-landing pages — these are common ways to extract content.
      // NOTE: This is easily bypassed by savvy users but stops casual attempts.
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'u')) {
        const target = e.target as HTMLElement;
        if (!isEditable(target)) {
          e.preventDefault();
        }
      }
    };

    // ── 4. Window blur / visibility change → show overlay ──
    // When the window loses focus (some screen capture tools trigger this),
    // or when the tab becomes hidden, show the black overlay.
    const handleBlur = () => {
      setShowOverlay(true);
    };

    const handleFocus = () => {
      setShowOverlay(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setShowOverlay(true);
      } else {
        setShowOverlay(false);
      }
    };

    // ── Register all listeners ──
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ── Cleanup ──
    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    };
  }, [enabled]);

  return { showOverlay };
}

// Helper: check if an element is an input, textarea, or contentEditable
function isEditable(element: HTMLElement | null): boolean {
  if (!element) return false;
  const tag = element.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return true;
  if (element.isContentEditable) return true;
  return false;
}
