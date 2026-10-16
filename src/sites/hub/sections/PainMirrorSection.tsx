/**
 * PainMirrorSection (Sound familiar?) — W14's mirror, R27's workshop.
 *
 * Owner direction (R27): "the sounds-familiar section could be better
 * relayed in terms of making it more visually clear to users through
 * WORKFLOW DIAGRAMS. When one thing is selected or the mouse hovers over
 * it, the diagram illustrates itself. It should show the broken or
 * inconvenient diagram FIRST, then the improved workflow."
 *
 * Each row is now a scene. Hovering (desktop) or tapping (mobile) a row
 * plays the scene on the diagram stage in two beats:
 *
 *   BEAT 1 — TODAY: the scattered sources draw their tangled dashed
 *   curves into one overloaded destination; a "lost" chip falls off the
 *   flow. Drawn in muted red on the ink stage.
 *
 *   BEAT 2 — ON PRACTICEPRO: the tangle dissolves and the same day runs
 *   as a clean left-to-right pipeline in emerald — the system copy,
 *   visualised.
 *
 * Honest copy kept verbatim from the W14 era (the rows' today/system
 * strings are unchanged). Pure CSS/SVG motion (no JS animation library);
 * prefers-reduced-motion skips straight to the improved flow. Interactive
 * rows use the ui/Button primitive (ADR-0004).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui';
import { useScrollReveal } from '../hooks';

// ── SOUND FAMILIAR? (W14) — the bridge from "nice 3D" to "I need this" ────
// Each row is a symptom any owner or manager will recognise — and its
// system counterpart. This is the section that converts "cool site" into
// "wait, that is MY business". R27: each row also carries the diagram
// data for the stage (sources / destination / pipeline labels).

type Scene = {
    today: string;
    system: string;
    /** Scattered inputs on the left of the stage (the mess). */
    sources: string[];
    /** The overloaded destination the mess funnels into. */
    dest: string;
    /** The clean pipeline the same day runs as (the system copy). */
    pipeline: string[];
};

const PAIN_MIRROR: Scene[] = [
    {
        today: 'Orders and requests arrive by WhatsApp, SMS and walk-in — nobody sees all of them in one place.',
        system: 'Every order lands in one queue — assigned, tracked, never lost.',
        sources: ['WhatsApp', 'SMS', 'Walk-in', 'Missed call'],
        dest: 'Your head',
        pipeline: ['One queue', 'Assigned', 'Never lost'],
    },
    {
        today: "Who has paid, who still owes, who renewed — it lives in somebody's head and a tattered notebook.",
        system: 'Balances, receipts and reminders computed and sent without anyone chasing.',
        sources: ['Tattered notebook', "Somebody's head", 'Bank alert', 'Paper receipt'],
        dest: 'Month-end',
        pipeline: ['Balances computed', 'Reminders sent', 'Nobody chases'],
    },
    {
        today: 'Customer records scattered across three phones, two notebooks and a Gmail account.',
        system: 'One record per customer — history, documents, payments and messages together.',
        sources: ['Three phones', 'Two notebooks', 'A Gmail account'],
        dest: 'Which one is true?',
        pipeline: ['One record', 'History together', 'Nothing missing'],
    },
    {
        today: 'Month-end means days of reconciling bank alerts with hand-written receipts.',
        system: 'Reconciliation that happens as the money lands — reports one click away.',
        sources: ['Bank alerts', 'Hand-written receipts', 'Memory'],
        dest: 'Days of work',
        pipeline: ['Money lands', 'Matched instantly', 'Report one click away'],
    },
    {
        today: 'The only person who understands the whole process is on leave — and everything stalls.',
        system: 'The system holds the process, so any member of the team can run the day.',
        sources: ['The one person who knows', 'On leave', 'Everything stalls'],
        dest: 'Monday morning',
        pipeline: ['System holds the process', 'Anyone runs the day', 'Nothing stalls'],
    },
];

// ── The stage geometry (shared by every scene — labels differ, the
//    grammar is constant so the eye learns it once) ─────────────────────────
const VB_W = 560;
const VB_H = 320;
const SRC_POS: [number, number][] = [
    [96, 84],
    [84, 168],
    [120, 252],
    [212, 52],
];
const DEST: [number, number] = [452, 168];
const LOST: [number, number] = [218, 150];
const PIPE_XS: number[] = [104, 244, 384, 480];

