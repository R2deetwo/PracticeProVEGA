/**
 * PainMirrorSection (Sound familiar?) — R36: FOUR WORLDS, TWENTY SIGHS.
 *
 * Owner direction (R36): the band "isn't too bad" — but every back
 * repeats the same "YOUR BUSINESS, REBUILT" stamp (robotic, no human
 * voice), the cast is only lawyers and property managers ("boxes us
 * in"), and the card flip eats vertical real estate while leaving
 * awkward focus geometry behind. PracticePro builds systems and
 * integrations for ANY business that runs on spreadsheets, chat
 * threads and paper — so the band now speaks to four of them.
 *
 *   1. FOUR REAL OPERATORS, not two professions: Ada Eze (e-commerce
 *      fashion house, Yaba), Dr. Emeka Okoro (community pharmacy,
 *      Lekki), Chuka Obi (boutique hotel / short-let, 14 units,
 *      Lekki) and Tunde Baku (logistics / dispatch hub, Ikeja). The
 *      tabs are unmissable: a cue line above, a switch glyph on every
 *      card that becomes a check on the active one, hover lift,
 *      arrow-key roving focus — nothing reads as a static grid.
 *   2. EVERY BACK IS ITS OWN SIGH OF RELIEF — the repeated stamp is
 *      dead. Each moment's back carries a bespoke headline in the
 *      operator's own exhale ("Nothing important lives in the
 *      scroll." · "The shelf counts itself." · "One calendar. One
 *      truth." · "Tracking without the phone call.") followed by one
 *      line of what THEIR system now does. Still no product names in
 *      the band — the improvement is theirs; the capability to build
 *      it is ours.
 *   3. THE FLIP IS GONE — replaced by an in-place fade-and-scale
 *      crossfade: two layers share one fixed-aspect card, opacity and
 *      scale swap in 320ms, zero height change, zero 3D overflow,
 *      clean rectangular focus rings, and no dead space — the whole
 *      card is one button. The one-time demo still teaches the
 *      toggle; reduced-motion visitors get instant state changes.
 *   4. THE PIVOT SPEAKS AS THE BUILDER for all four worlds — one
 *      PracticePro Systems mark, one promise (systems and
 *      integrations built around how you already work), one CTA:
 *      "Tell us what runs your business today."
 */
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui';
import { Logo } from '../../../constants';
import { useScrollReveal } from '../hooks';

// Cache-bust landing assets per build (the About section's pattern).
const buildSha = (import.meta as any).env?.VITE_BUILD_SHA || Date.now();

// ── The artifact kit — real objects, DOM-drawn, crisp at any DPI ───────────

/** A small mono label used on artifact faces. */
const FaceTag: React.FC<{ tone: 'bad' | 'good'; children: React.ReactNode }> = ({ tone, children }) => (
    <span className={`font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em] ${tone === 'bad' ? 'text-red-200/95' : 'text-emerald-300/90'}`}>
        {children}
    </span>
);

/** 1 · A WhatsApp bubble — the message that lives (and drowns) in chat. */
const WhatsAppBubble: React.FC<{ sender: string; time: string; body: string; attachment?: string; tag?: string; sink?: boolean }> = ({ sender, time, body, attachment, tag, sink = false }) => (
    <div className="flex flex-col items-start gap-1.5 w-full">
        <div className={`w-full max-w-[92%] rounded-xl rounded-tl-sm bg-[#1f2c34] border border-white/10 px-3 py-2.5 ${sink ? 'pm-sink' : 'pm-in'}`}>
            <p className="text-[10px] font-bold text-emerald-300/90">{sender} · <span className="text-slate-500 font-medium">{time}</span></p>
            <p className="text-[11px] sm:text-xs text-slate-200 leading-snug mt-1">{body}</p>
            {attachment && (
                <span className="mt-2 flex items-center gap-1.5 rounded-md border border-red-400/40 bg-red-500/10 px-2 py-1 text-[9px] sm:text-[10px] font-bold text-red-200">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M6 1v7M6 8l-2.5-2.5M6 8l2.5-2.5M1.5 10.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    {attachment}
                </span>
            )}
        </div>
        {tag && <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em] text-red-200/90">{tag}</span>}
    </div>
);

/** 2 · A bank credit alert — money landed, meaning didn't. */
const CreditAlert: React.FC<{ amount: string; from: string; maybes?: string[] }> = ({ amount, from, maybes }) => (
    <div className="w-full flex flex-col gap-2">
        <div className="pm-in rounded-lg border border-slate-300/80 bg-[#F5F1E6] text-slate-800 px-3 py-2.5 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.7)]">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Credit alert</p>
            <p className="text-base sm:text-lg font-extrabold leading-tight">{amount}</p>
            <p className="text-[9px] sm:text-[10px] font-semibold text-slate-500">{from}</p>
        </div>
        {maybes && (
            <div className="flex flex-wrap gap-1.5">
                {maybes.map((m, i) => (
                    <span key={m} className={`pm-in rounded-full border border-dashed border-red-400/50 bg-red-500/[0.07] px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-red-200/90`} style={{ animationDelay: `${240 + i * 130}ms` }}>
                        {m}
                    </span>
                ))}
            </div>
        )}
    </div>
);

/** 3 · A stock-count card — the shelf the paperwork lied about. */
const ShelfTag: React.FC<{ drug: string; count: string; shelf: string; found: string }> = ({ drug, count, shelf, found }) => (
    <div className="w-full">
        <div className="pm-in relative rounded-md border border-slate-300/80 bg-[#F5F1E6] text-slate-800 px-3 py-2.5 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.7)]">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 border-b border-dashed border-slate-300/70 pb-1">Stock count card</p>
            <p className="text-[10px] sm:text-[11px] font-extrabold mt-1.5 leading-snug">{drug}</p>
            <p className="mt-1 flex items-baseline gap-2">
                <span className="text-[10px] font-semibold text-slate-500">{count}</span>
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-wide text-red-600/90">{shelf}</span>
            </p>
            <span className="mt-2 flex items-end gap-[2px]" aria-hidden="true">
                {[3, 5, 2, 6, 3, 5, 4, 2, 5, 3, 6, 2, 4, 3, 5, 2, 4, 6, 3, 2].map((h, i) => (
                    <span key={i} className="w-[2px] bg-slate-700/70" style={{ height: `${h * 2}px` }} />
                ))}
            </span>
        </div>
        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em] text-red-200/90 mt-2">{found}</p>
    </div>
);

