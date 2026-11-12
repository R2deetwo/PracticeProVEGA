import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../components/ui';
import {
    CheckIcon, CheckCircleIcon, ChevronDownIcon, CogIcon,
    LockClosedIcon, LogoutIcon, PlusIcon, SendIcon, SparklesIcon, UserIcon,
} from '../../../constants';

/**
 * DashboardHotspots — R74: the hero's dashboard capture becomes a
 * working miniature of the app (owner direction, this round).
 *
 * "This could probably be a very good opportunity to sort of showcase
 * the whole app like a mini demo… let's have a situation where we're
 * able to have a lot of interactivity brought into that little thing
 * so that users can have an idea and understanding of what could be
 * done." The capture stays a REAL screenshot (the honesty rule —
 * nothing is restaged); instead, the app's own interactive furniture
 * is overlaid on the pixels where it already lives, and each opens the
 * REAL flow in miniature:
 *
 *   • the workspace chip (sidebar head, "Badejo & Associates") → the
 *     multi-workspace switcher: current firm, other firms, Connect New
 *     Workspace with a join code — "keep things separate" made visible;
 *   • your own profile (header right, "Demo User") → the user menu —
 *     profile, settings, lock, sign out — answering "what happens if I
 *     I click on my own moniker?";
 *   • the Aloa orb (bottom-right FAB) → a mini Aloa exchange — ask, and
 *     it answers like it does in the running workspace.
 *
 * DISCOVERABILITY (the owner's actual R71-adjacent gripe: "it now begs
 * the question, what does this do?"): a quiet mono pill rides the
 * capture foot — "Interactive preview — the workspace, your profile,
 * teammates and Aloa all respond" — until the first interaction; the
 * hotspots themselves stay INVISIBLE at rest (no highlight — the same
 * quiet-chrome rule as the presence stack) and gain only a soft
 * focus-style ring on hover/focus so the pointer finds them naturally.
 *
 * GEOMETRY (VLM-measured on dashboard.jpg, 1440×900): sidebar head
 * x 1.2–16.5%, y 1.5–7.2%; profile block x 88–99%, y 1.5–7.2%; Aloa
 * FAB x 93.5–98.7%, y 89.7–95.8%. Sized in cqw inside the capture's
 * container-type: inline-size wrapper — same system as CollabPresence,
 * so everything tracks the image at any width (card and lightbox).
 *
 * Presentational chrome only; every interactive element is ui/Button
 * (ADR-0004). All state is local demo state — nothing leaves the
 * browser, and the panels say "Preview" once, quietly, without
 * narrating themselves.
 */

type Hotspot = 'workspace' | 'profile' | 'aloa' | null;

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

const HotspotRing: React.FC<{ className?: string }> = ({ className = '' }) => (
    <span
        aria-hidden="true"
        className={`pointer-events-none absolute -inset-1 rounded-lg ring-2 ring-indigo-400/0 bg-indigo-400/0 transition-all duration-150 group-hs:hover:ring-indigo-400/50 group-hs:hover:bg-indigo-400/[0.06] group-hs:focus-visible:ring-indigo-500 ${className}`}
    />
);

const DemoChip: React.FC = () => (
    <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
        Preview
    </span>
);

export const DashboardHotspots: React.FC<{
    /** 1 in the hero card, 1.3 in the lightbox (matches CollabPresence). */
    scale?: number;
    /** "Start free" hand-off for the Aloa panel's closing CTA. */
    onSignup?: () => void;
}> = ({ scale = 1, onSignup }) => {
    const [open, setOpen] = useState<Hotspot>(null);
    const [anchor, setAnchor] = useState<{ top: number; right: number; left?: number } | null>(null);
    const [interacted, setInteracted] = useState(false);

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

    const openPanel = (which: Exclude<Hotspot, null>, e: React.MouseEvent<HTMLButtonElement>) => {
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
        setInteracted(true);
    };

    const askAloa = (question: string) => {
        const q = question.trim();
        if (!q) return;
        setAloaThread((t) => [...t, { from: 'you', text: q }, { from: 'aloa', text: ALOA_REPLIES[q] ?? ALOA_FALLBACK }]);
        setAloaInput('');
    };

    const s = (v: number) => `${(v * scale).toFixed(3)}cqw`;

    return (
        <>
            {/* ── The affordance pill — quiet, mono, rides the capture foot
                until the first interaction. Mobile says TAP, pointer says
                CLICK. Never blocks the hotspots (pointer-events-none). ── */}
            <span
                aria-hidden="true"
                className={`pointer-events-none absolute z-20 left-1/2 -translate-x-1/2 bottom-[2.5%] hidden sm:inline-flex items-center gap-2 rounded-full bg-slate-950/70 backdrop-blur-sm px-3.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-100 shadow-lg transition-opacity duration-500 ${interacted ? 'opacity-0' : 'opacity-100'}`}
                style={{ whiteSpace: 'nowrap' }}
            >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                Interactive preview — click around
            </span>
            <span
                aria-hidden="true"
                className={`pointer-events-none absolute z-20 left-1/2 -translate-x-1/2 bottom-[2.5%] sm:hidden inline-flex items-center gap-1.5 rounded-full bg-slate-950/70 backdrop-blur-sm px-3 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-100 shadow-lg transition-opacity duration-500 ${interacted ? 'opacity-0' : 'opacity-100'}`}
                style={{ whiteSpace: 'nowrap' }}
            >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                Tap to explore
            </span>

            {/* ── Workspace trigger — the sidebar's firm chip. ── */}
            <Button
                variant="bare"
                data-hs-trigger
                aria-label="Workspaces — switch or connect a workspace"
                aria-haspopup="menu"
                aria-expanded={open === 'workspace'}
                onClick={(e) => openPanel('workspace', e)}
                className="group-hs absolute z-20 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500"
                style={{ top: s(1.4), left: s(1.1), height: s(6.2), width: s(15.6) }}
            >
                <HotspotRing />
            </Button>

            {/* ── Profile trigger — "Demo User" + the DU avatar. Narrow on
                purpose: it must stop short of the presence stack's gap
                (the stack owns x 85.9–91.5%; the profile text starts at
                91.5%) so the two triggers never fight for a click. ── */}
            <Button
                variant="bare"
                data-hs-trigger
                aria-label="Your profile and settings"
                aria-haspopup="menu"
                aria-expanded={open === 'profile'}
                onClick={(e) => openPanel('profile', e)}
                className="group-hs absolute z-20 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500"
                style={{ top: s(1.4), right: s(0.8), height: s(6.2), width: s(7.5) }}
            >
                <HotspotRing />
            </Button>

            {/* ── Aloa trigger — the spark orb at the foot. ── */}
            <Button
                variant="bare"
                data-hs-trigger
                aria-label="Ask Aloa, the legal AI"
                aria-haspopup="dialog"
                aria-expanded={open === 'aloa'}
                onClick={(e) => openPanel('aloa', e)}
                className="group-hs absolute z-20 rounded-full focus-visible:ring-2 focus-visible:ring-indigo-500"
                style={{ bottom: s(3.9), right: s(1.4), height: s(6.2), width: s(6.2) }}
            >
                <HotspotRing className="!rounded-full" />
            </Button>

            {/* ── The open panel — one at a time, portal'd. ── */}
            {open && anchor && createPortal(
                <div
                    role={open === 'aloa' ? 'dialog' : 'menu'}
                    aria-label={open === 'workspace' ? 'Workspaces' : open === 'profile' ? 'Your menu' : 'Aloa'}
                    data-hs-menu
                    className="fixed z-[290] w-[300px] rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 overflow-hidden"
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
                                        <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${
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
