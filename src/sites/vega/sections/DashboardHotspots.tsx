import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../components/ui';
import { Z_CLASS } from '../../../overlays/constants';
import { CollabPresence } from './CollabPresence';
import {
    CalendarIcon, CheckIcon, CheckCircleIcon, ChevronDownIcon, CogIcon,
    LockClosedIcon, LogoutIcon, PlusIcon, SendIcon, SparklesIcon, UserIcon,
} from '../../../constants';

/**
 * DashboardHotspots — R74/R78 reworked into R80: THE INTERACTIVE PREVIEW.
 *
 * Owner direction (2026-11-22, verbatim shape): "the user could hover
 * over areas and those areas would be highlighted… or they would be the
 * normal color and the rest would be grayed out… I expected, say for
 * instance, you hover over the monikers, then the monikers look just like
 * this, the way they look now. And the same goes for every other
 * section… it would make sense if there were floating explanations rather
 * than what's at the bottom… The calendar should be flippable… take this
 * and put it inside the See All space… it could be larger and the user
 * can hover over things and get info on them."
 *
 * OWNER DIRECTION (2026-11-22, this round):
 *   • VISIBLE AT REST — "do NOT hide interactive hotspot/badge elements
 *     until the mouse hovers over them." The teammate monikers are
 *     ALWAYS visible (the R80 hide-at-rest model is retired; CollabPresence
 *     keeps reporting hover so the spotlight still fires), and every zone
 *     carries a soft DASHED INDIGO outline at rest that sharpens to the
 *     solid ring + wash on hover/focus.
 *   • THE SPOTLIGHT KEEPS ITS MODEL — hovering/focusing a zone keeps the
 *     hovered element lit inside its ring while the dim veil darkens the
 *     rest of the capture, and the floating hint explains the feature.
 *   • PER-DATE CALENDAR — "make dates interactive so clicking a date
 *     flips/toggles it to reveal that date's schedule/event info." Every
 *     November date is its own button overlaid on the capture's month
 *     grid; clicking one flips the card to THAT date's day view (the
 *     R80 single fixed-day flip is retired). The marked dates (2, 6, 11,
 *     14) carry the firm's real diary; the rest open an honest clear day.
 *
 * THE R80 MODEL (kept):
 *   • The preview lives ONLY in the AppShotLightbox's Dashboard exhibit
 *     (the owner moved it off the hero card into See All).
 *   • CLICK still answers on the real furniture: the workspace chip opens
 *     the multi-workspace switcher, the profile opens the user menu, the
 *     Aloa orb opens the mini exchange — and the CALENDAR DATES flip the
 *     card to their day view.
 *
 * GEOMETRY FIX (the R78 inversion): zones are sized in cqw inside the
 * capture frame's container-type: inline-size wrapper (frame = 100cqw ×
 * 62.5cqw at the capture's fixed 8:5 aspect). R78 converted % of image
 * HEIGHT to cqw by multiplying by 1.6 — the inverse of the correct
 * factor (÷1.6, i.e. ×0.625): the old zones rendered ~2.6× too low and
 * too tall, clipped off-frame (verified live: "Recent Matters" landed at
 * y=93% of the frame, 799px past its card). Every rect below is
 * re-measured (VLM, 2026-11-22) and converted correctly: %height × 0.625
 * → cqw; %width → cqw directly.
 *
 * Presentational chrome only; every clickable element is ui/Button
 * (ADR-0004). All state is local demo state — nothing leaves the browser.
 */

type MenuHotspot = 'workspace' | 'profile' | 'aloa' | null;

/** The hover-zone ids. `presence` is owned by CollabPresence's own
 *  trigger (it reports hover up via onHoverChange). */
type ZoneId = 'workspace' | 'profile' | 'presence' | 'aloa' | 'nav' | 'stats' | 'recent' | 'tasks' | 'calendar';

/** One hoverable zone: geometry in cqw (frame 100 × 62.5), the floating
 *  hint copy, and where the hint note floats (below the zone unless it
 *  sits low in the frame). */
interface ZoneDef {
    id: ZoneId;
    label: string;
    desc: string;
    top: number;
    left: number;
    width: number;
    height: number;
    /** Round the ring like the pixels it frames. */
    shape?: 'lg' | 'full';
    /** Show the hint above the zone (for zones low in the frame). */
    hintAbove?: boolean;
}

