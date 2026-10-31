import React from 'react';
import { PrimaryButton, GhostButton } from '../../shared/ctas';
import { STATUTE_LIBRARY } from '../../../utils/statuteLibrary';

/**
 * VegaRegulatory — /vega's ADD-ON band (R49, Prompt 2).
 *
 * The dedicated value-prop block for the Regulatory & Compliance
 * Cross-Referencing Engine — the high-value Enterprise add-on (the R48
 * module). Copy per the brief, adapted to the Reading Room voice:
 * "Stop manual statutory checks. Automatically cross-reference every
 * draft against CAMA 2020, FCCPC guidelines, and Lagos State laws with
 * precise section citations."
 *
 * The provision list is THE SAME statute library the workspace runs
 * (src/utils/statuteLibrary.ts) — one source of truth; the marketing
 * page can never claim a citation the product cannot produce.
 *
 * Band V in the page's sequence (IV — Scale of Charges, then V here,
 * VI — Plans & Add-ons, VII — Credentials, VIII — Questions).
 */
export const VegaRegulatory: React.FC<{
    onContactSales: (source?: string) => void;
    onSignup: () => void;
}> = ({ onContactSales, onSignup }) => {
    const federal = STATUTE_LIBRARY.filter((s) => s.jurisdiction === 'federal');
    const lagos = STATUTE_LIBRARY.filter((s) => s.jurisdiction === 'lagos');

    return (
        <section
            id="regulatory"
            aria-labelledby="vega-regulatory-heading"
            className="py-20 md:py-28 border-t border-vega-night/10"
            style={{ background: 'var(--color-paper)' }}
        >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8" data-vg-reveal>
                {/* Section head */}
                <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                    V — Statutory Cross-Referencing
                </p>
                <h2
                    id="vega-regulatory-heading"
                    className="font-vega text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5 max-w-3xl text-vega-night"
                >
                    Stop manual statutory checks.{' '}
                    <span className="font-vega-italic text-vega-gilt-bright">Cross-reference every draft.</span>
                </h2>
                <p className="text-base md:text-lg leading-[1.7] text-slate-700 max-w-2xl mb-12 md:mb-16">
                    Automatically cross-reference every draft against CAMA 2020, FCCPC
                    guidelines, and Lagos State laws with precise section citations —
                    the audit log arrives attached to the clause that offends, with the
                    fix that cures it. “Violation of Section 4 of the Lagos Tenancy Law
                    2011” is a finding, not a research assignment.
                </p>

                {/* The provisions — ruled, not carded. The same library the
                    workspace runs: every claim here is a citation the product
                    can actually produce. */}
                <div className="max-w-6xl mb-16 md:mb-20">
                    <div className="grid md:grid-cols-2 gap-x-14">
                        <div>
                            <p className="font-mono text-2xs tracking-widest text-slate-600 border-b border-vega-night/10 pb-3 mb-2">
                                FEDERAL — CORPORATE · EMPLOYMENT · COMPETITION
                            </p>
                            <ol className="divide-y divide-vega-night/10">
                                {federal.map((s) => (
                                    <li key={s.id} className="py-6 first:pt-5 last:pb-0">
                                        <p className="font-vega text-lg font-semibold text-vega-night">
                                            {s.statute}
                                            <span className="font-mono text-xs tracking-widest text-vega-gilt-bright ml-2">s.{s.section}</span>
                                        </p>
                                        <p className="text-sm text-slate-700 leading-[1.65] mt-1.5">{s.summary}</p>
                                    </li>
                                ))}
                            </ol>
                        </div>
                        <div>
                            <p className="font-mono text-2xs tracking-widest text-slate-600 border-b border-vega-night/10 pb-3 mb-2">
                                LAGOS STATE — TENANCY
                            </p>
                            <ol className="divide-y divide-vega-night/10">
                                {lagos.map((s) => (
                                    <li key={s.id} className="py-6 first:pt-5 last:pb-0">
                                        <p className="font-vega text-lg font-semibold text-vega-night">
                                            {s.statute}
                                            <span className="font-mono text-xs tracking-widest text-vega-gilt-bright ml-2">s.{s.section}</span>
                                        </p>
                                        <p className="text-sm text-slate-700 leading-[1.65] mt-1.5">{s.summary}</p>
                                    </li>
                                ))}
                            </ol>
                            <p className="text-sm text-slate-600 leading-[1.65] mt-6 pl-4 border-l-2 border-vega-gilt/50">
                                Every finding states its severity — Violation or Advisory —
                                and the clause it attaches to. Advisories flag exposure that
                                needs a facts analysis; violations are wrong as drafted.
                            </p>
                        </div>
                    </div>
                </div>

                {/* The delineation — included with Enterprise, negotiated
                    add-on below it. No invented prices: Enterprise is Custom. */}
                <div className="max-w-6xl rounded-[14px] border border-vega-night/12 bg-vega-parchment p-6 sm:p-10 shadow-[0_14px_30px_-20px_rgb(42_33_24/0.30)]">
                    <div className="grid lg:grid-cols-12 gap-8 items-center">
                        <div className="lg:col-span-7 min-w-0">
                            <p className="font-mono text-2xs uppercase tracking-[0.25em] text-vega-gilt-bright mb-3">
                                The Regulatory & Compliance Cross-Referencing Engine
                            </p>
                            <h3 className="font-vega text-2xl md:text-3xl font-semibold leading-[1.15] tracking-[-0.01em] text-vega-night mb-3">
                                Included with Enterprise.{' '}
                                <span className="font-vega-italic text-vega-gilt-bright">
                                    Available as an add-on.
                                </span>
                            </h3>
                            <p className="text-sm md:text-base leading-[1.7] text-slate-700">
                                Enterprise firms run it out of the box; Growth and Pro firms
                                can have it activated per workspace — talk to us. Deep
                                regulatory auditing against Nigerian federal and Lagos State
                                statutes, with the citation on every finding.
                            </p>
                        </div>
                        <div className="lg:col-span-5 flex flex-wrap gap-3 lg:justify-end">
                            <PrimaryButton onClick={() => onContactSales('Vega Regulatory')} tone="vega" className="text-base px-7 py-3.5">
                                Talk to Sales
                            </PrimaryButton>
                            <GhostButton onClick={onSignup} tone="vega" className="text-base px-7 py-3.5">
                                Get Started
                            </GhostButton>
                        </div>
                    </div>
                </div>

                <p className="font-mono text-2xs tracking-widest text-slate-600 max-w-6xl mt-8 border-b border-vega-night/10 pb-5">
                    THE SAME STATUTE LIBRARY THE WORKSPACE RUNS — SEVEN PROVISIONS, VERIFIED, ONE SOURCE OF TRUTH. NOTHING ON THIS PAGE CLAIMS A CITATION THE PRODUCT CANNOT PRODUCE.
                </p>
            </div>
        </section>
    );
};
