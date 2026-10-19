import React, { useEffect, useRef, useState } from 'react';
import { DocumentIcon, OfficeBuildingIcon, ShieldCheckIcon, SparklesIcon } from '../../../constants';

/**
 * AtriumFeatures — /atrium's own features grid ("The Well-Kept Estate").
 *
 * The hover-expand category grid in the estate's warm register: pill
 * eyebrow, rounded emerald icon chips, cards that expand together per
 * row (hover) or one at a time (tap). The deliberate opposite of Vega's
 * ruled ledger index. Copy is the shipped Atrium feature copy, verbatim.
 *
 * Extracted from the retired shared FeaturesSection (Pass B): atrium
 * branch only, now living in an Atrium-owned file.
 */

type FeatureItem = {
    title: string;
    desc: string;
};

type FeatureCategory = {
    category: string;
    Icon: React.ComponentType<{ className?: string }>;
    items: FeatureItem[];
};

const ATRIUM_FEATURE_CATEGORIES: FeatureCategory[] = [
    {
        category: 'Property Management',
        Icon: OfficeBuildingIcon,
        items: [
            { title: 'Property Portfolio', desc: 'Manage residential, commercial, and mixed-use properties from a single dashboard. Track occupancy, upload photos, organize by location, and link to tenancy records.' },
            { title: 'Resident Management', desc: 'Complete resident profiles with KYC fields, lease agreements, and communication history. Manage resident lifecycles from application through to departure.' },
            { title: "Residents' Portal", desc: "Self-service portal where residents view SC/MV payment status, download rent receipts, and log maintenance tickets directly into your workflow." },
            { title: 'Revenue Monitor', desc: 'Real-time defaulter dashboard, rent collection tracking, and portfolio-level financial analytics. Know which residents are overdue and which properties are underperforming.' },
        ],
    },
    {
        category: 'Rent & Collections',
        Icon: DocumentIcon,
        items: [
            { title: 'Rent Collection', desc: 'Collect rent in Naira with payment reminders, receipt generation, and payment tracking. Generate invoices and track status at a glance.' },
            { title: 'Service Charge Tracking', desc: 'Itemized SC (Service Charge) and MV (Minimum Vend) tracking per unit. Monitor payment status, flag defaulters, and generate compliance-ready financial reports.' },
            { title: 'WhatsApp Share', desc: 'Compose rent reminders and demand notices in Atrium, then share them to WhatsApp with one tap — the message opens pre-written to the right number; you review and send. Automated notices also go out by email and to the residents\' portal.' },
            { title: 'Lease Management', desc: 'Lease expiry alerts and calendar integration. Send renewal notices and rent review communications. Never miss a critical date again.' },
        ],
    },
    {
        category: 'Maintenance & Operations',
        Icon: ShieldCheckIcon,
        items: [
            { title: 'Sentry Pass', desc: 'Generate 6-digit visitor access codes for guests, contractors, and delivery personnel. Gatekeepers verify codes at the security terminal via PIN or QR code scan. Full audit trail with check-in/check-out timestamps. Includes offline fallback for unreliable gatehouse connectivity.' },
            { title: 'Maintenance Tickets', desc: 'Residents log issues directly into your workflow via the portal. Categorize by plumbing, electrical, structural, or other. Track status from open to resolved.' },
            { title: 'Expense Tracking', desc: 'Log maintenance costs, service charges, and utility bills per property. Track income vs. expenses with cash flow visualizations.' },
            { title: 'Estate Administration Documents', desc: 'Streamline property administration, manage tenancy records, and generate standard estate management administrative documents with precision.' },
        ],
    },
    {
        category: 'Estate Community',
        Icon: SparklesIcon,
        items: [
            { title: 'Amenity Booking', desc: 'Let residents book shared amenities — gym, pool, clubhouse, meeting rooms — directly from their portal. Admin defines slot duration, operating hours, and approval rules. Conflict detection prevents double-bookings. Perfect for estates where amenity scheduling is currently a phone-call bottleneck.' },
            { title: 'Estate Bulletin', desc: 'Post community announcements — estate meetings, holiday hours, social events, security alerts. Distinct from operational notices (rent reminders, SC updates). Pinned posts surface to the top. Optional event metadata (date, time, location). Scope visibility to specific properties or estate-wide.' },
            { title: 'Service Provider Directory', desc: 'Curate a list of vetted plumbers, electricians, cleaners, gardeners, and security vendors. Residents browse and contact directly — you stay out of the middle. Admin marks providers as "Verified" based on track record. Internal admin notes (not shown to residents) help you track why a provider was added.' },
        ],
    },
    {
        category: 'AI & Research',
        Icon: SparklesIcon,
        items: [
            { title: 'ARIA AI Copilot', desc: 'Your portfolio\'s always-on property intelligence — ask questions about your properties, get instant revenue insights, analyze defaulter patterns, research Nigerian property law, and surface insights from your portfolio data. Built for Nigerian property management.' },
            { title: 'Research Studio', desc: 'Research workspace with document analysis, intelligent search, and AI-assisted document review. Build research notebooks with source citations for property law and compliance matters.' },
        ],
    },
];

