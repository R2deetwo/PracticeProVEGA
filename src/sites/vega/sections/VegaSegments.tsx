import React, { useState } from 'react';
import { Button } from '../../../components/ui';

/**
 * VegaSegments — /vega's practice-area band (the LawPavilion arrangement).
 *
 * LawPavilion's "Solutions rightly built for you" — For Lawyers / For
 * Judiciary / For Corporate / For Public / For Lawfirms — is a segment
 * switch that tailors the pitch to who is reading. Vega's equivalent is
 * the PRACTICE AREAS the Practice Profile Library actually ships blueprints
 * for (the same keys the OnboardingWizard collects): the tabs below name
 * real library entries, and every capability row is grounded in the
 * shipped behaviour of that entry — no invented segments.
 *
 * "The Warm Chambers" register (R26): LawPavilion's pill tab navigator —
 * the active entry is an orange PILL, the inactive entries are quiet
 * outline pills — with the panel below as a two-column spread: grotesk
 * framing copy left, mono-numbered capability rows right. Interactive
 * tabs use the ui/Button primitive (ADR-0004).
 */

type Segment = {
    key: string;
    tab: string;
    title: string;
    body: string;
    rows: Array<{ title: string; detail: string }>;
};

const SEGMENTS: Segment[] = [
    {
        key: 'litigation',
        tab: 'Civil Litigation',
        title: 'The litigation practice, diary and all.',
        body: 'Matters are organised by court and judicial division, deadlines are computed from the Civil Procedure Rules of the matter\u2019s court, and the assigned counsel is reminded 7, 3 and 1 days before every date. From writ to judgment, the diary keeps itself.',
        rows: [
            { title: 'Pleadings & motions', detail: 'DraftPro formats captions, parties\u2019 designations and prayers to Nigerian court practice — A4, ready to file.' },
            { title: 'Deadlines by the right rules', detail: 'Filing and service windows computed under the matter\u2019s Civil Procedure Rules — 36 states and the FCT.' },
            { title: 'The chronology', detail: 'A provisional timeline of every event and computed deadline, kept per matter — intake to judgment.' },
            { title: 'Reminders that fire', detail: '7 · 3 · 1 days before each hearing, to assigned counsel by email and in-app.' },
        ],
    },
    {
        key: 'corporate',
        tab: 'Corporate & Commercial',
        title: 'The transactional desk, kept in order.',
        body: 'Engagements run on structured matter workflows with document categories, checklists and event types preset for corporate work — so the drafts, board approvals and closings stay in one vault with version history, and the fee note builds itself on the Scale of Charges.',
        rows: [
            { title: 'Document vault', detail: 'Version history, access controls and full-text search across the firm\u2019s library — NDPA-compliant metadata.' },
            { title: 'Deal checklists', detail: 'Preset engagement checklists keep every closing item owned and dated — nothing slips between counsel.' },
            { title: 'Billing on the Scale', detail: 'Fee notes computed under the Remuneration Order 2023, with naira-first bank transfer flows.' },
            { title: 'Retainers that renew', detail: 'Retainer billing cycles and outstanding balances tracked per client on the financial dashboard.' },
        ],
    },
    {
        key: 'property',
        tab: 'Real Estate & Property',
        title: 'The property practice, ground rent to keys.',
        body: 'Conveyancing files carry their own workflows — searches, drafts, completions — while tenancy and land matters inherit the same court-rule calendaring as litigation. Real-estate attorneys coordinating portfolios can also cross into Komplete, the unified property workspace.',
        rows: [
            { title: 'Conveyancing workflows', detail: 'Preset stages from instruction through search, draft, completion and post-completion.' },
            { title: 'Perfection deadlines', detail: 'Governor\u2019s-consent and perfection steps tracked per file with dated reminders to the handling counsel.' },
            { title: 'Tenancy matters', detail: 'Landlord-tenant disputes inherit the court rules of the matter\u2019s court, like every litigation file.' },
            { title: 'Komplete, next door', detail: 'A unified workspace for real-estate attorneys managing tenancy portfolios at scale — one click away.' },
        ],
    },
    {
        key: 'general',
        tab: 'General Practice',
        title: 'The whole practice, one ledger.',
        body: 'Every matter type in one workspace — litigation, corporate, family, employment, IP — each carrying the workflow, checklists and event types its practice area expects. The firm diary is fed by every court in every matter, and the billable work lands in one ledger.',
        rows: [
            { title: 'Every matter type', detail: 'Civil, criminal, corporate, real estate, family, IP, employment, tax — one workspace, matter-linked.' },
            { title: 'One firm diary', detail: 'Every computed deadline from every matter, in one calendar — with the 7 · 3 · 1 reminder cadence.' },
            { title: 'One ledger', detail: 'Billable hours, court-aligned rates and retainer cycles across the whole practice, on the financial dashboard.' },
            { title: 'Clients self-serve', detail: 'The Client Portal carries milestones, documents and KYC — so the office phone rings less.' },
        ],
    },
];

