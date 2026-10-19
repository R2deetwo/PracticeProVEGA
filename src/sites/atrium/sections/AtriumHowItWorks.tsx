import React from 'react';

/**
 * AtriumHowItWorks — /atrium's own onboarding band ("The Terracotta
 * Estate", elevated R32).
 *
 * The register the page's craft deserves: the estate's cream ground, white
 * cards with sand hairlines, and step numerals set LARGE in Bricolage
 * Grotesque clay — the display face carries the sequence, the mono
 * eyebrow carries the register. Kowalski press physics on the cards.
 * Keeps the #howItWorks anchor the nav and audit key on.
 */

const STEPS = [
    {
        num: '1',
        title: 'Create your property workspace',
        body: 'Sign up in 2 minutes. No credit card required for trial. Choose Atrium and set up your portfolio.',
    },
    {
        num: '2',
        title: 'Add your properties & residents',
        body: 'Create properties, add units, and assign residents. Set rent amounts and service charges. Optionally request our Managed Data Migration service to digitize your records for you.',
    },
    {
        num: '3',
        title: 'Start collecting',
        body: 'Send your first collection reminder (email, portal, or one-tap WhatsApp share), collect a payment via bank transfer with proof upload, or generate a visitor pass with Sentry Pass.',
    },
];

export const AtriumHowItWorks: React.FC = () => (
    <section id="howItWorks" className="py-20 md:py-28" style={{ background: 'var(--color-paper)' }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12 md:mb-16">
                <p className="font-mono text-2xs font-bold uppercase tracking-[0.3em] text-atrium-clay mb-4">
                    Onboarding
                </p>
                <h2 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-atrium-ink">
                    From sign-up to your first collection
                </h2>
                <p className="text-lg text-slate-600 mt-4 max-w-2xl mx-auto">
                    In minutes, not weeks — the estate starts keeping itself.
                </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8 max-w-5xl mx-auto">
                {STEPS.map((step, i) => (
                    <div
                        key={i}
                        className="relative text-center p-8 bg-white border border-atrium-sand rounded-2xl shadow-[0_1px_3px_rgb(75_50_35/0.06)] transition-all duration-150 hover:shadow-elevation-2 hover:-translate-y-1 active:scale-[0.98]"
                    >
                        {/* The step numeral — Bricolage display in clay, the
                            estate's own voice counting you in. */}
                        <div className="font-display text-6xl md:text-7xl font-bold leading-none text-atrium-clay mb-5">
                            {step.num}
                        </div>
                        <h3 className="text-xl font-bold text-atrium-ink mb-3">{step.title}</h3>
                        <p className="text-slate-600 text-sm leading-relaxed">
                            {step.body}
                        </p>
                        {/* The connecting tick — a quiet sand rule that reads
                            as "and then" between cards on desktop. */}
                        {i < STEPS.length - 1 && (
                            <span
                                className="hidden md:block absolute top-1/2 -right-4 w-4 h-[3px] rounded-full bg-atrium-sand"
                                aria-hidden="true"
                            />
                        )}
                    </div>
                ))}
            </div>
        </div>
    </section>
);
