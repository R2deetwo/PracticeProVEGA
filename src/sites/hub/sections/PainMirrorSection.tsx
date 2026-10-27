/**
 * PainMirrorSection (Sound familiar?) — R34: WHOSE WEEK IS THIS?
 *
 * Owner direction (R34): "improve the sounds familiar section. consider
 * what it is i am trying to do in that space and do it in a totally
 * different way… drastically improved."
 *
 * WHAT THE SPACE IS FOR: the hub sells to three kinds of visitor at once
 * (law practices → VEGA, property managers → ATRIUM, every other
 * business → a custom build). The old section mirrored ONE persona —
 * Ada, a fashion house — in abstract chip-theatre: a lawyer never saw
 * their own week, a property manager never saw theirs, and the pivot
 * pointed everyone at the same generic CTA. The job of this section is
 * RECOGNITION → BELONGING → ROUTING, and it was only doing a third of
 * it, for a third of the audience, in the least human language on the
 * page.
 *
 * THE TOTALLY DIFFERENT WAY — the visitor declares who they are, and
 * the band becomes THEIRS:
 *
 *   1. THREE REAL PEOPLE to choose from — photographed portraits of a
 *      barrister (Ikeja), an estate manager (Lekki) and a fashion
 *      founder (Yaba, our Ada). "Selling to real people starts with
 *      showing them" — the picker is the personalization.
 *   2. THE WEEK AS OBJECTS — five artifacts from that person's actual
 *      week, rendered as the REAL objects they are (a WhatsApp bubble,
 *      a bank alert, an adjournment slip, a manila file, a key tag, a
 *      phone at 11:47 pm). Not abstract chips: the visitor's own
 *      furniture. Each flips — TODAY on the front, the system's answer
 *      on the back — so the before/after is DIRECT manipulation, not a
 *      timed beat to wait through.
 *   3. THE PIVOT ROUTES — each persona's band closes on the product
 *      built for their world (Vega / Atrium / a PracticePro build),
 *      with that product's own mark, instead of one generic CTA.
 *
 * Ada's five moments (R29, owner-praised copy) survive verbatim as the
 * "my own business" week — continuity, and the test pins hold.
 *
 * Motion: persona switch staggers the new week in; artifacts flip in
 * 3D (480ms, expo-out); one artifact demonstrates the flip itself,
 * once, when the section first fills the viewport; reduced-motion
 * visitors get instant state changes and no demo.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui';
import { VegaMark, AtriumMark } from '../../../components/marketing/brand/ProductMarks';
import { Logo } from '../../../constants';
import { useScrollReveal } from '../hooks';

// Cache-bust landing assets per build (the About section's pattern).
const buildSha = (import.meta as any).env?.VITE_BUILD_SHA || Date.now();

// ── The artifact kit — real objects, DOM-drawn, crisp at any DPI ───────────

/** A small mono label used on artifact faces. */
const FaceTag: React.FC<{ tone: 'bad' | 'good'; children: React.ReactNode }> = ({ tone, children }) => (
    <span className={`font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em] ${tone === 'bad' ? 'text-red-300/80' : 'text-emerald-300/90'}`}>
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
        {tag && <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em] text-red-300/75">{tag}</span>}
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
                    <span key={m} className={`pm-in rounded-full border border-dashed border-red-400/50 bg-red-500/[0.07] px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-red-200/90 ${i === 0 ? '' : ''}`} style={{ animationDelay: `${240 + i * 130}ms` }}>
                        {m}
                    </span>
                ))}
            </div>
        )}
    </div>
);

