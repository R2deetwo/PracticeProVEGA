
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, UserRole } from '../../types';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { getInitials, getUserColor } from '../../utils/colorUtils';
import Tooltip from '../Tooltip';
import { Button } from '../ui';
import { CheckIcon } from '../../constants';

import { Z_CLASS } from '../../overlays/constants';
export interface PresenceAvatarsProps {
    activePeers: Array<{ userId: string; updatedAt: number; isOnline: boolean }>;
    currentUser: User | null;
    className?: string;
}

type PresenceState = 'online' | 'inactive' | 'offline';

interface DisplayItem {
    id: string;
    name: string;
    role: string;
    isOnline: boolean;
    lastSeen: number;
    state: PresenceState;
}

function formatLastSeen(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(ts).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
}

/**
 * PresenceAvatars — the header's team-presence strip, reworked for the
 * Android/mobile header (owner brief 2026-11-24):
 *
 *   • ACTIVE/ONLINE ONLY — offline members are filtered out of the strip so
 *     they never clutter the narrow mobile header (they remain in the +N
 *     roster, status-dotted, so anyone can still be messaged).
 *   • ONE moniker + "+N" — a single primary avatar plus a compact counter
 *     for the other active members, instead of a long row of badges.
 *   • No horizontal overflow — the wrapper is min-w-0 + overflow-hidden and
 *     every badge is shrink-0, so the strip can never push controls off-screen.
 *
 * Messaging hand-offs (R74, unchanged):
 *   • tap the moniker → the New Direct Message form pre-addressed to that
 *     teammate;
 *   • tap +N → the roster picker (tick several for a group message).
 */
