import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui';
import { VegaAppShot } from './VegaAppShot';

/**
 * VegaSuite — /vega's feature index, the R42 per-entry edition.
 *
 * R38 set the shape: a ruled index of the six instruments on the ivory
 * ground, each expanding INLINE into a two-column spread — entries ruled
 * left, LIVE CAPTURE right (R28 owner direction: "use stuff from the app
 * so we are not showing false images").
 *
 * R42 (owner direction): "when I'm on the matters ledger it should show
 * the matters ledger." Every ENTRY now carries its own real capture —
 * moving the mouse across the entries (or tapping them) switches the
 * exhibit on the right; the first entry is the instrument's face. The
 * task board swaps between its two real layouts (status groups ⇄ flat
 * list) on a slow cycle so a visitor sees both without trying. DraftPro
 * opens on the EDITOR (not the vault); the Court Rules Agent opens on
 * the chronology it keeps; ALOA's line now says locus classicus.
 *
 * Interactive rows use the ui/Button primitive (ADR-0004).
 */

type EntryShot = {
    src: string;
    alt: string;
    caption: string;
};

type InstrumentEntry = {
    title: string;
    desc: string;
    shot?: EntryShot;
    /** Two real captures of the same surface, cycled slowly. */
    swap?: [EntryShot, EntryShot];
    /** Labels for the swap pair's segmented control. */
    swapLabels?: [string, string];
};

type Instrument = {
    num: string;
    title: string;
    line: string;
    entries: InstrumentEntry[];
};

