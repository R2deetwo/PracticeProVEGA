import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SystemTour, type TourSystem } from '../../../components/marketing/SystemTour';
import { CheckIcon, ExternalLinkIcon, LockClosedIcon, MapPinIcon, MailIcon, XMarkIcon } from '../../../constants';
import { VegaMark, AtriumMark } from '../../../components/marketing/brand/ProductMarks';
import { Button } from '../../../components/ui';
import { useScrollReveal } from '../hooks';

/**
 * WorkSection (P1 C4) — "03 — WORK". An index table of the four systems
 * (Vega, Atrium, Kozy Care, Woosh): thumbnail, stack tags in mono, an
 * outbound link. The WorkDetailModal and the SystemTour behaviour are
 * KEPT (restyle only — owner direction); the dark aurora cards are
 * retired for ruled rows on the hub paper.
 *
 * P8 honesty: every screen is a REAL capture from a live system, labelled
 * with exactly what it is (W10). No mocked-up UI, no invented metrics.
 */
type WorkScreen = {
    src: string;
    alt: string;
    kind: 'browser' | 'phone';
    label: string;
};

const OUR_WORK: Array<{
    name: string;
    tagline: string;
    badge: string;
    Icon: React.ComponentType<{ className?: string }>;
    body: string;
    cta: { label: string; href: string; external: boolean };
    frameUrl: string;
    stack: string[];
    inside: string[];
    primaryScreen: WorkScreen;
    detailScreens: WorkScreen[];
    tourSystem: TourSystem;
}> = [
    {
        name: 'Vega',
        tagline: 'Legal Practice OS',
        badge: 'Our product',
        Icon: VegaMark,
        body: 'Case management, AI-assisted drafting with DraftPro and ALOA, court-rule-aware calendaring and billing for Nigerian law firms — from case intake to filing.',
        cta: { label: 'Explore Vega', href: '/vega', external: true },
        frameUrl: 'practicepro.ng/vega',
        tourSystem: 'vega',
        stack: ['React + TypeScript', 'Convex', 'Tailwind CSS', 'Gemini AI', 'Paystack', 'Android app (Capacitor)'],
        inside: [
            'Matter & case management',
            'AI drafting — DraftPro & ALOA',
            'Court-rule-aware calendaring',
            'Billing, invoices & receipts',
            'Client portal with live case tracking',
            'WhatsApp, SMS & email notifications',
        ],
        primaryScreen: {
            src: '/assets/landing/work/vega-page.jpg',
            alt: 'The PracticePro Vega product page — Practice Management for Nigerian Law Firms',
            kind: 'browser',
            label: 'Product page — practicepro.ng/vega',
        },
        detailScreens: [
            { src: '/assets/landing/work/vega-page.jpg', alt: 'The PracticePro Vega product page — Practice Management for Nigerian Law Firms', kind: 'browser', label: 'Product page — practicepro.ng/vega' },
            { src: '/assets/landing/work/vega-calendar.jpg', alt: 'Vega\u2019s court-rule-aware calendar, running in the PracticePro Android app', kind: 'phone', label: 'Court-rule calendar — the mobile app' },
            { src: '/assets/landing/work/vega-messages.jpg', alt: 'Vega\u2019s scheduled messaging screen for client updates by email, SMS and WhatsApp', kind: 'phone', label: 'Scheduled client messaging — the mobile app' },
            { src: '/assets/landing/work/vega-portal.jpg', alt: 'The Vega client portal sign-in screen', kind: 'browser', label: 'Client portal — sign-in' },
        ],
    },
    {
        name: 'Atrium',
        tagline: 'Property Management OS',
        badge: 'Our product',
        Icon: AtriumMark,
        body: "Rent and service-charge collection, residents' portal, maintenance workflows and revenue intelligence for property portfolios — applying the tenancy law of all 36 states and the FCT.",
        cta: { label: 'Explore Atrium', href: '/atrium', external: true },
        frameUrl: 'practicepro.ng/atrium',
        tourSystem: 'atrium',
        stack: ['React + TypeScript', 'Convex', 'Tailwind CSS', 'Paystack', 'WhatsApp & SMS', 'Web + Android'],
        inside: [
            'Rent & service-charge collection',
            "Residents' portal with statements",
            'Maintenance request workflows',
            'Revenue intelligence & forecasting',
            'Tenancy law engine — 36 states + FCT',
            'Defaulter tracking & escalation',
        ],
        primaryScreen: {
            src: '/assets/landing/work/atrium-page.jpg',
            alt: 'The PracticePro Atrium product page — Revenue Monitor for Property Managers',
            kind: 'browser',
            label: 'Product page — practicepro.ng/atrium',
        },
        detailScreens: [
            { src: '/assets/landing/work/atrium-page.jpg', alt: 'The PracticePro Atrium product page — Revenue Monitor for Property Managers', kind: 'browser', label: 'Product page — practicepro.ng/atrium' },
            { src: '/assets/landing/work/atrium-financials.jpg', alt: 'Atrium\u2019s financials dashboard showing collected revenue, outstanding balances and invoices, in the PracticePro mobile app', kind: 'phone', label: 'Revenue & collections dashboard — the mobile app' },
            { src: '/assets/landing/work/atrium-portal.jpg', alt: 'The Atrium residents\u2019 portal sign-in screen', kind: 'browser', label: "Residents' portal — sign-in" },
        ],
    },
    {
        name: 'Kozy Care',
        tagline: 'Dry-cleaning & laundry platform',
        badge: 'Built for a client',
        Icon: MapPinIcon,
        body: '“Uncompromising care. Exceptional convenience.” Pickup-and-delivery laundry is a crowded business — nothing special about the idea. What lets this one scale is the system behind it: guest booking, Kozy Circle memberships, a customer portal with live order tracking, GPS rider dispatch across 12 Lagos zones, a multi-branch admin console and a partner network — more customers, handled well, without the chaos doubling.',
        cta: { label: 'Visit kozycare.ng', href: 'https://kozycare.ng', external: true },
        frameUrl: 'kozycare.ng',
        tourSystem: 'kozy',
        stack: ['Next.js', 'Prisma + Supabase', 'NextAuth', 'Paystack', 'Termii SMS', 'Vercel'],
        inside: [
            'Guest pickup booking & quotes',
            'Kozy Circle memberships',
            'Customer portal & order tracking',
            'Payments, receipts & invoices — Paystack',
            'GPS rider dispatch — 12 zones',
            'Multi-branch admin console',
            'Partner garment-care network',
        ],
        primaryScreen: {
            src: '/assets/landing/work/kozy-home.jpg',
            alt: 'The Kozy Care home page — dry cleaning and laundry services, with pickup booking',
            kind: 'browser',
            label: 'Home page — kozycare.ng',
        },
        detailScreens: [
            { src: '/assets/landing/work/kozy-home.jpg', alt: 'The Kozy Care home page — dry cleaning and laundry services, with pickup booking', kind: 'browser', label: 'Home page — kozycare.ng' },
            { src: '/assets/landing/work/kozy-order-service.jpg', alt: 'Kozy Care\u2019s signed-in ordering flow — the service picker with per-item naira pricing', kind: 'browser', label: 'Ordering — the service picker' },
            { src: '/assets/landing/work/kozy-order-checkout.jpg', alt: 'Kozy Care\u2019s checkout — the live quote with discounts applied, card or bank transfer', kind: 'browser', label: 'Ordering — checkout' },
            { src: '/assets/landing/work/kozy-portal-order.jpg', alt: 'The Kozy Care customer portal — an active order with its status timeline', kind: 'browser', label: 'Customer portal — live order tracking' },
            { src: '/assets/landing/work/kozy-invoice.jpg', alt: 'A Kozy Care invoice — itemised in naira, printable and downloadable', kind: 'browser', label: 'The invoice' },
            { src: '/assets/landing/work/kozy-membership-active.jpg', alt: 'An active Kozy Circle membership on a live account, in the customer portal', kind: 'phone', label: 'Kozy Circle — an active membership' },
            { src: '/assets/landing/work/kozy-memberships.jpg', alt: 'Kozy Care\u2019s membership plans page with laundry pricing', kind: 'browser', label: 'Membership plans — kozycare.ng/memberships' },
            { src: '/assets/landing/work/kozy-admin-kanban.jpg', alt: 'The Kozy Care admin console\u2019s order board', kind: 'browser', label: 'Admin console — the order board' },
            { src: '/assets/landing/work/kozy-admin-crm.jpg', alt: 'The Kozy Care admin CRM — customers with lifetime value and MEMBER badges', kind: 'browser', label: 'Admin console — the CRM' },
            { src: '/assets/landing/work/kozy-book.jpg', alt: 'The Kozy Care pickup booking flow — items, live quote, pickup slot and zone', kind: 'browser', label: 'Guest booking & quotes — kozycare.ng/book' },
            { src: '/assets/landing/work/kozy-services.jpg', alt: 'Kozy Care\u2019s services catalogue — men\u2019s and women\u2019s dry cleaning, home linens, shoe care and alterations', kind: 'browser', label: 'The services catalogue' },
            { src: '/assets/landing/work/kozy-partners.jpg', alt: 'The Kozy Care partner network page — garment care partners across Lagos', kind: 'browser', label: 'The partner network' },
            { src: '/assets/landing/work/kozy-login.jpg', alt: 'The Kozy Care customer portal sign-in page', kind: 'browser', label: 'Customer portal — sign-in' },
        ],
    },
    {
        name: 'Woosh',
        tagline: 'Free temporary email — for humans and test rigs',
        badge: 'Our tool',
        Icon: MailIcon,
        body: 'A free temporary-email service we built in-house: instant disposable inboxes that keep spam out of real mailboxes — plus a documented API with webhooks, revocable API keys and extracted verification codes. Our own test rigs run signup, payment and notification batteries on it, sparing our transactional email quota.',
        cta: { label: 'Visit woosh.dpdns.org', href: 'https://woosh.dpdns.org', external: true },
        frameUrl: 'woosh.dpdns.org',
        tourSystem: 'woosh',
        stack: ['Cloudflare edge', 'REST API + webhooks', 'Verification-code extraction', 'Free — no sign-up'],
        inside: [
            'Instant disposable inboxes',
            'Shareable inbox links',
            'Codes & links extracted for you',
            'Webhooks — push instead of poll',
            'Revocable API keys, docs + console',
            'Dark mode & mail notifications',
        ],
        primaryScreen: {
            src: '/assets/landing/work/woosh-home.jpg',
            alt: 'Woosh — a free temporary email address in one click, at woosh.dpdns.org',
            kind: 'browser',
            label: 'The tool — woosh.dpdns.org',
        },
        detailScreens: [
            { src: '/assets/landing/work/woosh-home.jpg', alt: 'Woosh — a free temporary email address in one click, at woosh.dpdns.org', kind: 'browser', label: 'The tool — woosh.dpdns.org' },
            { src: '/assets/landing/work/woosh-inbox.jpg', alt: 'A live Woosh inbox receiving Kozy Care\u2019s real transactional email', kind: 'browser', label: 'A live inbox — receiving Kozy Care\u2019s mail' },
            { src: '/assets/landing/work/woosh-message.jpg', alt: 'A verification email opened in Woosh, with the code extracted and ready to copy', kind: 'browser', label: 'Message view — codes extracted for you' },
            { src: '/assets/landing/work/woosh-dark.jpg', alt: 'Woosh in dark mode, with a live inbox', kind: 'browser', label: 'Dark mode' },
            { src: '/assets/landing/work/woosh-api.jpg', alt: 'The Woosh Email Testing API documentation — endpoints, webhooks, API keys and an llms.txt prompt block', kind: 'browser', label: 'The Email Testing API docs' },
        ],
    },
];