export const PresenceAvatars: React.FC<PresenceAvatarsProps> = ({ activePeers, currentUser, className = '' }) => {
    const { coreState } = useCoreState();
    const { isOnline: deviceOnline, openModal } = useUI();
    const [tick, setTick] = useState(0);
    const [showOverflowList, setShowOverflowList] = useState(false);
    // R74: multi-select for group messages — keyed by member id.
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const overflowRef = useRef<HTMLDivElement>(null);

    // Tick every 2s so last-seen labels & status dots stay fresh.
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 2000);
        return () => clearInterval(interval);
    }, []);

    // Close overflow dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
                setShowOverflowList(false);
                setSelected(new Set());
            }
        };
        if (showOverflowList) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showOverflowList]);

    // Build the list of team members (exclude self, clients, tenants, pending, external)
    const teamMembers = useMemo(() => (coreState.users || []).filter((u: any) => {
        if (!u) return false;
        if (u.id === currentUser?.id || u._id === currentUser?.id ||
            String(u._id || '') === String(currentUser?._id || '')) return false;
        const role = u.role;
        if (role === 'Client' || role === 'Tenant' || role === 'Pending' || role === 'ExternalCounsel') return false;
        return true;
    }), [coreState.users, currentUser?.id, currentUser?._id]);

    const peerMap = useMemo(() => {
        const map = new Map<string, { isOnline: boolean; lastSeen: number }>();
        if (activePeers && Array.isArray(activePeers)) {
            for (const p of activePeers) {
                if (typeof p === 'string') {
                    map.set(String(p), { isOnline: true, lastSeen: Date.now() });
                } else if (p && typeof p === 'object' && p.userId) {
                    map.set(String(p.userId), { isOnline: !!p.isOnline, lastSeen: p.updatedAt || Date.now() });
                }
            }
        }
        return map;
    }, [activePeers]);

    const getUser = (id: string) => coreState.users.find(u => u.id === id || u._id === id || String(u._id) === String(id));

    const displayItems: DisplayItem[] = useMemo(() => {
        return teamMembers.map(member => {
            const memberId = String(member.id || member._id || '');
            const peerData = peerMap.get(memberId);
            const isOnline = peerData?.isOnline ?? false;
            const lastSeen = peerData?.lastSeen ?? 0;

            let state: PresenceState;
            if (isOnline && deviceOnline) {
                state = 'online';
            } else if (lastSeen > 0 && (Date.now() - lastSeen) < 60_000) {
                state = 'inactive';
            } else {
                state = 'offline';
            }

            return {
                id: memberId,
                name: member.name || 'User',
                role: member.role || 'Team Member',
                isOnline,
                lastSeen,
                state,
            };
        });
    }, [teamMembers, peerMap, deviceOnline, tick]);

    // ── THE STRIP: active/online members only ─────────────────────────────
    // Offline and stale members never render in the header (they'd crowd the
    // narrow Android viewport); the roster keeps them reachable.
    const onlineItems = displayItems
        .filter(item => item.state === 'online')
        .sort((a, b) => a.name.localeCompare(b.name));

    // ── R74: the messaging hand-offs ──────────────────────────────────────
    const startDm = (memberId: string) => {
        setShowOverflowList(false);
        setSelected(new Set());
        openModal('newDirectMessage', null, { recipientId: memberId });
    };

    const startGroup = () => {
        if (selected.size === 0) return;
        openModal('newDirectMessage', null, {
            initialMode: 'group',
            initialMemberIds: Array.from(selected),
        });
        setShowOverflowList(false);
        setSelected(new Set());
    };

    const toggleSelected = (memberId: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(memberId)) next.delete(memberId);
            else next.add(memberId);
            return next;
        });
    };

    if (teamMembers.length === 0 || onlineItems.length === 0) return null;

    const primary = onlineItems[0];
    const primaryUser = getUser(primary.id);
    if (!primaryUser) return null;
    const extraOnlineCount = onlineItems.length - 1; // the "+N" on the chip
    const selectedCount = selected.size;
    // Roster (the +N picker): everyone, active first — so an offline
    // teammate can still be messaged directly.
    const rosterItems = displayItems
        .slice()
        .sort((a, b) => {
            const order = { online: 0, inactive: 1, offline: 2 };
            return order[a.state] - order[b.state] || a.name.localeCompare(b.name);
        });

    return (
        <div className={`flex items-center gap-1.5 min-w-0 overflow-hidden ${className}`}>
            {/* THE ONE moniker — tap to open the DM for that teammate. */}
            <Tooltip text={`${primaryUser.name} (Active now) — click to message`}>
                <Button
                    variant="bare"
                    onClick={() => startDm(primary.id)}
                    aria-label={`Message ${primaryUser.name}`}
                    title={`Message ${primaryUser.name}`}
                    className={`
                        relative shrink-0 w-8 h-8 rounded-full border-2 border-white dark:border-zinc-800
                        flex items-center justify-center text-white font-bold text-xs
                        cursor-pointer hover:scale-110 active:scale-95
                        ${getUserColor(primaryUser.name)}
                        ${Z_CLASS.panelTop}
                    `}
                >
                    {getInitials(primaryUser.name)}
                    <span
                        className="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full ring-2 ring-white dark:ring-zinc-800 bg-green-500 z-20"
                        style={{ transform: 'translate(25%, 25%)' }}
                    />
                </Button>
            </Tooltip>

            {/* "+N" — additional ACTIVE members. Tapping opens the roster
                picker to message anyone directly. */}
            {extraOnlineCount > 0 && (
                <div className="relative shrink-0" ref={overflowRef}>
                    <button
                        onClick={() => setShowOverflowList(!showOverflowList)}
                        className="relative shrink-0 w-8 h-8 rounded-full border-2 border-white dark:border-zinc-800 bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-slate-600 dark:text-zinc-300 font-bold text-2xs z-10 cursor-pointer hover:bg-slate-300 dark:hover:bg-zinc-600 transition-colors"
                        aria-label={`${extraOnlineCount} more active team members — open picker to message someone`}
                        aria-expanded={showOverflowList}
                    >
                        +{extraOnlineCount}
                    </button>
                    {showOverflowList && (
                        <div className={`absolute right-0 top-full mt-2 w-72 max-h-96 overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-800 rounded-lg shadow-2xl border border-slate-200 dark:border-zinc-700 ${Z_CLASS.panelOverlay} animate-fade-in-up`}>
                            <div className="p-3 border-b border-slate-100 dark:border-zinc-700">
                                <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">Team Members ({rosterItems.length})</p>
                                <p className="text-2xs text-slate-400">
                                    {rosterItems.filter(i => i.state === 'online').length} online · {' '}
                                    {rosterItems.filter(i => i.state !== 'online').length} offline
                                </p>
                                <p className="text-2xs text-slate-400 mt-1">
                                    Click a teammate to message them — or tick a few to start a group.
                                </p>
                            </div>
                            <div className="divide-y divide-slate-50 dark:divide-zinc-700/50">
                                {rosterItems.map((item) => {
                                    const user = getUser(item.id);
                                    if (!user) return null;
                                    const isOnline = item.state === 'online';
                                    const isInactive = item.state === 'inactive';
                                    const checked = selected.has(item.id);
                                    return (
                                        <div key={item.id} className="flex items-center gap-2 p-2.5 hover:bg-slate-50 dark:hover:bg-zinc-700/30 transition-colors group/row">
                                            <Button
                                                variant="bare"
                                                onClick={() => toggleSelected(item.id)}
                                                role="checkbox"
                                                aria-checked={checked}
                                                aria-label={`Select ${user.name} for a group message`}
                                                activePress={false}
                                                className="flex-shrink-0 flex h-4 w-4 items-center justify-center rounded border cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-primary-500"
                                                style={{
                                                    borderColor: checked ? 'rgb(79 70 229)' : 'rgb(203 213 225)',
                                                    background: checked ? 'rgb(79 70 229)' : 'transparent',
                                                }}
                                            >
                                                {checked && <CheckIcon className="h-3 w-3 text-white" aria-hidden="true" />}
                                            </Button>
                                            <Button
                                                variant="bare"
                                                onClick={() => startDm(item.id)}
                                                aria-label={`Message ${user.name}`}
                                                className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
                                            >
                                                <div className={`relative w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-2xs flex-shrink-0 ${getUserColor(user.name)}`}>
                                                    {getInitials(user.name)}
                                                    <span className={`absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-zinc-800 ${
                                                        isOnline ? 'bg-green-500' : isInactive ? 'bg-amber-400' : 'bg-slate-400'
                                                    }`} style={{ transform: 'translate(25%, 25%)' }} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">{user.name}</p>
                                                    <p className="text-2xs text-slate-400 truncate">
                                                        {item.role} · {isOnline ? 'Active now' : item.lastSeen > 0 ? `Last seen ${formatLastSeen(item.lastSeen)}` : 'Offline'}
                                                    </p>
                                                </div>
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* R74: the group bar — message everyone ticked in one thread. */}
                            <div className="sticky bottom-0 p-2 border-t border-slate-100 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/95 backdrop-blur-sm">
                                <Button
                                    variant="bare"
                                    onClick={startGroup}
                                    disabled={selectedCount === 0}
                                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                                        selectedCount > 0
                                            ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm'
                                            : 'bg-slate-200 dark:bg-zinc-700 text-slate-400 dark:text-zinc-500 cursor-not-allowed'
                                    }`}
                                >
                                    {selectedCount > 1
                                        ? `Message ${selectedCount} teammates — group`
                                        : selectedCount === 1
                                            ? `Message ${getUser(Array.from(selected)[0])?.name?.split(' ')[0] || 'teammate'}`
                                            : 'Tick teammates to start a group'}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
