import React, { useState } from 'react';
import { ArrowsExpandIcon } from '../../../constants';
import { Button } from '../../../components/ui';
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
                title: 'ALOA Vox™ voice workspace',
                detail: 'Fast dictation for drafting, plus session capture that turns consultations and interviews into speaker-labelled transcripts, file notes, action lists and issue maps. Growth tier and above.',
            },
            {
                title: 'Deadlines by the right rules',
                detail: 'Record the service of any court process and the response windows are computed under the matter\u2019s Civil Procedure Rules — the governing rule cited on every entry.',
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
                caption: 'THE MATTERS LEDGER: EVERY CASE WITH ITS CLIENT, STAGE AND COURT',
                label: 'Ledger',
            },
            {
                src: '/assets/landing/app/tasks-status.jpg',
                alt: 'Vega task board — tasks grouped into status sections: To Do, In Progress, Done',
                caption: 'THE TASK BOARD, GROUPED BY STATUS',
                label: 'Task board',
            },
            {
                src: '/assets/landing/app/tasks-flat.jpg',
                alt: 'Vega task board — the same tasks as a flat list',
                caption: 'THE SAME BOARD AS A FLAT LIST',
                label: 'Flat list',
            },
            {
                src: '/assets/landing/app/contacts.jpg',
                alt: 'Vega contacts — a contact record with details, relationships and activity',
                caption: 'CONTACTS & PARTIES: RELATIONSHIPS AND ACTIVITY, AUTO-LINKED TO MATTERS',
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
                detail: 'Version history, access controls and full-text search across every filing — plus a research studio with statute lookup.',
            },
        ],
        shots: [
            {
                src: '/assets/landing/app/editor-r81.jpg',
                alt: 'DraftPro editor — a statement of claim under drafting, with the legal tools ribbon',
                caption: 'THE DRAFTPRO EDITOR: A4 PAGINATION, LEGAL FONTS, [PLACEHOLDER] GUARDRAILS',
                label: 'Editor',
            },
            {
                src: '/assets/landing/app/documents.jpg',
                alt: 'Vega document vault — filings and drafts organized by matter',
                caption: 'THE DOCUMENT VAULT: VERSION HISTORY, ACCESS CONTROLS, NDPA-COMPLIANT METADATA',
                label: 'Vault',
            },
            {
                src: '/assets/landing/app/research.jpg',
                alt: 'Vega Research Studio — notebooks, sources and the Argument Lab',
                caption: 'THE RESEARCH STUDIO: NOTEBOOKS, SOURCES AND THE ARGUMENT LAB',
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
                detail: 'Land-documentation fee notes computed under the Remuneration Order 2023, with the derivation shown on every fee note.',
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
                caption: 'BILLING: INVOICES, RECEIPTS AND THE FINANCIAL DASHBOARD',
                label: 'Billing',
            },
            {
                src: '/assets/landing/app/invoice-bank.jpg',
                alt: 'A Vega invoice with naira bank transfer details',
                caption: 'AN INVOICE WITH NAIRA-FIRST BANK TRANSFER FLOWS',
                label: 'Invoice',
            },
            {
                src: '/assets/landing/app/analytics.jpg',
                alt: 'Vega analytics — the practice\u2019s earnings and matter load',
                caption: 'ANALYTICS: THE PRACTICE\u2019S EARNINGS AND MATTER LOAD',
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
                detail: 'Hearings, filings and firm events in one diary — with automated WhatsApp reminders 7 · 3 · 1 days before each hearing.',
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
                caption: 'THE TEAM TASK BOARD: WORK ASSIGNED PER COUNSEL',
                label: 'Tasks',
            },
            {
                src: '/assets/landing/app/calendar.jpg',
                alt: 'Vega calendar — hearings and firm events in one diary',
                caption: 'THE FIRM CALENDAR: HEARINGS AND EVENTS IN ONE DIARY',
                label: 'Calendar',
            },
            {
                src: '/assets/landing/app/matter-notes.jpg',
                alt: 'Vega matter notes — the discussion kept with the matter',
                caption: 'MATTER NOTES: THE FILE DISCUSSES ITSELF',
                label: 'Notes',
            },
        ],
    },
];

/** R69: the suite's exhibits as lightbox groups — also imported by
 *  VegaHero so the hero's dashboard capture rides the same gallery.
 *  Kept for the suite's own tab vocabulary (tests pin it); the R78
 *  lightbox walks PAGE_GROUPS (the app's page order) instead. */
export const SUITE_GROUPS: LightboxGroup[] = TABS.map((t) => ({
    id: t.id,
    label: t.label,
    exhibits: t.shots,
}));

/** The hero's Dashboard exhibit — shared with PAGE_GROUPS. R80: the
 *  caption points at the interactive preview it now carries. */
const DASHBOARD_EXHIBIT = {
    src: '/assets/landing/app/dashboard.jpg',
    alt: 'Vega dashboard — the practice at a glance: matters, hearings, billing and tasks',
    caption: 'THE VEGA DASHBOARD — HOVER THE WORKSPACE, YOUR PROFILE, THE TEAM, ALOA, THE CARDS OR THE CALENDAR',
    label: 'Dashboard',
};

