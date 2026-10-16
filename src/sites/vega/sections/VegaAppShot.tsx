import React from 'react';

/**
 * VegaAppShot — a REAL screenshot of the shipping app, framed in the
 * page's lit paper-sheet chrome (R28).
 *
 * Owner direction: "The images do not look like what the app looks like —
 * let us use stuff from the app so we are not showing false images." The
 * deep-dive bands now carry LIVE CAPTURES of the workspace (captured from
 * the product with the Warm Chambers skin active — the same register this
 * page runs on) instead of stylized mock exhibits. Each capture states
 * what it is in the mono caption; nothing is staged.
 *
 * The shots live in public/assets/landing/app/ (progressive JPEGs,
 * captured by scripts/r28-app-shots.cjs against the live workspace).
 *
 * Presentational only — zero buttons (ADR-0004), zero hardcoded hexes
 * (the sheet chrome is the shared .vg-doc class).
 */
export const VegaAppShot: React.FC<{
    /** Absolute path under /assets/landing/app/ */
    src: string;
    alt: string;
    /** Mono caption under the sheet — states WHAT was captured. */
    caption: string;
    className?: string;
}> = ({ src, alt, caption, className = '' }) => (
    <figure className={className}>
        <div className="vg-doc p-2 sm:p-3">
            <img
                src={src}
                alt={alt}
                loading="lazy"
                decoding="async"
                width={1440}
                height={900}
                className="w-full h-auto rounded-[10px] border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.08)]"
            />
        </div>
        <figcaption className="font-mono text-2xs tracking-widest text-slate-500 mt-5">{caption}</figcaption>
    </figure>
);
