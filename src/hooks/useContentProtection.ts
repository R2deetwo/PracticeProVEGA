import { useState, useEffect, useRef } from 'react';

/**
 * useContentProtection — copy/paste protection + NATIVE screenshot prevention.
 *
 * TASK: Now bridges to Android's native FLAG_SECURE via the ContentProtectionPlugin.
 * When protection is ON:
 *   - Copy/paste blocked (CSS + event listeners)
 *   - FLAG_SECURE applied to the native window → screenshots ACTUALLY blocked
 *   - Recents/Task Manager shows a blank card (no app preview)
 *
 * When protection is OFF:
 *   - Copy/paste allowed
 *   - FLAG_SECURE cleared → screenshots allowed
 *   - Recents/Task Manager shows normal app preview
 *
 * The toggle is in Settings → Data Management → Content Protection.
 * Stored in localStorage key 'practicepro_content_protection'.
 */

const STORAGE_KEY = 'practicepro_content_protection';
const DEFAULT_ENABLED = true;

function readEnabledFromStorage(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'false') return false;
    return true;
  } catch {
    return DEFAULT_ENABLED;
  }
}

// Lazy-load Capacitor plugins (only available in native app)
let ContentProtectionPlugin: any = null;
async function loadNativePlugin() {
  try {
    if (typeof window !== 'undefined' && (window as any).Capacitor) {
      // Use the global Capacitor object directly (available in native app via Capacitor core)
      // Avoid dynamic import of @capacitor/core — it's not a frontend dependency
      // and causes Vite build errors.
      const Capacitor = (window as any).Capacitor;
      if (Capacitor.registerPlugin) {
        ContentProtectionPlugin = Capacitor.registerPlugin('ContentProtection');
      } else if (Capacitor.Plugins && Capacitor.Plugins.ContentProtection) {
        ContentProtectionPlugin = Capacitor.Plugins.ContentProtection;
      }
    }
  } catch {
    // Not in native app, or plugin not available — CSS/JS only
  }
}

export function useContentProtection(enabled: boolean = true) {
  const [protectionEnabled, setProtectionEnabled] = useState(readEnabledFromStorage);
  const [showOverlay, setShowOverlay] = useState(false);
  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativePluginLoaded = useRef(false);

  // Load the native plugin on mount
  useEffect(() => {
    if (!nativePluginLoaded.current) {
      nativePluginLoaded.current = true;
      loadNativePlugin();
    }
  }, []);

  // Listen for changes to the localStorage setting
  useEffect(() => {
    const handler = () => setProtectionEnabled(readEnabledFromStorage());
    window.addEventListener('storage', handler);
    const interval = setInterval(handler, 500);
    return () => {
      window.removeEventListener('storage', handler);
      clearInterval(interval);
    };
  }, []);

  // Apply native FLAG_SECURE when protection state changes
  useEffect(() => {
    if (!enabled) return; // Only when user is authenticated

    // Bridge to native FLAG_SECURE
    if (ContentProtectionPlugin && protectionEnabled !== undefined) {
      ContentProtectionPlugin.setEnabled({ enabled: protectionEnabled })
        .catch(() => {
          // Plugin call failed — fall back to CSS/JS only
        });
    }
  }, [enabled, protectionEnabled]);

  const shouldProtect = enabled && protectionEnabled;

  // CSS/JS copy-paste protection (complements native FLAG_SECURE)
  useEffect(() => {
    if (!shouldProtect) return;

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

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isEditable(target)) return;
      if (target.closest('.allow-context-menu')) return;
      e.preventDefault();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        try {
          navigator.clipboard?.writeText('').catch(() => {});
        } catch {}
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'u')) {
        const target = e.target as HTMLElement;
        if (!isEditable(target)) {
          e.preventDefault();
        }
      }
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    };
  }, [shouldProtect]);

  return { showOverlay: false, protectionEnabled, setProtectionEnabled };
}

export function setContentProtectionEnabled(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
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
