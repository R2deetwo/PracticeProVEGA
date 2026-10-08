import React, { useEffect, useState } from 'react';
// ADR-0004: interactive elements use the ui/ Button primitive — the raw
// form-element ratchet must not grow.
import { Button } from '../ui';

/**
 * SystemTour — W10 "the preview that goes INSIDE, for real".
 *
 * Owner direction after W9: demo data is fine — mocked-up UI is not.
 * "Why not use the actual thing, how the thing actually looks?" So the
 * tour now shows REAL CAPTURES ONLY:
 *
 *   • "Live site" — pages captured from the deployed systems
 *     (practicepro.ng, kozycare.ng).
 *   • "The real mobile app" — screens captured from the PracticePro
 *     Android app in real use.
 *   • "Real app · demo data" — the actual product interface running its
 *     built-in demo dataset (captured from the real app in development
 *     mode). Real UI, demo data — labelled honestly per P8.
 *
 * Every screen carries its own badge so nothing is ever mistaken for
 * something it is not. The visitor steps through the areas that matter
 * (or lets the tour walk itself): chips, auto-advance, hover/focus pause
 * and a progress bar — all carried over from W9, now carrying real
 * pixels instead of illustrations.
 *
 * W11: the Kozy set now goes INSIDE — the signed-in ordering flow, the
 * customer portal with a live order, the invoice, membership states and
 * the admin console (CRM, members, order board). New: the Woosh set —
 * our own live tool at woosh.dpdns.org, captured in action receiving
 * Kozy Care's real transactional email.
 */

// ─── Per-system accents ────────────────────────────────────────────────────

export type TourSystem = 'vega' | 'atrium' | 'kozy' | 'woosh';

const ACCENTS: Record<TourSystem, { hex: string; soft: string; text: string; ring: string; chipBg: string }> = {
    vega: { hex: '#D97706', soft: 'rgba(217,119,6,0.10)', text: '#B45309', ring: 'rgba(217,119,6,0.35)', chipBg: 'rgba(217,119,6,0.12)' },
    atrium: { hex: '#059669', soft: 'rgba(5,150,105,0.10)', text: '#047857', ring: 'rgba(5,150,105,0.35)', chipBg: 'rgba(5,150,105,0.12)' },
    kozy: { hex: '#16A34A', soft: 'rgba(22,163,74,0.10)', text: '#15803D', ring: 'rgba(22,163,74,0.35)', chipBg: 'rgba(22,163,74,0.12)' },
    woosh: { hex: '#6366F1', soft: 'rgba(99,102,241,0.10)', text: '#4F46E5', ring: 'rgba(99,102,241,0.35)', chipBg: 'rgba(99,102,241,0.12)' },
};

const acc = (s: TourSystem) => ACCENTS[s];

const prefersReduced = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── The screen set — real captures, honestly labelled ─────────────────────

export type RealScreen = {
    id: string;
    label: string;
    caption: string;
    src: string;
    url: string;
    kind: 'browser' | 'phone';
    badge: string;
};

const LIVE = 'Live site';
const APP = 'Real app · demo data';
const MOBILE = 'The real mobile app';