const INSTRUMENTS: Instrument[] = [
    {
        num: '01',
        title: 'Matter Management',
        line: 'Cases organised by court, jurisdiction and matter type — documents, parties and deadlines in one workspace.',
        entries: [
            {
                title: 'The matters ledger',
                desc: 'Every case with its client, stage and court — custom matter IDs, court rule templates, and documents, parties and deadlines linked in one workspace.',
                shot: {
                    src: '/assets/landing/app/matters-ledger.jpg',
                    alt: "Vega matters ledger — every case with its client, stage and court",
                    caption: 'LIVE CAPTURE — THE MATTERS LEDGER: EVERY CASE WITH ITS CLIENT, STAGE AND COURT',
                },
            },
            {
                title: 'Task board',
                desc: 'Group tasks by status, priority or matter — or run the board flat. Assignments, due dates and matter links ride every row, from intake to resolution.',
                swapLabels: ['Status groups', 'Flat list'],
                swap: [
                    {
                        src: '/assets/landing/app/tasks-status.jpg',
                        alt: 'Vega task board — tasks grouped into status sections: To Do, In Progress, Done',
                        caption: 'LIVE CAPTURE — THE TASK BOARD, GROUPED BY STATUS',
                    },
                    {
                        src: '/assets/landing/app/tasks-flat.jpg',
                        alt: 'Vega task board — the same tasks as a flat list',
                        caption: 'LIVE CAPTURE — THE SAME BOARD AS A FLAT LIST',
                    },
                ],
            },
            {
                title: 'Contacts & parties',
                desc: 'Structured contact management with party grouping, witness tracking and counsel records — auto-linked to matters and documents.',
                shot: {
                    src: '/assets/landing/app/contacts.jpg',
                    alt: 'Vega contacts — a contact record with details, relationships and activity',
                    caption: 'LIVE CAPTURE — CONTACTS & PARTIES: RELATIONSHIPS AND ACTIVITY, AUTO-LINKED TO MATTERS',
                },
            },
        ],
    },
    {
        num: '02',
        title: 'DraftPro Editor',
        line: 'A4 pagination, Nigerian legal fonts, and placeholder guardrails that block printing until every blank is filled.',
        entries: [
            {
                title: 'The editor',
                desc: 'Rich-text drafting with A4 pagination and Nigerian legal fonts. Placeholder guardrails block printing until every blank is filled — draft, save to a matter, print, or copy to Word.',
                shot: {
                    src: '/assets/landing/app/editor.jpg',
                    alt: 'DraftPro editor — a statement of claim under drafting, with the legal tools ribbon',
                    caption: 'LIVE CAPTURE — THE DRAFTPRO EDITOR: A4 PAGINATION, LEGAL FONTS, [PLACEHOLDER] GUARDRAILS',
                },
            },
            {
                title: 'Document vault',
                desc: 'Secure document storage linked to every matter: version history, access controls, NDPA-compliant metadata, and full-text search across the firm\u2019s library. Some clients and some matters require that level of protection — the vault keeps it by default.',
                shot: {
                    src: '/assets/landing/app/documents.jpg',
                    alt: 'Vega document vault — filings and drafts organized by matter',
                    caption: 'LIVE CAPTURE — THE DOCUMENT VAULT: VERSION HISTORY, ACCESS CONTROLS, NDPA-COMPLIANT METADATA',
                },
            },
            {
                title: 'Research Studio',
                desc: 'Legal research workspace with jurisdiction-specific modules, statute lookup, and AI-assisted case analysis.',
                shot: {
                    src: '/assets/landing/app/research.jpg',
                    alt: 'Vega Research Studio — notebooks, sources and the Argument Lab',
                    caption: 'LIVE CAPTURE — THE RESEARCH STUDIO: NOTEBOOKS, SOURCES AND THE ARGUMENT LAB',
                },
            },
        ],
    },
    {
        num: '03',
        title: 'ALOA AI Copilot',
        line: 'Drafts, case summaries and precedent research — trained on Nigerian legal terminology, court rules and locus classicus.',
        entries: [
            {
                title: 'The copilot',
                desc: "Your firm's always-on legal intelligence — ask questions about your matters, get instant case summaries, analyse opposing counsel patterns, and research precedent across Nigerian courts.",
                shot: {
                    src: '/assets/landing/app/aloa.jpg',
                    alt: 'ALOA chat in the live Vega workspace — drafting and research carried in conversation',
                    caption: 'LIVE CAPTURE — ALOA IN THE WORKSPACE',
                },
            },
        ],
    },
    {
        num: '04',
        title: 'Court Rules Agent',
        line: 'Filing deadlines computed from the Civil Procedure Rules of the matter\u2019s court — 36 states and the FCT.',
        entries: [
            {
                title: 'The chronology',
                desc: 'A provisional timeline of every event and computed deadline, kept per matter and updated as filings land and dates move — the diary that writes itself from the rules.',
                shot: {
                    src: '/assets/landing/app/chronology.jpg',
                    alt: "A matter's Tasks & Events tab — statutory tasks and computed deadlines on a timeline",
                    caption: "LIVE CAPTURE — A MATTER'S TASKS & EVENTS: DEADLINES COMPUTED FROM THE COURT'S RULES",
                },
            },
            {
                title: 'Court date reminders',
                desc: "Automated reminders 7, 3 and 1 day(s) before each hearing, by email and in-app — fired from the matter's adjourned date to the assigned lawyer(s). Never miss a court date again.",
                shot: {
                    src: '/assets/landing/app/calendar.jpg',
                    alt: "Vega calendar — hearings and statutory deadlines computed from the matter's court rules",
                    caption: "LIVE CAPTURE — THE DIARY: HEARINGS AND STATUTORY DEADLINES AT A GLANCE",
                },
            },
        ],
    },
    {
        num: '05',
        title: 'Billing on the Scale',
        line: 'Land-documentation fee notes computed on the statutory Scale 4 (Remuneration Order 2023), with naira-first bank transfer flows.',
        entries: [
            {
                title: 'Legal billing',
                desc: 'Generate professional invoices seamlessly. Track billable hours, apply court-aligned rates, and automate retainer billing cycles.',
                shot: {
                    src: '/assets/landing/app/billing.jpg',
                    alt: 'Vega billing — invoices and fee notes in the live workspace',
                    caption: 'LIVE CAPTURE — FEE NOTES IN THE WORKSPACE, COMPUTED ON THE SCALE OF CHARGES (REMUNERATION ORDER 2023)',
                },
            },
            {
                title: 'Financial dashboard',
                desc: 'Real-time revenue analytics, outstanding balances, and payment tracking. See which matters are profitable and which clients are overdue.',
                shot: {
                    src: '/assets/landing/app/analytics.jpg',
                    alt: 'Vega analytics — the financial dashboard with revenue and profitability',
                    caption: 'LIVE CAPTURE — THE FINANCIAL DASHBOARD: REVENUE, BALANCES, PROFITABILITY',
                },
            },
            {
                title: 'Bank transfer payments',
                desc: "Honest payment workflow with Nigerian bank account details displayed on invoices. No pretend card forms — clients transfer directly to your firm's account.",
                shot: {
                    src: '/assets/landing/app/invoice-bank.jpg',
                    alt: 'A Vega invoice with payment details — bank name, account number and account name',
                    caption: 'LIVE CAPTURE — AN INVOICE WITH THE FIRM\u2019S BANK DETAILS: PAYMENT BY TRANSFER',
                },
            },
        ],
    },
    {
        num: '06',
        title: 'Client Portal',
        line: 'Clients track milestones, upload documents and submit KYC at any hour — without calling your office.',
        entries: [
            {
                title: 'The portal',
                desc: 'Self-service portal for clients to view matter milestones, upload and access documents, and submit KYC — at any hour, without calling your office.',
                shot: {
                    src: '/assets/landing/work/vega-portal.jpg',
                    alt: 'Vega client portal — milestones, documents and KYC in the resident portal',
                    caption: 'LIVE CAPTURE — THE CLIENT PORTAL',
                },
            },
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

/** One ruled entry row — hovering (or tapping) it makes its capture the
 *  exhibit. Looks and behaves like the index it is: quiet, clickable. */
const EntryRow: React.FC<{
    entry: InstrumentEntry;
    active: boolean;
    onActivate: () => void;
}> = ({ entry, active, onActivate }) => (
    <button
        type="button"
        onMouseEnter={onActivate}
        onFocus={onActivate}
        onClick={onActivate}
        aria-pressed={active}
        className={`w-full text-left py-5 border-b border-vega-night/10 border-l-2 transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vega-gilt ${
            active
                ? 'border-l-vega-gilt-bright bg-vega-gilt/[0.05] pl-4'
                : 'border-l-transparent hover:bg-vega-gilt/[0.03] pl-4'
        }`}
    >
        <h3 className={`font-vega text-lg font-semibold leading-snug mb-2 transition-colors duration-150 ${
            active ? 'text-vega-gilt-bright' : 'text-vega-night'
        }`}>
            {entry.title}
        </h3>
        <p className="text-sm leading-[1.7] text-slate-700">
            {entry.desc}
        </p>
    </button>
);

/** The exhibit panel — the active entry's real capture. Swap pairs (the
 *  task board's two real layouts) cycle slowly on their own; hovering
 *  the exhibit holds the current view so it can be studied, and the
 *  segmented chip both states which view is on and pins one on click. */
const ExhibitPanel: React.FC<{ entry: InstrumentEntry }> = ({ entry }) => {
    const isSwap = !!entry.swap;
    const [swapIdx, setSwapIdx] = useState(0);
    const [held, setHeld] = useState(false);
    const heldRef = useRef(false);
    heldRef.current = held;

    // Slow cycle between the two real layouts — paused while held.
    useEffect(() => {
        if (!isSwap || held) return;
        const id = window.setInterval(() => {
            setSwapIdx((i) => (i + 1) % 2);
        }, 3200);
        return () => window.clearInterval(id);
    }, [isSwap, held]);

    const active = isSwap ? entry.swap![swapIdx] : entry.shot!;
    if (!active) return null;

    return (
        <div>
            {isSwap && (
                <div className="flex items-center gap-2 mb-3" role="group" aria-label="Task board layouts">
                    {entry.swap!.map((s, i) => (
                        <button
                            key={s.src}
                            type="button"
                            onClick={() => { setSwapIdx(i); setHeld(true); }}
                            aria-pressed={swapIdx === i}
                            className={`font-mono text-2xs tracking-widest uppercase px-3 py-1.5 border transition-colors duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vega-gilt ${
                                swapIdx === i
                                    ? 'border-vega-gilt-bright text-vega-gilt-bright bg-vega-gilt/[0.06]'
                                    : 'border-vega-night/15 text-slate-500 hover:text-vega-night hover:border-vega-night/30'
                            }`}
                        >
                            {entry.swapLabels?.[i] ?? (i === 0 ? 'View A' : 'View B')}
                        </button>
                    ))}
                    <span className="font-mono text-2xs tracking-widest text-slate-400 ml-1 hidden sm:inline">
                        {held ? 'HELD — CLICK A CHIP TO SWITCH' : 'CYCLING — HOVER THE EXHIBIT TO HOLD'}
                    </span>
                </div>
            )}
            <div
                onMouseEnter={() => setHeld(true)}
                onMouseLeave={() => setHeld(false)}
                onFocus={() => setHeld(true)}
                onBlur={() => setHeld(false)}
            >
                <VegaAppShot src={active.src} alt={active.alt} caption={active.caption} />
            </div>
        </div>
    );
};

export const VegaSuite: React.FC = () => {
    // One instrument open at a time — the index behaves like a bound
    // volume's table of contents, not a grid of floating cards. The
    // active ENTRY (which capture is on exhibit) resets when the open
    // instrument changes.
    const [openIndex, setOpenIndex] = useState<number | null>(0);
    const [activeEntry, setActiveEntry] = useState(0);

    const openInstrument = (i: number) => {
        if (openIndex === i) {
            setOpenIndex(null);
        } else {
            setOpenIndex(i);
            setActiveEntry(0);
        }
    };

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
                    instrument, then move across its entries — the capture on the right
                    follows you. Every exhibit is live from the running system, nothing
                    staged.
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
                                    onClick={() => openInstrument(i)}
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

                                {open && (
                                    <div
                                        id={`vg-suite-panel-${i}`}
                                        className="px-2 sm:px-4 pb-10 pt-2 panel-in origin-top"
                                    >
                                        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                                            {/* Left — the capability entries, ruled.
                                                Hovering/tapping an entry puts
                                                ITS capture on exhibit right. */}
                                            <div className="lg:col-span-5 border-t border-vega-night/10">
                                                {ins.entries.map((e, ei) => (
                                                    <EntryRow
                                                        key={e.title}
                                                        entry={e}
                                                        active={activeEntry === ei}
                                                        onActivate={() => setActiveEntry(ei)}
                                                    />
                                                ))}
                                            </div>
                                            {/* Right — the live capture on exhibit,
                                                in the page's light sheet chrome */}
                                            <div className="lg:col-span-7">
                                                <ExhibitPanel entry={ins.entries[activeEntry]} />
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
