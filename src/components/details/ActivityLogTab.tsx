
import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useExecutionState } from '../../contexts/ExecutionContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { getInitials } from '../../utils/colorUtils';
import { sanitize } from '../../utils/sanitization';
import { timeAgo } from '../../utils/colorUtils';

interface ActivityLogTabProps {
    matterId: string;
    hideHeader?: boolean;
}

const ActivityLogTab: React.FC<ActivityLogTabProps> = ({ matterId, hideHeader }) => {
    const { executionState } = useExecutionState();
    const { documentState } = useDocumentState();
    const { coreState, isDataLoaded } = useCoreState();
    const { currentUser, bearerToken } = useAuth();
    // V3 (V-MATTER-12): the DURABLE stage history — every transition ever
    // recorded for this matter, from the append-only table (previously one
    // overwritten stageLastUpdated timestamp stood in for "history").
    const stageHistory = useQuery(
        (api as any).matterLifecycle.getMatterStageHistory,
        currentUser?.email ? { userEmail: currentUser.email, sessionToken: (bearerToken ?? undefined), matterId } : 'skip'
    );
    // Filter logs for this matter or items linked to this matter
    const activities = coreState.firmActivity.filter(a => 
        a.matterId === matterId || 
        (a.targetType === 'Matter' && a.targetId === matterId) ||
        (a.targetType === 'Document' && documentState.documents.find(d => d.id === a.targetId)?.matterId === matterId) ||
        (a.targetType === 'Task' && executionState.tasks.find(t => t.id === a.targetId)?.matterId === matterId)
    ).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (activities.length === 0 && !(Array.isArray(stageHistory) && stageHistory.length > 0) && hideHeader) return null;

    return (
        <div className={`bg-white dark:bg-zinc-800 p-4 ${hideHeader ? 'rounded-none shadow-none border-none' : 'rounded-lg shadow-md border border-black/5 dark:border-white/5'} overflow-hidden`}>
            {!hideHeader && <h4 className="font-bold text-slate-500 text-xs uppercase mb-3 tracking-wider">Activity History</h4>}
            
            {/* Horizontal Timeline Container */}
            <div className="flex gap-4 overflow-x-auto pb-4 pt-2 custom-scrollbar snap-x">
                {activities.map((activity, index) => {
                    const isSystem = activity.userId === 'system' || activity.userName === 'PracticePro';
                    return (
                        <div key={activity.id} className="flex-shrink-0 w-64 snap-start relative">
                            {/* Connector Line */}
                            {index < activities.length - 1 && (
                                <div className="absolute top-4 left-4 right-[-1rem] h-0.5 bg-slate-200 dark:bg-zinc-700 z-0"></div>
                            )}
                            
                            <div className="relative z-10 flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-2xs font-bold shadow-sm border-2 border-white dark:border-zinc-800 ${isSystem ? 'bg-slate-200 text-slate-600' : 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300'}`}>
                                        {isSystem ? 'PP' : getInitials(activity.userName)}
                                    </div>
                                    <span className="text-2xs font-medium text-slate-400 whitespace-nowrap">
                                        {timeAgo(activity.timestamp)}
                                    </span>
                                </div>
                                
                                <div className="bg-slate-50 dark:bg-zinc-700/30 p-3 rounded-lg border border-slate-100 dark:border-zinc-700/50 text-xs">
                                     <p className="font-semibold text-slate-800 dark:text-zinc-200 truncate">{activity.userName}</p>
                                     <p className="text-slate-600 dark:text-zinc-400 mt-0.5 leading-snug line-clamp-2">
                                        {activity.action} <strong className="text-slate-800 dark:text-white font-medium">{activity.targetName}</strong>
                                     </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {activities.length === 0 && (
                    <div className="w-full text-center py-6 text-slate-400 text-xs italic">
                        No activity recorded yet.
                    </div>
                )}
            </div>

            {/* V3 (V-MATTER-12): durable stage history from the append-only table. */}
            {Array.isArray(stageHistory) && stageHistory.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-700/50">
                    <h5 className="font-bold text-slate-400 text-2xs uppercase mb-2 tracking-wider">Stage History</h5>
                    <div className="space-y-1.5">
                        {stageHistory.map((h: any) => (
                            <div key={h.id} className="flex items-center justify-between gap-3 text-xs px-2 py-1.5 rounded-md bg-slate-50 dark:bg-zinc-700/30">
                                <span className="text-slate-700 dark:text-zinc-300 font-medium truncate">
                                    {h.fromStage ? <>{h.fromStage} <span className="text-slate-400">→</span> {h.toStage}</> : <>{h.toStage} <span className="text-slate-400">(opening)</span></>}
                                </span>
                                <span className="text-2xs text-slate-400 whitespace-nowrap">
                                    {h.changedByName || 'System'} · {h.changedAt ? timeAgo(h.changedAt) : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivityLogTab;
