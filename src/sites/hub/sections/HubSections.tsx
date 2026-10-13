import MorphScene from '../../../components/marketing/MorphScene';
import React, { useEffect, useRef, useState } from 'react';
import SystemCoreScene from '../../../components/marketing/SystemCoreScene';
import { BellIcon, BrainIcon, BriefcaseIcon, CheckBadgeIcon, CheckIcon, ChevronDownIcon, ChevronRightIcon, ClipboardListIcon, ComputerDesktopIcon, DeviceMobileIcon, ExternalLinkIcon, LinkIcon, LockClosedIcon, MailIcon, MapPinIcon, NairaCircleIcon, PencilSquareIcon, ShieldCheckIcon, UsersIcon, XMarkIcon, ZapIcon } from '../../../constants';
import { Button } from '../../../components/ui';
import { SystemTour, type TourSystem } from '../../../components/marketing/SystemTour';
import { createPortal } from 'react-dom';
import { VegaMark, AtriumMark } from '../../../components/marketing/brand/ProductMarks';
import { useScrollReveal, useSectionProgress } from '../hooks';

/**
 * HubSections — the PracticePro corporate hub's sections, moved
 * VERBATIM from src/components/LandingPage.tsx (P0 split). Line-for-line
 * copies; only `export` keywords and the import block were added. Restyle
 * happens in Prompt 1, not here.
 */

// ─── CORPORATE HUB (PracticePro Systems home — no product chosen) ───────────
// W6 (2026-10-07, owner direction): the root page is no longer a thin product
// picker. It is the corporate home of PracticePro Systems — the company that
// builds and runs the systems businesses manage their affairs with. The page
// sells the BUILDER: what we can do (services already shipping inside Vega,
// Atrium and Kozy Care), what we have done (the portfolio), how we work, and
// how to reach us. Vega and Atrium remain one click away (nav, work cards,
// footer); Kozy Care is presented as a client commission — proof we build
// for other people's businesses too.
//
// P8 (honest marketing) still applies: every claim below maps to shipped,
// verifiable behaviour. No invented clients, no invented metrics.

/**
 * W17 — the scaling noun, refined (owner direction). The promise is
 * “Build systems that help scale your X”, X = a noun the owner of a
 * Nigerian business instantly recognises as theirs — practice, firm,
 * clinic, pharmacy, school, restaurant, organization — with
 * “business” as the universal opener.
 *
 * W16 held the line shape by padding every noun into a box as wide as
 * “organization” — which left a long dead gap after every shorter word
 * (“too much of a gap with all of them except organizations”), and a
 * redundant full stop. W17 replaces the fixed box with a MEASURED,
 * GLIDING slot: every noun is measured in the headline's exact font
 * (responsive sizes, web-font swap) and the slot's width eases to
 * precisely the live noun — the sentence always looks typeset, and the
 * only motion is the word exchanging itself while the line's tail
 * breathes with it (nothing else in the sentence moves).
 *
 * Line count can never change: below sm the noun owns its own line
 * (an sm:hidden break after “scale your”), and from sm up
 * “scale your <noun>” is the final line, sized for the widest noun
 * (geometry verified in W16). SSR/no-JS/reduced-motion degrade to the
 * static first noun.
 *
 * W18 (rendering fix, owner: “your X is not clear or rendering
 * properly”): the gradient is painted PER SPAN. One ancestor-clipped
 * gradient cannot paint through this slot — the live span is an
 * inline-block that carries transform + filter (its own stacking
 * context), and several browsers exclude such descendants from the
 * ancestor's background-clip:text, leaving the noun colour:transparent
 * and effectively invisible. Each text-bearing span now carries its
 * own clipped gradient (“scale your”: mint → emerald; the noun:
 * emerald → green), and at rest the slot holds no transform/filter
 * (none still transitions to value, so the exchange stays fluid).
 */
const SCALE_NOUNS = [
    'business',
    'practice',
    'firm',
    'clinic',
    'pharmacy',
    'school',
    'restaurant',
    'organization',
];

const ScalingNoun: React.FC = () => {
    const [i, setI] = useState(0);
    const [on, setOn] = useState(true);
    const [widths, setWidths] = useState<number[] | null>(null);
    const measureRef = useRef<HTMLSpanElement>(null);

    // Measure every noun in the live headline font so the slot can
    // glide to exactly the live word. The measuring twin is absolute +
    // invisible: fully laid out (so every width is real) but never
    // part of the sentence's own layout.
    useEffect(() => {
        const measure = () => {
            const host = measureRef.current;
            if (!host) return;
            const next = Array.from(host.children).map(
                (c) => (c as HTMLElement).getBoundingClientRect().width,
            );
            if (next.length === SCALE_NOUNS.length && next.every((w) => w > 0)) {
                setWidths(next);
            }
        };
        measure();
        // Space Grotesk lands async — remeasure once it does, and again
        // whenever a responsive font-size change resizes the twin.
        if (document.fonts?.ready) {
            document.fonts.ready.then(() => measure()).catch(() => {});
        }
        const ro = new ResizeObserver(() => measure());
        if (measureRef.current) ro.observe(measureRef.current);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        let swapId: number | null = null;
        const tick = window.setInterval(() => {
            setOn(false);
            if (swapId !== null) window.clearTimeout(swapId);
            swapId = window.setTimeout(() => {
                setI((v) => (v + 1) % SCALE_NOUNS.length);
                setOn(true);
            }, 380);
        }, 2700);
        return () => {
            window.clearInterval(tick);
            if (swapId !== null) window.clearTimeout(swapId);
        };
    }, []);

    const live = widths?.[i];
    return (
        // The outer span is the layout atom: its width IS the slot's
        // width, so the sentence always ends exactly at the noun — no
        // reserve, no trailing gap.
        <span className="relative inline-block align-baseline whitespace-nowrap">
            <span
                ref={measureRef}
                aria-hidden="true"
                className="absolute left-0 top-0 pointer-events-none"
                style={{ visibility: 'hidden' }}
            >
                {SCALE_NOUNS.map((n) => (
                    <span key={n} className="inline-block whitespace-nowrap">
                        {n}
                    </span>
                ))}
            </span>
            {/* The live slot — the word exchanges itself (soft blur +
                slide) while the box glides to the incoming noun's exact
                width. One fluid motion, nothing jarring. */}
            <span
                className="inline-block align-baseline text-transparent bg-clip-text pb-1"
                style={{
                    width: live !== undefined ? `${live}px` : undefined,
                    transition:
                        'width 520ms cubic-bezier(0.33, 0, 0.15, 1), opacity 380ms ease, transform 380ms ease, filter 380ms ease',
                    opacity: on ? 1 : 0,
                    transform: on ? 'none' : 'translateY(-0.22em)',
                    filter: on ? 'none' : 'blur(5px)',
                    backgroundImage: 'linear-gradient(to right, #34D399, #4ADE80)',
                }}
            >
                {SCALE_NOUNS[i]}
            </span>
        </span>
    );
};

