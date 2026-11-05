import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../components/ui';
import { SendIcon } from '../../../constants';

/**
 * CollabPresence — R69: the team-presence overlay on the live captures.
 *
 * Owner direction (verbatim shape): "Display overlapping user
 * initials/avatars representing multiple active team members logged into
 * the workspace. Include an overflow badge indicator (e.g., '+5')...
 * Clicking on any of these user monikers should trigger a quick dropdown
 * menu with an option to 'Send Direct Message' to that team member" —
 * positioned in the app header "between the notification bell and the
 * current user's profile username/role on the far right", and "visible
 * across all relevant live capture views".
 *
 * GEOMETRY (measured, scripts/r69-header-geometry.py + pixel analysis):
 * every standard-header capture shares pixel-identical chrome — the bell
 * ends at x 86.8% of the image width, the profile text starts at 91.5%,
 * so the free gap is exactly 4.7% wide (68 css px at the native 1440
 * render). The overlay pins into that gap: right 8.55cqw, top 1.25cqw,
 * three Ø1.95cqw avatars with a -0.58cqw overlap (+ the "+5" as a corner
 * chip on the last avatar, which adds no width). The frame declares
 * container-type: inline-size (inline style — the Tailwind v3 setup has
 * no container-queries plugin), so cqw units track the image width at
 * EVERY render size: the suite card, the hero's dashboard card and the
 * lightbox all place the stack in the same header gap. Each cqw size
 * carries a px fallback class first (browsers without container-query
 * units keep a static stack instead of collapsing).
 *
 * INTERACTION: the whole gap zone is ONE ui/Button (ADR-0004) — on hover
 * or focus the stack pops (scale 1.55, growing leftward over the bell
 * with a soft white plate) so the initials are readable even at card
 * scale; on click it opens the presence dropdown. The dropdown is
 * portal'd to document.body (the capture frames are overflow-hidden) and
 * lists EVERY online teammate — the clicked stack always opens the full
 * roster, so the "+5" members are as reachable as the visible three.
 * Each row's "Send Direct Message" action (SendIcon, the app's own
 * metaphor) swaps the panel to an honest demo note: direct messages open
 * inside Vega — this is a live-capture preview — with a Start free
 * hand-off where the host section provides one.
 */

export interface CollabTeammate {
    initials: string;
    name: string;
    role: string;
    /** Tailwind classes for the avatar fill — high-contrast pairs only. */
    avatarClass: string;
}

/** The roster — Badejo & Associates-flavoured, matching the captures'
 * "Badejo & Associates / VEGA OS" firm. Eight online: three visible in
 * the stack, five behind the "+5". */
export const COLLAB_ROSTER: CollabTeammate[] = [
    { initials: 'AO', name: 'Adaeze Okonkwo', role: 'Managing Partner', avatarClass: 'bg-indigo-600 text-white' },
    { initials: 'TA', name: 'Tunde Adeyemi', role: 'Senior Counsel', avatarClass: 'bg-emerald-600 text-white' },
    { initials: 'CN', name: 'Chinelo Nwosu', role: 'Associate', avatarClass: 'bg-amber-500 text-white' },
    { initials: 'BC', name: 'Bode Coker', role: 'Associate', avatarClass: 'bg-sky-600 text-white' },
    { initials: 'FA', name: 'Funmi Alabi', role: 'Litigation Secretary', avatarClass: 'bg-rose-500 text-white' },
    { initials: 'KO', name: 'Kelechi Obi', role: 'Pupil Counsel', avatarClass: 'bg-violet-600 text-white' },
    { initials: 'NE', name: 'Ngozi Eze', role: 'Accounts', avatarClass: 'bg-teal-600 text-white' },
    { initials: 'SF', name: 'Sade Fashola', role: 'Front Desk', avatarClass: 'bg-slate-600 text-white' },
];