/** A tiny chip on the stage. `tone` picks the broken/fixed register. */
const StageChip: React.FC<{
    x: number;
    y: number;
    label: string;
    tone: 'broken' | 'fixed' | 'lost';
}> = ({ x, y, label, tone }) => {
    const base =
        'absolute -translate-x-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-md text-[10px] sm:text-2xs font-bold whitespace-nowrap transition-all duration-500';
    const cls =
        tone === 'broken'
            ? `${base} bg-red-500/10 border border-red-400/40 text-red-200`
            : tone === 'lost'
                ? `${base} bg-transparent border border-dashed border-red-400/50 text-red-300/70 rotate-[-7deg] line-through decoration-red-400/60`
                : `${base} bg-emerald-400/15 border border-emerald-300/40 text-emerald-100`;
    return (
        <span className={cls} style={{ left: `${(x / VB_W) * 100}%`, top: `${(y / VB_H) * 100}%` }}>
            {label}
        </span>
    );
};

export const PainMirrorSection: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    const rowsRef = useScrollReveal<HTMLDivElement>();
    const closeRef = useScrollReveal<HTMLDivElement>();

    const [active, setActive] = useState(0);
    const [beat, setBeat] = useState<'broken' | 'fixed'>('broken');
    const timers = useRef<number[]>([]);
    const reduced = useRef(
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    );

    // The beat machine: selecting a scene plays broken → (1.5s) → fixed.
    // Reduced-motion users get the improved flow immediately.
    useEffect(() => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
        if (reduced.current) {
            setBeat('fixed');
            return;
        }
        setBeat('broken');
        timers.current.push(window.setTimeout(() => setBeat('fixed'), 1500));
        return () => timers.current.forEach(clearTimeout);
    }, [active]);

    const scene = PAIN_MIRROR[active];
    const selectScene = (i: number) => {
        if (i !== active) setActive(i);
    };

    const rowCls = (i: number) =>
        `group/row w-full text-left rounded-xl border px-4 py-3 transition-all duration-300 ${
            i === active
                ? 'border-emerald-500/40 bg-emerald-400/10'
                : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.16] hover:bg-white/[0.045]'
        }`;

    return (
        <section className="relative py-16 sm:py-24 overflow-hidden" style={{ background: '#0A101C' }}>
            {/* the same ink stage as the hero, carried through the marquee */}
            <div className="absolute -top-32 right-1/4 w-[34rem] h-[24rem] rounded-full bg-emerald-500/[0.07] blur-[130px] pointer-events-none" aria-hidden="true" />
            <div className="absolute -bottom-40 left-1/4 w-[36rem] h-[24rem] rounded-full bg-emerald-600/[0.08] blur-[130px] pointer-events-none" aria-hidden="true" />
            <div className="absolute inset-0 w7-grain pointer-events-none" aria-hidden="true" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
                <div ref={ref} className="w9-reveal text-center mb-10 md:mb-14 max-w-3xl mx-auto">
                    <p className="text-xs sm:text-xs font-bold uppercase tracking-[0.3em] mb-4 text-emerald-400/90">
                        Sound familiar?
                    </p>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white font-display" style={{ '--w9-d': '90ms' } as React.CSSProperties}>
                        Your business already runs on a system.
                        <br />
                        <span className="text-transparent bg-clip-text inline-block pb-1" style={{ backgroundImage: 'linear-gradient(to right, #6EE7B7, #34D399)' }}>
                            It&rsquo;s just not software.
                        </span>
                    </h2>
                    <p className="text-lg text-slate-400 mt-4 max-w-2xl mx-auto" style={{ '--w9-d': '180ms' } as React.CSSProperties}>
                        Spreadsheets, chat threads, memory and paper will get a business started —
                        then quietly hold it back.{' '}
                        <span className="text-slate-200">Hover a row to watch the day play out — first as it runs today, then on a system.</span>
                    </p>
                </div>

                {/* R27 workshop: the selectable rows + the diagram stage.
                    lg: list left, sticky stage right. Below lg the stage sits
                    above the list (tap a row, the stage above animates). */}
                <div ref={rowsRef} className="w9-reveal-stagger max-w-6xl mx-auto grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 lg:gap-10 items-start">
                    {/* ── The stage ─────────────────────────────────────── */}
                    <div className="order-first lg:order-last lg:sticky lg:top-24">
                        <div
                            className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden"
                            role="img"
                            aria-label={`Workflow diagram — ${scene.today} Today: ${scene.sources.join(', ')} all funnels into ${scene.dest}. On PracticePro: ${scene.pipeline.join(' → ')}.`}
                        >
                            {/* Beat caption — swaps with the beat */}
                            <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                                <span
                                    key={`t-${active}-${beat}`}
                                    className={`text-2xs font-bold uppercase tracking-[0.22em] transition-colors duration-500 ${
                                        beat === 'broken' ? 'text-red-300/90' : 'text-emerald-300/90'
                                    }`}
                                >
                                    {beat === 'broken' ? 'Today — as it runs' : 'On PracticePro — the same day'}
                                </span>
                                <span className="font-mono text-2xs tracking-widest text-slate-500">
                                    {String(active + 1).padStart(2, '0')} / {String(PAIN_MIRROR.length).padStart(2, '0')}
                                </span>
                            </div>

                            {/* The stage surface — one shared 560x320 frame */}
                            <div className="relative w-full" style={{ aspectRatio: `${VB_W} / ${VB_H}` }}>
                                {/* faint grid — the workshop paper */}
                                <div
                                    className="absolute inset-0"
                                    aria-hidden="true"
                                    style={{
                                        backgroundImage:
                                            'linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)',
                                        backgroundSize: '56px 52px',
                                    }}
                                />

                                {/* ── BEAT 1: the tangle (fades out on beat 2) ── */}
                                <div
                                    aria-hidden={beat === 'fixed'}
                                    className={`absolute inset-0 transition-all duration-500 ${
                                        beat === 'broken' ? 'opacity-100' : 'opacity-0 scale-[0.96]'
                                    }`}
                                    key={`broken-${active}`}
                                >
                                    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${VB_W} ${VB_H}`} fill="none" aria-hidden="true">
                                        {/* the tangled curves — each source funnels into the one
                                            overloaded destination, crossing on the way */}
                                        {SRC_POS.slice(0, scene.sources.length).map(([sx, sy], i) => {
                                            const [dx, dy] = DEST;
                                            const bulge = i % 2 === 0 ? 1 : -1;
                                            return (
                                                <path
                                                    key={i}
                                                    d={`M ${sx + 34} ${sy + 6} C ${sx + 120} ${sy + bulge * 90}, ${dx - 150} ${dy - bulge * 70}, ${dx - 30} ${dy - 4}`}
                                                    stroke="rgba(248,113,113,0.55)"
                                                    strokeWidth="1.6"
                                                    strokeDasharray="5 6"
                                                    className="pm-draw"
                                                    style={{ animationDelay: `${i * 130}ms` }}
                                                />
                                            );
                                        })}
                                    </svg>
                                    {scene.sources.slice(0, 4).map((label, i) => (
                                        <StageChip key={label} x={SRC_POS[i][0]} y={SRC_POS[i][1]} label={label} tone="broken" />
                                    ))}
                                    <StageChip x={DEST[0]} y={DEST[1]} label={scene.dest} tone="broken" />
                                    {/* the lost chip — one more thing that fell off the flow */}
                                    {scene.sources.length > 3 && <StageChip x={LOST[0]} y={LOST[1]} label="the one nobody wrote down" tone="lost" />}
                                </div>

                                {/* ── BEAT 2: the pipeline (fades in on beat 2) ── */}
                                <div
                                    aria-hidden={beat === 'broken'}
                                    className={`absolute inset-0 transition-all duration-500 ${
                                        beat === 'fixed' ? 'opacity-100' : 'opacity-0 scale-[1.03]'
                                    }`}
                                    key={`fixed-${active}`}
                                >
                                    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${VB_W} ${VB_H}`} fill="none" aria-hidden="true">
                                        {PIPE_XS.slice(0, scene.pipeline.length - 1).map((x, i) => {
                                            const x2 = PIPE_XS[i + 1];
                                            return (
                                                <g key={i} className="pm-arrow" style={{ animationDelay: `${i * 110}ms` }}>
                                                    <path d={`M ${x + 42} 168 L ${x2 - 46} 168`} stroke="rgba(110,231,183,0.75)" strokeWidth="1.8" />
                                                    <path d={`M ${x2 - 52} 162 L ${x2 - 42} 168 L ${x2 - 52} 174`} stroke="rgba(110,231,183,0.75)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                                </g>
                                            );
                                        })}
                                    </svg>
                                    {scene.pipeline.map((label, i) => (
                                        <React.Fragment key={label}>
                                            <StageChip x={PIPE_XS[i]} y={168} label={label} tone="fixed" />
                                            {/* terminal check */}
                                            {i === scene.pipeline.length - 1 && (
                                                <svg
                                                    className="absolute -translate-x-1/2 -translate-y-1/2 pm-pop"
                                                    style={{ left: `${((PIPE_XS[i] + 46) / VB_W) * 100}%`, top: `${(150 / VB_H) * 100}%`, animationDelay: `${i * 110 + 200}ms` }}
                                                    width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true"
                                                >
                                                    <circle cx="11" cy="11" r="10" fill="rgba(110,231,183,0.15)" stroke="rgba(110,231,183,0.7)" strokeWidth="1.5" />
                                                    <path d="M6.5 11.5L9.6 14.5L15.5 8" stroke="#6EE7B7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>

                            {/* The system line under the stage — the honest copy,
                                restated as the diagram's caption. */}
                            <p className="px-4 py-3 border-t border-white/[0.07] text-sm leading-[1.7] text-slate-300/95">
                                <span className={`font-bold ${beat === 'broken' ? 'text-red-300/90' : 'text-emerald-300'}`}>
                                    {beat === 'broken' ? 'Today: ' : 'On a system: '}
                                </span>
                                {beat === 'broken' ? scene.today : scene.system}
                            </p>
                        </div>
                    </div>

                    {/* ── The rows — hover/tap selects the scene ─────────── */}
                    <div className="flex flex-col gap-2.5" role="listbox" aria-label="Daily friction — select one to play its workflow">
                        {PAIN_MIRROR.map((row, i) => (
                            <Button
                                key={i}
                                variant="bare"
                                role="option"
                                aria-selected={i === active}
                                onMouseEnter={() => selectScene(i)}
                                onFocus={() => selectScene(i)}
                                onClick={() => selectScene(i)}
                                className={rowCls(i)}
                            >
                                <span className="flex items-start gap-3">
                                    <span
                        aria-hidden="true"
                                        className={`mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                                            i === active ? 'bg-emerald-400 scale-125' : 'bg-slate-600'
                                        }`}
                                    />
                                    <span className="min-w-0">
                                        <span className={`block text-sm leading-[1.7] transition-colors duration-300 ${i === active ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>
                                            {row.today}
                                        </span>
                                        <span className={`block text-xs leading-[1.6] mt-1 transition-all duration-300 ${i === active ? 'text-emerald-300/90' : 'text-slate-600'}`}>
                                            → {row.system}
                                        </span>
                                    </span>
                                </span>
                            </Button>
                        ))}
                    </div>
                </div>

                <div ref={closeRef} className="w9-reveal text-center mt-12 md:mt-14 max-w-2xl mx-auto">
                    <p className="text-lg text-slate-300/95 leading-[1.75]">
                        If any of that is your business, you don&rsquo;t need more discipline or a
                        better spreadsheet. <span className="text-white font-semibold">You need a system</span> —
                        and building it is exactly what we do.
                    </p>
                    <div className="mt-7">
                        <Button
                            variant="bare"
                            onClick={onContactSales}
                            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl font-semibold text-sm text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 shadow-lg shadow-primary-500/40 hover:shadow-[0_0_40px_-6px_rgba(22,163,74,0.7)] transition-all duration-300 active:scale-[0.97]"
                        >
                            Tell us what runs your business today
                        </Button>
                    </div>
                </div>
            </div>

            <style>{`
                /* The stage's motion vocabulary — draw, arrow, pop. */
                @keyframes pm-draw-on {
                    from { stroke-dashoffset: 340; opacity: 0.2; }
                    to { stroke-dashoffset: 0; opacity: 1; }
                }
                .pm-draw {
                    stroke-dashoffset: 340;
                    opacity: 0.2;
                    animation: pm-draw-on 700ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
                }
                @keyframes pm-arrow-on {
                    from { opacity: 0; transform: translateX(-14px); }
                    to { opacity: 1; transform: none; }
                }
                .pm-arrow { opacity: 0; animation: pm-arrow-on 450ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
                @keyframes pm-pop-on {
                    from { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
                    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                }
                .pm-pop { opacity: 0; animation: pm-pop-on 350ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
                @media (prefers-reduced-motion: reduce) {
                    .pm-draw, .pm-arrow, .pm-pop { animation: none; opacity: 1; transform: none; }
                }
            `}</style>
        </section>
    );
};