// VLM-measured on dashboard.jpg (2880×1800), 2026-11-22:
//   workspace chip x 1.1–16.6%w, y 1.4–7.4%h
//   profile block x 91.5–99%w (right of the presence gap)
//   presence gap x 85.9–91.5%w (CollabPresence owns the trigger)
//   Aloa FAB x 93.5–98.7%w, y 89.7–95.8%h
//   nav rail x 1.0–16.6%w, y 8.5–79%h
//   stat card row (Active Matters · Overdue Tasks · Outstanding
//     Invoices) x 20.2–97.7%w, y 23.5–36.9%h
//   content cards (Recent Matters x 19.9–44.8 · Firm Tasks x 46.5–71.2 ·
//     calendar x 73.0–97.8) all y 38–91%h
const ZONES: ZoneDef[] = [
    { id: 'workspace', label: 'Workspaces', desc: 'Badejo & Associates — multiple practices under one login, each with its own matters, calendar and billing. Side-by-side workspaces ride the Enterprise and Komplete plans. Click to switch.', top: 0.9, left: 1.1, width: 15.5, height: 3.9, shape: 'lg' },
    { id: 'profile', label: 'Your profile', desc: 'Profile, settings, lock and sign-out. Click to open.', top: 0.9, left: 91.0, width: 8.0, height: 3.9, shape: 'lg' },
    { id: 'presence', label: 'Your team, live', desc: 'Eight teammates in this workspace — click a face to message.', top: 0.9, left: 85.9, width: 5.6, height: 3.9, shape: 'lg' },
    { id: 'aloa', label: 'Aloa', desc: "The firm's legal AI — on every file. Click to ask.", top: 56.1, left: 93.5, width: 5.2, height: 3.8, shape: 'full' },
    { id: 'nav', label: 'Main menu', desc: 'Every workspace page one click away.', top: 5.3, left: 1.0, width: 15.6, height: 44.1, shape: 'lg', hintAbove: true },
    { id: 'stats', label: 'The practice at a glance', desc: 'Active matters, overdue tasks and outstanding invoices — counted live.', top: 14.5, left: 20.2, width: 77.5, height: 8.7, shape: 'lg' },
    { id: 'recent', label: 'Recent Matters', desc: "The firm's active files — stage, court and next deadline on every row.", top: 23.8, left: 19.9, width: 24.9, height: 32.0, shape: 'lg', hintAbove: true },
    { id: 'tasks', label: 'Firm Tasks', desc: "Today's work — assigned, dated, and reminded on the 7 · 3 · 1 cadence.", top: 23.8, left: 46.5, width: 24.7, height: 32.0, shape: 'lg', hintAbove: true },
    { id: 'calendar', label: 'The firm calendar', desc: 'Hearings and firm events in one diary — click any date to open its day.', top: 23.8, left: 73.0, width: 24.8, height: 32.0, shape: 'lg', hintAbove: true },
];

const zoneById = (id: ZoneId) => ZONES.find((z) => z.id === id)!;

interface Workspace {
    id: string;
    initials: string;
    name: string;
    product: string;
    accent: string;
}

const WORKSPACES: Workspace[] = [
    { id: 'badejo', initials: 'BA', name: 'Badejo & Associates', product: 'Vega OS', accent: 'bg-[#1E3A8A]' },
    { id: 'badejo-property', initials: 'BP', name: 'Badejo Property Co.', product: 'Atrium OS', accent: 'bg-amber-500' },
    { id: 'okonkwo', initials: 'OP', name: 'Okonkwo & Partners', product: 'Vega OS', accent: 'bg-emerald-600' },
];

/** One canned Aloa exchange — the quick-reply chips. */
const ALOA_REPLIES: Record<string, string> = {
    'What\u2019s due this week?':
        'Three filings and one service-charge review in Badejo & Associates. The nearest: the affidavit for MAR/2024/011 — due Thursday. The shell is drafted and waiting in Documents.',
    'Draft the affidavit':
        'Done — I\u2019ve opened the MAR/2024/011 affidavit shell in DraftPro with the parties and court filled in. Check the [PLACEHOLDER] tags; everything else is ready to file.',
    'Who\u2019s free Thursday?':
        'Tunde is in court all day; Chinelo has a clean morning after 10:30; Kelechi is free from noon. Want me to assign the service and diary it?',
    'Summarise LIT/2023/042':
        'Breach-of-contract claim, Lagos High Court. Pleadings closed; witness statements are 2 of 4 in. Next step is pre-trial review on the 18th — I\u2019ve flagged the bundle gap in Notes.',
};

const ALOA_FALLBACK =
    'In the running workspace I\u2019d pull your matters, deadlines and files to answer that properly — start free and ask me anything inside.';

/** The calendar's month grid — NOVEMBER 2026, exactly as the capture
 *  renders it (Monday-first: Oct 26–31 grayed in row 1's first six cells,
 *  Nov 30 in row 6's first cell, Dec 1–6 grayed after it; the selected
 *  navy circle sits on 22). Only November dates are live; the grayed
 *  adjacent-month cells stay capture pixels. */
const NOV_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const novWeekday = (d: number) => NOV_WEEKDAYS[(d - 1) % 7]; // Nov 1 2026 is a Sunday
const NOV_GRID: (number | null)[][] = [
    [null, null, null, null, null, null, 1],
    [2, 3, 4, 5, 6, 7, 8],
    [9, 10, 11, 12, 13, 14, 15],
    [16, 17, 18, 19, 20, 21, 22],
    [23, 24, 25, 26, 27, 28, 29],
    [30, null, null, null, null, null, null],
];

