import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../components/ui';
import { CheckIcon, ChatAltIcon, SendIcon, UserCircleIcon } from '../../../constants';

/**
 * CollabPresence — the team-presence overlay on the app captures.
 *
 * HISTORY. R69 added the overlapping avatars + the "+5" chip; R71 made
 * the stack QUIET (owner: "it should just be seen as visible and not
 * highlighted or highlightable") — no hover pop, no plate, the stack
 * reads as plain header chrome. That contract is UNCHANGED here.
 *
 * R74 — the roster becomes the demo (owner direction, this round): "the
 * thing with being able to open to do a drop down and message people
 * directly… that's something that we can implement inside the app. And
 * maybe you can even select multiple people so that you can create a
 * group message." So the dropdown is no longer a note that SAYS the app
 * does this — it briefly DOES it, as a working preview:
 *
 *   • every row carries a checkbox — pick one teammate and "Message"
 *     opens a direct-message composer; pick two or more and it becomes a
 *     GROUP composer (group name prefilled from the initials, editable);
 *   • the quick DM button on each row jumps straight to the composer
 *     addressed to that person;
 *   • Send lands the message in a mini thread view — "Delivered" — with
 *     the hand-off into the app ("Start free"), because the real thread
 *     lives inside Vega's Messages, kept on the matter.
 *
 * The panel is honest about being a preview (a small mono chip) without
 * narrating itself. All state is local; nothing leaves the browser.
 *
 * GEOMETRY (unchanged from R69/R71, measured on the 1440 captures):
 * the stack pins into the app header's bell→profile gap — right 8.55cqw,
 * top 1.25cqw — inside the capture frame's container-type: inline-size
 * wrapper, so it tracks the image at every render width (suite card,
 * hero dashboard card, lightbox). cqw sizes carry no px fallback class
 * here beyond the trigger hit-area, matching the shipped R71 stack.
 *
 * INTERACTION (R71 contract, kept): the trigger never enlarges, never
 * gains a plate, shows no hover state — only the keyboard focus ring.
 * The whole gap zone stays ONE ui/Button (ADR-0004); the click roster
 * and keyboard focus ring stay.
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
 * the stack, five behind the "+5". Shared with DashboardHotspots so the
 * whole preview speaks with one cast. */
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

/** The panel's inner views. `roster` lists everyone; `composer` is the
 * DM/group writer; `sent` is the delivered mini-thread. */
type PanelView =
    | { kind: 'roster' }
    | { kind: 'composer'; recipients: CollabTeammate[] }
    | { kind: 'sent'; recipients: CollabTeammate[]; groupName?: string; body: string };

const DemoChip: React.FC = () => (
    <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2 py-0.5">
        Preview
    </span>
);

