import React from 'react';
import { VegaAppShot } from './VegaAppShot';

/**
 * VegaWhyNigeria — R56: "Built for Nigerian practice", the differentiator
 * band. One section carries what used to be three deep-dives plus the ALOA
 * exhibit:
 *
 *   - VegaCourtRules  — "The firm diary that keeps itself": the Court
 *     Rules Agent computing deadlines under each state's Civil Procedure
 *     Rules, the chronology it keeps, the 7 · 3 · 1 reminder cadence.
 *   - VegaRegulatory  — "Stop manual statutory checks. Cross-reference
 *     every draft": the Compliance engine's exact section citations
 *     (CAMA 2020, Labour Act, FCCPA 2018, Lagos Tenancy Law).
 *   - VegaAIDrafting  — ALOA, the AI copilot: the running workspace and
 *     the draw-out, in real captures.
 *
 * Light cards on the white ground: delicate slate borders, refined
 * shadows, indigo interactive accents (R56 palette).
 */

const PILLARS = [
    {
        id: 'court-rules',
        title: 'The firm diary that keeps itself.',
        body: 'The Court Rules Agent calculates filing and service deadlines from the Civil Procedure Rules of the correct state — 36 states and the FCT — and keeps a provisional chronology per matter, updated as filings land and dates move.',
        points: [
            'Deadlines under the right state\u2019s rules — HCCPR 2019 and its siblings',
            'The chronology, kept per matter',
            'Reminders on the 7 · 3 · 1 cadence, by email and in-app',
        ],
    },
    {
        id: 'regulatory',
        title: 'Stop manual statutory checks. Cross-reference every draft.',
        body: 'The Regulatory Compliance Cross-Referencing engine audits every draft against the statutes it touches, with exact section citations — included with Enterprise, available as an add-on.',
        points: [
            'CAMA 2020 · Labour Act · FCCPA 2018 · Lagos Tenancy Law',
            'Statutory audits with exact section citations',
            'Included with Enterprise. Available as an add-on.',
        ],
    },
    {
        id: 'aloa',
        title: 'ALOA — the AI copilot, in the running workspace.',
        body: 'Powered by ALOA, built for Nigerian law: the deadline computer, the drafting studio and the research desk — one copilot that already knows the matter, locus classicus and all. Client data never trains a model.',
        points: [
            'The deadline computer',
            'The drafting studio',
            'The draw-out — ALOA thinking through a problem',
        ],
    },
];

export const VegaWhyNigeria: React.FC = () => (
    <section
        id="why-nigeria"
        aria-labelledby="vega-why-heading"
        className="py-20 md:py-28 bg-white border-t border-slate-200/70"
    >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section head */}
            <div className="max-w-3xl mb-10 md:mb-14" data-vg-reveal>
                <p className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 font-mono text-2xs font-medium uppercase tracking-[0.18em] text-indigo-700 mb-6">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
                    Built for Nigerian practice
                </p>
                <h2
                    id="vega-why-heading"
                    className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-tight text-slate-900 mb-5"
                >
                    The rules are Nigerian.{' '}
                    <span className="text-[#1E3A8A]">So is the system.</span>
                </h2>
                <p className="text-base md:text-lg leading-[1.75] text-slate-600">
                    Generic practice tools stop at matter lists. Vega carries the
                    statutes, the court rules and the naira — the instruments, in miniature.
                </p>
            </div>

            {/* The three pillars — light cards. */}
            <div className="grid md:grid-cols-3 gap-5 mb-14 md:mb-20" data-vg-reveal>
                {PILLARS.map((p) => (
                    <div
                        key={p.id}
                        className="rounded-2xl border border-slate-200/80 bg-white p-6 md:p-7 shadow-sm hover:shadow-md transition-shadow flex flex-col"
                    >
                        <h3 className="font-display text-xl font-semibold leading-[1.25] tracking-tight text-slate-900 mb-3">
                            {p.title}
                        </h3>
                        <p className="text-sm leading-[1.7] text-slate-600 mb-5">{p.body}</p>
                        <ul className="mt-auto space-y-2.5">
                            {p.points.map((pt) => (
                                <li key={pt} className="flex items-start gap-2.5 text-sm text-slate-700 leading-[1.6]">
                                    <span
                                        className="mt-[7px] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500"
                                        aria-hidden="true"
                                    />
                                    <span>{pt}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>

            {/* The ALOA exhibits — the running workspace and the draw-out. */}
            <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start" data-vg-reveal>
                <VegaAppShot
                    src="/assets/landing/app/vega-aloa.jpg"
                    alt="ALOA in the running workspace — the AI copilot at work inside a matter"
                    caption="ALOA IN THE RUNNING WORKSPACE"
                />
                <VegaAppShot
                    src="/assets/landing/app/vega-aloa-drawout.jpg"
                    alt="The draw-out — ALOA reasoning through a legal problem, step by step"
                    caption="THE DRAW-OUT"
                />
            </div>
        </div>
    </section>
);
