import React, { useState } from 'react';
import { Button } from '../../ui';

/**
 * VegaFAQInk — /vega's replacement for the shared white FAQ card stack.
 *
 * "The Chambers Standard" register: the FAQs read as INTERROGATORIES on
 * the page's second (and last) ink band — question rows divided by white
 * hairlines, mono numbering in amber, questions in the serif, answers in
 * the body face. The accordion is square: a hairline plus/minus, never a
 * circular badge. This is the dark band the testimonial/FAQ zone is
 * allowed to use; Atrium carries no dark band anywhere.
 *
 * Copy is the shipped FAQ copy (shared + vega sets), verbatim.
 * Interactive rows use the ui/Button primitive (ADR-0004).
 */
const FAQ_ITEMS = [
    {
        q: 'How does the legal drafting work?',
        a: 'DraftPro is a rich-text editor built specifically for Nigerian legal documents. It handles A4 pagination, Nigerian legal fonts (Times New Roman), court-specific formatting, and placeholder guardrails that prevent printing until every blank is filled. ALOA, your AI copilot, can generate drafts, summarize cases, and research precedents — all within the editor.',
    },
    {
        q: 'Can I manage matters for multiple courts and jurisdictions?',
        a: 'Yes. Each matter is tagged with its court, judicial division, and matter type. The system supports all Nigerian court tiers (Supreme Court, Court of Appeal, Federal High Court, State High Courts, Magistrate Courts) and can handle matters from any jurisdiction with appropriate caveats.',
    },
    {
        q: 'How do court date reminders reach me?',
        a: 'Automated reminders are sent 7, 3, and 1 day before each hearing to assigned lawyers by email and in-app notification. Client-facing reminders are opt-in per matter. Available on the Growth plan and above.',
    },
    {
        q: 'Can my clients access their case information?',
        a: 'Yes. The Client Portal lets clients view milestones, upload documents, submit KYC, and track case progress — without calling your office. Available on Growth and above (up to 20 clients), uncapped on Pro.',
    },
    {
        q: 'Is my data secure?',
        a: "Yes. Your data is fully isolated and never shared with other firms. We're NDPA 2023 compliant, offer 2FA, and never train AI on your data. All data is encrypted at rest and in transit.",
    },
    {
        q: 'Can I pay in Naira?',
        a: 'Absolutely. Pay via bank transfer with proof upload, or use Paystack for card and USSD payments (currently activating). Manual bank transfer is the live default today.',
    },
    {
        q: 'Is there a free trial?',
        a: 'Yes. All paid tiers include a 30-day free trial. No credit card required to start. Sentry Pass also includes a 30-day free trial as an add-on.',
    },
    {
        q: 'Do you offer support?',
        a: 'Yes. Email support for all tiers. Priority support for Growth and above. Dedicated account manager for Enterprise and Komplete.',
    },
    {
        q: 'Can I switch between plans?',
        a: 'Yes. Upgrade or downgrade anytime. Prorated billing applies. Annual plans include a 30-day money-back guarantee.',
    },
];

export const VegaFAQInk: React.FC = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <section
            aria-labelledby="vega-faq-heading"
            className="py-20 md:py-28 bg-vega-ink text-white"
        >
            <div className="container mx-auto px-4 sm:px-6 max-w-4xl">
                {/* Numbered hairline section head — ink variant */}
                <p
                    className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-amber mb-7"
                    data-ink="true"
                >
                    08 — Questions
                </p>
                <h2
                    id="vega-faq-heading"
                    className="font-vega text-3xl md:text-4xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5"
                >
                    Questions? Answered.
                </h2>
                <p className="text-base md:text-lg leading-[1.7] text-slate-300 mb-12 md:mb-16">
                    Everything you need to know about PracticePro Vega for law firms.
                </p>

                {/* The interrogatories — ruled accordion on ink */}
                <div className="border-t border-white/10">
                    {FAQ_ITEMS.map((item, i) => {
                        const open = openIndex === i;
                        return (
                            <div key={item.q} className="border-b border-white/10">
                                <Button
                                    variant="bare"
                                    fullWidth
                                    aria-expanded={open}
                                    aria-controls={`vg-faq-panel-${i}`}
                                    onClick={() => setOpenIndex(open ? null : i)}
                                    className="w-full flex items-baseline gap-4 sm:gap-6 py-6 text-left transition-colors hover:bg-white/5 focus-visible:ring-vega-amber"
                                >
                                    <span className="font-mono text-2xs tracking-widest text-vega-amber flex-shrink-0">
                                        Q.{i + 1}
                                    </span>
                                    <span className="font-vega text-base sm:text-lg font-semibold text-white flex-1 leading-snug">
                                        {item.q}
                                    </span>
                                    <span className="relative inline-block w-3 h-3 flex-shrink-0 translate-y-[-2px]" aria-hidden="true">
                                        <span className="absolute top-1/2 left-0 w-3 h-px bg-vega-amber -translate-y-1/2" />
                                        {!open && <span className="absolute left-1/2 top-0 h-3 w-px bg-vega-amber -translate-x-1/2" />}
                                    </span>
                                </Button>
                                {open && (
                                    <p
                                        id={`vg-faq-panel-${i}`}
                                        className="pl-[3.25rem] pr-4 pb-7 -mt-1 text-sm leading-[1.75] text-slate-300 max-w-2xl"
                                    >
                                        {item.a}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};
