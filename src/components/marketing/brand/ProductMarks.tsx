import React, { useId } from 'react';

/**
 * ProductMarks — PracticePro product identity marks (R26).
 *
 * Owner direction (R26, after two rounds of monogram tiles that never
 * read right): NEW MARKS, chosen autonomously — objects with meaning,
 * not letterforms. Both are constructed as single solid paths on the
 * R23 quiet grounds (one clean diagonal gradient, squircle tile, one
 * hairline) — flat, engineered, never bevelled.
 *
 *   1. VEGA — THE SEAL. Vega is the brightest star in Lyra; the star
 *      navigators steered by, the zero-point brightness was calibrated
 *      against. The mark is a solid coin (a notary seal — the page's
 *      own device) with the four-point steer-star cut through it in
 *      TRUE negative space (evenodd): the disc carries 16px by mass,
 *      the star void carries the meaning at 24px+. Burnt orange on the
 *      espresso ground, the exact register of the live /vega page
 *      (R26 The Warm Chambers).
 *
 *   2. ATRIUM — THE COIN OF THE HOUSE (R28). Twin of the Vega coin: one
 *      solid emerald disc (the estate) with THE HOUSE cut through its
 *      heart — a Monopoly-style silhouette: pitched roof overhanging
 *      square walls (owner direction: "I don't like the Roman arch —
 *      we can have a Monopoly style house there instead"). The roof
 *      reads as property at a glance; the house is what Atrium manages,
 *      the coin is the estate it sits on. Sibling to the Vega star: the
 *      star is aspiration, the house is the estate. Mass carries 16px;
 *      the void carries the meaning; the pair read as a set — two
 *      coins, two hearts. Emerald on the estate's cream, the register
 *      of the live /atrium page.
 *
 * Both marks draw EXCLUSIVELY from design tokens (rgb(var(--x))) so the
 * token gate stays green — no hardcoded hexes in components. The
 * standalone favicon SVGs under public/brand/ are self-contained static
 * assets and carry resolved hex. Gradient ids are uniquified with useId —
 * several instances render on one page (nav, dropdown, footer).
 *
 * Presentational only — zero buttons (ADR-0004).
 */

type MarkProps = {
    className?: string;
    title?: string;
};

/** Vega — the Seal: a solid coin with the steer-star cut through it in
 *  true negative space (evenodd), burnt orange on the espresso ground
 *  (R26): the live /vega page's own register. */
export const VegaMark: React.FC<MarkProps> = ({ className = 'h-7 w-7', title }) => {
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    return (
        <svg
            viewBox="0 0 48 48"
            className={className}
            role={title ? 'img' : undefined}
            aria-hidden={title ? undefined : true}
            focusable="false"
        >
            {title && <title>{title}</title>}
            <defs>
                <linearGradient id={`vgmk${uid}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="rgb(var(--color-vega-night-2))" />
                    <stop offset="1" stopColor="rgb(var(--color-vega-night))" />
                </linearGradient>
                <linearGradient id={`vgsl${uid}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="rgb(var(--color-vega-gilt))" />
                    <stop offset="1" stopColor="rgb(var(--color-vega-gilt-bright))" />
                </linearGradient>
            </defs>
            {/* The quiet ground — the espresso ground the /vega page runs on */}
            <rect x="1" y="1" width="46" height="46" rx="11.5" fill={`url(#vgmk${uid})`} />
            {/* An orange hairline so the dark tile holds its edge on dark tab
                bars and dark UI rows — the page's orange rules, at mark scale. */}
            <rect
                x="1" y="1" width="46" height="46" rx="11.5"
                fill="none"
                stroke="rgb(var(--color-vega-gilt) / 0.5)"
                strokeWidth="1.5"
            />
            {/* The Seal — one solid coin (a notary seal) with the four-point
                steer-star cut through it in TRUE negative space (evenodd): the
                disc carries 16px by mass, the star void carries the meaning.
                The star is opened wide (waist ~3px at 16px) so the cutout
                never clogs on cheap displays. The coin is gilt-lit toward its
                bright corner. */}
            <path
                fillRule="evenodd"
                d="M24 7 A17 17 0 1 0 24 41 A17 17 0 1 0 24 7 Z
                   M24 12 L28.55 19.45 L36 24 L28.55 28.55 L24 36 L19.45 28.55 L12 24 L19.45 19.45 Z"
                fill={`url(#vgsl${uid})`}
            />
        </svg>
    );
};

/** Atrium — the Coin of the House (R28, re-tinted R32): a solid
 *  TERRACOTTA disc with a Monopoly-style house cut through its heart —
 *  pitched roof overhanging square walls — clay on the estate's cream:
 *  the live /atrium page's own register. Twin of the Vega coin — the pair
 *  read as a set: the star is aspiration, the house is the estate. */
export const AtriumMark: React.FC<MarkProps> = ({ className = 'h-7 w-7', title }) => {
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    return (
        <svg
            viewBox="0 0 48 48"
            className={className}
            role={title ? 'img' : undefined}
            aria-hidden={title ? undefined : true}
            focusable="false"
        >
            {title && <title>{title}</title>}
            <defs>
                <linearGradient id={`atmk${uid}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="rgb(var(--color-atrium-rust))" />
                    <stop offset="1" stopColor="rgb(var(--color-atrium-umber))" />
                </linearGradient>
            </defs>
            {/* The quiet ground — the estate's cream, the page's surface */}
            <rect x="1" y="1" width="46" height="46" rx="11.5" fill="rgb(var(--color-atrium-cream))" />
            {/* A clay hairline so the light tile holds its edge on light
                UI rows — the page's terracotta accent, at mark scale. */}
            <rect
                x="1" y="1" width="46" height="46" rx="11.5"
                fill="none"
                stroke="rgb(var(--color-atrium-clay) / 0.4)"
                strokeWidth="1.5"
            />
            {/* The Coin of the House — twin of the Vega coin: one solid
                terracotta disc (the estate) with a Monopoly-style house cut
                through its heart in TRUE negative space (evenodd) — a
                shallow pitched roof overhanging square walls with a
                chimney notch on the right slope (VLM round 2: the steep
                first cut read as an arrow at 16px; this geometry locks
                the house read). Mass carries 16px; the void carries
                the meaning; the pair read as a set. */}
            <path
                fillRule="evenodd"
                d="M24 7 A17 17 0 1 0 24 41 A17 17 0 1 0 24 7 Z
                   M24 15.5 L27 17.6 L27 15.9 L30.5 15.9 L30.5 20.45 L34.5 23.5 L31 23.5 L31 34.5 L17 34.5 L17 23.5 L13.5 23.5 Z"
                fill={`url(#atmk${uid})`}
            />
        </svg>
    );
};

/** The product mark for a given product id (used where the page already
 *  knows which product it is rendering — nav, footer, dropdowns). */
export const ProductMark: React.FC<{ product: 'vega' | 'atrium' } & MarkProps> = ({ product, ...rest }) =>
    product === 'vega' ? <VegaMark {...rest} /> : <AtriumMark {...rest} />;
