import React, { useEffect, useState } from 'react';
// ADR-0004: interactive elements use the ui/ Button primitive — the raw
// form-element ratchet must not grow.
import { Button } from '../ui';

/**
 * SystemTour — W15 "the informed tour".
 *
 * Owner direction after W14: the preview was real but not INFORMATIVE —
 * "it doesn't help the user have a sense of understanding as to how
 * something like this might apply to what they do." So every stop is now
 * a FEATURE STORY, built the way the effective vertical-SaaS sites build
 * them (Clio, Buildium):
 *
 *   • an outcome headline ("Run the firm from one screen"),
 *   • the real capture — with a Desktop / Mobile toggle wherever both
 *     form factors exist (W15: every surface is a REAL capture — live
 *     pages, the deployed Android app, or the real app on demo data),
 *   • a "What it takes" panel — the ingredients of the capability, so a
 *     visitor can think "Oh — I want my business to have this."
 *
 * Honesty policy (P8) is unchanged: every surface carries its own badge
 * (Live site / The real mobile app / Real app · demo data). Auto-advance,
 * hover/focus pause, progress bar and screen chips are carried over.
 *
 * W15 stop changes on Vega (owner review): the notifications panel is
 * GONE — the stop is Messages, the real outbox; the matters board and
 * the bare matter list are folded into "Matters" (the detail view); and
 * a new AI copilot stop shows ALOA.
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

// ─── The screen set — real captures, honestly labelled ─────────────────────

const LIVE = 'Live site';
const APP = 'Real app · demo data';
const MOBILE = 'The real mobile app';

/** One capture on one form factor. `kind` picks the device chrome. */
export type TourSurface = {
    src: string;
    url: string;
    badge: string;
    kind: 'browser' | 'phone';
};

/**
 * A tour stop = one capability, told as a story.
 * `desktop` / `mobile` are real captures; where both exist the player
 * shows a Desktop ⇄ Mobile toggle (owner direction, W15).
 */
export type TourStop = {
    id: string;
    label: string;            // the chip
    headline: string;         // the outcome — what the capability does FOR you
    caption: string;          // what the screen shows
    takes: string[];          // "What it takes" — the ingredients
    desktop?: TourSurface;
    mobile?: TourSurface;
};