/** 4 · A manila file — the proof only one pocket holds. */
const ManilaFile: React.FC<{ tab: string; sticky: string }> = ({ tab, sticky }) => (
    <div className="w-full">
        <div className="pm-in rounded-md border border-amber-200/25 bg-amber-100/[0.08] px-3 pt-3.5 pb-3">
            <span className="block rounded-t-md bg-amber-100/15 border border-amber-200/20 border-b-0 px-2.5 pt-1 pb-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-100/80 w-max max-w-full truncate">{tab}</span>
            <p className="text-[10px] sm:text-[11px] text-amber-50/70 font-medium mt-1.5 leading-snug">the paper original — not in the system</p>
        </div>
        <span className="pm-in mt-2 block w-max -rotate-2 rounded-sm bg-yellow-200/85 px-2 py-1 text-[9px] sm:text-[10px] font-bold text-yellow-950 shadow-sm" style={{ animationDelay: '300ms' }}>{sticky}</span>
    </div>
);

/** 5 · A supplier order that went out twice (or a fee note that never went at all). */
const FeeNote: React.FC<{ ref_: string; amount: string; state: string; stamp?: string; foot?: string }> = ({ ref_, amount, state, stamp = 'Draft', foot }) => (
    <div className="w-full">
        <div className="pm-in relative rounded-md border border-slate-300/80 bg-[#F5F1E6] text-slate-800 px-3 py-2.5 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.7)] overflow-hidden">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">{ref_}</p>
            <p className="text-base sm:text-lg font-extrabold leading-tight mt-0.5">{amount}</p>
            <p className="text-[9px] sm:text-[10px] font-semibold text-slate-500">{state}</p>
            <span className="absolute inset-0 flex items-center justify-center">
                <span className="rotate-[-14deg] text-[13px] font-black uppercase tracking-[0.3em] text-red-600/25 border-2 border-red-600/25 rounded px-2 py-0.5">{stamp}</span>
            </span>
        </div>
        {foot && <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em] text-red-200/90 mt-2">{foot}</p>}
    </div>
);

/** 6 · The laptop at night — the day that refuses to close. */
const LaptopLate: React.FC<{ clock: string; due: string; doc: string }> = ({ clock, due, doc }) => (
    <div className="w-full flex flex-col items-center">
        <div className="pm-in w-[88%] rounded-t-lg border border-white/20 border-b-0 bg-white/[0.05] px-2 py-1.5 flex justify-center gap-1" aria-hidden="true">
            <span className="h-1 w-1 rounded-full bg-white/20" /><span className="h-1 w-1 rounded-full bg-white/20" /><span className="h-1 w-1 rounded-full bg-white/20" />
        </div>
        <div className="pm-in w-full rounded-b-lg rounded-t-sm border border-white/20 bg-white/[0.03] p-3">
            <p className="text-[10px] font-bold text-slate-300 truncate">{doc}</p>
            <div className="mt-2 flex flex-col gap-1.5" aria-hidden="true">
                <span className="h-1.5 w-11/12 rounded bg-white/10" />
                <span className="h-1.5 w-4/5 rounded bg-white/10" />
                <span className="h-1.5 w-2/3 rounded bg-red-400/25" />
                <span className="h-1.5 w-3/4 rounded bg-white/10" />
            </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
            <span className="rounded-full border border-red-400/50 bg-red-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-red-200">{clock}</span>
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em] text-red-200/90">{due}</span>
        </div>
    </div>
);

/** 7 · A notebook page — the record nobody can trust. */
const DiaryPage: React.FC<{ day: string; lines: string[]; alarm: string }> = ({ day, lines, alarm }) => (
    <div className="w-full">
        <div className="pm-in rounded-md border border-slate-300/80 bg-[#F5F1E6] text-slate-800 px-3 py-2.5 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.7)]">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 border-b border-slate-300/70 pb-1">{day}</p>
            <div className="mt-1.5 flex flex-col gap-1">
                {lines.map((l) => (
                    <p key={l} className="text-[10px] sm:text-[11px] font-semibold text-slate-700 leading-snug flex gap-1.5">
                        <span className="text-slate-400 font-normal">—</span>{l}
                    </p>
                ))}
            </div>
            <p className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-red-600/80">{alarm}</p>
        </div>
    </div>
);

/** 8 · A paper receipt — the warranty proof in the shoebox. */
const ReceiptPaper: React.FC<{ title: string; amount: string; note: string }> = ({ title, amount, note }) => (
    <div className="w-full flex justify-center">
        <div className="pm-in w-[86%] -rotate-1 rounded-sm border border-slate-300/80 bg-[#F5F1E6] text-slate-800 px-3 py-2.5 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.7)]" style={{ maskImage: 'radial-gradient(circle at 50% 100%, transparent 4px, black 4.5px)' }}>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Receipt</p>
            <p className="text-[10px] sm:text-[11px] font-extrabold mt-0.5 leading-snug">{title}</p>
            <p className="text-sm font-extrabold">{amount}</p>
            <p className="text-[9px] font-semibold text-slate-500 mt-0.5">{note}</p>
        </div>
    </div>
);

