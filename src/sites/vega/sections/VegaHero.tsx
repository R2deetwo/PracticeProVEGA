import React from 'react';

/**
 * VegaHero — "The Warm Chambers" hero for /vega (R27).
 *
 * Owner direction (R27): "I DON'T LIKE THE FACT THAT WE HAVE A DOCUMENT
 * AS THE LANDING PAGE FOR THE VEGA — IT IS IMPERSONAL." The exhibit
 * pleading was a court document addressed to no one; the page now opens
 * the way the product actually feels in a practice: a conversation.
 *
 * The right column is THE EVENING EXCHANGE — a working Thursday between
 * a sole practitioner (Chioma Okafor, Ikeja — the same practitioner the
 * old exhibit belonged to) and ALOA. It is a chat thread on the espresso
 * ground: her bubbles in gilt tint (right), ALOA's in floating cream
 * (left, the Suite-card register). The exchange carries the page's
 * claims conversationally — drafting accuracy (the same Motion on
 * Notice + 14-paragraph Affidavit the exhibit used to show), court-rule
 * deadlines (Ikeja Division, two clear days), and the personal promise
 * the document could never make: she is home for dinner by 6:15.
 *
 * The drafting-paper story still lives in the page — the AI band
 * (VegaAIDrafting) keeps its tracked-changes exhibit; the hero no
 * longer duplicates it as a filing.
 *
 * The product's voice (mono microlabels) stays OUTSIDE the exchange.
 * No gradient text. No raw form elements (ADR-0004): the CTA is passed
 * in as a render node by the site index. Reveals are opt-in
 * [data-vg-reveal]; the site index mounts the observer.
 */

/** ALOA's roundel — the claret notary seal at avatar scale. The § is the
 *  lawyer's glyph in the serif face; the ring text is dropped at this
 *  size (it was the exhibit seal's device — R22). */
const AloaRoundel: React.FC = () => (
    <span
        className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-vega-gilt/50 bg-vega-gilt/15 flex-shrink-0"
        aria-hidden="true"
    >
        <span
            className="text-vega-claret-bright text-lg leading-none"
            style={{ fontFamily: 'var(--font-vega-display)' }}
        >
            §
        </span>
    </span>
);

/** Chioma's roundel — espresso on gilt hairline, mono initials. */
const ChiomaRoundel: React.FC = () => (
    <span
        className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-vega-gilt/25 bg-vega-night/60 font-mono text-2xs font-semibold tracking-widest text-vega-parchment flex-shrink-0"
        aria-hidden="true"
    >
        CO
    </span>
);

