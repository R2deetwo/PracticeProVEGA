import React from 'react';
import { ZapIcon, ScalesIcon, OfficeBuildingIcon } from '../../../constants';

/**
 * AtriumWhyRunOn — /atrium's own capability-attestation band
 * ("The Well-Kept Estate").
 *
 * The sage section break with white rounded-2xl verifiable-capability
 * cards (W3 honest marketing: every claim maps to shipped behaviour —
 * no invented personas, no star ratings). The deliberate opposite of
 * Vega's attestation rows + trust colophon.
 *
 * Extracted from the retired shared WhyRunOnSection (Pass B): atrium
 * branch only, now living in an Atrium-owned file.
 */

const WHY_RUN_ON: Array<{
    title: string;
    body: string;
    Icon: React.ComponentType<{ className?: string }>;
}> = [
    {
        title: 'Collections that run themselves',
        body: "Invoices, receipts and defaulter tracking are automatic — payments map to the right unit, ledgers update instantly, receipts generate without a phone call.",
        Icon: ZapIcon,
    },
    {
        title: "Every state's tenancy law, applied",
        body: 'ARIA works from the property and tenancy laws of all 36 states and the FCT, and applies the law of the state where each property is located — quit notices included.',
        Icon: ScalesIcon,
    },
    {
        title: "Residents served, not chased",
        body: "The Residents' Portal answers 'where is my receipt?' before it is asked — payments, maintenance requests and notices in one place.",
        Icon: OfficeBuildingIcon,
    },
];

export const AtriumWhyRunOn: React.FC = () => {
    // ATRIUM REGISTER: sand section break — the warm page never drops
    // to a cold gray.
    return (
        <section
            className="py-12 sm:py-20 lg:py-28"
            style={{ background: 'var(--color-sage)' }}
        >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-12 md:mb-16 text-center">
                    <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-atrium-ink">
                        Why portfolios run on Atrium
                    </h2>
                    <p className="text-lg text-slate-600 mt-4 max-w-2xl mx-auto">
                        How Atrium helps Nigerian property managers and owners keep collections on schedule.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8 max-w-5xl mx-auto">
                    {WHY_RUN_ON.map((c, i) => (
                        <div key={i} className="p-8 transition-all duration-150 bg-white rounded-2xl border border-atrium-sand shadow-sm hover:shadow-md hover:-translate-y-1 active:scale-[0.98]">
                            <div className="w-11 h-11 flex items-center justify-center mb-5 rounded-xl bg-atrium-clay/10 text-atrium-clay-deep">
                                <c.Icon className="w-5 h-5" />
                            </div>
                            <h3 className="font-display font-bold text-lg text-atrium-ink mb-2.5 tracking-tight">{c.title}</h3>
                            <p className="text-slate-600 text-sm leading-[1.7]">{c.body}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