/** 3 · A court adjournment slip — the date that lived in a text. */
const AdjournmentSlip: React.FC<{ court: string; date: string }> = ({ court, date }) => (
    <div className="w-full">
        <div className="pm-in relative rounded-md border border-slate-300/80 bg-[#F5F1E6] text-slate-800 px-3 py-2.5 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.7)]">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">Adjourned</p>
            <p className="text-[11px] sm:text-xs font-extrabold mt-1 leading-snug">{date}</p>
            <p className="text-[9px] sm:text-[10px] font-semibold text-slate-500 mt-0.5">{court}</p>
            <span className="absolute -right-1.5 top-2 rotate-[8deg] rounded border-[1.5px] border-red-500/60 px-1.5 py-px text-[8px] font-black uppercase tracking-[0.14em] text-red-600/80">Noted in a text</span>
        </div>
        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em] text-red-300/75 mt-2">nothing diarises it</p>
    </div>
);

/** 4 · A manila file — the case only one person can find. */
const ManilaFile: React.FC<{ tab: string; sticky: string }> = ({ tab, sticky }) => (
    <div className="w-full">
        <div className="pm-in rounded-md border border-amber-200/25 bg-amber-100/[0.08] px-3 pt-3.5 pb-3">
            <span className="block rounded-t-md bg-amber-100/15 border border-amber-200/20 border-b-0 px-2.5 pt-1 pb-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-100/80 w-max max-w-full truncate">{tab}</span>
            <p className="text-[10px] sm:text-[11px] text-amber-50/70 font-medium mt-1.5 leading-snug">the paper file — not in the system</p>
        </div>
        <span className="pm-in mt-2 block w-max -rotate-2 rounded-sm bg-yellow-200/85 px-2 py-1 text-[9px] sm:text-[10px] font-bold text-yellow-950 shadow-sm" style={{ animationDelay: '300ms' }}>{sticky}</span>
    </div>
);

/** 5 · A fee note that never left draft. */
const FeeNote: React.FC<{ ref_: string; amount: string; state: string }> = ({ ref_, amount, state }) => (
    <div className="w-full">
        <div className="pm-in relative rounded-md border border-slate-300/80 bg-[#F5F1E6] text-slate-800 px-3 py-2.5 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.7)] overflow-hidden">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500">{ref_}</p>
            <p className="text-base sm:text-lg font-extrabold leading-tight mt-0.5">{amount}</p>
            <p className="text-[9px] sm:text-[10px] font-semibold text-slate-500">{state}</p>
            <span className="absolute inset-0 flex items-center justify-center">
                <span className="rotate-[-14deg] text-[13px] font-black uppercase tracking-[0.3em] text-red-600/25 border-2 border-red-600/25 rounded px-2 py-0.5">Draft</span>
            </span>
        </div>
        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em] text-red-300/75 mt-2">the work was done in march</p>
    </div>
);

/** 6 · The laptop at 11:04 pm — the draft due at 9. */
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
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em] text-red-300/75">{due}</span>
        </div>
    </div>
);

/** 7 · The diary page — the date nobody wrote down. */
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

/** 9 · The key tag — the unit that sat empty. */
const KeyTag: React.FC<{ unit: string; status: string; note: string }> = ({ unit, status, note }) => (
    <div className="w-full flex flex-col items-center">
        <div className="pm-in flex flex-col items-center">
            <span className="h-3 w-3 rounded-full border-2 border-red-400/60" aria-hidden="true" />
            <span className="h-4 w-px bg-red-400/50" aria-hidden="true" />
            <div className="rounded-md border border-slate-300/80 bg-[#F5F1E6] text-slate-800 px-3 py-2 shadow-[0_8px_20px_-10px_rgba(0,0,0,0.7)]">
                <p className="text-[11px] sm:text-xs font-black tracking-wide">{unit}</p>
                <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] text-red-600/80">{status}</p>
            </div>
        </div>
        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em] text-red-300/75 mt-2 text-center">{note}</p>
    </div>
);