export const CollabPresence: React.FC<{
    /** Scales the stack: 1 in the cards, 1.3 in the lightbox where the
     *  header strip has more room to carry bigger initials. */
    scale?: number;
    /** "Start free" hand-off for the sent view — provided by sections
     *  that own a signup callback (VegaSuite/VegaHero). Omitted elsewhere. */
    onSignup?: () => void;
}> = ({ scale = 1, onSignup }) => {
    const btnRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
    const [view, setView] = useState<PanelView>({ kind: 'roster' });
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // Close on Escape (focus returns to the trigger) and on outside
    // pointer-down; the view resets per-open.
    useEffect(() => {
        if (!open) return;
        setView({ kind: 'roster' });
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

    const toggleSelected = (initials: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(initials)) next.delete(initials);
            else next.add(initials);
            return next;
        });
    };

    const selectedMembers = COLLAB_ROSTER.filter((m) => selected.has(m.initials));

    const startComposer = (recipients: CollabTeammate[]) => {
        setView({ kind: 'composer', recipients });
    };

    return (
        <>
            {/* The trigger — the whole bell→profile gap. Sized in cqw
                with px fallbacks. R71: NO hover pop, NO plate — the
                stack sits in the header as quiet, always-on chrome;
                only the keyboard focus ring (focus-visible) remains. */}
            <Button
                ref={btnRef}
                variant="bare"
                aria-label={`Team presence — ${COLLAB_ROSTER.length} teammates online. Open the roster.`}
                aria-haspopup="menu"
                aria-expanded={open}
                data-collab-trigger
                onClick={openMenu}
                className="absolute z-20 flex items-center justify-end rounded-md focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
                style={{
                    // The measured gap: right edge 8.55% of image width,
                    // top 1.25cqw, height 1.95cqw (the header strip's
                    // content band), width 5.6cqw (the gap + margin).
                    top: '1.25cqw', right: '8.55cqw', height: '1.95cqw', width: '5.6cqw',
                }}
            >
                {/* R71: the static stack — three avatars + the "+5"
                    chip, exactly as it reads in the app header. Nothing
                    here responds to hover. */}
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

            {/* The presence panel — portal'd (capture frames clip), fixed
                to the trigger's viewport rect. R74: roster → composer →
                sent, the whole DM/group flow in miniature. */}
            {open && anchor && createPortal(
                <div
                    role="menu"
                    aria-label="Teammates online"
                    data-collab-menu
                    className="fixed z-[290] w-[300px] rounded-xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20 overflow-hidden"
                    style={{ top: Math.min(anchor.top, window.innerHeight - 420), right: Math.max(anchor.right, 12) }}
                >
                    {view.kind === 'roster' && (
                        <>
                            <div className="px-4 pt-3.5 pb-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-xs font-mono tracking-widest text-slate-500 uppercase">Active now</p>
                                    <p className="text-sm font-semibold text-slate-900">{COLLAB_ROSTER.length} teammates in this workspace</p>
                                </div>
                                <DemoChip />
                            </div>
                            {/* The pick rows — checkbox, person, quick DM.
                                One tap writes a DM; two taps make a group. */}
                            <ul className="max-h-[236px] overflow-y-auto py-1.5" role="group" aria-label="Pick who to message">
                                {COLLAB_ROSTER.map((m) => {
                                    const checked = selected.has(m.initials);
                                    return (
                                        <li key={m.initials} role="menuitemcheckbox" aria-checked={checked}>
                                            <div className="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-slate-50">
                                                <Button
                                                    variant="bare"
                                                    onClick={() => toggleSelected(m.initials)}
                                                    aria-label={`${checked ? 'Unselect' : 'Select'} ${m.name}`}
                                                    className="flex-shrink-0 flex h-4 w-4 items-center justify-center rounded border transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500"
                                                    aria-checked={checked}
                                                    role="checkbox"
                                                    activePress={false}
                                                    style={{ borderColor: checked ? 'rgb(79 70 229)' : 'rgb(203 213 225)', background: checked ? 'rgb(79 70 229)' : 'transparent' }}
                                                >
                                                    {checked && <CheckIcon className="h-3 w-3 text-white" aria-hidden="true" />}
                                                </Button>
                                                <Button
                                                    variant="bare"
                                                    onClick={() => { setSelected(new Set([m.initials])); startComposer([m]); }}
                                                    className="flex-1 min-w-0 flex items-center gap-2.5 text-left rounded-lg px-1 py-0.5 focus-visible:ring-2 focus-visible:ring-indigo-500"
                                                    aria-label={`Message ${m.name}`}
                                                >
                                                    <span className={`flex items-center justify-center h-8 w-8 rounded-full text-[11px] font-bold ring-2 ring-white shadow-sm flex-shrink-0 ${m.avatarClass}`}>
                                                        {m.initials}
                                                    </span>
                                                    <span className="flex-1 min-w-0">
                                                        <span className="block text-[13px] font-semibold text-slate-900 truncate">{m.name}</span>
                                                        <span className="block text-[11px] text-slate-500 truncate">{m.role}</span>
                                                    </span>
                                                </Button>
                                                <Button
                                                    variant="bare"
                                                    onClick={() => { setSelected(new Set([m.initials])); startComposer([m]); }}
                                                    aria-label={`Send direct message to ${m.name}`}
                                                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors"
                                                >
                                                    <SendIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                                    DM
                                                </Button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                            {/* The selection bar — one pick DMs, two or
                                more open the group composer. */}
                            <div className="border-t border-slate-100 p-2.5">
                                <Button
                                    variant="bare"
                                    disabled={selectedMembers.length === 0}
                                    onClick={() => startComposer(selectedMembers)}
                                    className={`w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                                        selectedMembers.length === 0
                                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                            : 'bg-[#1E3A8A] hover:bg-[#1E40AF] text-white'
                                    }`}
                                >
                                    {selectedMembers.length <= 1 ? (
                                        <><UserCircleIcon className="h-4 w-4" aria-hidden="true" />{selectedMembers.length === 1 ? `Message ${selectedMembers[0].name.split(' ')[0]}` : 'Pick a teammate to message'}</>
                                    ) : (
                                        <><ChatAltIcon className="h-4 w-4" aria-hidden="true" />Message {selectedMembers.length} teammates — group</>
                                    )}
                                </Button>
                            </div>
                        </>
                    )}

                    {view.kind === 'composer' && (
                        <ComposerView
                            recipients={view.recipients}
                            onBack={() => setView({ kind: 'roster' })}
                            onSent={(recipients, groupName, body) => setView({ kind: 'sent', recipients, groupName, body })}
                        />
                    )}

                    {view.kind === 'sent' && (
                        <SentView recipients={view.recipients} groupName={view.groupName} body={view.body} onSignup={onSignup} onAgain={() => { setSelected(new Set()); setView({ kind: 'roster' }); }} />
                    )}
                </div>,
                document.body
            )}
        </>
    );
};

/** The composer — a DM when one recipient, a named group when more.
 * The group name prefills from initials ("AO, TA +2") like the app's
 * own quick-group flow; everything is editable before send. */
const ComposerView: React.FC<{
    recipients: CollabTeammate[];
    onBack: () => void;
    onSent: (recipients: CollabTeammate[], groupName: string | undefined, body: string) => void;
}> = ({ recipients, onBack, onSent }) => {
    const isGroup = recipients.length > 1;
    const defaultName = isGroup
        ? recipients.length <= 2
            ? recipients.map((r) => r.initials).join(', ')
            : `${recipients.slice(0, 2).map((r) => r.initials).join(', ')} +${recipients.length - 2}`
        : undefined;
    const [groupName, setGroupName] = useState(defaultName ?? '');
    const [body, setBody] = useState('');
    const canSend = body.trim().length > 0 && (!isGroup || groupName.trim().length > 0);

    return (
        <div className="p-4 text-left">
            <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-sm font-semibold text-slate-900">{isGroup ? 'New group message' : 'Direct message'}</p>
                <DemoChip />
            </div>
            {/* To: the avatars of everyone addressed. */}
            <div className="flex items-center gap-2 mb-3.5 flex-wrap">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex-shrink-0">To</span>
                {recipients.map((r) => (
                    <span key={r.initials} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 pl-0.5 pr-2.5 py-0.5">
                        <span className={`flex items-center justify-center h-5 w-5 rounded-full text-[9px] font-bold ${r.avatarClass}`}>{r.initials}</span>
                        <span className="text-[11px] font-semibold text-slate-700">{r.name.split(' ')[0]}</span>
                    </span>
                ))}
            </div>
            {isGroup && (
                <label className="block mb-3">
                    <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Group name</span>
                    <input
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="hearing-prep"
                        autoFocus
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </label>
            )}
            <label className="block mb-3.5">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Message</span>
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={3}
                    placeholder={isGroup ? 'Round everyone up in one thread…' : `Say hi to ${recipients[0].name.split(' ')[0]}…`}
                    autoFocus={!isGroup}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                />
            </label>
            <div className="flex items-center justify-between gap-2">
                <Button variant="bare" onClick={onBack} className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors">
                    Back
                </Button>
                <Button
                    variant="bare"
                    disabled={!canSend}
                    onClick={() => canSend && onSent(recipients, isGroup ? groupName.trim() : undefined, body.trim())}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                        canSend ? 'bg-[#1E3A8A] hover:bg-[#1E40AF] text-white' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                >
                    <SendIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    Send
                </Button>
            </div>
        </div>
    );
};

/** The delivered mini-thread — the visitor's message, in the app's own
 * bubble, with the hand-off into the real thing. */
const SentView: React.FC<{
    recipients: CollabTeammate[];
    groupName?: string;
    body: string;
    onSignup?: () => void;
    onAgain: () => void;
}> = ({ recipients, groupName, body, onSignup, onAgain }) => {
    const title = groupName ?? (recipients.length === 1 ? recipients[0].name : recipients.map((r) => r.name.split(' ')[0]).join(', '));
    return (
        <div className="p-4 text-left">
            <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                    <CheckIcon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">Delivered to {title}</p>
                    <p className="text-[11px] text-slate-500">
                        {recipients.length === 1 ? 'A direct thread' : `${recipients.length + 1} people in ${groupName}`}
                    </p>
                </div>
            </div>
            {/* The message, in the app's chat register. */}
            <div className="rounded-xl rounded-tr-sm bg-indigo-600 text-white px-3.5 py-2.5 text-[13px] leading-relaxed mb-3.5 shadow-sm">
                {body}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500 mb-3.5">
                Inside Vega this thread lives in Messages — kept on the matter, with everyone's replies and files in one place.
            </p>
            <div className="flex gap-2">
                {onSignup && (
                    <Button variant="bare" onClick={onSignup} className="px-3.5 py-2 rounded-lg bg-[#1E3A8A] hover:bg-[#1E40AF] text-white text-xs font-semibold transition-colors">
                        Start free
                    </Button>
                )}
                <Button variant="bare" onClick={onAgain} className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold transition-colors">
                    Write another
                </Button>
            </div>
        </div>
    );
};
