import React, { useState } from 'react';
import { Button } from '../../../components/ui';

/**
 * VegaFAQInk — /vega's replacement for the shared white FAQ card stack.
 *
 * "The Warm Chambers" register (R26): the FAQs read as INTERROGATORIES on
 * the page's second (and last) raised band, inside LawPavilion's dashed
 * quote frame — question rows divided by white hairlines, mono numbering
 * in orange, questions in the grotesk, answers in the body face. The
 * accordion indicator stays a hairline plus/minus. Atrium carries no dark
 * band anywhere.
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
        a: 'Automated reminders are sent 7, 3, and 1 day before each hearing to assigned lawyers by email and in-app notification. Client-facing reminders are opt-in per matter.',
    },
    {
        q: 'Can my clients access their case information?',
        a: 'Yes. The Client Portal lets clients view milestones, upload documents, submit KYC, and track case progress — without calling your office.',
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
        a: 'Yes. Every Vega subscription starts with a 30-day free trial — no credit card required to start.',
    },
    {
        q: 'Do you offer support?',
        a: 'Yes. Every firm gets email support. Priority support and a dedicated account manager are available on request — talk to us.',
    },
    {
        q: 'How much does Vega cost?',
        a: 'Vega is priced per firm, not per user, and depends on how your practice works. Start with the 30-day free trial, or talk to sales for a quote that fits your firm. Annual plans include a 30-day money-back guarantee.',
    },
];

export const VegaFAQInk: React.FC = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <section
            aria-labelledby="vega-faq-heading"
            className="py-20 md:py-28 bg-vega-ink text-white"
        >
            <div className="container mx-auto px-4 sm:px-6 max-w-4xl" data-vg-reveal>
                {/* Roman-numeral hairline section head — ink variant */}
                <p
                    className="vg-rule-h font-mono text-2xs font-medium uppercase tracking-[0.25em] text-vega-claret-bright mb-7"
                    data-ink="true"
                >
                    VII — Questions
                </p>
                <h2
                    id="vega-faq-heading"
                    className="font-vega text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.12] tracking-[-0.01em] mb-5 text-vega-parchment"
                >
                    Questions? Answered.
                </h2>
                <p className="text-base md:text-lg leading-[1.7] text-slate-300 mb-12 md:mb-16">
                    Everything you need to know about PracticePro Vega for law firms.
                </p>

                {/* The interrogatories (R26) — ruled accordion inside the dashed frame */}
                <div className="rounded-3xl border-2 border-dashed border-white/15 px-5 sm:px-8 py-2">
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
                                    className="w-full flex items-baseline gap-4 sm:gap-6 py-6 text-left transition-colors duration-150 hover:bg-white/5 active:bg-white/10 focus-visible:ring-vega-claret-bright"
                                >
                                    <span className="font-mono text-2xs tracking-widest text-vega-claret-bright flex-shrink-0">
                                        Q.{i + 1}
                                    </span>
                                    <span className="font-vega text-base sm:text-lg font-semibold text-vega-parchment flex-1 leading-snug">
                                        {item.q}
                                    </span>
                                    <span className="relative inline-block w-3 h-3 flex-shrink-0 translate-y-[-2px]" aria-hidden="true">
                                        <span className="absolute top-1/2 left-0 w-3 h-px bg-vega-claret-bright -translate-y-1/2" />
                                        {!open && <span className="absolute left-1/2 top-0 h-3 w-px bg-vega-claret-bright -translate-x-1/2" />}
                                    </span>
                                </Button>
                                {open && (
                                    <p
                                        id={`vg-faq-panel-${i}`}
                                        className="pl-[3.25rem] pr-4 pb-7 -mt-1 text-sm leading-[1.75] text-slate-300 max-w-2xl panel-in origin-top"
                                    >
                                        {item.a}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>
                </div>
            </div>
        </section>
    );
};
