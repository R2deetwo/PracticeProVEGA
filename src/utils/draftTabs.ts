/**
 * draftTabs — manages opening DraftPro in a new browser tab on desktop, with
 * dedup safeguards so the same draft never opens in two tabs at once.
 *
 * DESIGN
 * ======
 * Each draft session has a unique key (derived from matterId + title or
 * documentId). When the user initiates a new generation on desktop, we:
 *   1. Check if a tab is already open for this key (via localStorage flag)
 *   2. If yes → focus that tab (window.open with the stored name)
 *   3. If no → open a new tab with a stable window.name
 *
 * The "Open Item" button in ALOA uses the same lookup, so clicking it
 * navigates to the EXISTING tab instead of spawning a duplicate.
 *
 * DEDUP MECHANISM
 * ===============
 * - Each tab registers itself in localStorage on load with a heartbeat
 *   timestamp (updated every 5 seconds).
 * - When checking if a tab is "alive", we check the heartbeat is < 10s old.
 * - On tab close (beforeunload), we deregister.
 * - This handles crashed tabs, closed tabs, and refreshes correctly.
 *
 * MOBILE
 * ======
 * On mobile (Capacitor native or small viewport), tabs aren't practical —
 * the app navigates in-place instead. isDesktop() gates this behavior.
 */

const TAB_REGISTRY_KEY = 'practicepro:draft-tabs:registry';

export interface DraftTabEntry {
  /** The draft session key — same as draftSessionKey() output */
  key: string;
  /** The window.name used to focus the tab later */
  tabName: string;
  /** The URL the tab was opened with */
  url: string;
  /** The draft title for display */
  title: string;
  /** Heartbeat timestamp — updated every 5s by the tab */
  lastHeartbeat: number;
}

interface TabRegistry {
  [key: string]: DraftTabEntry;
}

function readRegistry(): TabRegistry {
  try {
    const raw = localStorage.getItem(TAB_REGISTRY_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as TabRegistry;
  } catch {
    return {};
  }
}

function writeRegistry(reg: TabRegistry): void {
  try {
    // Prune dead entries (heartbeat > 15s old) before writing
    const now = Date.now();
    const pruned: TabRegistry = {};
    for (const [k, v] of Object.entries(reg)) {
      if (now - v.lastHeartbeat < 15000) {
        pruned[k] = v;
      }
    }
    localStorage.setItem(TAB_REGISTRY_KEY, JSON.stringify(pruned));
  } catch (e) {
    console.warn('[draftTabs] writeRegistry failed', e);
  }
}

/** Detect desktop (non-mobile, non-native) — tabs only make sense on desktop. */
export function isDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  // Capacitor native app — no tabs
  if ((window as any).Capacitor?.isNativePlatform?.()) return false;
  // Small viewport — treat as mobile
  return window.innerWidth >= 768;
}

/** Generate a stable tab name from a draft key. */
function tabNameFor(key: string): string {
  return `draftpro-${key.replace(/[^a-z0-9]/gi, '-')}`;
}

/**
 * Open a draft in a new tab (desktop) or navigate in-place (mobile).
 * Returns true if a new tab was opened, false if an existing tab was focused
 * or if we navigated in-place.
 */
export function openDraftInTab(opts: {
  key: string;
  url: string;
  title: string;
}): 'new-tab' | 'existing-tab' | 'in-place' {
  if (!isDesktop()) {
    // Mobile: navigate in-place
    window.location.href = opts.url;
    return 'in-place';
  }

  const reg = readRegistry();
  const existing = reg[opts.key];
  const now = Date.now();

  // Check if there's a live tab for this key
  if (existing && now - existing.lastHeartbeat < 15000) {
    // Try to focus the existing tab.
    // IMPORTANT: Use the FULL URL (not '') because popup blockers
    // block window.open('', name) even in user-gesture contexts.
    // By opening with the real URL, the browser treats it as a
    // legitimate navigation, not a popup attempt.
    const win = window.open(opts.url, existing.tabName);
    if (win && !win.closed) {
      win.focus();
      return 'existing-tab';
    }
    // Tab doesn't exist anymore — clean up and fall through to open new
    delete reg[opts.key];
  }

  // Open a new tab with a stable name
  const tabName = tabNameFor(opts.key);
  const win = window.open(opts.url, tabName);
  if (win) {
    win.focus();
    reg[opts.key] = {
      key: opts.key,
      tabName,
      url: opts.url,
      title: opts.title,
      lastHeartbeat: now,
    };
    writeRegistry(reg);
    return 'new-tab';
  }

  // Pop-up blocked — fall back to in-place navigation
  window.location.href = opts.url;
  return 'in-place';
}

/**
 * Register the current tab as handling a draft session. Call this on
 * DraftPro mount. Sets up heartbeat + beforeunload cleanup.
 * Returns a cleanup function to call on unmount.
 */
export function registerDraftTab(opts: {
  key: string;
  title: string;
}): () => void {
  if (!isDesktop()) return () => {};

  const tabName = tabNameFor(opts.key);
  // Set window.name so we can focus this tab later
  window.name = tabName;

  const reg = readRegistry();
  reg[opts.key] = {
    key: opts.key,
    tabName,
    url: window.location.href,
    title: opts.title,
    lastHeartbeat: Date.now(),
  };
  writeRegistry(reg);

  // Heartbeat every 5s
  const heartbeat = setInterval(() => {
    const r = readRegistry();
    if (r[opts.key]) {
      r[opts.key].lastHeartbeat = Date.now();
      writeRegistry(r);
    } else {
      // Another tab took over this key — close this one
      window.close();
    }
  }, 5000);

  // Cleanup on tab close
  const onBeforeUnload = () => {
    const r = readRegistry();
    if (r[opts.key]?.tabName === tabName) {
      delete r[opts.key];
      writeRegistry(r);
    }
  };
  window.addEventListener('beforeunload', onBeforeUnload);

  return () => {
    clearInterval(heartbeat);
    window.removeEventListener('beforeunload', onBeforeUnload);
    onBeforeUnload();
  };
}

/**
 * Check if a draft tab is already open for this key.
 * Useful for the ALOA "Open Item" button to decide whether to focus
 * an existing tab or navigate in-place.
 */
export function isDraftTabOpen(key: string): boolean {
  const reg = readRegistry();
  const entry = reg[key];
  if (!entry) return false;
  return Date.now() - entry.lastHeartbeat < 15000;
}
