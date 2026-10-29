import React, { useState } from 'react';

/**
 * AtriumFAQ — /atrium's own FAQ band ("The Well-Kept Estate").
 *
 * Light throughout: white band, rounded-lg accordion rows, emerald
 * hover. The deliberate opposite of Vega's ink interrogatory band.
 * Copy is the shipped shared + Atrium FAQ content, verbatim.
 *
 * Extracted from the retired shared FAQSection (Pass B): atrium branch
 * only, now living in an Atrium-owned file.
 */

const SHARED_FAQS = [
    {
        q: "Is my data secure?",
        a: "Yes. Your data is fully isolated and never shared with other firms. We're NDPA 2023 compliant, offer 2FA, and never train AI on your data. All data is encrypted at rest and in transit.",
    },
    {
        q: "Can I pay in Naira?",
        a: "Absolutely. Pay via bank transfer with proof upload, or use Paystack for card and USSD payments (currently activating). Manual bank transfer is the live default today.",
    },
    {
        q: "Is there a free trial?",
        a: "Yes. Every Atrium subscription starts with a 30-day free trial — no credit card required to start. Sentry Pass also includes a 30-day free trial as an add-on.",
    },
    {
        q: "Do you offer support?",
        a: "Yes. Every portfolio gets email support. Priority support and a dedicated account manager are available on request — talk to us.",
    },
    {
        q: "How much does Atrium cost?",
        a: "Atrium is priced per portfolio, based on the number of units you manage. Start with the 30-day free trial, or talk to sales for a quote that fits your portfolio. Annual plans include a 30-day money-back guarantee.",
    },
];

const ATRIUM_FAQS = [
    {
        q: "How does rent collection work?",
        a: "Residents pay via bank transfer with proof upload, or through Paystack (card, bank, USSD — currently activating). Receipts generate automatically. The Revenue Monitor shows you who has paid, who hasn't, and how much is outstanding — in real time.",
    },
    {
        q: "Can residents use the portal on their phones?",
        a: "Yes. The Resident Portal is mobile-first. Residents can view payment status, download receipts, log maintenance tickets, and generate visitor passes — all from their phone, no app install required.",
    },
    {
        q: "How does Sentry Pass (visitor management) work?",
        a: "Residents generate 6-digit access codes and QR passes for their guests from the portal. Gatekeepers verify codes at a secure web terminal. The system works offline with a 100-visitor cache. Includes a 30-day free trial, then ₦7,500/month as an add-on (included at no extra cost on Komplete).",
    },
    {
        q: "What happens if a resident doesn't pay?",
        a: "The Revenue Monitor tracks defaulters by days overdue and sends automated demand notices by email and to the residents' portal (with a one-tap WhatsApp share for phone-first residents). You can calculate outstanding balances with late penalties and draft statutory quit notices on the notice framework the app encodes (weekly 1 week, monthly 1 month, quarterly 3 months, yearly 6 months), applied to the state where your property is located — with the Tenancy Law of Lagos State 2011 in the legal corpus and ARIA verifying the current statute of any other state before drafting. For property owners managing remotely from abroad, this means full visibility into arrears and recovery without needing a local proxy — ARIA tracks every unit and drafts notices even while you're away.",
    },
    {
        q: "I'm a property owner living abroad. Can I use Atrium to manage my Nigerian properties?",
        a: "Yes. While PracticePro Atrium is built primarily for professional property managers, diaspora property owners can use it directly to manage their own portfolios. You get real-time visibility into collections, service charges, maintenance tickets, and resident communications via the dashboard and automated email/portal alerts. Your residents use the Residents' Portal for payments and requests. You can also assign a local property manager with granular access controls if you want boots on the ground — or run everything yourself remotely.",
    },
];

export const AtriumFAQ: React.FC = () => {
    const [openIndex, setOpenIndex] = useState<number | null>(0);
    const allFaqs = [...SHARED_FAQS, ...ATRIUM_FAQS];
    return (
        <section className="py-20 md:py-28 bg-white">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
                <div className="mb-12 md:mb-16 text-center">
                    <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                        Questions? Answered.
                    </h2>
                    <p className="text-lg text-slate-500 mt-4">
                        Everything you need to know about PracticePro Atrium for property managers.
                    </p>
                </div>
                <div className="space-y-3">
                    {allFaqs.map((item, i) => (
                        <div key={i} className="border border-slate-200 overflow-hidden bg-white rounded-lg">
                            <button
                                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                                className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-emerald-50 transition-colors"
                                aria-expanded={openIndex === i}
                            >
                                <span className="font-semibold text-slate-900 text-sm md:text-base">{item.q}</span>
                                <svg
                                    className={`w-5 h-5 text-slate-400 flex-shrink-0 ml-3 transition-transform ${openIndex === i ? 'rotate-180' : ''}`}
                                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {openIndex === i && (
                                <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">
                                    {item.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
