import React from 'react';
import { Matter, FirmActivity, User, View, Contact, ModalType } from '../types';
import { getInitials, getUserColor, timeAgo } from '../utils/colorUtils';
import { sanitize } from '../utils/sanitization';

interface RecentMattersWidgetProps {
    matters: Matter[];
    contacts: Contact[];
    firmActivity: FirmActivity[];
    users: User[];
    currentUser: User;
    onNavigateToDetail: (view: View, id: string | null) => void;
    openModal: (modalType: ModalType, id: string | null, context?: any) => void;
}

const RecentMattersWidget: React.FC<RecentMattersWidgetProps> = ({ matters, contacts, firmActivity, users, currentUser, onNavigateToDetail, openModal }) => {
    
    const recentMatters = React.useMemo(() => {
        const visibleMatters = currentUser.role === 'Admin'
            ? matters.filter(m => m.status === 'Active')
            : matters.filter(m => m.assignedUsers.includes(currentUser.id) && m.status === 'Active');
        
        if (visibleMatters.length === 0) {
            return [];
        }

        // Create a map to hold the most recent timestamp and associated activities for each matter.
        const matterRecencyMap = new Map<string, { matter: Matter, lastActivityTimestamp: string, activities: FirmActivity[] }>();

        // 1. Initialize with all visible matters, using their last update time as a baseline.
        visibleMatters.forEach(matter => {
            matterRecencyMap.set(matter.id, {
                matter,
                lastActivityTimestamp: matter.stageLastUpdated,
                activities: []
            });
        });

        // 2. Enhance with specific, more recent activities from the firm log.
        firmActivity.forEach(activity => {
            const matterId = activity.matterId || (activity.targetType === 'Matter' ? activity.targetId : null);
            if (matterId && matterRecencyMap.has(matterId)) {
                const entry = matterRecencyMap.get(matterId)!;
                // Add activity to the list for potential display
                entry.activities.push(activity);
                // If this activity is more recent than the last known update, it becomes the new sort key.
                if (new Date(activity.timestamp) > new Date(entry.lastActivityTimestamp)) {
                    entry.lastActivityTimestamp = activity.timestamp;
                }
            }
        });

        // 3. Sort all matters by their most recent timestamp (either a specific activity or a general update).
        const sortedMatters = Array.from(matterRecencyMap.values()).sort((a, b) => 
            new Date(b.lastActivityTimestamp).getTime() - new Date(a.lastActivityTimestamp).getTime()
        );

        // 4. Take the top 3 and format them for display.
        return sortedMatters.slice(0, 3).map(entry => {
            // Sort the individual activities for each matter to show the newest first
            entry.activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            return {
                matter: entry.matter,
                // Only show activities if they are not just generic matter updates.
                activitiesToShow: entry.activities.slice(0, 2),
            };
        });

    }, [firmActivity, matters, currentUser]);

    const handleActivityClick = (e: React.MouseEvent, activity: FirmActivity, matterId: string) => {
        e.stopPropagation();
        if (!activity.targetId) {
            onNavigateToDetail('matterDetail', matterId);
            return;
        }

        switch (activity.targetType) {
            case 'Document':
                onNavigateToDetail('documentDetail', activity.targetId);
                break;
            case 'Task':
                openModal('viewTask', activity.targetId);
                break;
            case 'Invoice':
                onNavigateToDetail('invoiceDetail', activity.targetId);
                break;
            case 'Matter':
            default:
                onNavigateToDetail('matterDetail', matterId);
                break;
        }
    };
    
    const handleMatterClick = (e: React.MouseEvent, matterId: string) => {
        e.stopPropagation();
        onNavigateToDetail('matterDetail', matterId);
    };

    return (
        <div className="bg-slate-100 dark:bg-zinc-800 rounded-xl shadow-md p-4 border border-black/5 dark:border-white/5 flex flex-col h-96">
            <div className="flex justify-between items-center mb-2 flex-shrink-0">
                <h3 className="font-bold text-slate-800 dark:text-white">Recent Matters</h3>
                <button onClick={() => onNavigateToDetail('matters', null)} className="text-xs font-semibold text-primary-600 hover:underline">View All</button>
            </div>
             <div className="flex-grow overflow-y-auto space-y-3 pr-1">
                {recentMatters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full">
                         <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-300 dark:text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                         <h3 className="mt-2 text-sm font-medium text-slate-500 dark:text-zinc-400">No Active Matters</h3>
                         <button onClick={() => openModal('newMatter', null)} className="mt-2 px-3 py-1 bg-primary-600 text-white rounded-md font-semibold hover:bg-primary-700 text-xs">
                           + New Matter
                         </button>
                    </div>
                ) : (
                    recentMatters.map(({ matter, activitiesToShow }) => {
                        const client = contacts.find(c => c.id === matter.clientId);
                        return (
                            <div key={matter.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-sm">
                                <h4 onClick={(e) => handleMatterClick(e, matter.id)} className="font-bold text-base text-primary-600 dark:text-primary-400 cursor-pointer truncate">{matter.title}</h4>
                                <p onClick={(e) => handleMatterClick(e, matter.id)} className="text-xs text-gray-500 dark:text-gray-400 mb-2 cursor-pointer">{client?.name || 'Unknown Client'}</p>
                                
                                {activitiesToShow.length > 0 ? (
                                    <ul className="space-y-2 border-l-2 border-gray-200 dark:border-gray-700 pl-3 ml-1">
                                        {activitiesToShow.map(activity => {
                                            const userDisplay = activity.userId === 'system'
                                                ? 'System'
                                                : (activity.userId === currentUser.id ? 'You' : activity.userName);
                                            
                                            let displayText = `${userDisplay} ${activity.action}`.trim();
                                            if (activity.targetName) {
                                                displayText += ` <strong>${activity.targetName}</strong>`;
                                            }

                                            return (
                                                <li key={activity.id} onClick={(e) => handleActivityClick(e, activity, matter.id)} className="relative cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700/50 -ml-1 pl-1 rounded-r-md transition-transform duration-150 hover:translate-x-1">
                                                    <div className="absolute -left-[0.9rem] top-1.5 w-2.5 h-2.5 bg-gray-300 dark:bg-slate-600 rounded-full border-2 border-white dark:border-slate-800"></div>
                                                    <p className="text-xs text-gray-700 dark:text-gray-200" dangerouslySetInnerHTML={{ __html: sanitize(displayText) }} />
                                                    <p className="text-2xs text-gray-500 dark:text-gray-400">{timeAgo(activity.timestamp)}</p>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-gray-600 dark:text-gray-300 italic pl-4">Last updated {timeAgo(matter.stageLastUpdated)}</p>
                                )}
                            </div>
                        )
                    })
                )}
            </div>
        </div>
    );
};

export default RecentMattersWidget;