export const TOUR_SCREENS: Record<TourSystem, RealScreen[]> = {
    vega: [
        { id: 'page', label: 'Product page', caption: 'The public product page — Practice Management for Nigerian law firms.', src: '/assets/landing/work/vega-page.jpg', url: 'practicepro.ng/vega', kind: 'browser', badge: LIVE },
        { id: 'dashboard', label: 'Dashboard', caption: 'The firm at a glance — active matters, tasks and the court-rule calendar, straight from the real product.', src: '/assets/landing/work/vega-demo-dashboard.jpg', url: 'app — dashboard', kind: 'browser', badge: APP },
        { id: 'notifications', label: 'Notifications', caption: 'The notification engine in the real app — task reminders, client messages and overdue-invoice alerts, delivered by the system.', src: '/assets/landing/work/vega-demo-notifications.jpg', url: 'app — notifications', kind: 'browser', badge: APP },
        { id: 'newmatter', label: 'New matter', caption: 'A matter being entered live — claimant, defendant, court, suit number; the deadline engine starts computing as you type.', src: '/assets/landing/work/vega-demo-newmatter.jpg', url: 'app — new matter', kind: 'browser', badge: APP },
        { id: 'matters', label: 'Matters', caption: 'The matters board — every case with its stage, counsel and client group.', src: '/assets/landing/work/vega-demo-matters.jpg', url: 'app — matters', kind: 'browser', badge: APP },
        { id: 'matter', label: 'Matter detail', caption: 'Inside a matter — strategy notes, tasks and the process tracker, exactly as the firm sees it.', src: '/assets/landing/work/vega-demo-matter-detail.jpg', url: 'app — matter detail', kind: 'browser', badge: APP },
        { id: 'billing', label: 'Billing', caption: 'Invoices, receipts and overdue tracking — naira-first revenue operations in the real product.', src: '/assets/landing/work/vega-demo-billing.jpg', url: 'app — financials', kind: 'browser', badge: APP },
        { id: 'calendar', label: 'Calendar', caption: 'Court-rule-aware calendaring in the PracticePro Android app.', src: '/assets/landing/work/vega-calendar.jpg', url: 'the mobile app', kind: 'phone', badge: MOBILE },
        { id: 'messages', label: 'Messaging', caption: 'Scheduled client messaging by email, SMS and WhatsApp, from the mobile app.', src: '/assets/landing/work/vega-messages.jpg', url: 'the mobile app', kind: 'phone', badge: MOBILE },
        { id: 'portal', label: 'Client portal', caption: 'The client portal sign-in — clients track their matters themselves, at any hour.', src: '/assets/landing/work/vega-portal.jpg', url: 'practicepro.ng/portal/client', kind: 'browser', badge: LIVE },
    ],
    atrium: [
        { id: 'page', label: 'Product page', caption: 'The public product page — the Revenue Monitor for property managers.', src: '/assets/landing/work/atrium-page.jpg', url: 'practicepro.ng/atrium', kind: 'browser', badge: LIVE },
        { id: 'dashboard', label: 'Dashboard', caption: 'The portfolio at a glance — managed units, tasks and rent status, from the real product.', src: '/assets/landing/work/atrium-demo-dashboard.jpg', url: 'app — dashboard', kind: 'browser', badge: APP },
        { id: 'financials', label: 'Financials', caption: 'Revenue, invoices and service-charge tracking with overdue flags — the real financials view.', src: '/assets/landing/work/atrium-demo-financials.jpg', url: 'app — financials', kind: 'browser', badge: APP },
        { id: 'mobile', label: 'Mobile app', caption: 'Collected revenue, outstanding balances and invoices in the PracticePro Android app.', src: '/assets/landing/work/atrium-financials.jpg', url: 'the mobile app', kind: 'phone', badge: MOBILE },
        { id: 'portal', label: "Residents' portal", caption: "The residents' portal sign-in — statements, payments and maintenance requests.", src: '/assets/landing/work/atrium-portal.jpg', url: 'practicepro.ng/portal/tenant', kind: 'browser', badge: LIVE },
    ],
    kozy: [
        { id: 'home', label: 'Home', caption: 'The home page — "Uncompromising care. Exceptional convenience." Dry cleaning and laundry with pickup booking.', src: '/assets/landing/work/kozy-home.jpg', url: 'kozycare.ng', kind: 'browser', badge: LIVE },
        { id: 'services', label: 'Services', caption: "The services catalogue — men's and women's dry cleaning, home linens, shoe care and alterations.", src: '/assets/landing/work/kozy-services.jpg', url: 'kozycare.ng/services', kind: 'browser', badge: LIVE },
        { id: 'order-service', label: 'Order · items', caption: 'Ordering, step one — per-item or per-kg, full service, wash & fold or iron only, with live naira pricing for every garment.', src: '/assets/landing/work/kozy-order-service.jpg', url: 'kozycare.ng — signed in', kind: 'browser', badge: LIVE },
        { id: 'order-logistics', label: 'Order · pickup', caption: 'Pickup and delivery — date, one-hour slots, and turnaround from standard 3–5 days to 24-hour express.', src: '/assets/landing/work/kozy-order-logistics.jpg', url: 'kozycare.ng — signed in', kind: 'browser', badge: LIVE },
        { id: 'order-checkout', label: 'Order · checkout', caption: 'Checkout — the live quote with first-order and online discounts applied, paid by card or bank transfer.', src: '/assets/landing/work/kozy-order-checkout.jpg', url: 'kozycare.ng — signed in', kind: 'browser', badge: LIVE },
        { id: 'portal-order', label: 'Portal', caption: "The customer portal — an active order with its status timeline, exactly as the customer tracks it.", src: '/assets/landing/work/kozy-portal-order.jpg', url: 'kozycare.ng/portal', kind: 'browser', badge: LIVE },
        { id: 'order-detail', label: 'Order detail', caption: 'Inside the order — progress, items, payment and the event timeline in one view.', src: '/assets/landing/work/kozy-order-detail.jpg', url: 'kozycare.ng/portal', kind: 'browser', badge: LIVE },
        { id: 'invoice', label: 'Invoice', caption: 'The invoice — itemised in naira, printable and downloadable as PDF.', src: '/assets/landing/work/kozy-invoice.jpg', url: 'kozycare.ng/portal', kind: 'browser', badge: LIVE },
        { id: 'memberships', label: 'Memberships', caption: 'Kozy Circle membership plans with laundry pricing.', src: '/assets/landing/work/kozy-memberships.jpg', url: 'kozycare.ng/memberships', kind: 'browser', badge: LIVE },
        { id: 'membership-join', label: 'Join', caption: "Inside the portal's membership tab — joining the Kozy Circle.", src: '/assets/landing/work/kozy-membership-join.jpg', url: 'kozycare.ng/portal', kind: 'browser', badge: LIVE },
        { id: 'membership-active', label: 'Member', caption: 'An active membership on a live account — the plan, its countdown and the benefits.', src: '/assets/landing/work/kozy-membership-active.jpg', url: 'kozycare.ng/portal', kind: 'phone', badge: LIVE },
        { id: 'admin-kanban', label: 'Admin · orders', caption: "The admin console's order board — every order moved from pickup to delivery.", src: '/assets/landing/work/kozy-admin-kanban.jpg', url: 'the admin console', kind: 'browser', badge: LIVE },
        { id: 'admin-crm', label: 'Admin · CRM', caption: 'The CRM — customers with lifetime value, MEMBER badges and their own ordering rhythm.', src: '/assets/landing/work/kozy-admin-crm.jpg', url: 'the admin console', kind: 'browser', badge: APP },
        { id: 'admin-members', label: 'Admin · members', caption: 'Membership operations — verify a transfer receipt, activate or reject, in one place.', src: '/assets/landing/work/kozy-admin-members.jpg', url: 'the admin console', kind: 'browser', badge: LIVE },
        { id: 'riders', label: 'Riders', caption: 'Rider recruitment — GPS dispatch across 12 Lagos zones.', src: '/assets/landing/work/kozy-join-riders.jpg', url: 'kozycare.ng/join-riders', kind: 'browser', badge: LIVE },
        { id: 'partners', label: 'Partners', caption: 'The partner network — other laundry operators running under the Kozy brand.', src: '/assets/landing/work/kozy-partners.jpg', url: 'kozycare.ng/partners', kind: 'browser', badge: LIVE },
    ],
    woosh: [
        { id: 'home', label: 'The tool', caption: 'The tool itself — a free temporary email address in one click. No sign-up, no personal details.', src: '/assets/landing/work/woosh-home.jpg', url: 'woosh.dpdns.org', kind: 'browser', badge: LIVE },
        { id: 'inbox', label: 'Live inbox', caption: "A live inbox receiving real mail — Kozy Care's signup verification and payment notice, seconds after they were sent.", src: '/assets/landing/work/woosh-inbox.jpg', url: 'woosh.dpdns.org', kind: 'browser', badge: LIVE },
        { id: 'message', label: 'Message', caption: 'The verification email opened — codes and links are extracted for you, so a test rig (or a human) can copy them in one tap.', src: '/assets/landing/work/woosh-message.jpg', url: 'woosh.dpdns.org', kind: 'browser', badge: LIVE },
        { id: 'dark', label: 'Dark mode', caption: 'Dark mode, shareable inbox links and desktop notifications — built like a consumer product.', src: '/assets/landing/work/woosh-dark.jpg', url: 'woosh.dpdns.org', kind: 'browser', badge: LIVE },
        { id: 'api', label: 'API', caption: 'The developer side — a documented API with webhooks, revocable API keys and an llms.txt prompt block for AI agents.', src: '/assets/landing/work/woosh-api.jpg', url: 'woosh.dpdns.org/api-docs', kind: 'browser', badge: LIVE },
    ],
};

