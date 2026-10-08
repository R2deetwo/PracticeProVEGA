import React, { useEffect, useState } from 'react';
import {
    BellIcon, ChatAltIcon, MailIcon, PhoneIcon, MessagingIcon, CalendarIcon,
    BanknotesIcon, DashboardIcon, TasksIcon, UsersIcon, MapPinIcon, CheckIcon,
    CheckCircleIcon, ExclamationTriangleIcon, ClockIcon, DocumentTextIcon,
    ChartBarIcon, CogIcon, MattersIcon, SparklesIcon, SendIcon, DeviceMobileIcon,
    NairaCircleIcon,
} from '../../constants';
// ADR-0004: interactive elements use the ui/ Button primitive — the raw
// form-element ratchet must not grow.
import { Button } from '../ui';

/**
 * SystemTour — W9 "the living page": the preview that goes INSIDE.
 *
 * Owner direction on the W8 portfolio preview: "Preview the system could be
 * more interactive… you could see a bit more into the system rather than
 * just a few things" — and specifically: notifications/banners, things
 * being entered, the client portal, payments, and Kozy Care's members,
 * ordering, customer portal and admin console.
 *
 * The logged-in screens of real systems hold real client data, so they
 * cannot be captured for a public site. This tour is the honest
 * answer: the systems' actual workflows rebuilt as a guided, animated
 * walk-through with clearly-labeled DEMO data — every name, matter, unit
 * and order below is fictional. The visitor steps through the areas that
 * matter (or lets the tour walk itself), and everything moves: banners
 * cycle, forms type themselves, bars grow, orders move through their
 * pipeline.
 *
 * Honesty rules (P8, same spirit as the W3 testimonial rules): the demo
 * badge is always visible, there are no ratings and no testimonials, and
 * nothing claims to be a real capture — the REAL screens live in the
 * modal's "Live screens" view, right next to this tour.
 */

// ─── Per-system accents ────────────────────────────────────────────────────

export type TourSystem = 'vega' | 'atrium' | 'kozy';

const ACCENTS: Record<TourSystem, { hex: string; soft: string; text: string; ring: string; chipBg: string }> = {
    vega: { hex: '#D97706', soft: 'rgba(217,119,6,0.10)', text: '#B45309', ring: 'rgba(217,119,6,0.35)', chipBg: 'rgba(217,119,6,0.12)' },
    atrium: { hex: '#059669', soft: 'rgba(5,150,105,0.10)', text: '#047857', ring: 'rgba(5,150,105,0.35)', chipBg: 'rgba(5,150,105,0.12)' },
    kozy: { hex: '#16A34A', soft: 'rgba(22,163,74,0.10)', text: '#15803D', ring: 'rgba(22,163,74,0.35)', chipBg: 'rgba(22,163,74,0.12)' },
};

// ─── Motion helpers ────────────────────────────────────────────────────────

const prefersReduced = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Types `text` on a loop — "something actually being entered". */
const useTyping = (text: string, speed = 46, holdMs = 2800) => {
    const [n, setN] = useState(() => (prefersReduced() ? text.length : 0));
    useEffect(() => {
        if (prefersReduced()) { setN(text.length); return; }
        let i = 0;
        let timer = 0;
        const tick = () => {
            i += 1;
            setN(i);
            if (i < text.length) timer = window.setTimeout(tick, speed + Math.random() * 50);
            else timer = window.setTimeout(() => { i = 0; setN(0); timer = window.setTimeout(tick, 650); }, holdMs);
        };
        timer = window.setTimeout(tick, 800);
        return () => window.clearTimeout(timer);
    }, [text, speed, holdMs]);
    return text.slice(0, n);
};

const TypingField: React.FC<{ label: string; text: string; accent: ReturnType<typeof acc> }> = ({ label, text, accent }) => {
    const shown = useTyping(text);
    return (
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
            <p className="text-[12.5px] font-medium text-slate-800 leading-snug">
                {shown}<span className="w9-caret" style={{ color: accent.hex }} />
            </p>
        </div>
    );
};

/** Cycles array items on an interval — banners, statuses. */
const useCycle = <T,>(items: T[], ms: number) => {
    const [i, setI] = useState(0);
    useEffect(() => {
        if (prefersReduced() || items.length < 2) return;
        const t = window.setInterval(() => setI((v) => (v + 1) % items.length), ms);
        return () => window.clearInterval(t);
    }, [items.length, ms]);
    return items[i % items.length];
};

