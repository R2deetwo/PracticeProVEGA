import React, { useState } from 'react';
import { VegaAppShot } from './VegaAppShot';
import { AppShotLightbox, type LightboxGroup } from './AppShotLightbox';

/**
 * VegaSuite — R56: the Core Suite Showcase, one consolidated interactive hub.
 *
 * Owner direction: "Combine Matter Management, Smart Document/DraftPro
 * Drafting, Time & Billing, and Team Workflows into a single interactive
 * hub" — the R42 per-entry instrument index folds into ONE tabbed
 * surface. Four tabs, each carrying the REAL captures (R28 owner
 * direction, kept: "use stuff from the app so we are not showing false
 * images"), with a capture selector so a visitor can page the exhibits
 * without leaving the tab.
 *
 * The retired sections' substance rides along: DraftPro (VegaAIDrafting)
 * lives in the Documents tab, the Scale-of-Charges billing story in the
 * Billing tab, the team workspace (VegaTeam) in the Team tab. The
 * court-rules and regulatory depth moved to VegaWhyNigeria.
 *
 * Tabs activate on click AND hover (desktop). Indigo is the interactive
 * accent — tab indicators and active toggles (R56 palette).
 *
 * R69: every capture is click-to-expand into the AppShotLightbox — one
 * flat gallery across ALL tabs' exhibits (the owner: "seamlessly… click
 * through the different available app views… without having to close
 * the modal and click separate tabs on the main page"), with the
 * CollabPresence overlay on every standard-header capture (editor.jpg
 * opts out — the DraftPro toolbar is not the app header). The groups
 * are exported so the hero's dashboard capture joins the same gallery.
 */

type Shot = { src: string; alt: string; caption: string; label: string };

type SuiteTab = {
    id: string;
    label: string;
    title: string;
    desc: string;
    features: { title: string; detail: string }[];
    shots: Shot[];
};

