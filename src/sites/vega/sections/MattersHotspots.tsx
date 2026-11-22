import React, { useState } from 'react';
import { Z_CLASS } from '../../../overlays/constants';
import { ZoneRing } from './DashboardHotspots';

/**
 * MattersHotspots — the interactive highlight callouts for the MATTERS
 * exhibit (2026-11-22 owner direction: "extend interactive highlightable
 * feature callouts — explaining what each feature does and its practical
 * benefit to a law firm — to Matters as well, rather than limiting
 * highlights/explanations to Dashboard").
 *
 * THE MODEL (DashboardHotspots' engine, one exhibit over):
 *   • Every zone wears the soft DASHED INDIGO outline AT REST (visible by
 *     default — never hidden until hover) and sharpens to the solid ring
 *     + wash on hover/focus.
 *   • HOVER a zone → the dim veil grays out the rest of the capture (the
 *     zone's own pixels stay lit inside the ring) and a FLOATING HINT
 *     explains the feature and what it buys a firm.
 *   • No click furniture here — the Matters story is the ledger itself:
 *     the New-matter flow, the filters, the search, the stage-tagged
 *     cards, the co-counsel stacks, the detail pane and Aloa.
 *
 * GEOMETRY — measured on matters-ledger.jpg (2880×1800, 2026-11-22)
 * with pixel analysis (scripts/measure_matters.py: box borders, text
 * bands and the list/detail divider) and converted with the
 * R78-correct factors (%width → cqw directly; %height × 0.625 → cqw;
 * frame = 100 × 62.5cqw at the capture's 8:5). The view is a
 * master/detail pane (the ledger list left, the detail pane right),
 * not a table — the zones frame the list's real furniture:
 *   • title/view toggles/+ New    y 6.5–12.0%h, x 19.5–45%w
 *   • status + practice filters   y 12.6–15.9%h (boxed)
 *   • search input                y 17.2–21.4%h (boxed)
 *   • the matter cards            y 27.5–97%h, x 19.7–43.9%w
 *   • card 1's co-counsel row     y 34.3–37.0%h, x 20.5–30%w
 *   • the detail pane             x 44.3–99.5%w (divider at 44.1)
 *   • the Aloa orb                x 94.5–98%w,   y 92–98.3%h
 *
 * Presentational chrome only (ADR-0004: the zones are non-interactive
 * divs, the ring is inert); all state is local.
 */

type ZoneId = 'new' | 'filters' | 'search' | 'cards' | 'assignees' | 'detail' | 'aloa';

interface ZoneDef {
    id: ZoneId;
    label: string;
    desc: string;
    top: number;
    left: number;
    width: number;
    height: number;
    /** Round the ring like the pixels it frames. */
    shape?: 'lg' | 'full';
    /** Show the hint above the zone (for zones low in the frame). */
    hintAbove?: boolean;
}

const ZONES: ZoneDef[] = [
    {
        id: 'new',
        label: 'Open a matter in seconds',
        desc: 'The + New flow captures the parties, the court and the practice area up front — the CPR deadline engine and the diary key off it from day one.',
        top: 4.0, left: 19.5, width: 24.3, height: 3.4, shape: 'lg',
    },
    {
        id: 'filters',
        label: 'Slice the ledger',
        desc: 'Filter by status and practice area without losing the count — the header keeps an honest "7 total matters" as the view narrows.',
        top: 7.7, left: 19.7, width: 20.5, height: 2.2, shape: 'lg',
    },
    {
        id: 'search',
        label: 'Find any file',
        desc: 'Search by party, client or the matter\u2019s own reference — MAR/2024/011-style IDs are generated automatically, ready for court processes.',
        top: 10.7, left: 19.7, width: 23.5, height: 2.7, shape: 'lg',
    },
    {
        id: 'cards',
        label: 'Stage-tagged files',
        desc: 'Every matter carries its stage — TRIAL, PLEADINGS, MEDIATION — so the whole firm sees where each file stands without opening it.',
        top: 17.2, left: 19.7, width: 24.2, height: 43.4, shape: 'lg', hintAbove: true,
    },
    {
        id: 'assignees',
        label: 'Counsel on every file',
        desc: 'Matters carry their lead and co-counsel — overlapping avatars mean shared responsibility, and each lawyer\u2019s board follows their own files.',
        top: 21.2, left: 20.5, width: 10.0, height: 2.0, shape: 'lg',
    },
    {
        id: 'detail',
        label: 'The file, one click deep',
        desc: 'Click a matter and its full file opens alongside — parties, documents, hearings and the CPR deadline diary — without losing the ledger.',
        top: 4.0, left: 44.3, width: 55.2, height: 58.0, shape: 'lg', hintAbove: true,
    },
    {
        id: 'aloa',
        label: 'Aloa',
        desc: 'The firm\u2019s legal AI — on every file. Ask it for a chronology, a next step or the last thing that happened.',
        top: 57.5, left: 94.5, width: 3.5, height: 3.9, shape: 'full',
    },
];