/** 9 · The phone at midnight — the call that finds the owner's line. */
const PhoneLock: React.FC<{ who: string; time: string; line: string; foot?: string }> = ({ who, time, line, foot }) => (
    <div className="w-full flex justify-center">
        <div className="pm-in w-[80%] rounded-[1.2rem] border-2 border-white/25 bg-white/[0.04] px-3 py-3 text-center">
            <p className="font-mono text-[10px] font-bold text-slate-400">{time}</p>
            <p className="text-[11px] sm:text-xs font-bold text-slate-200 mt-1.5">{who}</p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 leading-snug mt-0.5">{line}</p>
            {foot && <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-red-200/90 mt-2">{foot}</p>}
        </div>
    </div>
);

/** 10 · The staff tag — the one who knows is away. */
const StaffTag: React.FC<{ name: string; status: string; knows: string[] }> = ({ name, status, knows }) => (
    <div className="w-full flex flex-col items-center">
        <div className="pm-in rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2.5 w-[92%]">
            <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/[0.05] text-[11px] font-bold text-slate-300" aria-hidden="true">S</span>
                <span className="text-left">
                    <span className="block text-[11px] sm:text-xs font-bold text-slate-200 leading-tight">{name}</span>
                    <span className="block text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] text-red-200/90">{status}</span>
                </span>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-1">
                {knows.map((k) => (
                    <span key={k} className="rounded border border-red-400/40 bg-red-500/[0.08] px-1.5 py-px text-[8px] sm:text-[9px] font-semibold text-red-200/90">{k}</span>
                ))}
            </div>
        </div>
        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em] text-red-200/90 mt-2">today, everyone guesses</p>
    </div>
);

// ── The data — four weeks, five moments each. Every back carries its
//    own sigh of relief (m.sigh) — one bespoke human exhale per card,
//    never a shared stamp — plus one line of what THEIR system now
//    does (m.fix). ──────────────────────────────────────────────────

type MomentKind =
    | { kind: 'whatsapp'; sender: string; time: string; body: string; attachment?: string; tag?: string; sink?: boolean }
    | { kind: 'alert'; amount: string; from: string; maybes?: string[] }
    | { kind: 'shelf'; drug: string; count: string; shelf: string; found: string }
    | { kind: 'file'; tab: string; sticky: string }
    | { kind: 'fee'; ref_: string; amount: string; state: string; stamp?: string; foot?: string }
    | { kind: 'laptop'; clock: string; due: string; doc: string }
    | { kind: 'diary'; day: string; lines: string[]; alarm: string }
    | { kind: 'receipt'; title: string; amount: string; note: string }
    | { kind: 'phone'; who: string; time: string; line: string; foot?: string }
    | { kind: 'staff'; name: string; status: string; knows: string[] };

type Moment = {
    when: string;
    title: string;
    aria: string;
    front: MomentKind;
    sigh: string;
    fix: string;
};

type PersonaWeek = {
    id: 'ecommerce' | 'pharmacy' | 'hospitality' | 'logistics';
    cardLabel: string;
    name: string;
    role: string;
    photo: string;
    photoAlt: string;
    moments: Moment[];
    pivot: { line: string };
};

/** The artifact front renderer. */
const ArtifactFront: React.FC<{ m: Moment }> = ({ m }) => {
    const f = m.front;
    switch (f.kind) {
        case 'whatsapp': return <WhatsAppBubble sender={f.sender} time={f.time} body={f.body} attachment={f.attachment} tag={f.tag} sink={f.sink} />;
        case 'alert': return <CreditAlert amount={f.amount} from={f.from} maybes={f.maybes} />;
        case 'shelf': return <ShelfTag drug={f.drug} count={f.count} shelf={f.shelf} found={f.found} />;
        case 'file': return <ManilaFile tab={f.tab} sticky={f.sticky} />;
        case 'fee': return <FeeNote ref_={f.ref_} amount={f.amount} state={f.state} stamp={f.stamp} foot={f.foot} />;
        case 'laptop': return <LaptopLate clock={f.clock} due={f.due} doc={f.doc} />;
        case 'diary': return <DiaryPage day={f.day} lines={f.lines} alarm={f.alarm} />;
        case 'receipt': return <ReceiptPaper title={f.title} amount={f.amount} note={f.note} />;
        case 'phone': return <PhoneLock who={f.who} time={f.time} line={f.line} foot={f.foot} />;
        case 'staff': return <StaffTag name={f.name} status={f.status} knows={f.knows} />;
    }
};

// ── The four weeks ──────────────────────────────────────────────────────────

