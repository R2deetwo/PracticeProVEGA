/**
 * PainMirrorSection (Sound familiar?) — R29: one week, one small business.
 *
 * Owner direction (R29): the R27 workshop "is not very clear — the
 * graphics and the animation" and "the points repeat themselves".
 * Fair on both counts: every scene rendered the SAME grammar (chips →
 * tangled dashed curves → overloaded destination vs. a clean pipeline),
 * at 10px, with abstract labels ("Month-end", "Your head").
 *
 * The rebuild tells ONE story a person on the street already lives:
 * Ada, who runs a small fashion house, and five moments from her week —
 * Monday's buried WhatsApp order, Wednesday's unplaced payment,
 * Thursday's away key-man, Friday's receipt hunt, Sunday's 11pm shift.
 * Five genuinely different pains (capture / money / knowledge / records
 * / the owner's time), each with its OWN illustration grammar — a
 * phone, a bank alert, people, a drawer, a clock — so nothing repeats:
 *
 *   1. The buried order      — phone + message sinking out of the scroll
 *   2. The unplaced payment  — credit alert vs. three maybe-notes
 *   3. The one who knows     — knowledge tethered to one away avatar
 *   4. The receipt hunt      — drawer, drifting papers, sweeping lens
 *   5. The owner's shift     — 11:04pm tasks converging on a tired Ada
 *
 * Each moment plays in two beats (R27 direction, kept): TODAY first,
 * then ON A SYSTEM. Bigger chips, one idea per beat, no bezier
 * spaghetti. Pure CSS/SVG motion; prefers-reduced-motion skips to the
 * improved beat. Until the visitor interacts, the stage slowly cycles
 * through the week so the five moments introduce themselves.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui';
import { useScrollReveal } from '../hooks';

// ── The stage frame ────────────────────────────────────────────────────────
const VB_W = 560;
const VB_H = 340;
const pos = (x: number, y: number): React.CSSProperties => ({
    left: `${(x / VB_W) * 100}%`,
    top: `${(y / VB_H) * 100}%`,
});

type Tone = 'bad' | 'good' | 'dim' | 'tag' | 'paper';

/** A chip on the stage — 11-12px, legible at a glance. */
const Chip: React.FC<{
    x: number;
    y: number;
    tone?: Tone;
    rot?: number;
    delay?: number;
    sink?: boolean;
    className?: string;
    children: React.ReactNode;
}> = ({ x, y, tone = 'dim', rot = 0, delay = 0, sink = false, className = '', children }) => {
    const toneCls =
        tone === 'bad'
            ? 'bg-red-500/20 border-red-400/50 text-red-200'
            : tone === 'good'
                ? 'bg-emerald-400/15 border-emerald-300/45 text-emerald-100'
                : tone === 'tag'
                    ? 'bg-transparent border border-dashed border-red-400/50 text-red-300/80 uppercase tracking-[0.14em]'
                    : tone === 'paper'
                        ? 'bg-[#F5F1E6] border-slate-300/80 text-slate-800 shadow-[0_6px_18px_-8px_rgba(0,0,0,0.6)]'
                        : 'bg-white/[0.05] border-white/15 text-slate-400';
    // Rotation rides a CSS variable so the enter/sink keyframes can carry
    // it (an animation's transform overrides any static transform — the
    // variable keeps the resting state and the animated state identical).
    const style: React.CSSProperties = { ...pos(x, y), animationDelay: `${delay}ms` };
    if (rot) {
        (style as any)['--pm-rot'] = `${rot}deg`;
        style.transform = `translate(-50%, -50%) rotate(${rot}deg)`;
    }
    return (
        <span
            className={`absolute -translate-x-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg border text-[11px] sm:text-xs font-semibold whitespace-nowrap ${toneCls} ${sink ? 'pm-sink' : 'pm-in'} ${className}`}
            style={style}
        >
            {children}
        </span>
    );
};

/** A small round person on the stage (centred on its point). */
const Avatar: React.FC<{ x: number; y: number; initials: string; name?: string; dim?: boolean; delay?: number }> = ({
    x, y, initials, name, dim = false, delay = 0,
}) => (
    <span className="pm-in absolute flex flex-col items-center gap-1.5" style={{ ...pos(x, y), transform: 'translate(-50%, -50%)', animationDelay: `${delay}ms` }}>
        <span
            className={`w-11 h-11 rounded-full border flex items-center justify-center text-[13px] font-bold ${
                dim ? 'bg-white/[0.04] border-white/15 text-slate-500' : 'bg-emerald-400/15 border-emerald-300/50 text-emerald-100'
            }`}
        >
            {initials}
        </span>
        {name && <span className={`text-[11px] font-semibold ${dim ? 'text-slate-500' : 'text-slate-300'}`}>{name}</span>}
    </span>
);

