/**
 * OurWorkSection — the W18 portfolio: every card maps to a real,
 * deployed system (Vega, Atrium, Kozy Care, Woosh) with real screens,
 * the stack and what's inside. Restored verbatim; WorkDetailModal keeps
 * the informed tour (SystemTour, W15).
 */
import React, { useEffect, useState } from 'react';
import { useScrollReveal } from '../hooks';
import { CheckIcon, DeviceMobileIcon, ExternalLinkIcon, LockClosedIcon, MailIcon, MapPinIcon, OfficeBuildingIcon, ScalesIcon, XMarkIcon } from '../../../constants';

import { Button } from '../../../components/ui';
import { SystemTour, type TourSystem } from '../../../components/marketing/SystemTour';
import { createPortal } from 'react-dom';
// ─── OUR WORK (corporate hub) — the portfolio ──────────────────────────────
// P8: every card maps to a real, deployed system. Vega and Atrium are
// PracticePro's own products (their marketing pages live at /vega and
// /atrium on this site); Kozy Care is a client commission, live at
// kozycare.ng — shown here as proof we build for other people's businesses.

// W7 (the wow site): every project ships with REAL SCREENS captured from the
// live systems — marketing pages, portal logins and actual in-app screens —
// plus the STACK it is built with and WHAT'S INSIDE it. Prospective clients
// can see what we can do (capabilities), what we have done (these screens)
// and how we could help them (the preview + CTA).

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
    badgeClass: string;
    Icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    body: string;
    cta: { label: string; href: string; external: boolean };
    ctaClass: string;
    // ── W7 additions ──
    frameUrl: string;          // shown in the browser-chrome mockup
    stack: string[];           // what it's built with
    inside: string[];          // modules inside the system
    primaryScreen: WorkScreen; // the card's main showcase shot
    detailScreens: WorkScreen[]; // the preview modal's gallery
    glowClass: string;         // accent glow behind the devices
    borderGlowClass: string;   // hover ring on the device stack
    // ── W9 additions ──
    tourSystem: TourSystem;    // the guided tour's screen set (demo data)
}> = [
    {
        name: 'Vega',
        tagline: 'Legal Practice OS',
        badge: 'A product',
        badgeClass: 'bg-amber-500/10 text-amber-300 border border-amber-500/30',
        Icon: ScalesIcon,
        iconClass: 'bg-amber-500/10 text-amber-400',
        body: 'Case management, AI-assisted drafting with DraftPro and ALOA, court-rule-aware calendaring and billing for Nigerian law firms — from case intake to filing.',
        cta: { label: 'Explore Vega', href: '/vega', external: true },
        ctaClass: 'group-hover:text-amber-400 text-amber-400',
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
            {
                src: '/assets/landing/work/vega-page.jpg',
                alt: 'The PracticePro Vega product page — Practice Management for Nigerian Law Firms',
                kind: 'browser',
                label: 'Product page — practicepro.ng/vega',
            },
            {
                src: '/assets/landing/work/vega-calendar.jpg',
                alt: 'Vega\u2019s court-rule-aware calendar, running in the PracticePro Android app',
                kind: 'phone',
                label: 'Court-rule calendar — the mobile app',
            },
            {
                src: '/assets/landing/work/vega-messages.jpg',
                alt: 'Vega\u2019s scheduled messaging screen for client updates by email, SMS and WhatsApp',
                kind: 'phone',
                label: 'Scheduled client messaging — the mobile app',
            },
            {
                src: '/assets/landing/work/vega-portal.jpg',
                alt: 'The Vega client portal sign-in screen',
                kind: 'browser',
                label: 'Client portal — sign-in',
            },
        ],
        glowClass: 'bg-amber-500/25',
        borderGlowClass: 'group-hover:border-amber-500/40',
    },
    {
        name: 'Atrium',
        tagline: 'Property Management OS',
        badge: 'A product',
        badgeClass: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
        Icon: OfficeBuildingIcon,
        iconClass: 'bg-emerald-500/10 text-emerald-400',
        body: "Rent and service-charge collection, residents' portal, maintenance workflows and revenue intelligence for property portfolios — applying the tenancy law of all 36 states and the FCT.",
        cta: { label: 'Explore Atrium', href: '/atrium', external: true },
        ctaClass: 'group-hover:text-emerald-400 text-emerald-400',
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
            {
                src: '/assets/landing/work/atrium-page.jpg',
                alt: 'The PracticePro Atrium product page — Revenue Monitor for Property Managers',
                kind: 'browser',
                label: 'Product page — practicepro.ng/atrium',
            },
            {
                src: '/assets/landing/work/atrium-financials.jpg',
                alt: 'Atrium\u2019s financials dashboard showing collected revenue, outstanding balances and invoices, in the PracticePro mobile app',
                kind: 'phone',
                label: 'Revenue & collections dashboard — the mobile app',
            },
            {
                src: '/assets/landing/work/atrium-portal.jpg',
                alt: 'The Atrium residents\u2019 portal sign-in screen',
                kind: 'browser',
                label: "Residents' portal — sign-in",
            },
        ],
        glowClass: 'bg-emerald-500/25',
        borderGlowClass: 'group-hover:border-emerald-500/40',
    },
    {
        name: 'Kozy Care',
        tagline: 'Dry-cleaning & laundry platform',
        badge: 'Built for a client',
        badgeClass: 'bg-primary-500/10 text-primary-300 border border-primary-500/30',
        Icon: MapPinIcon,
        iconClass: 'bg-primary-500/10 text-primary-400',
        body: '“Uncompromising care. Exceptional convenience.” Pickup-and-delivery laundry is a crowded business — nothing special about the idea. What lets this one scale is the system behind it: guest booking, Kozy Circle memberships, a customer portal with live order tracking, GPS rider dispatch across 12 Lagos zones, a multi-branch admin console and a partner network — more customers, handled well, without the chaos doubling.',
        cta: { label: 'Visit kozycare.ng', href: 'https://kozycare.ng', external: true },
        ctaClass: 'group-hover:text-primary-400 text-primary-400',
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
            {
                src: '/assets/landing/work/kozy-home.jpg',
                alt: 'The Kozy Care home page — dry cleaning and laundry services, with pickup booking',
                kind: 'browser',
                label: 'Home page — kozycare.ng',
            },
            {
                src: '/assets/landing/work/kozy-order-service.jpg',
                alt: 'Kozy Care\u2019s signed-in ordering flow — the service picker with per-item naira pricing',
                kind: 'browser',
                label: 'Ordering — the service picker',
            },
            {
                src: '/assets/landing/work/kozy-order-checkout.jpg',
                alt: 'Kozy Care\u2019s checkout — the live quote with discounts applied, card or bank transfer',
                kind: 'browser',
                label: 'Ordering — checkout',
            },
            {
                src: '/assets/landing/work/kozy-portal-order.jpg',
                alt: 'The Kozy Care customer portal — an active order with its status timeline',
                kind: 'browser',
                label: 'Customer portal — live order tracking',
            },
            {
                src: '/assets/landing/work/kozy-invoice.jpg',
                alt: 'A Kozy Care invoice — itemised in naira, printable and downloadable',
                kind: 'browser',
                label: 'The invoice',
            },
            {
                src: '/assets/landing/work/kozy-membership-active.jpg',
                alt: 'An active Kozy Circle membership on a live account, in the customer portal',
                kind: 'phone',
                label: 'Kozy Circle — an active membership',
            },
            {
                src: '/assets/landing/work/kozy-admin-kanban.jpg',
                alt: 'The Kozy Care admin console\u2019s order board',
                kind: 'browser',
                label: 'Admin console — the order board',
            },
            {
                src: '/assets/landing/work/kozy-admin-crm.jpg',
                alt: 'The Kozy Care admin CRM — customers with lifetime value and MEMBER badges',
                kind: 'browser',
                label: 'Admin console — the CRM',
            },
            {
                src: '/assets/landing/work/kozy-book.jpg',
                alt: 'The Kozy Care pickup booking flow — items, live quote, pickup slot and zone',
                kind: 'browser',
                label: 'Guest booking & quotes — kozycare.ng/book',
            },
            {
                src: '/assets/landing/work/kozy-services.jpg',
                alt: 'Kozy Care\u2019s services catalogue — men\u2019s and women\u2019s dry cleaning, home linens, shoe care and alterations',
                kind: 'browser',
                label: 'Services catalogue — kozycare.ng/services',
            },
            {
                src: '/assets/landing/work/kozy-memberships.jpg',
                alt: 'Kozy Care\u2019s membership plans page with laundry pricing',
                kind: 'browser',
                label: 'Membership plans — kozycare.ng/memberships',
            },
            {
                src: '/assets/landing/work/kozy-login.jpg',
                alt: 'The Kozy Care customer portal sign-in screen',
                kind: 'browser',
                label: 'Customer portal — sign-in',
            },
            {
                src: '/assets/landing/work/kozy-partners.jpg',
                alt: 'The Kozy Care partner network page — other laundry operators running under the Kozy brand',
                kind: 'browser',
                label: 'Partner network — kozycare.ng/partners',
            },
        ],
        glowClass: 'bg-primary-500/25',
        borderGlowClass: 'group-hover:border-primary-500/40',
    },
    {
        name: 'Woosh',
        tagline: 'Free temporary email — for humans and test rigs',
        badge: 'A free tool',
        badgeClass: 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30',
        Icon: MailIcon,
        iconClass: 'bg-indigo-500/10 text-indigo-400',
        body: 'A free temporary-email service we built in-house: instant disposable inboxes that keep spam out of real mailboxes — plus a documented API with webhooks, revocable API keys and extracted verification codes. Our own test rigs run signup, payment and notification batteries on it, sparing our transactional email quota.',
        cta: { label: 'Visit woosh.dpdns.org', href: 'https://woosh.dpdns.org', external: true },
        ctaClass: 'group-hover:text-indigo-400 text-indigo-400',
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
            {
                src: '/assets/landing/work/woosh-home.jpg',
                alt: 'Woosh — a free temporary email address in one click, at woosh.dpdns.org',
                kind: 'browser',
                label: 'The tool — woosh.dpdns.org',
            },
            {
                src: '/assets/landing/work/woosh-inbox.jpg',
                alt: 'A live Woosh inbox receiving Kozy Care\u2019s real transactional email',
                kind: 'browser',
                label: 'A live inbox — receiving Kozy Care\u2019s mail',
            },
            {
                src: '/assets/landing/work/woosh-message.jpg',
                alt: 'A verification email opened in Woosh, with the code extracted and ready to copy',
                kind: 'browser',
                label: 'Message view — codes extracted for you',
            },
            {
                src: '/assets/landing/work/woosh-dark.jpg',
                alt: 'Woosh in dark mode, with a live inbox',
                kind: 'browser',
                label: 'Dark mode',
            },
            {
                src: '/assets/landing/work/woosh-api.jpg',
                alt: 'The Woosh Email Testing API documentation — endpoints, webhooks, API keys and an llms.txt prompt block',
                kind: 'browser',
                label: 'The developer API — woosh.dpdns.org/api-docs',
            },
        ],
        glowClass: 'bg-indigo-500/25',
        borderGlowClass: 'group-hover:border-indigo-500/40',
    },
];

