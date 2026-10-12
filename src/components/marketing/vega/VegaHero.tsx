import React from 'react';

/**
 * VegaHero — "The Chambers Standard" editorial hero for /vega.
 *
 * Breaks the two-column-hero-with-floating-screenshot pattern entirely:
 * a left-aligned serif headline set like the title page of a law report,
 * a thin amber rule, and ONE art-directed visual — a rendered DraftPro
 * motion on pleading paper (margin rule, numbered paragraphs, 1.5 line
 * spacing, justified serif text, proper Nigerian legal formatting,
 * "IN THE HIGH COURT OF LAGOS STATE" caption in mono). Not a UI dump.
 *
 * No green anywhere on this page. No gradient text — serif italic carries
 * the emphasis. No raw form elements (ADR-0004 ratchet): the CTA is passed in
 * as a render node by LandingPage.
 *
 * The eyebrow string lives in LandingPage.tsx (pinned by
 * tests/unit/websiteRepositioning.test.ts) and arrives via prop.
 */

/** A single numbered paragraph of the motion exhibit. */
const DocPara: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <p className="vg-doc__line vg-doc__body text-xs leading-[1.5] text-slate-700 mb-3">
        {children}
    </p>
);

const VegaMotionDocument: React.FC = () => (
    <article
        className="vg-doc px-5 py-6 sm:px-7 sm:py-8"
        aria-label="Exhibit — a motion on notice drafted in DraftPro, Vega's legal editor"
    >
        {/* Caption block — mono, the court's own voice */}
        <header className="text-center">
            <p className="font-mono text-2xs tracking-widest text-slate-800">IN THE HIGH COURT OF LAGOS STATE</p>
            <p className="font-mono text-2xs tracking-widest text-slate-500 mt-0.5">IN THE LAGOS JUDICIAL DIVISION</p>
            <p className="font-mono text-2xs tracking-widest text-slate-500 mt-0.5">HOLDEN AT IKEJA</p>
            <p className="font-mono text-xs text-slate-900 mt-3">SUIT NO: LD/ADR/2026/0847</p>

            {/* Parties */}
            <div className="mt-4 space-y-1">
                <p className="font-mono text-2xs tracking-widest text-slate-500">BETWEEN</p>
                <div className="flex justify-between items-baseline gap-4">
                    <span className="font-vega text-sm text-slate-900">CHIOMA A. OKAFOR</span>
                    <span className="font-mono text-2xs tracking-widest text-slate-500 whitespace-nowrap">…CLAIMANT</span>
                </div>
                <p className="font-mono text-2xs tracking-widest text-slate-500">AND</p>
                <div className="flex justify-between items-baseline gap-4">
                    <span className="font-vega text-sm text-slate-900">MERIDIAN LOGISTICS LTD</span>
                    <span className="font-mono text-2xs tracking-widest text-slate-500 whitespace-nowrap">…DEFENDANT</span>
                </div>
            </div>

            {/* Title */}
            <h3 className="font-vega text-base sm:text-lg font-semibold tracking-wide text-slate-900 mt-5 underline underline-offset-4 decoration-slate-400">
                MOTION ON NOTICE
            </h3>
            <p className="font-mono text-2xs tracking-widest text-slate-500 mt-1.5">DATED THIS 9TH DAY OF OCTOBER, 2026</p>
            <p className="font-mono text-2xs leading-relaxed text-slate-500 mt-2.5 max-w-[38ch] mx-auto">
                BROUGHT PURSUANT TO THE HIGH COURT OF LAGOS STATE (CIVIL PROCEDURE) RULES 2019 AND THE INHERENT JURISDICTION OF THIS HONOURABLE COURT
            </p>
        </header>

        {/* Numbered paragraphs — pleading paper: margin rule + numbered lines */}
        <div className="vg-doc__paper vg-doc__lines mt-6 pl-3">
            <DocPara>
                THIS MOTION is brought for an order granting the Claimant leave to amend her
                statement of claim in the manner particularised in the Schedule hereto.
            </DocPara>
            <DocPara>
                The proposed amendment is necessary to plead facts that came to light after the
                filing of the original statement of claim, namely the Defendant&rsquo;s letter of{' '}
                <span className="vg-ins">14 August 2026, exhibited as Exhibit CAO 7</span>.
            </DocPara>
            <DocPara>
                No injustice will be occasioned by the amendment, the same being sought{' '}
                <span className="vg-ins">before the close of pleadings</span>{' '}
                <span className="vg-del">at this stage</span>.
            </DocPara>

            {/* Signature block */}
            <div className="mt-8 ml-4">
                <div className="w-40 border-t border-slate-400" aria-hidden="true" />
                <p className="font-vega text-sm text-slate-900 mt-1.5">T. A. SALAKO (Mrs.)</p>
                <p className="vg-margin-note">COUNSEL TO THE CLAIMANT</p>
                <p className="vg-margin-note">SALAKO &amp; ADENIYI · 18 AWLOWO ROAD, IKOYI, LAGOS</p>
            </div>
        </div>

        {/* Document footer meta */}
        <footer className="flex items-center justify-between border-t border-slate-200 mt-6 pt-3">
            <span className="font-mono text-2xs tracking-widest text-slate-400">DRAFT — FOR REVIEW</span>
            <span className="font-mono text-2xs tracking-widest text-slate-400">REV 3 · 12 OCT 2026</span>
        </footer>
    </article>
);

