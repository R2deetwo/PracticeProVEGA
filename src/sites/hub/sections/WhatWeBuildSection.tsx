import React from 'react';
import { useScrollReveal } from '../hooks';

/**
 * WhatWeBuildSection (P1 C3) — "02 — WHAT WE BUILD". A ruled index table,
 * seven rows: number, capability name, one-sentence description, and the
 * systems it already runs in. Copy condensed from the existing WHAT_WE_DO
 * bodies (first sentence of each); no cards, no icons, no isometric
 * shapes — the table IS the section.
 */
const WHAT_WE_BUILD = [
    {
        capability: 'Custom business systems',
        sentence: 'A system shaped around your operations, not your operations reshaped around software.',
        runsIn: 'Kozy Care',
    },
    {
        capability: 'Custom integrations',
        sentence: 'The tools you already use — WhatsApp, SMS, Paystack, email, calendars — wired into one workflow.',
        runsIn: 'Vega · Atrium · Kozy Care',
    },
    {
        capability: 'Portals your customers actually use',
        sentence: 'Self-service portals where the people you serve track cases, view receipts, book and request — any hour, any phone.',
        runsIn: 'Vega · Atrium · Kozy Care',
    },
    {
        capability: 'Payments & revenue operations',
        sentence: 'Invoicing, collections, defaulter tracking, automatic receipts and reconciliation — naira-first, Paystack and bank transfer in production.',
        runsIn: 'Vega · Atrium · Kozy Care',
    },
    {
        capability: 'AI & automation',
        sentence: 'AI drafting, deadline computation and smart reminders that take over the repetitive work.',
        runsIn: 'Vega · Atrium',
    },
    {
        capability: 'Workflow & notification engines',
        sentence: 'Approvals, reminders, escalations and banner alerts that reach the right person on WhatsApp, SMS or email — the system moves first.',
        runsIn: 'Vega · Atrium',
    },
    {
        capability: 'Hosting, security & compliance',
        sentence: 'Deployment, monitoring, backups and NDPA 2023-aligned data handling — we run the infrastructure on our own products every day.',
        runsIn: 'All PracticePro systems',
    },
];

export const WhatWeBuildSection: React.FC = () => {
    const ref = useScrollReveal<HTMLDivElement>();
    return (
        <section id="whatWeBuild" className="hub-section" style={{ background: 'rgb(var(--hub-paper))' }}>
            <div className="hub-container">
                <p className="hub-label mb-8">02 — WHAT WE BUILD</p>
                <h2 className="hub-display text-3xl md:text-4xl mb-10 max-w-[20ch]">
                    Seven capabilities, already running in production.
                </h2>
                <div ref={ref} className="hub-reveal">
                    {/* Head row — mono, quiet */}
                    <div
                        className="hidden md:grid grid-cols-12 gap-6 pb-3"
                        style={{ borderBottom: '1px solid rgb(var(--hub-ink))' }}
                        aria-hidden="true"
                    >
                        <p className="hub-label col-span-1">No.</p>
                        <p className="hub-label col-span-4">Capability</p>
                        <p className="hub-label col-span-5">What it means</p>
                        <p className="hub-label col-span-2">Runs in</p>
                    </div>
                    {WHAT_WE_BUILD.map((row, i) => (
                        <div
                            key={row.capability}
                            className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-2 py-5 md:py-6"
                            style={{ borderBottom: '1px solid rgb(var(--hub-rule))' }}
                        >
                            <p className="hub-label md:col-span-1 pt-1">{String(i + 1)}</p>
                            <h3 className="md:col-span-4 text-base font-semibold leading-[1.5]" style={{ color: 'rgb(var(--hub-ink))' }}>
                                {row.capability}
                            </h3>
                            <p className="md:col-span-5 text-sm leading-[1.7]" style={{ color: 'rgb(var(--hub-mute))' }}>
                                {row.sentence}
                            </p>
                            <p className="md:col-span-2 text-xs leading-[1.7] font-mono pt-1" style={{ color: 'rgb(var(--hub-ink))' }}>
                                {row.runsIn}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