/** W7: a macOS-style browser chrome around a real screen capture. */
const BrowserFrame: React.FC<{ url: string; src: string; alt: string; className?: string; eager?: boolean }> = ({ url, src, alt, className = '', eager = false }) => (
    <div className={`overflow-hidden rounded-xl border border-white/10 bg-[#0E1626] shadow-2xl shadow-black/50 ${className}`}>
        <div className="flex items-center gap-2 px-3 py-2 bg-[#111A2C] border-b border-white/[0.06]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" aria-hidden="true" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" aria-hidden="true" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" aria-hidden="true" />
            <span className="flex-1 mx-1 px-3 py-1 rounded-md bg-black/40 text-[10px] leading-none text-slate-400 font-medium truncate flex items-center gap-1.5 min-h-[1.25rem]">
                <LockClosedIcon className="w-2.5 h-2.5 flex-shrink-0" />
                {url}
            </span>
        </div>
        <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} className="w-full aspect-[16/10] object-cover object-top block" />
    </div>
);

/** W7: a phone chrome around a real in-app screen capture. */
const PhoneFrame: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className = '' }) => (
    <div className={`overflow-hidden rounded-[1.6rem] border-[5px] border-[#1A2334] bg-black shadow-2xl shadow-black/60 ${className}`}>
        <div className="relative">
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full bg-white/20 z-10" aria-hidden="true" />
            <img src={src} alt={alt} loading="lazy" className="w-full aspect-[9/20] object-cover object-top block" />
        </div>
    </div>
);