/** The diary behind the dotted dates — VLM + pixel-verified on the
 *  2026-11-22 re-capture: blue dots on 16 and 20, blue+red on 24, red
 *  on 29, and TODAY (the selected 22) dot-free. Every other November
 *  date — including today — opens an honest clear day. */
const NOV_SCHEDULE: Record<number, { time: string; kind: string; text: string }[]> = {
    16: [
        { time: '10:00', kind: 'Hearing', text: 'LIT/2023/042 — pre-trial review, High Court of Lagos, Ikeja' },
    ],
    20: [
        { time: '9:30', kind: 'Hearing', text: 'N.A. v. Z-Alpha Bank PLC — Federal High Court, Court 8' },
    ],
    24: [
        { time: '9:00', kind: 'Hearing', text: 'Okafor v. Bale — High Court of Lagos, Ikeja, Court 12' },
        { time: '4:00', kind: 'Deadline', text: 'EMP/2024/008 — defence window closes under the CPR' },
    ],
    29: [
        { time: '4:00', kind: 'Deadline', text: 'MAR/2024/011 — affidavit of service due' },
    ],
};

/** Calendar-grid geometry — measured on the 2026-11-22 re-capture with
 *  pixel analysis (scripts/measure_calendar.py) + a VLM cross-check on a
 *  crop of dashboard.jpg covering x 72.9–97.9%w × y 37.7–91.3%h (in
 *  frame units: left 72.9cqw, top 23.56cqw, 25.0cqw wide, 33.5cqw
 *  tall). Column centres and row bands are % of that crop; calX/calY
 *  convert to frame cqw. Row bands are centred on each row's number
 *  band (pitch ≈ 7.46% of crop height); the selected navy circle sits
 *  on 22 (row 4, SUN) and the dots on 16 · 20 · 24 · 29. */
const CAL = {
    left: 72.9,
    top: 23.56,
    w: 25.0,
    h: 33.5,
    colCenters: [11.4, 24.2, 37.1, 49.7, 62.6, 75.6, 88.5],
    rows: [
        [28.6, 36.0], [36.0, 43.4], [43.4, 50.9],
        [50.9, 58.4], [58.4, 65.8], [65.8, 73.3],
    ],
};
const calX = (pct: number) => CAL.left + (pct / 100) * CAL.w;
const calY = (pct: number) => CAL.top + (pct / 100) * CAL.h;
const CAL_CELL_W = 3.1; // cqw hit width — the capture's column pitch is ~3.2cqw

const DemoChip: React.FC = () => (
    <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
        Preview
    </span>
);