export const TOUR_STOPS: Record<TourSystem, TourStop[]> = {
    vega: [
        {
            id: 'page', label: 'Product page',
            headline: 'The storefront that sells while you sleep',
            caption: 'The public product page — Practice Management for Nigerian law firms.',
            takes: [
                'Answers what, who and how much — before anyone picks up the phone',
                'Loads fast on the phones your clients actually use',
                'Every visit ends at one clear next step',
            ],
            desktop: { src: '/assets/landing/work/vega-page.jpg', url: 'practicepro.ng/vega', badge: LIVE, kind: 'browser' },
            mobile: { src: '/assets/landing/work/vega-m-page.jpg', url: 'practicepro.ng/vega', badge: LIVE, kind: 'phone' },
        },
        {
            id: 'dashboard', label: 'Dashboard',
            headline: 'Run the firm from one screen',
            caption: 'The firm at a glance — active matters, tasks and the court-rule calendar, straight from the real product.',
            takes: [
                'Live counts, not end-of-week reports',
                'Every number drills down to its list in one tap',
                'Cash position, workload and deadlines visible at once',
            ],
            desktop: { src: '/assets/landing/work/vega-demo-dashboard.jpg', url: 'app — dashboard', badge: APP, kind: 'browser' },
            mobile: { src: '/assets/landing/work/vega-m-dashboard.jpg', url: 'app — dashboard', badge: APP, kind: 'phone' },
        },
        {
            id: 'newmatter', label: 'New matter',
            headline: 'Intake that takes two minutes',
            caption: 'A matter being entered live — claimant, defendant, court, suit number; the deadline engine starts computing as you type.',
            takes: [
                'Parties, court and suit number captured once — used everywhere after',
                'Deadlines computed from court rules the moment you save',
                'Nothing about the case lives only in a drawer or a chat thread',
            ],
            desktop: { src: '/assets/landing/work/vega-demo-newmatter.jpg', url: 'app — new matter', badge: APP, kind: 'browser' },
        },
        {
            id: 'matters', label: 'Matters',
            headline: 'Every case, every stage, every deadline',
            caption: 'Inside a matter — strategy notes, tasks and the process tracker, exactly as the firm sees it.',
            takes: [
                'Stages that mirror how your practice actually runs',
                'Notes, tasks, documents and finance on a single file',
                'The client watches the same progress in their portal',
            ],
            desktop: { src: '/assets/landing/work/vega-demo-matter-detail.jpg', url: 'app — matter detail', badge: APP, kind: 'browser' },
            mobile: { src: '/assets/landing/work/vega-m-matters.jpg', url: 'app — matter detail', badge: APP, kind: 'phone' },
        },
        {
            id: 'billing', label: 'Billing',
            headline: 'Get paid without the chase',
            caption: 'Invoices, receipts and overdue tracking — naira-first revenue operations in the real product.',
            takes: [
                'Invoices and receipts generated from the matter itself',
                'Overdue flagged before an invoice ages',
                'Naira-first: bank transfer and card, the way clients actually pay',
            ],
            desktop: { src: '/assets/landing/work/vega-demo-billing.jpg', url: 'app — financials', badge: APP, kind: 'browser' },
            mobile: { src: '/assets/landing/work/vega-m-billing.jpg', url: 'app — financials', badge: APP, kind: 'phone' },
        },
        {
            id: 'calendar', label: 'Calendar',
            headline: 'Deadlines that compute themselves',
            caption: 'Court-rule-aware calendaring — hearings, filings and conflicts, on the web and in the Android app.',
            takes: [
                'Filing and service rules encoded per court — dates derive themselves',
                'Reminders land by WhatsApp, SMS and email',
                'Scheduling conflicts surface before they cost you the case',
            ],
            desktop: { src: '/assets/landing/work/vega-demo-calendar.jpg', url: 'app — calendar', badge: APP, kind: 'browser' },
            mobile: { src: '/assets/landing/work/vega-calendar.jpg', url: 'the mobile app', badge: MOBILE, kind: 'phone' },
        },
        {
            id: 'messages', label: 'Messages',
            headline: 'Meet clients where they already are',
            caption: 'One outbox for WhatsApp, email and the portal — every send recorded on the matter.',
            takes: [
                'WhatsApp, email and portal from a single compose window',
                'Templates for the updates you send every week',
                'Every send lands on the client\u2019s matter record',
            ],
            desktop: { src: '/assets/landing/work/vega-demo-messages.jpg', url: 'app — messages', badge: APP, kind: 'browser' },
            mobile: { src: '/assets/landing/work/vega-m-messages.jpg', url: 'app — messages', badge: APP, kind: 'phone' },
        },
        {
            id: 'aloa', label: 'AI copilot',
            headline: 'First drafts in minutes, not evenings',
            caption: 'ALOA, the firm\u2019s legal copilot — draft notices, summarize cases, surface what\u2019s due.',
            takes: [
                'Starts from your templates and your matter data — not a blank page',
                'Drafts in the language of Nigerian practice',
                'You review and approve; every draft saves to the matter',
            ],
            desktop: { src: '/assets/landing/work/vega-demo-aloa.jpg', url: 'app — ALOA', badge: APP, kind: 'browser' },
        },
        {
            id: 'portal', label: 'Client portal',
            headline: 'Clients help themselves — day and night',
            caption: 'The client portal sign-in — clients track their matters themselves, at any hour.',
            takes: [
                'Case progress without a single status phone call',
                'Documents and invoices in one place, always current',
                'Branded to the firm — your portal, not ours',
            ],
            desktop: { src: '/assets/landing/work/vega-portal.jpg', url: 'practicepro.ng/portal/client', badge: LIVE, kind: 'browser' },
            mobile: { src: '/assets/landing/work/vega-m-portal.jpg', url: 'practicepro.ng/portal/client', badge: LIVE, kind: 'phone' },
        },
    ],
    atrium: [
        {
            id: 'page', label: 'Product page',
            headline: 'First impressions that win mandates',
            caption: 'The public product page — the Revenue Monitor for property managers.',
            takes: [
                'Answers what, who and how much — before anyone picks up the phone',
                'Loads fast on the phones your clients actually use',
                'Every visit ends at one clear next step',
            ],
            desktop: { src: '/assets/landing/work/atrium-page.jpg', url: 'practicepro.ng/atrium', badge: LIVE, kind: 'browser' },
            mobile: { src: '/assets/landing/work/atrium-m-page.jpg', url: 'practicepro.ng/atrium', badge: LIVE, kind: 'phone' },
        },
        {
            id: 'dashboard', label: 'Dashboard',
            headline: 'Know your portfolio before breakfast',
            caption: 'The portfolio at a glance — managed units, tasks and rent status, from the real product.',
            takes: [
                'Occupancy, collections and overdue in one view',
                'Every unit one tap from its full record',
                'Workload and risk visible per staff member',
            ],
            desktop: { src: '/assets/landing/work/atrium-demo-dashboard.jpg', url: 'app — dashboard', badge: APP, kind: 'browser' },
            mobile: { src: '/assets/landing/work/atrium-m-dashboard.jpg', url: 'app — dashboard', badge: APP, kind: 'phone' },
        },
        {
            id: 'financials', label: 'Financials',
            headline: 'Revenue without spreadsheets',
            caption: 'Revenue, invoices and service-charge tracking with overdue flags — the real financials view.',
            takes: [
                'Rent, service charge and MV tracked per unit, in naira',
                'Defaulters flagged and escalated automatically',
                'Statements ready for owners and auditors, any day of the month',
            ],
            desktop: { src: '/assets/landing/work/atrium-demo-financials.jpg', url: 'app — financials', badge: APP, kind: 'browser' },
            mobile: { src: '/assets/landing/work/atrium-financials.jpg', url: 'the mobile app', badge: MOBILE, kind: 'phone' },
        },
        {
            id: 'portal', label: "Residents' portal",
            headline: 'Residents serve themselves',
            caption: "The residents' portal sign-in — statements, payments and maintenance requests.",
            takes: [
                'Statements and receipts without office calls',
                'Maintenance requests flow straight into your workflow',
                'Payment status visible to residents 24/7 — and to you',
            ],
            desktop: { src: '/assets/landing/work/atrium-portal.jpg', url: 'practicepro.ng/portal/tenant', badge: LIVE, kind: 'browser' },
            mobile: { src: '/assets/landing/work/atrium-m-portal.jpg', url: 'practicepro.ng/portal/tenant', badge: LIVE, kind: 'phone' },
        },
    ],
    kozy: [
        {
            id: 'home', label: 'Home',
            headline: 'An ordinary business, running on extraordinary systems',
            caption: 'The home page — “Uncompromising care. Exceptional convenience.” Dry cleaning and laundry with pickup booking.',
            takes: [
                'A brand customers remember — and come back to',
                'Booking in minutes, on any phone',
                'The offer, the price and the promise on one page',
            ],
            desktop: { src: '/assets/landing/work/kozy-home.jpg', url: 'kozycare.ng', badge: LIVE, kind: 'browser' },
            mobile: { src: '/assets/landing/work/kozy-m-home.jpg', url: 'kozycare.ng', badge: LIVE, kind: 'phone' },
        },
        {
            id: 'services', label: 'Services',
            headline: 'Priced like a menu, ordered like a meal',
            caption: "The services catalogue — men's and women's dry cleaning, home linens, shoe care and alterations.",
            takes: [
                'Every item priced in naira — updated once, live everywhere',
                'No back-and-forth quotes over WhatsApp',
                'New services go live in minutes, not print runs',
            ],
            desktop: { src: '/assets/landing/work/kozy-services.jpg', url: 'kozycare.ng/services', badge: LIVE, kind: 'browser' },
            mobile: { src: '/assets/landing/work/kozy-m-services.jpg', url: 'kozycare.ng/services', badge: LIVE, kind: 'phone' },
        },
        {
            id: 'order', label: 'Ordering',
            headline: 'From item to quote in one screen',
            caption: 'Ordering, step one — per-item or per-kg, full service, wash & fold or iron only, with live naira pricing for every garment.',
            takes: [
                'A live quote as the customer picks — no waiting for a reply',
                'Per-item or per-kg, iron-only or full service — priced live',
                'Works for guests and members alike',
            ],
            desktop: { src: '/assets/landing/work/kozy-order-service.jpg', url: 'kozycare.ng — signed in', badge: LIVE, kind: 'browser' },
        },
        {
            id: 'logistics', label: 'Pickup',
            headline: 'Collected on schedule, not on hope',
            caption: 'Pickup and delivery — date, one-hour slots, and turnaround from standard 3–5 days to 24-hour express.',
            takes: [
                'One-hour pickup slots the customer picks themselves',
                'Express turnaround when the customer will pay for speed',
                'Zones and capacity the system already knows',
            ],
            desktop: { src: '/assets/landing/work/kozy-order-logistics.jpg', url: 'kozycare.ng — signed in', badge: LIVE, kind: 'browser' },
        },
        {
            id: 'checkout', label: 'Checkout',
            headline: 'Payment that closes itself',
            caption: 'Checkout — the live quote with first-order and online discounts applied, paid by card or bank transfer.',
            takes: [
                'Card or transfer — the ways Nigerians actually pay',
                'Discounts applied by the system, not by memory',
                'Every payment receipted and reconciled automatically',
            ],
            desktop: { src: '/assets/landing/work/kozy-order-checkout.jpg', url: 'kozycare.ng — signed in', badge: LIVE, kind: 'browser' },
        },
        {
            id: 'portal', label: 'Customer portal',
            headline: '“Where are my clothes?” — answered by the system',
            caption: 'The customer portal — an active order with its status timeline, exactly as the customer tracks it.',
            takes: [
                'Live status timeline instead of status calls',
                'Order history, invoices and memberships in one place',
                'Self-service customers actually enjoy using',
            ],
            desktop: { src: '/assets/landing/work/kozy-portal-order.jpg', url: 'kozycare.ng/portal', badge: LIVE, kind: 'browser' },
        },
        {
            id: 'order-detail', label: 'Order detail',
            headline: 'Every order, fully accounted for',
            caption: 'Inside the order — progress, items, payment and the event timeline in one view.',
            takes: [
                'Progress, items, payment and history on one screen',
                'The same record the customer sees — no two versions of truth',
                'Disputes end fast, because the trail is complete',
            ],
            desktop: { src: '/assets/landing/work/kozy-order-detail.jpg', url: 'kozycare.ng/portal', badge: LIVE, kind: 'browser' },
        },
        {
            id: 'invoice', label: 'Invoice',
            headline: 'Receipts that look like the brand',
            caption: 'The invoice — itemised in naira, printable and downloadable as PDF.',
            takes: [
                'Itemised, branded, and downloadable as PDF',
                'Generated by the system at the moment of payment',
                'Books that reconcile themselves',
            ],
            desktop: { src: '/assets/landing/work/kozy-invoice.jpg', url: 'kozycare.ng/portal', badge: LIVE, kind: 'browser' },
        },
        {
            id: 'memberships', label: 'Memberships',
            headline: 'Revenue that repeats',
            caption: 'Kozy Circle membership plans — recurring revenue with member pricing.',
            takes: [
                'Plans that turn one-off customers into monthly revenue',
                'Member pricing applied automatically at checkout',
                'The membership lives on the account, not on a paper card',
            ],
            desktop: { src: '/assets/landing/work/kozy-memberships.jpg', url: 'kozycare.ng/memberships', badge: LIVE, kind: 'browser' },
            mobile: { src: '/assets/landing/work/kozy-membership-active.jpg', url: 'kozycare.ng/portal', badge: LIVE, kind: 'phone' },
        },
        {
            id: 'membership-join', label: 'Join',
            headline: 'Signing up takes one sitting',
            caption: "Inside the portal's membership tab — joining the Kozy Circle.",
            takes: [
                'Joining without a phone call or a shop visit',
                'Payment verified, then the plan activates itself',
                'The customer sees their benefits immediately',
            ],
            desktop: { src: '/assets/landing/work/kozy-membership-join.jpg', url: 'kozycare.ng/portal', badge: LIVE, kind: 'browser' },
        },
        {
            id: 'admin-kanban', label: 'Order board',
            headline: 'Operations on a board, not a whiteboard',
            caption: "The admin console's order board — every order moved from pickup to delivery.",
            takes: [
                'Every order visible from pickup to delivery, at a glance',
                'Bottlenecks show up as piles on the board',
                'Multi-branch, one console',
            ],
            desktop: { src: '/assets/landing/work/kozy-admin-kanban.jpg', url: 'the admin console', badge: LIVE, kind: 'browser' },
        },
        {
            id: 'admin-crm', label: 'CRM',
            headline: 'Know who your best customers are',
            caption: 'The CRM — customers with lifetime value, MEMBER badges and their own ordering rhythm.',
            takes: [
                'Lifetime value computed per customer — not guessed',
                'Members flagged, with their ordering rhythm visible',
                'Marketing that targets behaviour, not broadcast',
            ],
            desktop: { src: '/assets/landing/work/kozy-admin-crm.jpg', url: 'the admin console', badge: APP, kind: 'browser' },
        },
        {
            id: 'admin-members', label: 'Members',
            headline: 'Money handled carefully',
            caption: 'Membership operations — verify a transfer receipt, activate or reject, in one place.',
            takes: [
                'Transfer receipts verified before activation',
                'One place to activate, reject or review a member',
                'An audit trail for every decision',
            ],
            desktop: { src: '/assets/landing/work/kozy-admin-members.jpg', url: 'the admin console', badge: LIVE, kind: 'browser' },
        },
        {
            id: 'riders', label: 'Riders',
            headline: 'The fleet that runs itself',
            caption: 'Rider recruitment — GPS dispatch across 12 Lagos zones.',
            takes: [
                'Pickup and delivery slots assigned by zone, not by phone call',
                'Recruitment, onboarding and dispatch in the same system',
                'Capacity that grows with demand',
            ],
            desktop: { src: '/assets/landing/work/kozy-join-riders.jpg', url: 'kozycare.ng/join-riders', badge: LIVE, kind: 'browser' },
        },
        {
            id: 'partners', label: 'Partners',
            headline: 'A network that scales past your walls',
            caption: 'The partner network — other laundry operators running under the Kozy brand.',
            takes: [
                'Other operators run under the brand — the platform does the policing',
                'Standards, pricing and orders flow through one system',
                'Growth without buying a single new machine',
            ],
            desktop: { src: '/assets/landing/work/kozy-partners.jpg', url: 'kozycare.ng/partners', badge: LIVE, kind: 'browser' },
        },
    ],
    woosh: [
        {
            id: 'home', label: 'The tool',
            headline: 'A free tool people actually keep using',
            caption: 'The tool itself — a free temporary email address in one click. No sign-up, no personal details.',
            takes: [
                'One click to a working inbox — nothing to sign up for',
                'Keeps spam out of real mailboxes',
                'Built like a consumer product, because it is one',
            ],
            desktop: { src: '/assets/landing/work/woosh-home.jpg', url: 'woosh.dpdns.org', badge: LIVE, kind: 'browser' },
        },
        {
            id: 'inbox', label: 'Live inbox',
            headline: 'Proof, arriving in seconds',
            caption: "A live inbox receiving real mail — Kozy Care's signup verification and payment notice, seconds after they were sent.",
            takes: [
                'Real mail, received in seconds — this page is the test rig\u2019s eyes',
                'Our own signup and payment batteries run on it daily',
                'Inbox links shareable, so teams can look together',
            ],
            desktop: { src: '/assets/landing/work/woosh-inbox.jpg', url: 'woosh.dpdns.org', badge: LIVE, kind: 'browser' },
        },
        {
            id: 'message', label: 'Message',
            headline: 'The code, already picked out for you',
            caption: 'The verification email opened — codes and links are extracted for you, so a test rig (or a human) can copy them in one tap.',
            takes: [
                'Verification codes and links extracted automatically',
                'One tap to copy — no squinting through HTML',
                'Humans and test rigs read the same box',
            ],
            desktop: { src: '/assets/landing/work/woosh-message.jpg', url: 'woosh.dpdns.org', badge: LIVE, kind: 'browser' },
        },
        {
            id: 'dark', label: 'Dark mode',
            headline: 'The details that make it feel finished',
            caption: 'Dark mode, shareable inbox links and desktop notifications — built like a consumer product.',
            takes: [
                'Dark mode, notifications, shareable links — the polish matters',
                'The same care we put into client systems, spent on our own tool',
                'Free — no sign-up, no personal details harvested',
            ],
            desktop: { src: '/assets/landing/work/woosh-dark.jpg', url: 'woosh.dpdns.org', badge: LIVE, kind: 'browser' },
        },
        {
            id: 'api', label: 'API',
            headline: 'A developer surface, documented',
            caption: 'The developer side — a documented API with webhooks, revocable API keys and an llms.txt prompt block for AI agents.',
            takes: [
                'REST API with webhooks — push instead of poll',
                'Revocable keys, real docs, a console',
                'Even an llms.txt block, so AI agents can use it too',
            ],
            desktop: { src: '/assets/landing/work/woosh-api.jpg', url: 'woosh.dpdns.org/api-docs', badge: LIVE, kind: 'browser' },
        },
    ],
};

