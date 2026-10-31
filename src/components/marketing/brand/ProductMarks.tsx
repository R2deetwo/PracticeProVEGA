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
 *   1. VEGA — THE SEAL (unchanged). Vega is the brightest star in Lyra;
 *      the mark is a solid coin (a notary seal) with the four-point
 *      steer-star cut through in TRUE negative space. Burnt orange on
 *      the espresso ground, the register of the live /vega page.
 *
 *   2. ATRIUM — THE BIG A (R47). A solid emerald tile with a bold
 *      white A — the PracticePro favicon's own formula: the company
 *      tile says "P", the estate tile says "A". Mass carries 16px; the
 *      letter carries the meaning; nothing to decode at a glance.
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
 *  true negative space (evenodd), burnt orange on the espresso ground
 *  (R26): the live /vega page's own register. R54: the star and hairline
 *  now paint in the FAVICON's own orange (--color-vega-seal tokens,
 *  #E07A3F → #F3A66A) — owner direction: "the vega logo is also too
 *  dark on the page and it is different from the favicon color.. we
 *  want the favicon color as the standard please." The ground matches
 *  the favicon tile too (#2E2015 → #22170F). */
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
            {/* The quiet ground — the espresso ground the /vega page runs on */}
            <rect x="1" y="1" width="46" height="46" rx="11.5" fill={`url(#vgmk${uid})`} />
            {/* An orange hairline so the dark tile holds its edge on dark tab
                bars and dark UI rows — the page's orange rules, at mark scale. */}
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

/** Atrium — the Big A (R47, redrawn R51): a solid emerald tile with a
 *  cut through it — the PracticePro favicon's own formula (owner
 *  direction: "I don't like the favicon or even the icon for Atrium.
 *  For Atrium, I think it would look better if you look at the Practice
 *  Pro favicon. It looks much clearer. You can see what it is. There's
 *  a big P"). The company tile says "P"; the estate tile says "A" —
 *  same family, one letter each, nothing to decode. Mass carries 16px;
 *  the letter carries the meaning; nothing to interpret at a glance.
 *  (R28's house mark and R39's courtyard coin are retired by
 *  owner direction — the courtyard read as abstract geometry, not as
 *  the product's name.) R51 redraws the letterform by owner direction
 *  ("make the 'A' have a flat top it looks too pointed please. it
 *  should be a box 'A' not with slants"): the pointed apex and splayed
 *  legs are gone — the A is a BOX letter, every edge orthogonal. */
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
            {/* The estate tile — solid emerald (jade lit toward pine), the
                exact register of the live /atrium page's own greens. White
                letter on the filled tile: the PracticePro "big P" favicon
                formula, which the owner holds up as the standard of
                clarity. No hairline — the filled tile holds its own edge
                on light and dark UI alike. */}
            <rect x="1" y="1" width="46" height="46" rx="11.5" fill={`url(#atmk${uid})`} />
            {/* THE A — one bold BOX letterform (R51), solid white, sized
                like the company favicon's P: the letter spans 75% of the
                tile's width and 81% of its height and is drawn as a
                single evenodd path with ONLY orthogonal edges — a flat
                top across the full 6→42 span, two vertical 8.5-unit
                stems (≈2.8px at a 16px tab render — the P's own stem
                weight), a 6.5-unit crossbar, a rectangular counter
                (19×12.5) and a squared foot notch. No apex, no splayed
                legs — the box register the owner asked for (R51:
                "it should be a box 'A' not with slants"). The counter
                and notch open wider than the R47 triangle, so the
                letter stays VLM-legible at 16px. */}
            <path
                fillRule="evenodd"
                d="M6 4.5 H42 V43.5 H33.5 V32 H14.5 V43.5 H6 Z
                   M14.5 13 H33.5 V25.5 H14.5 Z"
                fill="#FFFFFF"
            />
        </svg>
    );
};

/** The product mark for a given product id (used where the page already
 *  knows which product it is rendering — nav, footer, dropdowns). */
export const ProductMark: React.FC<{ product: 'vega' | 'atrium' } & MarkProps> = ({ product, ...rest }) =>
    product === 'vega' ? <VegaMark {...rest} /> : <AtriumMark {...rest} />;
