
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User } from '../../types';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { getInitials, getUserColor } from '../../utils/colorUtils';
import Tooltip from '../Tooltip';

interface PresenceAvatarsProps {
    activePeers: Array<{ userId: string; updatedAt: number; isOnline: boolean }>;
    currentUser: User | null;
    className?: string;
}

type PresenceState = 'online' | 'inactive' | 'offline';

interface DisplayItem {
    id: string;
    name: string;
    isOnline: boolean;
    lastSeen: number;
    state: PresenceState;
    // Timestamp when the user went offline (for 10s grace period)
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

// Offline grace period in ms — after this, the avatar fades out and unmounts
const OFFLINE_GRACE_MS = 10_000;

export const PresenceAvatars: React.FC<PresenceAvatarsProps> = ({ activePeers, currentUser, className = '' }) => {
    const { coreState } = useCoreState();
    const { isOnline: deviceOnline } = useUI();
    const [tick, setTick] = useState(0); // forces re-render every 2s for grace period logic
    const [fadedOut, setFadedOut] = useState<Set<string>>(new Set()); // IDs that have faded out

    // Tick every 2s to re-evaluate grace periods and fade-outs
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 2000);
        return () => clearInterval(interval);
    }, []);

    // Build the list of team members
    const teamMembers = useMemo(() => (coreState.users || []).filter((u: any) => {
        if (!u) return false;
        if (u.id === currentUser?.id || u._id === currentUser?.id ||
            String(u._id || '') === String(currentUser?._id || '')) return false;
        const role = u.role;
        if (role === 'Client' || role === 'Tenant' || role === 'Pending' || role === 'ExternalCounsel') return false;
        return true;
    }), [coreState.users, currentUser?.id, currentUser?._id]);

    // Build peer map from activePeers data
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

    // Build display items with presence state + grace period tracking
    // We use a ref to track when users went offline (persists across renders)
    const offlineSinceRef = useRef<Map<string, number>>(new Map());

    const displayItems: DisplayItem[] = useMemo(() => {
        const now = Date.now();
        return teamMembers.map(member => {
            const memberId = String(member.id || member._id || '');
            const peerData = peerMap.get(memberId);
            const isOnline = peerData?.isOnline ?? false;
            const lastSeen = peerData?.lastSeen ?? 0;

            // Track when the user went offline
            if (isOnline) {
                offlineSinceRef.current.delete(memberId);
            } else {
                if (!offlineSinceRef.current.has(memberId) && lastSeen > 0) {
                    offlineSinceRef.current.set(memberId, now);
                }
            }

            const wentOfflineAt = offlineSinceRef.current.get(memberId) || null;

            // Determine presence state
            let state: PresenceState;
            if (isOnline && deviceOnline) {
                state = 'online';
            } else if (lastSeen > 0 && (now - lastSeen) < 60_000) {
                state = 'inactive'; // heartbeat within 60s but isOnline=false (transition)
            } else {
                state = 'offline';
            }

            return {
                id: memberId,
                name: member.name || 'User',
                isOnline,
                lastSeen,
                state,
                wentOfflineAt,
            };
        });
    }, [teamMembers, peerMap, deviceOnline, tick]); // tick forces re-eval

    // Handle fade-out: if a user has been offline for >10s, add to fadedOut set
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
                // User came back online — remove from faded set
                if (newFaded.has(item.id)) {
                    newFaded.delete(item.id);
                    changed = true;
                }
            }
        }
        if (changed) setFadedOut(newFaded);
    }, [displayItems, tick, fadedOut]);

    // Filter out faded-out items, then sort: online first, then inactive, then offline
    const visibleItems = displayItems
        .filter(item => !fadedOut.has(item.id))
        .sort((a, b) => {
            const order = { online: 0, inactive: 1, offline: 2 };
            return order[a.state] - order[b.state];
        });

    if (teamMembers.length === 0 || visibleItems.length === 0) return null;

    const MAX_AVATARS = 5;
    const visibleList = visibleItems.slice(0, MAX_AVATARS);
    const overflowCount = visibleItems.length - MAX_AVATARS;

    return (
        <div className={`flex items-center -space-x-2 ${className}`}>
            {visibleList.map((item, index) => {
                const user = getUser(item.id);
                if (!user) return null;

                const showOnline = item.state === 'online';
                const showInactive = item.state === 'inactive';
                const isFading = item.state === 'offline' && item.wentOfflineAt &&
                    (Date.now() - item.wentOfflineAt > OFFLINE_GRACE_MS * 0.5); // start fading at 5s

                // Tooltip text
                const statusText = showOnline
                    ? '(Active now)'
                    : item.lastSeen > 0
                        ? `(Last seen ${formatLastSeen(item.lastSeen)})`
                        : '(Offline)';
                const tooltipText = `${user.name} ${statusText}`;

                // Z-index: online = highest, inactive = medium, offline = lowest
                // Reversed because the stack overlaps left-to-right (first = front)
                const zIndex = 100 - index;

                return (
                    <Tooltip key={item.id} text={tooltipText}>
                        <div
                            className={`
                                relative w-8 h-8 rounded-full border-2 border-white dark:border-zinc-800
                                flex items-center justify-center text-white font-bold text-xs
                                transition-all duration-700 ease-in-out
                                ${getUserColor(user.name)}
                                ${showOnline ? 'ring-2 ring-green-500 opacity-100' : ''}
                                ${showInactive ? 'ring-2 ring-amber-400 opacity-70' : ''}
                                ${item.state === 'offline' ? 'opacity-40 grayscale filter ring-0' : ''}
                                ${isFading ? 'scale-75 opacity-0' : ''}
                                cursor-default
                            `}
                            style={{ zIndex, transition: 'all 0.7s ease-in-out' }}
                        >
                            {getInitials(user.name)}
                            {/* Status dot */}
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
                        </div>
                    </Tooltip>
                );
            })}
            {overflowCount > 0 && (
                <Tooltip text={`${overflowCount} more team member${overflowCount > 1 ? 's' : ''}`}>
                    <div className="relative w-8 h-8 rounded-full border-2 border-white dark:border-zinc-800 bg-slate-200 dark:bg-zinc-700 flex items-center justify-center text-slate-600 dark:text-zinc-300 font-bold text-2xs z-10 cursor-default">
                        +{overflowCount}
                    </div>
                </Tooltip>
            )}
        </div>
    );
};
