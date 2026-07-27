
import React, { useEffect, useState, useRef, useMemo } from 'react';
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

// Format a timestamp as a relative "last seen" string
function formatLastSeen(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
}

export const PresenceAvatars: React.FC<PresenceAvatarsProps> = ({ activePeers, currentUser, className = '' }) => {
    const { coreState } = useCoreState();
    const { isOnline: deviceOnline } = useUI();

    // Build the list of team members to show. We ALWAYS show team members
    // (Admins, Lawyers, Paralegals, Managers) — not just those currently
    // online. Online members get a green ring; inactive members are greyed
    // out with a last-seen tooltip.
    const teamMembers = useMemo(() => (coreState.users || []).filter((u: any) => {
        if (!u) return false;
        if (u.id === currentUser?.id || u._id === currentUser?.id ||
            String(u._id || '') === String(currentUser?._id || '')) return false;
        const role = u.role;
        if (role === 'Client' || role === 'Tenant' || role === 'Pending' || role === 'ExternalCounsel') return false;
        return true;
    }), [coreState.users, currentUser?.id, currentUser?._id]);

    // Build a map of peerId → { isOnline, lastSeen } from the activePeers data
    const peerMap = useMemo(() => {
        const map = new Map<string, { isOnline: boolean; lastSeen: number }>();
        if (activePeers && Array.isArray(activePeers)) {
            for (const p of activePeers) {
                // Handle both old format (string) and new format (object)
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

    if (teamMembers.length === 0) return null;

    const MAX_AVATARS = 5;
    const visibleList = teamMembers.slice(0, MAX_AVATARS);
    const overflowCount = teamMembers.length - MAX_AVATARS;

    return (
        <div className={`flex items-center -space-x-2 transition-all duration-500 ${className}`}>
            {visibleList.map(member => {
                const memberId = String(member.id || member._id || '');
                if (!memberId) return null;
                const user = getUser(memberId);
                if (!user) return null;

                const peerData = peerMap.get(memberId);
                const isOnline = peerData?.isOnline ?? false;
                const lastSeen = peerData?.lastSeen ?? 0;
                const showOnline = isOnline && deviceOnline;

                // Tooltip shows name + status + last seen (if inactive)
                const statusText = showOnline
                    ? '(Active now)'
                    : lastSeen > 0
                        ? `(Last seen ${formatLastSeen(lastSeen)})`
                        : '(Offline)';
                const tooltipText = `${user.name} ${statusText}`;

                return (
                    <Tooltip key={memberId} text={tooltipText}>
                        <div
                            className={`
                                relative w-8 h-8 rounded-full border-2 border-white dark:border-zinc-800
                                flex items-center justify-center text-white font-bold text-xs
                                transition-all duration-500
                                ${getUserColor(user.name)}
                                ${showOnline ? 'ring-2 ring-green-500' : 'opacity-50 grayscale filter ring-0'}
                                z-10 cursor-default
                            `}
                        >
                            {getInitials(user.name)}
                            {showOnline && (
                                <span
                                    className="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full ring-2 ring-white dark:ring-zinc-800 bg-green-500 z-20"
                                    style={{ transform: 'translate(25%, 25%)' }}
                                />
                            )}
                            {!showOnline && lastSeen > 0 && (
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
