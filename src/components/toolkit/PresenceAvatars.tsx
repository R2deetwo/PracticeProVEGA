
import React, { useEffect, useState, useRef } from 'react';
import { User } from '../../types';
import { useCoreState } from '../../contexts/CoreContext';
import { getInitials, getUserColor } from '../../utils/colorUtils';
import Tooltip from '../Tooltip';

interface PresenceAvatarsProps {
    activePeers: string[];
    currentUser: User | null;
    className?: string;
}

export const PresenceAvatars: React.FC<PresenceAvatarsProps> = ({ activePeers, currentUser, className = '' }) => {
    const { coreState, isDataLoaded } = useCoreState();
    const [displayList, setDisplayList] = useState<{ id: string, isOnline: boolean, lastSeen: number }[]>([]);
    
    // Reduced timeout to 10 seconds for more responsive "offline" visual feedback
    const OFFLINE_TIMEOUT = 10 * 1000; 

    useEffect(() => {
        const now = Date.now();
        const current = activePeers;

        setDisplayList(prevList => {
            const newList = [...prevList];

            // 1. Update status for currently online users
            current.forEach(peerId => {
                if (peerId === currentUser?.id) return;
                
                const existingIndex = newList.findIndex(item => item.id === peerId);
                if (existingIndex >= 0) {
                    newList[existingIndex].isOnline = true;
                    newList[existingIndex].lastSeen = now;
                } else {
                    newList.push({ id: peerId, isOnline: true, lastSeen: now });
                }
            });

            // 2. Mark users as offline if they are no longer in activePeers
            newList.forEach(item => {
                if (!current.includes(item.id)) {
                    item.isOnline = false;
                }
            });

            // 3. Remove users who have been offline longer than timeout
            return newList.filter(item => {
                if (item.isOnline) return true;
                return (now - item.lastSeen) < OFFLINE_TIMEOUT;
            });
        });

    }, [activePeers, currentUser?.id]);

    // Cleanup interval to remove stale ghosts even if no presence events fire
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setDisplayList(prev => prev.filter(item => item.isOnline || (now - item.lastSeen) < OFFLINE_TIMEOUT));
        }, 2000); // Check every 2s for snappy removal
        return () => clearInterval(interval);
    }, []);

    const getUser = (id: string) => coreState.users.find(u => u.id === id);

    if (displayList.length === 0) return null;

    return (
        <div className={`flex items-center -space-x-2 transition-all duration-500 ${className}`}>
            {displayList.map(item => {
                const user = getUser(item.id);
                if (!user) return null;

                return (
                    <Tooltip key={item.id} text={`${user.name} ${item.isOnline ? '(Online)' : '(Away)'}`}>
                        <div 
                            className={`
                                relative w-8 h-8 rounded-full border-2 border-white dark:border-zinc-800 
                                flex items-center justify-center text-white font-bold text-xs 
                                transition-all duration-500
                                ${getUserColor(user.name)}
                                ${item.isOnline ? 'ring-2 ring-green-500' : 'opacity-60 grayscale filter ring-0'} 
                                z-10 cursor-default
                            `}
                        >
                            {getInitials(user.name)}
                            {item.isOnline && (
                                <span 
                                    className="absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full ring-2 ring-white dark:ring-zinc-800 bg-green-500 z-20" 
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
