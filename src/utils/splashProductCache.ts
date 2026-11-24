/**
 * splashProductCache — locally cached resolved product for the boot splash
 * (owner brief 2026-11-25 "Splash Screen Sequence & Product-Specific Finale").
 *
 * WHY: the splash renders BEFORE auth/workspace data resolves, so a
 * returning logged-in user used to fall back to the company card (and the
 * retired 3-icon strip) even though their product was perfectly knowable.
 * Caching the resolved activeProduct (atrium | vega | komplete) locally lets
 * the NEXT boot play the full Stage 1 → Stage 2 sequence immediately, with
 * the correct product finale, instead of settling on the generic card.
 *
 * CONTRACTS:
 *   - Stores the NORMALIZED product ('vega' | 'atrium' | 'komplete') —
 *     never a raw ProductContext value; App.tsx normalizes before writing.
 *   - Pure localStorage access with defensive try/catch (private-mode
 *     browsers, storage full) — every failure degrades to "no cache",
 *     never a crash.
 *   - The cache is a PRESENTATION hint for the splash only — the live
 *     product resolution (ProductContext) always wins once data loads.
 */

const STORAGE_KEY = 'pp_splash_product';

/** The normalized cached product, or null when none is stored. */
export function getCachedSplashProduct(): 'vega' | 'atrium' | 'komplete' | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw === 'vega' || raw === 'atrium' || raw === 'komplete') return raw;
        return null;
    } catch {
        return null;
    }
}

/** Persist the normalized product for the next boot's Stage 2 finale. */
export function cacheSplashProduct(product: 'vega' | 'atrium' | 'komplete'): void {
    try {
        localStorage.setItem(STORAGE_KEY, product);
    } catch {
        /* storage unavailable — the splash falls back to the company card */
    }
}

/** Clear the cache (sign-out hygiene — the next login re-resolves). */
export function clearCachedSplashProduct(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch { /* nothing to clear */ }
}