/** A straight (or gently curved) connector in stage coordinates. */
const Link: React.FC<{
    from: [number, number];
    to: [number, number];
    tone?: 'bad' | 'good';
    dashed?: boolean;
    delay?: number;
    bow?: number;
}> = ({ from, to, tone = 'bad', dashed = false, delay = 0, bow = 0 }) => {
    const [x1, y1] = from;
    const [x2, y2] = to;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const nx = -(y2 - y1);
    const ny = x2 - x1;
    const len = Math.hypot(nx, ny) || 1;
    const d = `M ${x1} ${y1} Q ${mx + (bow * nx) / len} ${my + (bow * ny) / len} ${x2} ${y2}`;
    return (
        <path
            d={d}
            stroke={tone === 'bad' ? 'rgba(248,113,113,0.7)' : 'rgba(110,231,183,0.85)'}
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeDasharray={dashed ? '5 6' : undefined}
            className="pm-draw"
            style={{ animationDelay: `${delay}ms` }}
        />
    );
};

/** The terminal check — the "solved" beat's full stop. */
const Check: React.FC<{ x: number; y: number; delay?: number }> = ({ x, y, delay = 0 }) => (
    <svg
        className="pm-pop absolute -translate-x-1/2 -translate-y-1/2"
        style={{ ...pos(x, y), animationDelay: `${delay}ms` }}
        width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true"
    >
        <circle cx="13" cy="13" r="11.5" fill="rgba(110,231,183,0.15)" stroke="rgba(110,231,183,0.75)" strokeWidth="1.5" />
        <path d="M7.5 13.5L11 17L18.5 9" stroke="#6EE7B7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/** The stage's SVG layer (connectors) + its paper-grid ground. */
const StageSvg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${VB_W} ${VB_H}`} fill="none" aria-hidden="true">
        {children}
    </svg>
);

// ── The five moments — Ada's week ──────────────────────────────────────────
// Beat 1 art = today (red register); beat 2 art = on a system (emerald).

/** 1 · MONDAY 9:41 AM — the order sinking below the WhatsApp scroll. */
const ArtBuriedToday: React.FC = () => (
    <>
        <StageSvg>
            <Link from={[150, 205]} to={[294, 228]} tone="bad" dashed delay={250} />
        </StageSvg>
        {/* the phone */}
        <div className="pm-in absolute rounded-[1.3rem] border-2 border-white/25 bg-white/[0.04] overflow-hidden"
            style={{ ...pos(355, 168), width: '21%', aspectRatio: '9 / 16', transform: 'translate(-50%, -50%)', animationDelay: '60ms' }}>
            <div className="h-[14%] border-b border-white/10 flex items-center justify-center">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.18em]">WhatsApp · 312</span>
            </div>
            <div className="p-2 flex flex-col gap-1.5">
                <span className="h-1.5 w-4/5 rounded bg-white/10" />
                <span className="h-1.5 w-3/5 rounded bg-white/10" />
                <span className="h-1.5 w-11/12 rounded bg-white/10" />
                <span className="h-1.5 w-2/3 rounded bg-white/10" />
                <span className="h-1.5 w-5/6 rounded bg-white/10" />
            </div>
        </div>
        {/* the order, sinking out of the phone */}
        <Chip x={355} y={288} tone="paper" rot={-5} delay={450} sink className="!text-slate-800">
            2 outfits · measurements attached
        </Chip>
        <Chip x={140} y={130} tone="dim" delay={0}>Monday · 9:41 am</Chip>
        <Chip x={140} y={205} tone="dim" delay={120}>customer sends her order</Chip>
        <Chip x={140} y={305} tone="tag" delay={700}>buried — never seen again</Chip>
    </>
);

/** 1 · ON A SYSTEM — the same order, landed in the queue. */
const ArtBuriedSystem: React.FC = () => (
    <>
        <StageSvg>
            <Link from={[185, 105]} to={[268, 140]} tone="good" delay={260} />
        </StageSvg>
        <Chip x={105} y={50} tone="dim" delay={0}>9:41 am — the same message</Chip>
        <Chip x={110} y={105} tone="good" delay={120}>2 outfits · measurements attached</Chip>
        {/* the queue card */}
        <div className="pm-in absolute rounded-xl border border-emerald-300/40 bg-emerald-400/10 overflow-hidden"
            style={{ ...pos(390, 165), width: '46%', transform: 'translate(-50%, -50%)', animationDelay: '380ms' }}>
            <p className="px-3 pt-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300/90 border-b border-emerald-300/20">The queue</p>
            <div className="px-3 py-2.5 flex flex-col gap-2">
                <p className="text-[11px] sm:text-xs text-slate-200 font-semibold flex items-center gap-2">
                    <CheckInline /> #204 · Chioma · 2 gowns · due Fri
                </p>
                <p className="text-[11px] sm:text-xs text-slate-200 font-semibold flex items-center gap-2">
                    <CheckInline /> #205 · Tunde · 1 suit · due Mon
                </p>
            </div>
        </div>
        <Chip x={390} y={285} tone="good" delay={650}>customer · item · price · due date</Chip>
        <Check x={510} y={110} delay={800} />
    </>
);

const CheckInline: React.FC = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0" aria-hidden="true">
        <circle cx="7" cy="7" r="6.3" fill="rgba(110,231,183,0.15)" stroke="rgba(110,231,183,0.7)" strokeWidth="1" />
        <path d="M4.2 7.2L6 9L9.8 5" stroke="#6EE7B7" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/** 2 · WEDNESDAY 4:15 PM — one credit alert, three maybes. */
const ArtPaymentToday: React.FC = () => (
    <>
        <StageSvg>
            <Link from={[234, 108]} to={[330, 60]} tone="bad" dashed delay={350} />
            <Link from={[238, 140]} to={[345, 152]} tone="bad" dashed delay={430} />
            <Link from={[230, 172]} to={[325, 260]} tone="bad" dashed delay={510} />
        </StageSvg>
        {/* the credit alert */}
        <div className="pm-in absolute rounded-xl border border-slate-300/80 bg-[#F5F1E6] text-slate-800 shadow-[0_10px_26px_-10px_rgba(0,0,0,0.7)] overflow-hidden"
            style={{ ...pos(140, 140), width: '33%', transform: 'translate(-50%, -50%)', animationDelay: '60ms' }}>
            <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Credit alert</p>
            <p className="px-3 pb-2.5 text-base font-extrabold">₦120,000</p>
            <p className="px-3 pb-2.5 pt-0.5 text-[10px] font-semibold text-slate-500">Wed · 4:15 pm</p>
        </div>
        <Chip x={420} y={55} tone="paper" rot={-4} delay={620}>Bola — invoice #118 ?</Chip>
        <Chip x={440} y={155} tone="paper" rot={3} delay={700}>Tunde — fabric money ?</Chip>
        <Chip x={410} y={265} tone="paper" rot={-3} delay={780}>the paper list — two answers</Chip>
        <Chip x={140} y={255} tone="dim" delay={200}>who paid — for what?</Chip>
        <Chip x={140} y={305} tone="tag" delay={900}>so Ada guesses</Chip>
    </>
);

/** 2 · ON A SYSTEM — the alert matches itself. */
const ArtPaymentSystem: React.FC = () => (
    <>
        <StageSvg>
            <Link from={[205, 140]} to={[290, 140]} tone="good" delay={300} />
        </StageSvg>
        <div className="pm-in absolute rounded-xl border border-slate-300/80 bg-[#F5F1E6] text-slate-800 shadow-[0_10px_26px_-10px_rgba(0,0,0,0.7)] overflow-hidden"
            style={{ ...pos(140, 140), width: '33%', transform: 'translate(-50%, -50%)', animationDelay: '60ms' }}>
            <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Credit alert</p>
            <p className="px-3 pb-2.5 text-base font-extrabold">₦120,000</p>
            <p className="px-3 pb-2.5 pt-0.5 text-[10px] font-semibold text-slate-500">Wed · 4:15 pm</p>
        </div>
        <div className="pm-in absolute rounded-xl border border-emerald-300/40 bg-emerald-400/10 overflow-hidden"
            style={{ ...pos(405, 150), width: '46%', transform: 'translate(-50%, -50%)', animationDelay: '420ms' }}>
            <p className="px-3 pt-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300/90 border-b border-emerald-300/20">Matched — as it lands</p>
            <div className="px-3 py-2.5 flex flex-col gap-1.5">
                <p className="text-[11px] sm:text-xs text-slate-200 font-semibold flex items-center gap-2"><CheckInline /> Bola · Invoice #118</p>
                <p className="text-[11px] sm:text-xs text-emerald-100 font-bold flex items-center gap-2"><CheckInline /> ₦120,000 — PAID</p>
            </div>
        </div>
        <Chip x={405} y={265} tone="good" delay={700}>balances &amp; debtors — always current</Chip>
        <Check x={525} y={95} delay={850} />
    </>
);

/** 3 · THURSDAY 8:00 AM — the knowledge that left with one man. */
const ArtKeymanToday: React.FC = () => (
    <>
        <StageSvg>
            {/* knowledge tethered to Sunday */}
            <Link from={[205, 95]} to={[262, 138]} tone="bad" delay={300} />
            <Link from={[400, 90]} to={[300, 135]} tone="bad" delay={360} />
            <Link from={[400, 215]} to={[302, 185]} tone="bad" delay={420} />
            {/* the others — can't reach */}
            <Link from={[128, 205]} to={[210, 170]} tone="bad" dashed delay={620} />
            <Link from={[432, 230]} to={[360, 195]} tone="bad" dashed delay={680} />
        </StageSvg>
        <Chip x={165} y={80} tone="bad" rot={-3} delay={80}>pricing</Chip>
        <Chip x={425} y={75} tone="bad" rot={2} delay={140}>which tailor takes what</Chip>
        <Chip x={430} y={222} tone="bad" rot={-2} delay={200}>rush-work rules</Chip>
        <Avatar x={282} y={160} initials="S" name="Sunday" delay={0} />
        <Chip x={282} y={228} tone="tag" delay={520}>away — till Monday</Chip>
        <Avatar x={95} y={225} initials="A" name="Ada" dim delay={560} />
        <Avatar x={490} y={262} initials="B" name="Bisi" dim delay={600} />
        <Chip x={282} y={305} tone="tag" delay={900}>today, everyone guesses</Chip>
    </>
);

/** 3 · ON A SYSTEM — the process on a page anyone can read. */
const ArtKeymanSystem: React.FC = () => (
    <>
        <StageSvg>
            <Link from={[110, 215]} to={[225, 175]} tone="good" delay={420} />
            <Link from={[282, 225]} to={[282, 195]} tone="good" delay={480} />
            <Link from={[455, 220]} to={[340, 175]} tone="good" delay={540} />
        </StageSvg>
        <div className="pm-in absolute rounded-xl border border-emerald-300/40 bg-emerald-400/10 overflow-hidden"
            style={{ ...pos(282, 140), width: '44%', transform: 'translate(-50%, -50%)', animationDelay: '120ms' }}>
            <p className="px-3 pt-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300/90 border-b border-emerald-300/20">How the shop runs</p>
            <div className="px-3 py-2.5 flex flex-col gap-1.5">
                <p className="text-[11px] sm:text-xs text-slate-200 font-semibold flex items-center gap-2"><CheckInline /> pricing</p>
                <p className="text-[11px] sm:text-xs text-slate-200 font-semibold flex items-center gap-2"><CheckInline /> steps, in order</p>
                <p className="text-[11px] sm:text-xs text-slate-200 font-semibold flex items-center gap-2"><CheckInline /> who does what</p>
            </div>
        </div>
        <Avatar x={95} y={255} initials="A" name="Ada" delay={520} />
        <Avatar x={282} y={272} initials="S" name="Sunday" delay={560} />
        <Avatar x={468} y={255} initials="B" name="Bisi" delay={600} />
        <Chip x={282} y={320} tone="good" delay={780}>anyone can run the day</Chip>
    </>
);

/** 4 · FRIDAY 6:30 PM — the receipt that cannot be found. */
const ArtReceiptToday: React.FC = () => (
    <>
        <StageSvg>
            <Link from={[240, 150]} to={[330, 80]} tone="bad" dashed delay={480} />
            <Link from={[245, 190]} to={[340, 195]} tone="bad" dashed delay={560} />
        </StageSvg>
        {/* the drawer */}
        <div className="pm-in absolute rounded-lg border-2 border-white/20 bg-white/[0.05] overflow-visible"
            style={{ ...pos(165, 175), width: '27%', height: '38%', transform: 'translate(-50%, -50%)', animationDelay: '60ms' }}>
            <p className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-[#0A101C] border border-white/20 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Receipts</p>
            <span className="absolute -top-2 left-[16%] w-[22%] h-4 rounded-sm bg-[#F5F1E6]/80 rotate-[-8deg]" />
            <span className="absolute -top-2.5 left-[46%] w-[22%] h-4 rounded-sm bg-[#F5F1E6]/70 rotate-[6deg]" />
            <span className="absolute -top-1.5 left-[72%] w-[18%] h-4 rounded-sm bg-[#F5F1E6]/60 rotate-[-4deg]" />
        </div>
        <Chip x={425} y={80} tone="paper" rot={-5} delay={700}>receipt · March?</Chip>
        <Chip x={440} y={195} tone="paper" rot={4} delay={780}>receipt · in a bag?</Chip>
        {/* the sweeping lens */}
        <svg className="pm-sweep absolute" style={{ ...pos(320, 275), transform: 'translate(-50%, -50%)', animationDelay: '350ms' }} width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
            <circle cx="14" cy="14" r="9.5" stroke="rgba(248,113,113,0.75)" strokeWidth="2" />
            <path d="M21 21 L30 30" stroke="rgba(248,113,113,0.75)" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        <Chip x={140} y={300} tone="dim" delay={250}>generator repair — under warranty?</Chip>
        <Chip x={400} y={300} tone="tag" delay={950}>paid full price. again.</Chip>
    </>
);

/** 4 · ON A SYSTEM — search 'generator', found. */
const ArtReceiptSystem: React.FC = () => (
    <>
        <StageSvg>
            <Link from={[282, 100]} to={[282, 145]} tone="good" delay={380} />
        </StageSvg>
        {/* the search bar */}
        <div className="pm-in absolute -translate-x-1/2 -translate-y-1/2 flex items-center gap-2.5 rounded-full border border-emerald-300/40 bg-emerald-400/10 px-4 py-2.5"
            style={{ ...pos(282, 62), animationDelay: '60ms' }}>
            <svg width="15" height="15" viewBox="0 0 34 34" fill="none" aria-hidden="true">
                <circle cx="14" cy="14" r="9.5" stroke="rgba(110,231,183,0.9)" strokeWidth="2.4" />
                <path d="M21 21 L30 30" stroke="rgba(110,231,183,0.9)" strokeWidth="2.8" strokeLinecap="round" />
            </svg>
            <span className="text-[11px] sm:text-xs font-semibold text-slate-200">generator</span>
        </div>
        <div className="pm-in absolute rounded-xl border border-slate-300/80 bg-[#F5F1E6] text-slate-800 shadow-[0_10px_26px_-10px_rgba(0,0,0,0.7)] overflow-hidden"
            style={{ ...pos(282, 205), width: '52%', transform: 'translate(-50%, -50%)', animationDelay: '480ms' }}>
            <p className="px-3.5 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Receipt · Generator repair</p>
            <p className="px-3.5 pb-1 text-[11px] sm:text-xs font-bold">12 Jan · Warranty: 1 year</p>
            <p className="px-3.5 pb-2.5 text-[10px] font-semibold text-slate-500">filed the day it arrived</p>
        </div>
        <Check x={452} y={150} delay={800} />
        <Chip x={282} y={295} tone="good" delay={820}>found — in seconds</Chip>
    </>
);

/** 5 · SUNDAY 11:04 PM — the business runs on Ada's eyes. */
const ArtOwnerToday: React.FC = () => (
    <>
        <StageSvg>
            <Link from={[125, 95]} to={[245, 150]} tone="bad" dashed delay={520} />
            <Link from={[440, 95]} to={[320, 150]} tone="bad" dashed delay={580} />
            <Link from={[130, 240]} to={[248, 180]} tone="bad" dashed delay={640} />
        </StageSvg>
        {/* the moon + hour */}
        <svg className="pm-in absolute -translate-x-1/2 -translate-y-1/2" style={{ ...pos(282, 52), animationDelay: '0ms' }} width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" fill="rgba(248,113,113,0.35)" stroke="rgba(248,113,113,0.8)" strokeWidth="1.4" />
        </svg>
        <Chip x={282} y={95} tone="dim" delay={80}>Sunday · 11:04 pm</Chip>
        <Chip x={120} y={90} tone="bad" rot={-4} delay={300}>new order — her personal line</Chip>
        <Chip x={445} y={90} tone="bad" rot={3} delay={380}>remind Bola — she meant to</Chip>
        <Chip x={115} y={245} tone="bad" rot={-2} delay={460}>stock count — in her head</Chip>
        <Avatar x={282} y={172} initials="A" name="Ada" dim delay={180} />
        <Chip x={282} y={240} tone="tag" delay={700}>battery at 8%</Chip>
        <Chip x={282} y={300} tone="tag" delay={900}>open whenever her eyes are</Chip>
    </>
);

/** 5 · ON A SYSTEM — the routine leaves with the machine. */
const ArtOwnerSystem: React.FC = () => (
    <>
        <StageSvg>
            <Link from={[150, 70]} to={[215, 115]} tone="good" delay={520} />
            <Link from={[150, 145]} to={[212, 145]} tone="good" delay={580} />
            <Link from={[150, 220]} to={[215, 175]} tone="good" delay={640} />
            <Link from={[350, 145]} to={[395, 145]} tone="good" delay={760} />
        </StageSvg>
        <Chip x={98} y={70} tone="good" delay={80}>new order</Chip>
        <Chip x={98} y={145} tone="good" delay={140}>reminders</Chip>
        <Chip x={98} y={220} tone="good" delay={200}>stock count</Chip>
        {/* the system box */}
        <div className="pm-in absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border border-emerald-300/45 bg-emerald-400/10 px-5 py-3.5 flex flex-col items-center gap-1"
            style={{ ...pos(282, 145), animationDelay: '360ms' }}>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300/90">the system</span>
            <span className="text-[11px] sm:text-xs text-slate-300 font-semibold">runs the routine</span>
        </div>
        <div className="pm-in absolute rounded-xl border border-emerald-300/40 bg-emerald-400/10 overflow-hidden"
            style={{ ...pos(462, 150), width: '29%', transform: 'translate(-50%, -50%)', animationDelay: '700ms' }}>
            <div className="px-3 py-2.5 flex flex-col gap-1.5">
                <p className="text-[11px] sm:text-xs text-slate-200 font-semibold flex items-center gap-2"><CheckInline /> orders queued</p>
                <p className="text-[11px] sm:text-xs text-slate-200 font-semibold flex items-center gap-2"><CheckInline /> reminders sent</p>
                <p className="text-[11px] sm:text-xs text-slate-200 font-semibold flex items-center gap-2"><CheckInline /> report ready</p>
            </div>
        </div>
        <Avatar x={462} y={262} initials="A" name="Ada" delay={860} />
        <Chip x={462} y={318} tone="good" delay={920}>the evening — hers again</Chip>
    </>
);

// ── The week ───────────────────────────────────────────────────────────────
const PAIN_MIRROR = [
    {
        when: 'Monday · 9:41 am',
        title: 'The order that got buried',
        today: 'A customer sends her measurements for two outfits on WhatsApp. Ada replies \u2018Noted\u2019 — and the order disappears under three hundred more messages.',
        system: 'The order lands in a queue the moment it arrives — customer, item, price, due date. Nothing important lives in a chat scroll.',
        TodayArt: ArtBuriedToday,
        SystemArt: ArtBuriedSystem,
        aria: 'An order message sinks below a WhatsApp inbox and is lost. On a system, the same message lands in a queue with a number, a customer and a due date.',
    },
    {
        when: 'Wednesday · 4:15 pm',
        title: 'The payment you can\u2019t place',
        today: '₦120,000 lands in the account. Bola\u2019s invoice, or Tunde\u2019s fabric money? The paper list says two different things — so Ada guesses.',
        system: 'Every payment is matched to its customer and invoice the moment it lands. Balances and debtors are always current.',
        TodayArt: ArtPaymentToday,
        SystemArt: ArtPaymentSystem,
        aria: 'A credit alert of one hundred and twenty thousand naira connects by dashed lines to three uncertain notes. On a system, the alert matches itself to Bola and invoice 118, marked paid.',
    },
    {
        when: 'Thursday · 8:00 am',
        title: 'The one who knows is away',
        today: 'Only Ada\u2019s shop assistant knows which tailor takes which job, what rush work costs, which client waits. He is away till Monday — today, everyone guesses.',
        system: 'The process — pricing, steps, who does what — lives in the system, not in one person\u2019s head. Anyone can run the day.',
        TodayArt: ArtKeymanToday,
        SystemArt: ArtKeymanSystem,
        aria: 'Pricing, tailor assignments and rush rules tether to Sunday, who is away; Ada and Bisi cannot reach them. On a system, the process sits on a card all three can read.',
    },
    {
        when: 'Friday · 6:30 pm',
        title: 'The receipt hunt',
        today: 'The generator repair should be under warranty. The receipt is in a drawer, a bag, or a WhatsApp photo from March — so Ada pays full price, again.',
        system: 'Every document is filed the day it arrives. Search \u2018generator\u2019 — there it is, with the date and the terms, in seconds.',
        TodayArt: ArtReceiptToday,
        SystemArt: ArtReceiptSystem,
        aria: 'A lens sweeps over a drawer of receipts while two more drift away. On a system, searching generator surfaces the receipt with its date and warranty terms.',
    },
    {
        when: 'Sunday · 11:04 pm',
        title: 'The owner\u2019s shift',
        today: 'Orders arrive on Ada\u2019s personal line at 11 pm, next to the reminders she meant to send and the numbers she keeps in her head. The business is open whenever her eyes are.',
        system: 'Orders land in the queue, reminders go out on schedule, reports are one tap away. The business keeps running — and Ada gets her evening back.',
        TodayArt: ArtOwnerToday,
        SystemArt: ArtOwnerSystem,
        aria: 'At 11:04 pm, orders, reminders and stock counts converge on a tired Ada. On a system, the routine flows through the system box and the evening is hers again.',
    },
];

// ── The section ────────────────────────────────────────────────────────────
export const PainMirrorSection: React.FC<{ onContactSales: () => void }> = ({ onContactSales }) => {
    const ref = useScrollReveal<HTMLDivElement>();
    const rowsRef = useScrollReveal<HTMLDivElement>();
    const closeRef = useScrollReveal<HTMLDivElement>();
    const sectionRef = useRef<HTMLElement>(null);

    const [active, setActive] = useState(0);
    const [beat, setBeat] = useState<'today' | 'system'>('today');
    const [userTookOver, setUserTookOver] = useState(false);
    // The cycle's kill-switch is a REF, not just state: a visitor's hover
    // must stop the very next interval tick SYNCHRONOUSLY. State alone
    // left one tick of runway — the tick could fire between the hover's
    // setActive and the effect cleanup, hijacking the scene to a
    // neighbour moment (observed live: hover Friday, stage shows Sunday).
    const userTookRef = useRef(false);
    const timers = useRef<number[]>([]);
    const reduced = useRef(
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    );

    // The beat machine (R27 direction, kept): selecting a moment plays
    // today first, then the same moment on a system. The today beat gets
    // 2.6s — its staggered entrances (up to ~0.9s delays + 0.5s each) need
    // time to FULLY populate before the story turns (R29: at 1.7s the
    // "today" picture barely existed complete before the swap).
    // Reduced-motion visitors get the improved beat immediately.
    useEffect(() => {
        timers.current.forEach(clearTimeout);
        timers.current = [];
        if (reduced.current) {
            setBeat('system');
            return;
        }
        setBeat('today');
        timers.current.push(window.setTimeout(() => setBeat('system'), 2600));
        return () => timers.current.forEach(clearTimeout);
    }, [active]);

    // Until the visitor chooses a moment themselves, the week slowly
    // cycles on the stage — so all five DIFFERENT moments introduce
    // themselves (the R29 fix for "the points repeat themselves" is
    // variety; this makes sure it gets seen). Stops the moment the
    // visitor hovers, focuses or taps a row.
    useEffect(() => {
        if (userTookOver || reduced.current) return;
        const root = sectionRef.current;
        if (!root || !('IntersectionObserver' in window)) return;
        let visible = false;
        let cycle: number | undefined;
        const io = new IntersectionObserver((entries) => {
            for (const en of entries) {
                visible = en.isIntersecting;
                if (visible && cycle === undefined) {
                    cycle = window.setInterval(() => {
                        if (userTookRef.current) return; // hover/tap owns the stage now
                        setActive((a) => (a + 1) % PAIN_MIRROR.length);
                    }, 6200);
                } else if (!visible && cycle !== undefined) {
                    clearInterval(cycle);
                    cycle = undefined;
                }
            }
        }, { threshold: 0.35 });
        io.observe(root);
        return () => {
            io.disconnect();
            if (cycle !== undefined) clearInterval(cycle);
        };
    }, [userTookOver]);

    const scene = PAIN_MIRROR[active];
    const selectScene = (i: number) => {
        userTookRef.current = true; // synchronous — no tick can race this
        setUserTookOver(true);
        if (i !== active) setActive(i);
    };

    const rowCls = (i: number) =>
        `group/row w-full text-left rounded-xl border px-4 py-3.5 transition-all duration-300 ${
            i === active
                ? 'border-emerald-500/40 bg-emerald-400/10'
                : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.16] hover:bg-white/[0.045]'
        }`;

    const Art = beat === 'today' ? scene.TodayArt : scene.SystemArt;

    return (
        <section ref={sectionRef} className="relative py-16 sm:py-24 overflow-hidden" style={{ background: '#0A101C' }}>
            {/* the same ink stage as the hero, carried through the marquee */}
            <div className="absolute -top-32 right-1/4 w-[34rem] h-[24rem] rounded-full bg-emerald-500/[0.07] blur-[130px] pointer-events-none" aria-hidden="true" />
            <div className="absolute -bottom-40 left-1/4 w-[36rem] h-[24rem] rounded-full bg-emerald-600/[0.08] blur-[130px] pointer-events-none" aria-hidden="true" />
            <div className="absolute inset-0 w7-grain pointer-events-none" aria-hidden="true" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
                <div ref={ref} className="w9-reveal text-center mb-10 md:mb-14 max-w-3xl mx-auto">
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
                        <span className="text-slate-200">One small business, one week — five moments every owner knows. Watch each one twice: as it runs today, and on a system.</span>
                    </p>
                </div>

                {/* The week: selectable moments left, the stage right. Below
                    lg the stage sits above the list (tap a moment, the stage
                    above animates). */}
                <div ref={rowsRef} className="w9-reveal-stagger max-w-6xl mx-auto grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 lg:gap-10 items-start">
                    {/* ── The stage ─────────────────────────────────────── */}
                    <div className="order-first lg:order-last lg:sticky lg:top-24">
                        <div
                            className="relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden"
                            role="img"
                            aria-label={`${scene.title} — ${scene.aria}`}
                        >
                            {/* Beat caption — swaps with the beat */}
                            <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                                <span
                                    key={`t-${active}-${beat}`}
                                    className={`text-2xs font-bold uppercase tracking-[0.22em] transition-colors duration-500 ${
                                        beat === 'today' ? 'text-red-300/90' : 'text-emerald-300/90'
                                    }`}
                                >
                                    {beat === 'today' ? `Today — ${scene.when}` : 'On a system'}
                                </span>
                                <span className="font-mono text-2xs tracking-widest text-slate-500">
                                    {String(active + 1).padStart(2, '0')} / {String(PAIN_MIRROR.length).padStart(2, '0')}
                                </span>
                            </div>

                            {/* The stage surface — one shared 560x340 frame */}
                            <div className="relative w-full" style={{ aspectRatio: `${VB_W} / ${VB_H}` }}>
                                {/* faint grid — the workshop paper */}
                                <div
                                    className="absolute inset-0"
                                    aria-hidden="true"
                                    style={{
                                        backgroundImage:
                                            'linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)',
                                        backgroundSize: '56px 52px',
                                    }}
                                />
                                {/* The beat's tone — a faint wash that makes the
                                    state legible at a glance, before any art is
                                    read: red for today, emerald for the system. */}
                                <div
                                    aria-hidden="true"
                                    className={`absolute inset-0 transition-colors duration-700 ${
                                        beat === 'today' ? 'bg-red-500/[0.07]' : 'bg-emerald-400/[0.06]'
                                    }`}
                                />
                                {/* The moment's art — remounts per scene+beat so
                                    its motion replays from the top. */}
                                <div key={`${active}-${beat}`} className="absolute inset-0">
                                    <Art />
                                </div>
                            </div>

                            {/* The caption — the moment's own sentence. */}
                            <p className="px-4 py-3 border-t border-white/[0.07] text-sm leading-[1.7] text-slate-300/95">
                                <span className={`font-bold ${beat === 'today' ? 'text-red-300/90' : 'text-emerald-300'}`}>
                                    {beat === 'today' ? 'Today: ' : 'On a system: '}
                                </span>
                                {beat === 'today' ? scene.today : scene.system}
                            </p>
                        </div>
                    </div>

                    {/* ── The week's moments — hover/tap selects ─────────── */}
                    <div className="flex flex-col gap-2.5" role="listbox" aria-label="One week, five moments — select one to watch it play out">
                        {PAIN_MIRROR.map((row, i) => (
                            <Button
                                key={i}
                                variant="bare"
                                role="option"
                                aria-selected={i === active}
                                onMouseEnter={() => selectScene(i)}
                                onFocus={() => selectScene(i)}
                                onClick={() => selectScene(i)}
                                className={rowCls(i)}
                            >
                                <span className="flex items-start gap-3">
                                    <span
                                        aria-hidden="true"
                                        className={`mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                                            i === active ? 'bg-emerald-400 scale-125' : 'bg-slate-600'
                                        }`}
                                    />
                                    <span className="min-w-0">
                                        <span className={`block text-2xs font-bold uppercase tracking-[0.18em] transition-colors duration-300 ${i === active ? 'text-emerald-300/90' : 'text-slate-500'}`}>
                                            {row.when}
                                        </span>
                                        <span className={`block text-sm font-bold mt-0.5 transition-colors duration-300 ${i === active ? 'text-white' : 'text-slate-300'}`}>
                                            {row.title}
                                        </span>
                                        <span className={`block text-sm leading-[1.65] mt-1 transition-colors duration-300 ${i === active ? 'text-slate-300' : 'text-slate-500'}`}>
                                            {row.today}
                                        </span>
                                        <span className={`block text-xs leading-[1.6] mt-1 transition-all duration-300 ${i === active ? 'text-emerald-300/90' : 'text-slate-600'}`}>
                                            → {row.system}
                                        </span>
                                    </span>
                                </span>
                            </Button>
                        ))}
                    </div>
                </div>

                <div ref={closeRef} className="w9-reveal text-center mt-12 md:mt-14 max-w-2xl mx-auto">
                    <p className="text-lg text-slate-300/95 leading-[1.75]">
                        If any of that is your business, you don&rsquo;t need more discipline or a
                        better spreadsheet. <span className="text-white font-semibold">You need a system</span> —
                        and building it is exactly what we do.
                    </p>
                    <div className="mt-7">
                        <Button
                            variant="bare"
                            onClick={onContactSales}
                            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl font-semibold text-sm text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 shadow-lg shadow-primary-500/40 hover:shadow-[0_0_40px_-6px_rgba(22,163,74,0.7)] transition-all duration-300 active:scale-[0.97]"
                        >
                            Tell us what runs your business today
                        </Button>
                    </div>
                </div>
            </div>

            <style>{`
                /* The stage's motion vocabulary — in, draw, pop, sink, sweep.
                   Rotation rides --pm-rot so animated and resting transforms
                   stay identical (an animation overrides static transforms). */
                @keyframes pm-in-on {
                    from { opacity: 0; transform: translate(-50%, -50%) rotate(var(--pm-rot, 0deg)) translateY(10px); }
                    to { opacity: 1; transform: translate(-50%, -50%) rotate(var(--pm-rot, 0deg)); }
                }
                .pm-in { opacity: 0; animation: pm-in-on 500ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
                @keyframes pm-draw-on {
                    from { stroke-dashoffset: 300; opacity: 0.2; }
                    to { stroke-dashoffset: 0; opacity: 1; }
                }
                .pm-draw {
                    stroke-dashoffset: 300;
                    opacity: 0.2;
                    animation: pm-draw-on 650ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
                }
                @keyframes pm-pop-on {
                    from { opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
                    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
                }
                .pm-pop { opacity: 0; animation: pm-pop-on 380ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
                /* the buried order — sinks below the scroll and fades */
                @keyframes pm-sink-on {
                    0% { opacity: 1; transform: translate(-50%, -50%) rotate(var(--pm-rot, 0deg)); }
                    55% { opacity: 0.95; }
                    100% { opacity: 0.25; transform: translate(-50%, -50%) rotate(var(--pm-rot, 0deg)) translateY(26px); }
                }
                .pm-sink { animation: pm-sink-on 1500ms 300ms cubic-bezier(0.45, 0, 0.75, 0.35) both; }
                /* the receipt hunt — the lens sweeps back and forth */
                @keyframes pm-sweep-on {
                    0% { transform: translate(-50%, -50%) translateX(-46px); }
                    50% { transform: translate(-50%, -50%) translateX(46px); }
                    100% { transform: translate(-50%, -50%) translateX(-46px); }
                }
                .pm-sweep { animation: pm-sweep-on 2600ms 500ms ease-in-out both infinite; }
                @media (prefers-reduced-motion: reduce) {
                    .pm-in, .pm-draw, .pm-pop, .pm-sink, .pm-sweep {
                        animation: none;
                        opacity: 1;
                        stroke-dashoffset: 0;
                    }
                }
            `}</style>
        </section>
    );
};

