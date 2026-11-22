import React from 'react';

/**
 * VegaTrust — R56: "Why firms run on Vega" + the practice segments, one
 * consolidated trust band (VegaCredentials + VegaSegments folded
 * together).
 *
 *   - The attestations (P8): drafted for Nigerian courts, deadlines by
 *     the right state's rules, client data never trains a model,
 *     NDPA 2023-aligned safeguards / TLS 1.3 / encrypted at rest.
 *     (2026-11-22 claims audit: every attestation is stated as the
 *     system runs it — the reminder channel is WhatsApp, the security
 *     posture is "aligned" rather than a certification, and the
 *     no-training commitment is the one written into the Terms.)
 *   - The segments: the litigation practice and the transactional desk —
 *     "Solutions rightly built for how you practise."
 *
 * Slate-50 ground, white cards, navy headline accents (R56 palette).
 */

const ATTESTATIONS = [
    {
        title: 'Drafted for Nigerian courts',
        body: 'Captions, parties\u2019 designations and prayers formatted to Nigerian court practice — drafted A4, ready to print and file.',
    },
    {
        title: "Deadlines by the right state's rules",
        body: 'Record the service of a court process and the response windows are computed under the matter\u2019s court, the governing Civil Procedure Rules cited on every entry. Every state\u2019s rules carried in the registry — all 36 states and the FCT; built-in windows for the Lagos, FCT and Federal High Courts and the appellate periods, one manual entry for any other court.',
    },
    {
        title: 'Client data never trains a model',
        body: 'Your matters, drafts and client records are never used to train or fine-tune any model — a written commitment in our Terms of Service.',
    },
    {
        title: 'Secured to the standard',
        body: 'NDPA 2023-aligned safeguards · TLS 1.3 in transit · data encrypted at rest, enforced at the infrastructure layer.',
    },
];

const SEGMENTS = [
    {
        id: 'litigation',
        title: 'The litigation practice, diary and all.',
        points: [
            'Pleadings & motions — DraftPro formats captions, parties\u2019 designations and prayers to Nigerian court practice.',
            'Deadlines by the right rules — record the service of any process and the response windows are computed under the matter\u2019s Civil Procedure Rules, the rule cited on every entry.',
            'The chronology — a provisional timeline of every event and computed deadline, kept per matter.',
            'Reminders that fire — 7 · 3 · 1 days before each hearing, delivered to assigned counsel on WhatsApp (paid plans).',
        ],
    },
    {
        id: 'transactional',
        title: 'The transactional desk, kept in order.',
        points: [
            'Document vault — version history, access controls and full-text search across every filing.',
            'Deal checklists — preset engagement checklists keep every closing item owned and dated.',
            'Billing on the Scale — land-documentation fee notes computed under the Remuneration Order 2023, with the derivation shown on each fee note.',
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
            {/* Section head — R80: the eyebrow pill is gone (owner: "Get
                rid of the pill that says why firms run on Vega. Just get
                rid of that."), the heading leads. */}
            <div className="max-w-3xl mb-10 md:mb-14" data-vg-reveal>
                <h2
                    id="vega-trust-heading"
                    className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-tight text-slate-900 mb-5"
                >
                    Solutions rightly built for{' '}
                    <span className="text-[#1E3A8A]">how you practise.</span>
                </h2>
                <p className="text-base md:text-lg leading-[1.75] text-slate-600">
                    Every statement below describes a capability that is live
                    in Vega today — stated as the system runs it, with
                    nothing promised beyond that.
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
