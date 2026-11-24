/**
 * bannerTestCycler — internal banner preview/test tool (owner brief
 * 2026-11-25 "Banner Notification Preview / Test Cycler").
 *
 * WHAT THIS IS: a tiny in-memory pub/sub that lets an admin preview control
 * (Settings → Notifications → Banner Preview) inject TEST banners into the
 * live BroadcastBanner carousel — Founder Announcements, System/Platform
 * Notices, Urgent Compliance/Billing Alerts — so spacing, dismissal
 * behaviour and styling can be inspected on the real Dashboard surface,
 * across desktop and mobile viewports.
 *
 * DESIGN CONTRACTS:
 *   - Pure module, no React import — unit-testable in isolation and usable
 *     from any surface (the cycler card, BroadcastBanner's subscription).
 *   - TEST banners NEVER touch Convex: they are client-side only, capped
 *     at MAX_TEST_BANNERS, and use persistenceMode 'session' so dismissing
 *     one in inspection never leaves durable state behind.
 *   - Every push mints a FRESH id (timestamp + counter) so re-triggering a
 *     preset always re-surfaces it, even after a dismissal in the same
 *     session.
 *   - The banner row shape mirrors what BroadcastBanner already renders:
 *     { id, title, message, type: 'broadcast_<theme>', timestamp,
 *       persistenceMode, targetProduct: 'all' } — plus a `_isTestBanner`
 *       flag the renderer can use for a subtle "TEST" affordance.
 */

export type BannerTestPresetId =
    | 'founder_announcement'
    | 'platform_notice'
    | 'urgent_alert';

export interface BannerTestPreset {
    id: BannerTestPresetId;
    /** The broadcast type — must match a BroadcastBanner THEME key. */
    type: string;
    title: string;
    message: string;
    /** Shown on the preview button in the cycler card. */
    buttonLabel: string;
}

/** The three families the owner named, one THEME each:
 *   announcement → emerald "Announcement" glass
 *   info         → blue "Info" glass
 *   urgent       → coral/red "Urgent" glass  */
export const BANNER_TEST_PRESETS: BannerTestPreset[] = [
    {
        id: 'founder_announcement',
        type: 'broadcast_announcement',
        title: 'A note from the founder',
        message:
            'PracticePro banner preview — this is what a founder announcement looks like in the carousel. Dismiss it to inspect the slide-out animation.',
        buttonLabel: 'Founder Announcement',
    },
    {
        id: 'platform_notice',
        type: 'broadcast_info',
        title: 'Scheduled platform maintenance',
        message:
            'PracticePro banner preview — this is what a system/platform notice looks like. Check spacing, indicator dots and the Open pill.',
        buttonLabel: 'System / Platform Notice',
    },
    {
        id: 'urgent_alert',
        type: 'broadcast_urgent',
        title: 'Compliance deadline approaching',
        message:
            'PracticePro banner preview — this is what an urgent compliance/billing alert looks like. Urgent sorts to position 1 in the carousel.',
        buttonLabel: 'Urgent Compliance / Billing Alert',
    },
];

export const MAX_TEST_BANNERS = 3;

/** The injected test-banner row (broadcast-shaped + test flag). */
export interface TestBannerRow {
    id: string;
    broadcastId: string;
    title: string;
    message: string;
    type: string;
    timestamp: string;
    persistenceMode: 'session';
    targetProduct: 'all';
    _isTestBanner: true;
}

// ── Module state (in-memory only — a preview tool, not a store) ──────────
let testBanners: TestBannerRow[] = [];
let pushCounter = 0;
const subscribers = new Set<(rows: TestBannerRow[]) => void>();

const notify = () => {
    for (const cb of subscribers) {
        try { cb(testBanners); } catch { /* a broken subscriber never breaks the tool */ }
    }
};

/** Inject one test banner (from a preset) into the live carousel. */
export function pushTestBanner(presetId: BannerTestPresetId): TestBannerRow | null {
    const preset = BANNER_TEST_PRESETS.find(p => p.id === presetId);
    if (!preset) return null;
    pushCounter += 1;
    const row: TestBannerRow = {
        id: `test_banner_${Date.now()}_${pushCounter}`,
        broadcastId: `test_${preset.id}_${pushCounter}`,
        title: preset.title,
        message: preset.message,
        type: preset.type,
        timestamp: new Date().toISOString(),
        persistenceMode: 'session',
        targetProduct: 'all',
        _isTestBanner: true,
    };
    // Cap: the preview never floods the carousel beyond MAX_BANNERS.
    testBanners = [...testBanners, row].slice(-MAX_TEST_BANNERS);
    notify();
    return row;
}

/** Drop every test banner (the cycler's Clear button). */
export function clearTestBanners(): void {
    testBanners = [];
    notify();
}

/** Current test-banner rows (defensive copy). */
export function getTestBanners(): TestBannerRow[] {
    return [...testBanners];
}

/** Subscribe to test-banner changes; returns an unsubscribe function. */
export function subscribeTestBanners(cb: (rows: TestBannerRow[]) => void): () => void {
    subscribers.add(cb);
    return () => { subscribers.delete(cb); };
}

/** Reset module state (tests only). */
export function __resetTestBannersForTests(): void {
    testBanners = [];
    pushCounter = 0;
    subscribers.clear();
}
