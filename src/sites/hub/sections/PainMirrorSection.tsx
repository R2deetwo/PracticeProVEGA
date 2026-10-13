/**
 * PainMirrorSection (Sound familiar?) — W14's mirror, restored.
 * Honest copy kept verbatim from the era.
 */
import React from 'react';
import { Button } from '../../../components/ui';
import { useScrollReveal } from '../hooks';
import { ChevronDownIcon, ChevronRightIcon } from '../../../constants';

// ─── SOUND FAMILIAR? (W14) — the bridge from "nice 3D" to "I need this" ────
// Owner direction: "I don't think people who want the service(s) know they
// need or want it." Before "What we do" can land as an answer, the page has
// to hold a mirror up and name the daily friction in the visitor's own
// words. Each row is a symptom any owner or manager will recognise — and
// its system counterpart. This is the section that converts "cool site"
// into "wait, that is MY business".

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

export const PainMirrorSection: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    const rowsRef = useScrollReveal<HTMLDivElement>();
    const closeRef = useScrollReveal<HTMLDivElement>();
    return (
        <section className="relative py-16 sm:py-24 overflow-hidden" style={{ background: '#0A101C' }}>
            {/* the same ink stage as the hero, carried through the marquee */}
            <div className="absolute -top-32 right-1/4 w-[34rem] h-[24rem] rounded-full bg-emerald-500/[0.07] blur-[130px] pointer-events-none" aria-hidden="true" />
            <div className="absolute -bottom-40 left-1/4 w-[36rem] h-[24rem] rounded-full bg-emerald-600/[0.08] blur-[130px] pointer-events-none" aria-hidden="true" />
            <div className="absolute inset-0 w7-grain pointer-events-none" aria-hidden="true" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
                <div ref={ref} className="w9-reveal text-center mb-10 md:mb-14 max-w-3xl mx-auto">
                    <p className="text-xs sm:text-xs font-bold uppercase tracking-[0.3em] mb-4 text-emerald-400/90">
                        Sound familiar?
                    </p>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white font-display" style={{ '--w9-d': '90ms' } as React.CSSProperties}>
                        Your business already runs on a system.
                        <br />
                        <span className="text-transparent bg-clip-text inline-block pb-1" style={{ backgroundImage: 'linear-gradient(to right, #6EE7B7, #34D399)' }}>
                            It&rsquo;s just not software.
                        </span>
                    </h2>
                    <p className="text-lg text-slate-400 mt-4 max-w-2xl mx-auto" style={{ '--w9-d': '180ms' } as React.CSSProperties}>
                        Spreadsheets, chat threads, memory and paper will get a business started —
                        then quietly hold it back. Recognise any of these?
                    </p>
                </div>

                <div ref={rowsRef} className="w9-reveal-stagger max-w-4xl mx-auto flex flex-col gap-3.5">
                    {PAIN_MIRROR.map((row, i) => (
                        <div
                            key={i}
                            className="group grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm px-5 py-4 md:px-7 md:py-5 transition-all duration-500 hover:border-white/[0.16] hover:bg-white/[0.045]"
                        >
                            {/* Today — the friction, in the visitor's words */}
                            <div className="flex items-start gap-3.5 md:justify-end md:text-right">
                                <span className="hidden md:block w-1.5 h-1.5 rounded-full bg-emerald-400/70 flex-shrink-0 translate-y-2" aria-hidden="true" />
                                <p className="text-sm leading-[1.7] text-slate-400 transition-colors duration-500 group-hover:text-slate-500">{row.today}</p>
                                <span className="md:hidden w-1.5 h-1.5 rounded-full bg-emerald-400/70 flex-shrink-0 translate-y-2" aria-hidden="true" />
                            </div>
                            {/* The turn */}
                            <span className="hidden md:flex items-center justify-center w-9 h-9 rounded-full border border-white/10 bg-white/[0.03] text-slate-500 group-hover:text-emerald-400 group-hover:border-emerald-500/30 transition-colors duration-500" aria-hidden="true">
                                <ChevronRightIcon className="w-4 h-4" />
                            </span>
                            <span className="flex md:hidden items-center justify-center w-9 h-9 rounded-full border border-white/10 bg-white/[0.03] text-slate-500" aria-hidden="true">
                                <ChevronDownIcon className="w-4 h-4" />
                            </span>
                            {/* On a system — the same day, running on software */}
                            <div className="flex items-start gap-3.5">
                                <span className="w-1.5 h-1.5 rotate-45 bg-emerald-400 flex-shrink-0 translate-y-2 transition-transform duration-500 group-hover:scale-150" aria-hidden="true" />
                                <p className="text-sm font-medium leading-[1.7] text-slate-200/90 transition-colors duration-500 group-hover:text-emerald-100">{row.system}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div ref={closeRef} className="w9-reveal text-center mt-12 md:mt-14 max-w-2xl mx-auto">
                    <p className="text-lg text-slate-300/95 leading-[1.75]">
                        If any of that is your business, you don&rsquo;t need more discipline or a
                        better spreadsheet. <span className="text-white font-semibold">You need a system</span> —
                        and building it is exactly what we do.
                    </p>
                    <div className="mt-7">
                        <Button
                            variant="bare"
                            onClick={onContactSales}
                            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl font-semibold text-sm text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 shadow-lg shadow-primary-500/40 hover:shadow-[0_0_40px_-6px_rgba(22,163,74,0.7)] transition-all duration-300 active:scale-[0.97]"
                        >
                            Tell us what runs your business today
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    );
};
