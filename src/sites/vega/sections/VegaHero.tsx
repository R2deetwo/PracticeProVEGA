import React from 'react';

/**
 * VegaHero — "The Night Chambers" editorial hero for /vega (R22).
 *
 * Owner direction: the light paper page read "super bland" — Vega now
 * runs the dark register of a law library at night. The hero is the
 * chambers after hours:
 *
 *   - a near-black ground with a warm gilt pool where the exhibit sits
 *     (the desk lamp), a claret aura low-left, film grain and a vignette;
 *   - display Fraunces at law-report scale — much larger than the old
 *     page — in warm parchment, with ONE gilt-italic accent phrase (solid
 *     colour, never gradient/clip text);
 *   - ONE art-directed visual — the Motion on Notice rendered EXACTLY as
 *     a Lagos practitioner would file it (owner direction: "the demo
 *     drafts should be super accurate and it should draft as such
 *     naturally"): Times New Roman, full caption, prayers, numbered
 *     grounds, affidavit reference, execution block with the date in
 *     words — floating above the night ground on a deep shadow stack,
 *     with a claret notary seal roundel at its corner.
 *
 * The product's voice (mono microlabels) lives OUTSIDE the paper. The
 * document itself carries zero marketing chrome: it is the real thing,
 * drafted naturally.
 *
 * No green anywhere on this page. No gradient text — the serif carries
 * the emphasis. No raw form elements (ADR-0004): the CTA is passed in
 * as a render node by LandingPage. Reveals are opt-in
 * [data-vg-reveal] markers; LandingPage mounts the observer.
 */

/** The notary seal — a claret roundel stamped over the exhibit's corner. */
const VegaSeal: React.FC = () => (
    <svg
        className="vg-seal w-16 h-16 md:w-24 md:h-24"
        viewBox="0 0 100 100"
        aria-hidden="true"
        focusable="false"
    >
        <defs>
            <path
                id="vg-seal-ring"
                d="M 50,50 m -36,0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0"
            />
        </defs>
        <circle cx="50" cy="50" r="48.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="50" cy="50" r="25.5" fill="none" stroke="currentColor" strokeWidth="0.9" />
        <text fontSize="8" letterSpacing="3.2" fill="currentColor" style={{ fontFamily: 'var(--font-mono)' }}>
            <textPath href="#vg-seal-ring">PRACTICEPRO · VEGA · LAGOS ·</textPath>
        </text>
        {/* the section mark — the lawyer's glyph, in the serif face */}
        <text
            x="50"
            y="52"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="26"
            fill="currentColor"
            style={{ fontFamily: 'var(--font-vega-display)' }}
        >
            §
        </text>
    </svg>
);

