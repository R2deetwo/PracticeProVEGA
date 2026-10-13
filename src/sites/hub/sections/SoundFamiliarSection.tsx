import React from 'react';
import { useScrollReveal } from '../hooks';

/**
 * SoundFamiliarSection (P1 C5) — "04 — SOUND FAMILIAR". The dark pain
 * band is retired; the mirror is now a two-column ruled list on the hub
 * paper — "Today" and "With a system", five rows, existing PAIN_MIRROR
 * copy verbatim. The rule between the columns is the turn.
 */
const PAIN_MIRROR: Array<{ today: string; system: string }> = [
    {
        today: 'Orders and requests arrive by WhatsApp, SMS and walk-in — nobody sees all of them in one place.',
        system: 'Every order lands in one queue — assigned, tracked, never lost.',
    },
    {
        today: "Who has paid, who still owes, who renewed — it lives in somebody's head and a tattered notebook.",
        system: 'Balances, receipts and reminders computed and sent without anyone chasing.',
    },
    {
        today: 'Customer records scattered across three phones, two notebooks and a Gmail account.',
        system: 'One record per customer — history, documents, payments and messages together.',
    },
    {
        today: 'Month-end means days of reconciling bank alerts with hand-written receipts.',
        system: 'Reconciliation that happens as the money lands — reports one click away.',
    },
    {
        today: 'The only person who understands the whole process is on leave — and everything stalls.',
        system: 'The system holds the process, so any member of the team can run the day.',
    },
];

export const SoundFamiliarSection: React.FC<{
    onContactSales: () => void;
}> = ({ onContactSales }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    return (
        <section id="soundFamiliar" className="hub-section" style={{ background: 'rgb(var(--hub-paper))' }}>
            <div className="hub-container">
                <p className="hub-label mb-8">04 — SOUND FAMILIAR</p>
                <h2 className="hub-display text-3xl md:text-4xl mb-4 max-w-[24ch]">
                    Your business already runs on a system. It&rsquo;s just not software.
                </h2>
                <p className="text-base leading-[1.7] mb-10 max-w-2xl" style={{ color: 'rgb(var(--hub-mute))' }}>
                    Spreadsheets, chat threads, memory and paper will get a business
                    started — then quietly hold it back. Recognise any of these?
                </p>

                <div ref={ref} className="hub-reveal">
                    {/* Column heads */}
                    <div
                        className="hidden md:grid grid-cols-2 gap-8 pb-3"
                        style={{ borderBottom: '1px solid rgb(var(--hub-ink))' }}
                    >
                        <p className="hub-label">Today</p>
                        <p className="hub-label">With a system</p>
                    </div>
                    {PAIN_MIRROR.map((row, i) => (
                        <div
                            key={i}
                            className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 py-5"
                            style={{ borderBottom: '1px solid rgb(var(--hub-rule))' }}
                        >
                            <p className="text-sm leading-[1.7]" style={{ color: 'rgb(var(--hub-mute))' }}>
                                {row.today}
                            </p>
                            <p className="text-sm font-medium leading-[1.7]" style={{ color: 'rgb(var(--hub-ink))' }}>
                                {row.system}
                            </p>
                        </div>
                    ))}
                </div>

                <p className="text-base leading-[1.75] mt-10 max-w-2xl" style={{ color: 'rgb(var(--hub-ink))' }}>
                    If any of that is your business, you don&rsquo;t need more discipline or a
                    better spreadsheet. <strong>You need a system</strong> — and building it
                    is exactly what we do.
                </p>
                <div className="mt-6">
                    <button onClick={onContactSales} className="hub-cta">
                        Tell us what runs your business today
                    </button>
                </div>
            </div>
        </section>
    );
};