// ─── The stage — a real capture in an honest device frame ──────────────────

const RealStage: React.FC<{ screen: RealScreen }> = ({ screen }) => (
    <div key={`${screen.kind}-${screen.src}`} className="w9-tour-swap">
        {screen.kind === 'phone' ? (
            <div className="flex justify-center">
                <div className="w-[178px] rounded-[1.4rem] border-[5px] border-[#1A2334] bg-black overflow-hidden shadow-xl shadow-slate-900/25">
                    <div className="relative">
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full bg-white/20 z-10" aria-hidden="true" />
                        <img src={screen.src} alt={screen.caption} loading="lazy" className="w-full aspect-[9/20] object-cover object-top block" />
                    </div>
                </div>
            </div>
        ) : (
            <div className="rounded-xl border border-slate-200 bg-[#0E1626] overflow-hidden shadow-xl shadow-slate-900/15">
                <div className="flex items-center gap-2 px-3 py-2 bg-[#111A2C] border-b border-white/[0.06]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" aria-hidden="true" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" aria-hidden="true" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" aria-hidden="true" />
                    <span className="flex-1 mx-1 px-3 py-1 rounded-md bg-black/40 text-[10px] leading-none text-slate-400 font-medium truncate min-h-[1.25rem] flex items-center">
                        {screen.url}
                    </span>
                </div>
                <img src={screen.src} alt={screen.caption} loading="lazy" className="w-full aspect-[16/10] object-cover object-top block" />
            </div>
        )}
    </div>
);

