/**
 * WhatWeDoSection — the W18 system core + iso-shape cards, restored.
 * SystemCoreScene (three.js, lazy chunk) orbits above the cards; each
 * card carries its wireframe shape and lands it on scroll (.w14-landed).
 * Card titles move to customer outcomes in Phase C (C4).
 */
import React, { useEffect, useRef } from 'react';
import { Button } from '../../../components/ui';
import { useScrollReveal } from '../hooks';
import SystemCoreScene from '../scenes/SystemCoreScene';
import { BellIcon, BrainIcon, BriefcaseIcon, ChevronDownIcon, LinkIcon, NairaCircleIcon, ShieldCheckIcon, UsersIcon } from '../../../constants';

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
        title: 'Software shaped around how your business already runs',
        body: 'A system shaped around your operations, not your operations reshaped around software. We study how your business actually runs — the paperwork, the phone calls, the spreadsheets — then build the software that runs it. Kozy Care, a complete dry-cleaning operations platform, was built exactly this way.',
        Icon: BriefcaseIcon,
    },
    {
        title: 'Your tools, wired into one workflow',
        body: 'The tools you already use, wired into one workflow: WhatsApp and SMS messaging, Paystack payments, email, calendars and document tools. Vega and Atrium ship with integrations like these — we can build yours into whatever your business runs on.',
        Icon: LinkIcon,
    },
    {
        title: 'Customers who help themselves, any hour, any phone',
        body: 'Self-service portals for the people you serve — track cases, view receipts and ledgers, book services, request maintenance. Your customers help themselves at any hour, on any phone, without a call to your office.',
        Icon: UsersIcon,
    },
    {
        title: 'Money recorded the moment it lands',
        body: 'Invoicing, collections, defaulter tracking, automatic receipts and reconciliation — with dashboards that answer revenue questions in seconds. Built naira-first, with Paystack and bank transfer flows already in production.',
        Icon: NairaCircleIcon,
    },
    {
        title: 'The repetitive work, done for you',
        body: 'AI drafting, deadline computation, smart reminders and workflow automation that take over the repetitive work — the same engine that drafts court documents in Vega and applies tenancy law across 36 states and the FCT in Atrium.',
        Icon: BrainIcon,
    },
    {
        title: 'Nothing slips, the right person is alerted on time',
        body: 'The rules that run the business day to day: approvals, reminders, escalations and banner alerts that reach the right person on WhatsApp, SMS or email. When a payment fails or a deadline looms, the system moves first — your team simply sees what needs doing.',
        Icon: BellIcon,
    },
    {
        title: 'Your system stays up and your data stays yours',
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
                    <p className="text-xs sm:text-xs font-bold uppercase tracking-[0.3em] mb-4" style={{ color: 'var(--color-moss)' }}>
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
                            <div className="w14-chip w-12 h-12 mb-5 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-100 transition-colors duration-300" aria-hidden="true">
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