/** 10 · The phone at midnight — the tenant's call / the personal line. */
const PhoneLock: React.FC<{ who: string; time: string; line: string; foot?: string }> = ({ who, time, line, foot }) => (
    <div className="w-full flex justify-center">
        <div className="pm-in w-[80%] rounded-[1.2rem] border-2 border-white/25 bg-white/[0.04] px-3 py-3 text-center">
            <p className="font-mono text-[10px] font-bold text-slate-400">{time}</p>
            <p className="text-[11px] sm:text-xs font-bold text-slate-200 mt-1.5">{who}</p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 leading-snug mt-0.5">{line}</p>
            {foot && <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-red-300/75 mt-2">{foot}</p>}
        </div>
    </div>
);

/** 11 · The staff tag — the one who knows is away. */
const StaffTag: React.FC<{ name: string; status: string; knows: string[] }> = ({ name, status, knows }) => (
    <div className="w-full flex flex-col items-center">
        <div className="pm-in rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2.5 w-[92%]">
            <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/[0.05] text-[11px] font-bold text-slate-300" aria-hidden="true">S</span>
                <span className="text-left">
                    <span className="block text-[11px] sm:text-xs font-bold text-slate-200 leading-tight">{name}</span>
                    <span className="block text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] text-red-300/75">{status}</span>
                </span>
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-1">
                {knows.map((k) => (
                    <span key={k} className="rounded border border-red-400/40 bg-red-500/[0.08] px-1.5 py-px text-[8px] sm:text-[9px] font-semibold text-red-200/90">{k}</span>
                ))}
            </div>
        </div>
        <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.16em] text-red-300/75 mt-2">today, everyone guesses</p>
    </div>
);

// ── The data — three weeks, five moments each ──────────────────────────────

type MomentKind =
    | { kind: 'whatsapp'; sender: string; time: string; body: string; attachment?: string; tag?: string; sink?: boolean }
    | { kind: 'alert'; amount: string; from: string; maybes?: string[] }
    | { kind: 'adjourn'; court: string; date: string }
    | { kind: 'file'; tab: string; sticky: string }
    | { kind: 'fee'; ref_: string; amount: string; state: string }
    | { kind: 'laptop'; clock: string; due: string; doc: string }
    | { kind: 'diary'; day: string; lines: string[]; alarm: string }
    | { kind: 'receipt'; title: string; amount: string; note: string }
    | { kind: 'keytag'; unit: string; status: string; note: string }
    | { kind: 'phone'; who: string; time: string; line: string; foot?: string }
    | { kind: 'staff'; name: string; status: string; knows: string[] };

type Moment = {
    when: string;
    title: string;
    aria: string;
    front: MomentKind;
    fix: string;
};

type PersonaWeek = {
    id: 'law' | 'property' | 'business';
    cardLabel: string;
    name: string;
    role: string;
    photo: string;
    photoAlt: string;
    backTag: string;
    moments: Moment[];
    pivot: {
        line: string;
        mark: 'vega' | 'atrium' | 'practicepro';
        productName: string;
        productTag: string;
    };
};

/** The artifact front renderer. */
const ArtifactFront: React.FC<{ m: Moment }> = ({ m }) => {
    const f = m.front;
    switch (f.kind) {
        case 'whatsapp': return <WhatsAppBubble sender={f.sender} time={f.time} body={f.body} attachment={f.attachment} tag={f.tag} sink={f.sink} />;
        case 'alert': return <CreditAlert amount={f.amount} from={f.from} maybes={f.maybes} />;
        case 'adjourn': return <AdjournmentSlip court={f.court} date={f.date} />;
        case 'file': return <ManilaFile tab={f.tab} sticky={f.sticky} />;
        case 'fee': return <FeeNote ref_={f.ref_} amount={f.amount} state={f.state} />;
        case 'laptop': return <LaptopLate clock={f.clock} due={f.due} doc={f.doc} />;
        case 'diary': return <DiaryPage day={f.day} lines={f.lines} alarm={f.alarm} />;
        case 'receipt': return <ReceiptPaper title={f.title} amount={f.amount} note={f.note} />;
        case 'keytag': return <KeyTag unit={f.unit} status={f.status} note={f.note} />;
        case 'phone': return <PhoneLock who={f.who} time={f.time} line={f.line} foot={f.foot} />;
        case 'staff': return <StaffTag name={f.name} status={f.status} knows={f.knows} />;
    }
};