export const DashboardHotspots: React.FC<{
    /** "Start free" hand-off for the Aloa panel's closing CTA. */
    onSignup?: () => void;
}> = ({ onSignup }) => {
    const [open, setOpen] = useState<MenuHotspot>(null);
    const [anchor, setAnchor] = useState<{ top: number; right: number; left?: number } | null>(null);
    // R80: the hovered zone — drives the dim veil, the floating hint and
    // the spotlight. `presence` is set by CollabPresence's own trigger
    // reporting hover up (the stack itself is ALWAYS visible now — the
    // 2026-11-22 owner direction retired the hide-at-rest model).
    const [hoverZone, setHoverZone] = useState<ZoneId | null>(null);
    // 2026-11-22: per-date calendar — the clicked date drives the flipped
    // day view (the R80 single fixed-day flip is retired).
    const [calendarFlipped, setCalendarFlipped] = useState(false);
    const [selectedDate, setSelectedDate] = useState<number | null>(null);

    // Current workspace + the connect-a-workspace flow state.
    const [currentWs, setCurrentWs] = useState('badejo');
    const [connectView, setConnectView] = useState(false);
    const [joinCode, setJoinCode] = useState('');
    const [joined, setJoined] = useState<string | null>(null);

    // The Aloa mini-chat state.
    const [aloaThread, setAloaThread] = useState<Array<{ from: 'you' | 'aloa'; text: string }>>([
        { from: 'you', text: 'What\u2019s due this week?' },
        { from: 'aloa', text: ALOA_REPLIES['What\u2019s due this week?'] },
    ]);
    const [aloaInput, setAloaInput] = useState('');
    const aloaEndRef = useRef<HTMLDivElement>(null);

    // Escape + outside-close, shared by every panel. Panels reset per open.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); };
        const onPointer = (e: PointerEvent) => {
            const t = e.target as HTMLElement;
            if (!t.closest('[data-hs-menu]') && !t.closest('[data-hs-trigger]')) setOpen(null);
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onPointer);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('pointerdown', onPointer);
        };
    }, [open]);

    useEffect(() => {
        if (open === 'aloa') {
            // Land the thread at its foot each time it grows.
            aloaEndRef.current?.scrollIntoView({ block: 'nearest' });
        }
    }, [aloaThread, open]);

    const openPanel = (which: Exclude<MenuHotspot, null>, e: React.MouseEvent<HTMLButtonElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        const right = window.innerWidth - r.right;
        // The workspace menu anchors to its LEFT edge (it opens under the
        // sidebar head); the profile and Aloa menus anchor to the right.
        const left = which === 'workspace' ? r.left : undefined;
        setAnchor({ top: r.bottom + 8, right: Math.max(right, 12), left });
        setConnectView(false);
        setJoined(null);
        setJoinCode('');
        setOpen((v) => (v === which ? null : which));
    };

    const askAloa = (question: string) => {
        const q = question.trim();
        if (!q) return;
        setAloaThread((t) => [...t, { from: 'you', text: q }, { from: 'aloa', text: ALOA_REPLIES[q] ?? ALOA_FALLBACK }]);
        setAloaInput('');
    };

    const zone = hoverZone ? zoneById(hoverZone) : null;

    // The dim veil's hole — the hovered zone's rect, kept at full colour
    // while everything around it grays out (the owner's hover model).
    const hole = zone;

    return (
        <>
            {/* ── R80: THE DIM VEIL — gray-out-the-rest. A full-frame
                shadow spread from the hovered zone's rect: the zone's own
                box stays clear (normal colour + the soft ring), the
                200cqw spread covers everything else. Fades in/out so the
                capture never snaps. ── */}
            <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 transition-opacity duration-200 ${Z_CLASS.captureDim} ${zone ? 'opacity-100' : 'opacity-0'}`}
                style={{ visibility: zone ? 'visible' : 'hidden' }}
            >
                {hole && (
                    <div
                        className="absolute"
                        style={{
                            top: `${hole.top}cqw`,
                            left: `${hole.left}cqw`,
                            width: `${hole.width}cqw`,
                            height: `${hole.height}cqw`,
                            borderRadius: hole.shape === 'full' ? '9999px' : '0.6cqw',
                            boxShadow: '0 0 0 200cqw rgba(2, 6, 23, 0.55)',
                        }}
                    />
                )}
            </div>

            {/* ── The teammate monikers — CollabPresence owns the trigger;
                2026-11-22: the stack is ALWAYS VISIBLE (owner: "do NOT
                hide interactive hotspot/badge elements until hovered") —
                hovering it fires the spotlight (dim veil + floating hint)
                via onHoverChange, exactly like every other zone. ── */}
            <CollabPresence
                onSignup={onSignup}
                onHoverChange={(h) => setHoverZone((prev) => (h ? 'presence' : prev === 'presence' ? null : prev))}
            />

            {/* ── The three CLICK hotspots (workspace chip, profile, Aloa
                orb) — real menus on the app's own furniture. Each carries
                its zone's hover for the dim veil + floating hint. ── */}
            <Button
                variant="bare"
                data-hs-trigger
                aria-label="Workspaces — switch or connect a workspace"
                aria-haspopup="menu"
                aria-expanded={open === 'workspace'}
                onClick={(e) => openPanel('workspace', e)}
                onMouseEnter={() => setHoverZone('workspace')}
                onMouseLeave={() => setHoverZone((v) => (v === 'workspace' ? null : v))}
                onFocus={() => setHoverZone('workspace')}
                onBlur={() => setHoverZone((v) => (v === 'workspace' ? null : v))}
                className="group-hs absolute z-20 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500"
                style={{ top: '0.9cqw', left: '1.1cqw', height: '3.9cqw', width: '15.5cqw' }}
            >
                <ZoneRing shape="lg" />
            </Button>

            <Button
                variant="bare"
                data-hs-trigger
                aria-label="Your profile and settings"
                aria-haspopup="menu"
                aria-expanded={open === 'profile'}
                onClick={(e) => openPanel('profile', e)}
                onMouseEnter={() => setHoverZone('profile')}
                onMouseLeave={() => setHoverZone((v) => (v === 'profile' ? null : v))}
                onFocus={() => setHoverZone('profile')}
                onBlur={() => setHoverZone((v) => (v === 'profile' ? null : v))}
                className="group-hs absolute z-20 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500"
                style={{ top: '0.9cqw', left: '91.0cqw', height: '3.9cqw', width: '8.0cqw' }}
            >
                <ZoneRing shape="lg" />
            </Button>

            <Button
                variant="bare"
                data-hs-trigger
                aria-label="Ask Aloa, the legal AI"
                aria-haspopup="dialog"
                aria-expanded={open === 'aloa'}
                onClick={(e) => openPanel('aloa', e)}
                onMouseEnter={() => setHoverZone('aloa')}
                onMouseLeave={() => setHoverZone((v) => (v === 'aloa' ? null : v))}
                onFocus={() => setHoverZone('aloa')}
                onBlur={() => setHoverZone((v) => (v === 'aloa' ? null : v))}
                className="group-hs absolute z-20 rounded-full focus-visible:ring-2 focus-visible:ring-indigo-500"
                style={{ top: '56.1cqw', left: '93.5cqw', height: '3.8cqw', width: '5.2cqw' }}
            >
                <ZoneRing shape="full" />
            </Button>

            {/* ── The CALENDAR — an informational hover zone (the veil +
                the "click any date" hint) with a PER-DATE button grid
                overlaid on the capture's month cells (2026-11-22 owner
                direction: "clicking a date flips/toggles it to reveal
                that date's schedule/event info"). Only November dates
                are live; the grayed adjacent-month cells stay pixels. ── */}
            <div
                role="img"
                aria-label={`${zoneById('calendar').label} — ${zoneById('calendar').desc}`}
                onMouseEnter={() => setHoverZone('calendar')}
                onMouseLeave={() => setHoverZone((v) => (v === 'calendar' ? null : v))}
                className={`absolute ${Z_CLASS.captureHint} rounded-lg group-hs`}
                style={{ top: '23.8cqw', left: '73.0cqw', height: '32.0cqw', width: '24.8cqw' }}
            >
                <ZoneRing shape="lg" />
            </div>
            {!calendarFlipped && NOV_GRID.map((row, r) =>
                row.map((date, c) => {
                    if (date === null) return null;
                    const [rowTop, rowBottom] = CAL.rows[r];
                    const entries = NOV_SCHEDULE[date];
                    return (
                        <Button
                            key={`cal-${date}`}
                            variant="bare"
                            aria-label={`Open ${novWeekday(date)}, ${date} November — ${entries ? `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}` : 'the day view'}`}
                            onClick={() => { setSelectedDate(date); setCalendarFlipped(true); }}
                            className={`group-hs absolute ${Z_CLASS.captureDate} rounded-md focus-visible:ring-2 focus-visible:ring-indigo-500`}
                            style={{
                                left: `${calX(CAL.colCenters[c]) - CAL_CELL_W / 2}cqw`,
                                top: `${calY(rowTop)}cqw`,
                                width: `${CAL_CELL_W}cqw`,
                                height: `${calY(rowBottom) - calY(rowTop)}cqw`,
                            }}
                        >
                            {/* The date's own resting marker — a soft ring on
                                hover/focus only; the capture's own number,
                                dots and selected circle show through at
                                rest (the cells ARE the visible dates). */}
                            <span
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-[0.1cqw] rounded-[0.4cqw] ring-1 ring-indigo-500/0 bg-indigo-400/0 transition-all duration-150 group-hs:hover:ring-indigo-500/80 group-hs:hover:bg-indigo-400/[0.10] group-hs:focus-visible:ring-indigo-500"
                            />
                        </Button>
                    );
                }),
            )}

            {/* ── The informational hover zones — nav rail, the three
                stat cards, Recent Matters, Firm Tasks. Hover/focus only
                (the floating hint is their whole job); they frame the
                pixels they describe and click through nothing. ── */}
            {(['nav', 'stats', 'recent', 'tasks'] as const).map((id) => {
                const z = zoneById(id);
                return (
                    <div
                        key={z.id}
                        role="img"
                        aria-label={`${z.label} — ${z.desc}`}
                        onMouseEnter={() => setHoverZone(z.id)}
                        onMouseLeave={() => setHoverZone((v) => (v === z.id ? null : v))}
                        className={`absolute ${Z_CLASS.captureHint} rounded-lg group-hs`}
                        style={{ top: `${z.top}cqw`, left: `${z.left}cqw`, height: `${z.height}cqw`, width: `${z.width}cqw` }}
                    >
                        <ZoneRing shape="lg" />
                    </div>
                );
            })}

            {/* ── R80: THE FLOATING HINT — the zone's explanation, floating
                beside the zone (replacing the old capture-foot pill).
                Clamped INSIDE the frame (2026-11-22: notes for zones high
                or low in the frame never clip — hintAbove notes anchor by
                top, below notes cap at the frame foot); pointer-events-none
                so it never blocks the zone it explains. ── */}
            {zone && (
                <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute ${Z_CLASS.captureHintNote} -translate-x-1/2 w-max max-w-[40cqw] rounded-lg bg-slate-950/90 backdrop-blur-sm px-[1.3cqw] py-[0.9cqw] shadow-xl animate-fade-in`}
                    style={{
                        left: `${Math.min(Math.max(zone.left + zone.width / 2, 21), 79)}cqw`,
                        top: `${zone.hintAbove ? Math.max(zone.top - 6.4, 1) : Math.min(zone.top + zone.height + 1.2, 56)}cqw`,
                    }}
                >
                    <p className="font-mono uppercase tracking-[0.12em] font-semibold text-indigo-300" style={{ fontSize: '1.05cqw' }}>
                        {zone.label}
                    </p>
                    <p className="text-slate-100 leading-[1.5]" style={{ fontSize: '1.15cqw' }}>
                        {zone.desc}
                    </p>
                </div>
            )}

            {/* ── THE CALENDAR FLIP — the card turns over to the CLICKED
                date's day view (2026-11-22: per-date, replacing the R80
                single fixed day). The wrapper holds the 3D context at the
                calendar card's exact rect; the front face is transparent
                (the capture's own month grid shows through until the
                flip), the back face is the selected date's day. ── */}
            <div
                aria-hidden={!calendarFlipped}
                className={`absolute ${Z_CLASS.captureFlip} transition-transform duration-500 [transform-style:preserve-3d]`}
                style={{
                    top: '23.8cqw', left: '73.0cqw', height: '32.0cqw', width: '24.8cqw',
                    perspective: '60cqw',
                    transform: calendarFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                    // The un-flipped wrapper is a transparent 3D stage over
                    // the date buttons (captureDate) — it must never swallow
                    // their clicks; only the flipped back face takes events.
                    pointerEvents: calendarFlipped ? 'auto' : 'none',
                }}
            >
                {/* Front face — transparent: the capture's month grid. */}
                <div className="absolute inset-0 [backface-visibility:hidden]" />
                {/* Back face — the CLICKED date's day view, mirrored back
                    upright. Empty dates open an honest clear day. */}
                <div
                    className="absolute inset-0 [backface-visibility:hidden] rounded-lg bg-white border border-slate-200 shadow-xl overflow-hidden flex flex-col [transform:rotateY(180deg)]"
                    style={{ fontSize: '1.05cqw' }}
                >
                    <div className="flex items-center justify-between gap-[0.8cqw] px-[1.2cqw] py-[0.9cqw] border-b border-slate-100 bg-slate-50">
                        <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate" style={{ fontSize: '1.25cqw' }}>
                                {selectedDate ? `${novWeekday(selectedDate)}, ${selectedDate} November` : 'The day view'}
                            </p>
                            <p className="text-slate-500" style={{ fontSize: '0.95cqw' }}>
                                {selectedDate && NOV_SCHEDULE[selectedDate]
                                    ? `${NOV_SCHEDULE[selectedDate].length} entr${NOV_SCHEDULE[selectedDate].length === 1 ? 'y' : 'ies'} · reminders fired 7 · 3 · 1 days out`
                                    : 'Nothing scheduled — the diary is clear'}
                            </p>
                        </div>
                        <DemoChip />
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden px-[1.2cqw] py-[1cqw] flex flex-col gap-[0.9cqw]">
                        {selectedDate && NOV_SCHEDULE[selectedDate] ? (
                            NOV_SCHEDULE[selectedDate].map((e) => (
                                <div key={e.time + e.kind} className="flex gap-[0.9cqw] items-start">
                                    <span className="font-mono font-semibold text-indigo-700 shrink-0" style={{ fontSize: '1cqw' }}>{e.time}</span>
                                    <span className="min-w-0">
                                        <span className="block font-semibold text-slate-900" style={{ fontSize: '1.05cqw' }}>{e.kind}</span>
                                        <span className="block text-slate-600 leading-[1.4]" style={{ fontSize: '0.95cqw' }}>{e.text}</span>
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center gap-[0.5cqw] px-[1cqw]">
                                <span className="flex items-center justify-center rounded-full bg-slate-100 text-slate-400" style={{ width: '2.6cqw', height: '2.6cqw' }} aria-hidden="true">
                                    <CalendarIcon className="h-[1.3cqw] w-[1.3cqw]" />
                                </span>
                                <p className="font-semibold text-slate-700" style={{ fontSize: '1.05cqw' }}>A clear day</p>
                                <p className="text-slate-500 leading-[1.4]" style={{ fontSize: '0.95cqw' }}>
                                    Hearings and deadlines land here from the matter diary — each one reminded 7 · 3 · 1 days out.
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="border-t border-slate-100 px-[1.2cqw] py-[0.8cqw]">
                        <Button
                            variant="bare"
                            onClick={() => setCalendarFlipped(false)}
                            className="w-full inline-flex items-center justify-center gap-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors"
                            style={{ fontSize: '1cqw', padding: '0.55cqw 0' }}
                        >
                            <span className="inline-flex" style={{ width: '1cqw', height: '1cqw' }} aria-hidden="true">
                                <ChevronDownIcon className="rotate-90 h-full w-full" />
                            </span>
                            Back to the month
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── The open panel — one at a time, portal'd. ── */}
            {open && anchor && createPortal(
                <div
                    role={open === 'aloa' ? 'dialog' : 'menu'}
                    aria-label={open === 'workspace' ? 'Workspaces' : open === 'profile' ? 'Your menu' : 'Aloa'}
                    data-hs-menu
                    className={`fixed ${Z_CLASS.hotspot} w-[300px] rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 overflow-hidden`}
                    style={anchor.left !== undefined
                        ? { top: Math.min(anchor.top, window.innerHeight - 300), left: anchor.left }
                        : { top: Math.min(anchor.top, window.innerHeight - 380), right: anchor.right }}
                >
                    {/* ── WORKSPACES ── */}
                    {open === 'workspace' && !connectView && (
                        <>
                            <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-xs font-mono tracking-widest text-slate-500 uppercase">Workspaces</p>
                                    <p className="text-sm font-semibold text-slate-900">Keep things separate</p>
                                </div>
                                <DemoChip />
                            </div>
                            <div className="py-1.5" role="group" aria-label="Your workspaces">
                                {WORKSPACES.map((ws) => {
                                    const active = ws.id === currentWs;
                                    return (
                                        <Button
                                            key={ws.id}
                                            variant="bare"
                                            onClick={() => setCurrentWs(ws.id)}
                                            role="menuitemradio"
                                            aria-checked={active}
                                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${active ? 'bg-indigo-50/70' : 'hover:bg-slate-50'}`}
                                        >
                                            <span className={`flex items-center justify-center h-8 w-8 rounded-lg text-[11px] font-bold text-white flex-shrink-0 ${ws.accent}`}>
                                                {ws.initials}
                                            </span>
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-[13px] font-semibold text-slate-900 truncate">{ws.name}</span>
                                                <span className="block text-[11px] text-slate-500">{ws.product}</span>
                                            </span>
                                            {active
                                                ? <CheckCircleIcon className="h-4 w-4 text-indigo-600 flex-shrink-0" aria-hidden="true" />
                                                : <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex-shrink-0">Switch</span>}
                                        </Button>
                                    );
                                })}
                            </div>
                            <div className="border-t border-slate-100 p-1.5">
                                <Button
                                    variant="bare"
                                    onClick={() => setConnectView(true)}
                                    role="menuitem"
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors"
                                >
                                    <PlusIcon className="h-4 w-4" aria-hidden="true" />
                                    Connect New Workspace
                                </Button>
                            </div>
                            <p className="px-4 pb-3 pt-1 text-[11px] leading-relaxed text-slate-500">
                                Each practice, portfolio or side business keeps its own matters, calendar and billing — switch without logging out.
                            </p>
                        </>
                    )}

                    {/* ── WORKSPACES → connect (join code) ── */}
                    {open === 'workspace' && connectView && (
                        <div className="p-4 text-left">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-sm font-semibold text-slate-900">Connect a workspace</p>
                                <DemoChip />
                            </div>
                            <p className="text-[11px] leading-relaxed text-slate-500 mb-3">
                                A colleague shares a join code from their firm’s Settings — paste it and you’re in, with your role waiting.
                            </p>
                            {joined ? (
                                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 mb-3">
                                    <p className="flex items-center gap-2 text-[13px] font-semibold text-emerald-800">
                                        <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
                                        Request sent to {joined}
                                    </p>
                                    <p className="text-[11px] text-emerald-700 mt-1 leading-relaxed">
                                        Inside the app, their admin approves and the workspace appears in this list — nothing of yours mixes until then.
                                    </p>
                                </div>
                            ) : (
                                <input
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value)}
                                    placeholder="e.g. BADEJO-VEGA-7X2"
                                    autoFocus
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 mb-3"
                                />
                            )}
                            <div className="flex items-center justify-between gap-2">
                                <Button variant="bare" onClick={() => setConnectView(false)} className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors">
                                    Back
                                </Button>
                                <Button
                                    variant="bare"
                                    disabled={joined !== null || joinCode.trim().length < 4}
                                    onClick={() => setJoined(joinCode.trim().split('-')[0] || 'the firm')}
                                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${joined || joinCode.trim().length < 4
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-[#1E3A8A] hover:bg-[#1E40AF] text-white'}`}
                                >
                                    {joined ? 'Sent' : 'Join workspace'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ── YOUR PROFILE ── */}
                    {open === 'profile' && (
                        <>
                            <div className="px-4 pt-3.5 pb-3 border-b border-slate-100 flex items-center gap-3">
                                <span className="flex items-center justify-center h-9 w-9 rounded-full bg-[#1E3A8A] text-white text-xs font-bold">DU</span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-slate-900 truncate">Demo User</p>
                                    <p className="text-[11px] text-slate-500 uppercase tracking-wider">Admin · Badejo & Associates</p>
                                </div>
                                <DemoChip />
                            </div>
                            <div className="py-1.5">
                                <MenuRow icon={<UserIcon className="h-4 w-4" />} label="My Profile" note="Your name, role, signature and password — exactly what the firm sees on your work." />
                                <MenuRow icon={<CogIcon className="h-4 w-4" />} label="Settings" note="Firm details, team and permissions, templates, billing — the whole practice’s knobs." />
                                <MenuRow icon={<LockClosedIcon className="h-4 w-4" />} label="Lock Workspace" note="One click and the screen locks — client data never sits open on an unattended desk." />
                                <MenuRow icon={<LogoutIcon className="h-4 w-4" />} label="Sign out" note="Your work is saved as you go; sign back in and every thread is where you left it." />
                            </div>
                            <p className="px-4 pb-3 pt-1 text-[11px] leading-relaxed text-slate-500">
                                This is you — inside Vega, everything here is real.
                            </p>
                        </>
                    )}

                    {/* ── ALOA ── */}
                    {open === 'aloa' && (
                        <div className="text-left">
                            <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5 border-b border-slate-100">
                                <span className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                                    <SparklesIcon className="h-4 w-4" aria-hidden="true" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-slate-900">Aloa</p>
                                    <p className="text-[11px] text-slate-500">The firm’s legal AI — on every file</p>
                                </div>
                                <DemoChip />
                            </div>
                            {/* The thread — seeded with one exchange, grows
                                with the chips or anything typed. */}
                            <div className="max-h-[240px] overflow-y-auto px-3.5 py-3 space-y-2.5">
                                {aloaThread.map((m, i) => (
                                    <div key={i} className={`flex ${m.from === 'you' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[12px] leading-relaxed ${
                                            m.from === 'you'
                                                ? 'rounded-br-sm bg-indigo-600 text-white'
                                                : 'rounded-bl-sm bg-slate-100 text-slate-800 border border-slate-200'
                                        }`}>
                                            {m.text}
                                        </div>
                                    </div>
                                ))}
                                <div ref={aloaEndRef} />
                            </div>
                            {/* Quick asks — the chips that show what it does. */}
                            <div className="flex flex-wrap gap-1.5 px-3.5 pb-2.5">
                                {Object.keys(ALOA_REPLIES).filter((q) => q !== 'What\u2019s due this week?').map((q) => (
                                    <Button
                                        key={q}
                                        variant="bare"
                                        onClick={() => askAloa(q)}
                                        className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                                    >
                                        {q}
                                    </Button>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 border-t border-slate-100 p-2.5">
                                <input
                                    value={aloaInput}
                                    onChange={(e) => setAloaInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') askAloa(aloaInput); }}
                                    placeholder="Ask Aloa anything…"
                                    aria-label="Ask Aloa"
                                    className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                <Button
                                    variant="bare"
                                    disabled={!aloaInput.trim()}
                                    onClick={() => askAloa(aloaInput)}
                                    aria-label="Send to Aloa"
                                    className={`flex-shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-lg transition-colors ${aloaInput.trim()
                                        ? 'bg-[#1E3A8A] hover:bg-[#1E40AF] text-white'
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                                >
                                    <SendIcon className="h-4 w-4" aria-hidden="true" />
                                </Button>
                            </div>
                            {onSignup && (
                                <div className="border-t border-slate-100 px-3.5 py-2.5 flex items-center justify-between gap-2">
                                    <p className="text-[11px] text-slate-500 leading-snug">Aloa reads your matters, deadlines and files — not the open internet.</p>
                                    <Button variant="bare" onClick={onSignup} className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-[#1E3A8A] hover:bg-[#1E40AF] text-white text-[11px] font-semibold transition-colors">
                                        Start free
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>,
                document.body
            )}
        </>
    );
};

/** The zone's resting marker — a soft DASHED INDIGO outline, VISIBLE
 *  AT REST (2026-11-22 owner direction: interactive markers are never
 *  hidden until hover), sharpening to the solid ring + indigo wash on
 *  hover/focus while the zone's own pixels stay at normal colour inside
 *  it (the spotlight veil handles the dimming of everything else).
 *  Exported for MattersHotspots — the same marker contract on both
 *  interactive exhibits. */
export const ZoneRing: React.FC<{ shape?: 'lg' | 'full' }> = ({ shape = 'lg' }) => (
    <span
        aria-hidden="true"
        className={`pointer-events-none absolute -inset-[0.25cqw] ${shape === 'full' ? 'rounded-full' : 'rounded-[0.7cqw]'} border-2 border-dashed border-indigo-500/70 transition-all duration-150 group-hs:hover:border-solid group-hs:hover:border-indigo-500 group-hs:hover:bg-indigo-400/[0.08] group-hs:focus-visible:border-solid group-hs:focus-visible:border-indigo-500`}
    />
);

/** A profile-menu row — click unfolds the one-line explanation of what
 * it does inside the app, right under the item (the menu stays put). */
const MenuRow: React.FC<{ icon: React.ReactNode; label: string; note: string }> = ({ icon, label, note }) => {
    const [open, setOpen] = useState(false);
    return (
        <div>
            <Button
                variant="bare"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
                <span className="text-slate-400 flex-shrink-0">{icon}</span>
                <span className="flex-1">{label}</span>
                <ChevronDownIcon className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
            </Button>
            {open && (
                <p className="px-4 pb-2.5 pt-0.5 pl-[3.4rem] text-[11px] leading-relaxed text-slate-500 border-l-2 border-indigo-100 ml-4">
                    {note}
                </p>
            )}
        </div>
    );
};
