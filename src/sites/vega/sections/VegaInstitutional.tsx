import React from 'react';

/**
 * VegaInstitutional — "Institutional & Cross-Border Readiness"
 * positioning band (2026-11-22 owner spec).
 *
 * PLACEMENT: between the trust band (Why firms run on Vega) and pricing —
 * the "why invest in higher operational standards" beat right before the
 * plans are shown. It slots into the R56 six-band rhythm as a quiet
 * seventh band without touching its neighbours.
 *
 * TONE GUARDRAILS (owner spec):
 *   - Measured, composed, peer-to-peer. No hype, no urgency, no lecture —
 *     never imply the reader's current setup is inadequate.
 *   - The word "RPC" appears NOWHERE in this band (the professional-rules
 *     specifics live with the product surfaces — VegaTrust and ALOA's
 *     product knowledge — not in this positioning copy).
 *   - Core theme: ambitious firms invest in higher operational standards
 *     not merely to type faster, but to be READY — for demanding
 *     institutional clients, vendor/due-diligence expectations, and
 *     cross-border instructions.
 *
 * Design: the page's own tokens — white ground with the border-t hairline
 * (the why-nigeria/pricing family), muted mono eyebrow, navy headline
 * accent, three border-light softly-surfaced cards, generous padding,
 * reveal machinery (data-vg-reveal) with the standard stagger.
 */

const PILLARS: Array<{
    id: string;
    title: string;
    body: string;
    icon: React.ReactNode;
}> = [
    {
        id: 'due_diligence',
        title: 'Client & Cross-Border Due Diligence',
        body: 'Keep matter records, segregated client accounting, and access controls organized so external reviews and cross-border instructions never catch your team off guard.',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9 12l2 2 4-4" />
            </svg>
        ),
    },
    {
        id: 'matter_governance',
        title: 'Matter Governance Without Micromanagement',
        body: 'Give partners and team leads a clean, reliable view of active matters, milestones, and accountability without hovering over every desk.',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m4 10V11m4 6V9M5 21h14a1 1 0 001-1V4a1 1 0 00-1-1H5a1 1 0 00-1 1v16a1 1 0 001 1z" />
            </svg>
        ),
    },
    {
        id: 'data_privacy',
        title: 'Data Privacy & Operational Discipline',
        body: 'Pair structured data-privacy practices with disciplined day-to-day workflows that reflect how modern commercial practices operate.',
        icon: (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
        ),
    },
];

export const VegaInstitutional: React.FC = () => (
    <section
        id="institutional-readiness"
        aria-labelledby="vega-institutional-heading"
        className="py-20 md:py-28 bg-white border-t border-slate-200/70"
    >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section head — the muted register (no bright pill, no hype) */}
            <div className="max-w-3xl mb-10 md:mb-14" data-vg-reveal>
                <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 font-mono text-2xs font-medium uppercase tracking-[0.18em] text-slate-500 mb-6">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden="true" />
                    Institutional Readiness
                </p>
                <h2
                    id="vega-institutional-heading"
                    className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-tight text-slate-900 mb-5"
                >
                    Built for the standards your most demanding clients{' '}
                    <span className="text-[#1E3A8A]">already expect.</span>
                </h2>
                <p className="text-base md:text-lg leading-[1.75] text-slate-600">
                    Institutional-grade client accounting, matter governance, and data
                    privacy — ready before your next cross-border instruction asks
                    for it.
                </p>
            </div>

            {/* The three quiet pillars — border-light, softly surfaced,
                generous padding, no badges, no bullet walls. */}
            <div className="grid md:grid-cols-3 gap-5 lg:gap-6">
                {PILLARS.map((p, i) => (
                    <div
                        key={p.id}
                        data-vg-reveal
                        style={{ '--vg-d': `${90 + i * 70}ms` } as React.CSSProperties}
                        className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-6 md:p-8 transition-colors hover:border-slate-300"
                    >
                        <div className="w-10 h-10 rounded-lg border border-slate-200 bg-white text-slate-400 flex items-center justify-center mb-5" aria-hidden="true">
                            {p.icon}
                        </div>
                        <h3 className="text-base md:text-lg font-semibold leading-snug text-slate-900 mb-2.5">
                            {p.title}
                        </h3>
                        <p className="text-sm leading-[1.75] text-slate-600">
                            {p.body}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    </section>
);