export const HubHero: React.FC<{
    onContactSales: () => void;
    scrollTo: (id: string) => void;
}> = ({ onContactSales, scrollTo }) => {
    // W8 (structured fluidity): the hero keeps the dark cinematic stage but
    // the blob becomes a SYSTEM — a morphing crystal lattice (see
    // MorphScene.tsx). Positioning stays broadened per owner direction: no
    // "Lagos software company" line here — we build systems, full stop.
    // The company-and-location eyebrow stays retired.
    //
    // W8 auth policy: Log in / Start Free Trial live with the products
    // (the Vega and Atrium pages). The company page sells the company.
    return (
        <section id="home" className="relative overflow-hidden min-h-[92vh] flex items-center w7-dark">
            {/* Layer 0 — deep ink base */}
            <div className="absolute inset-0 bg-[#070D18]" aria-hidden="true" />
            {/* Layer 1 — the living lattice (WebGL; a structural CSS fallback
                sits behind it), arriving with one slow settle. */}
            <div className="absolute inset-0 w8-lattice-fallback" aria-hidden="true" />
            <div className="absolute inset-0 w8-scene-enter" aria-hidden="true">
                <MorphScene className="absolute inset-0" />
            </div>
            {/* Layer 2 — vignette + grain so the headline always reads */}
            <div className="absolute inset-0 w7-vignette pointer-events-none" aria-hidden="true" />
            <div className="absolute inset-0 w7-grain pointer-events-none" aria-hidden="true" />

            {/* pb-24 on mobile clears the chat FAB (bottom-20 = 80px). */}
            <div className="hero-stagger relative z-10 container mx-auto px-4 sm:px-6 pt-28 pb-24 sm:pt-32 sm:pb-20 flex flex-col items-center text-center">

                <p className="font-mono text-xs sm:text-sm font-medium uppercase tracking-[0.2em] mb-6 text-emerald-400/90">
                    We design, build &amp; run business software
                </p>

                <h1 className="font-display text-[2.25rem] sm:text-5xl md:text-6xl lg:text-[5rem] font-bold tracking-tight leading-[1.08] mb-7 max-w-5xl text-white w7-headline-shadow">
                    Build systems that help{' '}
                    <br className="hidden sm:block" />
                    {/* W17: the gradient is all-green (mint → emerald →
                        green) — the brand's color, no amber lead. Below sm
                        the noun owns its own line, so no noun can ever
                        change the headline's line count.
                        W18: every text-bearing span paints its OWN clipped
                        gradient — an ancestor's background-clip:text does
                        not paint through the noun's inline-block slot
                        (it carries transform/filter), which left the noun
                        colourless and invisible in several browsers. */}
                    <span className="inline sm:inline-block align-baseline">
                        <span className="text-transparent bg-clip-text inline pb-1" style={{ backgroundImage: 'linear-gradient(to right, #6EE7B7, #34D399)' }}>
                            scale your
                        </span>{' '}
                        <br className="sm:hidden" />
                        <ScalingNoun />
                    </span>
                </h1>

                <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-[1.75] text-slate-300/95">
                    PracticePro Systems designs, builds and runs the operating systems
                    businesses scale on — from the orders that arrive on WhatsApp to the receipts that leave with every job.
                    When spreadsheets, chat threads and memory can no longer keep up, we build the system that takes over — so
                    you can take on more customers, and take care of them, without the chaos doubling.
                </p>

                {/* CTAs — ui/Button (bare) per ADR-0004: new interactive
                    elements never grow the raw-element ratchet. */}
                <div className="flex flex-col sm:flex-row gap-4 mb-14 w-full sm:w-auto justify-center">
                    <Button
                        variant="bare"
                        onClick={onContactSales}
                        className="relative inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-sm font-semibold text-sm text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 shadow-md transition-all duration-300 active:scale-[0.97]"
                    >
                        Talk to us about your system
                    </Button>
                    <Button
                        variant="bare"
                        onClick={() => scrollTo('ourWork')}
                        className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-sm font-semibold text-sm bg-white/10 text-white border border-white/15 backdrop-blur-sm hover:bg-white/15 hover:border-white/25 transition-all duration-300 active:scale-[0.97]"
                    >
                        See what we&apos;ve built
                    </Button>
                </div>

                {/* W14: the "Our products" quick-links are GONE from the hero —
                    the owner's direction: it is far too early to walk visitors
                    into the catalogue. The hero sells the problem and the
                    promise; the products are introduced later, inside "Systems
                    we've built", once the story has earned them. */}

                {/* W8: auth lives with the products. The company page sells
                    the company — the sign-in link lives on the product pages. */}
            </div>

            {/* Scroll cue — invites the descent into the story. */}
            <Button
                variant="bare"
                onClick={() => scrollTo('whatWeDo')}
                aria-label="Scroll to what we do"
                className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 p-2 text-slate-500 hover:text-slate-200 transition-colors w7-scroll-cue"
            >
                <ChevronDownIcon className="w-6 h-6" />
            </Button>

            {/* Bottom fade into the marquee band */}
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-b from-transparent to-[#070D18] pointer-events-none" aria-hidden="true" />
        </section>
    );
};

// ─── FLUID SEAMS (W8 → W9 → W10) ───────────────────────────────────────────────
// W10: the curvature is BACK and impossible to miss. Each seam is now a
// true SVG wave — the previous section's colour pours into the next through
// a visible arc whose crest slides and breathes as the seam crosses the
// viewport (plus a slow ambient drift). The W9 organic-radius blob read
// as a straight cut; this is a real curve again, and it morphs as you
// scroll from page to page.

export const FluidSeam: React.FC<{ from: string; to: string; phase?: number }> = ({ from, to, phase = 0 }) => {
    const hostRef = useRef<HTMLDivElement>(null);
    const pathRef = useRef<SVGPathElement>(null);
    useEffect(() => {
        const host = hostRef.current;
        const path = pathRef.current;
        if (!host || !path) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        // p: 0 as the seam enters from the bottom, 1 as it leaves the top.
        // The wave's crest slides horizontally and its amplitude breathes
        // with the seam's viewport position — morphing, never static.
        // The fill paints the region ABOVE the curve with the previous
        // section's colour, which then pours into the next section below —
        // dark at top, flowing to light at the bottom, through a living arc.
        const draw = (p: number, t: number) => {
            const breath = 0.5 + 0.5 * Math.sin(Math.PI * p);          // peaks mid-viewport
            const amp = 13 + 15 * breath;                              // 13–28 of 100 units
            const slide = Math.sin(t * 0.35 + phase * 1.7) * 8;         // slow ambient drift
            const cRest = Math.sin(p * Math.PI * 1.3 + phase) * amp;
            const cLead = Math.cos(p * Math.PI * 1.1 + phase * 0.8) * amp;
            const a = 46 - cRest * 0.35 + slide * 0.5;
            const b = 54 + cLead * 0.35 - slide * 0.5;
            path.setAttribute('d',
                `M0,0 L100,0 L100,${b.toFixed(2)} C70,${(b - amp * 0.9).toFixed(2)} 30,${(a + amp * 0.9).toFixed(2)} 0,${a.toFixed(2)} Z`);
        };
        if (reduced) { draw(0.5, 0); return; }
        let inView = true;
        let rafId: number | null = null;
        const t0 = performance.now();
        const io = new IntersectionObserver((entries) => {
            inView = entries.some((en) => en.isIntersecting);
            if (inView && rafId === null) rafId = requestAnimationFrame(frame);
        }, { threshold: 0 });
        io.observe(host);
        const frame = (now: number) => {
            const rect = host.getBoundingClientRect();
            const vh = window.innerHeight;
            const p = Math.min(1, Math.max(0, (vh - rect.top) / (vh + rect.height)));
            draw(p, (now - t0) / 1000);
            rafId = inView ? requestAnimationFrame(frame) : null;
        };
        rafId = requestAnimationFrame(frame);
        return () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            io.disconnect();
        };
    }, [phase]);
    return (
        <div ref={hostRef} className="relative h-24 sm:h-32 overflow-hidden w10-seam" style={{ background: to }} aria-hidden="true">
            {/* The previous section's colour, hanging into this one through a
                living curve — the wave shape is the liquid boundary. */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path ref={pathRef} fill={from} d="M0,0 L100,0 L100,54 C70,42 30,58 0,46 Z" />
            </svg>
        </div>
    );
};

// ─── MARQUEE (W7) — the capabilities ticker ─────────────────────────────────
// A slow infinite band that carries the builder's vocabulary across the
// seam between the dark hero and the light body. Pure CSS animation;
// frozen under prefers-reduced-motion.

const MARQUEE_ITEMS = [
    'Custom Systems',
    'Custom Integrations',
    'Customer Portals',
    'Payments & Billing',
    'Workflow Automation',
    'AI & Automation',
    'Mobile Apps',
    'Web Platforms',
    'Security & Compliance',
];

export const MarqueeStrip: React.FC = () => (
    <div className="relative overflow-hidden border-y border-white/5 bg-[#0A101C] py-5" aria-label="What we build">
        <div className="w7-marquee-track flex items-center gap-10 whitespace-nowrap w-max">
            {[0, 1].map((dup) => (
                <div key={dup} className="flex items-center gap-10" aria-hidden={dup === 1}>
                    {MARQUEE_ITEMS.map((item) => (
                        <span key={`${dup}-${item}`} className="flex items-center gap-10">
                            <span className="font-mono text-xs sm:text-sm uppercase tracking-[0.22em] text-slate-500">
                                {item}
                            </span>
                            <span className="w-1.5 h-1.5 rotate-45 bg-gradient-to-br from-emerald-300 to-emerald-500 opacity-70" aria-hidden="true" />
                        </span>
                    ))}
                </div>
            ))}
        </div>
        {/* Edge fades so the band dissolves instead of clipping */}
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#0A101C] to-transparent pointer-events-none" aria-hidden="true" />
        <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#0A101C] to-transparent pointer-events-none" aria-hidden="true" />
    </div>
);

// ─── SOUND FAMILIAR? (W14) — the bridge from "nice 3D" to "I need this" ────
// Owner direction: "I don't think people who want the service(s) know they
// need or want it." Before "What we do" can land as an answer, the page has
// to hold a mirror up and name the daily friction in the visitor's own
// words. Each row is a symptom any owner or manager will recognise — and
// its system counterpart. This is the section that converts "cool site"
// into "wait, that is MY business".

const PAIN_MIRROR: Array<{ today: string; system: string }> = [
    {
        today: 'Orders and requests arrive by WhatsApp, SMS and walk-in — nobody sees all of them in one place.',
        system: 'Every order lands in one queue — assigned, tracked, never lost.',
    },
    {
        today: "Who has paid, who still owes, who renewed — it lives in somebody's head and a tattered notebook.",
        system: 'Balances, receipts and reminders computed and sent without anyone chasing.',
    },
    {
        today: 'Customer records scattered across three phones, two notebooks and a Gmail account.',
        system: 'One record per customer — history, documents, payments and messages together.',
    },
    {
        today: 'Month-end means days of reconciling bank alerts with hand-written receipts.',
        system: 'Reconciliation that happens as the money lands — reports one click away.',
    },
    {
        today: 'The only person who understands the whole process is on leave — and everything stalls.',
        system: 'The system holds the process, so any member of the team can run the day.',
    },
];

export const PainMirrorSection: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    const rowsRef = useScrollReveal<HTMLDivElement>();
    const closeRef = useScrollReveal<HTMLDivElement>();
    return (
        <section className="relative py-16 sm:py-24 overflow-hidden" style={{ background: '#0A101C' }}>
            {/* the same ink stage as the hero, carried through the marquee */}
            <div className="absolute -top-32 right-1/4 w-[34rem] h-[24rem] rounded-full bg-emerald-500/[0.07] blur-[130px] pointer-events-none" aria-hidden="true" />
            <div className="absolute -bottom-40 left-1/4 w-[36rem] h-[24rem] rounded-full bg-emerald-600/[0.08] blur-[130px] pointer-events-none" aria-hidden="true" />
            <div className="absolute inset-0 w7-grain pointer-events-none" aria-hidden="true" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
                <div ref={ref} className="w9-reveal text-center mb-10 md:mb-14 max-w-3xl mx-auto">
                    <p className="font-mono text-xs sm:text-sm font-medium uppercase tracking-[0.2em] mb-4 text-emerald-400/90">
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
                        then quietly hold it back. Recognise any of these?
                    </p>
                </div>

                <div ref={rowsRef} className="w9-reveal-stagger max-w-4xl mx-auto flex flex-col gap-3.5">
                    {PAIN_MIRROR.map((row, i) => (
                        <div
                            key={i}
                            className="group grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6 rounded-md border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm px-5 py-4 md:px-7 md:py-5 transition-all duration-500 hover:border-white/[0.16] hover:bg-white/[0.045]"
                        >
                            {/* Today — the friction, in the visitor's words */}
                            <div className="flex items-start gap-3.5 md:justify-end md:text-right">
                                <span className="hidden md:block w-1.5 h-1.5 rounded-full bg-emerald-400/70 flex-shrink-0 translate-y-2" aria-hidden="true" />
                                <p className="text-sm leading-[1.7] text-slate-400 transition-colors duration-500 group-hover:text-slate-500">{row.today}</p>
                                <span className="md:hidden w-1.5 h-1.5 rounded-full bg-emerald-400/70 flex-shrink-0 translate-y-2" aria-hidden="true" />
                            </div>
                            {/* The turn */}
                            <span className="hidden md:flex items-center justify-center w-9 h-9 rounded-full border border-white/10 bg-white/[0.03] text-slate-500 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors duration-500" aria-hidden="true">
                                <ChevronRightIcon className="w-4 h-4" />
                            </span>
                            <span className="flex md:hidden items-center justify-center w-9 h-9 rounded-full border border-white/10 bg-white/[0.03] text-slate-500" aria-hidden="true">
                                <ChevronDownIcon className="w-4 h-4" />
                            </span>
                            {/* On a system — the same day, running on software */}
                            <div className="flex items-start gap-3.5">
                                <span className="w-1.5 h-1.5 rotate-45 bg-emerald-400 flex-shrink-0 translate-y-2 transition-transform duration-500 group-hover:scale-150" aria-hidden="true" />
                                <p className="text-sm font-medium leading-[1.7] text-slate-200/90 transition-colors duration-500 group-hover:text-emerald-100">{row.system}</p>
                            </div>
                        </div>
                    ))}
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
                            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-sm font-semibold text-sm text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 shadow-md transition-all duration-300 active:scale-[0.97]"
                        >
                            Tell us what runs your business today
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
};

// ─── WHAT WE DO (corporate hub) ─────────────────────────────────────────────
// The services PracticePro Systems sells. Each card is a capability already
// running in production inside Vega, Atrium or Kozy Care — the pitch to a
// prospective client is "this exact engineering, applied to your business".

const WHAT_WE_DO: Array<{
    title: string;
    body: string;
    Icon: React.ComponentType<{ className?: string }>;
}> = [
    {
        title: 'Custom business systems',
        body: 'A system shaped around your operations, not your operations reshaped around software. We study how your business actually runs — the paperwork, the phone calls, the spreadsheets — then build the software that runs it. Kozy Care, a complete dry-cleaning operations platform, was built exactly this way.',
        Icon: BriefcaseIcon,
    },
    {
        title: 'Custom integrations',
        body: 'The tools you already use, wired into one workflow: WhatsApp and SMS messaging, Paystack payments, email, calendars and document tools. Vega and Atrium ship with integrations like these — we can build yours into whatever your business runs on.',
        Icon: LinkIcon,
    },
    {
        title: 'Portals your customers actually use',
        body: 'Self-service portals for the people you serve — track cases, view receipts and ledgers, book services, request maintenance. Your customers help themselves at any hour, on any phone, without a call to your office.',
        Icon: UsersIcon,
    },
    {
        title: 'Payments & revenue operations',
        body: 'Invoicing, collections, defaulter tracking, automatic receipts and reconciliation — with dashboards that answer revenue questions in seconds. Built naira-first, with Paystack and bank transfer flows already in production.',
        Icon: NairaCircleIcon,
    },
    {
        title: 'AI & automation',
        body: 'AI drafting, deadline computation, smart reminders and workflow automation that take over the repetitive work — the same engine that drafts court documents in Vega and applies tenancy law across 36 states and the FCT in Atrium.',
        Icon: BrainIcon,
    },
    {
        title: 'Workflow & notification engines',
        body: 'The rules that run the business day to day: approvals, reminders, escalations and banner alerts that reach the right person on WhatsApp, SMS or email. When a payment fails or a deadline looms, the system moves first — your team simply sees what needs doing.',
        Icon: BellIcon,
    },
    {
        title: 'Hosting, security & compliance',
        body: 'Deployment, monitoring, backups and NDPA 2023-aligned data handling, so your system stays up and your data stays yours. We run the infrastructure on our own products every day — we can run yours too.',
        Icon: ShieldCheckIcon,
    },
];

// W14: the seven wireframe shapes — one per capability card, matching the
// geometry the 3D scene builds above (cube, cuboid, pyramid, octahedron,
// prism, gem, hex prism). Each card carries its own shape as a slowly
// turning watermark; when the card lands in the viewport the shape DROPS IN
// — the moment the orbiting shape above "arrives" in its card.
const SHAPE_STROKE = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
};
const IsoCube: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path {...SHAPE_STROKE} d="M24 7 L39 15.5 L39 32.5 L24 41 L9 32.5 L9 15.5 Z" />
        <path {...SHAPE_STROKE} d="M9 15.5 L24 24 L39 15.5 M24 24 L24 41" />
    </svg>
);
const IsoCuboid: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path {...SHAPE_STROKE} d="M24 4 L36 10 L36 33 L24 39 L12 33 L12 10 Z" />
        <path {...SHAPE_STROKE} d="M12 10 L24 16 L36 10 M24 16 L24 39" />
    </svg>
);
const IsoPyramid: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path {...SHAPE_STROKE} d="M24 6 L8 27 L24 36 L40 27 Z" />
        <path {...SHAPE_STROKE} d="M24 6 L24 36 M8 27 L40 27" />
    </svg>
);
const IsoOctahedron: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path {...SHAPE_STROKE} d="M24 4 L41 24 L24 44 L7 24 Z" />
        <path {...SHAPE_STROKE} d="M7 24 L41 24" />
    </svg>
);
const IsoPrism: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path {...SHAPE_STROKE} d="M9 17 L33 17 L21 37 Z" />
        <path {...SHAPE_STROKE} d="M15 9 L39 9 L27 29 Z" />
        <path {...SHAPE_STROKE} d="M9 17 L15 9 M33 17 L39 9 M21 37 L27 29" />
    </svg>
);
const IsoGem: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path {...SHAPE_STROKE} d="M14 12 L34 12 L42 21 L24 42 L6 21 Z" />
        <path {...SHAPE_STROKE} d="M14 12 L24 21 L34 12 M6 21 L24 21 L42 21 M24 21 L24 42" />
    </svg>
);
const IsoHexPrism: React.FC<{ className?: string }> = ({ className = '' }) => (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <path {...SHAPE_STROKE} d="M24 7 L33 12 L33 19 L24 24 L15 19 L15 12 Z" />
        <path {...SHAPE_STROKE} d="M24 28 L33 33 L33 40 L24 45 L15 40 L15 33 Z" />
        <path {...SHAPE_STROKE} d="M15 12 L15 33 M33 12 L33 33" />
    </svg>
);
const CARD_SHAPES = [IsoCube, IsoCuboid, IsoPyramid, IsoOctahedron, IsoPrism, IsoGem, IsoHexPrism];