/** The thumbnail — a quiet browser chrome around a real capture. */
const WorkThumb: React.FC<{ url: string; src: string; alt: string }> = ({ url, src, alt }) => (
    <div className="overflow-hidden rounded-[2px] border w-full" style={{ borderColor: 'rgb(var(--hub-rule))', background: '#FFFFFF' }}>
        <div className="flex items-center gap-2 px-3 py-1.5 border-b" style={{ borderColor: 'rgb(var(--hub-rule))' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: 'rgb(var(--hub-rule))' }} aria-hidden="true" />
            <span className="w-2 h-2 rounded-full" style={{ background: 'rgb(var(--hub-rule))' }} aria-hidden="true" />
            <span className="flex-1 mx-1 px-2 py-0.5 rounded-[2px] text-[10px] leading-none truncate font-mono flex items-center gap-1" style={{ background: 'rgb(var(--hub-paper))', color: 'rgb(var(--hub-mute))' }}>
                <LockClosedIcon className="w-2.5 h-2.5 flex-shrink-0" />
                {url}
            </span>
        </div>
        <img src={src} alt={alt} loading="lazy" className="w-full aspect-[16/10] object-cover object-top block" />
    </div>
);

/** The "Preview the system" modal — real screens (SystemTour), the stack,
 *  what's inside. Behaviour kept verbatim from the P0 modal; restyled to
 *  the hub register (paper, 2px radius, ink scrim — a solid overlay, no blur). */