const PAIN_MIRROR: PersonaWeek[] = [
    {
        id: 'ecommerce',
        cardLabel: 'I run an e-commerce brand',
        name: 'Ada Eze',
        role: 'fashion house · Yaba',
        photo: 'persona-founder.jpg',
        photoAlt: 'Fashion founder Ada Eze in her studio in Yaba, one hand resting on a stack of folded fabric',
        moments: [
            {
                when: 'Mon · 9:41 am',
                title: 'The order that got buried',
                aria: 'Monday, 9:41 am. A customer sends her measurements for two outfits on WhatsApp — and the order disappears under three hundred more messages. On a system built for her business, orders land in a queue with customer, price and due date.',
                front: { kind: 'whatsapp', sender: 'Customer', time: '9:41 am', body: '2 outfits · measurements attached', tag: 'one of 312 unread', sink: true },
                sigh: 'Nothing important lives in the scroll.',
                fix: 'Orders land in a queue — customer, price, due date. Chat stays chat.',
            },
            {
                when: 'Wed · 4:15 pm',
                title: 'The payment you can\u2019t place',
                aria: 'Wednesday, 4:15 pm. One hundred and twenty thousand naira lands — Bola\u2019s invoice or Tunde\u2019s fabric money? On a system built for her business, every payment matches itself and balances stay current.',
                front: { kind: 'alert', amount: '₦120,000', from: 'Acct ••2210 · transfer', maybes: ['Bola — invoice #118?', 'Tunde — fabric money?', 'the paper list?'] },
                sigh: 'Every naira has a name.',
                fix: 'Payments match themselves to their customer — balances always current.',
            },
            {
                when: 'Thu · 8:00 am',
                title: 'The one who knows is away',
                aria: 'Thursday, 8 am. Pricing, rush rules and who takes what live in one shop assistant\u2019s head — and he is away till Monday. On a system built for her business, the process lives on a page anyone can run.',
                front: { kind: 'staff', name: 'Sunday', status: 'away — till Monday', knows: ['pricing', 'rush rules', 'who takes what'] },
                sigh: 'The process survives the people.',
                fix: 'Pricing, rush rules, who takes what — on a page anyone can run.',
            },
            {
                when: 'Fri · 6:30 pm',
                title: 'The receipt hunt',
                aria: 'Friday, 6:30 pm. The generator repair should be under warranty — the receipt is in a drawer, a bag, or a WhatsApp photo from March. On a system built for her business, documents are filed the day they arrive.',
                front: { kind: 'receipt', title: 'Generator repair', amount: 'warranty?', note: 'in a drawer · a bag · March?' },
                sigh: 'Found it in four seconds.',
                fix: 'Every document filed the day it arrives — searchable in seconds.',
            },
            {
                when: 'Sun · 11:04 pm',
                title: 'The owner\u2019s shift',
                aria: 'Sunday, 11:04 pm. Orders arrive on her personal line beside the reminders she meant to send — the business is open whenever her eyes are. On a system built for her business, the routine runs without her.',
                front: { kind: 'phone', who: 'personal line — new order', time: '11:04 pm', line: 'next to 4 reminders she meant to send', foot: 'battery 8%' },
                sigh: 'The business sleeps when you do.',
                fix: 'The routine runs without you — orders in, confirmations out.',
            },
        ],
        pivot: {
            line: 'This is the system we build for brands like hers — orders, payments, people and paper in one place, and the week stops running her.',
        },
    },
    {
        id: 'pharmacy',
        cardLabel: 'I run a pharmacy / medical retail',
        name: 'Dr. Emeka Okoro',
        role: 'MedPlus Pharmacy · Lekki',
        photo: 'persona-pharmacy.jpg',
        photoAlt: 'Pharmacist Dr. Emeka Okoro in his community pharmacy in Lekki, white coat over a light blue shirt, warm confident smile',
        moments: [
            {
                when: 'Mon · 10:15 am',
                title: 'The shelf that lied',
                aria: 'Monday, 10:15 am. The count card says forty packs of paracetamol — the shelf is empty, and a customer is standing at the counter. On a system built for his pharmacy, stock levels update with every sale and reorders start before the shelf empties.',
                front: { kind: 'shelf', drug: 'PARACETAMOL 500MG · 24s', count: 'count says 40', shelf: 'shelf: 0', found: 'a customer found out first' },
                sigh: 'The shelf counts itself.',
                fix: 'Stock moves with every sale — reorders start before the shelf empties.',
            },
            {
                when: 'Tue · 1:22 pm',
                title: 'The script in the scroll',
                aria: 'Tuesday, 1:22 pm. A doctor texts a prescription as a photo — it sits under ninety unread messages. On a system built for his pharmacy, every script becomes an order with pickup or delivery and its own due time.',
                front: { kind: 'whatsapp', sender: 'Dr. Bello · clinic', time: '1:22 pm', body: 'Pls fill this for my patient — starting tonight', attachment: 'PRESCRIPTION.JPG', tag: 'one of 90 unread' },
                sigh: 'Every script becomes an order.',
                fix: 'Scripts land as orders — pickup or delivery, each with its due time.',
            },
            {
                when: 'Thu · 7:45 pm',
                title: 'The credit book',
                aria: 'Thursday, 7:45 pm. Credit sales live in a notebook at the counter — and the notebook walks home with whoever closes. On a system built for his pharmacy, credit sits against each customer with balance, history and reminders.',
                front: { kind: 'diary', day: 'Credit book', lines: ['Mama Ngo — ₦12,400', 'Mr Ade — insulin · ₦8,900'], alarm: 'the book walks home with whoever closes' },
                sigh: 'The book keeps itself.',
                fix: 'Credit recorded against each customer — balance, history, gentle reminders.',
            },
            {
                when: 'Fri · 11:30 am',
                title: 'The order that went out twice',
                aria: 'Friday, 11:30 am. The supplier order went out twice — three hundred and ten thousand naira of stock nobody budgeted for. On a system built for his pharmacy, purchase orders are tracked to delivery, so duplicates cannot happen.',
                front: { kind: 'fee', ref_: 'Supplier PO · 0231', amount: '₦310,000', state: 'ordered twice · nobody checked', stamp: 'Twice', foot: '₦310,000 of stock nobody budgeted for' },
                sigh: 'One order. Once. Tracked.',
                fix: 'Purchase orders tracked to delivery — duplicates impossible.',
            },
            {
                when: 'Sat · 9:47 pm',
                title: 'The till at 9:47 pm',
                aria: 'Saturday, 9:47 pm. Close of day means counting the till by hand against slips and memory. On a system built for his pharmacy, the day reconciles itself — sales, slips and cash — before the shutter comes down.',
                front: { kind: 'laptop', clock: '9:47 pm', due: 'counting by hand', doc: 'TILL RECON — ₦4,200 short?' },
                sigh: 'Close of day, closed in minutes.',
                fix: 'The till reconciles itself against the day\u2019s sales — minutes, not hours.',
            },
        ],
        pivot: {
            line: 'This is the system we build for pharmacies like his — stock, scripts, credit and the till in one place, and the counter closes itself.',
        },
    },
    {
        id: 'hospitality',
        cardLabel: 'I manage a boutique hotel / short-let',
        name: 'Chuka Obi',
        role: '14 units · Lekki',
        photo: 'persona-estate.jpg',
        photoAlt: 'Short-let host Chuka Obi in the courtyard of a well-kept apartment block in Lekki at golden hour',
        moments: [
            {
                when: 'Mon · 8:12 pm',
                title: 'The booking that lived in a DM',
                aria: 'Monday, 8:12 pm. A guest asks for three nights this weekend — the question sits in a DM beside sixty others, and the availability calendar lives in his head. On a system built for his flats, inquiries become bookings with live availability and instant confirmation.',
                front: { kind: 'whatsapp', sender: 'Guest · Instagram', time: '8:12 pm', body: 'Hi! Any chance of 3 nights this weekend? 2 adults', tag: 'among 61 unread DMs', sink: true },
                sigh: 'The calendar answers for you.',
                fix: 'Inquiries become bookings — live availability, price, instant confirmation.',
            },
            {
                when: 'Tue · 3:05 pm',
                title: 'The deposit you can\u2019t place',
                aria: 'Tuesday, 3:05 pm. Two hundred and eighty thousand naira lands — a deposit for Flat 4, the balance on Flat 2, or an inquiry from weeks ago? On a system built for his flats, every payment matches its guest, flat and stay.',
                front: { kind: 'alert', amount: '₦280,000', from: 'Acct ••9917 · transfer', maybes: ['Flat 4 deposit?', 'Flat 2 balance?', 'an inquiry from weeks ago?'] },
                sigh: 'Every deposit knows its flat.',
                fix: 'Payments matched to guest, flat and stay — no guessing.',
            },
            {
                when: 'Thu · 6:40 pm',
                title: 'Two guests, one flat',
                aria: 'Thursday, 6:40 pm. The booking sites say Flat 4 is taken this weekend; his calendar says it is free — and both guests are coming. On a system built for his flats, every channel sits on one calendar that cannot disagree with itself.',
                front: { kind: 'diary', day: 'Fri · 14 Nov', lines: ['Flat 4 — booking site: taken', 'Flat 4 — his calendar: free'], alarm: 'both guests are coming' },
                sigh: 'One calendar. One truth.',
                fix: 'Every channel on one calendar — double bookings impossible.',
            },
            {
                when: 'Fri · 4:30 pm',
                title: 'The 9 pm arrival',
                aria: 'Friday, 4:30 pm. A guest lands at nine tonight and nobody has confirmed the cleaning — it lives in a voice note from this morning. On a system built for his flats, every stay schedules its own cleaning, confirmed and tracked.',
                front: { kind: 'staff', name: 'Amaka · housekeeping', status: 'not confirmed', knows: ['Flat 2 · tonight', 'guest lands 9:00 pm'] },
                sigh: 'The flat is ready before they land.',
                fix: 'Each stay schedules its cleaning — confirmed, tracked, never hoped for.',
            },
            {
                when: 'Sun · 12:26 am',
                title: 'The midnight lockout',
                aria: 'Sunday, 12:26 am. A guest is locked out at the gate and calls his personal line — because there is nowhere else to call. On a system built for his flats, guest issues are logged, assigned and tracked to closed, and gate codes arrive before they are needed.',
                front: { kind: 'phone', who: 'Guest · Flat 2', time: '12:26 am', line: '\u2018the gate code isn\u2019t working\u2019 — on his personal line' },
                sigh: 'Guests get answers. You get sleep.',
                fix: 'Issues logged, assigned and closed — codes arrive before they\u2019re needed.',
            },
        ],
        pivot: {
            line: 'This is the system we build for hosts like him — bookings, guests, flats and upkeep in one place, and every guest arrives to a ready flat.',
        },
    },
    {
        id: 'logistics',
        cardLabel: 'I run a logistics / dispatch service',
        name: 'Tunde Baku',
        role: 'Express Hub · Ikeja',
        photo: 'persona-logistics.jpg',
        photoAlt: 'Dispatch operator Tunde Baku in his logistics hub in Ikeja, dark green polo shirt, relaxed confident smile beside parcel stacks',
        moments: [
            {
                when: 'Mon · 8:47 am',
                title: 'The address in a voice note',
                aria: 'Monday, 8:47 am. A customer sends a pickup address as a one-minute-forty-seven voice note — in traffic, nobody can replay it. On a system built for his hub, orders arrive structured: pickup, drop-off, contact, note.',
                front: { kind: 'whatsapp', sender: 'Customer', time: '8:47 am', body: 'Pls pick up at… (voice note)', attachment: 'VOICENOTE — 1:47', tag: 'nobody can replay it twice' },
                sigh: 'Every address, typed and mapped.',
                fix: 'Orders arrive structured — pickup, drop-off, contact. Nothing lives in audio.',
            },
            {
                when: 'Tue · 2:10 pm',
                title: 'The parcel only Kelechi can find',
                aria: 'Tuesday, 2:10 pm. A customer wants parcel 48 — and only Kelechi knows where it is. He is in traffic and not picking up. On a system built for his hub, every parcel carries its own location and status, rider by rider.',
                front: { kind: 'staff', name: 'Kelechi · rider', status: 'in traffic — not picking up', knows: ['where parcel 48 is'] },
                sigh: 'No parcel lives in one head.',
                fix: 'Every parcel tracked rider by rider — location and status on one board.',
            },
            {
                when: 'Wed · 5:55 pm',
                title: 'The POD in a door pocket',
                aria: 'Wednesday, 5:55 pm. A customer disputes a delivery from March — the signed proof is in a rider\u2019s door pocket, if it survived the rain. On a system built for his hub, proof of delivery is captured at drop-off: photo, signature, time.',
                front: { kind: 'file', tab: 'PODs · March', sticky: 'in Kelechi\u2019s door pocket' },
                sigh: 'Proof that proves itself.',
                fix: 'PODs captured at drop-off — photo, signature, timestamp. Disputes end fast.',
            },
            {
                when: 'Fri · 7:20 pm',
                title: 'The cash nobody can place',
                aria: 'Friday, 7:20 pm. Six riders hold two hundred and forty thousand naira of cash on delivery — some since Tuesday. On a system built for his hub, cash on delivery reconciles per rider per day, and shortfalls surface the same day.',
                front: { kind: 'diary', day: 'COD · Friday', lines: ['6 riders hold ₦240,000', 'Kelechi — since Tuesday'], alarm: 'nobody can say exactly' },
                sigh: 'Every naira accounted for.',
                fix: 'COD reconciles per rider, per day — shortfalls surface same day.',
            },
            {
                when: 'Sun · 11:04 pm',
                title: 'The 11 pm \u2018where is it?\u2019',
                aria: 'Sunday, 11:04 pm. A customer calls at eleven at night because tracking means calling three people. On a system built for his hub, customers see live status themselves — and his line stays his.',
                front: { kind: 'phone', who: 'Customer — order #48', time: '11:04 pm', line: 'tracking means calling three people' },
                sigh: 'Tracking without the phone call.',
                fix: 'Customers see live status themselves — your line stays yours.',
            },
        ],
        pivot: {
            line: 'This is the system we build for hubs like his — orders, riders, parcels and cash in one place, and nothing lives in one person\u2019s head.',
        },
    },
];

