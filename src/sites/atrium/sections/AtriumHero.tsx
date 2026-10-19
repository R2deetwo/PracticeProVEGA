import React, { useEffect, useMemo, useRef } from 'react';

/**
 * AtriumHero — "The Terracotta Estate" hero for /atrium (R32 rebrand).
 *
 * The deferred signature, executed: a PLAN-VIEW ESTATE MAP drawn as an
 * architectural master plan — the same 24-unit demo estate the rest of the
 * page exhibits (Wemabod Estate, Phase 2: the occupancy grid, Unit B14's
 * receipt, Adaeze's portal, the Sentry Pass gate) — so the whole page tells
 * ONE estate's story. The board is a physical object: it rests tilted on
 * the estate office table (perspective + warm shadow), leans a few degrees
 * toward the pointer, and it LIVES — occupied units breathe in a slow wave,
 * a resident's car traces the ring road, the gatehouse beacon pings.
 * Reduced motion holds a single static frame (CSS guards).
 *
 * Voice: Bricolage Grotesque display (via the theme's --font-display
 * override), IBM Plex Mono for the plan's title block — the register of
 * notices, receipts and ledgers. Clay as the single accent; no emerald,
 * no moss, no gradient text.
 *
 * Presentational only — CTAs arrive as nodes from the site index
 * (ADR-0004: zero raw form elements). The eyebrow string is pinned in
 * the site index and passed via prop.
 */

/** The estate's 24 units — 4 blocks × 6, identical to the occupancy grid
 * in AtriumEstate (22 occupied · 2 vacant · 91.7%). One story, one estate. */
const BLOCKS: Array<{ id: string; occupied: boolean[] }> = [
    { id: 'A', occupied: [true, true, true, true, true, true] },
    { id: 'B', occupied: [true, true, false, true, true, true] }, // B3 vacant
    { id: 'C', occupied: [true, true, true, true, true, true] },
    { id: 'D', occupied: [true, true, true, false, true, true] }, // D4 vacant
];

const unitId = (block: string, i: number) => `${block}${i + 1}`;

/* ── Plan geometry (viewBox 0 0 560 470) ─────────────────────────────────
   Ring road: rounded rect inset. Blocks inside the ring around a central
   green. Gatehouse at the bottom entrance; spur road runs down to it. */
const RING = { x: 48, y: 42, w: 464, h: 322, rx: 30 };
const UNIT_W = 26;
const UNIT_H = 34;
const UNIT_GAP = 7;

/** A horizontal row of 6 units (blocks C and D). */
const RowBlock: React.FC<{ block: string; occupied: boolean[]; x: number; y: number }> = ({ block, occupied, x, y }) => (
    <>
        {occupied.map((occ, i) => {
            const ux = x + i * (UNIT_W + UNIT_GAP);
            return (
                <g key={unitId(block, i)}>
                    <rect
                        x={ux} y={y} width={UNIT_W} height={UNIT_H} rx="3"
                        className={occ ? 'at-plan-unit--occupied' : undefined}
                        style={occ ? { animationDelay: `${((i + block.charCodeAt(0)) * 0.34) % 5.2}s` } : undefined}
                        fill={occ ? 'rgb(180 83 42 / 0.16)' : 'rgb(180 132 108 / 0.06)'}
                        stroke={occ ? 'rgb(180 83 42 / 0.45)' : 'rgb(180 132 108 / 0.55)'}
                        strokeWidth={occ ? 1 : 1}
                        strokeDasharray={occ ? undefined : '3 2'}
                    />
                    <text
                        x={ux + UNIT_W / 2} y={y + UNIT_H / 2 + 2.5}
                        textAnchor="middle"
                        fontSize="7.5"
                        fontFamily="'IBM Plex Mono', monospace"
                        fill={occ ? 'rgb(122 52 25)' : 'rgb(180 132 108)'}
                    >
                        {unitId(block, i)}
                    </text>
                </g>
            );
        })}
    </>
);

