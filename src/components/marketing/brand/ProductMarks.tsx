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
 *   2. ATRIUM — THE COIN, IN THE ROUND. Twin of the Vega coin: one
 *      solid emerald disc (the estate) with the square open court cut
 *      through its heart (the void that names the building — the
 *      atrium IS its court). A square void in a round coin: the shape
 *      of a classical coin of trade, for the product that collects the
 *      rent. Mass carries 16px; the void carries the meaning; the pair
 *      read as a set — two coins, two hearts. Emerald on the estate's
 *      cream, the register of the live /atrium page.
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

/** Atrium — the Coin, in the round: a solid emerald disc with the
 *  square open court cut through its heart, emerald on the estate's
 *  cream (R26): the live /atrium page's own register. Twin of the Vega
 *  coin — the pair read as a set. */
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
                    <stop offset="0" stopColor="rgb(var(--color-atrium-jade))" />
                    <stop offset="1" stopColor="rgb(var(--color-atrium-pine))" />
                </linearGradient>
            </defs>
            {/* The quiet ground — the estate's cream, the page's surface */}
            <rect x="1" y="1" width="46" height="46" rx="11.5" fill="rgb(var(--color-cream))" />
            {/* An emerald hairline so the light tile holds its edge on light
                UI rows — the page's emerald accent, at mark scale. */}
            <rect
                x="1" y="1" width="46" height="46" rx="11.5"
                fill="none"
                stroke="rgb(var(--color-atrium-jade) / 0.4)"
                strokeWidth="1.5"
            />
            {/* The Coin — twin of the Vega coin: one solid emerald disc
                (the estate) with the square open court cut through its
                heart in TRUE negative space (evenodd). Mass carries 16px;
                the void carries the meaning; the pair read as a set. */}
            <path
                fillRule="evenodd"
                d="M24 7 A17 17 0 1 0 24 41 A17 17 0 1 0 24 7 Z
                   M19.5 17 H28.5 A2.5 2.5 0 0 1 31 19.5 V28.5 A2.5 2.5 0 0 1 28.5 31 H19.5 A2.5 2.5 0 0 1 17 28.5 V19.5 A2.5 2.5 0 0 1 19.5 17 Z"
                fill={`url(#atmk${uid})`}
            />
        </svg>
    );
};

/** The product mark for a given product id (used where the page already
 *  knows which product it is rendering — nav, footer, dropdowns). */
export const ProductMark: React.FC<{ product: 'vega' | 'atrium' } & MarkProps> = ({ product, ...rest }) =>
    product === 'vega' ? <VegaMark {...rest} /> : <AtriumMark {...rest} />;