// ─── The player ────────────────────────────────────────────────────────────

const DWELL_MS = 7000;

/**
 * SystemTour — the interactive stage: the per-screen honesty badge, the
 * live capture, an auto-advance progress bar (pause on hover/keyboard
 * focus), a caption, and screen chips for direct navigation.
 */
export const SystemTour: React.FC<{ system: TourSystem }> = ({ system }) => {
    const screens = TOUR_SCREENS[system];
    const a = acc(system);
    const [idx, setIdx] = useState(0);
    const [paused, setPaused] = useState(false);
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    useEffect(() => {
        if (paused || reduced) return;
        const t = window.setTimeout(() => setIdx((i) => (i + 1) % screens.length), DWELL_MS);
        return () => window.clearTimeout(t);
    }, [idx, paused, reduced, screens.length]);

    const screen = screens[Math.min(idx, screens.length - 1)];

    return (
        <div
            className="w9-tour-stage rounded-2xl border border-slate-200 p-3 sm:p-4 relative"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
        >
            {/* Honesty badge — every screen says exactly what it is (P8). */}
            <div className="flex items-center justify-between gap-3 mb-3">
                <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9.5px] font-bold uppercase tracking-widest text-white whitespace-nowrap"
                    style={{ background: a.hex }}
                >
                    {screen.badge}
                </span>
                <div className="flex-1 h-1 rounded-full bg-slate-200/80 overflow-hidden hidden sm:block" aria-hidden="true">
                    {!paused && !reduced && (
                        <div key={idx} className="w9-tour-progress-fill h-full rounded-full" style={{ background: a.hex, '--w9-tour-t': `${DWELL_MS}ms` } as React.CSSProperties} />
                    )}
                </div>
                <span className="text-[9.5px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
                    {idx + 1} / {screens.length}
                </span>
            </div>

            {/* The screen — a real capture. */}
            <RealStage screen={screen} />

            {/* Caption + chips (chips are real buttons — the interactivity) */}
            <p className="text-[12px] leading-relaxed text-slate-600 font-medium mt-3 mb-3 min-h-[2.6em]">{screen.caption}</p>
            <div className="flex flex-wrap items-center gap-1.5">
                {screens.map((s, i) => (
                    <Button
                        key={s.id}
                        variant="bare"
                        onClick={() => setIdx(i)}
                        aria-pressed={i === idx}
                        className={`px-2.5 py-1 min-h-0 rounded-full text-[10.5px] font-bold border transition-all duration-300 ${i === idx ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'}`}
                        style={i === idx ? { background: a.hex } : undefined}
                    >
                        {s.label}
                    </Button>
                ))}
                <span className="ml-auto text-[9.5px] font-semibold text-slate-400 hidden sm:inline">Hover to pause</span>
            </div>
        </div>
    );
};

export default SystemTour;