/** A 2×3 stack of units (blocks A and B, the side terraces). */
const StackBlock: React.FC<{ block: string; occupied: boolean[]; x: number; y: number }> = ({ block, occupied, x, y }) => (
    <>
        {occupied.map((occ, i) => {
            const col = Math.floor(i / 3);
            const row = i % 3;
            const ux = x + col * (UNIT_W + UNIT_GAP);
            const uy = y + row * (UNIT_H + UNIT_GAP);
            return (
                <g key={unitId(block, i)}>
                    <rect
                        x={ux} y={uy} width={UNIT_W} height={UNIT_H} rx="3"
                        className={occ ? 'at-plan-unit--occupied' : undefined}
                        style={occ ? { animationDelay: `${((i + block.charCodeAt(0)) * 0.34) % 5.2}s` } : undefined}
                        fill={occ ? 'rgb(180 83 42 / 0.16)' : 'rgb(180 132 108 / 0.06)'}
                        stroke={occ ? 'rgb(180 83 42 / 0.45)' : 'rgb(180 132 108 / 0.55)'}
                        strokeWidth={1}
                        strokeDasharray={occ ? undefined : '3 2'}
                    />
                    <text
                        x={ux + UNIT_W / 2} y={uy + UNIT_H / 2 + 2.5}
                        textAnchor="middle"
                        fontSize="7.5"
                        fontFamily="'IBM Plex Mono', monospace"
                        fill={occ ? 'rgb(122 52 25)' : 'rgb(180 132 108)'}
                    >
                        {unitId(block, i)}
                    </text>
                </g>
            );
        })}
    </>
);

