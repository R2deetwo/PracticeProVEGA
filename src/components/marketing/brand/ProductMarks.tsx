import React from 'react';

/**
 * ProductMarks — PracticePro product identity marks (owner direction:
 * "they should have some iconography that represents that product and we
 * retain the practicepro for main company that owns the products").
 *
 * VEGA — a serif "V" beneath a four-pointed star. Vega is the brightest
 * star in Lyra; the star sits in the notch of the V like a star over a
 * letter. The V carries typographic serifs (the legal tradition), set on
 * a claret seal — the register of a law-report cover. Reads at 16px.
 *
 * ATRIUM — a doorway arch on a floor line, crowned by a keystone. The
 * atrium is the entrance hall; the arch is the property mark. Set on an
 * emerald tile — the register of the well-kept estate. Reads at 16px.
 *
 * Both marks draw EXCLUSIVELY from design tokens (rgb(var(--x))) so the
 * token gate stays green — no hardcoded hexes in components. The
 * standalone favicon SVGs under public/brand/ are self-contained static
 * assets (like the index.html data-URI favicon) and carry resolved hex.
 *
 * Presentational only — zero buttons (ADR-0004).
 */

type MarkProps = {
    className?: string;
    title?: string;
};

/** Vega — serif V + four-pointed star on a claret seal. */
export const VegaMark: React.FC<MarkProps> = ({ className = 'h-7 w-7', title }) => (
    <svg
        viewBox="0 0 48 48"
        className={className}
        role={title ? 'img' : undefined}
        aria-hidden={title ? undefined : true}
        focusable="false"
    >
        {title && <title>{title}</title>}
        {/* Claret seal */}
        <rect x="2" y="2" width="44" height="44" rx="10" style={{ fill: 'rgb(var(--color-vega-claret))' }} />
        {/* Serif V — arms + top serifs, in paper */}
        <path d="M14.5 17 L24 35.5" fill="none" style={{ stroke: 'rgb(var(--color-paper))' }} strokeWidth="4" />
        <path d="M33.5 17 L24 35.5" fill="none" style={{ stroke: 'rgb(var(--color-paper))' }} strokeWidth="4" />
        <path d="M11.5 16.8 H17" style={{ stroke: 'rgb(var(--color-paper))' }} strokeWidth="3" />
        <path d="M31 16.8 H36.5" style={{ stroke: 'rgb(var(--color-paper))' }} strokeWidth="3" />
        {/* The star — Vega, brightest in Lyra, in gilt */}
        <path
            d="M24 5.5 C24.85 8.1 25.4 8.65 28 9.5 C25.4 10.35 24.85 10.9 24 13.5 C23.15 10.9 22.6 10.35 20 9.5 C22.6 8.65 23.15 8.1 24 5.5 Z"
            style={{ fill: 'rgb(var(--color-vega-gilt))' }}
        />
    </svg>
);

/** Atrium — doorway arch + floor + keystone on an emerald tile. */
export const AtriumMark: React.FC<MarkProps> = ({ className = 'h-7 w-7', title }) => (
    <svg
        viewBox="0 0 48 48"
        className={className}
        role={title ? 'img' : undefined}
        aria-hidden={title ? undefined : true}
        focusable="false"
    >
        {title && <title>{title}</title>}
        {/* Emerald tile */}
        <rect x="2" y="2" width="44" height="44" rx="10" style={{ fill: 'rgb(var(--color-atrium-emerald))' }} />
        {/* The arch — the entrance hall, in cream */}
        <path
            d="M16 36.5 V22 C16 14 32 14 32 22 V36.5"
            fill="none"
            style={{ stroke: 'rgb(var(--color-cream))' }}
            strokeWidth="4"
        />
        {/* The floor line */}
        <path d="M11.5 36.5 H36.5" style={{ stroke: 'rgb(var(--color-cream))' }} strokeWidth="3.5" />
        {/* The keystone — the estate kept, in cream */}
        <path d="M24 8 L27.2 11.7 L24 15.4 L20.8 11.7 Z" style={{ fill: 'rgb(var(--color-cream))' }} />
    </svg>
);

/** The product mark for a given product id (used where the page already
 *  knows which product it is rendering — nav, footer, dropdowns). */
export const ProductMark: React.FC<{ product: 'vega' | 'atrium' } & MarkProps> = ({ product, ...rest }) =>
    product === 'vega' ? <VegaMark {...rest} /> : <AtriumMark {...rest} />;
