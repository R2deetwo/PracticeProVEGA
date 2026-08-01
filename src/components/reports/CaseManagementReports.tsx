import React, { useState, useMemo } from 'react';
import { Matter, User } from '../../types';
import StatCard from '../StatCard';
import { timeAgo } from '../../utils/colorUtils';
import { MattersIcon, DocumentsIcon, BellPlusIcon, BellIcon, CheckCircleIcon, TrashIcon } from '../../constants';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useExecutionState } from '../../contexts/ExecutionContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useProduct } from '../../contexts/ProductContext';
import InlineMatterReview from '../InlineMatterReview';

// ─── LOCAL ICONS ─────────────────────────────────────────────────────────────
const TaskAlertIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
        <path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z"/>
        <path d="M12 11v3" strokeWidth="2" />
        <path d="M12 16h.01" strokeWidth="2" />
    </svg>
);
const StaleIcon: React.FC<{className?: string}> = ({className}) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

const UserRemovedIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <line x1="17" y1="11" x2="23" y2="11" />
    </svg>
);

const ShareIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
);

// ─── CHARTS ───────────────────────────────────────────────────────────────────
const DoughnutChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return <div className="flex items-center justify-center h-full text-slate-400">No data</div>;
    let cumulative = 0;
    const gradients = data.map(item => {
        const percentage = (item.value / total) * 100;
        const start = cumulative;
        cumulative += percentage;
        return `${item.color} ${start}% ${cumulative}%`;
    });
    return (
        <div className="flex items-center gap-4">
            <div className="w-32 h-32 rounded-full" style={{ background: `conic-gradient(${gradients.join(', ')})` }}></div>
            <ul className="text-sm space-y-1">
                {data.map(item => (
                    <li key={item.label} className="flex items-center">
                        <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }}></span>
                        <span>{item.label}: <strong>{item.value}</strong></span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

// ─── CASELOAD BAR CHART (ENHANCED) ───────────────────────────────────────────
interface UserBar {
    userId: string;
    name: string;
    value: number;
    isGhost: boolean; // user deleted from DB
}

interface GhostReassignPanelProps {
    ghost: UserBar;
    existingUsers: User[];
    ghostMatters: Matter[];
    onReassign: (assignments: Record<string, string>) => void;
    onClose: () => void;
    isProperty: boolean;
}

const GhostReassignPanel: React.FC<GhostReassignPanelProps> = ({ ghost, existingUsers, ghostMatters, onReassign, onClose, isProperty }) => {
    const [assignments, setAssignments] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        ghostMatters.forEach(m => {
            initial[m.id] = existingUsers.length === 1 ? existingUsers[0].id : '';
        });
        return initial;
    });

    const isComplete = ghostMatters.every(m => assignments[m.id] !== '');

    const handleAssign = (matterId: string, userId: string) => {
        setAssignments(prev => ({ ...prev, [matterId]: userId }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700 w-full max-w-lg mx-4 overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-6 py-4 flex items-start gap-3 shrink-0">
                    <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <UserRemovedIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">Removed User</h3>
                        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                            <span className="font-semibold text-amber-700 dark:text-amber-400">{ghost.name}</span> has been removed from your firm but is still assigned to <strong>{ghost.value}</strong> active {ghost.value === 1 ? (isProperty ? 'record' : 'matter') : (isProperty ? 'records' : 'matters')}.
                        </p>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {existingUsers.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-zinc-400 text-center py-4">No other users exist to reassign matters to. Please add a team member first.</p>
                    ) : (
                        <div>
                            <p className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                                Assign to specific {isProperty ? 'managers' : 'lawyers'}:
                            </p>
                            <div className="space-y-3">
                                {ghostMatters.map(m => (
                                    <div key={m.id} className="p-4 border border-slate-200 dark:border-zinc-700 rounded-xl bg-slate-50 dark:bg-zinc-800/50">
                                        <div className="font-semibold text-sm text-slate-800 dark:text-white mb-2">{m.title}</div>
                                        <select
                                            value={assignments[m.id]}
                                            onChange={(e) => handleAssign(m.id, e.target.value)}
                                            className="w-full text-sm p-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        >
                                            <option value="" disabled>Select a user to reassign...</option>
                                            {existingUsers.map(u => (
                                                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-zinc-700 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">Cancel</button>
                    {existingUsers.length > 0 && (
                        <button
                            onClick={() => onReassign(assignments)}
                            disabled={!isComplete}
                            className="px-5 py-2 bg-primary-600 text-white text-sm font-bold rounded-lg hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                        >
                            <ShareIcon className="w-4 h-4" />
                            {isComplete ? (isProperty ? 'Reassign Records' : 'Reassign Matters') : 'Assign All First'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const CaseloadByUserChart: React.FC<{
    data: UserBar[];
    existingUsers: User[];
    allMatters: Matter[];
    onReassignComplete: () => void;
    isProperty?: boolean;
}> = ({ data, existingUsers, allMatters, onReassignComplete, isProperty }) => {
    const [activeGhost, setActiveGhost] = useState<UserBar | null>(null);
    const { updateItem } = useDataActions();
    const { addToast } = useUI();
    const maxValue = Math.max(...data.map(d => d.value), 1);

    const handleReassign = async (ghost: UserBar, assignments: Record<string, string>) => {
        const ghostMatters = allMatters.filter(m => m.assignedUsers.includes(ghost.userId));
        const updates: Promise<void>[] = [];
        const affectedUsers = new Set<string>();

        ghostMatters.forEach((matter) => {
            const targetId = assignments[matter.id];
            if (!targetId) return; // Should be handled by isComplete, but guard just in case

            const newAssigned = matter.assignedUsers
                .filter(id => id !== ghost.userId)
                .concat(targetId);
            
            affectedUsers.add(targetId);
            updates.push(updateItem('matters', { ...matter, assignedUsers: newAssigned }, matter.title));
        });

        await Promise.all(updates);

        // Notify each receiving user
        affectedUsers.forEach(tid => {
            const targetUser = existingUsers.find(u => u.id === tid);
            if (targetUser) {
                addToast(`Matters from removed user "${ghost.name}" have been reassigned to ${targetUser.name}.`, { type: 'success' });
            }
        });

        setActiveGhost(null);
        onReassignComplete();
    };

    return (
        <>
            <div className="space-y-2">
                {data.map(item => (
                    <div key={item.userId} className="group relative">
                        <div className={`flex items-center gap-2 text-sm ${item.isGhost ? 'opacity-60' : ''}`}>
                            <span className={`w-28 text-right truncate ${item.isGhost ? 'text-amber-500 dark:text-amber-400 line-through' : 'text-slate-500 dark:text-zinc-400'}`}>
                                {item.name}
                            </span>
                            <div className="flex-grow bg-slate-200 dark:bg-zinc-700 rounded-full h-4 relative overflow-hidden">
                                <div
                                    className={`h-4 rounded-full transition-all ${item.isGhost ? 'bg-amber-400 dark:bg-amber-600' : 'bg-blue-500'}`}
                                    style={{ width: `${(item.value / maxValue) * 100}%` }}
                                />
                            </div>
                            <span className={`font-bold w-8 text-left ${item.isGhost ? 'text-amber-500' : ''}`}>{item.value}</span>
                            {item.isGhost && (
                                <button
                                    onClick={() => setActiveGhost(item)}
                                    title="Reassign matters from removed user"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 py-0.5 text-2xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700 rounded-full hover:bg-amber-200 dark:hover:bg-amber-900/50"
                                >
                                    <UserRemovedIcon className="w-3 h-3" />
                                    Removed — Reassign
                                </button>
                            )}
                        </div>
                        {/* Ghost tooltip */}
                        {item.isGhost && (
                            <div className="absolute left-32 -top-8 z-20 hidden group-hover:block bg-zinc-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap pointer-events-none">
                                This user no longer exists. Click to redistribute their matters.
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {activeGhost && (
                <GhostReassignPanel
                    ghost={activeGhost}
                    existingUsers={existingUsers.filter(u => u.id !== activeGhost.userId)}
                    ghostMatters={allMatters.filter(m => m.assignedUsers.includes(activeGhost.userId))}
                    onReassign={(tids) => handleReassign(activeGhost, tids)}
                    onClose={() => setActiveGhost(null)}
                    isProperty={!!isProperty}
                />
            )}
        </>
    );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
interface CaseManagementReportsProps {}

const CaseManagementReports: React.FC<CaseManagementReportsProps> = () => {
    const { appMode } = useAuth();
    const { isProperty } = useProduct();
    const { navigateTo, currentHistoryEntry } = useUI();
    const { matterState } = useMatterState();
    const { executionState } = useExecutionState();
    const { documentState } = useDocumentState();
    const { financeState } = useFinanceState();
    const { coreState } = useCoreState();
    const [refreshKey, setRefreshKey] = useState(0);

    // SCROLL TO STALE SECTION IF REQUESTED
    React.useEffect(() => {
        if (currentHistoryEntry?.context?.scrollTo === 'stale-matters-section') {
            const el = document.getElementById('stale-matters-section');
            if (el) {
                setTimeout(() => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 500);
            }
        }
    }, [currentHistoryEntry?.context?.scrollTo]);

    const reportData = useMemo(() => {
        const { matters, contacts, clientMessages } = matterState;
        const { tasks, events } = executionState;
        const { documents, notePages } = documentState;
        const { invoices } = financeState;
        const { users } = coreState;

        const staleCutoff = new Date();
        staleCutoff.setDate(staleCutoff.getDate() - 30); // SYNCED WITH BACKEND (30 DAYS)

        const activeMatters = matters.filter(m => m.status === 'Active');

        // Build a per-matter 'last real activity' timestamp.
        // We look at CRUD timestamps across every related sub-record.
        const matterActivityMap = new Map<string, Date>();

        const touch = (matterId: string | undefined, ts: string | undefined) => {
            if (!matterId || !ts) return;
            const d = new Date(ts);
            if (isNaN(d.getTime())) return;
            const existing = matterActivityMap.get(matterId);
            if (!existing || d > existing) matterActivityMap.set(matterId, d);
        };

        // Seed with stageLastUpdated and createdAt for all active matters
        activeMatters.forEach(m => {
            touch(m.id, m.stageLastUpdated);
            touch(m.id, m.createdAt);
            // Attorney notes embedded in matter
            (m.attorneyNotes || []).forEach(n => touch(m.id, n.date));
        });

        // Tasks linked to a matter
        tasks.forEach(t => touch(t.matterId, t.createdAt));

        // Documents linked to a matter
        documents.forEach(d => touch(d.matterId, d.dateFiled));

        // Events linked to a matter
        events.forEach(e => touch(e.matterId, e.createdAt || e.date));

        // Invoices linked to a matter
        invoices.forEach(inv => touch(inv.matter?.id, inv.issueDate));

        // Client messages linked to a matter (messages = real human activity)
        clientMessages.forEach(msg => touch(msg.matterId, msg.timestamp));

        // Note pages (endorsements, diary entries) linked to a matter
        notePages.forEach(p => touch(p.matterId, p.updatedAt || p.createdAt));

        const staleMatters = activeMatters.filter(m => {
            const lastActivity = matterActivityMap.get(m.id);
            return !lastActivity || lastActivity < staleCutoff;
        });

        const overdueTasks = tasks.filter(t => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < new Date());

        const mattersByStatus = [
            { label: 'Active', value: activeMatters.length, color: 'rgb(var(--color-primary-500))' },
            { label: 'Closed', value: matters.filter(m => m.status === 'Closed').length, color: '#64748b' },
            { label: 'Archived', value: matters.filter(m => m.status === 'Archived').length, color: '#a1a1aa' },
        ];

        const caseloadByPracticeArea = Object.entries(
            activeMatters.reduce((acc, matter) => {
                acc[matter.type] = (acc[matter.type] || 0) + 1;
                return acc;
            }, {} as Record<string, number>)
        ).map(([label, value]) => ({ label, value }));

        // Build caseload with ghost-user detection
        const userCountMap = activeMatters.reduce((acc, matter) => {
            matter.assignedUsers.forEach(userId => {
                acc[userId] = (acc[userId] || 0) + 1;
            });
            return acc;
        }, {} as Record<string, number>);

        const caseloadByUser: UserBar[] = Object.entries(userCountMap).map(([userId, value]) => {
            const existing = users.find(u => u.id === userId);
            return {
                userId,
                name: existing?.name || 'Removed User',
                value,
                isGhost: !existing,
            };
        }).sort((a, b) => b.value - a.value);

        const tasksByStatus = tasks.reduce((acc, task) => {
            acc[task.status] = (acc[task.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const tasksByStatusData = [
            { label: 'To Do', value: tasksByStatus['todo'] || 0, color: '#64748b' },
            { label: 'In Progress', value: tasksByStatus['in_progress'] || 0, color: '#f59e0b' },
            { label: 'Done', value: tasksByStatus['done'] || 0, color: 'rgb(var(--color-primary-500))' }
        ];

        return {
            totalActiveMatters: activeMatters.length,
            staleMattersCount: staleMatters.length,
            overdueTasksCount: overdueTasks.length,
            totalDocuments: documents.length,
            mattersByStatus,
            caseloadByPracticeArea,
            caseloadByUser,
            tasksByStatusData,
            ghostCount: caseloadByUser.filter(l => l.isGhost).length,
            staleMattersList: staleMatters.map(m => ({
                ...m,
                clientName: contacts.find(c => c.id === m.clientId)?.name || 'N/A',
                // Attach the computed last activity date for display in table
                lastActivityAt: matterActivityMap.get(m.id)?.toISOString() || m.stageLastUpdated || m.createdAt
            }))
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matterState, executionState, documentState, financeState, coreState, refreshKey]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title={isProperty ? "Active Properties" : "Active Matters"} value={reportData.totalActiveMatters} icon={<MattersIcon />} colorClass="text-primary-500" />
                <StatCard title={isProperty ? "Stale Records" : "Stale Matters"} value={reportData.staleMattersCount} icon={<StaleIcon />} colorClass="text-yellow-500" />
                <StatCard title="Overdue Tasks" value={reportData.overdueTasksCount} icon={<TaskAlertIcon />} colorClass="text-red-500" />
                <StatCard title="Total Documents" value={reportData.totalDocuments} icon={<DocumentsIcon />} colorClass="text-teal-500" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl shadow-md p-6 border border-black/5 dark:border-white/5">
                    <h3 className="text-lg font-bold mb-4">Matters by Status</h3>
                    <DoughnutChart data={reportData.mattersByStatus} />
                </div>
                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl shadow-md p-6 border border-black/5 dark:border-white/5">
                    <h3 className="text-lg font-bold mb-4">{isProperty ? 'Properties by Category' : 'Caseload by Practice Area'}</h3>
                    <CaseloadBarChart data={reportData.caseloadByPracticeArea} color="bg-primary-500" />
                </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl shadow-md p-6 border border-black/5 dark:border-white/5">
                {appMode === 'multi' ? (
                    <>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold">{isProperty ? 'Load by Manager' : 'Caseload by Lawyer'}</h3>
                            {reportData.ghostCount > 0 && (
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-1 rounded-full">
                                    <UserRemovedIcon className="w-3.5 h-3.5" />
                                    {reportData.ghostCount} removed {reportData.ghostCount === 1 ? 'user' : 'users'} with unassigned {isProperty ? 'records' : 'matters'}
                                </div>
                            )}
                        </div>
                        <CaseloadByUserChart
                            data={reportData.caseloadByUser}
                            existingUsers={coreState.users.filter(u =>
                                u.role !== 'Client' && u.role !== 'Tenant' && u.role !== 'External Counsel' && u.role !== 'Pending'
                            )}
                            allMatters={matterState.matters.filter(m => m.status === 'Active')}
                            onReassignComplete={() => setRefreshKey(k => k + 1)}
                            isProperty={isProperty}
                        />
                    </>
                ) : (
                    <>
                        <h3 className="text-lg font-bold mb-4">Your Task Breakdown</h3>
                        <DoughnutChart data={reportData.tasksByStatusData} />
                    </>
                )}
            </div>

            {/* ─── STALE MATTERS TABLE WITH FILE REVIEW REMINDERS ─── */}
            <div 
                id="stale-matters-section"
                className={`bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl shadow-md p-6 border transition-all duration-1000 ${currentHistoryEntry?.context?.highlight ? 'ring-4 ring-primary-500/30 border-primary-500 shadow-2xl scale-[1.01]' : 'border-black/5 dark:border-white/5'}`}
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold">{isProperty ? 'Stale Records' : 'Stale Matters'} <span className="text-slate-400 dark:text-zinc-500 font-normal text-sm">(No activity in 30+ days)</span></h3>
                    <p className="text-xs text-slate-400 dark:text-zinc-500">Hover a row to set a {isProperty ? 'file' : 'file'} review reminder</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 dark:text-zinc-400 uppercase">
                            <tr>
                                <th className="py-2 px-4">{isProperty ? 'Property' : 'Matter Title'}</th>
                                <th className="py-2 px-4">{isProperty ? 'Owner' : 'Client'}</th>
                                <th className="py-2 px-4">Last Update</th>
                                <th className="py-2 px-4 text-right">File Review</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-zinc-700">
                            {reportData.staleMattersList.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-slate-400 dark:text-zinc-500 text-sm">No stale {isProperty ? 'records' : 'matters'} — all cases are active.</td>
                                </tr>
                            )}
                            {reportData.staleMattersList.map(matter => (
                                <tr key={matter.id} className="group hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors">
                                    <td className="py-3 px-4 font-medium cursor-pointer" onClick={() => navigateTo('matterDetail', matter.id)}>
                                        {matter.title}
                                    </td>
                                    <td className="py-3 px-4 text-slate-500 dark:text-zinc-400">{matter.clientName}</td>
                                    <td className="py-3 px-4 text-slate-500 dark:text-zinc-400">{timeAgo(matter.lastActivityAt || matter.stageLastUpdated)}</td>
                                    <td className="py-3 px-4">
                                        <div className="flex justify-end">
                                            <InlineMatterReview matter={matter} />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// Simple bar chart for practice areas (non-interactive)
const CaseloadBarChart: React.FC<{ data: { label: string; value: number }[]; color: string }> = ({ data, color }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="space-y-2">
            {data.map(item => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                    <span className="w-24 text-right truncate text-slate-500 dark:text-zinc-400">{item.label}</span>
                    <div className="flex-grow bg-slate-200 dark:bg-zinc-700 rounded-full h-4">
                        <div className={`h-4 rounded-full ${color}`} style={{ width: `${(item.value / maxValue) * 100}%` }}></div>
                    </div>
                    <span className="font-bold w-8 text-left">{item.value}</span>
                </div>
            ))}
        </div>
    );
};

export default CaseManagementReports;