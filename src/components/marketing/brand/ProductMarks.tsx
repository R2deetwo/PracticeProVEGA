import React, { useId } from 'react';

/**
 * ProductMarks — PracticePro product identity marks (R26 → R47).
 *
 * Owner direction history: R26 chose objects with meaning over
 * letterforms; R28 and R39 evolved the Atrium coin through two object
 * marks (a house, then a courtyard plan). R47 reverses that call for
 * Atrium with a plain instruction — "look at the Practice Pro favicon.
 * It looks much clearer. You can see what it is. There's a big P" — the
 * letter wins. Clarity of the NAME beats cleverness of the object.
 *
 *   1. VEGA — THE SEAL (unchanged construction). Vega is the brightest
 *      star in Lyra; the mark is a solid coin (a notary seal) with the
 *      four-point steer-star cut through in TRUE negative space. R60:
 *      the tile is the executive NAVY of the light-enterprise rebrand
 *      (#1E3A8A → deep-navy corner) and the star is WHITE with an
 *      indigo-lit corner — the page's own navy-buttons-with-white-text
 *      pairing, at mark scale.
 *
 *   2. ATRIUM — THE STEPPED STACK (R57 construction, R60 colour). The
 *      company logo's own construction: a flat YELLOW tile (#EAB308,
 *      owner direction: "make atrium yellow"), three stepped
 *      translucent white blocks (100/80/60%), and the box A cut in
 *      negative space from the top block. The chunky solid emerald
 *      tile with the fat white A is long retired; the R57 indigo
 *      gives way to yellow.
 *
 * Both marks draw EXCLUSIVELY from design tokens (rgb(var(--x))) so the
 * token gate stays green — no hardcoded hexes in components (the white
 * letter is the one literal, the same white the company favicon's P
 * wears). The standalone favicon SVGs under public/brand/ are
 * self-contained static assets and carry resolved hex. Gradient ids are
 * uniquified with useId — several instances render on one page (nav,
 * dropdown, footer).
 *
 * Presentational only — zero buttons (ADR-0004).
 */

type MarkProps = {
    className?: string;
    title?: string;
};

/** Vega — the Seal: a solid coin with the steer-star cut through it in
 *  true negative space (evenodd). R60: the NEW BRAND register — the
 *  light-enterprise rebrand's executive navy tile (#1E3A8A gradient to
 *  the deep navy corner) with the star in WHITE, lit toward indigo
 *  (#C7D2FE) — the same navy-button/white-text pairing the /vega page
 *  wears. All via the --color-vega-seal* tokens, so the mark and the
 *  favicon stay in lockstep. */
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
                    <stop offset="0" stopColor="rgb(var(--color-vega-seal-ground))" />
                    <stop offset="1" stopColor="rgb(var(--color-vega-night))" />
                </linearGradient>
                <linearGradient id={`vgsl${uid}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="rgb(var(--color-vega-seal))" />
                    <stop offset="1" stopColor="rgb(var(--color-vega-seal-bright))" />
                </linearGradient>
            </defs>
            {/* The quiet ground — the executive navy tile of the
                light-enterprise rebrand; the white hairline holds the
                tile's edge on light and dark UI rows alike. */}
            <rect x="1" y="1" width="46" height="46" rx="11.5" fill={`url(#vgmk${uid})`} />
            {/* A star-white hairline so the navy tile holds its edge on
                dark tab bars and dark UI rows — at mark scale. */}
            <rect
                x="1" y="1" width="46" height="46" rx="11.5"
                fill="none"
                stroke="rgb(var(--color-vega-seal) / 0.5)"
                strokeWidth="1.5"
            />
            {/* The Seal — one solid coin (a notary seal) with the four-point
                steer-star cut through it in TRUE negative space (evenodd): the
                disc carries 16px by mass, the star void carries the meaning.
                The star is opened wide (waist ~3px at 16px) so the cutout
                never clogs on cheap displays. The coin is white, lit toward
                its indigo corner — the page's own navy/white pairing. */}
            <path
                fillRule="evenodd"
                d="M24 7 A17 17 0 1 0 24 41 A17 17 0 1 0 24 7 Z
                   M24 12 L28.55 19.45 L36 24 L28.55 28.55 L24 36 L19.45 28.55 L12 24 L19.45 19.45 Z"
                fill={`url(#vgsl${uid})`}
            />
        </svg>
    );
};