// ── The section ────────────────────────────────────────────────────────────
export const PainMirrorSection: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    const pickerRef = useScrollReveal<HTMLDivElement>();
    const closeRef = useScrollReveal<HTMLDivElement>();
    const sectionRef = useRef<HTMLElement>(null);
    const tabsRef = useRef<HTMLDivElement>(null);

    // The visitor's declaration — whose week is this? Defaults to the
    // founder's week (the operator every business owner recognises);
    // switching persona is the visitor answering the question, not
    // something the page does to them.
    const [personaId, setPersonaId] = useState<PersonaWeek['id']>('ecommerce');
    const [open, setOpen] = useState<Set<number>>(new Set());
    const hinted = useRef(false);
    const touched = useRef(false);
    const timers = useRef<number[]>([]);
    const reduced = useRef(
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    );

    const persona = PAIN_MIRROR.find((p) => p.id === personaId) ?? PAIN_MIRROR[0];

    // One-time demo: when the section first fills the viewport, open
    // the first artifact and close it again — teaching the toggle
    // without a word of instruction. Never runs for reduced-motion
    // visitors, and never after the visitor has toggled one themselves.
    useEffect(() => {
        if (reduced.current || hinted.current) return;
        const root = sectionRef.current;
        if (!root || !('IntersectionObserver' in window)) return;
        const io = new IntersectionObserver((entries) => {
            for (const en of entries) {
                if (!en.isIntersecting || hinted.current) continue;
                hinted.current = true;
                if (touched.current) return;
                timers.current.push(
                    window.setTimeout(() => {
                        if (touched.current) return;
                        setOpen((f) => new Set(f).add(0));
                    }, 1500),
                    window.setTimeout(() => {
                        if (touched.current) return;
                        setOpen((f) => { const n = new Set(f); n.delete(0); return n; });
                    }, 3600)
                );
            }
        }, { threshold: 0.4 });
        io.observe(root);
        return () => io.disconnect();
    }, []);

    useEffect(() => () => timers.current.forEach(clearTimeout), []);

    const selectPersona = (id: PersonaWeek['id']) => {
        if (id !== personaId) {
            setPersonaId(id);
            setOpen(new Set());
        }
    };

    const toggleOpen = (i: number) => {
        touched.current = true;
        setOpen((f) => {
            const n = new Set(f);
            if (n.has(i)) n.delete(i); else n.add(i);
            return n;
        });
    };

    // Radiogroup keyboard protocol: arrows + Home/End move the
    // selection (and the focus) between the persona tabs.
    const onPickerKeyDown = (e: React.KeyboardEvent) => {
        const idx = PAIN_MIRROR.findIndex((p) => p.id === personaId);
        let next: number | null = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % PAIN_MIRROR.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + PAIN_MIRROR.length) % PAIN_MIRROR.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = PAIN_MIRROR.length - 1;
        if (next === null) return;
        e.preventDefault();
        selectPersona(PAIN_MIRROR[next].id);
        tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
    };

    return (
        <section ref={sectionRef} className="relative py-16 sm:py-24 overflow-hidden" style={{ background: '#0A101C' }}>
            <div className="absolute -top-32 right-1/4 w-[34rem] h-[24rem] rounded-full bg-emerald-500/[0.07] blur-[130px] pointer-events-none" aria-hidden="true" />
            <div className="absolute -bottom-40 left-1/4 w-[36rem] h-[24rem] rounded-full bg-emerald-600/[0.08] blur-[130px] pointer-events-none" aria-hidden="true" />
            <div className="absolute inset-0 w7-grain pointer-events-none" aria-hidden="true" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
                <div ref={ref} className="w9-reveal text-center mb-8 md:mb-10 max-w-3xl mx-auto">
                    <p className="text-xs sm:text-xs font-bold uppercase tracking-[0.3em] mb-4 text-emerald-400/90">
                        Sound familiar?
                    </p>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white font-display" style={{ '--w9-d': '90ms' } as React.CSSProperties}>
                        Your business already runs on a system.
                        <br />
                        <span className="text-transparent bg-clip-text inline-block pb-1" style={{ backgroundImage: 'linear-gradient(to right, #6EE7B7, #34D399)' }}>
                            It&rsquo;s just not software.
                        </span>
                    </h2>
                    <p className="text-lg text-slate-400 mt-4 max-w-2xl mx-auto" style={{ '--w9-d': '180ms' } as React.CSSProperties}>
                        Spreadsheets, chat threads, memory and paper will get a business started —
                        then quietly hold it back.{' '}
                        <span className="text-slate-200">Pick the business that looks like yours: five real moments from its week — and what changes when a system takes over.</span>
                    </p>
                </div>

                {/* ── The picker — four real operators. The cue line,
                    the switch glyph and the hover states all say TAB:
                    tap one and the whole story below switches. ── */}
                <div ref={pickerRef} className="w9-reveal-stagger max-w-5xl mx-auto">
                    <p className="mb-3 flex items-center justify-center gap-2 text-2xs sm:text-xs font-bold uppercase tracking-[0.22em] text-slate-500">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="text-emerald-400/80">
                            <path d="M2 5.5h9M10 5.5L7.5 3M10 5.5L7.5 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M14 10.5H5M5 10.5l2.5-2.5M5 10.5l2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Tap the one that runs like your week — the story below switches to match it
                    </p>
                    <div
                        ref={tabsRef}
                        className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 md:mb-10"
                        role="radiogroup"
                        aria-label="Who runs a week like yours?"
                        onKeyDown={onPickerKeyDown}
                    >
                        {PAIN_MIRROR.map((p) => {
                            const selected = p.id === personaId;
                            return (
                                <Button
                                    key={p.id}
                                    variant="bare"
                                    role="radio"
                                    aria-checked={selected}
                                    tabIndex={selected ? 0 : -1}
                                    onClick={() => selectPersona(p.id)}
                                    className={`group/card relative cursor-pointer overflow-hidden rounded-2xl border text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.985] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300/80 ${
                                        selected
                                            ? 'border-emerald-400/60 shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_18px_40px_-18px_rgba(16,185,129,0.45)]'
                                            : 'border-white/[0.08] hover:border-white/25'
                                    }`}
                                >
                                    <span className="relative block aspect-[4/3] overflow-hidden">
                                        <img
                                            src={`/assets/landing/people/${p.photo}?v=${buildSha}`}
                                            alt={p.photoAlt}
                                            loading="lazy"
                                            decoding="async"
                                            className={`h-full w-full object-cover object-top transition-all duration-300 ${selected ? 'scale-[1.03] saturate-100' : 'saturate-[0.82] group-hover/card:scale-[1.02] group-hover/card:saturate-100'}`}
                                        />
                                        <span className={`absolute inset-0 transition-opacity duration-300 ${selected ? 'bg-emerald-500/10 opacity-100' : 'bg-gradient-to-t from-[#0A101C]/85 via-transparent to-transparent'}`} aria-hidden="true" />
                                        {selected ? (
                                            <span className="pm-pop absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400 text-[#0A101C]" aria-hidden="true">
                                                <svg width="13" height="13" viewBox="0 0 26 26" fill="none"><path d="M6 13.5L10.5 18L20 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                            </span>
                                        ) : (
                                            <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border border-white/25 bg-[#0A101C]/60 text-slate-300 backdrop-blur-sm transition-colors duration-200 group-hover/card:border-emerald-300/70 group-hover/card:text-emerald-300" aria-hidden="true">
                                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                                    <path d="M2 5.5h8M10 5.5L8 3.5M10 5.5L8 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                                    <path d="M14 10.5H6M6 10.5l2-2M6 10.5l2 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </span>
                                        )}
                                    </span>
                                    <span className="flex items-baseline justify-between gap-2 px-4 py-3">
                                        <span className={`text-sm font-bold transition-colors duration-200 ${selected ? 'text-white' : 'text-slate-300 group-hover/card:text-white'}`}>{p.cardLabel}</span>
                                        <span className="text-right">
                                            <span className={`block text-xs font-semibold ${selected ? 'text-emerald-300' : 'text-slate-500'}`}>{p.name}</span>
                                            <span className={`block text-2xs font-semibold uppercase tracking-[0.14em] ${selected ? 'text-emerald-300/70' : 'text-slate-600'}`}>{p.role}</span>
                                        </span>
                                    </span>
                                </Button>
                            );
                        })}
                    </div>
                </div>

                {/* ── The week — five moments from the chosen business.
                    Tap one: today crossfades into the same moment on a
                    system — their system, never a product name. The
                    card never changes height; the layers swap in
                    place. ── */}
                <div key={persona.id} className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                    {persona.moments.map((m, i) => {
                        const isOpen = open.has(i);
                        return (
                            <div key={m.title} className="pm-in" style={{ animationDelay: `${i * 90}ms`, ['--pm-rot' as string]: `${((i % 2 === 0 ? -1 : 1) * (0.8 + (i % 3) * 0.35)).toFixed(2)}deg` }}>
                                <Button
                                    variant="bare"
                                    aria-pressed={isOpen}
                                    aria-label={`${m.title} — ${m.aria}`}
                                    onClick={() => toggleOpen(i)}
                                    className={`pm-card w-full cursor-pointer text-left ${isOpen ? 'is-open' : ''}`}
                                >
                                    <span className="pm-layer pm-layer-front" aria-hidden="true">
                                        <span className="flex items-center justify-between px-3.5 pt-3 pb-2">
                                            <FaceTag tone="bad">Today · {m.when}</FaceTag>
                                        </span>
                                        <span className="flex flex-1 items-center justify-center px-3.5 py-2">
                                            <ArtifactFront m={m} />
                                        </span>
                                        <span className="px-3.5 pb-3 pt-2">
                                            <span className="block text-[13px] font-bold text-white leading-snug">{m.title}</span>
                                            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">tap — see it on a system</span>
                                        </span>
                                    </span>
                                    <span className="pm-layer pm-layer-back" aria-hidden="true">
                                        <span className="flex flex-1 flex-col items-start justify-center gap-2.5 px-4 py-3">
                                            <FaceTag tone="good">On a system</FaceTag>
                                            <span className="text-[15px] font-extrabold text-white leading-[1.3]">{m.sigh}</span>
                                            <span className="text-[12px] sm:text-[13px] font-semibold text-emerald-50/90 leading-[1.55]">{m.fix}</span>
                                        </span>
                                        <span className="px-4 pb-3">
                                            <span className="block text-[13px] font-bold text-white/85 leading-snug">{m.title}</span>
                                            <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300/60">tap — back to today</span>
                                        </span>
                                    </span>
                                </Button>
                            </div>
                        );
                    })}
                </div>

                {/* ── The pivot — the builder's promise: one mark, one
                    offer, whatever the visitor runs. The empathy band
                    names no products and routes no catalogues; the
                    conversation starts where their system does. ── */}
                <div key={`pivot-${persona.id}`} className="pm-in max-w-4xl mx-auto mt-10 md:mt-12">
                    <div className="relative rounded-2xl border border-white/[0.09] bg-white/[0.03] backdrop-blur-sm overflow-hidden">
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent" aria-hidden="true" />
                        <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-7 px-6 sm:px-8 py-6 sm:py-7">
                            <img
                                src={`/assets/landing/people/${persona.photo}?v=${buildSha}`}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="h-20 w-20 sm:h-24 sm:w-24 flex-shrink-0 rounded-full object-cover object-top ring-2 ring-emerald-400/40"
                            />
                            <div className="flex-1 text-center sm:text-left min-w-0">
                                <p className="text-2xs font-bold uppercase tracking-[0.22em] text-emerald-300/90">
                                    {persona.name} · {persona.role}
                                </p>
                                <p className="mt-1.5 text-[15px] sm:text-base text-slate-300/95 leading-[1.7]">{persona.pivot.line}</p>
                            </div>
                            <div className="flex flex-col items-center gap-3 flex-shrink-0">
                                <span className="flex items-center gap-2.5">
                                    <Logo className="h-8 w-8 text-primary-500" />
                                    <span className="text-left">
                                        <span className="block text-sm font-extrabold text-white leading-tight">PracticePro Systems</span>
                                        <span className="block text-2xs font-semibold uppercase tracking-[0.14em] text-slate-500">systems &amp; integrations</span>
                                    </span>
                                </span>
                                <Button
                                    variant="bare"
                                    onClick={onContactSales}
                                    className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-semibold text-sm text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 shadow-lg shadow-primary-500/40 hover:shadow-[0_0_40px_-6px_rgba(22,163,74,0.7)] transition-all duration-300 active:scale-[0.98]"
                                >
                                    Tell us what runs your business today
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div ref={closeRef} className="w9-reveal text-center mt-12 md:mt-14 max-w-2xl mx-auto">
                    <p className="text-lg text-slate-300/95 leading-[1.75]">
                        If any of that is your business, you don&rsquo;t need more discipline or a
                        better spreadsheet. <span className="text-white font-semibold">You need a system</span> —
                        and building it is exactly what we do.
                    </p>
                </div>
            </div>

            <style>{`
                /* Entrance — the week staggers in when the persona changes. */
                @keyframes pm-in-on {
                    from { opacity: 0; transform: rotate(var(--pm-rot, 0deg)) translateY(12px); }
                    to { opacity: 1; transform: rotate(var(--pm-rot, 0deg)) translateY(0); }
                }
                .pm-in { opacity: 0; animation: pm-in-on 520ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
                @keyframes pm-pop-on {
                    from { opacity: 0; transform: scale(0.5); }
                    to { opacity: 1; transform: scale(1); }
                }
                .pm-pop { opacity: 0; animation: pm-pop-on 300ms cubic-bezier(0.22, 1, 0.36, 1) 160ms forwards; }
                /* The buried order — sinks below the chat and dims. */
                @keyframes pm-sink-on {
                    0% { opacity: 1; }
                    55% { opacity: 0.95; }
                    100% { opacity: 0.3; transform: translateY(14px); }
                }
                .pm-sink { animation: pm-sink-on 1600ms 400ms cubic-bezier(0.45, 0, 0.75, 0.35) both; }

                /* The toggle — today and on-a-system share ONE card of
                   fixed aspect: the two layers crossfade in place
                   (opacity + a whisper of scale and slide), so the card
                   never changes height, nothing spills, and focus rings
                   stay clean rectangles. No 3D, no backface, no layout
                   shift. */
                .pm-card {
                    display: block; position: relative;
                    aspect-ratio: 3 / 4.35; overflow: hidden;
                    border-radius: 0.95rem;
                    border: 1px solid rgba(255,255,255,0.1);
                    background: rgba(255,255,255,0.03);
                    transition: border-color 300ms ease, background 300ms ease;
                }
                .pm-card:hover { border-color: rgba(255,255,255,0.22); }
                .pm-card.is-open {
                    border-color: rgba(110,231,183,0.45);
                    background: linear-gradient(165deg, rgba(16,185,129,0.16), rgba(16,185,129,0.05));
                }
                .pm-card:focus-visible { outline: 2px solid rgba(110,231,183,0.85); outline-offset: 3px; }
                .pm-layer {
                    position: absolute; inset: 0;
                    display: flex; flex-direction: column;
                    transition: opacity 320ms ease, transform 320ms cubic-bezier(0.22, 1, 0.36, 1);
                }
                .pm-layer-front { opacity: 1; transform: scale(1) translateY(0); }
                .pm-layer-back { opacity: 0; transform: scale(0.955) translateY(8px); }
                .pm-card.is-open .pm-layer-front { opacity: 0; transform: scale(0.955) translateY(-8px); }
                .pm-card.is-open .pm-layer-back { opacity: 1; transform: scale(1) translateY(0); }

                @media (prefers-reduced-motion: reduce) {
                    .pm-in, .pm-pop, .pm-sink { animation: none; opacity: 1; }
                    .pm-card, .pm-layer { transition: none; }
                }
            `}</style>
        </section>
    );
};


