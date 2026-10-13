import React, { useId } from 'react';

/**
 * ProductMarks — PracticePro product identity marks (R23).
 *
 * Owner direction: the literal marks (a sparkle-star seal, a doorway arch
 * with a floating keystone) "look like emojis — absolutely far from SaaS
 * level quality". The emoji formula is: a flat saturated tile + a literal
 * drawn object + a cute floating detail. The R23 marks replace all three:
 *
 *   1. GEOMETRIC MONOGRAMS, not objects. Vega is one solid constructed
 *      "V" — the star is cut INTO the letterform as a diamond void at its
 *      point (negative space, the most premium trick in the book — the
 *      FedEx arrow move), never a bauble floating in a notch. Atrium is
 *      one solid constructed "A" whose apex is domed — the atrium
 *      cupola in a single architectural gesture, no floor line, no
 *      floating keystone.
 *
 *   2. QUIET GROUNDS, not stickers. One clean diagonal gradient (lit
 *      corner → deep corner) on a squircle, no inner rings, no bevels,
 *      no sheens — the flatness of Stripe/Slack app icons.
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

/** Vega — solid V monogram with the star cut into its point, on claret. */
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
                    <stop offset="0" stopColor="rgb(var(--color-vega-claret-lift))" />
                    <stop offset="1" stopColor="rgb(var(--color-vega-oxblood))" />
                </linearGradient>
            </defs>
            {/* The quiet ground */}
            <rect x="1" y="1" width="46" height="46" rx="11.5" fill={`url(#vgmk${uid})`} />
            {/* The V — one solid constructed path, parallel arms, and a
                chisel-flat point (a needle vertex anti-aliases to mud at
                16px); the star (Vega, brightest in Lyra) is a diamond
                void cut into the point, sized to the point's optical
                centre. */}
            <path
                fillRule="evenodd"
                d="M11 13 H17.8 L24 26.03 L30.2 13 H37 L25.2 37.8 H22.8 Z
                   M24 28.3 L26.9 31.9 L24 35.5 L21.1 31.9 Z"
                fill="rgb(var(--color-vega-parchment))"
            />
        </svg>
    );
};

/** Atrium — solid A monogram with a domed apex, on pine. */
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
            {/* The quiet ground */}
            <rect x="1" y="1" width="46" height="46" rx="11.5" fill={`url(#atmk${uid})`} />
            {/* The A — one solid path: domed apex (the cupola), open
                doorway between the legs, slender counter above a HIGH
                crossbar (optical rule: the bar rides the counter's
                centre, not the glyph's); evenodd carves both apertures. */}
            <path
                fillRule="evenodd"
                d="M21.9 11 A2.55 2.55 0 0 1 26.1 11 L35 38.5 H13 Z
                   M20.3 38.5 L22.3 28.9 H25.7 L27.7 38.5 Z
                   M24 14.5 L26.6 24.5 H21.4 Z"
                fill="rgb(var(--color-cream))"
            />
        </svg>
    );
};

/** The product mark for a given product id (used where the page already
 *  knows which product it is rendering — nav, footer, dropdowns). */
export const ProductMark: React.FC<{ product: 'vega' | 'atrium' } & MarkProps> = ({ product, ...rest }) =>
    product === 'vega' ? <VegaMark {...rest} /> : <AtriumMark {...rest} />;
