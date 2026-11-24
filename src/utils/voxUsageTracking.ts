/**
 * voxUsageTracking — the Overview "Dictate a note, task or question — 1 tap
 * to record" card lifecycle (owner brief 2026-11-24).
 *
 * Rules:
 *  - Dismissing the card hides it (a × button on the card itself — the top
 *    header mic control and the bottom-right FAB are NOT touched).
 *  - It re-surfaces only when BOTH are true:
 *      (a) the user hasn't used Aloa Vox for ≥ 7 days, and
 *      (b) the dismissal itself is ≥ 7 days old.
 *    i.e. a user who keeps dictating never sees the prompt again; a user
 *    who stopped dictating for a week gets exactly one gentle reminder.
 *  - lastVoxUsedAt is stamped whenever the user LAUNCHES Vox (the header
 *    mic, the AloaChat → Capture hand-off) or USES it (a recording actually
 *    starts).
 *
 * Storage is localStorage (survives reloads, works offline before auth —
 * the card lives on the Overview of an already-authed session). All reads
 * are guarded: a broken/private-mode storage never crashes the dashboard,
 * it just shows the card (the helpful default).
 */
const VOX_LAST_USED_KEY = 'practicepro_vox_last_used_at';
const VOX_CARD_DISMISSED_KEY = 'practicepro_vox_card_dismissed_at';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const readTimestamp = (key: string): number => {
    try {
        const v = Number(localStorage.getItem(key));
        return Number.isFinite(v) && v > 0 ? v : 0;
    } catch {
        return 0;
    }
};

/** Stamp "Vox was used right now". Idempotent and failure-tolerant. */
export const stampVoxUsedAt = (): void => {
    try {
        localStorage.setItem(VOX_LAST_USED_KEY, String(Date.now()));
    } catch { /* storage unavailable — the 7-day rule degrades gracefully */ }
};

/** Stamp "the Overview card was dismissed right now". */
export const dismissVoxCard = (): void => {
    try {
        localStorage.setItem(VOX_CARD_DISMISSED_KEY, String(Date.now()));
    } catch { /* storage unavailable */ }
};

export const getVoxCardDismissedAt = (): number => readTimestamp(VOX_CARD_DISMISSED_KEY);
export const getLastVoxUsedAt = (): number => readTimestamp(VOX_LAST_USED_KEY);

/** The card is visible unless it was dismissed recently AND Vox was used
 *  recently. `now` is injectable for tests. */
export const shouldShowVoxCard = (now: number = Date.now()): boolean => {
    const dismissedAt = readTimestamp(VOX_CARD_DISMISSED_KEY);
    if (!dismissedAt) return true; // never dismissed — show
    const lastUsedAt = readTimestamp(VOX_LAST_USED_KEY);

    const unusedFor7Days = now - lastUsedAt >= SEVEN_DAYS_MS;
    const dismissed7DaysAgo = now - dismissedAt >= SEVEN_DAYS_MS;
    // Re-surface only when BOTH conditions hold (the brief's AND).
    return unusedFor7Days && dismissed7DaysAgo;
};
