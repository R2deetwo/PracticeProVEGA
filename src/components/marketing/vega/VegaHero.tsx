import React from 'react';

/**
 * VegaHero — "The Chambers Standard" editorial hero for /vega.
 *
 * A left-aligned serif headline set like the title page of a law report,
 * a thin claret rule, and ONE art-directed visual — a Motion on Notice
 * rendered EXACTLY as a Lagos practitioner would file it (owner
 * direction: "the demo drafts should be super accurate and it should
 * draft as such naturally"):
 *
 *   - set in Times New Roman — the face Nigerian courts require;
 *   - full caption: court, judicial division, holden-at, suit number,
 *     parties with right-aligned roles (LIMITED, not LTD);
 *   - the enabling clause citing the High Court of Lagos State (Civil
 *     Procedure) Rules 2019 + inherent jurisdiction;
 *   - "BY THIS MOTION … prays this Honourable Court for:" with numbered
 *     reliefs, numbered grounds, affidavit reference;
 *   - execution block — counsel signature line, firm, address for
 *     service — with the date in words at the foot, as filed.
 *
 * The product's voice (mono microlabels) lives OUTSIDE the paper — the
 * exhibit caption and the rev footer. The document itself carries zero
 * marketing chrome: it is the real thing, drafted naturally.
 *
 * No green anywhere on this page. No gradient text — the serif carries
 * the emphasis. No raw form elements (ADR-0004): the CTA is passed in
 * as a render node by LandingPage.
 */

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
                    {/* Attribution eyebrow — mono micro-label with a claret mark */}
                    <p className="flex items-center gap-2.5 font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-claret-deep mb-7">
                        <span className="inline-block w-1.5 h-1.5 bg-vega-claret" aria-hidden="true" />
                        {eyebrow}
                    </p>

                    {/* Headline — set like the title page of a law report.
                        All ink, no accent span, no gradient word: the serif
                        carries the emphasis; the claret rule beneath is the
                        only accent this page's headline gets. */}
                    <h1
                        className="font-vega text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.08] tracking-[-0.01em] mb-0"
                        style={{ color: 'var(--color-ink)' }}
                    >
                        Practice Management
                        <br />
                        for Nigerian Law Firms
                    </h1>

                    {/* Thin claret rule */}
                    <div className="h-px w-16 bg-vega-claret mt-8 mb-8" aria-hidden="true" />

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