const Pill: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-bold uppercase tracking-widest border ${className}`}>
        {children}
    </span>
);

function useScrollReveal<T extends HTMLElement = HTMLDivElement>() {
    const ref = useRef<T>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (!('IntersectionObserver' in window)) {
            el.classList.add('is-visible');
            return;
        }
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -60px 0px',
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return ref;
}

export const AtriumFeatures: React.FC = () => {
    // Per-ROW expand state (not per-card): hovering ANY card in a category's
    // row expands ALL cards in that row; mouseleave from the row collapses
    // them together. Mobile/tap is an accordion (one card at a time).
    const [expandedRow, setExpandedRow] = useState<number | null>(null);
    const [tappedCard, setTappedCard] = useState<string | null>(null);
    // Atrium's accent is its registered clay via the token system —
    // never the moss brand ramp (R32).
    const accentColorValue = 'rgb(var(--color-atrium-clay))';
    const accentShadow = 'rgb(var(--color-atrium-clay) / 0.15)';

    const headerRef = useScrollReveal<HTMLDivElement>();
    const sectionsRef = useScrollReveal<HTMLDivElement>();

    return (
        <section id="features" className="py-12 sm:py-20 lg:py-28" style={{ background: 'var(--color-paper)' }}>
            <div className="container mx-auto px-4 sm:px-6 max-w-7xl">
                {/* Header */}
                <div ref={headerRef} className="scroll-reveal mb-10 md:mb-16 text-center">
                    <Pill className="mb-5 bg-atrium-clay/10 text-atrium-clay-deep border-atrium-clay/25">
                        Features
                    </Pill>
                    <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-[1.12] text-atrium-ink">
                        Everything the estate<br />runs on.
                    </h2>
                    <p className="text-lg max-w-2xl mx-auto leading-relaxed text-slate-600">
                        From rent collection to defaulter management, Atrium runs every part of your
                        portfolio — residents, maintenance, and financials — from one well-kept system.
                    </p>
                    {/* Hint for interactivity */}
                    <p className="text-xs mt-4 text-slate-400 font-medium tracking-wide">
                        <span className="hidden md:inline">Hover a category to expand all cards</span>
                        <span className="md:hidden">Tap a card to learn more</span>
                    </p>
                </div>

                {/* Feature Categories — each row is independent */}
                <div ref={sectionsRef} className="scroll-reveal scroll-reveal-stagger">
                    {ATRIUM_FEATURE_CATEGORIES.map((cat, catIndex) => {
                        const isRowExpanded = expandedRow === catIndex;
                        return (
                            <div
                                key={cat.category}
                                className="mb-14 last:mb-0"
                                onMouseEnter={() => setExpandedRow(catIndex)}
                                onMouseLeave={() => setExpandedRow(null)}
                            >
                                <div className="flex items-center gap-3 mb-8">
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: `${accentColorValue}15`, color: accentColorValue }}
                                    >
                                        <cat.Icon className="w-5 h-5" />
                                    </div>
                                    <h3 className="font-display text-2xl font-bold tracking-tight" style={{ color: 'var(--color-ink)' }}>{cat.category}</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                    {cat.items.map((item) => {
                                        const cardKey = `${cat.category}-${item.title}`;
                                        const isCardTapped = tappedCard === cardKey;
                                        const showExpanded = isRowExpanded || isCardTapped;
                                        return (
                                            <div
                                                key={item.title}
                                                className={`landing-card feature-card cursor-pointer ${showExpanded ? 'is-expanded' : ''}`}
                                                style={{
                                                    '--feature-accent': accentColorValue,
                                                    '--feature-accent-shadow': accentShadow,
                                                    '--border-card-hover': `${accentColorValue}66`,
                                                } as React.CSSProperties}
                                                onClick={() => setTappedCard(isCardTapped ? null : cardKey)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        setTappedCard(isCardTapped ? null : cardKey);
                                                    }
                                                }}
                                            >
                                                {/* Accent bar — slides in on hover/expand */}
                                                <div className="feature-card__accent" aria-hidden="true" />
                                                <h4 className="font-display text-base font-bold text-slate-900 pr-4">
                                                    {item.title}
                                                </h4>
                                                {/* Description — hidden by default, expands on row hover/tap */}
                                                <div className="feature-card__desc">
                                                    <p className="text-sm leading-relaxed text-slate-600">
                                                        {item.desc}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};