/** W7: the "Preview the system" modal — real screens, the stack, what's inside.
 *  W10: the preview is REAL CAPTURES ONLY — live pages from the deployed
 *  systems plus the real app running its own demo data (P8 honesty: every
 *  screen is labelled with exactly what it is). No mocked-up UI. */
const WorkDetailModal: React.FC<{
    work: (typeof OUR_WORK)[number] | null;
    onClose: () => void;
    onContactSales: () => void;
}> = ({ work, onClose, onContactSales }) => {
    // Escape + scroll-lock (the landing page scrolls inside its own div).
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
        // z-[10000] — above the cookie consent banner (z-[9999]) so a preview
        // is never obscured; the banner reappears once the modal closes.
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-label={`${work.name} — system preview`}>
            <div className="absolute inset-0 bg-[#070D18]/85 backdrop-blur-md" onClick={onClose} aria-hidden="true" />
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[88vh] overflow-hidden flex flex-col animate-swap-in">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 px-6 sm:px-8 pt-6 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${work.iconClass}`}>
                            <work.Icon className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                            <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">{work.name}</h3>
                            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{work.tagline}</p>
                        </div>
                    </div>
                    <Button
                        variant="bare"
                        onClick={onClose}
                        autoFocus
                        aria-label="Close preview"
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors flex-shrink-0"
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

                    <p className="text-slate-600 text-sm leading-[1.75] mb-8 max-w-2xl">{work.body}</p>

                    {/* What's inside */}
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Inside the system</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-8">
                        {work.inside.map((item) => (
                            <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                                <CheckIcon className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary-500" />
                                {item}
                            </li>
                        ))}
                    </ul>

                    {/* Stack */}
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Built with</p>
                    <div className="flex flex-wrap gap-2 mb-8">
                        {work.stack.map((s) => (
                            <span key={s} className="px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
                                {s}
                            </span>
                        ))}
                    </div>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row gap-3 pb-2">
                        <a
                            href={work.cta.href}
                            {...(work.cta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 transition-all"
                        >
                            {work.cta.label}
                            {work.cta.external ? <ExternalLinkIcon className="w-4 h-4" /> : <span aria-hidden="true">→</span>}
                        </a>
                        <Button
                            variant="bare"
                            onClick={onContactSales}
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-slate-700 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all"
                        >
                            Ask us about a system like this
                        </Button>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-4">
                        {work.name} · Built by PracticePro
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
};

export const OurWorkSection: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    const panelsRef = useScrollReveal<HTMLDivElement>();
    const [preview, setPreview] = useState<(typeof OUR_WORK)[number] | null>(null);

    return (
        <section id="ourWork" className="relative py-16 sm:py-24 overflow-hidden w7-dark">
            {/* deep ink base + brand aurora, so the real screens glow */}
            <div className="absolute inset-0 bg-[#0A101C]" aria-hidden="true" />
            <div className="absolute -top-40 left-1/4 w-[42rem] h-[42rem] rounded-full bg-emerald-600/10 blur-[140px] pointer-events-none" aria-hidden="true" />
            <div className="absolute -bottom-52 right-1/4 w-[38rem] h-[38rem] rounded-full bg-emerald-500/10 blur-[140px] pointer-events-none" aria-hidden="true" />
            <div className="absolute inset-0 w7-grain pointer-events-none" aria-hidden="true" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
                <div ref={ref} className="w9-reveal text-center mb-12 md:mb-16">
                    <p className="text-xs sm:text-xs font-bold uppercase tracking-[0.3em] mb-4 text-emerald-400/90">
                        Our work
                    </p>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white font-display" style={{ '--w9-d': '90ms' } as React.CSSProperties}>
                        Systems we&apos;ve built
                    </h2>
                    <p className="text-lg text-slate-400 mt-4 max-w-2xl mx-auto" style={{ '--w9-d': '180ms' } as React.CSSProperties}>
                        Two products we run ourselves, a platform built to order for a client, and a free tool running on the open internet.
                        Each one takes a real workflow end to end — and shows what it takes to run a business that scales. Real screens, real stack, really live.
                    </p>
                </div>

                <div ref={panelsRef} className="w9-reveal-stagger grid grid-cols-1 gap-6 md:gap-10 max-w-6xl mx-auto">
                    {OUR_WORK.map((w, i) => (
                        <div
                            key={w.name}
                            className={`group relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 sm:p-10 transition-all duration-500 hover:border-white/20 hover:bg-white/[0.05] ${w.borderGlowClass}`}
                        >
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                                {/* Text side — alternates sides so the page breathes */}
                                <div className={`${i % 2 === 1 ? 'lg:order-2' : ''}`}>
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${w.iconClass}`}>
                                            <w.Icon className="w-5 h-5" />
                                        </span>
                                        <span className={`text-xs font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-full ${w.badgeClass}`}>
                                            {w.badge}
                                        </span>
                                    </div>
                                    <h3 className="font-display text-3xl font-bold tracking-tight text-white">{w.name}</h3>
                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1.5 mb-4">{w.tagline}</p>
                                    <p className="text-slate-300/90 text-sm leading-[1.75] mb-6">{w.body}</p>

                                    {/* Stack chips — the first few, full list in the preview */}
                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2.5">Built with</p>
                                    <div className="flex flex-wrap gap-2 mb-6">
                                        {w.stack.slice(0, 4).map((s) => (
                                            <span key={s} className="px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 text-xs font-semibold text-slate-300">
                                                {s}
                                            </span>
                                        ))}
                                        {w.stack.length > 4 && (
                                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold text-slate-500">
                                                +{w.stack.length - 4} more
                                            </span>
                                        )}
                                    </div>

                                    {/* Key modules — a taste of what's inside */}
                                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2.5">Inside the system</p>
                                    <ul className="space-y-1.5 mb-8">
                                        {w.inside.slice(0, 3).map((item) => (
                                            <li key={item} className="flex items-start gap-2 text-sm text-slate-400">
                                                <CheckIcon className="w-3.5 h-3.5 mt-1 flex-shrink-0 text-primary-500" />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                                        <a
                                            href={w.cta.href}
                                            {...(w.cta.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                            className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-all duration-300 group-hover:gap-2.5 ${w.ctaClass}`}
                                        >
                                            {w.cta.label} {w.cta.external
                                                ? <ExternalLinkIcon className="w-3.5 h-3.5" />
                                                : <span aria-hidden="true">→</span>}
                                        </a>
                                        <Button
                                            variant="bare"
                                            onClick={() => setPreview(w)}
                                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors min-h-[2rem]"
                                        >
                                            <DeviceMobileIcon className="w-4 h-4" /> Preview the system
                                        </Button>
                                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">Built by PracticePro</span>
                                    </div>
                                </div>

                                {/* Device side — real screens, floating in the glow */}
                                <div className={`relative ${i % 2 === 1 ? 'lg:order-1' : ''}`}>
                                    <div className={`absolute -inset-6 rounded-[2rem] blur-3xl opacity-60 group-hover:opacity-90 transition-opacity duration-700 ${w.glowClass}`} aria-hidden="true" />
                                    <div className="relative transition-transform duration-500 ease-out group-hover:-translate-y-1.5">
                                        <BrowserFrame
                                            url={w.frameUrl}
                                            src={w.primaryScreen.src}
                                            alt={w.primaryScreen.alt}
                                            className="transition-transform duration-500 group-hover:scale-[1.015] rotate-[-1.2deg] group-hover:rotate-0"
                                        />
                                        {/* The second surface: an in-app phone screen (Vega/Atrium)
                                            or a second live page (Kozy Care). */}
                                        {w.detailScreens[1].kind === 'phone' ? (
                                            <PhoneFrame
                                                src={w.detailScreens[1].src}
                                                alt={w.detailScreens[1].alt}
                                                className="absolute -bottom-8 -right-3 sm:-right-6 w-[27%] min-w-[92px] rotate-[3deg] w7-float"
                                            />
                                        ) : (
                                            <div className="absolute -bottom-8 -right-2 sm:-right-5 w-[46%] rotate-[2.2deg] w7-float">
                                                <BrowserFrame url={w.frameUrl + (w.name === 'Kozy Care' ? '/services' : '')} src={w.detailScreens[1].src} alt={w.detailScreens[1].alt} />
                                            </div>
                                        )}
                                    </div>
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

// ─── HOW WE WORK (corporate hub) — the engagement process ──────────────────