const acc = (s: TourSystem) => ACCENTS[s];

// ─── Tour kit — the little window everything renders in ────────────────────

const Win: React.FC<{
    system: TourSystem;
    title: string;
    nav: Array<{ label: string; Icon: React.ComponentType<{ className?: string }>; active?: boolean }>;
    children: React.ReactNode;
    sideNote?: string;
}> = ({ system, title, nav, children, sideNote }) => {
    const a = acc(system);
    return (
        <div className="w-full rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 overflow-hidden text-left">
            {/* window chrome */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                <span className="w-2 h-2 rounded-full bg-[#FF5F57]" />
                <span className="w-2 h-2 rounded-full bg-[#FEBC2E]" />
                <span className="w-2 h-2 rounded-full bg-[#28C840]" />
                <span className="flex-1 mx-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-[10px] text-slate-500 font-medium truncate flex items-center gap-1.5">
                    <DeviceMobileIcon className="w-2.5 h-2.5 flex-shrink-0" />
                    {title}
                </span>
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ background: a.hex }}>PP</span>
            </div>
            <div className="flex">
                {/* sidebar (desktop-width illustration only) */}
                <div className="hidden sm:flex flex-col gap-0.5 w-36 flex-shrink-0 border-r border-slate-100 bg-slate-50/60 p-2">
                    {nav.map((n) => (
                        <span
                            key={n.label}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-[10.5px] font-semibold ${n.active ? 'text-slate-900' : 'text-slate-400'}`}
                            style={n.active ? { background: a.chipBg, color: a.text } : undefined}
                        >
                            <n.Icon className="w-3.5 h-3.5 flex-shrink-0" />
                            {n.label}
                        </span>
                    ))}
                    {sideNote && <p className="mt-auto px-2 pt-3 text-[8.5px] leading-snug text-slate-300 font-semibold uppercase tracking-wider">{sideNote}</p>}
                </div>
                <div className="flex-1 min-w-0 p-3 sm:p-4">{children}</div>
            </div>
        </div>
    );
};

const Stat: React.FC<{ label: string; value: string; sub?: string; tone?: 'good' | 'warn' | 'bad'; system: TourSystem }> = ({ label, value, sub, tone, system }) => {
    const a = acc(system);
    const color = tone === 'bad' ? '#DC2626' : tone === 'warn' ? '#B45309' : tone === 'good' ? '#047857' : a.text;
    return (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 truncate">{label}</p>
            <p className="text-lg sm:text-xl font-extrabold tracking-tight leading-tight" style={{ color }}>{value}</p>
            {sub && <p className="text-[9.5px] text-slate-400 font-medium truncate">{sub}</p>}
        </div>
    );
};

const Chip: React.FC<{ children: React.ReactNode; tone?: 'plain' | 'on' | 'warn' | 'bad' | 'good' }> = ({ children, tone = 'plain' }) => {
    const cls =
        tone === 'on' ? 'bg-slate-900 text-white' :
        tone === 'warn' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
        tone === 'bad' ? 'bg-red-50 text-red-700 border border-red-200' :
        tone === 'good' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
        'bg-slate-100 text-slate-600 border border-slate-200';
    return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold ${cls}`}>{children}</span>;
};

/** The animated alert banner — the "banner system" the owner asked to see. */
const Banner: React.FC<{ items: Array<{ tone: 'warn' | 'bad' | 'good'; text: string }> }> = ({ items }) => {
    const cur = useCycle(items, 3400);
    const bg = cur.tone === 'bad' ? 'bg-red-50 border-red-200 text-red-700' : cur.tone === 'good' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-800';
    const Icon = cur.tone === 'good' ? CheckCircleIcon : ExclamationTriangleIcon;
    return (
        <div key={cur.text} className={`w9-banner-in flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px] font-semibold ${bg}`} role="status">
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="leading-snug">{cur.text}</span>
        </div>
    );
};

const Row: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border border-slate-100 bg-white ${className}`}>{children}</div>
);

// ─── The screens ───────────────────────────────────────────────────────────
// Every screen is an illustration with fictional data (aria-hidden above).

type ScreenDef = { id: string; label: string; caption: string; render: (system: TourSystem) => React.ReactNode };

// — Vega —

const VegaDashboard: React.FC = () => (
    <Win
        system="vega" title="app.practicepro.ng — Vega · Adeyemi Chambers"
        nav={[
            { label: 'Dashboard', Icon: DashboardIcon, active: true },
            { label: 'Matters', Icon: MattersIcon },
            { label: 'Calendar', Icon: CalendarIcon },
            { label: 'Billing', Icon: BanknotesIcon },
            { label: 'Clients', Icon: UsersIcon },
            { label: 'Settings', Icon: CogIcon },
        ]}
        sideNote="Vega · Legal Practice OS"
    >
        <div className="space-y-3">
            <Banner items={[
                { tone: 'warn', text: '2 court deadlines in the next 48 hours — filing rules auto-applied' },
                { tone: 'bad', text: 'Overdue task: file response — Meridian Logistics Ltd v. Bluecrest Bank' },
                { tone: 'good', text: 'Payment received: ₦450,000 — receipt sent automatically' },
            ]} />
            <div className="grid grid-cols-3 gap-2">
                <Stat system="vega" label="Active matters" value="24" sub="+3 this month" />
                <Stat system="vega" label="Deadlines · 7 days" value="6" sub="2 within 48 hrs" tone="warn" />
                <Stat system="vega" label="Unbilled work" value="₦1.24m" sub="12 matters" />
            </div>
            <div className="space-y-1.5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Next deadlines — computed from court rules</p>
                {[
                    ['Meridian Logistics Ltd v. Bluecrest Bank Plc', 'Filed · response due', 'bad'],
                    ['Adenia Realty v. Marina Heights Mgmt.', 'Hearing — Lagos Judicial Div.', 'warn'],
                    ['In re: Halcourt Estate letters of admin.', 'Filing window opens', 'good'],
                ].map(([m, s, tone]) => (
                    <Row key={m as string}>
                        <MattersIcon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <span className="flex-1 min-w-0 truncate text-[11.5px] font-semibold text-slate-700">{m}</span>
                        <Chip tone={tone as 'bad' | 'warn' | 'good'}>{s}</Chip>
                    </Row>
                ))}
            </div>
        </div>
    </Win>
);

const VegaNewMatter: React.FC = () => (
    <Win
        system="vega" title="app.practicepro.ng — Vega · New matter"
        nav={[
            { label: 'Dashboard', Icon: DashboardIcon },
            { label: 'Matters', Icon: MattersIcon, active: true },
            { label: 'Calendar', Icon: CalendarIcon },
            { label: 'Billing', Icon: BanknotesIcon },
            { label: 'Clients', Icon: UsersIcon },
        ]}
        sideNote="Vega · Legal Practice OS"
    >
        <div className="space-y-2.5">
            <TypingField label="Client" text="Meridian Logistics Ltd" accent={acc('vega')} />
            <TypingField label="Matter (AI is drafting the case skeleton in parallel)" text="Recovery of outstanding debt — ₦18.5m invoice suite" accent={acc('vega')} />
            <div className="flex flex-wrap gap-1.5">
                {['Debt recovery', 'High Court', 'Contested'].map((c, i) => <Chip key={c} tone={i === 0 ? 'on' : 'plain'}>{c}</Chip>)}
            </div>
            <Banner items={[
                { tone: 'good', text: 'Deadline engine: response due in 14 days — Lagos High Court (Civil Procedure) Rules' },
                { tone: 'warn', text: 'Conflict check passed — 1 similar party name flagged for review' },
            ]} />
            <div className="space-y-1.5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Tasks</p>
                <Row><CheckCircleIcon className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /><span className="flex-1 text-[11.5px] text-slate-600 font-medium line-through">Engagement letter sent</span><Chip tone="good">Done</Chip></Row>
                <Row className="border-red-200 bg-red-50/50"><ExclamationTriangleIcon className="w-3.5 h-3.5 text-red-500 flex-shrink-0" /><span className="flex-1 text-[11.5px] text-slate-700 font-semibold">Draft statement of claim</span><Chip tone="bad">Overdue · 2 days</Chip></Row>
                <Row><ClockIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" /><span className="flex-1 text-[11.5px] text-slate-600 font-medium">Assemble exhibits A–F</span><Chip>Due Fri</Chip></Row>
            </div>
        </div>
    </Win>
);

const VegaNotifications: React.FC = () => (
    <Win
        system="vega" title="app.practicepro.ng — Vega · Notifications"
        nav={[
            { label: 'Dashboard', Icon: DashboardIcon },
            { label: 'Matters', Icon: MattersIcon },
            { label: 'Calendar', Icon: CalendarIcon },
            { label: 'Notifications', Icon: BellIcon, active: true },
            { label: 'Billing', Icon: BanknotesIcon },
        ]}
        sideNote="Vega · Legal Practice OS"
    >
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mr-1">Channels</span>
                <Chip tone="on"><ChatAltIcon className="w-2.5 h-2.5" /> WhatsApp</Chip>
                <Chip tone="on"><PhoneIcon className="w-2.5 h-2.5" /> SMS</Chip>
                <Chip tone="on"><MailIcon className="w-2.5 h-2.5" /> Email</Chip>
            </div>
            <Banner items={[
                { tone: 'warn', text: 'Hearing reminder queued for tomorrow 7:00 — client + counsel, WhatsApp & SMS' },
                { tone: 'bad', text: 'Escalation: overdue task escalated to the managing partner' },
                { tone: 'good', text: 'All of today\u2019s reminders delivered — 38 sent, 38 confirmed' },
            ]} />
            <div className="space-y-1.5">
                {[
                    [ChatAltIcon, 'Hearing reminder — Meridian Ltd v. Bluecrest Bank', 'WhatsApp · delivered', 'good'],
                    [PhoneIcon, 'Filing window opens Monday — counsel notified', 'SMS · delivered', 'good'],
                    [MailIcon, 'Invoice INV-2042 sent to client', 'Email · opened', 'good'],
                    [BellIcon, 'Overdue task — draft statement of claim', 'In-app · banner shown', 'bad'],
                ].map(([Icon, msg, ch, tone], i) => {
                    const I = Icon as React.ComponentType<{ className?: string }>;
                    return (
                        <Row key={i}>
                            <I className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="flex-1 min-w-0 truncate text-[11.5px] font-medium text-slate-700">{msg as string}</span>
                            <Chip tone={tone as 'good' | 'bad'}>{ch as string}</Chip>
                        </Row>
                    );
                })}
            </div>
            <p className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium"><SparklesIcon className="w-3 h-3" /> Reminder rules run themselves — your team sees what needs doing.</p>
        </div>
    </Win>
);

const VegaBilling: React.FC = () => (
    <Win
        system="vega" title="app.practicepro.ng — Vega · Billing"
        nav={[
            { label: 'Dashboard', Icon: DashboardIcon },
            { label: 'Matters', Icon: MattersIcon },
            { label: 'Billing', Icon: BanknotesIcon, active: true },
            { label: 'Clients', Icon: UsersIcon },
        ]}
        sideNote="Vega · Legal Practice OS"
    >
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
                <Stat system="vega" label="Collected · QTD" value="₦4.86m" tone="good" />
                <Stat system="vega" label="Outstanding" value="₦1.13m" sub="4 invoices" tone="warn" />
                <Stat system="vega" label="Overdue" value="₦320k" sub="1 invoice" tone="bad" />
            </div>
            <div className="space-y-1.5">
                {[
                    ['INV-2043 · Halcourt Estate', '₦180,000', 'Due in 9 days', 'plain'],
                    ['INV-2042 · Meridian Logistics', '₦450,000', 'Paid · receipt sent', 'good'],
                    ['INV-2039 · Adenia Realty', '₦320,000', 'Overdue · 12 days', 'bad'],
                ].map(([inv, amt, st, tone]) => (
                    <Row key={inv as string}>
                        <BanknotesIcon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        <span className="flex-1 min-w-0 truncate text-[11.5px] font-semibold text-slate-700">{inv}</span>
                        <span className="text-[11.5px] font-bold text-slate-800">{amt}</span>
                        <Chip tone={tone as 'plain' | 'good' | 'bad'}>{st}</Chip>
                    </Row>
                ))}
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2" style={{ borderColor: 'rgba(217,119,6,0.4)', background: 'rgba(217,119,6,0.06)' }}>
                <NairaCircleIcon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-[11px] font-semibold" style={{ color: '#92400E' }}>
                    Payment link generated — Paystack · receipts land automatically on payment
                </span>
                <Chip tone="warn">Live</Chip>
            </div>
        </div>
    </Win>
);

const VegaClientPortal: React.FC = () => (
    <Win
        system="vega" title="portal.practicepro.ng — Signed in as Meridian Logistics Ltd"
        nav={[
            { label: 'My matters', Icon: MattersIcon, active: true },
            { label: 'Documents', Icon: DocumentTextIcon },
            { label: 'Invoices', Icon: BanknotesIcon },
            { label: 'Messages', Icon: ChatAltIcon },
        ]}
        sideNote="What your client sees"
    >
        <div className="space-y-3">
            <Banner items={[
                { tone: 'good', text: 'Next hearing: Thursday 10:00 — Lagos Judicial Division, Court 12' },
                { tone: 'warn', text: '1 document awaiting your signature — engagement addendum' },
            ]} />
            <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Meridian Logistics Ltd v. Bluecrest Bank Plc</p>
                <div className="flex items-center gap-1.5">
                    {[['Intake', true], ['Filed', true], ['Served', true], ['Hearing', false]].map(([label, done], i) => (
                        <React.Fragment key={label as string}>
                            <div className="flex flex-col items-center gap-1 min-w-0">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center ${done ? 'bg-emerald-500 text-white' : 'border-2 border-dashed border-amber-400 text-amber-500'}`}>
                                    {done ? <CheckIcon className="w-2.5 h-2.5" /> : <span className="text-[8px] font-bold">{i + 1}</span>}
                                </span>
                                <span className="text-[8.5px] font-bold text-slate-500 truncate">{label}</span>
                            </div>
                            {i < 3 && <span className={`flex-1 h-0.5 rounded ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                        </React.Fragment>
                    ))}
                </div>
            </div>
            <div className="space-y-1.5">
                {[
                    ['Statement of claim — final.pdf', '2.1 MB', DocumentTextIcon],
                    ['Exhibit B — invoice suite.pdf', '860 KB', DocumentTextIcon],
                ].map(([name, size, I]) => {
                    const Icon = I as React.ComponentType<{ className?: string }>;
                    return (
                        <Row key={name as string}>
                            <Icon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            <span className="flex-1 min-w-0 truncate text-[11.5px] font-medium text-slate-700">{name as string}</span>
                            <span className="text-[10px] text-slate-400">{size as string}</span>
                        </Row>
                    );
                })}
            </div>
        </div>
    </Win>
);

// — Atrium —

const AtriumRevenue: React.FC = () => (
    <Win
        system="atrium" title="app.practicepro.ng — Atrium · Halcourt Portfolio"
        nav={[
            { label: 'Revenue', Icon: ChartBarIcon, active: true },
            { label: 'Units & tenants', Icon: UsersIcon },
            { label: 'Collections', Icon: BanknotesIcon },
            { label: 'Maintenance', Icon: CogIcon },
            { label: 'Reports', Icon: DocumentTextIcon },
        ]}
        sideNote="Atrium · Property OS"
    >
        <div className="space-y-3">
            <Banner items={[
                { tone: 'warn', text: 'Unit 101 — 18 days overdue · escalation level 2 started, notices sent' },
                { tone: 'good', text: 'Cycle-to-date collections: 78% — 3 points above last cycle' },
            ]} />
            <div className="grid grid-cols-3 gap-2">
                <Stat system="atrium" label="Collected · cycle" value="78%" sub="₦41.2m of ₦52.8m" tone="good" />
                <Stat system="atrium" label="Outstanding" value="₦11.6m" sub="26 units" tone="warn" />
                <Stat system="atrium" label="Defaulters" value="4" sub="1 escalating" tone="bad" />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">Collections — last 6 cycles</p>
                <div className="flex items-end gap-2 h-24">
                    {[62, 58, 71, 66, 74, 78].map((v, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div className="w9-tour-bar w-full rounded-t" style={{ height: `${v}%`, background: 'linear-gradient(to top, #059669, #34D399)', '--i': i } as React.CSSProperties} />
                            <span className="text-[8px] font-bold text-slate-400">C{i + 1}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </Win>
);

const AtriumCollections: React.FC = () => (
    <Win
        system="atrium" title="app.practicepro.ng — Atrium · Collections"
        nav={[
            { label: 'Revenue', Icon: ChartBarIcon },
            { label: 'Units & tenants', Icon: UsersIcon },
            { label: 'Collections', Icon: BanknotesIcon, active: true },
            { label: 'Maintenance', Icon: CogIcon },
        ]}
        sideNote="Atrium · Property OS"
    >
        <div className="space-y-3">
            <Banner items={[
                { tone: 'bad', text: 'Unit 101 · 18 days overdue — SMS + WhatsApp notice delivered, escalation running' },
                { tone: 'good', text: '12 reminders queued for tomorrow 8:00 — rent due in 3 days' },
            ]} />
            <div className="space-y-1.5">
                {[
                    ['Unit 101 · Adenia Court', 'A. Bello', '₦850,000', 'Overdue · 18d', 'bad'],
                    ['Unit 205 · Marina Heights', 'C. Eze', '₦620,000', 'Paid · receipt sent', 'good'],
                    ['Unit 301 · Adenia Court', 'F. Adeyemi', '₦740,000', 'Due in 3 days', 'warn'],
                    ['Unit 12 · Halcourt Flats', 'J. Nwosu', '₦510,000', 'Paid · receipt sent', 'good'],
                ].map(([unit, tenant, amt, st, tone]) => (
                    <Row key={unit as string} className={tone === 'bad' ? 'border-red-200 bg-red-50/40' : ''}>
                        <MapPinIcon className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[11.5px] font-semibold text-slate-700 truncate">{unit}</p>
                            <p className="text-[9.5px] text-slate-400 font-medium">{tenant}</p>
                        </div>
                        <span className="text-[11.5px] font-bold text-slate-800">{amt}</span>
                        <Chip tone={tone as 'bad' | 'good' | 'warn'}>{st}</Chip>
                    </Row>
                ))}
            </div>
            <p className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium"><SendIcon className="w-3 h-3" /> Defaulter tracking applies each unit\u2019s tenancy terms — escalation is automatic.</p>
        </div>
    </Win>
);

const AtriumResidentsPortal: React.FC = () => (
    <Win
        system="atrium" title="portal.practicepro.ng — Signed in as C. Eze · Unit 205"
        nav={[
            { label: 'My statement', Icon: BanknotesIcon, active: true },
            { label: 'Pay rent', Icon: NairaCircleIcon },
            { label: 'Maintenance', Icon: CogIcon },
            { label: 'Documents', Icon: DocumentTextIcon },
        ]}
        sideNote="What your resident sees"
    >
        <div className="space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 mb-1">Current balance — Unit 205 · Marina Heights</p>
                <p className="text-2xl font-extrabold text-emerald-700 tracking-tight">₦0.00</p>
                <p className="text-[10px] text-emerald-600/80 font-medium">Rent + service charge paid through Dec 2026 · receipt #R-8841</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Next payment</p>
                    <p className="text-[12.5px] font-bold text-slate-700">₦620,000 · due Jan 5</p>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white" style={{ background: '#059669' }}>
                        <NairaCircleIcon className="w-3 h-3" /> Pay with Paystack
                    </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Maintenance requests</p>
                    <div className="space-y-1">
                        <p className="text-[11px] font-semibold text-slate-600">Kitchen tap · <span className="text-emerald-600 font-bold">Fixed</span></p>
                        <p className="text-[11px] font-semibold text-slate-600">Geyser service · <span className="text-amber-600 font-bold">Scheduled Thu</span></p>
                    </div>
                </div>
            </div>
        </div>
    </Win>
);

// — Kozy Care —

const KozyBooking: React.FC = () => (
    <Win
        system="kozy" title="kozycare.ng/book — Pickup booking"
        nav={[
            { label: 'Book pickup', Icon: CalendarIcon, active: true },
            { label: 'My orders', Icon: TasksIcon },
            { label: 'Membership', Icon: UsersIcon },
            { label: 'Payments', Icon: BanknotesIcon },
        ]}
        sideNote="Kozy Care · live at kozycare.ng"
    >
        <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
                {['Wash & fold', 'Dry clean', 'Ironing', 'Shoe care'].map((c, i) => <Chip key={c} tone={i === 1 ? 'on' : 'plain'}>{c}</Chip>)}
            </div>
            <div className="space-y-1.5">
                {[
                    ['2 × 2pc suits — dry clean', '₦7,000'],
                    ['5 × shirts — wash & press', '₦5,750'],
                    ['1 × duvet — deep clean', '₦6,500'],
                ].map(([item, amt]) => (
                    <Row key={item}>
                        <CheckIcon className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <span className="flex-1 min-w-0 truncate text-[11.5px] font-semibold text-slate-700">{item}</span>
                        <span className="text-[11.5px] font-bold text-slate-800">{amt}</span>
                    </Row>
                ))}
                <Row className="border-dashed">
                    <span className="w9-caret text-emerald-600 text-[11.5px] font-semibold flex-1">Adding: 3 × blouses</span>
                    <Chip tone="good">+₦4,200</Chip>
                </Row>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 px-3 py-2">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Pickup slot</p>
                    <p className="text-[12px] font-bold text-slate-700">Fri · 9:00–11:00</p>
                </div>
                <div className="rounded-xl border border-slate-200 px-3 py-2">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Zone</p>
                    <p className="text-[12px] font-bold text-slate-700 flex items-center gap-1"><MapPinIcon className="w-3 h-3 text-emerald-500" /> Ikoyi</p>
                </div>
            </div>
            <div className="flex items-center justify-between rounded-xl px-3 py-2.5 text-white" style={{ background: 'linear-gradient(135deg, #16A34A, #059669)' }}>
                <span className="text-[11px] font-bold">Quote total · ₦23,450</span>
                <span className="text-[10px] font-semibold opacity-90">Confirm pickup →</span>
            </div>
        </div>
    </Win>
);

const KozyCustomerPortal: React.FC = () => (
    <Win
        system="kozy" title="kozycare.ng/portal — Signed in as Ngozi · Kozy Circle Silver"
        nav={[
            { label: 'My orders', Icon: TasksIcon, active: true },
            { label: 'Membership', Icon: UsersIcon },
            { label: 'Payments', Icon: BanknotesIcon },
            { label: 'Support', Icon: ChatAltIcon },
        ]}
        sideNote="What your customer sees"
    >
        <div className="space-y-3">
            <div className="rounded-xl border p-3" style={{ borderColor: 'rgba(22,163,74,0.3)', background: 'rgba(22,163,74,0.05)' }}>
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#15803D' }}>Order KZ-20841 · 7 items</p>
                    <Chip tone="good">On schedule</Chip>
                </div>
                <div className="flex items-center gap-1.5">
                    {[['Picked up', true], ['In care', true], ['Ready', false], ['Delivery', false]].map(([label, done], i) => (
                        <React.Fragment key={label as string}>
                            <div className="flex flex-col items-center gap-1 min-w-0">
                                <span className={`w-2.5 h-2.5 rounded-full ${done ? 'bg-emerald-500 w9-tour-dot' : 'bg-slate-200'}`} />
                                <span className="text-[8.5px] font-bold text-slate-500 truncate">{label}</span>
                            </div>
                            {i < 3 && <span className={`flex-1 h-0.5 rounded ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                        </React.Fragment>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Kozy Circle · Silver</p>
                    <p className="text-[12px] font-bold text-slate-700">2 free washes left</p>
                    <p className="text-[10px] text-slate-400 font-medium">Renews Nov 2 · ₦12,500/mo</p>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Payments</p>
                    <p className="text-[11px] font-semibold text-slate-600">KZ-20839 · ₦18,200 · <span className="text-emerald-600 font-bold">Paid</span></p>
                    <p className="text-[10px] text-slate-400 font-medium">Paystack · receipt emailed</p>
                </div>
            </div>
        </div>
    </Win>
);

const KozyAdmin: React.FC = () => (
    <Win
        system="kozy" title="kozycare.ng/admin — Branch console · Ikoyi"
        nav={[
            { label: 'Orders', Icon: TasksIcon, active: true },
            { label: 'Riders', Icon: MapPinIcon },
            { label: 'Members', Icon: UsersIcon },
            { label: 'Revenue', Icon: ChartBarIcon },
        ]}
        sideNote="The back office — admin only"
    >
        <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
                <Stat system="kozy" label="Orders · today" value="37" sub="+8 vs yest." />
                <Stat system="kozy" label="Revenue · today" value="₦186,400" tone="good" />
                <Stat system="kozy" label="Riders out" value="3" sub="12 zones live" />
            </div>
            <div className="grid grid-cols-4 gap-1.5">
                {[
                    ['New', '8', 'rgba(22,163,74,0.08)'],
                    ['Washing', '11', 'rgba(217,119,6,0.08)'],
                    ['Ready', '6', 'rgba(5,150,105,0.08)'],
                    ['Delivered', '12', 'rgba(15,23,42,0.05)'],
                ].map(([col, n, bg]) => (
                    <div key={col as string} className="rounded-lg p-2 min-w-0" style={{ background: bg as string }}>
                        <p className="text-[8.5px] font-bold uppercase tracking-wider text-slate-500 truncate">{col}</p>
                        <p className="text-sm font-extrabold text-slate-700">{n}</p>
                        <div className="mt-1 space-y-0.5">
                            <div className="h-3 rounded bg-white/80" />
                            <div className="h-3 rounded bg-white/60" />
                        </div>
                    </div>
                ))}
            </div>
            <div className="space-y-1.5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Riders — GPS dispatch</p>
                {[
                    ['Tunde · motorcycle', 'Ikoyi zone · 4 drops left', 'good'],
                    ['Ife · van', 'Lekki phase 1 · returning', 'good'],
                    ['Chidi · motorcycle', 'Picking up at Banana Island', 'warn'],
                ].map(([name, st, tone]) => (
                    <Row key={name as string}>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 w9-tour-dot flex-shrink-0" />
                        <span className="flex-1 min-w-0 truncate text-[11.5px] font-semibold text-slate-700">{name}</span>
                        <Chip tone={tone as 'good' | 'warn'}>{st}</Chip>
                    </Row>
                ))}
            </div>
        </div>
    </Win>
);

// ─── The registry ──────────────────────────────────────────────────────────

export const TOUR_SCREENS: Record<TourSystem, ScreenDef[]> = {
    vega: [
        { id: 'dashboard', label: 'Dashboard', caption: 'The firm at a glance — matters, deadlines computed from court rules, and the alert banners that keep nothing forgotten.', render: () => <VegaDashboard /> },
        { id: 'matter', label: 'New matter', caption: 'A matter being entered live — the deadline engine and AI drafting start working the moment you type.', render: () => <VegaNewMatter /> },
        { id: 'notifications', label: 'Notifications', caption: 'The banner + notification engine: reminders and escalations by WhatsApp, SMS and email — sent by the system, not by your staff.', render: () => <VegaNotifications /> },
        { id: 'billing', label: 'Billing', caption: 'Invoices, Paystack payment links and automatic receipts — naira-first revenue operations.', render: () => <VegaBilling /> },
        { id: 'client-portal', label: 'Client portal', caption: 'What your client sees: live case tracking, documents and hearing dates — no phone calls to your office.', render: () => <VegaClientPortal /> },
    ],
    atrium: [
        { id: 'revenue', label: 'Revenue', caption: 'Portfolio collections at a glance — cycles trending, defaulters flagged early.', render: () => <AtriumRevenue /> },
        { id: 'collections', label: 'Collections', caption: 'Rent and service charge tracking — notices and escalations run themselves per each unit\u2019s tenancy terms.', render: () => <AtriumCollections /> },
        { id: 'residents', label: 'Residents\u2019 portal', caption: 'What your resident sees: statements, one-tap rent payments and maintenance requests.', render: () => <AtriumResidentsPortal /> },
    ],
    kozy: [
        { id: 'booking', label: 'Ordering', caption: 'The guest booking flow your customers use — items, live quote, pickup slot and zone. Live at kozycare.ng/book.', render: () => <KozyBooking /> },
        { id: 'portal', label: 'Customer portal', caption: 'The signed-in customer view: order tracking, Kozy Circle membership and Paystack payment history.', render: () => <KozyCustomerPortal /> },
        { id: 'admin', label: 'Admin console', caption: 'The back office: the orders pipeline, rider GPS dispatch across 12 zones and today\u2019s revenue.', render: () => <KozyAdmin /> },
    ],
};

// ─── The player ────────────────────────────────────────────────────────────

const DWELL_MS = 7000;

/**
 * SystemTour — the interactive stage: screen chips, the live screen, an
 * auto-advance progress bar (pause on hover/keyboard focus), and the
 * standing demo-data label. Everything inside the window is an
 * illustration (aria-hidden); the caption carries the meaning.
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
            {/* Demo-data label — the honesty rule (P8): a tour is a tour. */}
            <div className="flex items-center justify-between gap-3 mb-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9.5px] font-bold uppercase tracking-widest bg-slate-900 text-white">
                    <SparklesIcon className="w-3 h-3" /> Guided tour · demo data
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

            {/* The screen — an illustration, not real data. */}
            <div key={`${system}-${screen.id}`} className="w9-tour-swap" aria-hidden="true">
                {screen.render(system)}
            </div>

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
