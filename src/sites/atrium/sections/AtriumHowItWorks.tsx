import React from 'react';

/**
 * AtriumHowItWorks — /atrium's own onboarding band ("The Well-Kept Estate").
 *
 * Three steps on emerald-50 rounded-2xl tiles — soft, warm, legible; the
 * deliberate opposite of Vega's hairline procedure schedule. Keeps the
 * #howItWorks anchor the nav and audit key on.
 *
 * Extracted from the retired shared HowItWorksSection (Pass B): atrium
 * branch only, now living in an Atrium-owned file.
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

export const AtriumHowItWorks: React.FC = () => {
    const accentColor = 'text-emerald-600';
    const accentBg = 'bg-emerald-50';
    const accentBorder = 'border-emerald-200';
    return (
        <section id="howItWorks" className="py-20 md:py-28 bg-white">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-12 md:mb-16">
                    <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                        Get started in 3 steps
                    </h2>
                    <p className="text-lg text-slate-500 mt-4 max-w-2xl mx-auto">
                        From sign-up to your first collection — in minutes, not weeks.
                    </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8 max-w-5xl mx-auto">
                    {STEPS.map((step, i) => (
                        <div
                            key={i}
                            className={`text-center relative p-8 ${accentBg} ${accentBorder} border rounded-2xl`}
                        >
                            {/* Legible step number — solid accent color */}
                            <div className={`text-5xl md:text-6xl font-extrabold mb-4 ${accentColor}`}>{step.num}</div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                {step.body}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