export const VegaSegments: React.FC = () => {
    const [active, setActive] = useState(0);
    const seg = SEGMENTS[active];

    return (
        <section
            id="practice-areas"
            aria-labelledby="vega-segments-heading"
            className="py-20 md:py-28 border-t border-vega-night/10"
            style={{ background: 'var(--color-paper)' }}
        >
            <div className="container mx-auto px-4 sm:px-6 max-w-7xl" data-vg-reveal>
                {/* Section head */}
                <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                    Practice Areas — Built For How You Practise
                </p>
                <h2
                    id="vega-segments-heading"
                    className="font-vega text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5 max-w-3xl text-vega-night"
                >
                    Solutions rightly built for{' '}
                    <span className="font-vega-italic text-vega-gilt-bright">how you practise.</span>
                </h2>
                <p className="text-base md:text-lg leading-[1.7] text-slate-700 max-w-2xl mb-10 md:mb-14">
                    The same workspace, tailored by practice area — the blueprints
                    the OnboardingWizard applies when a firm picks its areas of law.
                </p>

                {/* The tab row (R26) — LawPavilion's pill navigator */}
                <div
                    role="tablist"
                    aria-label="Practice areas"
                    className="flex flex-wrap gap-2.5 mb-10 md:mb-14"
                >
                    {SEGMENTS.map((s, i) => {
                        const on = i === active;
                        return (
            <Button
                key={s.key}
                variant="bare"
                role="tab"
                id={`vg-tab-${s.key}`}
                aria-selected={on}
                aria-controls="vg-segment-panel"
                onClick={() => setActive(i)}
                className={`rounded-full px-5 py-2.5 text-sm font-bold tracking-tight transition-all duration-150 active:scale-[0.98] focus-visible:ring-vega-gilt ${
                    on ? 'bg-vega-gilt text-vega-parchment' : 'border border-vega-night/20 text-slate-700 hover:text-vega-night hover:border-vega-night/45'
                }`}
            >
                {s.tab}
            </Button>
                        );
                    })}
                </div>

                {/* The panel — two-column ruled spread */}
                <div
                    key={seg.key}
                    role="tabpanel"
                    id="vg-segment-panel"
                    aria-labelledby={`vg-tab-${seg.key}`}
                    className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start panel-in origin-top"
                >
                    {/* Left — the framing copy */}
                    <div className="lg:col-span-5">
                        <h3 className="font-vega text-2xl md:text-3xl font-semibold leading-[1.15] tracking-[-0.01em] text-vega-night mb-5">
                            {seg.title}
                        </h3>
                        <p className="text-base leading-[1.75] text-slate-700">{seg.body}</p>
                    </div>

                    {/* Right — the capability rows */}
                    <div className="lg:col-span-7">
                        <div className="border-t border-vega-night/10">
                            {seg.rows.map((row, i) => (
                                <div
                                    key={row.title}
                                    className="grid sm:grid-cols-12 gap-2 sm:gap-6 py-6 border-b border-vega-night/10"
                                >
                                    <div className="sm:col-span-1 flex items-baseline gap-3">
                                        <span className="font-mono text-2xs tracking-widest text-vega-gilt-bright">
                                            {String(i + 1).padStart(2, '0')}
                                        </span>
                                    </div>
                                    <h4 className="sm:col-span-4 font-vega text-lg font-semibold text-vega-night leading-snug">
                                        {row.title}
                                    </h4>
                                    <p className="sm:col-span-7 text-sm leading-[1.7] text-slate-700">
                                        {row.detail}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