// ─── The stage — a real capture in an honest device frame ──────────────────

const RealStage: React.FC<{ surface: TourSurface }> = ({ surface }) => (
    <div key={`${surface.kind}-${surface.src}`} className="w9-tour-swap">
        {surface.kind === 'phone' ? (
            <div className="flex justify-center">
                <div className="w-[178px] rounded-[1.4rem] border-[5px] border-[#1A2334] bg-black overflow-hidden shadow-xl shadow-slate-900/25">
                    <div className="relative">
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-1.5 rounded-full bg-white/20 z-10" aria-hidden="true" />
                        <img src={surface.src} alt={surface.url} loading="lazy" className="w-full aspect-[9/20] object-cover object-top block" />
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
                        {surface.url}
                    </span>
                </div>
                <img src={surface.src} alt={surface.url} loading="lazy" className="w-full aspect-[16/10] object-cover object-top block" />
            </div>
        )}
    </div>
);

// ─── The player ────────────────────────────────────────────────────────────

const DWELL_MS = 9000;

/**
 * SystemTour — the interactive stage.
 *
 * Top row: the per-surface honesty badge, the auto-advance progress bar
 * and the stop counter. Below: the screen with its Desktop ⇄ Mobile
 * toggle (where both form factors exist), the outcome headline, the
 * caption and the "What it takes" panel. Chips navigate directly.
 */