export const VegaHero: React.FC<{
    /** Pinned attribution string — owned by LandingPage.tsx. */
    eyebrow: string;
    /** The primary CTA node (Vega-styled button), passed in by LandingPage. */
    cta: React.ReactNode;
}> = ({ eyebrow, cta }) => (
    <section id="home" className="relative overflow-hidden" style={{ background: 'var(--color-paper)' }}>
        {/* Faint ruled texture — the ghost of a pleading sheet, not a grid */}
        <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
                backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgb(var(--color-slate-200) / 0.5) 31px, rgb(var(--color-slate-200) / 0.5) 32px)',
                maskImage: 'linear-gradient(to bottom, transparent, black 12%, black 82%, transparent)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 12%, black 82%, transparent)',
            }}
            aria-hidden="true"
        />

        <div className="relative z-10 pt-24 pb-20 sm:pb-24 px-4 sm:px-6 lg:pt-40 lg:pb-32">
            <div className="max-w-7xl mx-auto grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
                {/* Left — the title page */}
                <div className="lg:col-span-7">
                    {/* Attribution eyebrow — mono micro-label with an amber mark */}
                    <p className="flex items-center gap-2.5 font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-amber-deep mb-7">
                        <span className="inline-block w-1.5 h-1.5 bg-vega-amber" aria-hidden="true" />
                        {eyebrow}
                    </p>

                    {/* Headline — set like the title page of a law report */}
                    <h1
                        className="font-vega text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.08] tracking-[-0.01em] mb-0"
                        style={{ color: 'var(--color-ink)' }}
                    >
                        Practice Management
                        <br />
                        for{' '}
                        <span className="font-vega-italic font-medium text-vega-amber-deep">
                            Nigerian Law Firms
                        </span>
                    </h1>

                    {/* Thin amber rule */}
                    <div className="h-px w-16 bg-vega-amber mt-8 mb-8" aria-hidden="true" />

                    {/* Sub-copy — existing product copy, verbatim */}
                    <p className="text-lg max-w-xl leading-[1.7] text-slate-600 mb-10">
                        Case management, AI-assisted drafting, and billing that respects Nigerian court
                        practice — from intake to judgment, in one workspace.
                    </p>

                    {/* CTA — rendered by LandingPage (Vega: ink primary). Hidden on
                        mobile: the MobileStickyCTA bar carries the same action. */}
                    <div className="hidden md:flex items-center gap-4 mb-6">{cta}</div>

                    <p className="hidden md:block font-mono text-2xs tracking-widest text-slate-400">
                        NO CREDIT CARD · 30-DAY TRIAL · CANCEL ANYTIME
                    </p>
                </div>

                {/* Right — the document-forward composition */}
                <div className="lg:col-span-5 relative">
                    <VegaMotionDocument />
                    <p className="font-mono text-2xs tracking-widest text-slate-500 mt-5 text-center lg:text-left lg:pl-4">
                        EXHIBIT — MOTION ON NOTICE, DRAFTED IN DRAFTPRO
                    </p>
                </div>
            </div>
        </div>
    </section>
);
