import React from 'react';

/**
 * VegaAppShot — a REAL screenshot of the shipping app, framed in the
 * page's light sheet chrome (R38).
 *
 * Owner direction (R28, kept): "The images do not look like what the app
 * looks like — let us use stuff from the app so we are not showing false
 * images." The captures are live from the product; each states what it
 * is in the mono caption; nothing is staged. R38: the old deep-shadow
 * "paper under a desk lamp" chrome (built for the dark register) is
 * replaced by a quiet CREAM SHEET on the ivory ground — one hairline, a
 * soft warm shadow, generous padding. The capture is the exhibit; the
 * frame stays out of the way.
 *
 * The shots live in public/assets/landing/app/ (progressive JPEGs,
 * captured by scripts/r28-app-shots.cjs against the live workspace).
 *
 * Presentational only — zero buttons (ADR-0004); the sheet chrome is the
 * shared .vg-shot class.
 */
export const VegaAppShot: React.FC<{
    /** Absolute path under /assets/landing/ */
    src: string;
    alt: string;
    /** Mono caption under the sheet — states WHAT was captured. */
    caption: string;
    className?: string;
}> = ({ src, alt, caption, className = '' }) => (
    <figure className={className}>
        <div className="vg-shot">
            <img
                src={src}
                alt={alt}
                loading="lazy"
                decoding="async"
                width={1440}
                height={900}
                className="vg-shot__img"
            />
        </div>
        <figcaption className="font-mono text-2xs tracking-widest text-slate-600 mt-4">{caption}</figcaption>
    </figure>
);
