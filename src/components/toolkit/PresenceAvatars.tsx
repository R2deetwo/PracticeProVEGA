
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, UserRole } from '../../types';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { getInitials, getUserColor } from '../../utils/colorUtils';
import Tooltip from '../Tooltip';
import { Button } from '../ui';
import { CheckIcon } from '../../constants';

interface PresenceAvatarsProps {
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
    wentOfflineAt: number | null;
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

const OFFLINE_GRACE_MS = 10_000;
const MAX_AVATARS = 4;

/**
 * PresenceAvatars — the header's team-presence stack.
 *
 * R74 (owner direction): "the thing with being able to open to do a drop
 * down and message people directly… that's something that we can
 * implement inside the app. And maybe you can even select multiple
 * people so that you can create a group message." So the stack is now a
 * MESSAGING SURFACE, wired to the real system:
 *
 *   • click any avatar (or roster row) → the New Direct Message form,
 *     pre-addressed to that teammate — send lands in Messages, with the
 *     notification fired server-side;
 *   • tick several teammates in the roster → "Message N teammates"
 *     opens the SAME form in group mode with everyone preselected —
 *     one name, one message, a group channel is born.
 *
 * The quiet stack styling is untouched — it only gained a pointer
 * cursor and a subtle hover ring, because it finally does something.
 */
export const PresenceAvatars: React.FC<PresenceAvatarsProps> = ({ activePeers, currentUser, className = '' }) => {
    const { coreState } = useCoreState();
    const { isOnline: deviceOnline, openModal } = useUI();
    const [tick, setTick] = useState(0);
    const [fadedOut, setFadedOut] = useState<Set<string>>(new Set());
    const [showOverflowList, setShowOverflowList] = useState(false);
    // R74: multi-select for group messages — keyed by member id.
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const overflowRef = useRef<HTMLDivElement>(null);

    // Tick every 2s for grace period logic
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

    const offlineSinceRef = useRef<Map<string, number>>(new Map());

    const displayItems: DisplayItem[] = useMemo(() => {
        const now = Date.now();
        return teamMembers.map(member => {
            const memberId = String(member.id || member._id || '');
            const peerData = peerMap.get(memberId);
            const isOnline = peerData?.isOnline ?? false;
            const lastSeen = peerData?.lastSeen ?? 0;

            if (isOnline) {
                offlineSinceRef.current.delete(memberId);
            } else {
                if (!offlineSinceRef.current.has(memberId) && lastSeen > 0) {
                    offlineSinceRef.current.set(memberId, now);
                }
            }

            const wentOfflineAt = offlineSinceRef.current.get(memberId) || null;

            let state: PresenceState;
            if (isOnline && deviceOnline) {
                state = 'online';
            } else if (lastSeen > 0 && (now - lastSeen) < 60_000) {
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
                wentOfflineAt,
            };
        });
    }, [teamMembers, peerMap, deviceOnline, tick]);

    useEffect(() => {
        const now = Date.now();
        const newFaded = new Set(fadedOut);
        let changed = false;
        for (const item of displayItems) {
            if (item.state === 'offline' && item.wentOfflineAt) {
                if (now - item.wentOfflineAt > OFFLINE_GRACE_MS) {
                    if (!newFaded.has(item.id)) {
                        newFaded.add(item.id);
                        changed = true;
                    }
                }
            } else {
                if (newFaded.has(item.id)) {
                    newFaded.delete(item.id);
                    changed = true;
                }
            }
        }
        if (changed) setFadedOut(newFaded);
    }, [displayItems, tick, fadedOut]);

    // Sort: online first, then inactive, then offline
    const visibleItems = displayItems
        .filter(item => !fadedOut.has(item.id))
        .sort((a, b) => {
            const order = { online: 0, inactive: 1, offline: 2 };
            return order[a.state] - order[b.state];
        });

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

    if (teamMembers.length === 0 || visibleItems.length === 0) return null;

    const visibleList = visibleItems.slice(0, MAX_AVATARS);
    const overflowItems = visibleItems.slice(MAX_AVATARS);
    const overflowCount = overflowItems.length;
    const selectedCount = selected.size;

    return (
        <div className={`flex items-center -space-x-2 ${className}`}>
            {visibleList.map((item, index) => {
                const user = getUser(item.id);
                if (!user) return null;

                const showOnline = item.state === 'online';
                const showInactive = item.state === 'inactive';
                const isFading = item.state === 'offline' && item.wentOfflineAt &&
                    (Date.now() - item.wentOfflineAt > OFFLINE_GRACE_MS * 0.5);

                const statusText = showOnline
                    ? '(Active now)'
                    : item.lastSeen > 0
                        ? `(Last seen ${formatLastSeen(item.lastSeen)})`
                        : '(Offline)';
                const tooltipText = `${user.name} ${statusText} — click to message`;

                const zIndex = 100 - index;

                return (
                    <Tooltip key={item.id} text={tooltipText}>
                        <Button
                            variant="bare"
                            onClick={() => startDm(item.id)}
                            aria-label={`Message ${user.name}`}
                            title={`Message ${user.name}`}
                            className={`
                                relative w-8 h-8 rounded-full border-2 border-white dark:border-zinc-800
                                flex items-center justify-center text-white font-bold text-xs
                                transition-all duration-700 ease-in-out
                                ${getUserColor(user.name)}
                                ${showOnline ? 'ring-2 ring-green-500 opacity-100' : ''}
                                ${showInactive ? 'ring-2 ring-amber-400 opacity-70' : ''}
                                ${item.state === 'offline' ? 'opacity-40 grayscale filter ring-0' : ''}
                                ${isFading ? 'scale-75 opacity-0' : ''}
                                cursor-pointer hover:scale-110 hover:z-[110] active:scale-95
                            `}
                            style={{ zIndex, transition: 'all 0.7s ease-in-out' }}
                        >
                            {getInitials(user.name)}
                            {showOnline && (
                                <span
                                    className="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full ring-2 ring-white dark:ring-zinc-800 bg-green-500 z-20"
                                    style={{ transform: 'translate(25%, 25%)' }}
                                />
                            )}
                            {showInactive && (
                                <span
                                    className="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full ring-2 ring-white dark:ring-zinc-800 bg-amber-400 z-20"
                                    style={{ transform: 'translate(25%, 25%)' }}
                                />
                            )}
                            {item.state === 'offline' && !isFading && item.lastSeen > 0 && (
                                <span
                                    className="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full ring-2 ring-white dark:ring-zinc-800 bg-slate-400 z-20"
                                    style={{ transform: 'translate(25%, 25%)' }}
                                />
                            )}
                        </Button>
                    </Tooltip>
                );
            })}
            {overflowCount > 0 && (
                <div className="relative" ref={overflowRef}>
                    <button
                        onClick={() => setShowOverflowList(!showOverflowList)}
                        className="relative w-8 h-8 rounded-full border-2 border-white dark:border-zinc-800 bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-slate-600 dark:text-zinc-300 font-bold text-2xs z-10 cursor-pointer hover:bg-slate-300 dark:hover:bg-zinc-600 transition-colors"
                        aria-label={`Show ${overflowCount} more team members`}
                        aria-expanded={showOverflowList}
                    >
                        +{overflowCount}
                    </button>
                    {showOverflowList && (
                        <div className="absolute right-0 top-full mt-2 w-72 max-h-96 overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-800 rounded-lg shadow-2xl border border-slate-200 dark:border-zinc-700 z-[100] animate-fade-in-up">
                            <div className="p-3 border-b border-slate-100 dark:border-zinc-700">
                                <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">Team Members ({visibleItems.length})</p>
                                <p className="text-2xs text-slate-400">
                                    {visibleItems.filter(i => i.state === 'online').length} online · {' '}
                                    {visibleItems.filter(i => i.state !== 'online').length} offline
                                </p>
                                <p className="text-2xs text-slate-400 mt-1">
                                    Click a teammate to message them — or tick a few to start a group.
                                </p>
                            </div>
                            <div className="divide-y divide-slate-50 dark:divide-zinc-700/50">
                                {visibleItems.map((item) => {
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