export const CollabPresence: React.FC<{
    /** Scales the stack: 1 in the cards, 1.3 in the lightbox where the
     *  header strip has more room to carry bigger initials. */
    scale?: number;
    /** "Start free" hand-off for the demo note — provided by sections
     *  that own a signup callback (VegaSuite). Omitted elsewhere. */
    onSignup?: () => void;
}> = ({ scale = 1, onSignup }) => {
    const btnRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
    const [note, setNote] = useState<string | null>(null);

    // Close on Escape (focus returns to the trigger) and on outside
    // pointer-down; keep the note state per-open.
    useEffect(() => {
        if (!open) return;
        setNote(null);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); }
        };
        const onPointer = (e: PointerEvent) => {
            const t = e.target as HTMLElement;
            if (!t.closest('[data-collab-menu]') && !t.closest('[data-collab-trigger]')) setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onPointer);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('pointerdown', onPointer);
        };
    }, [open]);

    const openMenu = () => {
        const r = btnRef.current?.getBoundingClientRect();
        if (r) setAnchor({ top: r.bottom + 8, right: window.innerWidth - r.right });
        setOpen((v) => !v);
    };

    const s = (v: number) => `${(v * scale).toFixed(3)}cqw`;

    return (
        <>
            {/* The trigger — the whole bell→profile gap. Sized in cqw with
                px fallbacks; the stack pops on hover/focus. */}
            <Button
                ref={btnRef}
                variant="bare"
                aria-label={`Team presence — ${COLLAB_ROSTER.length} teammates online. Open the roster.`}
                aria-haspopup="menu"
                aria-expanded={open}
                data-collab-trigger
                onClick={openMenu}
                className="group absolute z-20 flex items-center justify-end rounded-md focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 transition-transform duration-200 hover:scale-[1.55] focus-visible:scale-[1.55] origin-right"
                style={{
                    // The measured gap: right edge 8.55% of image width,
                    // top 1.25cqw, height 1.95cqw (the header strip's
                    // content band), width 5.6cqw (the gap + margin).
                    top: '1.25cqw', right: '8.55cqw', height: '1.95cqw', width: '5.6cqw',
                }}
            >
                {/* Pop plate — a soft white ground behind the enlarged
                    stack so the initials stay crisp over the header. The
                    plate's RIGHT edge is pinned to the trigger's (which
                    already stops short of the profile text — the VLM QA
                    caught a symmetric inset clipping "Demo User"). */}
                <span
                    aria-hidden="true"
                    className="absolute top-[-40%] bottom-[-40%] left-[-40%] right-0 rounded-l-full bg-white/85 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200"
                />
                <span className="relative flex items-center" style={{ height: '1.95cqw' }}>
                    {COLLAB_ROSTER.slice(0, 3).map((m, i) => (
                        <span
                            key={m.initials}
                            className={`relative flex items-center justify-center rounded-full ring-2 ring-white shadow-sm font-bold ${m.avatarClass}`}
                            style={{
                                height: s(1.95), width: s(1.95),
                                marginLeft: i === 0 ? 0 : s(-0.58),
                                fontSize: s(0.78),
                                zIndex: 3 - i,
                            }}
                        >
                            {m.initials}
                            {i === 2 && (
                                <span
                                    className="absolute font-bold rounded-full bg-slate-900 text-white ring-2 ring-white flex items-center justify-center"
                                    style={{
                                        // The "+5" corner chip on the last
                                        // avatar — adds no stack width, and
                                        // its right edge is pinned to the
                                        // AVATAR's right edge (the trigger
                                        // already stops short of the
                                        // profile text; the first VLM pass
                                        // caught a hanging chip clipping
                                        // "Demo User").
                                        top: s(-0.45), right: 0,
                                        height: s(1.05), minWidth: s(1.05), padding: `0 ${s(0.18)}`, fontSize: s(0.62),
                                    }}
                                >
                                    +5
                                </span>
                            )}
                        </span>
                    ))}
                </span>
            </Button>

            {/* The presence dropdown — portal'd (capture frames clip), fixed
                to the trigger's viewport rect. */}
            {open && anchor && createPortal(
                <div
                    role="menu"
                    aria-label="Teammates online"
                    data-collab-menu
                    className="fixed z-[290] w-[280px] rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 overflow-hidden"
                    style={{ top: Math.min(anchor.top, window.innerHeight - 380), right: Math.max(anchor.right, 12) }}
                >
                    {note ? (
                        <div className="p-5 text-left">
                            <span className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-indigo-50 text-indigo-600 mb-3">
                                <SendIcon className="h-4 w-4" />
                            </span>
                            <p className="text-sm font-semibold text-slate-900 mb-1.5">Direct messages open inside Vega</p>
                            <p className="text-xs leading-relaxed text-slate-500 mb-4">
                                This is a live-capture preview — in the app, {note} gets your note instantly,
                                with the thread kept on the matter.
                            </p>
                            <div className="flex gap-2">
                                {onSignup && (
                                    <Button variant="bare" onClick={() => { setOpen(false); onSignup(); }}
                                        className="px-3.5 py-2 rounded-lg bg-[#1E3A8A] hover:bg-[#1E40AF] text-white text-xs font-semibold transition-colors">
                                        Start free
                                    </Button>
                                )}
                                <Button variant="bare" onClick={() => setNote(null)}
                                    className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors">
                                    Back
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-100">
                                <p className="text-xs font-mono tracking-widest text-slate-500 uppercase">Active now</p>
                                <p className="text-sm font-semibold text-slate-900">{COLLAB_ROSTER.length} teammates in this workspace</p>
                            </div>
                            <ul className="max-h-[264px] overflow-y-auto py-1.5">
                                {COLLAB_ROSTER.map((m) => (
                                    <li key={m.initials} role="menuitem">
                                        <div className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 group/row">
                                            <span className={`flex items-center justify-center h-8 w-8 rounded-full text-[11px] font-bold ring-2 ring-white shadow-sm flex-shrink-0 ${m.avatarClass}`}>
                                                {m.initials}
                                            </span>
                                            <span className="flex-1 min-w-0 text-left">
                                                <span className="block text-[13px] font-semibold text-slate-900 truncate">{m.name}</span>
                                                <span className="block text-[11px] text-slate-500 truncate">{m.role}</span>
                                            </span>
                                            <Button
                                                variant="bare"
                                                onClick={() => setNote(m.name.split(' ')[0])}
                                                aria-label={`Send direct message to ${m.name}`}
                                                className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors"
                                            >
                                                <SendIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                                DM
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>,
                document.body
            )}
        </>
    );
};