const TABS: SuiteTab[] = [
    {
        id: 'matters',
        label: 'Matter Management',
        title: 'Every case, organised by court, jurisdiction and stage.',
        desc: 'Custom matter IDs, court rule templates, and documents, parties and deadlines linked in one workspace — from intake to resolution.',
        features: [
            {
                title: 'The matters ledger',
                detail: 'Every case with its client, stage and court — filterable, searchable, always current.',
            },
            {
                title: 'Deadlines by the right rules',
                detail: 'Filing and service windows computed under the matter\u2019s Civil Procedure Rules — 36 states and the FCT.',
            },
            {
                title: 'Contacts & parties',
                detail: 'Party grouping, witness tracking and counsel records, auto-linked to matters and documents.',
            },
        ],
        shots: [
            {
                src: '/assets/landing/app/matters-ledger.jpg',
                alt: "Vega matters ledger — every case with its client, stage and court",
                caption: 'LIVE CAPTURE — THE MATTERS LEDGER: EVERY CASE WITH ITS CLIENT, STAGE AND COURT',
                label: 'Ledger',
            },
            {
                src: '/assets/landing/app/tasks-status.jpg',
                alt: 'Vega task board — tasks grouped into status sections: To Do, In Progress, Done',
                caption: 'LIVE CAPTURE — THE TASK BOARD, GROUPED BY STATUS',
                label: 'Task board',
            },
            {
                src: '/assets/landing/app/tasks-flat.jpg',
                alt: 'Vega task board — the same tasks as a flat list',
                caption: 'LIVE CAPTURE — THE SAME BOARD AS A FLAT LIST',
                label: 'Flat list',
            },
            {
                src: '/assets/landing/app/contacts.jpg',
                alt: 'Vega contacts — a contact record with details, relationships and activity',
                caption: 'LIVE CAPTURE — CONTACTS & PARTIES: RELATIONSHIPS AND ACTIVITY, AUTO-LINKED TO MATTERS',
                label: 'Contacts',
            },
        ],
    },
    {
        id: 'documents',
        label: 'Smart Documents & DraftPro',
        title: 'Drafting built for Nigerian legal documents.',
        desc: 'A4 pagination, Nigerian legal fonts, placeholder guardrails that block printing until every blank is filled — and DraftPro\u2019s AI contract analysis and redlining built in.',
        features: [
            {
                title: 'The DraftPro editor',
                detail: 'Rich-text drafting with court-specific formatting — draft, save to a matter, print, or copy to Word.',
            },
            {
                title: 'AI contract analysis',
                detail: 'DraftPro reads every commercial agreement, flags the toxic clauses instantly, and redlines them to Nigerian-law-compliant drafts.',
            },
            {
                title: 'Document vault & research',
                detail: 'Version history, access controls, NDPA-compliant metadata and full-text search — plus a research studio with statute lookup.',
            },
        ],
        shots: [
            {
                src: '/assets/landing/app/editor.jpg',
                alt: 'DraftPro editor — a statement of claim under drafting, with the legal tools ribbon',
                caption: 'LIVE CAPTURE — THE DRAFTPRO EDITOR: A4 PAGINATION, LEGAL FONTS, [PLACEHOLDER] GUARDRAILS',
                label: 'Editor',
            },
            {
                src: '/assets/landing/app/documents.jpg',
                alt: 'Vega document vault — filings and drafts organized by matter',
                caption: 'LIVE CAPTURE — THE DOCUMENT VAULT: VERSION HISTORY, ACCESS CONTROLS, NDPA-COMPLIANT METADATA',
                label: 'Vault',
            },
            {
                src: '/assets/landing/app/research.jpg',
                alt: 'Vega Research Studio — notebooks, sources and the Argument Lab',
                caption: 'LIVE CAPTURE — THE RESEARCH STUDIO: NOTEBOOKS, SOURCES AND THE ARGUMENT LAB',
                label: 'Research',
            },
        ],
    },
    {
        id: 'billing',
        label: 'Time & Billing',
        title: 'Fees that follow the Remuneration Order.',
        desc: 'Naira-first invoicing with bank-transfer flows, land-documentation fee notes computed under the Remuneration Order 2023, and the firm\u2019s finances on one dashboard.',
        features: [
            {
                title: 'Invoicing & receipts',
                detail: 'NGN invoices with naira-first bank transfer flows — receipts reconciled against the ledger.',
            },
            {
                title: 'Billing on the Scale',
                detail: 'Land-documentation fee notes computed under the Remuneration Order 2023 — the right fee, every time.',
            },
            {
                title: 'The financial dashboard',
                detail: 'Retainer cycles, outstanding balances and the practice\u2019s earnings — visible at a glance.',
            },
        ],
        shots: [
            {
                src: '/assets/landing/app/billing.jpg',
                alt: 'Vega billing — invoices, receipts and the financial dashboard',
                caption: 'LIVE CAPTURE — BILLING: INVOICES, RECEIPTS AND THE FINANCIAL DASHBOARD',
                label: 'Billing',
            },
            {
                src: '/assets/landing/app/invoice-bank.jpg',
                alt: 'A Vega invoice with naira bank transfer details',
                caption: 'LIVE CAPTURE — AN INVOICE WITH NAIRA-FIRST BANK TRANSFER FLOWS',
                label: 'Invoice',
            },
            {
                src: '/assets/landing/app/analytics.jpg',
                alt: 'Vega analytics — the practice\u2019s earnings and matter load',
                caption: 'LIVE CAPTURE — ANALYTICS: THE PRACTICE\u2019S EARNINGS AND MATTER LOAD',
                label: 'Analytics',
            },
        ],
    },
    {
        id: 'team',
        label: 'Team Workflows',
        title: 'The whole team, one workspace.',
        desc: 'Everyone in at once — work assigned per counsel, the firm calendar kept current, and the file discusses itself in matter notes.',
        features: [
            {
                title: 'Work assigned per counsel',
                detail: 'Assignments, due dates and matter links ride every task row — nobody works from a stale list.',
            },
            {
                title: 'The firm calendar',
                detail: 'Hearings, filings and firm events in one diary — with automated reminders 7 · 3 · 1 days before each hearing.',
            },
            {
                title: 'The file discusses itself',
                detail: 'Matter notes keep the discussion with the matter — every entry time-stamped and attributed.',
            },
        ],
        shots: [
            {
                src: '/assets/landing/app/tasks-team.jpg',
                alt: 'Vega task board — work assigned across the team',
                caption: 'LIVE CAPTURE — THE TEAM TASK BOARD: WORK ASSIGNED PER COUNSEL',
                label: 'Tasks',
            },
            {
                src: '/assets/landing/app/calendar.jpg',
                alt: 'Vega calendar — hearings and firm events in one diary',
                caption: 'LIVE CAPTURE — THE FIRM CALENDAR: HEARINGS AND EVENTS IN ONE DIARY',
                label: 'Calendar',
            },
            {
                src: '/assets/landing/app/matter-notes.jpg',
                alt: 'Vega matter notes — the discussion kept with the matter',
                caption: 'LIVE CAPTURE — MATTER NOTES: THE FILE DISCUSSES ITSELF',
                label: 'Notes',
            },
        ],
    },
];

/** R69: the suite's exhibits as lightbox groups — also imported by
 *  VegaHero so the hero's dashboard capture rides the same gallery. */
export const SUITE_GROUPS: LightboxGroup[] = TABS.map((t) => ({
    id: t.id,
    label: t.label,
    exhibits: t.shots,
}));

