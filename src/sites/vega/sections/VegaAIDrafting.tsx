import React from 'react';
import { VegaAppShot } from './VegaAppShot';

/**
 * VegaAIDrafting — /vega's AI band (R38, daylight edition).
 *
 * The AI story: ALOA's live capture (a real conversation in the
 * workspace) beside a hairline-ruled index of the three capabilities —
 * drafting & analysis, the PII Shield, and firm-grade isolation. R38:
 * the band leaves the old raised-ink register and runs on the ivory
 * ground like the rest of the page — one system, one light. Ruled
 * entries, mono numerals, serif titles; not three floating cards.
 *
 * Copy is the shipped ALOA copy, verbatim. Presentational only — zero
 * buttons (ADR-0004), zero hardcoded hexes.
 */

const ALOA_CAPABILITIES = [
    {
        title: 'Legal Drafting & Analysis',
        body: "Draft writs, affidavits, and motions with Nigerian court-specific formatting. Analyze opposing counsel's arguments, identify weaknesses, and research locus classicus across jurisdictions.",
        features: ['DraftPro editor with A4 pagination', 'Nigerian citation formats (NWLR, NSC)', 'Cross-jurisdictional analysis with caveats'],
    },
    {
        title: 'PII Shield',
        body: 'Client names, phone numbers, NIN, BVN, and bank accounts are automatically stripped before AI processing. Your client data never trains external models. NDPA 2023 compliant.',
        features: ['Email & phone stripping', 'NIN/BVN/credit card detection', 'Nigerian bank account masking'],
    },
    {
        title: 'Firm-Grade Security',
        body: "Your firm's data is fully isolated from every other organization on the platform. AI queries only access your matters, your documents, and your clients. No cross-organization data leakage — ever.",
        features: ['Complete data isolation between organizations', 'Matter-level access control', 'Full audit trail on all AI activity'],
    },
];

export const VegaAIDrafting: React.FC = () => (
    <section
        id="ai-capabilities"
        aria-labelledby="vega-ai-heading"
        className="py-20 md:py-28 border-t border-vega-night/10"
        style={{ background: 'var(--color-paper)' }}
    >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8" data-vg-reveal>
            {/* Section head */}
            <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                II — Drafting Intelligence
            </p>
            <h2
                id="vega-ai-heading"
                className="font-vega text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5 max-w-3xl text-vega-night"
            >
                Powered by ALOA. Built for{' '}
                <span className="font-vega-italic text-vega-gilt-bright">Nigerian law.</span>
            </h2>
            <p className="text-base md:text-lg leading-[1.7] text-slate-700 max-w-2xl mb-12 md:mb-16">
                Your AI legal copilot drafts documents, researches precedents,
                and analyzes cases — with privacy-first architecture that keeps
                client data safe.
            </p>

            <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start max-w-6xl">
                {/* The exhibit — a LIVE CAPTURE of ALOA in the real
                    workspace (owner: "use stuff from the app so we are
                    not showing false images"). */}
                <VegaAppShot
                    src="/assets/landing/app/aloa.jpg"
                    alt="ALOA chat in the live Vega workspace — drafting and research carried in conversation"
                    caption="LIVE CAPTURE — ALOA IN THE WORKSPACE"
                />

                {/* The capability index — ruled, not carded */}
                <div>
                    <p className="font-mono text-2xs tracking-widest text-slate-600 border-b border-vega-night/10 pb-3 mb-2">
                        ALOA — ADVANCED LEGAL OFFICE ASSISTANT
                    </p>
                    <ol className="divide-y divide-vega-night/10">
                        {ALOA_CAPABILITIES.map((cap, i) => (
                            <li key={cap.title} className="py-7 first:pt-6 last:pb-0">
                                <div className="flex items-baseline gap-4 mb-3">
                                    <span className="font-mono text-xs tracking-widest text-vega-gilt-bright">
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <h3 className="font-vega text-xl font-semibold text-vega-night">
                                        {cap.title}
                                    </h3>
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed mb-4 pl-8">
                                    {cap.body}
                                </p>
                                <ul className="space-y-2 pl-8">
                                    {cap.features.map((f) => (
                                        <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700">
                                            <span className="inline-block w-1.5 h-1.5 bg-vega-gilt-bright mt-[7px] flex-shrink-0" aria-hidden="true" />
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </div>
    </section>
);
