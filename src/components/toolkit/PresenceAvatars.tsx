
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

    useEffect(() => {
        const now = Date.now();
        const current = activePeers;

        setDisplayList(prevList => {
            const newList = [...prevList];

            current.forEach(peerId => {
                // Skip the current user — don't show their own presence avatar.
                // Check both id and _id formats to be safe.
                if (peerId === currentUser?.id || peerId === currentUser?._id || String(peerId) === String(currentUser?._id)) return;
                
                const existingIndex = newList.findIndex(item => item.id === peerId);
                if (existingIndex >= 0) {
                    newList[existingIndex].isOnline = true;
                    newList[existingIndex].lastSeen = now;
                } else {
                    newList.push({ id: peerId, isOnline: true, lastSeen: now });
                }
            });

            newList.forEach(item => {
                if (!current.includes(item.id)) {
                    item.isOnline = false;
                }
            });

            return newList.filter(item => {
                if (item.isOnline) return true;
                return (now - item.lastSeen) < OFFLINE_TIMEOUT;
            });
        });

    }, [activePeers, currentUser?.id]);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setDisplayList(prev => prev.filter(item => item.isOnline || (now - item.lastSeen) < OFFLINE_TIMEOUT));
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    const getUser = (id: string) => coreState.users.find(u => u.id === id || u._id === id || String(u._id) === String(id));

    if (displayList.length === 0) return null;

    return (
        <div className={`flex items-center -space-x-2 transition-all duration-500 ${className}`}>
            {displayList.map(item => {
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
        </div>
    );
};