const zoneById = (id: ZoneId) => ZONES.find((z) => z.id === id)!;

export const MattersHotspots: React.FC = () => {
    const [hoverZone, setHoverZone] = useState<ZoneId | null>(null);
    const zone = hoverZone ? zoneById(hoverZone) : null;

    return (
        <>
            {/* ── THE DIM VEIL — the spotlight (DashboardHotspots' model):
                the hovered zone keeps its pixels inside the soft ring
                while the 200cqw shadow spread grays out everything else. ── */}
            <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${Z_CLASS.captureDim} ${zone ? 'opacity-100' : 'opacity-0'}`}
                style={{ visibility: zone ? 'visible' : 'hidden' }}
            >
                {zone && (
                    <div
                        className="absolute"
                        style={{
                            top: `${zone.top}cqw`,
                            left: `${zone.left}cqw`,
                            width: `${zone.width}cqw`,
                            height: `${zone.height}cqw`,
                            borderRadius: zone.shape === 'full' ? '9999px' : '0.6cqw',
                            boxShadow: '0 0 0 200cqw rgba(2, 6, 23, 0.55)',
                        }}
                    />
                )}
            </div>

            {/* ── The informational hover zones — visible dashed markers at
                rest, the spotlight + floating hint on hover/focus. ── */}
            {ZONES.map((z) => (
                <div
                    key={z.id}
                    role="img"
                    aria-label={`${z.label} — ${z.desc}`}
                    onMouseEnter={() => setHoverZone(z.id)}
                    onMouseLeave={() => setHoverZone((v) => (v === z.id ? null : v))}
                    className={`absolute ${Z_CLASS.captureHint} rounded-lg group-hs`}
                    style={{ top: `${z.top}cqw`, left: `${z.left}cqw`, height: `${z.height}cqw`, width: `${z.width}cqw` }}
                >
                    <ZoneRing shape={z.shape} />
                </div>
            ))}

            {/* ── THE FLOATING HINT — the feature's explanation, floating
                beside the zone, clamped INSIDE the frame (notes for zones
                low or high in the frame never clip), never blocking it. ── */}
            {zone && (
                <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute ${Z_CLASS.captureHintNote} -translate-x-1/2 w-max max-w-[40cqw] rounded-lg bg-slate-950/90 backdrop-blur-sm px-[1.3cqw] py-[0.9cqw] shadow-xl animate-fade-in`}
                    style={{
                        left: `${Math.min(Math.max(zone.left + zone.width / 2, 21), 79)}cqw`,
                        top: `${zone.hintAbove ? Math.max(zone.top - 6.4, 1) : Math.min(zone.top + zone.height + 1.2, 56)}cqw`,
                    }}
                >
                    <p className="font-mono uppercase tracking-[0.12em] font-semibold text-indigo-300" style={{ fontSize: '1.05cqw' }}>
                        {zone.label}
                    </p>
                    <p className="text-slate-100 leading-[1.5]" style={{ fontSize: '1.15cqw' }}>
                        {zone.desc}
                    </p>
                </div>
            )}
        </>
    );
};