export const VegaSuite: React.FC<{ onSignup?: () => void }> = ({ onSignup }) => {
    const [active, setActive] = useState(0);
    const [shot, setShot] = useState(0);
    // R69: the lightbox — a flat index across every tab's exhibits.
    const [lightbox, setLightbox] = useState<number | null>(null);

    const onActivate = (i: number) => {
        if (active !== i) {
            setActive(i);
            setShot(0);
        }
    };
    const tab = TABS[active];
    const exhibit = tab.shots[shot];
    const flatIndexOf = (tabIdx: number, shotIdx: number) =>
        TABS.slice(0, tabIdx).reduce((n, t) => n + t.shots.length, 0) + shotIdx;

    return (
        <section
            id="suite"
            aria-labelledby="vega-suite-heading"
            className="py-20 md:py-28 bg-slate-50 border-t border-slate-200/70"
        >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section head */}
                <div className="max-w-3xl mb-10 md:mb-14" data-vg-reveal>
                    <p className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 font-mono text-2xs font-medium uppercase tracking-[0.18em] text-indigo-700 mb-6">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true" />
                        The Core Suite
                    </p>
                    <h2
                        id="vega-suite-heading"
                        className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-tight text-slate-900 mb-5"
                    >
                        One workspace.{' '}
                        <span className="text-[#1E3A8A]">Every workflow.</span>
                    </h2>
                    <p className="text-base md:text-lg leading-[1.75] text-slate-600">
                        Four instruments, one system — every capture below is the shipping
                        app, not a mockup. Switch the tabs, page the exhibits.
                    </p>
                </div>

                {/* The tab bar — indigo active indicator; hover or click to switch. */}
                <div
                    className="flex flex-wrap gap-2 mb-8 md:mb-12"
                    role="tablist"
                    aria-label="The core suite"
                    data-vg-reveal
                >
                    {TABS.map((t, i) => (
                        <button
                            key={t.id}
                            role="tab"
                            id={`vega-tab-${t.id}`}
                            aria-selected={active === i}
                            aria-controls="vega-suite-panel"
                            onClick={() => onActivate(i)}
                            onMouseEnter={() => onActivate(i)}
                            className={`px-4 sm:px-5 py-2.5 rounded-full text-sm font-semibold border transition-all duration-200 active:scale-[0.98] ${
                                active === i
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-700'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* The panel — copy left, the live capture right. */}
                <div
                    id="vega-suite-panel"
                    role="tabpanel"
                    aria-labelledby={`vega-tab-${tab.id}`}
                    className="grid lg:grid-cols-2 gap-8 lg:gap-14 items-start"
                    data-vg-reveal
                >
                    <div>
                        <h3 className="font-display text-2xl md:text-3xl font-semibold leading-[1.2] tracking-tight text-slate-900 mb-4">
                            {tab.title}
                        </h3>
                        <p className="text-base leading-[1.75] text-slate-600 mb-8">{tab.desc}</p>
                        <ul className="space-y-5">
                            {tab.features.map((f) => (
                                <li key={f.title} className="flex gap-3.5">
                                    <span
                                        className="mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full bg-indigo-500"
                                        aria-hidden="true"
                                    />
                                    <span>
                                        <span className="block font-semibold text-slate-900 text-[15px] mb-1">
                                            {f.title}
                                        </span>
                                        <span className="block text-sm leading-[1.65] text-slate-600">
                                            {f.detail}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        {/* The capture selector — page the exhibits. */}
                        <div className="flex flex-wrap gap-2 mb-4" aria-label="Exhibits">
                            {tab.shots.map((s, i) => (
                                <button
                                    key={s.src}
                                    onClick={() => setShot(i)}
                                    aria-pressed={shot === i}
                                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 active:scale-[0.98] ${
                                        shot === i
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                            : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-700'
                                    }`}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                        <VegaAppShot
                            src={exhibit.src}
                            alt={exhibit.alt}
                            caption={exhibit.caption}
                            label={exhibit.label}
                            onSignup={onSignup}
                            onExpand={() => setLightbox(flatIndexOf(active, shot))}
                            collab={exhibit.src !== '/assets/landing/app/editor.jpg'}
                        />
                    </div>
                </div>
            </div>

            {/* R69: the expanded gallery — every exhibit of every tab one
                click away, prominently labeled, ←/→/Escape on the keys. */}
            {lightbox !== null && (
                <AppShotLightbox
                    groups={SUITE_GROUPS}
                    index={lightbox}
                    onNavigate={setLightbox}
                    onClose={() => setLightbox(null)}
                    onSignup={onSignup}
                />
            )}
        </section>
    );
};
