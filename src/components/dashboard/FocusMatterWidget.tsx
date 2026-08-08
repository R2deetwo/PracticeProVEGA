
import React from 'react';
import { Matter, FirmActivity, User, View, Contact, ModalType } from '../../types';
import { timeAgo } from '../../utils/colorUtils';
import { sanitize } from '../../utils/sanitization';
import { MattersIcon } from '../../constants';
import { Skeleton } from '../toolkit/Skeleton';

interface RecentMattersWidgetProps {
    matters: Matter[];
    contacts: Contact[];
    firmActivity: FirmActivity[];
    users: User[];
    currentUser: User;
    onNavigateToDetail: (view: View, id: string | null, context?: any) => void;
    openModal: (modalType: ModalType, id: string | null, context?: any) => void;
    isLoading?: boolean;
}

const RecentMattersWidget: React.FC<RecentMattersWidgetProps> = ({ matters, contacts, firmActivity, users, currentUser, onNavigateToDetail, openModal, isLoading = false }) => {
    const categories = ['Recent', 'Review', 'Stale'] as const;
    const [activeCategory, setActiveCategory] = React.useState<typeof categories[number]>(() => {
        return (localStorage.getItem(`recent_matters_cat_${currentUser.id}`) as any) || 'Recent';
    });

    const handleNextCategory = () => {
        const nextIndex = (categories.indexOf(activeCategory) + 1) % categories.length;
        const newCat = categories[nextIndex];
        setActiveCategory(newCat);
        localStorage.setItem(`recent_matters_cat_${currentUser.id}`, newCat);
    };

    const handlePrevCategory = () => {
        const prevIndex = (categories.indexOf(activeCategory) - 1 + categories.length) % categories.length;
        const newCat = categories[prevIndex];
        setActiveCategory(newCat);
        localStorage.setItem(`recent_matters_cat_${currentUser.id}`, newCat);
    };

    const recentMatters = React.useMemo(() => {
        if (isLoading) return [];
        const now = new Date();

        // Initial filter for validity
        const validMatters = (matters || []).filter(m => m.id && m.title && m.clientId);
        
        // Base visibility filter
        const visibleMattersByRole = currentUser.role === 'Admin'
            ? validMatters
            : validMatters.filter(m => (m.assignedUsers || []).includes(currentUser.id));

        // Category specific filter
        let filteredMatters = visibleMattersByRole;

        // PRE-CALCULATE LATEST ACTIVITY FOR ALL MATTERS TO IMPROVE FILTERING
        const latestActivityMap = new Map<string, Date>();
        visibleMattersByRole.forEach(m => {
            let latest = new Date(m.stageLastUpdated || m.createdAt);
            // Check for more recent activity in the logs
            const activities = (firmActivity || []).filter(a => a.matterId === m.id || (a.targetType === 'Matter' && a.targetId === m.id));
            activities.forEach(a => {
                const ts = new Date(a.timestamp);
                if (ts > latest) latest = ts;
            });
            latestActivityMap.set(m.id, latest);
        });

        if (activeCategory === 'Recent') {
            filteredMatters = visibleMattersByRole.filter(m => m.status === 'Active');
        } else if (activeCategory === 'Review') {
            filteredMatters = visibleMattersByRole.filter(m => 
                m.status === 'Active' && 
                ((m.stage || '').toLowerCase().includes('review') || (m.reviewReminder && !m.reviewReminder.dismissed))
            );
        } else if (activeCategory === 'Stale') {
            filteredMatters = visibleMattersByRole.filter(m => {
                const lastTouch = latestActivityMap.get(m.id) || new Date(m.stageLastUpdated || m.createdAt);
                const daysDiff = (now.getTime() - lastTouch.getTime()) / (1000 * 3600 * 24);
                return m.status === 'Active' && daysDiff > 21;
            });
        }

        const matterRecencyMap = new Map<string, { matter: Matter, lastActivityTimestamp: string, activities: FirmActivity[] }>();

        filteredMatters.forEach(matter => {
            matterRecencyMap.set(matter.id, {
                matter,
                lastActivityTimestamp: matter.stageLastUpdated || matter.createdAt || now.toISOString(),
                activities: []
            });
        });

        (firmActivity || []).forEach(activity => {
            const matterId = activity.matterId || (activity.targetType === 'Matter' ? activity.targetId : null);
            if (matterId && matterRecencyMap.has(matterId)) {
                const entry = matterRecencyMap.get(matterId)!;
                entry.activities.push(activity);
                if (new Date(activity.timestamp) > new Date(entry.lastActivityTimestamp)) {
                    entry.lastActivityTimestamp = activity.timestamp;
                }
            }
        });

        const sortedMatters = Array.from(matterRecencyMap.values()).sort((a, b) =>
            new Date(b.lastActivityTimestamp).getTime() - new Date(a.lastActivityTimestamp).getTime()
        );

        return sortedMatters.slice(0, 5).map(entry => { // Increased to 5
            return {
                matter: entry.matter,
                // Only showing last activity timestamp for compactness
                lastUpdate: entry.lastActivityTimestamp
            };
        });

    }, [firmActivity, matters, currentUser, isLoading, activeCategory]);

    const handleMatterClick = (e: React.MouseEvent, matterId: string) => {
        e.stopPropagation();
        onNavigateToDetail('matterDetail', matterId);
    };

    return (
        <div className="card-premium flex flex-col h-full overflow-hidden halo-hover transition-all duration-300">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 border-b border-slate-100 dark:border-zinc-800/50 bg-slate-50/30 dark:bg-zinc-900/30 gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                   <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5 flex-shrink-0">
                        <button 
                            onClick={handlePrevCategory}
                            className="active-press touch-target p-1 rounded-md text-slate-400 hover:text-primary-600 transition-all"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button 
                            onClick={handleNextCategory}
                            className="active-press touch-target p-1 rounded-md text-slate-400 hover:text-primary-600 transition-all"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                        </button>
                   </div>
                    <div className="group flex items-center gap-1.5 min-w-0">
                       {activeCategory === 'Stale' ? (
                           <button 
                               onClick={() => activeCategory === 'Stale' && onNavigateToDetail('reporting', null, { activeMainTab: 'dashboard', activeDashboardTab: 'bi', scrollTo: 'stale-matters-section', highlight: true })}
                               className="active-press group flex items-center gap-2 px-2 sm:px-3 py-1 bg-white/50 dark:bg-zinc-800/50 backdrop-blur-sm rounded-full border border-slate-200 dark:border-zinc-700/50 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-200 transition-all"
                           >
                               <h3 className="text-2xs sm:text-xs font-black uppercase tracking-widest text-primary-600 dark:text-primary-400 transition-colors truncate">
                                   {activeCategory} Matters
                               </h3>
                               <div className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse flex-shrink-0" />
                           </button>
                       ) : (
                           <h3 
                            className="text-2xs sm:text-xs font-black uppercase tracking-widest transition-colors text-slate-500 dark:text-zinc-400 truncate"
                           >
                               {activeCategory} Matters
                           </h3>
                       )}
                   </div>
                </div>
                <button onClick={() => onNavigateToDetail('matters', null)} className="active-press touch-target text-2xs font-bold text-slate-400 hover:text-primary-600 transition-colors uppercase tracking-widest h-fit flex-shrink-0 px-1">All</button>
            </div>
            <div className="flex-grow overflow-y-auto relative min-h-0">
                {isLoading ? (
                    <div className="p-4 space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex justify-between items-center border-b border-slate-50 dark:border-zinc-700/50 pb-2">
                                <div className="space-y-2">
                                    <Skeleton width={120} height={16} />
                                    <Skeleton width={80} height={12} />
                                </div>
                                <div className="space-y-1 flex flex-col items-end">
                                    <Skeleton width={60} height={20} variant="text" />
                                    <Skeleton width={40} height={10} />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : recentMatters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-8">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-700 flex items-center justify-center mb-2">
                            <MattersIcon className="h-5 w-5 text-slate-400" />
                        </div>
                        <h3 className="text-xs font-medium text-slate-500 dark:text-zinc-400">No Active Matters</h3>
                        <button onClick={() => openModal('newMatter', null)} className="mt-2 px-3 py-1 bg-primary-600 text-white rounded-md font-semibold hover:bg-primary-700 text-xs transition-colors">
                            + Create
                        </button>
                    </div>
                ) : (
                    <div className="animate-fade-in-scale h-full">
                        {recentMatters.map((item) => {
                            const client = contacts.find(c => c.id === item.matter.clientId);
                            return (
                                <div
                                    key={item.matter.id}
                                    onClick={(e) => handleMatterClick(e, item.matter.id)}
                                    className="active-press group flex justify-between items-center hover:bg-slate-50 dark:hover:bg-zinc-700/30 cursor-pointer border-b border-slate-50 dark:border-zinc-700/50 last:border-0 transition-colors px-4 sm:px-4 py-3"
                                >
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <div className="font-semibold text-sm text-slate-800 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 truncate">{item.matter.title}</div>
                                        <p className="text-2xs text-slate-500 font-medium truncate group-hover:text-primary-600/80 transition-colors">
                                            {activeCategory === 'Stale' ? (
                                                <span className="text-amber-600 font-bold">Stale for {Math.floor((new Date().getTime() - new Date(item.lastUpdate).getTime()) / (1000 * 3600 * 24))} days</span>
                                            ) : activeCategory === 'Review' ? (
                                                <span className="text-primary-600 font-bold">Pending Review</span>
                                            ) : (
                                                <span>Last touch {timeAgo(item.lastUpdate)}</span>
                                            )}
                                        </p>
                                        <div className="text-xs text-slate-500 dark:text-zinc-400">{client?.name || 'Unknown Client'}</div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <div className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded text-3xs font-black uppercase tracking-wider text-slate-500">
                                            {item.matter.referenceNumber}
                                        </div>
                                        {activeCategory === 'Review' && item.matter.reviewReminder && (
                                            <div className="text-3xs font-bold text-red-500 uppercase tracking-tighter">
                                                Due {new Date(item.matter.reviewReminder.remindAt).toLocaleDateString('en-GB')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecentMattersWidget;
