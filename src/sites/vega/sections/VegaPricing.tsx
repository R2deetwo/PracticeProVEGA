import React from 'react';
import { PrimaryButton, GhostButton } from '../../shared/ctas';
import { VEGA_TIERS, formatTierPrice, type TierId } from '../../../constants/tiers';

/**
 * VegaPricing — /vega's pricing matrix (R49, Prompt 2).
 *
 * The restructured matrix, delineated exactly as the brief asks:
 *   - VEGA CORE + DRAFTPRO (STANDARD) — full practice management,
 *     billing, case tracking, and standard AI contract analysis, on
 *     every plan (Free → Growth → Pro).
 *   - THE REGULATORY COMPLIANCE ADD-ON / ENTERPRISE TIER — for firms
 *     requiring automated statutory cross-referencing and deep
 *     regulatory auditing.
 *
 * One source of truth: the cards render VEGA_TIERS from
 * src/constants/tiers.ts (the same data the in-app subscription page
 * renders) — prices can never drift between the landing page and the
 * product. Band VI of the page (V — Regulatory, VI here, VII —
 * Credentials, VIII — Questions).
 */
const ORDER: TierId[] = ['Core', 'Growth', 'Pro', 'Enterprise'];

const CARD_BASE =
    'rounded-[14px] border bg-vega-parchment p-6 flex flex-col relative overflow-hidden transition-shadow';
const CARD_PLAIN = `${CARD_BASE} border-vega-night/12`;
const CARD_RECO = `${CARD_BASE} border-vega-gilt/60 shadow-[0_18px_36px_-24px_rgb(159_83_45_/_0.35)]`;

export const VegaPricing: React.FC<{
    onContactSales: (source?: string) => void;
    onSignup: () => void;
}> = ({ onContactSales, onSignup }) => {
    const pro = VEGA_TIERS.Pro;

    return (
        <section
            id="pricing"
            aria-labelledby="vega-pricing-heading"
            className="py-20 md:py-28 border-t border-vega-night/10"
            style={{ background: 'var(--color-paper)' }}
        >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8" data-vg-reveal>
                {/* Section head */}
                <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                    VI — Plans & Add-ons
                </p>
                <h2
                    id="vega-pricing-heading"
                    className="font-vega text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5 max-w-3xl text-vega-night"
                >
                    One workspace.{' '}
                    <span className="font-vega-italic text-vega-gilt-bright">DraftPro standard.</span>
                </h2>
                <p className="text-base md:text-lg leading-[1.7] text-slate-700 max-w-2xl mb-12 md:mb-16">
                    Every plan carries the core: full practice management, billing, case
                    tracking — and standard AI contract analysis. The Regulatory
                    Cross-Referencing engine rides with Enterprise, or as an add-on.
                </p>

                {/* The matrix — from VEGA_TIERS (single source of truth) */}
                <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-12 md:mb-16 max-w-6xl">
                    {ORDER.map((id) => {
                        const t = VEGA_TIERS[id];
                        const { price, per } = formatTierPrice(t, 'monthly');
                        const isReco = !!t.recommended;
                        return (
                            <div key={id} className={isReco ? CARD_RECO : CARD_PLAIN}>
                                {isReco && (
                                    <span className="absolute top-0 right-0 font-mono text-2xs uppercase tracking-widest text-vega-parchment bg-vega-gilt-bright px-3 py-1.5 rounded-bl-lg">
                                        Recommended
                                    </span>
                                )}
                                <p className="font-vega text-xl font-semibold text-vega-night">{t.label}</p>
                                <p className="mt-3 mb-1">
                                    <span className="font-vega text-3xl font-semibold text-vega-night">{price}</span>
                                    {per && <span className="text-sm text-slate-600 ml-1.5">{per === 'Per Annum' ? '/yr' : per}</span>}
                                </p>
                                <p className="font-mono text-2xs tracking-widest text-slate-500 mb-5">
                                    {id === 'Enterprise' ? 'Custom — sized to the firm' : 'Annual saves 20%'}
                                </p>
                                <ul className="space-y-2.5">
                                    {t.features.map((f) => (
                                        <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700 leading-[1.6]">
                                            <span className="inline-block w-1.5 h-1.5 bg-vega-gilt-bright mt-[7px] flex-shrink-0" aria-hidden="true" />
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-auto pt-6">
                                    {id === 'Enterprise' ? (
                                        <GhostButton onClick={() => onContactSales('Vega Pricing')} tone="vega" className="w-full text-sm px-6 py-3">
                                            Talk to Sales
                                        </GhostButton>
                                    ) : (
                                        <PrimaryButton onClick={onSignup} tone="vega" className="w-full text-sm px-6 py-3">
                                            {id === 'Core' ? 'Start free' : `Choose ${t.label}`}
                                        </PrimaryButton>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* The delineation — the two rows of the restructured matrix */}
                <div className="max-w-6xl rounded-[14px] border border-vega-night/12 overflow-hidden shadow-[0_14px_30px_-20px_rgb(42_33_24/0.30)]">
                    <div className="grid md:grid-cols-2">
                        {/* Standard */}
                        <div className="bg-vega-parchment p-6 sm:p-8">
                            <p className="font-mono text-2xs uppercase tracking-[0.25em] text-vega-gilt-bright mb-3">
                                Standard — every plan
                            </p>
                            <h3 className="font-vega text-xl md:text-2xl font-semibold text-vega-night mb-3">
                                Vega Core + DraftPro™
                            </h3>
                            <p className="text-sm leading-[1.7] text-slate-700">
                                Full practice management, billing, case tracking — and standard
                                AI contract analysis. Defined-terms checks, missing-clause
                                checklists with Nigerian-law standard drafts, risk scoring and
                                redlines, on every workspace from the free tier up.
                            </p>
                        </div>
                        {/* The add-on */}
                        <div className="bg-vega-night p-6 sm:p-8 text-vega-parchment">
                            <p className="font-mono text-2xs uppercase tracking-[0.25em] text-vega-gilt-bright mb-3">
                                Add-on · Enterprise tier
                            </p>
                            <h3 className="font-vega text-xl md:text-2xl font-semibold mb-3">
                                Regulatory Compliance Cross-Referencing
                            </h3>
                            <p className="text-sm leading-[1.7] text-vega-parchment/85">
                                For firms requiring automated statutory cross-referencing and
                                deep regulatory auditing — CAMA 2020, the Labour Act, FCCPC
                                guidelines and Lagos State laws, with precise section citations
                                on every finding. Included with Enterprise; activated per
                                workspace below it.
                            </p>
                            <div className="mt-5">
                                <PrimaryButton onClick={() => onContactSales('Vega Pricing Add-on')} tone="vega" className="text-sm px-6 py-3">
                                    Talk to Sales
                                </PrimaryButton>
                            </div>
                        </div>
                    </div>
                </div>

                <p className="font-mono text-2xs tracking-widest text-slate-600 max-w-6xl mt-8 border-b border-vega-night/10 pb-5">
                    PRICES RENDER FROM src/constants/tiers.ts — THE SAME SOURCE THE IN-APP SUBSCRIPTION PAGE READS. {pro.monthlyPriceDisplay}/MO MONTHLY · {pro.annualPriceDisplay}/YR ANNUAL (SAVE 20%).
                </p>
            </div>
        </section>
    );
};
