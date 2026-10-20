import React from 'react';

/**
 * AtriumAI — /atrium's own AI capabilities band ("The Well-Kept Estate").
 *
 * NO dark sections on /atrium: the band renders as warm sage with white
 * rounded-2xl cards and soft elevation — the hospitable opposite of
 * Vega's ink drafting band. ARIA (Asset & Revenue Intelligence
 * Assistant) in the -600/-700 emerald scale. Carries the legal-advice
 * disclaimer (ARIA drafts property/tenancy documents using
 * state-specific law).
 *
 * Extracted from the retired shared AICapabilitiesSection (Pass B):
 * atrium branch only, now living in an Atrium-owned file. Keeps the
 * #ai-capabilities anchor the audit script keys on.
 */

const ARIA_CONFIG = {
    assistantName: 'ARIA',
    assistantFull: 'Asset & Revenue Intelligence Assistant',
    headline: 'Powered by ARIA. Built for Nigerian property.',
    subtitle: 'Your AI property copilot monitors revenue, drafts demand notices, and analyzes your portfolio — with privacy-first architecture that keeps resident data safe.',
    capabilities: [
        {
            title: 'Revenue Intelligence & Drafting',
            body: 'Monitor rent collection, identify defaulters, and draft demand notices, quit notices, and tenancy agreements. Analyze portfolio performance and predict revenue at risk. ARIA is trained on the property and tenancy laws of all 36 Nigerian states and the FCT*, and applies the law of the state where each property is located.',
            features: ['Revenue Monitor with defaulter tracking', 'All 36 state property & tenancy laws + FCT*', 'Automated demand notice generation'],
        },
        {
            title: 'PII Shield',
            body: 'Resident names, phone numbers, NIN, BVN, and bank accounts are automatically stripped before AI processing. Your resident data never trains external models. NDPA 2023 compliant.',
            features: ['Email & phone stripping', 'NIN/BVN/credit card detection', 'Nigerian bank account masking'],
        },
        {
            title: 'Portfolio-Grade Security',
            body: 'Your portfolio data is fully isolated from every other organization on the platform. AI queries only access your properties, your residents, and your financials. No cross-organization data leakage — ever.',
            features: ['Complete data isolation between organizations', 'Property-level access control', 'Full audit trail on all AI activity'],
        },
    ],
};

export const AtriumAI: React.FC = () => {
    const config = ARIA_CONFIG;
    const accentColor = 'text-emerald-600';
    const accentBg = 'bg-emerald-50';
    const accentBorder = 'hover:border-emerald-300';

    return (
        <section
            id="ai-capabilities"
            className="py-20 md:py-28"
            style={{ background: 'var(--color-sage)' }}
        >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="mb-12 md:mb-16 text-center">
                    <div className={`inline-flex items-center gap-2 px-4 py-1.5 ${accentBg} rounded-full mb-4 border border-emerald-200/70`}>
                        <svg className={`w-4 h-4 ${accentColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        <span className={`text-sm font-bold ${accentColor}`}>{config.assistantName} — {config.assistantFull}</span>
                    </div>
                    <h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                        {config.headline}
                    </h2>
                    <p className="text-lg mt-4 text-slate-600 max-w-2xl mx-auto">
                        {config.subtitle}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
                    {config.capabilities.map((cap, i) => (
                        <div key={i} className={`bg-white rounded-2xl border border-slate-200/70 shadow-elevation-2 p-8 ${accentBorder} transition-colors`}>
                            <div className={`w-12 h-12 rounded-xl ${accentBg} flex items-center justify-center mb-5`}>
                                <svg className={`w-6 h-6 ${accentColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {i === 0 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />}
                                    {i === 1 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />}
                                    {i === 2 && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />}
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-slate-900">{cap.title}</h3>
                            <p className="text-slate-600 text-sm leading-relaxed mb-4">
                                {cap.body}
                            </p>
                            <ul className="space-y-2">
                                {cap.features.map((f, j) => (
                                    <li key={j} className="flex items-start gap-2 text-sm text-slate-500">
                                        <svg className={`w-4 h-4 ${accentColor} flex-shrink-0 mt-0.5`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        <span>{f}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
                {/* Legal-advice disclaimer — ARIA drafts property/tenancy
                    documents using state-specific law, so the non-lawyer
                    audience gets the boundary in plain words. */}
                <p className="text-xs text-slate-500 mt-8 max-w-3xl mx-auto text-center leading-relaxed">
                    * ARIA is trained on the property and tenancy laws of all 36 Nigerian states and the Federal Capital Territory (FCT), and applies the law of the state where each property is located. ARIA does not provide legal advice. Drafts generated by ARIA are tools to assist your property management workflow and do not constitute legal opinions. For legal advice on recovery of premises, tenancy disputes, or other legal matters, consult a qualified legal practitioner.
                </p>
            </div>
        </section>
    );
};
