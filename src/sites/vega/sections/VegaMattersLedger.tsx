import React, { useState } from 'react';
import { Button } from '../../../components/ui';

/**
 * VegaMattersLedger — /vega's replacement for the shared hover-expand
 * features card grid.
 *
 * "The Night Chambers" register: the features read as a RULED LEDGER
 * INDEX — the table of contents of a law report, not a card grid — set
 * on the night ground with gilt numerals and parchment serif titles.
 * Numbered mono category entries divided by hairlines; a category
 * expands INLINE (one open at a time) to reveal its matters as ruled
 * sub-rows (serif titles, justified descriptions).
 * Square corners only — no cards, no shadows, no hover-expand grid.
 *
 * Copy is the shipped Vega feature copy, verbatim. Zero hardcoded hexes;
 * interactive rows use the ui/Button primitive (ADR-0004).
 */

type MatterItem = {
    title: string;
    desc: string;
};

type MatterCategory = {
    category: string;
    items: MatterItem[];
};

const MATTERS_INDEX: MatterCategory[] = [
    {
        category: 'Case Management',
        items: [
            { title: 'Matter Management', desc: 'Organize cases by court, jurisdiction, and matter type. Link documents, parties, and deadlines in a unified workspace with custom matter IDs and court rule templates.' },
            { title: 'Court Date Reminders', desc: "Automated reminders 7, 3, and 1 day(s) before each hearing, delivered by email and in-app. Never miss a court date again — reminders fire automatically based on your matter's adjourned date, sent directly to the assigned lawyer(s)." },
            { title: 'Task Board', desc: 'Kanban-style task management with assignments, due dates, priority levels, and matter linking. Track every deliverable from intake to resolution.' },
            { title: 'Client Portal', desc: 'Self-service portal for clients to view matter milestones, upload and access documents, and submit KYC uploads.' },
            { title: 'Contacts & Parties', desc: 'Structured contact management with party grouping, witness tracking, and counsel records. Link contacts to matters and documents automatically.' },
        ],
    },
    {
        category: 'Legal Drafting',
        items: [
            { title: 'DraftPro Editor', desc: 'Rich-text editor with A4 pagination and Nigerian legal fonts. Placeholder guardrails block printing until every blank is filled — so you never accidentally send incomplete work. Draft, tweak, then save to a matter, print, or copy to Word.' },
            { title: 'ALOA AI Copilot', desc: "Your firm's always-on legal intelligence — ask questions about your matters, get instant case summaries, analyze opposing counsel patterns, research precedent across Nigerian courts, and surface insights from your document vault. Trained on Nigerian legal terminology and court rules." },
            { title: 'Document Vault', desc: "Secure document storage linked to every matter. Version history, access controls, NDPA-compliant metadata, and full-text search across your firm's document library." },
            { title: 'Research Studio', desc: 'Legal research workspace with jurisdiction-specific modules, statute lookup, and AI-assisted case analysis.' },
        ],
    },
    {
        category: 'Billing & Finance',
        items: [
            { title: 'Legal Billing', desc: 'Generate professional invoices seamlessly. Track billable hours, apply court-aligned rates, and automate retainer billing cycles.' },
            { title: 'Financial Dashboard', desc: 'Real-time revenue analytics, outstanding balances, and payment tracking. See which matters are profitable and which clients are overdue.' },
            { title: 'Bank Transfer Payments', desc: "Honest payment workflow with Nigerian bank account details displayed on invoices. No pretend card forms — clients transfer directly to your firm's account." },
        ],
    },
];

/** The plus/minus indicator — two hairlines, no icon font. */
const LedgerToggle: React.FC<{ open: boolean }> = ({ open }) => (
    <span
        className="relative inline-block w-3 h-3 flex-shrink-0"
        aria-hidden="true"
    >
        <span className="absolute top-1/2 left-0 w-3 h-px bg-vega-gilt-bright -translate-y-1/2" />
        {!open && <span className="absolute left-1/2 top-0 h-3 w-px bg-vega-gilt-bright -translate-x-1/2" />}
    </span>
);

export const VegaMattersLedger: React.FC = () => {
    // One category open at a time — the index behaves like a bound volume,
    // not a grid of floating cards. First entry open by default.
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <section
            id="features"
            aria-labelledby="vega-matters-heading"
            className="py-20 md:py-28"
            style={{ background: 'var(--color-paper)' }}
        >
            <div className="container mx-auto px-4 sm:px-6 max-w-7xl" data-vg-reveal>
                {/* Roman-numeral hairline section head — "I — Matters & Drafting" */}
                <p className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-gilt-bright mb-7">
                    I — Matters &amp; Drafting
                </p>
                <h2
                    id="vega-matters-heading"
                    className="font-vega text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5 max-w-3xl text-vega-parchment"
                >
                    Case Management &amp; Legal Intelligence
                </h2>
                <p className="text-base md:text-lg leading-[1.7] text-slate-400 max-w-2xl mb-12 md:mb-16">
                    From intake to resolution, Vega covers every stage of your
                    legal practice — drafting, research, billing, and client
                    collaboration.
                </p>

                {/* The ruled index — hairline-divided entries, square corners */}
                <div className="border-t border-white/10">
                    {MATTERS_INDEX.map((cat, i) => {
                        const open = openIndex === i;
                        return (
                            <div key={cat.category} className="border-b border-white/10">
                                <Button
                                    variant="bare"
                                    fullWidth
                                    aria-expanded={open}
                                    aria-controls={`vg-matters-panel-${i}`}
                                    onClick={() => setOpenIndex(open ? null : i)}
                                    className={`w-full flex items-baseline gap-4 sm:gap-6 py-6 px-2 sm:px-4 text-left transition-colors hover:bg-white/5 focus-visible:ring-vega-gilt ${
                                        open ? 'bg-white/5' : ''
                                    }`}
                                >
                                    <span className="font-mono text-xs tracking-widest text-vega-gilt-bright flex-shrink-0">
                                        {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <span className="font-vega text-xl sm:text-2xl font-semibold text-vega-parchment flex-1">
                                        {cat.category}
                                    </span>
                                    <span className="font-mono text-2xs tracking-widest text-slate-500 hidden sm:inline flex-shrink-0">
                                        {cat.items.length} ENTRIES
                                    </span>
                                    <span className="flex-shrink-0 translate-y-[-2px]">
                                        <LedgerToggle open={open} />
                                    </span>
                                </Button>

                                {open && (
                                    <ol
                                        id={`vg-matters-panel-${i}`}
                                        className="px-2 sm:px-4 pb-8"
                                    >
                                        {cat.items.map((item, j) => (
                                            <li
                                                key={item.title}
                                                className="grid sm:grid-cols-12 gap-2 sm:gap-6 py-5 border-t border-white/10 first:border-t-0"
                                            >
                                                <div className="sm:col-span-4 flex items-baseline gap-3">
                                                    <span className="font-mono text-2xs tracking-widest text-slate-500 flex-shrink-0">
                                                        {String(i + 1)}.{j + 1}
                                                    </span>
                                                    <h3 className="font-vega text-lg font-semibold text-vega-parchment leading-snug">
                                                        {item.title}
                                                    </h3>
                                                </div>
                                                <p className="sm:col-span-8 text-sm leading-[1.7] text-slate-400 text-left sm:text-justify">
                                                    {item.desc}
                                                </p>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                            </div>
                        );
                    })}
                </div>

                <p className="font-mono text-2xs tracking-widest text-slate-600 mt-6">
                    INDEX — 12 ENTRIES ACROSS 3 DIVISIONS OF THE PRACTICE
                </p>
            </div>
        </section>
    );
};