// ── The three weeks (Ada's five R29 moments survive verbatim as the
//    "my own business" week — the copy the owner praised, kept). ────────────
const PAIN_MIRROR: PersonaWeek[] = [
    {
        id: 'law',
        cardLabel: 'I run a law practice',
        name: 'Funmi Adeyemi',
        role: 'two-lawyer firm · Ikeja',
        photo: 'persona-lawyer.jpg',
        photoAlt: 'Barrister Funmi Adeyemi in her chambers in Ikeja at dusk, holding a manila case file',
        backTag: 'On Vega',
        moments: [
            {
                when: 'Mon · 9:41 pm',
                title: 'The brief that lives in WhatsApp',
                aria: 'Monday, 9:41 pm. A client sends documents for a land matter on WhatsApp — one of two hundred and fourteen unread. On Vega, it is filed to its matter the moment it arrives.',
                front: { kind: 'whatsapp', sender: 'Client · land matter', time: '9:41 pm', body: 'Good evening counsel — pls see the attached for Monday', attachment: 'AFFIDAVIT_DRAFT.PDF', tag: 'one of 214 unread' },
                fix: 'Filed to its matter the moment it arrived — chat stays chat, the file is the file.',
            },
            {
                when: 'Tue · 2:15 pm',
                title: 'The date that lived in a text',
                aria: 'Tuesday, 2:15 pm. The case is adjourned to the fourteenth of November — the date is noted in a text message and nothing diarises it. On Vega, court dates diarise themselves with reminders for client, clerk and counsel.',
                front: { kind: 'adjourn', court: 'High Court, Ikeja Div.', date: '14 Nov · 9:00 am' },
                fix: 'Court dates diarise themselves — reminders to client, clerk and you.',
            },
            {
                when: 'Wed · 11:00 am',
                title: 'The file only he can find',
                aria: 'Wednesday, 11 am. The Okafor file — only the senior partner knows where the paper file is, and he is away. On Vega, searching any name or suit number surfaces the file, the filings and the notes in seconds.',
                front: { kind: 'file', tab: 'Okafor v. Zenith Bank · IKD/1287/2026', sticky: 'check the other room — S.' },
                fix: 'Search any name or suit number — file, filings, notes. Seconds.',
            },
            {
                when: 'Fri · 4:40 pm',
                title: 'The fee note that never went out',
                aria: 'Friday, 4:40 pm. Four hundred and fifty thousand naira of March work is still a draft fee note nobody sent. On Vega, fee notes go out on time and track themselves to payment.',
                front: { kind: 'fee', ref_: 'Fees note · March', amount: '₦450,000', state: 'ref 0418 · never sent' },
                fix: 'Fee notes go out on time — and walk themselves to payment.',
            },
            {
                when: 'Sun · 11:04 pm',
                title: 'The draft due at 9 a.m.',
                aria: 'Sunday, 11:04 pm. A motion on notice is due at nine the next morning and the whole firm is one tired laptop. On Vega, ALOA reads every draft before it goes — a second pair of eyes, all night.',
                front: { kind: 'laptop', clock: '11:04 pm', due: 'due 9:00 am', doc: 'MOTION ON NOTICE — 14 paras' },
                fix: 'ALOA reads every draft before it goes — a second pair of eyes, all night. You sleep.',
            },
        ],
        pivot: {
            line: 'Her practice runs on Vega now — matters, hearings, fee notes and drafts in one place, with ALOA keeping the light on after dark.',
            mark: 'vega',
            productName: 'Vega',
            productTag: 'the legal practice OS',
        },
    },
    {
        id: 'property',
        cardLabel: 'I manage property',
        name: 'Chuka Obi',
        role: '14 units · Lekki',
        photo: 'persona-estate.jpg',
        photoAlt: 'Estate manager Chuka Obi in the courtyard of a well-kept apartment block in Lekki at golden hour',
        backTag: 'On Atrium',
        moments: [
            {
                when: 'Mon · 4:15 pm',
                title: 'The payment you can\u2019t place',
                aria: 'Monday, 4:15 pm. Three hundred and fifty thousand naira lands — Unit 4 rent, service charge, or a part-payment? On Atrium, every payment is matched to its tenant, unit and ledger as it lands.',
                front: { kind: 'alert', amount: '₦350,000', from: 'Acct ••8841 · from N. Okafor', maybes: ['Unit 4 rent?', 'Service charge?', 'Part-payment?'] },
                fix: 'Matched to the tenant, the unit and the ledger as it lands.',
            },
            {
                when: 'Tue · 9:00 am',
                title: 'The renewal nobody diarised',
                aria: 'Tuesday, 9 am. Unit 4\u2019s lease expired three days ago — found by a complaint, not a calendar. On Atrium, renewals, escalations and inspections are scheduled ahead.',
                front: { kind: 'diary', day: 'Tuesday', lines: ['Unit 4 — lease expired 3 days ago'], alarm: 'found by a complaint' },
                fix: 'Renewals, escalations, inspections — scheduled ahead, never discovered late.',
            },
            {
                when: 'Thu · 6:30 pm',
                title: 'The receipt in the shoebox',
                aria: 'Thursday, 6:30 pm. The generator servicing should be under warranty — the receipt is in a shoebox. On Atrium, every document is filed the day it arrives and search finds it in seconds.',
                front: { kind: 'receipt', title: 'Generator servicing', amount: '₦85,000', note: 'warranty — in the shoebox' },
                fix: 'Filed the day it arrived — searched, found, warranty honoured.',
            },
            {
                when: 'Sat · 10:00 am',
                title: 'The unit that sat empty',
                aria: 'Saturday, 10 am. Unit 6 has been vacant three weeks because \u2018list it\u2019 lived in his head. On Atrium, vacancy, listings and prospects sit on one board, always current.',
                front: { kind: 'keytag', unit: 'UNIT 6', status: 'Vacant · 3 weeks', note: '\u2018list it\u2019 lived in his head' },
                fix: 'Vacancy, listings and prospects on one board — always current.',
            },
            {
                when: 'Sun · 11:47 pm',
                title: 'The tenant\u2019s midnight call',
                aria: 'Sunday, 11:47 pm. A tenant calls his personal line about a power fault. On Atrium, tenants log issues where they are tracked, assigned and closed — not on the manager\u2019s phone.',
                front: { kind: 'phone', who: 'Tenant · Unit 2', time: '11:47 pm', line: '\u2018no light ooo\u2019 — on his personal line' },
                fix: 'Tenants log issues where they\u2019re tracked, assigned and closed — not on your line.',
            },
        ],
        pivot: {
            line: 'His portfolio runs on Atrium — tenants, leases, receipts and vacancies in one place, with ARIA keeping every unit accounted for.',
            mark: 'atrium',
            productName: 'Atrium',
            productTag: 'the estate manager\u2019s system',
        },
    },
    {
        id: 'business',
        cardLabel: 'I run my own business',
        name: 'Ada Eze',
        role: 'fashion house · Yaba',
        photo: 'persona-founder.jpg',
        photoAlt: 'Fashion founder Ada Eze in her studio in Yaba at night, one hand resting on a stack of folded fabric',
        backTag: 'On a system',
        moments: [
            {
                when: 'Mon · 9:41 am',
                title: 'The order that got buried',
                aria: 'Monday, 9:41 am. A customer sends her measurements for two outfits on WhatsApp — and the order disappears under three hundred more messages. On a system, orders land in a queue with customer, price and due date.',
                front: { kind: 'whatsapp', sender: 'Customer', time: '9:41 am', body: '2 outfits · measurements attached', tag: 'one of 312 unread', sink: true },
                fix: 'Orders land in a queue — customer, price, due date. Nothing important lives in the scroll.',
            },
            {
                when: 'Wed · 4:15 pm',
                title: 'The payment you can\u2019t place',
                aria: 'Wednesday, 4:15 pm. One hundred and twenty thousand naira lands — Bola\u2019s invoice or Tunde\u2019s fabric money? On a system, every payment matches itself and balances stay current.',
                front: { kind: 'alert', amount: '₦120,000', from: 'Wed · 4:15 pm', maybes: ['Bola — invoice #118?', 'Tunde — fabric money?', 'the paper list?'] },
                fix: 'Every payment matches itself to its customer — balances always current.',
            },
            {
                when: 'Thu · 8:00 am',
                title: 'The one who knows is away',
                aria: 'Thursday, 8 am. Pricing, rush rules and who takes what live in one shop assistant\u2019s head — and he is away till Monday. On a system, the process lives on a page anyone can run.',
                front: { kind: 'staff', name: 'Sunday', status: 'away — till Monday', knows: ['pricing', 'rush rules', 'who takes what'] },
                fix: 'The process lives on a page anyone can run.',
            },
            {
                when: 'Fri · 6:30 pm',
                title: 'The receipt hunt',
                aria: 'Friday, 6:30 pm. The generator repair should be under warranty — the receipt is in a drawer, a bag, or a WhatsApp photo from March. On a system, documents are filed the day they arrive.',
                front: { kind: 'receipt', title: 'Generator repair', amount: 'warranty?', note: 'in a drawer · a bag · March?' },
                fix: 'Filed the day it arrives — found in seconds.',
            },
            {
                when: 'Sun · 11:04 pm',
                title: 'The owner\u2019s shift',
                aria: 'Sunday, 11:04 pm. Orders arrive on her personal line beside the reminders she meant to send — the business is open whenever her eyes are. On a system, the routine runs without her.',
                front: { kind: 'phone', who: 'personal line — new order', time: '11:04 pm', line: 'next to 4 reminders she meant to send', foot: 'battery 8%' },
                fix: 'The routine runs without you — the evening is yours.',
            },
        ],
        pivot: {
            line: 'Ada\u2019s week is the reason we build. Software and custom systems for businesses like yours — designed around how you already work.',
            mark: 'practicepro',
            productName: 'PracticePro Systems',
            productTag: 'software & custom systems',
        },
    },
];

