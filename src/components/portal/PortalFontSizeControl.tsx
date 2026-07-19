/**
 * PortalFontSizeControl — discrete A-/A+ font-size control for portal users.
 *
 * Why this exists:
 *   Portal users (clients, residents) had to use whatever font size the
 *   admin set for the main app. That's not good — a client reading a
 *   contract on their phone may need larger text than the admin who's
 *   doing data entry on a desktop. This control gives the portal user
 *   their own font-size preference, persisted to localStorage, applied
 *   via a CSS variable on the document root.
 *
 * Implementation:
 *   - Reads/writes `practicepro_portal_font_scale` in localStorage.
 *   - Valid range: 0.85 (small) → 1.25 (large) in 0.05 steps.
 *   - Default: 1.0 (normal).
 *   - Applies the scale to the document root via `--portal-font-scale`,
 *     which the portal pages use in their font-size calculations.
 *   - Also bumps the root `font-size` so all rem-based sizing scales.
 *
 * Visual design:
 *   - Compact pill with "A−" and "A+" buttons.
 *   - Shows the current scale as a percentage (e.g., "100%") between them.
 *   - Subtle border, soft shadow — matches the portal's premium aesthetic.
 *   - Tooltip explains what it does.
 */
import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'practicepro_portal_font_scale';
const MIN_SCALE = 0.85;
const MAX_SCALE = 1.25;
const STEP = 0.05;
const DEFAULT_SCALE = 1.0;

function readStoredScale(): number {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw == null) return DEFAULT_SCALE;
        const n = parseFloat(raw);
        if (Number.isNaN(n)) return DEFAULT_SCALE;
        return Math.min(MAX_SCALE, Math.max(MIN_SCALE, n));
    } catch {
        return DEFAULT_SCALE;
    }
}

function applyScale(scale: number) {
    if (typeof document === 'undefined') return;
    document.documentElement.style.setProperty('--portal-font-scale', String(scale));
    // Set the root font-size so rem-based sizing scales with the user's
    // preference. Tailwind's text-xs/text-sm/text-base/etc. all use rem,
    // so they scale automatically. Explicit pixel sizes (text-2xs) are
    // intentionally fixed for badges/labels and don't scale — that's
    // acceptable because they're decorative, not body text.
    document.documentElement.style.fontSize = `${16 * scale}px`;
}

export const PortalFontSizeControl: React.FC<{ className?: string }> = ({ className = '' }) => {
    const [scale, setScale] = useState<number>(() => readStoredScale());

    // Apply on mount + whenever it changes
    useEffect(() => {
        applyScale(scale);
        try { localStorage.setItem(STORAGE_KEY, String(scale)); } catch {}
    }, [scale]);

    const decrease = () => setScale(s => Math.max(MIN_SCALE, +(s - STEP).toFixed(2)));
    const increase = () => setScale(s => Math.min(MAX_SCALE, +(s + STEP).toFixed(2)));
    const reset = () => setScale(DEFAULT_SCALE);

    const pct = Math.round(scale * 100);

    return (
        <div
            className={`inline-flex items-center rounded-xl border border-slate-100 dark:border-zinc-700 shadow-soft bg-white dark:bg-zinc-900 overflow-hidden ${className}`}
            title="Adjust text size — your preference is saved on this device"
            role="group"
            aria-label="Text size"
        >
            <button
                onClick={decrease}
                disabled={scale <= MIN_SCALE}
                className="px-2 sm:px-2.5 py-2 sm:py-2.5 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold"
                aria-label="Decrease text size"
            >
                A−
            </button>
            <button
                onClick={reset}
                className="px-1.5 sm:px-2 py-2 sm:py-2.5 text-2xs font-bold text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors min-w-[36px] text-center border-x border-slate-100 dark:border-zinc-700"
                aria-label={`Reset text size (currently ${pct}%)`}
                title="Reset to 100%"
            >
                {pct}%
            </button>
            <button
                onClick={increase}
                disabled={scale >= MAX_SCALE}
                className="px-2 sm:px-2.5 py-2 sm:py-2.5 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-base font-bold"
                aria-label="Increase text size"
            >
                A+
            </button>
        </div>
    );
};

export default PortalFontSizeControl;
