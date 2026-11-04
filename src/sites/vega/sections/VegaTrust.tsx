import React from 'react';

/**
 * VegaTrust — R56: "Why firms run on Vega" + the practice segments, one
 * consolidated trust band (VegaCredentials + VegaSegments folded
 * together).
 *
 *   - The attestations (P8: verifiable statements only): drafted for
 *     Nigerian courts, deadlines by the right state's rules, client data
 *     never trains a model, NDPA 2023 / TLS 1.3 / encrypted at rest.
 *   - The segments: the litigation practice and the transactional desk —
 *     "Solutions rightly built for how you practise."
 *
 * Slate-50 ground, white cards, navy headline accents (R56 palette).
 */

const ATTESTATIONS = [
    {
        title: 'Drafted for Nigerian courts',
        body: 'Captions, parties\u2019 designations and prayers formatted to Nigerian court practice — A4, ready to file.',
    },
    {
        title: "Deadlines by the right state's rules",
        body: 'The Court Rules Agent calculates filing deadlines from the Civil Procedure Rules of the correct state, so the firm diary keeps itself.',
    },
    {
        title: 'Client data never trains a model',
        body: 'Your matters, drafts and client records stay yours — no client data is used to train any model.',
    },
    {
        title: 'Secured to the standard',
        body: 'NDPA 2023 Compliant · TLS 1.3 · Data Encrypted at Rest.',
    },
];

const SEGMENTS = [
    {
        id: 'litigation',
        title: 'The litigation practice, diary and all.',
        points: [
            'Pleadings & motions — DraftPro formats captions, parties\u2019 designations and prayers to Nigerian court practice.',
            'Deadlines by the right rules — filing and service windows under the matter\u2019s Civil Procedure Rules, 36 states and the FCT.',
            'The chronology — a provisional timeline of every event and computed deadline, kept per matter.',
            'Reminders that fire — 7 · 3 · 1 days before each hearing, to assigned counsel by email and in-app.',
        ],
    },
    {
        id: 'transactional',
        title: 'The transactional desk, kept in order.',
        points: [
            'Document vault — version history, access controls and full-text search, NDPA-compliant metadata.',
            'Deal checklists — preset engagement checklists keep every closing item owned and dated.',
            'Billing on the Scale — land-documentation fee notes computed under the Remuneration Order 2023.',
            'Retainers that renew — retainer billing cycles and outstanding balances tracked per client.',
        ],
    },
];

export const VegaTrust: React.FC = () => (
    <section
        id="practice-areas"
        aria-labelledby="vega-trust-heading"
        className="py-20 md:py-28 bg-slate-50 border-t border-slate-200/70"
    >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            {/* Section head */}
            <div className="max-w-3xl mb-10 md:mb-14" data-vg-reveal>
                <p className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 font-mono text-2xs font-medium uppercase tracking-[0.18em] text-indigo-700 mb-6">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
                    Why firms run on Vega
                </p>
                <h2
                    id="vega-trust-heading"
                    className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-tight text-slate-900 mb-5"
                >
                    Solutions rightly built for{' '}
                    <span className="text-[#1E3A8A]">how you practise.</span>
                </h2>
                <p className="text-base md:text-lg leading-[1.75] text-slate-600">
                    Verifiable statements only — every claim below is something the
                    shipping system does today.
                </p>
            </div>

            {/* The attestations — ruled rows on white cards. */}
            <div className="grid sm:grid-cols-2 gap-5 mb-14 md:mb-20" data-vg-reveal>
                {ATTESTATIONS.map((a) => (
                    <div
                        key={a.title}
                        className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
                    >
                        <h3 className="font-display text-lg font-semibold tracking-tight text-slate-900 mb-2">
                            {a.title}
                        </h3>
                        <p className="text-sm leading-[1.7] text-slate-600">{a.body}</p>
                    </div>
                ))}
            </div>

            {/* The segments — litigation and transactional. */}
            <div className="grid lg:grid-cols-2 gap-5" data-vg-reveal>
                {SEGMENTS.map((seg) => (
                    <div
                        key={seg.id}
                        className="rounded-2xl border border-slate-200/80 bg-white p-6 md:p-8 shadow-sm"
                    >
                        <h3 className="font-display text-xl md:text-2xl font-semibold tracking-tight text-slate-900 mb-6">
                            {seg.title}
                        </h3>
                        <ul className="space-y-4">
                            {seg.points.map((pt) => {
                                const [head, ...rest] = pt.split(' — ');
                                return (
                                    <li key={pt} className="flex gap-3">
                                        <span
                                            className="mt-[7px] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#1E3A8A]"
                                            aria-hidden="true"
                                        />
                                        <span className="text-sm leading-[1.65] text-slate-600">
                                            <span className="font-semibold text-slate-900">{head}</span>
                                            {rest.length ? ` — ${rest.join(' — ')}` : ''}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    </section>
);