// ── The section ────────────────────────────────────────────────────────────
export const PainMirrorSection: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    const pickerRef = useScrollReveal<HTMLDivElement>();
    const closeRef = useScrollReveal<HTMLDivElement>();
    const sectionRef = useRef<HTMLElement>(null);

    // The visitor's declaration — whose week is this? Defaults to the
    // flagship practice (law); the picker is the whole point, so no
    // auto-cycling: switching persona is the visitor answering the
    // question, not something the page does to them.
    const [personaId, setPersonaId] = useState<PersonaWeek['id']>('law');
    const [flipped, setFlipped] = useState<Set<number>>(new Set());
    const hinted = useRef(false);
    const touched = useRef(false);
    const timers = useRef<number[]>([]);
    const reduced = useRef(
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    );

    const persona = PAIN_MIRROR.find((p) => p.id === personaId) ?? PAIN_MIRROR[0];

    // One-time demo: when the section first fills the viewport, flip the
    // first artifact open and closed again — teaching the interaction
    // without a word of instruction. Never runs for reduced-motion
    // visitors, and never after the visitor has flipped one themselves.
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
                        setFlipped((f) => new Set(f).add(0));
                    }, 1500),
                    window.setTimeout(() => {
                        if (touched.current) return;
                        setFlipped((f) => { const n = new Set(f); n.delete(0); return n; });
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
            setFlipped(new Set());
        }
    };

    const toggleFlip = (i: number) => {
        touched.current = true;
        setFlipped((f) => {
            const n = new Set(f);
            if (n.has(i)) n.delete(i); else n.add(i);
            return n;
        });
    };

    const Mark = persona.pivot.mark === 'vega' ? VegaMark : persona.pivot.mark === 'atrium' ? AtriumMark : null;

    return (
        <section ref={sectionRef} className="relative py-16 sm:py-24 overflow-hidden" style={{ background: '#0A101C' }}>
            <div className="absolute -top-32 right-1/4 w-[34rem] h-[24rem] rounded-full bg-emerald-500/[0.07] blur-[130px] pointer-events-none" aria-hidden="true" />
            <div className="absolute -bottom-40 left-1/4 w-[36rem] h-[24rem] rounded-full bg-emerald-600/[0.08] blur-[130px] pointer-events-none" aria-hidden="true" />
            <div className="absolute inset-0 w7-grain pointer-events-none" aria-hidden="true" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
                <div ref={ref} className="w9-reveal text-center mb-10 md:mb-12 max-w-3xl mx-auto">
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
                        <span className="text-slate-200">Pick the week that looks like yours: five real moments from it, and the system that answers each one.</span>
                    </p>
                </div>

                {/* ── The picker — three real people. The visitor answers
                    the question themselves; the band becomes theirs. ── */}
                <div ref={pickerRef} className="w9-reveal-stagger max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8 md:mb-10" role="radiogroup" aria-label="Whose week looks like yours?">
                    {PAIN_MIRROR.map((p) => {
                        const selected = p.id === personaId;
                        return (
                            <Button
                                key={p.id}
                                variant="bare"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => selectPersona(p.id)}
                                className={`group/card relative overflow-hidden rounded-2xl border text-left transition-all duration-200 active:scale-[0.985] ${
                                    selected
                                        ? 'border-emerald-400/60 shadow-[0_0_0_1px_rgba(52,211,153,0.35),0_18px_40px_-18px_rgba(16,185,129,0.45)]'
                                        : 'border-white/[0.08] hover:border-white/20'
                                }`}
                            >
                                <span className="relative block aspect-[4/3] overflow-hidden">
                                    <img
                                        src={`/assets/landing/people/${p.photo}?v=${buildSha}`}
                                        alt={p.photoAlt}
                                        loading="lazy"
                                        decoding="async"
                                        className={`h-full w-full object-cover object-top transition-all duration-300 ${selected ? 'scale-[1.03] saturate-100' : 'saturate-[0.82] group-hover/card:saturate-100'}`}
                                    />
                                    <span className={`absolute inset-0 transition-opacity duration-300 ${selected ? 'bg-emerald-500/10 opacity-100' : 'bg-gradient-to-t from-[#0A101C]/85 via-transparent to-transparent'}`} aria-hidden="true" />
                                    {selected && (
                                        <span className="pm-pop absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-400 text-[#0A101C]" aria-hidden="true">
                                            <svg width="13" height="13" viewBox="0 0 26 26" fill="none"><path d="M6 13.5L10.5 18L20 8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
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

                {/* ── The week — five artifacts from the chosen person's
                    desk. Flip one: today on the front, the system's
                    answer on the back. ── */}
                <div key={persona.id} className="max-w-6xl mx-auto grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                    {persona.moments.map((m, i) => {
                        const isFlipped = flipped.has(i);
                        return (
                            <div key={m.title} className="pm-in" style={{ animationDelay: `${i * 90}ms`, ['--pm-rot' as string]: `${((i % 2 === 0 ? -1 : 1) * (0.8 + (i % 3) * 0.35)).toFixed(2)}deg` }}>
                                <Button
                                    variant="bare"
                                    aria-pressed={isFlipped}
                                    aria-label={`${m.title} — ${m.aria}`}
                                    onClick={() => toggleFlip(i)}
                                    className={`pm-card w-full text-left ${isFlipped ? 'is-flipped' : ''}`}
                                >
                                    <span className="pm-face pm-face-front" aria-hidden="true">
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
                                    <span className="pm-face pm-face-back" aria-hidden="true">
                                        <span className="flex flex-1 flex-col items-start justify-center gap-2.5 px-4 py-3">
                                            <FaceTag tone="good">{persona.backTag}</FaceTag>
                                            <svg width="22" height="22" viewBox="0 0 26 26" fill="none" aria-hidden="true" className="flex-shrink-0">
                                                <circle cx="13" cy="13" r="11.5" fill="rgba(110,231,183,0.15)" stroke="rgba(110,231,183,0.75)" strokeWidth="1.5" />
                                                <path d="M7.5 13.5L11 17L18.5 9" stroke="#6EE7B7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                            <span className="text-[12px] sm:text-[13px] font-semibold text-emerald-50 leading-[1.55]">{m.fix}</span>
                                        </span>
                                        <span className="px-4 pb-3">
                                            <span className="block text-[13px] font-bold text-white leading-snug">{m.title}</span>
                                        </span>
                                    </span>
                                </Button>
                            </div>
                        );
                    })}
                </div>

                {/* ── The pivot — the system built for the week you chose. ── */}
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
                                    {Mark ? <Mark className="h-8 w-8" title={persona.pivot.productName} /> : <Logo className="h-8 w-8 text-primary-500" />}
                                    <span className="text-left">
                                        <span className="block text-sm font-extrabold text-white leading-tight">{persona.pivot.productName}</span>
                                        <span className="block text-2xs font-semibold uppercase tracking-[0.14em] text-slate-500">{persona.pivot.productTag}</span>
                                    </span>
                                </span>
                                {persona.id === 'business' ? (
                                    <Button
                                        variant="bare"
                                        onClick={onContactSales}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-semibold text-sm text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 shadow-lg shadow-primary-500/40 hover:shadow-[0_0_40px_-6px_rgba(22,163,74,0.7)] transition-all duration-300 active:scale-[0.98]"
                                    >
                                        Tell us what runs your business today
                                    </Button>
                                ) : (
                                    <a
                                        href={persona.id === 'law' ? '/vega' : '/atrium'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 font-semibold text-sm text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 shadow-lg shadow-primary-500/40 hover:shadow-[0_0_40px_-6px_rgba(22,163,74,0.7)] transition-all duration-300 active:scale-[0.98]"
                                    >
                                        {persona.id === 'law' ? 'See how Vega runs a practice' : 'See how Atrium runs a portfolio'}
                                    </a>
                                )}
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

                /* The flip — today on the front, the answer on the back.
                   The card keeps its desk-spread rotation (var) through the
                   flip by rotating the INNER face container only. */
                .pm-card { perspective: 1100px; display: block; }
                .pm-card .pm-face {
                    display: flex; flex-direction: column;
                    position: relative; width: 100%; aspect-ratio: 3 / 4.35;
                    border-radius: 0.95rem;
                    backface-visibility: hidden; -webkit-backface-visibility: hidden;
                    transition: transform 480ms cubic-bezier(0.22, 1, 0.36, 1), border-color 300ms ease, background-color 300ms ease;
                }
                .pm-face-front {
                    border: 1px solid rgba(255,255,255,0.1);
                    background: rgba(255,255,255,0.03);
                }
                .pm-face-back {
                    position: absolute; inset: 0;
                    border: 1px solid rgba(110,231,183,0.4);
                    background: linear-gradient(160deg, rgba(16,185,129,0.14), rgba(16,185,129,0.05));
                    transform: rotateY(180deg);
                }
                .pm-card.is-flipped .pm-face-front { transform: rotateY(-180deg); }
                .pm-card.is-flipped .pm-face-back { transform: rotateY(0deg); }
                .pm-card:hover .pm-face-front { border-color: rgba(255,255,255,0.22); }
                .pm-card:focus-visible { outline: 2px solid rgba(110,231,183,0.8); outline-offset: 3px; border-radius: 1rem; }

                @media (prefers-reduced-motion: reduce) {
                    .pm-in, .pm-pop, .pm-sink { animation: none; opacity: 1; }
                    .pm-card .pm-face { transition: none; }
                }
            `}</style>
        </section>
    );
};
