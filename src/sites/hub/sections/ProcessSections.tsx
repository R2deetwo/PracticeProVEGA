import React from 'react';
import { useScrollReveal } from '../hooks';

/**
 * ProcessSections (P1 C6) — "05 — HOW WE WORK" (4 steps in a horizontal
 * ruled strip), "06 — ABOUT" (existing facts, plain) and "07 — CONTACT"
 * (an ink band; email, WhatsApp, and the ContactSalesDrawer trigger).
 * Existing HOW_WE_WORK / ABOUT_FACTS copy, verbatim.
 */
const HOW_WE_WORK = [
    {
        num: '1',
        title: 'Understand your operations',
        body: 'We sit with your team and map how the business actually runs — the paperwork, the phone calls, the spreadsheets — and where the friction lives. You talk; we listen and take notes.',
    },
    {
        num: '2',
        title: 'Design the system',
        body: 'Workflows, data model, integrations and screens — designed with you and agreed before a line of code is written, so there are no surprises at handover.',
    },
    {
        num: '3',
        title: 'Build & integrate',
        body: 'We build in weekly increments and demo as we go, so your feedback lands in the product from week one — not at the end, when changes are expensive.',
    },
    {
        num: '4',
        title: 'Launch, train & run with you',
        body: 'We deploy, train your staff and migrate your records. Then we stay on — monitoring, supporting and iterating as the business grows.',
    },
];

const ABOUT_FACTS = [
    '3 systems live in production — Vega, Atrium and Kozy Care',
    'Payments, messaging, portals and AI automation shipping today, not planned',
    'NDPA 2023-aligned data handling, encrypted in transit and at rest',
    'Working with businesses across Nigeria and beyond — wherever a process needs a system',
];

export const HowWeWorkSection: React.FC = () => {
    const ref = useScrollReveal<HTMLDivElement>();
    return (
        <section id="howWeWork" className="hub-section" style={{ background: 'rgb(var(--hub-paper))' }}>
            <div className="hub-container">
                <p className="hub-label mb-8">05 — HOW WE WORK</p>
                <h2 className="hub-display text-3xl md:text-4xl mb-10 max-w-[22ch]">
                    From first conversation to a system you scale with.
                </h2>
                <div ref={ref} className="hub-reveal">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 md:divide-x" style={{ borderTop: '1px solid rgb(var(--hub-ink))', borderBottom: '1px solid rgb(var(--hub-rule))' }}>
                        {HOW_WE_WORK.map((s, i) => (
                            <div key={s.num} className="py-6 lg:px-6 first:lg:pl-0 last:lg:pr-0" style={{ borderTop: i < 2 ? '1px solid rgb(var(--hub-rule))' : undefined }} >
                                <p className="hub-label mb-3">{s.num}</p>
                                <h3 className="text-base font-semibold leading-[1.4] mb-2.5" style={{ color: 'rgb(var(--hub-ink))' }}>
                                    {s.title}
                                </h3>
                                <p className="text-sm leading-[1.7]" style={{ color: 'rgb(var(--hub-mute))' }}>
                                    {s.body}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export const AboutSection: React.FC = () => {
    const ref = useScrollReveal<HTMLDivElement>();
    return (
        <section id="about" className="hub-section" style={{ background: 'rgb(var(--hub-paper))' }}>
            <div className="hub-container">
                <p className="hub-label mb-8">06 — ABOUT</p>
                <div className="hub-grid">
                    <div className="col-span-12 lg:col-span-5">
                        <h2 className="hub-display text-3xl md:text-4xl leading-[1.15]">
                            Built in Lagos.
                            <br />
                            Run in production.
                        </h2>
                        <p className="text-sm leading-[1.75] mt-6" style={{ color: 'rgb(var(--hub-mute))' }}>
                            PracticePro Systems is a software company based in Lagos, Nigeria. We build
                            the systems businesses use to manage their affairs — the daily operating
                            software that tracks the work, moves the money, talks to the customers and
                            keeps the records straight.
                        </p>
                        <p className="text-sm leading-[1.75] mt-4" style={{ color: 'rgb(var(--hub-mute))' }}>
                            We don&apos;t just build systems for other people — we run our own, every
                            working day. Vega serves Nigerian law firms and Atrium serves property
                            portfolios. That means the foundations a client system stands on — payments,
                            messaging, portals, automation, security — are already in production, not on
                            a roadmap.
                        </p>
                    </div>
                    <div ref={ref} className="hub-reveal col-span-12 lg:col-span-6 lg:col-start-7">
                        <ul className="space-y-4">
                            {ABOUT_FACTS.map((f) => (
                                <li key={f} className="flex items-start gap-3 pb-4 text-sm leading-[1.7]" style={{ borderBottom: '1px solid rgb(var(--hub-rule))', color: 'rgb(var(--hub-ink))' }}>
                                    <span className="w-1.5 h-1.5 flex-shrink-0 mt-2" style={{ background: 'rgb(var(--hub-signal))' }} aria-hidden="true" />
                                    {f}
                                </li>
                            ))}
                        </ul>
                        <p className="text-sm leading-[1.7] mt-6" style={{ color: 'rgb(var(--hub-mute))' }}>
                            We design, build and run the systems businesses manage their
                            affairs with — our products Vega and Atrium, and custom
                            commissions for clients. From Lagos, for businesses anywhere.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export const ContactSection: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    return (
        <section id="contact" className="hub-section" style={{ background: 'rgb(var(--hub-ink))', color: 'rgb(var(--hub-paper))' }}>
            <div className="hub-container">
                <p className="hub-label mb-8" style={{ color: 'rgb(216 211 198 / 0.65)' }}>07 — CONTACT</p>
                <div className="hub-grid items-start">
                    <div ref={ref} className="hub-reveal col-span-12 lg:col-span-7">
                        <h2 className="hub-display text-3xl md:text-4xl mb-4 max-w-[20ch]" style={{ color: 'rgb(var(--hub-paper))' }}>
                            Tell us what runs your business today.
                        </h2>
                        <p className="text-base leading-[1.7] mb-8 max-w-xl" style={{ color: 'rgb(216 211 198 / 0.9)' }}>
                            One conversation is enough to know whether a system is the
                            answer. We reply within 24 hours.
                        </p>
                        <div className="flex flex-wrap items-center gap-4">
                            <button onClick={onContactSales} className="hub-cta">
                                Talk to us
                            </button>
                            <a href="mailto:dpo@practicepro.ng" className="text-sm font-semibold underline underline-offset-4" style={{ color: 'rgb(var(--hub-paper))', textDecorationColor: 'rgb(var(--hub-signal))' }}>
                                dpo@practicepro.ng
                            </a>
                            <button onClick={onContactSales} className="text-sm font-semibold underline underline-offset-4" style={{ color: 'rgb(var(--hub-paper))', textDecorationColor: 'rgb(var(--hub-signal))' }}>
                                WhatsApp
                            </button>
                        </div>
                    </div>
                    <div className="col-span-12 lg:col-span-4 lg:col-start-9 mt-8 lg:mt-0">
                        <p className="hub-label mb-3" style={{ color: 'rgb(216 211 198 / 0.65)' }}>PRACTICEPRO SYSTEMS LIMITED</p>
                        <p className="text-sm leading-[1.8]" style={{ color: 'rgb(216 211 198 / 0.9)' }}>
                            Lagos, Nigeria<br />
                            Vega and Atrium are built by PracticePro Systems Limited.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};