const WorkDetailModal: React.FC<{
    work: (typeof OUR_WORK)[number] | null;
    onClose: () => void;
    onContactSales: () => void;
}> = ({ work, onClose, onContactSales }) => {
    useEffect(() => {
        if (!work) return;
        const scroller = document.querySelector('[data-public-page]') as HTMLElement | null;
        const prevOverflow = scroller?.style.overflow ?? '';
        if (scroller) scroller.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => {
            if (scroller) scroller.style.overflow = prevOverflow;
            window.removeEventListener('keydown', onKey);
        };
    }, [work, onClose]);

    if (!work) return null;

    return createPortal(
        // z-[10000] — above the cookie consent banner (z-[9999]).
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label={`${work.name} — system preview`}>
            <div className="absolute inset-0" style={{ background: 'rgb(20 23 26 / 0.85)' }} onClick={onClose} aria-hidden="true" />
            <div
                className="relative w-full max-w-5xl max-h-[88vh] overflow-hidden flex flex-col animate-swap-in rounded-[2px]"
                style={{ background: '#FFFFFF', border: '1px solid rgb(var(--hub-rule))' }}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 px-6 sm:px-8 pt-6 pb-4 border-b" style={{ borderColor: 'rgb(var(--hub-rule))' }}>
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-[2px] flex items-center justify-center flex-shrink-0" style={{ background: 'rgb(var(--hub-paper))' }}>
                            <work.Icon className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                            <h3 className="hub-display text-xl sm:text-2xl truncate" style={{ fontWeight: 700 }}>{work.name}</h3>
                            <p className="hub-label mt-0.5">{work.tagline}</p>
                        </div>
                    </div>
                    <Button
                        variant="bare"
                        onClick={onClose}
                        autoFocus
                        aria-label="Close preview"
                        className="p-2 rounded-[2px] transition-colors flex-shrink-0"
                    >
                        <XMarkIcon className="w-5 h-5" />
                    </Button>
                </div>

                {/* Body */}
                <div className="overflow-y-auto px-6 sm:px-8 py-6">
                    {/* W10: real captures only — live pages from the deployed
                        systems plus the real app on demo data. */}
                    <div className="mb-8">
                        <SystemTour system={work.tourSystem} />
                    </div>

                    <p className="text-sm leading-[1.75] mb-8 max-w-2xl" style={{ color: 'rgb(var(--hub-mute))' }}>{work.body}</p>

                    <p className="hub-label mb-3">Inside the system</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-8">
                        {work.inside.map((item) => (
                            <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: 'rgb(var(--hub-ink))' }}>
                                <span className="mt-0.5 flex-shrink-0" style={{ color: 'rgb(var(--hub-signal))' }}><CheckIcon className="w-4 h-4" /></span>
                                {item}
                            </li>
                        ))}
                    </ul>

                    <p className="hub-label mb-3">Built with</p>
                    <div className="flex flex-wrap gap-2 mb-8">
                        {work.stack.map((s) => (
                            <span key={s} className="px-3 py-1.5 rounded-[2px] border text-xs font-mono" style={{ borderColor: 'rgb(var(--hub-rule))', color: 'rgb(var(--hub-ink))' }}>
                                {s}
                            </span>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 pb-2">
                        <a
                            href={work.cta.href}
                            {...(work.cta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                            className="hub-cta"
                        >
                            {work.cta.label}
                            {work.cta.external ? <ExternalLinkIcon className="w-4 h-4" /> : <span aria-hidden="true">→</span>}
                        </a>
                        <Button
                            variant="bare"
                            onClick={onContactSales}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-[2px] font-semibold text-sm transition-all"
                            style={{ border: '1px solid rgb(var(--hub-rule))', color: 'rgb(var(--hub-ink))' }}
                        >
                            Ask us about a system like this
                        </Button>
                    </div>
                    <p className="hub-label mt-4">
                        {work.name} · Built by PracticePro
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const WorkSection: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    const [preview, setPreview] = useState<(typeof OUR_WORK)[number] | null>(null);

    return (
        <section id="work" className="hub-section" style={{ background: 'rgb(var(--hub-paper))' }}>
            <div className="hub-container">
                <p className="hub-label mb-8">03 — WORK</p>
                <h2 className="hub-display text-3xl md:text-4xl mb-4 max-w-[20ch]">Systems we&apos;ve built.</h2>
                <p className="text-base leading-[1.7] mb-10 max-w-2xl" style={{ color: 'rgb(var(--hub-mute))' }}>
                    Two products we run ourselves, a platform built to order for a client, and a
                    free tool running on the open internet. Real screens, real stack, really live.
                </p>

                <div ref={ref} className="hub-reveal">
                    {OUR_WORK.map((w, i) => (
                        <div
                            key={w.name}
                            className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-5 py-8"
                            style={{ borderTop: i === 0 ? '1px solid rgb(var(--hub-ink))' : '1px solid rgb(var(--hub-rule))' }}
                        >
                            {/* Thumbnail */}
                            <div className="md:col-span-4">
                                <WorkThumb url={w.frameUrl} src={w.primaryScreen.src} alt={w.primaryScreen.alt} />
                            </div>
                            {/* Name + badge + body */}
                            <div className="md:col-span-5">
                                <div className="flex items-center gap-3 mb-2">
                                    <w.Icon className="w-6 h-6" />
                                    <h3 className="hub-display text-xl" style={{ fontWeight: 700 }}>{w.name}</h3>
                                    <span
                                        className="hub-label px-2 py-0.5 rounded-[2px] border"
                                        style={{ borderColor: 'rgb(var(--hub-rule))' }}
                                    >
                                        {w.badge}
                                    </span>
                                </div>
                                <p className="hub-label mb-3">{w.tagline}</p>
                                <p className="text-sm leading-[1.7]" style={{ color: 'rgb(var(--hub-mute))' }}>{w.body}</p>
                            </div>
                            {/* Stack (mono) + links */}
                            <div className="md:col-span-3 flex flex-col gap-4">
                                <div>
                                    <p className="hub-label mb-2">Stack</p>
                                    <ul className="space-y-1">
                                        {w.stack.map((s) => (
                                            <li key={s} className="font-mono text-xs leading-[1.6]" style={{ color: 'rgb(var(--hub-ink))' }}>
                                                {s}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="flex flex-col items-start gap-2">
                                    <a
                                        href={w.cta.href}
                                        {...(w.cta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                        className="hub-link text-sm inline-flex items-center gap-1.5"
                                    >
                                        {w.cta.label} {w.cta.external ? <ExternalLinkIcon className="w-3.5 h-3.5" /> : <span aria-hidden="true">→</span>}
                                    </a>
                                    <Button variant="bare" onClick={() => setPreview(w)} className="text-sm font-semibold underline underline-offset-4" style={{ textDecorationColor: 'rgb(var(--hub-signal))' }}>
                                        Preview the system
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <WorkDetailModal work={preview} onClose={() => setPreview(null)} onContactSales={onContactSales} />
        </section>
    );
};
