import React, { useState } from 'react';
import { Button } from '../../../components/ui';
import { VegaAppShot } from './VegaAppShot';

/**
 * VegaSuite — /vega's feature index, "The Reading Room" edition (R38).
 *
 * R38 (owner: "I wanted a redo of the page, not just changing the
 * colours"): the old trio of bands — the six-card catalogue grid, the
 * separate dark "workspace" gallery and the dark ruled MattersLedger —
 * is merged into ONE instrument, built for the daylight register:
 *
 *   A RULED INDEX of the six instruments on the ivory ground — mono
 *   numerals, serif titles, hairline rows, square corners, zero cards.
 *   Each entry expands INLINE (one open at a time) into a two-column
 *   spread: the capability entries ruled left, and a LIVE CAPTURE of the
 *   running product right (R28 owner direction: "use stuff from the app
 *   so we are not showing false images" — every capture is real, the
 *   caption states what was captured).
 *
 * Copy is the shipped Vega capability copy (honest marketing, P8).
 * Interactive rows use the ui/Button primitive (ADR-0004).
 */

type InstrumentEntry = {
    title: string;
    desc: string;
};

type Instrument = {
    num: string;
    title: string;
    line: string;
    shot?: {
        src: string;
        alt: string;
        caption: string;
    };
    entries: InstrumentEntry[];
};

const INSTRUMENTS: Instrument[] = [
    {
        num: '01',
        title: 'Matter Management',
        line: 'Cases organised by court, jurisdiction and matter type — documents, parties and deadlines in one workspace.',
        shot: {
            src: '/assets/landing/app/dashboard.jpg',
            alt: "Vega dashboard — active matters, invoices and today's calendar at a glance",
            caption: "LIVE CAPTURE — THE DASHBOARD: MATTERS, FEES AND TODAY'S DATES AT A GLANCE",
        },
        entries: [
            { title: 'The matters ledger', desc: 'Every case with its client, stage and court — custom matter IDs, court rule templates, and documents, parties and deadlines linked in one workspace.' },
            { title: 'Task board', desc: 'Kanban-style task management with assignments, due dates, priority levels and matter linking. Track every deliverable from intake to resolution.' },
            { title: 'Contacts & parties', desc: 'Structured contact management with party grouping, witness tracking and counsel records — auto-linked to matters and documents.' },
        ],
    },
    {
        num: '02',
        title: 'DraftPro Editor',
        line: 'A4 pagination, Nigerian legal fonts, and placeholder guardrails that block printing until every blank is filled.',
        shot: {
            src: '/assets/landing/app/documents.jpg',
            alt: 'Vega document vault — filings and drafts organized by matter',
            caption: 'LIVE CAPTURE — THE DOCUMENT VAULT',
        },
        entries: [
            { title: 'The editor', desc: 'Rich-text drafting with A4 pagination and Nigerian legal fonts. Placeholder guardrails block printing until every blank is filled — draft, save to a matter, print, or copy to Word.' },
            { title: 'Document vault', desc: "Secure document storage linked to every matter: version history, access controls, NDPA-compliant metadata, and full-text search across the firm's library." },
            { title: 'Research Studio', desc: 'Legal research workspace with jurisdiction-specific modules, statute lookup, and AI-assisted case analysis.' },
        ],
    },
    {
        num: '03',
        title: 'ALOA AI Copilot',
        line: 'Drafts, case summaries and precedent research — trained on Nigerian legal terminology and court rules.',
        shot: {
            src: '/assets/landing/app/aloa.jpg',
            alt: 'ALOA chat in the live Vega workspace — drafting and research carried in conversation',
            caption: 'LIVE CAPTURE — ALOA IN THE WORKSPACE',
        },
        entries: [
            { title: 'The copilot', desc: "Your firm's always-on legal intelligence — ask questions about your matters, get instant case summaries, analyse opposing counsel patterns, and research precedent across Nigerian courts." },
        ],
    },
    {
        num: '04',
        title: 'Court Rules Agent',
        line: 'Filing deadlines computed from the Civil Procedure Rules of the matter\u2019s court — 36 states and the FCT.',
        shot: {
            src: '/assets/landing/app/calendar.jpg',
            alt: "Vega calendar — hearings and statutory deadlines computed from the matter's court rules",
            caption: "LIVE CAPTURE — DEADLINES COMPUTED UNDER THE CIVIL PROCEDURE RULES OF THE MATTER'S COURT",
        },
        entries: [
            { title: 'Court date reminders', desc: "Automated reminders 7, 3 and 1 day(s) before each hearing, by email and in-app — fired from the matter's adjourned date to the assigned lawyer(s). Never miss a court date again." },
            { title: 'The chronology', desc: 'A provisional timeline of every event and computed deadline, kept per matter — intake to judgment.' },
        ],
    },
    {
        num: '05',
        title: 'Billing on the Scale',
        line: 'Land-documentation fee notes computed on the statutory Scale 4 (Remuneration Order 2023), with naira-first bank transfer flows.',
        shot: {
            src: '/assets/landing/app/billing.jpg',
            alt: 'Vega billing — invoices and fee notes in the live workspace',
            caption: 'LIVE CAPTURE — FEE NOTES IN THE WORKSPACE, COMPUTED ON THE SCALE OF CHARGES (REMUNERATION ORDER 2023)',
        },
        entries: [
            { title: 'Legal billing', desc: 'Generate professional invoices seamlessly. Track billable hours, apply court-aligned rates, and automate retainer billing cycles.' },
            { title: 'Financial dashboard', desc: 'Real-time revenue analytics, outstanding balances, and payment tracking. See which matters are profitable and which clients are overdue.' },
            { title: 'Bank transfer payments', desc: "Honest payment workflow with Nigerian bank account details displayed on invoices. No pretend card forms — clients transfer directly to your firm's account." },
        ],
    },
    {
        num: '06',
        title: 'Client Portal',
        line: 'Clients track milestones, upload documents and submit KYC at any hour — without calling your office.',
        shot: {
            src: '/assets/landing/work/vega-portal.jpg',
            alt: 'Vega client portal — milestones, documents and KYC in the resident portal',
            caption: 'LIVE CAPTURE — THE CLIENT PORTAL',
        },
        entries: [
            { title: 'The portal', desc: 'Self-service portal for clients to view matter milestones, upload and access documents, and submit KYC — at any hour, without calling your office.' },
        ],
    },
];