/** R78 (owner spec 2026-11-22): the multi-screen preview navigation in
 *  LOGICAL PAGE ORDER — "Overview / Dashboard, Matters, Tasks, Documents,
 *  Contacts, Financials" under a clear section label, rather than an
 *  arbitrary order or a raw image-swapping feel. The lightbox strip
 *  walks the app's own sidebar sequence, exhibits labeled by the page
 *  they are. Both the suite and the hero lightbox consume this one
 *  gallery. */
const shot = (tabId: string, src: string) => {
    const t = TABS.find((x) => x.id === tabId)!;
    return t.shots.find((s) => s.src === src)!;
};
export const PAGE_GROUPS: LightboxGroup[] = [
    {
        id: 'overview',
        label: 'Overview',
        exhibits: [DASHBOARD_EXHIBIT],
    },
    {
        id: 'matters',
        label: 'Matters',
        exhibits: [{ ...shot('matters', '/assets/landing/app/matters-ledger.jpg'), label: 'Matters' }],
    },
    {
        id: 'tasks',
        label: 'Tasks',
        exhibits: [
            { ...shot('matters', '/assets/landing/app/tasks-status.jpg'), label: 'Task board' },
            { ...shot('matters', '/assets/landing/app/tasks-flat.jpg'), label: 'Task list' },
            { ...shot('team', '/assets/landing/app/tasks-team.jpg'), label: 'Team tasks' },
        ],
    },
    {
        id: 'documents',
        label: 'Documents',
        exhibits: [
            { ...shot('documents', '/assets/landing/app/editor-r81.jpg'), label: 'DraftPro editor' },
            { ...shot('documents', '/assets/landing/app/documents.jpg'), label: 'Document vault' },
            { ...shot('documents', '/assets/landing/app/research.jpg'), label: 'Research' },
        ],
    },
    {
        id: 'contacts',
        label: 'Contacts',
        exhibits: [{ ...shot('matters', '/assets/landing/app/contacts.jpg'), label: 'Contacts' }],
    },
    {
        id: 'financials',
        label: 'Financials',
        exhibits: [
            { ...shot('billing', '/assets/landing/app/billing.jpg'), label: 'Billing' },
            { ...shot('billing', '/assets/landing/app/invoice-bank.jpg'), label: 'Invoice' },
            { ...shot('billing', '/assets/landing/app/analytics.jpg'), label: 'Analytics' },
        ],
    },
    {
        id: 'team',
        label: 'Team',
        exhibits: [
            { ...shot('team', '/assets/landing/app/calendar.jpg'), label: 'Calendar' },
            { ...shot('team', '/assets/landing/app/matter-notes.jpg'), label: 'Matter notes' },
        ],
    },
];

/** Flat index of an exhibit src in the page-ordered gallery — the
 *  lightbox open key for any capture. */
export function pageIndexOf(src: string): number {
    return PAGE_GROUPS.flatMap((g) => g.exhibits).findIndex((e) => e.src === src);
}

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
    // R78: the lightbox walks the page-ordered gallery — open at the
    // current exhibit's position in PAGE_GROUPS (by src, so the tab
    // vocabulary and the page vocabulary never drift apart).
    const openLightboxAt = (src: string) => setLightbox(Math.max(0, pageIndexOf(src)));

    return (
        <section
            id="suite"
            aria-labelledby="vega-suite-heading"
            className="py-20 md:py-28 bg-slate-50 border-t border-slate-200/70"
        >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section head — R80: the eyebrow pill is gone (owner:
                    "I want to try and get rid of those pills. They make it
                    too clear that it's an AI."), the heading leads. */}
                <div className="max-w-3xl mb-10 md:mb-14" data-vg-reveal>
                    <h2
                        id="vega-suite-heading"
                        className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-tight text-slate-900 mb-5"
                    >
                        One workspace.{' '}
                        <span className="text-[#1E3A8A]">Every workflow.</span>
                    </h2>
                    <p className="text-base md:text-lg leading-[1.75] text-slate-600">
                        Four instruments, one system — every capture below is the
                        live product, not a mockup. Switch the tabs, page the exhibits.
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
                    {/* R78 (owner spec): the See All pill alongside the
                        workflow tabs — one clean action that opens the full
                        app-view gallery in page order, at the CURRENT tab's
                        first exhibit. ui/Button (the ADR-0004 ratchet — no
                        new raw elements). */}
                    <Button
                        variant="bare"
                        onClick={() => openLightboxAt(exhibit.src)}
                        aria-label="See all app views — open the full gallery"
                        className="inline-flex items-center gap-1.5 px-4 sm:px-5 py-2.5 rounded-full text-sm font-semibold border border-indigo-200 bg-white text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50 transition-all duration-200 active:scale-[0.98]"
                    >
                        <ArrowsExpandIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        See All
                    </Button>
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
                            onExpand={() => openLightboxAt(exhibit.src)}
                            collab={exhibit.src !== '/assets/landing/app/editor-r81.jpg'}
                        />
                    </div>
                </div>
            </div>

            {/* R69: the expanded gallery — every exhibit of every tab one
                click away, prominently labeled, ←/→/Escape on the keys.
                R78: the walk is PAGE_GROUPS — the app's own page order
                (Overview → Matters → Tasks → Documents → Contacts →
                Financials → Team) under the visible "App views" label. */}
            {lightbox !== null && (
                <AppShotLightbox
                    groups={PAGE_GROUPS}
                    index={lightbox}
                    onNavigate={setLightbox}
                    onClose={() => setLightbox(null)}
                    onSignup={onSignup}
                />
            )}
        </section>
    );
};