export const AtriumHero: React.FC<{
    /** Pinned attribution string — owned by the site index. */
    eyebrow: string;
    /** CTA nodes (Atrium: clay primary + warm-neutral ghost). */
    cta: React.ReactNode;
}> = ({ eyebrow, cta }) => {
    /* The board is a physical model — it leans toward the pointer a few
       degrees (rAF-throttled CSS vars). Touch devices and reduced-motion
       users keep the resting tilt; input feedback is allowed to snap. */
    const boardFrameRef = useRef<HTMLDivElement>(null);
    const boardRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number>(0);
    const canTilt = useMemo(() =>
        typeof window !== 'undefined' &&
        window.matchMedia('(hover: hover) and (pointer: fine)').matches, []);

    useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!canTilt) return;
        const el = boardFrameRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            el.style.setProperty('--at-tilt-y', `${(px * 8).toFixed(2)}deg`);
            el.style.setProperty('--at-tilt-x', `${(-py * 6).toFixed(2)}deg`);
        });
    };
    const onPointerLeave = () => {
        if (!canTilt) return;
        const el = boardFrameRef.current;
        if (!el) return;
        cancelAnimationFrame(rafRef.current);
        el.style.setProperty('--at-tilt-x', '0deg');
        el.style.setProperty('--at-tilt-y', '0deg');
    };

    return (
        <section id="home" className="relative overflow-hidden">
            {/* The drafting-table ground — a faint blueprint grid fading out
                from the plan, the register of a master plan in progress. */}
            <div
                className="absolute inset-0 pointer-events-none"
                aria-hidden="true"
                style={{
                    backgroundImage:
                        'linear-gradient(rgb(180 83 42 / 0.05) 1px, transparent 1px), linear-gradient(90deg, rgb(180 83 42 / 0.05) 1px, transparent 1px)',
                    backgroundSize: '36px 36px',
                    maskImage: 'radial-gradient(ellipse 90% 80% at 65% 40%, black 30%, transparent 75%)',
                    WebkitMaskImage: 'radial-gradient(ellipse 90% 80% at 65% 40%, black 30%, transparent 75%)',
                }}
            />

            <div className="relative container mx-auto px-4 sm:px-6 pt-32 md:pt-40 pb-16 md:pb-20">
                <div className="grid lg:grid-cols-12 gap-12 lg:gap-8 items-center">
                    {/* LEFT — the estate's voice */}
                    <div className="lg:col-span-5 max-w-xl">
                        <p className="font-mono text-2xs sm:text-xs font-medium uppercase tracking-[0.3em] text-atrium-clay mb-6">
                            {eyebrow}
                        </p>
                        <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.4rem] font-bold tracking-tight leading-[1.08] text-atrium-ink mb-6">
                            The <span className="text-atrium-clay">well-kept</span> estate, run from one place.
                        </h1>
                        <p className="text-lg leading-[1.7] text-slate-600 mb-10">
                            Rent and service-charge collection, a residents&rsquo; portal, maintenance
                            workflows, visitor passes and revenue intelligence — the whole estate
                            in one system, for Nigerian portfolios at home or from abroad.
                        </p>

                        {/* CTAs — hidden on mobile (MobileStickyCTA carries them) */}
                        <div className="hidden md:flex items-center gap-4">{cta}</div>
                    </div>

                    {/* RIGHT — the plan-view estate map, a physical model on
                        the estate office table. */}
                    <div className="lg:col-span-7">
                        <div
                            ref={boardFrameRef}
                            className="at-plan-board__frame"
                            onPointerMove={onPointerMove}
                            onPointerLeave={onPointerLeave}
                        >
                            <div
                                ref={boardRef}
                                className="at-plan-board relative rounded-2xl border border-atrium-sand bg-white shadow-[0_2px_6px_rgb(75_50_35/0.08),0_28px_50px_-16px_rgb(75_50_35/0.28)]"
                                role="img"
                                aria-label="Plan-view master plan of Wemabod Estate Phase 2 — 24 units around a central green, ring road and gatehouse; 22 occupied, 2 vacant"
                            >
                                <svg viewBox="0 0 560 470" className="block w-full h-auto" aria-hidden="true">
                                    <defs>
                                        {/* The ring road the car traces — the animateMotion track. */}
                                        <path
                                            id="at-plan-road"
                                            d={`M ${RING.x} ${RING.y + RING.rx}
                                                a ${RING.rx} ${RING.rx} 0 0 1 ${RING.rx} -${RING.rx}
                                                h ${RING.w - 2 * RING.rx}
                                                a ${RING.rx} ${RING.rx} 0 0 1 ${RING.rx} ${RING.rx}
                                                v ${RING.h - 2 * RING.rx}
                                                a ${RING.rx} ${RING.rx} 0 0 1 -${RING.rx} ${RING.rx}
                                                h -${RING.w - 2 * RING.rx}
                                                a ${RING.rx} ${RING.rx} 0 0 1 -${RING.rx} -${RING.rx}
                                                z`}
                                        />
                                    </defs>

                                    {/* Board ground — the plan sheet itself */}
                                    <rect x="0" y="0" width="560" height="470" fill="#FFFFFF" />

                                    {/* Central green — trees as plan-view circles */}
                                    <ellipse cx="280" cy="205" rx="72" ry="58" fill="rgb(232 220 198 / 0.55)" />
                                    {[
                                        [258, 186, 9], [300, 178, 7], [244, 222, 7], [296, 228, 9],
                                        [276, 205, 6], [318, 202, 6], [262, 244, 6],
                                    ].map(([tx, ty, tr], i) => (
                                        <g key={i}>
                                            <circle cx={tx} cy={ty} r={tr} fill="rgb(146 100 62 / 0.18)" />
                                            <circle cx={tx} cy={ty} r={tr * 0.35} fill="rgb(146 100 62 / 0.30)" />
                                        </g>
                                    ))}
                                    {/* The clubhouse pavilion on the green */}
                                    <rect x="262" y="150" width="36" height="20" rx="4" fill="rgb(180 83 42 / 0.10)" stroke="rgb(180 83 42 / 0.4)" strokeWidth="1" />
                                    <text x="280" y="163.5" textAnchor="middle" fontSize="6.5" fontFamily="'IBM Plex Mono', monospace" fill="rgb(122 52 25)" letterSpacing="0.5">CLUB</text>

                                    {/* Ring road */}
                                    <use href="#at-plan-road" fill="none" stroke="rgb(180 132 108 / 0.28)" strokeWidth="13" strokeLinejoin="round" />
                                    <use href="#at-plan-road" fill="none" stroke="rgb(180 132 108 / 0.14)" strokeWidth="2" strokeDasharray="1 9" strokeLinecap="round" />

                                    {/* Gate spur — from the ring's bottom road down to the gatehouse */}
                                    <line x1="280" y1={RING.y + RING.h} x2="280" y2="428" stroke="rgb(180 132 108 / 0.28)" strokeWidth="13" />
                                    <line x1="280" y1={RING.y + RING.h} x2="280" y2="428" stroke="rgb(180 132 108 / 0.14)" strokeWidth="2" strokeDasharray="1 9" strokeLinecap="round" />

                                    {/* The resident's car — a dot of life on the ring road. */}
                                    <g className="at-plan-car">
                                        <rect x="-8" y="-4.5" width="16" height="9" rx="3.5" fill="rgb(180 83 42)" />
                                        <rect x="-4.5" y="-3" width="6" height="6" rx="1.5" fill="rgb(247 241 230 / 0.9)" />
                                        <animateMotion dur="24s" repeatCount="indefinite" rotate="auto">
                                            <mpath href="#at-plan-road" />
                                        </animateMotion>
                                    </g>

                                    {/* Blocks — A/B terraces flank the green, C/D close the ring */}
                                    <RowBlock block="C" occupied={BLOCKS[2].occupied} x={187} y={62} />
                                    <RowBlock block="D" occupied={BLOCKS[3].occupied} x={187} y={300} />
                                    <StackBlock block="A" occupied={BLOCKS[0].occupied} x={84} y={150} />
                                    <StackBlock block="B" occupied={BLOCKS[1].occupied} x={424} y={150} />

                                    {/* Parking bays along the top road */}
                                    {Array.from({ length: 7 }).map((_, i) => (
                                        <line
                                            key={i}
                                            x1={200 + i * 14} y1={RING.y + 16}
                                            x2={200 + i * 14} y2={RING.y + 28}
                                            stroke="rgb(180 132 108 / 0.35)" strokeWidth="1.5"
                                        />
                                    ))}

                                    {/* The gatehouse — the estate's front door. */}
                                    <rect x="260" y="424" width="40" height="26" rx="4" fill="rgb(180 83 42 / 0.12)" stroke="rgb(180 83 42 / 0.5)" strokeWidth="1.2" />
                                    <text x="280" y="440.5" textAnchor="middle" fontSize="6.5" fontFamily="'IBM Plex Mono', monospace" fill="rgb(122 52 25)" letterSpacing="0.5">GATE</text>
                                    {/* Beacon — the Sentry Pass ping. */}
                                    <circle className="at-plan-beacon" cx="280" cy="437" r="7" fill="none" stroke="rgb(180 83 42)" strokeWidth="1.5" />
                                    <circle cx="280" cy="437" r="2.4" fill="rgb(180 83 42)" />

                                    {/* The master plan's title block — architectural furniture. */}
                                    <g fontFamily="'IBM Plex Mono', monospace" fill="rgb(122 52 25 / 0.75)">
                                        {/* North arrow */}
                                        <g transform="translate(516, 66)">
                                            <circle r="13" fill="none" stroke="rgb(180 83 42 / 0.35)" strokeWidth="1" />
                                            <path d="M0 7 L0 -6 M0 -6 l-3.5 4.5 M0 -6 l3.5 4.5" stroke="rgb(180 83 42 / 0.7)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
                                            <text y="-17" textAnchor="middle" fontSize="7" letterSpacing="1">N</text>
                                        </g>
                                        {/* Scale bar */}
                                        <g transform="translate(48, 452)">
                                            <line x1="0" y1="0" x2="60" y2="0" stroke="rgb(180 83 42 / 0.45)" strokeWidth="1.2" />
                                            <line x1="0" y1="-3" x2="0" y2="3" stroke="rgb(180 83 42 / 0.45)" strokeWidth="1.2" />
                                            <line x1="30" y1="-2" x2="30" y2="2" stroke="rgb(180 83 42 / 0.45)" strokeWidth="1" />
                                            <line x1="60" y1="-3" x2="60" y2="3" stroke="rgb(180 83 42 / 0.45)" strokeWidth="1.2" />
                                            <text x="30" y="12" textAnchor="middle" fontSize="6.5" letterSpacing="1">50 M</text>
                                        </g>
                                        {/* Title */}
                                        <text x="512" y="449" textAnchor="end" fontSize="7.5" letterSpacing="1.2">WEMABOD ESTATE · PHASE 2</text>
                                        <text x="512" y="460" textAnchor="end" fontSize="7.5" letterSpacing="1.2" fill="rgb(122 52 25 / 0.5)">24 UNITS · 22 OCCUPIED · 91.7%</text>
                                    </g>
                                </svg>

                                {/* Legend chips — plan furniture, HTML for crisp type */}
                                <div className="absolute bottom-3 left-3 flex items-center gap-4">
                                    <span className="flex items-center gap-1.5 text-2xs text-slate-500">
                                        <span className="inline-block w-2.5 h-2.5 rounded-[3px] bg-atrium-clay/20 border border-atrium-clay/50" />
                                        Occupied
                                    </span>
                                    <span className="flex items-center gap-1.5 text-2xs text-slate-500">
                                        <span className="inline-block w-2.5 h-2.5 rounded-[3px] border border-dashed border-atrium-tan/70" />
                                        Vacant
                                    </span>
                                </div>
                            </div>
                        </div>
                        <p className="font-mono text-2xs tracking-[0.18em] text-slate-400 mt-5 text-center">
                            THE PORTFOLIO AS A MASTER PLAN — MOVE YOUR CURSOR OVER THE BOARD
                        </p>
                    </div>
                </div>
            </div>

            {/* The gatehouse register — the estate's day, as the system sees
                it. Paper card sliding over the plan's bottom edge. */}
            <div className="relative container mx-auto px-4 sm:px-6">
                <div className="max-w-4xl -mt-4 md:-mt-6 rounded-2xl bg-white/95 backdrop-blur-sm border border-atrium-sand shadow-elevation-2 p-6 md:p-8 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-6 sm:gap-8 sm:items-center">
                    <div>
                        <p className="font-mono text-2xs uppercase tracking-[0.22em] text-atrium-clay mb-3">
                            Gatehouse register — 18 Oct 2026
                        </p>
                        <p className="text-sm leading-relaxed text-slate-600">
                            <span className="font-mono nums-tabular font-semibold text-atrium-ink">&#8358;2.4M</span> collected ·{' '}
                            <span className="font-mono nums-tabular font-semibold text-atrium-ink">3</span> receipts issued ·{' '}
                            <span className="font-mono nums-tabular font-semibold text-atrium-ink">2</span> visitor passes ·{' '}
                            <span className="font-mono nums-tabular font-semibold text-atrium-ink">1</span> maintenance ticket opened
                        </p>
                        <p className="text-2xs text-slate-400 mt-2.5">
                            EXHIBIT — A DAY AT THE ESTATE, AS ATRIUM SEES IT
                        </p>
                    </div>
                    <div className="w-px self-stretch bg-atrium-sand hidden sm:block" aria-hidden="true" />
                    <div>
                        <p className="font-mono nums-tabular text-2xl md:text-3xl font-semibold text-atrium-clay">
                            98.2%
                        </p>
                        <p className="text-sm text-slate-600 mt-1">
                            typical first-month collection rate on estates that move to Atrium
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};