/** A 12px tick / dot pair for the checklist — inline SVG, no emoji. */
const TickGlyph: React.FC = () => (
    <svg className="w-3 h-3 text-vega-gilt-bright flex-shrink-0" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2 6.5L4.8 9.2L10 3.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const ClockGlyph: React.FC = () => (
    <svg className="w-3 h-3 text-vega-gilt flex-shrink-0" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <circle cx="6" cy="6" r="4.6" stroke="currentColor" strokeWidth="1.3" />
        <path d="M6 3.6V6l1.8 1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
);

/** One message row. `side` decides the tint and the order of avatar and
 *  bubble; `card` renders ALOA's reply as a floating cream card (the
 *  Suite register) instead of a tinted bubble. */
const ChatRow: React.FC<{
    side: 'chioma' | 'aloa';
    card?: boolean;
    children: React.ReactNode;
}> = ({ side, card = false, children }) => {
    const isChioma = side === 'chioma';
    return (
        <div className={`flex items-start gap-3 ${isChioma ? 'flex-row-reverse' : ''}`}>
            {isChioma ? <ChiomaRoundel /> : <AloaRoundel />}
            <div
                className={[
                    'max-w-[78%] px-4 py-3 text-[13px] sm:text-sm leading-[1.65]',
                    isChioma
                        ? 'rounded-2xl rounded-tr-md bg-vega-gilt/15 border border-vega-gilt/30 text-vega-parchment'
                        : card
                            ? 'rounded-2xl rounded-tl-md bg-vega-parchment text-vega-night shadow-[0_18px_36px_-18px_rgb(0_0_0/0.5)]'
                            : 'rounded-2xl rounded-tl-md bg-vega-parchment/95 text-vega-night',
                ].join(' ')}
            >
                {children}
            </div>
        </div>
    );
};

export const VegaHero: React.FC<{
    /** Pinned attribution string — owned by the site index. */
    eyebrow: string;
    /** The primary CTA node (Vega-styled button), passed in by the site index. */
    cta: React.ReactNode;
}> = ({ eyebrow, cta }) => (
    <section id="home" className="relative overflow-hidden vg-grain" style={{ background: 'var(--color-paper)' }}>
        {/* The night atmosphere — the lamp over the desk, the claret aura,
            the vignette. Painted before the content, never above it. */}
        <div className="vg-hero-bg" aria-hidden="true" />

        {/* The watermark — a seriffed section mark at the edge of sight */}
        <span
            className="vg-watermark hidden lg:block text-[26rem] right-[-3.5rem] top-1/2 -translate-y-1/2"
            aria-hidden="true"
        >
            §
        </span>

        <div className="relative z-10 pt-24 pb-20 sm:pb-20 lg:pt-28 lg:pb-24 px-4 sm:px-6">
            <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 lg:gap-14 items-center">
                {/* Left — the title page of the volume */}
                {/* R37 mobile-overflow fix: min-w-0 lets the implicit mobile
                    grid track size to the container instead of the eyebrow's
                    max-content — the column can no longer push past the viewport. */}
                <div className="lg:col-span-7 min-w-0">
                    {/* Attribution eyebrow — mono micro-label with the gilt mark */}
                    <p
                        className="flex flex-wrap items-center gap-2.5 font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-6"
                        data-vg-reveal
                    >
                        <span className="inline-block w-1.5 h-1.5 bg-vega-gilt-bright" aria-hidden="true" />
                        {eyebrow}
                    </p>

                    {/* Headline — law-report scale, THREE lines at 1440. */}
                    <h1
                        className="font-vega text-[2.5rem] sm:text-6xl lg:text-[clamp(2.75rem,6.2vw,5.25rem)] font-semibold leading-[1.04] tracking-[-0.015em] mb-0 text-vega-night"
                        data-vg-reveal
                        style={{ '--vg-d': '90ms' } as React.CSSProperties}
                    >
                        Practice
                        <br />
                        management for
                        <br />
                        <span className="font-vega-italic text-vega-gilt-bright">
                            Nigerian law firms.
                        </span>
                    </h1>

                    {/* Thin gilt rule — the page's only accent bar */}
                    <div
                        className="h-px w-24 bg-vega-gilt mt-7 mb-7"
                        aria-hidden="true"
                        data-vg-reveal
                        style={{ '--vg-d': '150ms' } as React.CSSProperties}
                    />

                    {/* Sub-copy — shipped capability copy, verbatim */}
                    <p
                        className="text-base md:text-lg max-w-xl leading-[1.65] text-slate-600 mb-8"
                        data-vg-reveal
                        style={{ '--vg-d': '210ms' } as React.CSSProperties}
                    >
                        Case management, AI-assisted drafting, and billing that respects Nigerian court
                        practice — from intake to judgment, in one workspace.
                    </p>

                    {/* CTA — rendered by the site index (Vega: brass on night). */}
                    <div className="flex flex-wrap items-center gap-4 mb-5" data-vg-reveal style={{ '--vg-d': '280ms' } as React.CSSProperties}>
                        {cta}
                    </div>

                    <p
                        className="font-mono text-2xs tracking-widest text-slate-500"
                        data-vg-reveal
                        style={{ '--vg-d': '340ms' } as React.CSSProperties}
                    >
                        NO CREDIT CARD · 30-DAY TRIAL · CANCEL ANYTIME
                    </p>
                </div>

                {/* Right — the evening exchange (R27: the personal landing) */}
                <div className="lg:col-span-5 relative min-w-0" data-vg-reveal style={{ '--vg-d': '200ms' } as React.CSSProperties}>
                    <div className="relative rotate-[0.4deg] rounded-2xl border border-vega-night/70 bg-vega-night-2 px-4 sm:px-5 py-5 sm:py-6 shadow-[0_24px_48px_-22px_rgb(42_33_24/0.45)]">
                        {/* Thread header — a working Thursday, live at 18:42 */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-3.5 mb-4">
                            <p className="font-mono text-2xs font-medium uppercase tracking-[0.2em] text-slate-300">
                                Thursday · 18:42
                            </p>
                            <span className="flex items-center gap-1.5 font-mono text-2xs uppercase tracking-[0.2em] text-vega-claret-bright">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-vega-claret-bright" aria-hidden="true" />
                                ALOA · Online
                            </span>
                        </div>

                        {/* The exchange */}
                        <div className="space-y-3.5">
                            <ChatRow side="chioma">
                                ALOA — amendment hearing at Ikeja on Friday.
                                What&rsquo;s still outstanding on the file?
                            </ChatRow>

                            <ChatRow side="aloa" card>
                                <p className="font-mono text-2xs font-bold uppercase tracking-[0.18em] text-vega-gilt mb-2.5">
                                    IKD/1287/2026 — Okafor v Meridian Logistics
                                </p>
                                <ul className="space-y-2">
                                    <li className="flex items-start gap-2.5">
                                        <TickGlyph />
                                        <span className="text-vega-ink-soft">
                                            <b className="text-vega-night">Motion on Notice</b> — rev 3, filed 12 Oct.
                                            Leave to amend + deemed filing.
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <TickGlyph />
                                        <span className="text-vega-ink-soft">
                                            <b className="text-vega-night">Affidavit</b> — 14 paragraphs, sworn at the Registry.
                                        </span>
                                    </li>
                                    <li className="flex items-start gap-2.5">
                                        <ClockGlyph />
                                        <span className="text-vega-ink-soft">
                                            <b className="text-vega-night">Written Address</b> — due Wednesday, 5:00&nbsp;pm.
                                            <span className="block text-vega-ink-soft/80 text-xs mt-0.5">
                                                Deadline set by the Division&rsquo;s rules — two clear days before hearing.
                                            </span>
                                        </span>
                                    </li>
                                </ul>
                            </ChatRow>

                            <ChatRow side="chioma">And after Wednesday?</ChatRow>

                            <ChatRow side="aloa">
                                Nothing. You&rsquo;re home for dinner by 6:15.
                            </ChatRow>
                        </div>
                    </div>
                    <p className="font-mono text-2xs tracking-widest text-slate-600 mt-6 text-center lg:text-left lg:pl-4">
                        THE EVENING EXCHANGE — CHIOMA OKAFOR, SOLE PRACTITIONER, IKEJA · ILLUSTRATIVE
                    </p>
                </div>
            </div>
        </div>
    </section>
);
