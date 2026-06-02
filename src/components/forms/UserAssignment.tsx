
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, AppMode, UserRole } from '../../types';
import { getInitials, getUserColor } from '../../utils/colorUtils';
import { PlusIcon } from '../../constants';

interface UserAssignmentProps {
    allUsers: User[];
    assignedUserIds: Set<string>;
    onToggle: (userId: string) => void;
    appMode: AppMode;
}

export const UserAssignment: React.FC<UserAssignmentProps> = ({ allUsers, assignedUserIds, onToggle, appMode }) => {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const assignableUsers = (allUsers || []).filter(u => 
        u.role === UserRole.Lawyer || 
        u.role === UserRole.Paralegal || 
        u.role === UserRole.Admin || 
        u.role === UserRole.Pending ||
        assignedUserIds.has(u.id)
    );
    const selectedUsers = useMemo(() => 
        assignableUsers.filter(u => assignedUserIds.has(u.id)), 
        [assignableUsers, assignedUserIds]
    );

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node) && buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggleOpen = () => {
        const newState = !isOpen;
        setIsOpen(newState);
        
        if (newState) {
            // Wait for render then scroll into view smoothly
            setTimeout(() => {
                if (containerRef.current) {
                    containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 100);
        }
    };

    if (appMode === 'solo') return null;

    return (
        <div ref={containerRef} className="pb-8"> {/* Added padding bottom to ensure space for dropdown */}
            <label className="block text-sm font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-2">Assigned Team</label>
            <div ref={buttonRef} className="relative flex items-center gap-2 flex-wrap p-2 border border-slate-300 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-800/50 rounded-lg min-h-[42px]">
                {selectedUsers.map(user => (
                    <div key={user.id} className="flex items-center gap-2 bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded-full px-2 py-1 text-sm shadow-sm">
                        <div className={`h-5 w-5 rounded-full flex items-center justify-center text-white font-bold text-[9px] ${getUserColor(user.name)}`}>
                            {getInitials(user.name)}
                        </div>
                        <span className="font-medium text-slate-700 dark:text-zinc-200">{user.name}</span>
                        <button type="button" onClick={() => onToggle(user.id)} className="text-slate-400 hover:text-red-500 transition-colors">&times;</button>
                    </div>
                ))}
                 <button 
                    type="button" 
                    onClick={handleToggleOpen} 
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-primary-600 bg-primary-50 dark:bg-primary-900/20 rounded-full hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors border border-primary-200 dark:border-primary-800"
                >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Assign
                </button>

                {isOpen && (
                    <div ref={popoverRef} className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-600 rounded-xl shadow-2xl p-2 z-50 animate-fade-in-up">
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            {assignableUsers.map(user => (
                                <label key={user.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 cursor-pointer transition-colors">
                                    <input autoComplete="off" data-lpignore="true" 
                                        type="checkbox"
                                        checked={assignedUserIds.has(user.id)}
                                        onChange={() => onToggle(user.id)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                    />
                                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${getUserColor(user.name)}`}>{getInitials(user.name)}</div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-slate-800 dark:text-white">{user.name}</span>
                                        <span className="text-[10px] text-slate-500 dark:text-zinc-400">{user.role}</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