/** The plus/minus indicator — two hairlines, no icon font. */
const IndexToggle: React.FC<{ open: boolean }> = ({ open }) => (
    <span
        className="relative inline-block w-3 h-3 flex-shrink-0"
        aria-hidden="true"
    >
        <span className="absolute top-1/2 left-0 w-3 h-px bg-vega-gilt-bright -translate-y-1/2" />
        {!open && <span className="absolute left-1/2 top-0 h-3 w-px bg-vega-gilt-bright -translate-x-1/2" />}
    </span>
);

export const VegaSuite: React.FC = () => {
    // One instrument open at a time — the index behaves like a bound
    // volume's table of contents, not a grid of floating cards.
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <section
            id="suite"
            aria-labelledby="vega-suite-heading"
            className="py-20 md:py-28 border-t border-vega-night/10"
            style={{ background: 'var(--color-paper)' }}
        >
            <div className="container mx-auto px-4 sm:px-6 max-w-7xl" data-vg-reveal>
                {/* Section head */}
                <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                    The Suite — Six Instruments
                </p>
                <h2
                    id="vega-suite-heading"
                    className="font-vega text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5 max-w-3xl text-vega-night"
                >
                    One system,{' '}
                    <span className="font-vega-italic text-vega-gilt-bright">six instruments.</span>
                </h2>
                <p className="text-base md:text-lg leading-[1.7] text-slate-700 max-w-2xl mb-12 md:mb-16">
                    Everything a Nigerian practice runs on, in one workspace. Open an
                    instrument to read its entries and see the product at work — every
                    capture below is live from the running system, nothing staged.
                </p>

                {/* The ruled index — hairline-divided entries, square corners,
                    no cards, no shadows. */}
                <div className="border-t border-vega-night/10">
                    {INSTRUMENTS.map((ins, i) => {
                        const open = openIndex === i;
                        return (
                            <div key={ins.num} className="border-b border-vega-night/10">
                                <Button
                                    variant="bare"
                                    fullWidth
                                    aria-expanded={open}
                                    aria-controls={`vg-suite-panel-${i}`}
                                    onClick={() => setOpenIndex(open ? null : i)}
                                    className={`w-full flex items-baseline gap-4 sm:gap-6 py-6 px-2 sm:px-4 text-left transition-colors duration-150 hover:bg-vega-gilt/[0.04] active:bg-vega-gilt/[0.08] focus-visible:ring-vega-gilt ${
                                        open ? 'bg-vega-gilt/[0.04]' : ''
                                    }`}
                                >
                                    <span className="font-mono text-xs tracking-widest text-vega-gilt-bright flex-shrink-0">
                                        {ins.num}
                                    </span>
                                    <span className="font-vega text-xl sm:text-2xl font-semibold text-vega-night flex-1 min-w-0">
                                        {ins.title}
                                        <span className="block lg:hidden font-sans text-sm font-normal leading-[1.6] text-slate-600 mt-1.5">
                                            {ins.line}
                                        </span>
                                    </span>
                                    <span className="hidden lg:block flex-[1.4] text-sm leading-[1.6] text-slate-600 min-w-0">
                                        {ins.line}
                                    </span>
                                    <span className="font-mono text-2xs tracking-widest text-slate-600 hidden sm:inline flex-shrink-0">
                                        {ins.entries.length} {ins.entries.length === 1 ? 'ENTRY' : 'ENTRIES'}
                                    </span>
                                    <span className="flex-shrink-0 translate-y-[-2px]">
                                        <IndexToggle open={open} />
                                    </span>
                                </Button>

                                {open && ins.shot && (
                                    <div
                                        id={`vg-suite-panel-${i}`}
                                        className="px-2 sm:px-4 pb-10 pt-2 panel-in origin-top"
                                    >
                                        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                                            {/* Left — the capability entries, ruled */}
                                            <div className="lg:col-span-5 border-t border-vega-night/10">
                                                {ins.entries.map((e) => (
                                                    <div key={e.title} className="py-5 border-b border-vega-night/10">
                                                        <h3 className="font-vega text-lg font-semibold text-vega-night leading-snug mb-2">
                                                            {e.title}
                                                        </h3>
                                                        <p className="text-sm leading-[1.7] text-slate-700">
                                                            {e.desc}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                            {/* Right — the live capture, in the
                                                page's light sheet chrome */}
                                            <div className="lg:col-span-7">
                                                <VegaAppShot src={ins.shot.src} alt={ins.shot.alt} caption={ins.shot.caption} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <p className="font-mono text-2xs tracking-widest text-slate-600 mt-6">
                    INDEX — 6 INSTRUMENTS · EVERY CAPTURE LIVE FROM THE RUNNING PRODUCT
                </p>
            </div>
        </section>
    );
};