/** Atrium — the Stepped Stack (R57 construction, R60 colour): the
 *  company logo's own construction. Owner direction (R57): the favicon
 *  and logo were "too chunky" and the emerald read as a second
 *  PracticePro green at tab scale — "it should look like the style of
 *  the practicepro logo but a different color that works well." R60:
 *  "make atrium yellow instead of the current colour" — the tile is a
 *  confident YELLOW #EAB308 (warm against the cream/sage/emerald page,
 *  distinct from the hub green, Vega's navy and Komplete's ink), the
 *  three stepped translucent white blocks (100% → 80% → 60%) and the
 *  box A cut in negative space from the top block in the tile's own
 *  yellow. The letterform keeps R51's box register at the company P's
 *  stroke weight (stems 25% of the letter width). */
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
                {/* The stepped blocks are one gradient-free construction —
                    flat tile + literal whites at 100/80/60%, exactly like
                    the company logo's own three blocks (public/logo.svg).
                    The uid'd clip keeps the stack inside the tile's rounded
                    corners at every render size. */}
                <clipPath id={`atclip${uid}`}>
                    <rect x="1" y="1" width="46" height="46" rx="11.5" />
                </clipPath>
            </defs>
            {/* The estate tile — flat yellow, one color like the company
                logo's flat green. No gradient, no hairline: the stepped
                white stack holds the tile's edge on light and dark UI. */}
            <rect x="1" y="1" width="46" height="46" rx="11.5" fill="rgb(var(--color-atrium-tile))" />
            <g clipPath={`url(#atclip${uid})`}>
                {/* THE STEPPED STACK — three flush white blocks, each wider
                    than the one above (27 → 30 → 33 of 48), opacities
                    stepping 100% → 80% → 60%: the company logo's document
                    stack, at the P logo's own proportions (64-unit geometry
                    × 0.75). Reads as a layered stack of estate papers. */}
                <rect x="10.5" y="6" width="27" height="21" rx="1.5" fill="#FFFFFF" />
                <rect x="9" y="27" width="30" height="7.5" rx="1.5" fill="#FFFFFF" fillOpacity="0.8" />
                <rect x="7.5" y="34.5" width="33" height="7.5" rx="1.5" fill="#FFFFFF" fillOpacity="0.6" />
                {/* THE A — cut through the top block in the tile's own
                    yellow (negative space, the P's own formula), one
                    evenodd path: 18×18 letter box with the block's own
                    margins (4.5 side / 1.5 top-bottom — the P's 6/2 at
                    48 scale), 4.5-unit stems (25% of the letter width,
                    the P's stroke ratio), a 9×6 counter and a 6-unit open
                    foot. R51's orthogonal box register throughout. */}
                <path
                    fillRule="evenodd"
                    d="M15 7.5 H33 V25.5 H28.5 V19.5 H19.5 V25.5 H15 Z
                       M19.5 10.5 H28.5 V16.5 H19.5 Z"
                    fill="rgb(var(--color-atrium-tile))"
                />
            </g>
        </svg>
    );
};

/** The product mark for a given product id (used where the page already
 *  knows which product it is rendering — nav, footer, dropdowns). */
export const ProductMark: React.FC<{ product: 'vega' | 'atrium' } & MarkProps> = ({ product, ...rest }) =>
    product === 'vega' ? <VegaMark {...rest} /> : <AtriumMark {...rest} />;