export const SystemTour: React.FC<{ system: TourSystem }> = ({ system }) => {
    const stops = TOUR_STOPS[system];
    const a = acc(system);
    const [idx, setIdx] = useState(0);
    const [surface, setSurface] = useState<'desktop' | 'mobile'>('desktop');
    const [paused, setPaused] = useState(false);
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const stop = stops[Math.min(idx, stops.length - 1)];
    const hasBoth = !!stop.desktop && !!stop.mobile;
    const activeSurface: TourSurface = (surface === 'mobile' && stop.mobile) ? stop.mobile : (stop.desktop ?? stop.mobile!);

    useEffect(() => {
        if (paused || reduced) return;
        const t = window.setTimeout(() => setIdx((i) => (i + 1) % stops.length), DWELL_MS);
        return () => window.clearTimeout(t);
    }, [idx, paused, reduced, stops.length]);

    // Switching stops resets to the desktop surface — the "big" view first.
    const gotoStop = (i: number) => {
        setIdx(i);
        setSurface('desktop');
    };

    return (
        <div
            className="w9-tour-stage rounded-2xl border border-slate-200 p-3 sm:p-4 relative"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
        >
            {/* Honesty badge + progress + counter */}
            <div className="flex items-center justify-between gap-3 mb-3">
                <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9.5px] font-bold uppercase tracking-widest text-white whitespace-nowrap"
                    style={{ background: a.hex }}
                >
                    {activeSurface.badge}
                </span>
                <div className="flex-1 h-1 rounded-full bg-slate-200/80 overflow-hidden hidden sm:block" aria-hidden="true">
                    {!paused && !reduced && (
                        <div key={idx} className="w9-tour-progress-fill h-full rounded-full" style={{ background: a.hex, '--w9-tour-t': `${DWELL_MS}ms` } as React.CSSProperties} />
                    )}
                </div>
                <span className="text-[9.5px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">
                    {idx + 1} / {stops.length}
                </span>
            </div>

            {/* Screen + insight, side by side where there is room */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr] gap-4 lg:gap-5 items-start">
                {/* The screen — a real capture, with the form-factor toggle */}
                <div>
                    <RealStage surface={activeSurface} />
                    {hasBoth && (
                        <div className="flex justify-center mt-3" role="group" aria-label="Form factor">
                            <div className="inline-flex p-0.5 rounded-full bg-slate-100 border border-slate-200">
                                {(['desktop', 'mobile'] as const).map((f) => (
                                    <Button
                                        key={f}
                                        variant="bare"
                                        onClick={() => setSurface(f)}
                                        aria-pressed={surface === f}
                                        className={`px-3.5 py-1 min-h-0 rounded-full text-[10.5px] font-bold uppercase tracking-wider transition-all ${surface === f ? 'text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                        style={surface === f ? { background: a.hex } : undefined}
                                    >
                                        {f === 'desktop' ? 'Desktop' : 'Mobile'}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* The insight — outcome, caption, what it takes */}
                <div key={stop.id} className="w9-tour-swap">
                    <h4 className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-snug">
                        {stop.headline}
                    </h4>
                    <p className="text-[12.5px] leading-relaxed text-slate-600 font-medium mt-1.5">
                        {stop.caption}
                    </p>
                    <p className="text-[9.5px] font-bold uppercase tracking-widest text-slate-400 mt-4 mb-2">
                        What it takes
                    </p>
                    <ul className="space-y-2">
                        {stop.takes.map((t) => (
                            <li key={t} className="flex items-start gap-2 text-[12px] leading-relaxed text-slate-700">
                                <span
                                    className="mt-[3px] w-1.5 h-1.5 rounded-full flex-shrink-0"
                                    style={{ background: a.hex }}
                                    aria-hidden="true"
                                />
                                {t}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Chips (real buttons — the interactivity) */}
            <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-3 border-t border-slate-100">
                {stops.map((s, i) => (
                    <Button
                        key={s.id}
                        variant="bare"
                        onClick={() => gotoStop(i)}
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
