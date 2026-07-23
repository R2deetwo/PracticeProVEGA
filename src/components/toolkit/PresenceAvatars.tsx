
import React, { useEffect, useState, useRef } from 'react';
import { User } from '../../types';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { getInitials, getUserColor } from '../../utils/colorUtils';
import Tooltip from '../Tooltip';

interface PresenceAvatarsProps {
    activePeers: string[];
    currentUser: User | null;
    className?: string;
}

export const PresenceAvatars: React.FC<PresenceAvatarsProps> = ({ activePeers, currentUser, className = '' }) => {
    const { coreState, isDataLoaded } = useCoreState();
    const { isOnline: deviceOnline } = useUI();
    const [displayList, setDisplayList] = useState<{ id: string, isOnline: boolean, lastSeen: number }[]>([]);

    const OFFLINE_TIMEOUT = 10 * 1000;

    // Build the list of team members to show. We ALWAYS show team members
    // (Admins, Lawyers, Paralegals, Managers) — not just those currently
    // online. This way the moniker is always visible in the header, and
    // online members get a green ring while offline members are greyed.
    // Portal users (Clients/Tenants) are excluded — they don't belong in
    // the team presence strip.
    const teamMembers = (coreState.users || []).filter((u: any) => {
        if (!u) return false;
        // Exclude the current user
        if (u.id === currentUser?.id || u._id === currentUser?.id ||
            String(u._id || '') === String(currentUser?._id || '')) return false;
        // Only show team roles (not portal users)
        const role = u.role;
        if (role === 'Client' || role === 'Tenant' || role === 'Pending' || role === 'ExternalCounsel') return false;
        return true;
    });

    useEffect(() => {
        const now = Date.now();
        const current = activePeers || [];

        setDisplayList(prevList => {
            const newList = [...prevList];

            // Add all team members to the display list (not just active peers).
            // This ensures the moniker always shows the team.
            teamMembers.forEach(member => {
                const memberId = member.id || member._id || '';
                if (!memberId) return;
                // Skip the current user
                if (memberId === currentUser?.id || memberId === currentUser?._id ||
                    String(memberId) === String(currentUser?._id || '')) return;

                const isOnline = current.includes(memberId) ||
                                 current.includes(String(memberId)) ||
                                 current.some((pid: string) => String(pid) === String(memberId));

                const existingIndex = newList.findIndex(item => item.id === memberId);
                if (existingIndex >= 0) {
                    newList[existingIndex].isOnline = isOnline;
                    if (isOnline) newList[existingIndex].lastSeen = now;
                } else {
                    newList.push({ id: memberId, isOnline, lastSeen: now });
                }
            });

            // Mark items not in activePeers as offline
            newList.forEach(item => {
                const stillOnline = current.includes(item.id) ||
                                    current.includes(String(item.id)) ||
                                    current.some((pid: string) => String(pid) === String(item.id));
                if (!stillOnline) {
                    item.isOnline = false;
                }
            });

            // Keep all team members in the list — online members show green,
            // offline members show greyed. We don't remove offline members
            // because the moniker should always show the team.
            return newList;
        });

    }, [activePeers, currentUser?.id, currentUser?._id, teamMembers]);

    useEffect(() => {
        // No cleanup interval needed — team members stay visible.
        // Online status is updated by the activePeers effect above.
    }, []);

    const getUser = (id: string) => coreState.users.find(u => u.id === id || u._id === id || String(u._id) === String(id));

    // Show the team members strip. If there are no team members at all
    // (e.g. solo practice), don't render anything.
    if (teamMembers.length === 0 && displayList.length === 0) return null;

    // Limit to 5 avatars to avoid overflow. Show "+N" for the rest.
    const MAX_AVATARS = 5;
    const visibleList = displayList.slice(0, MAX_AVATARS);
    const overflowCount = displayList.length - MAX_AVATARS;

    return (
        <div className={`flex items-center -space-x-2 transition-all duration-500 ${className}`}>
            {visibleList.map(item => {
                const user = getUser(item.id);
                if (!user) return null;

                // TASK: The green dot only shows when BOTH:
                // 1. The peer is marked online in presence data (item.isOnline)
                // 2. The DEVICE has a network connection (deviceOnline)
                // If the device goes offline, ALL green dots turn grey —
                // the user immediately knows they've lost connection.
                const showOnline = item.isOnline && deviceOnline;

                return (
                    <Tooltip key={item.id} text={`${user.name} ${showOnline ? '(Online)' : deviceOnline ? '(Away)' : '(Offline)'}`}>
                        <div
                            className={`
                                relative w-8 h-8 rounded-full border-2 border-white dark:border-zinc-800
                                flex items-center justify-center text-white font-bold text-xs
                                transition-all duration-500
                                ${getUserColor(user.name)}
                                ${showOnline ? 'ring-2 ring-green-500' : 'opacity-60 grayscale filter ring-0'}
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
                            {!showOnline && item.isOnline && (
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