const VegaMotionDocument: React.FC = () => (
    <article
        className="vg-doc vg-pleading px-5 py-6 sm:px-7 sm:py-8"
        aria-label="Exhibit — a motion on notice drafted in DraftPro, Vega's legal editor"
    >
        {/* Caption — the court's letterhead, centred, in the pleading face */}
        <header className="text-center">
            <p className="text-[11px] sm:text-xs leading-[1.65] font-bold uppercase text-slate-900">
                In the High Court of Lagos State
            </p>
            <p className="text-[11px] sm:text-xs leading-[1.65] uppercase text-slate-900">
                In the Ikeja Judicial Division
            </p>
            <p className="text-[11px] sm:text-xs leading-[1.65] uppercase text-slate-900">
                Holden at Ikeja
            </p>
            <p className="text-[11px] sm:text-xs leading-[1.65] uppercase text-slate-900 mt-2.5">
                Suit No: IKD/1287/2026
            </p>

            {/* Parties — name at left, role at right, as on the face of the motion */}
            <div className="mt-3.5 space-y-1.5">
                <p className="text-[11px] sm:text-xs uppercase text-slate-900">Between</p>
                <div className="flex justify-between items-baseline gap-3">
                    <span className="text-[11px] sm:text-xs font-bold uppercase text-slate-900 text-left">
                        Chioma Adaeze Okafor
                    </span>
                    <span className="text-[11px] sm:text-xs uppercase text-slate-900 whitespace-nowrap">
                        … Claimant
                    </span>
                </div>
                <p className="text-[11px] sm:text-xs uppercase text-slate-900">And</p>
                <div className="flex justify-between items-baseline gap-3">
                    <span className="text-[11px] sm:text-xs font-bold uppercase text-slate-900 text-left">
                        Meridian Logistics Limited
                    </span>
                    <span className="text-[11px] sm:text-xs uppercase text-slate-900 whitespace-nowrap">
                        … Defendant
                    </span>
                </div>
            </div>

            {/* Title — underlined, the instrument named */}
            <h3 className="text-[13px] sm:text-sm font-bold uppercase text-slate-900 mt-4 underline underline-offset-4 decoration-slate-400">
                Motion on Notice
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-900 mt-2">
                Dated this 9th day of October, 2026
            </p>
            <p className="text-[10px] sm:text-2xs leading-[1.7] text-slate-700 mt-3 max-w-[46ch] mx-auto">
                Brought pursuant to the High Court of Lagos State (Civil Procedure)
                Rules 2019 and the inherent jurisdiction of this Honourable Court
            </p>
        </header>

        {/* Prayers and grounds — numbered, on the ruled pleading body */}
        <div className="vg-doc__paper vg-doc__lines mt-5 pl-3 text-slate-800">
            <p className="vg-doc__line vg-doc__body text-[11px] sm:text-xs leading-[1.7] mb-3">
                BY THIS MOTION the Claimant prays this Honourable Court for:
            </p>
            <p className="vg-doc__line vg-doc__body text-[11px] sm:text-xs leading-[1.7] mb-2 pl-4">
                1. An order granting the Claimant leave to amend her Statement of
                Claim in the manner particularised in the Schedule hereto;
            </p>
            <p className="vg-doc__line vg-doc__body text-[11px] sm:text-xs leading-[1.7] mb-2 pl-4">
                2. An order deeming the amended Statement of Claim as properly
                filed and served; and
            </p>
            <p className="vg-doc__line vg-doc__body text-[11px] sm:text-xs leading-[1.7] mb-4 pl-4">
                3. Such further order(s) as this Honourable Court may deem fit to
                make in the circumstances of the case.
            </p>
            <p className="vg-doc__line vg-doc__body text-[11px] sm:text-xs leading-[1.7] mb-3">
                The grounds for this application are:
            </p>
            <p className="vg-doc__line vg-doc__body text-[11px] sm:text-xs leading-[1.7] mb-2 pl-4">
                1. The proposed amendment is necessary to plead facts which came
                to the Claimant&rsquo;s knowledge after the filing of the Statement of
                Claim, namely the Defendant&rsquo;s admission of the outstanding debt in
                its letter of 14 August 2026.
            </p>
            <p className="vg-doc__line vg-doc__body text-[11px] sm:text-xs leading-[1.7] mb-4 pl-4">
                2. The amendment is sought before the close of pleadings and will
                occasion no injustice to the Defendant that cannot be compensated
                in costs.
            </p>
            <p className="vg-doc__line vg-doc__body text-[11px] sm:text-xs leading-[1.7] mb-4">
                This application is supported by a 14-paragraph Affidavit deposed
                to by the Claimant, sworn to at the Registry of this Honourable
                Court and filed herewith, together with a Written Address.
            </p>

            {/* Execution block — dated at the foot, signed at the left */}
            <div className="mt-6 ml-1 sm:ml-4">
                <p className="text-[11px] sm:text-xs text-slate-800 mb-3">
                    Dated this 9th day of October, 2026
                </p>
                <div className="w-40 border-t border-slate-500" aria-hidden="true" />
                <p className="text-[11px] sm:text-xs font-bold text-slate-900 mt-1.5">
                    T. A. Salako (Mrs.), Esq.
                </p>
                <p className="vg-margin-note">Salako &amp; Adeniyi — Counsel to the Claimant</p>
                <p className="vg-margin-note">18, Awolowo Road, Ikoyi, Lagos</p>
                <p className="vg-margin-note mt-3">
                    Claimant&rsquo;s address for service: care of Salako &amp; Adeniyi, 18, Awolowo Road, Ikoyi, Lagos
                </p>
            </div>
        </div>

        {/* Document footer meta — the product's voice, outside the paper */}
        <footer className="flex items-center justify-between border-t border-slate-200 mt-5 pt-3">
            <span className="font-mono text-2xs tracking-widest text-slate-400">DRAFT — FOR REVIEW</span>
            <span className="font-mono text-2xs tracking-widest text-slate-400">ALOA-ASSISTED · REV 3 · 12 OCT 2026</span>
        </footer>
    </article>
);

export const VegaHero: React.FC<{
    /** Pinned attribution string — owned by LandingPage.tsx. */
    eyebrow: string;
    /** The primary CTA node (Vega-styled button), passed in by LandingPage. */
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
                <div className="lg:col-span-7">
                    {/* Attribution eyebrow — mono micro-label with the claret mark */}
                    <p
                        className="flex items-center gap-2.5 font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-6"
                        data-vg-reveal
                    >
                        <span className="inline-block w-1.5 h-1.5 bg-vega-claret-bright" aria-hidden="true" />
                        {eyebrow}
                    </p>

                    {/* Headline — law-report scale, THREE lines at 1440 (P2
                        B1: clamp 2.75rem→5.25rem; the exhibit column stays
                        right; H1 + sub + both CTAs fit the first viewport). */}
                    <h1
                        className="font-vega text-[2.75rem] sm:text-6xl lg:text-[clamp(2.75rem,6.2vw,5.25rem)] font-semibold leading-[1.04] tracking-[-0.015em] mb-0 text-vega-parchment"
                        data-vg-reveal
                        style={{ '--vg-d': '90ms' } as React.CSSProperties}
                    >
                        Practice
                        <br className="hidden lg:block" />
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

                    {/* Sub-copy — existing product copy, verbatim */}
                    <p
                        className="text-base md:text-lg max-w-xl leading-[1.65] text-slate-300 mb-8"
                        data-vg-reveal
                        style={{ '--vg-d': '210ms' } as React.CSSProperties}
                    >
                        Case management, AI-assisted drafting, and billing that respects Nigerian court
                        practice — from intake to judgment, in one workspace.
                    </p>

                    {/* CTA — rendered by LandingPage (Vega: brass on night).
                        P2 B1: visible on mobile too, with the exhibit below. */}
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

                {/* Right — the document under the lamp */}
                <div className="lg:col-span-5 relative" data-vg-reveal style={{ '--vg-d': '200ms' } as React.CSSProperties}>
                    <div className="relative rotate-[0.4deg]">
                        <VegaMotionDocument />
                        {/* The notary seal — stamped over the exhibit's corner */}
                        <div className="absolute -top-6 -right-3 sm:-right-5 md:-top-7 md:-right-6 rotate-[-12deg]">
                            <VegaSeal />
                        </div>
                    </div>
                    <p className="font-mono text-2xs tracking-widest text-slate-500 mt-6 text-center lg:text-left lg:pl-4">
                        EXHIBIT — MOTION ON NOTICE, DRAFTED IN DRAFTPRO · ILLUSTRATIVE
                    </p>
                </div>
            </div>
        </div>
    </section>
);