/**
 * useLandingCards (W14) — the descent's landing signal. As each capability
 * card crosses into the viewport it gains .w14-landed (its wireframe shape
 * drops in, its icon chip pings, its border flashes emerald) and loses it
 * again on the way back up — so the story replays exactly like the 3D
 * shapes above, which also return to orbit when you scroll up. Reversible,
 * scroll-driven, no timers.
 */
function useLandingCards<T extends HTMLElement = HTMLDivElement>() {
    const ref = useRef<T>(null);
    useEffect(() => {
        const root = ref.current;
        if (!root) return;
        const cards = Array.from(root.querySelectorAll<HTMLElement>('.w14-card'));
        if (!('IntersectionObserver' in window)) {
            cards.forEach((c) => c.classList.add('w14-landed'));
            return;
        }
        const io = new IntersectionObserver((entries) => {
            for (const en of entries) en.target.classList.toggle('w14-landed', en.isIntersecting);
        }, { threshold: 0.3 });
        cards.forEach((c) => io.observe(c));
        return () => io.disconnect();
    }, []);
    return ref;
}

export const WhatWeDoSection: React.FC<{ scrollTo: (id: string) => void }> = ({ scrollTo }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    const gridRef = useScrollReveal<HTMLDivElement>();
    const landingRef = useLandingCards<HTMLDivElement>();
    // W7: bento spans — an asymmetric grid reads as designed, not templated.
    // W9: a seventh capability (workflow & notification engines) joins, so
    // the grid closes with two half-wide cards instead of one banner.
    // [4,2] / [2,2,2] / [3,3]: first capability breathes, the workflow +
    // hosting pair closes the grid side by side.
    const bentoSpan = [
        'md:col-span-4',
        'md:col-span-2',
        'md:col-span-2',
        'md:col-span-2',
        'md:col-span-2',
        'md:col-span-3',
        'md:col-span-3',
    ];
    const handleSpotlight = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
        el.style.setProperty('--my', `${e.clientY - rect.top}px`);
    };
    return (
        <section id="whatWeDo" className="py-16 sm:py-24 bg-white relative">
            {/* W8: the FluidSeam above owns the dark→light transition now —
                the static sage wash is retired. */}
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
                {/* W13→W14: the system core — a real three.js rendering (lazy
                    chunk, same contract as the hero). Seven GLASS SHAPES —
                    cubes that morph into pyramids, prisms and gems — orbit a
                    faceted core, one per capability card below. As you scroll,
                    the shapes DESCEND out of the scene toward their cards,
                    and each card receives its own shape. All inside the
                    canvas — no mark here, no overlays, nothing crosses text. */}
                <div className="relative mx-auto mb-9 md:mb-12 w-full max-w-[620px]">
                    <div className="w13-stage">
                        <div className="w13-fallback" aria-hidden="true" />
                        <SystemCoreScene className="w13-canvas" />
                    </div>
                    {/* W14: the owner's own words replace "Seven modules. One
                        system." — a promise a layman can feel, not jargon. */}
                    <p className="w13-caption">Making your systems one.</p>
                    {/* W14: the descent continues — a cue under the scene walks
                        the visitor down to the parts of the business, the way
                        the hero cue walks them into this scene. */}
                    <Button
                        variant="bare"
                        onClick={() => scrollTo('whatWeDoGrid')}
                        aria-label="Scroll to what each part becomes"
                        className="mx-auto flex items-center justify-center p-2 mt-1 text-slate-400 hover:text-slate-700 transition-colors w14-cue"
                    >
                        <ChevronDownIcon className="w-5 h-5" />
                    </Button>
                </div>
                <div ref={ref} className="w9-reveal text-center mb-12 md:mb-16">
                    <p className="font-mono text-xs sm:text-sm font-medium uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--color-moss)' }}>
                        What we do
                    </p>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 font-display" style={{ '--w9-d': '90ms' } as React.CSSProperties}>
                        What we can build for you
                    </h2>
                    <p className="text-lg text-slate-500 mt-4 max-w-2xl mx-auto" style={{ '--w9-d': '180ms' } as React.CSSProperties}>
                        Every part of a business — orders, payments, customers, paperwork — becomes
                        one system. Each piece below already runs in production inside Vega, Atrium
                        or Kozy Care; the same engineering can run yours.
                    </p>
                </div>
                {/* Both reveal and landing hooks watch the SAME grid: one
                    fades the cards in, the other fires each card's shape
                    drop when it truly lands in the viewport. */}
                <div
                    ref={(node) => {
                        (gridRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                        (landingRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                    }}
                    id="whatWeDoGrid"
                    className="w9-reveal-stagger grid grid-cols-1 md:grid-cols-6 gap-5 md:gap-6 max-w-6xl mx-auto"
                >
                    {WHAT_WE_DO.map((c, i) => {
                        const Shape = CARD_SHAPES[i % CARD_SHAPES.length];
                        return (
                        <div
                            key={i}
                            onMouseMove={handleSpotlight}
                            style={{ '--w14-i': i } as React.CSSProperties}
                            className={`w14-card w7-spotlight-card group relative overflow-hidden bg-white rounded-2xl border border-slate-200 p-7 shadow-sm hover:shadow-xl hover:shadow-slate-900/5 hover:border-slate-300 transition-all duration-300 ${bentoSpan[i]}`}
                        >
                            {/* W14: the card's own wireframe shape — the same
                                geometry that orbits above — drops in when the
                                card lands, then turns slowly as a watermark. */}
                            <Shape className="w14-shape pointer-events-none absolute top-4 right-4 w-11 h-11 text-emerald-500/60 group-hover:text-emerald-600/80 transition-colors duration-500" />
                            {/* W13: a quiet, always-on icon chip — the orbiting
                                shapes above carry the motion now; the cards
                                stay calm and legible. W14: the chip pings
                                emerald when its shape lands. */}
                            <div className="w14-chip w-12 h-12 mb-5 rounded-md bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors duration-300" aria-hidden="true">
                                <c.Icon className="w-6 h-6" />
                            </div>
                            <h3 className="font-display text-lg font-bold text-slate-900 mb-2.5 tracking-tight">{c.title}</h3>
                            <p className="text-slate-600 text-sm leading-[1.7]">{c.body}</p>
                        </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};


// ─── OUR WORK (corporate hub) — the portfolio ──────────────────────────────
// P8: every card maps to a real, deployed system. Vega and Atrium are
// PracticePro's own products (their marketing pages live at /vega and
// /atrium on this site); Kozy Care is a client commission, live at
// kozycare.ng — shown here as proof we build for other people's businesses.

// W7 (the wow site): every project ships with REAL SCREENS captured from the
// live systems — marketing pages, portal logins and actual in-app screens —
// plus the STACK it is built with and WHAT'S INSIDE it. Prospective clients
// can see what we can do (capabilities), what we have done (these screens)
// and how we could help them (the preview + CTA).

type WorkScreen = {
    src: string;
    alt: string;
    kind: 'browser' | 'phone';
    label: string;
};

const OUR_WORK: Array<{
    name: string;
    tagline: string;
    badge: string;
    badgeClass: string;
    Icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    body: string;
    cta: { label: string; href: string; external: boolean };
    ctaClass: string;
    // ── W7 additions ──
    frameUrl: string;          // shown in the browser-chrome mockup
    stack: string[];           // what it's built with
    inside: string[];          // modules inside the system
    primaryScreen: WorkScreen; // the card's main showcase shot
    detailScreens: WorkScreen[]; // the preview modal's gallery
    glowClass: string;         // accent glow behind the devices
    borderGlowClass: string;   // hover ring on the device stack
    // ── W9 additions ──
    tourSystem: TourSystem;    // the guided tour's screen set (demo data)
}> = [
    {
        name: 'Vega',
        tagline: 'Legal Practice OS',
        badge: 'Our product',
        badgeClass: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
        Icon: VegaMark,
        iconClass: '',
        body: 'Case management, AI-assisted drafting with DraftPro and ALOA, court-rule-aware calendaring and billing for Nigerian law firms — from case intake to filing.',
        cta: { label: 'Explore Vega', href: '/vega', external: true },
        ctaClass: 'group-hover:text-amber-400 text-amber-400',
        frameUrl: 'practicepro.ng/vega',
        tourSystem: 'vega',
        stack: ['React + TypeScript', 'Convex', 'Tailwind CSS', 'Gemini AI', 'Paystack', 'Android app (Capacitor)'],
        inside: [
            'Matter & case management',
            'AI drafting — DraftPro & ALOA',
            'Court-rule-aware calendaring',
            'Billing, invoices & receipts',
            'Client portal with live case tracking',
            'WhatsApp, SMS & email notifications',
        ],
        primaryScreen: {
            src: '/assets/landing/work/vega-page.jpg',
            alt: 'The PracticePro Vega product page — Practice Management for Nigerian Law Firms',
            kind: 'browser',
            label: 'Product page — practicepro.ng/vega',
        },
        detailScreens: [
            {
                src: '/assets/landing/work/vega-page.jpg',
                alt: 'The PracticePro Vega product page — Practice Management for Nigerian Law Firms',
                kind: 'browser',
                label: 'Product page — practicepro.ng/vega',
            },
            {
                src: '/assets/landing/work/vega-calendar.jpg',
                alt: 'Vega\u2019s court-rule-aware calendar, running in the PracticePro Android app',
                kind: 'phone',
                label: 'Court-rule calendar — the mobile app',
            },
            {
                src: '/assets/landing/work/vega-messages.jpg',
                alt: 'Vega\u2019s scheduled messaging screen for client updates by email, SMS and WhatsApp',
                kind: 'phone',
                label: 'Scheduled client messaging — the mobile app',
            },
            {
                src: '/assets/landing/work/vega-portal.jpg',
                alt: 'The Vega client portal sign-in screen',
                kind: 'browser',
                label: 'Client portal — sign-in',
            },
        ],
        glowClass: 'bg-amber-500/25',
        borderGlowClass: 'group-hover:border-amber-500/40',
    },
    {
        name: 'Atrium',
        tagline: 'Property Management OS',
        badge: 'Our product',
        badgeClass: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
        Icon: AtriumMark,
        iconClass: '',
        body: "Rent and service-charge collection, residents' portal, maintenance workflows and revenue intelligence for property portfolios — applying the tenancy law of all 36 states and the FCT.",
        cta: { label: 'Explore Atrium', href: '/atrium', external: true },
        ctaClass: 'group-hover:text-emerald-400 text-emerald-400',
        frameUrl: 'practicepro.ng/atrium',
        tourSystem: 'atrium',
        stack: ['React + TypeScript', 'Convex', 'Tailwind CSS', 'Paystack', 'WhatsApp & SMS', 'Web + Android'],
        inside: [
            'Rent & service-charge collection',
            "Residents' portal with statements",
            'Maintenance request workflows',
            'Revenue intelligence & forecasting',
            'Tenancy law engine — 36 states + FCT',
            'Defaulter tracking & escalation',
        ],
        primaryScreen: {
            src: '/assets/landing/work/atrium-page.jpg',
            alt: 'The PracticePro Atrium product page — Revenue Monitor for Property Managers',
            kind: 'browser',
            label: 'Product page — practicepro.ng/atrium',
        },
        detailScreens: [
            {
                src: '/assets/landing/work/atrium-page.jpg',
                alt: 'The PracticePro Atrium product page — Revenue Monitor for Property Managers',
                kind: 'browser',
                label: 'Product page — practicepro.ng/atrium',
            },
            {
                src: '/assets/landing/work/atrium-financials.jpg',
                alt: 'Atrium\u2019s financials dashboard showing collected revenue, outstanding balances and invoices, in the PracticePro mobile app',
                kind: 'phone',
                label: 'Revenue & collections dashboard — the mobile app',
            },
            {
                src: '/assets/landing/work/atrium-portal.jpg',
                alt: 'The Atrium residents\u2019 portal sign-in screen',
                kind: 'browser',
                label: "Residents' portal — sign-in",
            },
        ],
        glowClass: 'bg-emerald-500/25',
        borderGlowClass: 'group-hover:border-emerald-500/40',
    },
    {
        name: 'Kozy Care',
        tagline: 'Dry-cleaning & laundry platform',
        badge: 'Built for a client',
        badgeClass: 'bg-primary-500/10 text-primary-300 border border-primary-500/30',
        Icon: MapPinIcon,
        iconClass: 'bg-primary-500/10 text-primary-400',
        body: '“Uncompromising care. Exceptional convenience.” Pickup-and-delivery laundry is a crowded business — nothing special about the idea. What lets this one scale is the system behind it: guest booking, Kozy Circle memberships, a customer portal with live order tracking, GPS rider dispatch across 12 Lagos zones, a multi-branch admin console and a partner network — more customers, handled well, without the chaos doubling.',
        cta: { label: 'Visit kozycare.ng', href: 'https://kozycare.ng', external: true },
        ctaClass: 'group-hover:text-primary-400 text-primary-400',
        frameUrl: 'kozycare.ng',
        tourSystem: 'kozy',
        stack: ['Next.js', 'Prisma + Supabase', 'NextAuth', 'Paystack', 'Termii SMS', 'Vercel'],
        inside: [
            'Guest pickup booking & quotes',
            'Kozy Circle memberships',
            'Customer portal & order tracking',
            'Payments, receipts & invoices — Paystack',
            'GPS rider dispatch — 12 zones',
            'Multi-branch admin console',
            'Partner garment-care network',
        ],
        primaryScreen: {
            src: '/assets/landing/work/kozy-home.jpg',
            alt: 'The Kozy Care home page — dry cleaning and laundry services, with pickup booking',
            kind: 'browser',
            label: 'Home page — kozycare.ng',
        },
        detailScreens: [
            {
                src: '/assets/landing/work/kozy-home.jpg',
                alt: 'The Kozy Care home page — dry cleaning and laundry services, with pickup booking',
                kind: 'browser',
                label: 'Home page — kozycare.ng',
            },
            {
                src: '/assets/landing/work/kozy-order-service.jpg',
                alt: 'Kozy Care\u2019s signed-in ordering flow — the service picker with per-item naira pricing',
                kind: 'browser',
                label: 'Ordering — the service picker',
            },
            {
                src: '/assets/landing/work/kozy-order-checkout.jpg',
                alt: 'Kozy Care\u2019s checkout — the live quote with discounts applied, card or bank transfer',
                kind: 'browser',
                label: 'Ordering — checkout',
            },
            {
                src: '/assets/landing/work/kozy-portal-order.jpg',
                alt: 'The Kozy Care customer portal — an active order with its status timeline',
                kind: 'browser',
                label: 'Customer portal — live order tracking',
            },
            {
                src: '/assets/landing/work/kozy-invoice.jpg',
                alt: 'A Kozy Care invoice — itemised in naira, printable and downloadable',
                kind: 'browser',
                label: 'The invoice',
            },
            {
                src: '/assets/landing/work/kozy-membership-active.jpg',
                alt: 'An active Kozy Circle membership on a live account, in the customer portal',
                kind: 'phone',
                label: 'Kozy Circle — an active membership',
            },
            {
                src: '/assets/landing/work/kozy-admin-kanban.jpg',
                alt: 'The Kozy Care admin console\u2019s order board',
                kind: 'browser',
                label: 'Admin console — the order board',
            },
            {
                src: '/assets/landing/work/kozy-admin-crm.jpg',
                alt: 'The Kozy Care admin CRM — customers with lifetime value and MEMBER badges',
                kind: 'browser',
                label: 'Admin console — the CRM',
            },
            {
                src: '/assets/landing/work/kozy-book.jpg',
                alt: 'The Kozy Care pickup booking flow — items, live quote, pickup slot and zone',
                kind: 'browser',
                label: 'Guest booking & quotes — kozycare.ng/book',
            },
            {
                src: '/assets/landing/work/kozy-services.jpg',
                alt: 'Kozy Care\u2019s services catalogue — men\u2019s and women\u2019s dry cleaning, home linens, shoe care and alterations',
                kind: 'browser',
                label: 'Services catalogue — kozycare.ng/services',
            },
            {
                src: '/assets/landing/work/kozy-memberships.jpg',
                alt: 'Kozy Care\u2019s membership plans page with laundry pricing',
                kind: 'browser',
                label: 'Membership plans — kozycare.ng/memberships',
            },
            {
                src: '/assets/landing/work/kozy-login.jpg',
                alt: 'The Kozy Care customer portal sign-in screen',
                kind: 'browser',
                label: 'Customer portal — sign-in',
            },
            {
                src: '/assets/landing/work/kozy-partners.jpg',
                alt: 'The Kozy Care partner network page — other laundry operators running under the Kozy brand',
                kind: 'browser',
                label: 'Partner network — kozycare.ng/partners',
            },
        ],
        glowClass: 'bg-primary-500/25',
        borderGlowClass: 'group-hover:border-primary-500/40',
    },
    {
        name: 'Woosh',
        tagline: 'Free temporary email — for humans and test rigs',
        badge: 'Our tool',
        badgeClass: 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30',
        Icon: MailIcon,
        iconClass: 'bg-indigo-500/10 text-indigo-400',
        body: 'A free temporary-email service we built in-house: instant disposable inboxes that keep spam out of real mailboxes — plus a documented API with webhooks, revocable API keys and extracted verification codes. Our own test rigs run signup, payment and notification batteries on it, sparing our transactional email quota.',
        cta: { label: 'Visit woosh.dpdns.org', href: 'https://woosh.dpdns.org', external: true },
        ctaClass: 'group-hover:text-indigo-400 text-indigo-400',
        frameUrl: 'woosh.dpdns.org',
        tourSystem: 'woosh',
        stack: ['Cloudflare edge', 'REST API + webhooks', 'Verification-code extraction', 'Free — no sign-up'],
        inside: [
            'Instant disposable inboxes',
            'Shareable inbox links',
            'Codes & links extracted for you',
            'Webhooks — push instead of poll',
            'Revocable API keys, docs + console',
            'Dark mode & mail notifications',
        ],
        primaryScreen: {
            src: '/assets/landing/work/woosh-home.jpg',
            alt: 'Woosh — a free temporary email address in one click, at woosh.dpdns.org',
            kind: 'browser',
            label: 'The tool — woosh.dpdns.org',
        },
        detailScreens: [
            {
                src: '/assets/landing/work/woosh-home.jpg',
                alt: 'Woosh — a free temporary email address in one click, at woosh.dpdns.org',
                kind: 'browser',
                label: 'The tool — woosh.dpdns.org',
            },
            {
                src: '/assets/landing/work/woosh-inbox.jpg',
                alt: 'A live Woosh inbox receiving Kozy Care\u2019s real transactional email',
                kind: 'browser',
                label: 'A live inbox — receiving Kozy Care\u2019s mail',
            },
            {
                src: '/assets/landing/work/woosh-message.jpg',
                alt: 'A verification email opened in Woosh, with the code extracted and ready to copy',
                kind: 'browser',
                label: 'Message view — codes extracted for you',
            },
            {
                src: '/assets/landing/work/woosh-dark.jpg',
                alt: 'Woosh in dark mode, with a live inbox',
                kind: 'browser',
                label: 'Dark mode',
            },
            {
                src: '/assets/landing/work/woosh-api.jpg',
                alt: 'The Woosh Email Testing API documentation — endpoints, webhooks, API keys and an llms.txt prompt block',
                kind: 'browser',
                label: 'The developer API — woosh.dpdns.org/api-docs',
            },
        ],
        glowClass: 'bg-indigo-500/25',
        borderGlowClass: 'group-hover:border-indigo-500/40',
    },
];

/** W7: a macOS-style browser chrome around a real screen capture. */
const BrowserFrame: React.FC<{ url: string; src: string; alt: string; className?: string; eager?: boolean }> = ({ url, src, alt, className = '', eager = false }) => (
    <div className={`overflow-hidden rounded-xl border border-white/10 bg-[#0E1626] shadow-lg shadow-black/50 ${className}`}>
        <div className="flex items-center gap-2 px-3 py-2 bg-[#111A2C] border-b border-white/[0.06]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" aria-hidden="true" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" aria-hidden="true" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" aria-hidden="true" />
            <span className="flex-1 mx-1 px-3 py-1 rounded-md bg-black/40 text-[10px] leading-none text-slate-400 font-medium truncate flex items-center gap-1.5 min-h-[1.25rem]">
                <LockClosedIcon className="w-2.5 h-2.5 flex-shrink-0" />
                {url}
            </span>
        </div>
        <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} className="w-full aspect-[16/10] object-cover object-top block" />
    </div>
);

/** W7: a phone chrome around a real in-app screen capture. */
const PhoneFrame: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className = '' }) => (
    <div className={`overflow-hidden rounded-[1.6rem] border-[5px] border-[#1A2334] bg-black shadow-2xl shadow-black/60 ${className}`}>
        <div className="relative">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full bg-white/20 z-10" aria-hidden="true" />
            <img src={src} alt={alt} loading="lazy" className="w-full aspect-[9/20] object-cover object-top block" />
        </div>
    </div>
);

/** W7: the "Preview the system" modal — real screens, the stack, what's inside.
 *  W10: the preview is REAL CAPTURES ONLY — live pages from the deployed
 *  systems plus the real app running its own demo data (P8 honesty: every
 *  screen is labelled with exactly what it is). No mocked-up UI. */
const WorkDetailModal: React.FC<{
    work: (typeof OUR_WORK)[number] | null;
    onClose: () => void;
    onContactSales: () => void;
}> = ({ work, onClose, onContactSales }) => {
    // Escape + scroll-lock (the landing page scrolls inside its own div).
    useEffect(() => {
        if (!work) return;
        const scroller = document.querySelector('[data-public-page]') as HTMLElement | null;
        const prevOverflow = scroller?.style.overflow ?? '';
        if (scroller) scroller.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => {
            if (scroller) scroller.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKey);
        };
    }, [work, onClose]);

    if (!work) return null;

    return createPortal(
        // z-[10000] — above the cookie consent banner (z-[9999]) so a preview
        // is never obscured; the banner reappears once the modal closes.
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label={`${work.name} — system preview`}>
            <div className="absolute inset-0 bg-[#070D18]/85 backdrop-blur-md" onClick={onClose} aria-hidden="true" />
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[88vh] overflow-hidden flex flex-col animate-swap-in">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 px-6 sm:px-8 pt-6 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 ${work.iconClass}`}>
                            <work.Icon className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                            <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">{work.name}</h3>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{work.tagline}</p>
                        </div>
                    </div>
                    <Button
                        variant="bare"
                        onClick={onClose}
                        autoFocus
                        aria-label="Close preview"
                        className="p-2 rounded-sm text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors flex-shrink-0"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </Button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto px-6 sm:px-8 py-6">
                    {/* W10: real captures only — live pages from the deployed
                        systems plus the real app on demo data. */}
                    <div className="mb-8">
                        <SystemTour system={work.tourSystem} />
                    </div>

                    <p className="text-slate-600 text-sm leading-[1.75] mb-8 max-w-2xl">{work.body}</p>

                    {/* What's inside */}
                    <p className="font-mono text-xs font-medium uppercase tracking-widest text-slate-400 mb-3">Inside the system</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-8">
                        {work.inside.map((item) => (
                            <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                                <CheckIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary-500" />
                                {item}
                            </li>
                        ))}
                    </ul>

                    {/* Stack */}
                    <p className="font-mono text-xs font-medium uppercase tracking-widest text-slate-400 mb-3">Built with</p>
                    <div className="flex flex-wrap gap-2 mb-8">
                        {work.stack.map((s) => (
                            <span key={s} className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                                {s}
                            </span>
                        ))}
                    </div>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row gap-3 pb-2">
                        <a
                            href={work.cta.href}
                            {...(work.cta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-sm font-semibold text-sm text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 transition-all shadow-md"
                        >
                            {work.cta.label}
                            {work.cta.external ? <ExternalLinkIcon className="w-4 h-4" /> : <span aria-hidden="true">→</span>}
                        </a>
                        <Button
                            variant="bare"
                            onClick={onContactSales}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-sm font-semibold text-sm text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
                        >
                            Ask us about a system like this
                        </Button>
                    </div>
                    <p className="text-2xs font-semibold uppercase tracking-wider text-slate-400 mt-4">
                        {work.name} · Built by PracticePro
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const OurWorkSection: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    const panelsRef = useScrollReveal<HTMLDivElement>();
    const [preview, setPreview] = useState<(typeof OUR_WORK)[number] | null>(null);

    return (
        <section id="ourWork" className="relative py-16 sm:py-24 overflow-hidden w7-dark">
            {/* deep ink base + brand aurora, so the real screens glow */}
            <div className="absolute inset-0 bg-[#0A101C]" aria-hidden="true" />
            <div className="absolute -top-40 left-1/4 w-[42rem] h-[42rem] rounded-full bg-emerald-600/10 blur-[140px] pointer-events-none" aria-hidden="true" />
            <div className="absolute -bottom-52 right-1/4 w-[38rem] h-[38rem] rounded-full bg-emerald-500/10 blur-[140px] pointer-events-none" aria-hidden="true" />
            <div className="absolute inset-0 w7-grain pointer-events-none" aria-hidden="true" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
                <div ref={ref} className="w9-reveal text-center mb-12 md:mb-16">
                    <p className="font-mono text-xs sm:text-sm font-medium uppercase tracking-[0.2em] mb-4 text-emerald-400/90">
                        Our work
                    </p>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white font-display" style={{ '--w9-d': '90ms' } as React.CSSProperties}>
                        Systems we&apos;ve built
                    </h2>
                    <p className="text-lg text-slate-400 mt-4 max-w-2xl mx-auto" style={{ '--w9-d': '180ms' } as React.CSSProperties}>
                        Two products we run ourselves, a platform built to order for a client, and a free tool running on the open internet.
                        Each one takes a real workflow end to end — and shows what it takes to run a business that scales. Real screens, real stack, really live.
                    </p>
                </div>

                <div ref={panelsRef} className="w9-reveal-stagger grid grid-cols-1 gap-6 md:gap-10 max-w-6xl mx-auto">
                    {OUR_WORK.map((w, i) => (
                        <div
                            key={w.name}
                            className={`group relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 sm:p-10 transition-all duration-500 hover:border-white/20 hover:bg-white/[0.05] ${w.borderGlowClass}`}
                        >
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                                {/* Text side — alternates sides so the page breathes */}
                                <div className={`${i % 2 === 1 ? 'lg:order-2' : ''}`}>
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className={`w-11 h-11 rounded-md flex items-center justify-center ${w.iconClass}`}>
                                            <w.Icon className="w-5 h-5" />
                                        </span>
                                        <span className={`text-2xs font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-full ${w.badgeClass}`}>
                                            {w.badge}
                                        </span>
                                    </div>
                                    <h3 className="font-display text-3xl font-bold tracking-tight text-white">{w.name}</h3>
                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1.5 mb-4">{w.tagline}</p>
                                    <p className="text-slate-300/90 text-sm leading-[1.75] mb-6">{w.body}</p>

                                    {/* Stack chips — the first few, full list in the preview */}
                                    <p className="font-mono text-2xs font-medium uppercase tracking-widest text-slate-500 mb-2.5">Built with</p>
                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {w.stack.slice(0, 4).map((s) => (
                                            <span key={s} className="px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-2xs font-semibold text-slate-300">
                                                {s}
                                            </span>
                                        ))}
                                        {w.stack.length > 4 && (
                                            <span className="px-2.5 py-1 rounded-full text-2xs font-semibold text-slate-500">
                                                +{w.stack.length - 4} more
                                            </span>
                                        )}
                                    </div>

                                    {/* Key modules — a taste of what's inside */}
                                    <p className="font-mono text-2xs font-medium uppercase tracking-widest text-slate-500 mb-2.5">Inside the system</p>
                                    <ul className="space-y-1.5 mb-8">
                                        {w.inside.slice(0, 3).map((item) => (
                                            <li key={item} className="flex items-start gap-2 text-sm text-slate-400">
                                                <CheckIcon className="w-3.5 h-3.5 mt-1 flex-shrink-0 text-primary-500" />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                                        <a
                                            href={w.cta.href}
                                            {...(w.cta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                            className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-all duration-300 group-hover:gap-2.5 ${w.ctaClass}`}
                                        >
                                            {w.cta.label} {w.cta.external
                                                ? <ExternalLinkIcon className="w-3.5 h-3.5" />
                                                : <span aria-hidden="true">→</span>}
                                        </a>
                                        <Button
                                            variant="bare"
                                            onClick={() => setPreview(w)}
                                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors min-h-[2rem]"
                                        >
                                            <DeviceMobileIcon className="w-4 h-4" /> Preview the system
                                        </Button>
                                        <span className="text-2xs font-semibold uppercase tracking-wider text-slate-600">Built by PracticePro</span>
                                    </div>
                                </div>

                                {/* Device side — real screens, floating in the glow */}
                                <div className={`relative ${i % 2 === 1 ? 'lg:order-1' : ''}`}>
                                    <div className={`absolute -inset-6 rounded-[2rem] blur-3xl opacity-60 group-hover:opacity-90 transition-opacity duration-700 ${w.glowClass}`} aria-hidden="true" />
                                    <div className="relative transition-transform duration-500 ease-out group-hover:-translate-y-1.5">
                                        <BrowserFrame
                                            url={w.frameUrl}
                                            src={w.primaryScreen.src}
                                            alt={w.primaryScreen.alt}
                                            className="transition-transform duration-500 group-hover:scale-[1.015] rotate-[-1.2deg] group-hover:rotate-0"
                                        />
                                        {/* The second surface: an in-app phone screen (Vega/Atrium)
                                            or a second live page (Kozy Care). */}
                                        {w.detailScreens[1].kind === 'phone' ? (
                                            <PhoneFrame
                                                src={w.detailScreens[1].src}
                                                alt={w.detailScreens[1].alt}
                                                className="absolute -bottom-8 -right-3 sm:-right-6 w-[27%] min-w-[92px] rotate-[3deg] w7-float"
                                            />
                                        ) : (
                                            <div className="absolute -bottom-8 -right-2 sm:-right-5 w-[46%] rotate-[2.2deg] w7-float">
                                                <BrowserFrame url={w.frameUrl + (w.name === 'Kozy Care' ? '/services' : '')} src={w.detailScreens[1].src} alt={w.detailScreens[1].alt} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <WorkDetailModal work={preview} onClose={() => setPreview(null)} onContactSales={onContactSales} />
        </section>
    );
};

// ─── HOW WE WORK (corporate hub) — the engagement process ──────────────────

const HOW_WE_WORK: Array<{
    num: string;
    title: string;
    body: string;
    Icon: React.ComponentType<{ className?: string }>;
}> = [
    {
        num: '1',
        title: 'Understand your operations',
        body: 'We sit with your team and map how the business actually runs — the paperwork, the phone calls, the spreadsheets — and where the friction lives. You talk; we listen and take notes.',
        Icon: ClipboardListIcon,
    },
    {
        num: '2',
        title: 'Design the system',
        body: 'Workflows, data model, integrations and screens — designed with you and agreed before a line of code is written, so there are no surprises at handover.',
        Icon: PencilSquareIcon,
    },
    {
        num: '3',
        title: 'Build & integrate',
        body: 'We build in weekly increments and demo as we go, so your feedback lands in the product from week one — not at the end, when changes are expensive.',
        Icon: ComputerDesktopIcon,
    },
    {
        num: '4',
        title: 'Launch, train & run with you',
        body: 'We deploy, train your staff and migrate your records. Then we stay on — monitoring, supporting and iterating as the business grows.',
        Icon: CheckBadgeIcon,
    },
];

export const HowWeWorkSection: React.FC = () => {
    const ref = useScrollReveal<HTMLDivElement>();
    const stepsRef = useScrollReveal<HTMLDivElement>();
    // W7: a vertical timeline whose spine fills with brand gradient as the
    // visitor scrolls — the process literally draws itself.
    // W9: the process also WALKS ITSELF — steps light up in sequence while
    // the section is in view (auto-advance every 3s), each node filling with
    // the brand gradient and its card lifting, with a pulse riding the
    // leading edge of the spine fill. Scroll progress and the walk combine:
    // the spine shows whichever is further along.
    const [progress, setProgress] = useState(0);
    const [active, setActive] = useState(0);
    const onProgress = React.useCallback((p: number) => setProgress(p), []);
    const timelineRef = useSectionProgress<HTMLDivElement>(onProgress);
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        let inView = false;
        const io = new IntersectionObserver((entries) => {
            inView = entries.some((en) => en.isIntersecting);
        }, { threshold: 0.25 });
        if (timelineRef.current) io.observe(timelineRef.current);
        const iv = window.setInterval(() => {
            if (inView) setActive((a) => (a + 1) % HOW_WE_WORK.length);
        }, 3000);
        return () => {
            io.disconnect();
            window.clearInterval(iv);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fill = Math.max(progress, (active + 1) / HOW_WE_WORK.length);
    return (
        <section id="howWeWork" className="py-16 sm:py-24 bg-white relative overflow-hidden">
            {/* W8: the FluidSeam above owns the dark→light transition now. */}
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
                <div ref={ref} className="w9-reveal text-center mb-12 md:mb-16">
                    <p className="font-mono text-xs sm:text-sm font-medium uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--color-moss)' }}>
                        How we work
                    </p>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 font-display" style={{ '--w9-d': '90ms' } as React.CSSProperties}>
                        From first conversation to a system you scale with
                    </h2>
                    <p className="text-lg text-slate-500 mt-4 max-w-2xl mx-auto" style={{ '--w9-d': '180ms' } as React.CSSProperties}>
                        The same process that produced Vega, Atrium and Kozy Care.
                    </p>
                </div>

                <div ref={timelineRef} className="relative max-w-3xl mx-auto">
                    <div className="absolute left-[27px] sm:left-1/2 sm:-translate-x-1/2 top-2 bottom-2 w-[3px] rounded-full bg-slate-200 overflow-visible" aria-hidden="true">
                        <div
                            className="w-full rounded-full bg-gradient-to-b from-emerald-300 via-emerald-500 to-primary-600 will-change-[height]"
                            style={{ height: `${Math.round(fill * 100)}%` }}
                        />
                        {/* W9: a pulse riding the leading edge of the fill. */}
                        {!reducedMotion && (
                            <span className="w9-spine-pulse" style={{ top: `${Math.round(fill * 100)}%` }} />
                        )}
                    </div>

                    <div ref={stepsRef} className="w9-reveal-stagger space-y-10 sm:space-y-14">
                        {HOW_WE_WORK.map((step, i) => (
                            <div key={step.num} className={`relative flex items-start gap-6 sm:gap-0 ${i % 2 === 1 ? 'sm:flex-row-reverse' : ''}`}>
                                {/* Node on the spine — W9: lights up as the walk passes. */}
                                <div className="relative z-10 flex-shrink-0 sm:absolute sm:left-1/2 sm:-translate-x-1/2 sm:flex-shrink">
                                    <span className={`w9-step-node flex items-center justify-center w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-md shadow-slate-900/5 font-display text-xl font-extrabold ${i <= active ? 'is-active' : ''}`}>
                                        <span className="w9-step-num text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 to-primary-600">{step.num}</span>
                                    </span>
                                </div>
                                {/* Card — W9: the current step lifts. */}
                                <div className={`flex-1 sm:w-[calc(50%-3.5rem)] sm:max-w-sm ${i % 2 === 1 ? 'sm:mr-auto sm:text-right' : 'sm:ml-auto'}`}>
                                    <div className={`w9-step-card bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all ${i === active ? 'is-active' : ''}`}>
                                        <div className={`flex items-center gap-3 mb-3 ${i % 2 === 1 ? 'sm:flex-row-reverse' : ''}`}>
                                            <span className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center">
                                                <step.Icon className="w-5 h-5" />
                                            </span>
                                            <h3 className="font-display text-lg font-bold text-slate-900 tracking-tight">{step.title}</h3>
                                        </div>
                                        <p className="text-slate-600 text-sm leading-[1.7]">{step.body}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

// ─── WHO WE ARE (corporate hub) — about the company ────────────────────────
// Where "Lagos, Nigeria" legitimately lives: not as a top-of-page eyebrow,
// but as the company's identity — a software company that runs its own
// products in production, which is the credibility pitch for client builds.

const ABOUT_FACTS: Array<{
    text: string;
    Icon: React.ComponentType<{ className?: string }>;
}> = [
    {
        text: '3 systems live in production — Vega, Atrium and Kozy Care',
        Icon: CheckIcon,
    },
    {
        text: 'Payments, messaging, portals and AI automation shipping today, not planned',
        Icon: ZapIcon,
    },
    {
        text: 'NDPA 2023-aligned data handling, encrypted in transit and at rest',
        Icon: ShieldCheckIcon,
    },
    {
        text: 'Working with businesses across Nigeria and beyond — wherever a process needs a system',
        Icon: MapPinIcon,
    },
];

export const AboutSection: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => {
    // W10: the section settles in as a cascade — eyebrow, headline and each
    // paragraph arrive in sequence, then the facts card rises after the
    // copy (the old single-block reveal read as bland).
    const leftRef = useScrollReveal<HTMLDivElement>();
    const cardRef = useScrollReveal<HTMLDivElement>();
    return (
        <section id="about" className="py-16 sm:py-24" style={{ background: 'var(--color-paper)' }}>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 max-w-6xl mx-auto items-center">
                    <div ref={leftRef} className="w9-reveal-stagger">
                        <p className="font-mono text-xs sm:text-sm font-medium uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--color-moss)' }}>
                            Who we are
                        </p>
                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 mb-6">
                            Built in Lagos.
                            <br />
                            Run in production.
                        </h2>
                            <p className="text-slate-600 leading-[1.75] mb-5">
                                PracticePro Systems is a software company based in Lagos, Nigeria. We build
                                the systems businesses use to manage their affairs — the daily operating
                                software that tracks the work, moves the money, talks to the customers and
                                keeps the records straight.
                            </p>
                            <p className="text-slate-600 leading-[1.75] mb-5">
                                We don&apos;t just build systems for other people — we run our own, every
                                working day. Vega serves Nigerian law firms and Atrium serves property
                                portfolios. That means the foundations a client system stands on — payments,
                                messaging, portals, automation, security — are already in production, not on
                                a roadmap.
                            </p>
                            <p className="text-slate-600 leading-[1.75]">
                                That is the difference between a software vendor and a software partner:
                                we live with the consequences of our engineering, in products we operate
                                ourselves. And when a business needs something that doesn&apos;t exist
                                yet — in any industry, anywhere — we build that too.
                            </p>
                    </div>
                    <div ref={cardRef} className="w9-reveal bg-white rounded-2xl border border-slate-200 shadow-sm p-8 sm:p-10 flex flex-col" style={{ '--w9-d': '420ms' } as React.CSSProperties}>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">PracticePro Systems at a glance</p>
                        <ul className="space-y-6 flex-1">
                            {ABOUT_FACTS.map((f, i) => (
                                <li key={i} className="flex items-start gap-4">
                                    <span className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
                                        <f.Icon className="w-5 h-5" />
                                    </span>
                                    <span className="text-sm leading-[1.7] text-slate-700">{f.text}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="border-t border-slate-100 mt-8 pt-6">
                            <Button
                                variant="bare"
                                onClick={onContactSales}
                                className="text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors min-h-[2rem] inline-flex items-center gap-1.5"
                            >
                                Talk to us <span aria-hidden="true">→</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

// ─── HUB FINAL CTA (corporate hub) ─────────────────────────────────────────

export const HubFinalCTASection: React.FC<{ onContactSales: () => void; scrollTo: (id: string) => void }> = ({ onContactSales, scrollTo }) => {
    // W7: the closing argument goes dark — an aurora of the brand colors
    // breathing behind the headline, so the page ends the way it began.
    // W9: it settles in with the same soft reveal as the rest of the page.
    const ref = useScrollReveal<HTMLDivElement>();
    return (
    <section className="relative py-20 md:py-28 overflow-hidden w7-dark">
        <div className="absolute inset-0 bg-[#0A101C]" aria-hidden="true" />
        {/* Aurora — two brand-green clouds drifting on a slow loop */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[46rem] h-[26rem] rounded-full bg-emerald-600/15 blur-[120px] w7-aurora-a" aria-hidden="true" />
        <div className="absolute -bottom-40 left-1/4 w-[30rem] h-[22rem] rounded-full bg-emerald-300/10 blur-[110px] w7-aurora-b" aria-hidden="true" />
        <div className="absolute inset-0 w7-grain pointer-events-none" aria-hidden="true" />

        <div ref={ref} className="w9-reveal container mx-auto px-4 sm:px-6 lg:px-8 text-center max-w-3xl relative">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white font-display">
                Have a process that should{' '}
                <span className="text-transparent bg-clip-text inline-block" style={{ backgroundImage: 'linear-gradient(to right, #6EE7B7, #34D399)' }}>
                    run itself?
                </span>
            </h2>
            <p className="text-lg text-slate-400 mt-4 max-w-2xl mx-auto">
                Tell us how your business works today — we&apos;ll show you what its system could
                look like. If one of our products already fits, we&apos;ll say so. If it
                doesn&apos;t, we&apos;ll build the one that does.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                <Button
                    variant="bare"
                    onClick={onContactSales}
                    className="bg-white text-slate-900 px-8 py-4 rounded-sm font-semibold hover:bg-slate-100 hover:scale-[1.02] transition-all shadow-md"
                >
                    Tell us what you need
                </Button>
                <Button
                    variant="bare"
                    onClick={() => scrollTo('ourWork')}
                    className="bg-transparent border-2 border-white/20 text-white px-8 py-4 rounded-sm font-semibold hover:bg-white/10 hover:border-white/30 transition-all"
                >
                    Explore our products
                </Button>
            </div>
            <p className="text-sm text-slate-500 mt-6">
                We reply within 24 hours.
            </p>
        </div>
    </section>
    );
};

// (ResourcesSection removed — Resources is now a dedicated page)

// ─── MOBILE STICKY BOTTOM CTA BAR ─────────────────────────────────────────
// Fixed to the viewport bottom on mobile only (md:hidden). Sits above the
// WhatsApp FAB in z-order so the primary CTAs are always tappable. Uses
// backdrop-blur + bg-white/95 for a translucent backdrop so any hero text
// scrolling behind it stays partially visible rather than fully occluded.
// (Hero text already gets pb-28 padding on mobile to clear this bar + FAB.)
