import React, { useMemo } from 'react';
import { Task, TaskStatus, TaskPriority, Document, Matter } from '../../types';
import { ENTERPRISE_WORKFLOWS } from '../../utils/enterpriseWorkflows';
import { ProceduralComplianceReport } from './ProceduralComplianceReport';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface StatutoryTaskTimelineProps {
    tasks: Task[];
    matterType: string;
    subCategory?: string;
    matterId: string;
    matter: Matter;
    documents: Document[];
    onUpdateStatus: (taskId: string, newStatus: TaskStatus) => void;
    openModal: (type: string, id: string | null, context?: any) => void;
}

interface StageGroup {
    stageName: string;
    stageIndex: number;
    tasks: Task[];
    isActive: boolean;
    isComplete: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const daysUntil = (dateStr?: string | null): number | null => {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
};

const DeadlineBadge: React.FC<{ days: number | null }> = ({ days }) => {
    if (days === null) return null;
    if (days < 0) return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            {Math.abs(days)}d overdue
        </span>
    );
    if (days === 0) return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            Due today
        </span>
    );
    if (days <= 3) return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/20">
            {days}d left
        </span>
    );
    if (days <= 7) return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/20">
            {days}d left
        </span>
    );
    return (
        <span className="text-2xs text-slate-400 dark:text-zinc-500 font-medium">
            {days}d left
        </span>
    );
};

const PriorityDot: React.FC<{ priority?: TaskPriority }> = ({ priority }) => {
    const cls = priority === TaskPriority.High
        ? 'bg-red-500'
        : priority === TaskPriority.Medium
            ? 'bg-amber-400'
            : 'bg-slate-400 dark:bg-zinc-500';
    return <span className={`w-2 h-2 rounded-full shrink-0 ${cls}`} />;
};

const StatusPill: React.FC<{
    task: Task;
    onUpdate: (status: TaskStatus) => void;
}> = ({ task, onUpdate }) => {
    const cfg: Record<TaskStatus, { label: string; cls: string }> = {
        [TaskStatus.Done]:               { label: 'Done',               cls: 'bg-emerald-600 text-white border-emerald-700 shadow-sm' },
        [TaskStatus.InProgress]:         { label: 'In Progress',         cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25 hover:bg-blue-500/25' },
        [TaskStatus.PendingVerification]:{ label: 'Pending Review',      cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25 hover:bg-amber-500/25' },
        [TaskStatus.Todo]:               { label: 'To Do',               cls: 'bg-slate-100 dark:bg-zinc-800 dark:bg-zinc-700/50 text-slate-500 dark:text-zinc-400 border-slate-200 dark:border-zinc-600 hover:bg-slate-200 dark:hover:bg-zinc-700' },
    };
    const next: Record<TaskStatus, TaskStatus> = {
        [TaskStatus.Todo]: TaskStatus.InProgress,
        [TaskStatus.InProgress]: TaskStatus.PendingVerification,
        [TaskStatus.PendingVerification]: TaskStatus.Done,
        [TaskStatus.Done]: TaskStatus.Todo,
    };
    const { label, cls } = cfg[task.status];
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onUpdate(next[task.status]); }}
            className={`px-2 py-0.5 rounded-full text-3xs font-black uppercase tracking-wider border transition-all ${cls}`}
        >
            {label}
        </button>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// STAGE HEADER  
// ─────────────────────────────────────────────────────────────────────────────

const StageHeader: React.FC<{
    stage: StageGroup;
    stagesCount: number;
}> = ({ stage, stagesCount }) => {
    const completedCount = stage.tasks.filter(t => t.status === TaskStatus.Done).length;
    const pct = stage.tasks.length > 0 ? Math.round((completedCount / stage.tasks.length) * 100) : 0;

    return (
        <div className="flex items-center gap-3 mb-2">
            {/* Stage number node */}
            <div className={`relative flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-colors ${
                stage.isComplete
                    ? 'bg-green-500 border-green-500 text-white'
                    : stage.isActive
                        ? 'bg-sky-500 border-sky-500 text-white shadow-lg shadow-sky-500/30'
                        : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-400 dark:text-zinc-500'
            }`}>
                {stage.isComplete
                    ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    : stage.stageIndex + 1
                }
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-bold truncate ${stage.isActive ? 'text-sky-600 dark:text-sky-400' : 'text-slate-700 dark:text-zinc-200'}`}>
                        {stage.stageName}
                    </p>
                    <span className="text-2xs text-slate-400 dark:text-zinc-500 font-medium shrink-0">
                        {completedCount}/{stage.tasks.length}
                    </span>
                </div>
                {stage.tasks.length > 0 && (
                    <div className="mt-1 h-1 rounded-full bg-slate-100 dark:bg-zinc-800 dark:bg-zinc-700 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${stage.isComplete ? 'bg-green-500' : 'bg-sky-500'}`}
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// TASK CARD
// ─────────────────────────────────────────────────────────────────────────────

const TaskCard: React.FC<{
    task: Task;
    onUpdate: (status: TaskStatus) => void;
    openModal: (type: string, id: string | null, context?: any) => void;
    isStatutory?: boolean;
}> = ({ task, onUpdate, openModal, isStatutory }) => {
    const days = daysUntil(task.dueDate);
    const isOverdue = days !== null && days < 0 && task.status !== TaskStatus.Done;
    const isDone = task.status === TaskStatus.Done;

    return (
        <div
            className={`group relative flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                isDone
                    ? 'bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/30 opacity-90'
                    : isOverdue
                        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/40 hover:border-red-300 dark:hover:border-red-700'
                        : isStatutory
                            ? 'bg-amber-50/50 dark:bg-amber-900/5 border-amber-200/60 dark:border-amber-700/20 hover:border-amber-300 dark:hover:border-amber-700/40'
                            : 'bg-white dark:bg-zinc-900 dark:bg-zinc-800/50 border-slate-100 dark:border-zinc-700/50 hover:border-primary-200 dark:hover:border-primary-800'
            }`}
            onClick={() => openModal('viewTask', task.id, { openedFrom: 'matterDetail' })}
        >
            {/* Statutory marker */}
            {isStatutory && !isDone && (
                <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl bg-amber-400" />
            )}

            <div className="flex-shrink-0 mt-0.5">
                <PriorityDot priority={task.priority} />
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                    <p className={`text-sm font-semibold leading-tight ${isDone ? 'line-through text-slate-400 dark:text-zinc-500' : 'text-slate-800 dark:text-zinc-100'}`}>
                        {task.title}
                    </p>
                    <StatusPill task={task} onUpdate={onUpdate} />
                </div>

                <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
                    {task.dueDate && <DeadlineBadge days={days} />}
                    {isStatutory && !isDone && (
                        <span className="text-3xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                            Statutory
                        </span>
                    )}
                    {task.description && (
                        <p className="text-2xs text-slate-400 dark:text-zinc-500 truncate max-w-[200px]">{task.description}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN TIMELINE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const StatutoryTaskTimeline: React.FC<StatutoryTaskTimelineProps> = ({
    tasks, matterType, subCategory, matterId, matter, documents, onUpdateStatus, openModal
}) => {
    // Get the stage order for this matter type
    const stageOrder: string[] = useMemo(() => {
        const wf = ENTERPRISE_WORKFLOWS[matterType as keyof typeof ENTERPRISE_WORKFLOWS];
        if (!wf || !subCategory) return [];
        const sub = (wf.subCategories as any)[subCategory];
        return sub?.stages || [];
    }, [matterType, subCategory]);

    // Group tasks by stage name (matched against workflow stages) + ungrouped
    const stageGroups: StageGroup[] = useMemo(() => {
        if (stageOrder.length === 0) return [];

        const groups: StageGroup[] = stageOrder.map((stageName, i) => ({
            stageName,
            stageIndex: i,
            tasks: [],
            isActive: false,
            isComplete: false,
        }));

        const ungrouped: Task[] = [];

        tasks.forEach(task => {
            // Try to match task to a stage by keyword overlap
            let matched = false;
            for (const group of groups) {
                const stageWords = group.stageName.toLowerCase().split(/\W+/);
                const titleWords = task.title.toLowerCase().split(/\W+/);
                if (stageWords.some(w => w.length > 3 && titleWords.some(tw => tw.includes(w) || w.includes(tw)))) {
                    group.tasks.push(task);
                    matched = true;
                    break;
                }
            }
            if (!matched) ungrouped.push(task);
        });

        // Put unmatched tasks in the first active/incomplete stage, or last stage
        if (ungrouped.length > 0) {
            const firstIncomplete = groups.find(g => g.tasks.some(t => t.status !== TaskStatus.Done)) || groups[0];
            if (firstIncomplete) firstIncomplete.tasks.push(...ungrouped);
        }

        // Determine active/complete status
        groups.forEach((g, i) => {
            g.isComplete = g.tasks.length > 0 && g.tasks.every(t => t.status === TaskStatus.Done);
            g.isActive = !g.isComplete && (i === 0 || groups[i - 1]?.isComplete);
        });

        return groups.filter(g => g.tasks.length > 0 || g.stageIndex === 0);
    }, [tasks, stageOrder]);

    // Statutory task detection (High priority + description containing statutory keywords)
    const isStatutoryTask = (task: Task) =>
        task.priority === TaskPriority.High && (
            task.description?.toLowerCase().includes('must') ||
            task.description?.toLowerCase().includes('days') ||
            task.description?.toLowerCase().includes('deadline') ||
            task.description?.toLowerCase().includes('statutory') ||
            task.description?.toLowerCase().includes('within') ||
            daysUntil(task.dueDate) !== null && (daysUntil(task.dueDate)! <= 7)
        );

    // Fallback: no stage config — show flat enhanced list
    if (stageGroups.length === 0) {
        const sorted = [...tasks].sort((a, b) => {
            const pa = a.priority === TaskPriority.High ? 0 : a.priority === TaskPriority.Medium ? 1 : 2;
            const pb = b.priority === TaskPriority.High ? 0 : b.priority === TaskPriority.Medium ? 1 : 2;
            return pa - pb;
        });
        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">All Tasks</span>
                    <div className="h-px flex-1 bg-slate-100 dark:bg-zinc-800 dark:bg-zinc-700" />
                    <button
                        className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors"
                        onClick={() => openModal('newTask', null, { matterId, openedFrom: 'matterDetail' })}
                    >
                        + Add
                    </button>
                </div>
                {sorted.map(t => (
                    <TaskCard
                        key={t.id}
                        task={t}
                        onUpdate={s => onUpdateStatus(t.id, s)}
                        openModal={openModal}
                        isStatutory={isStatutoryTask(t)}
                    />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Consolidated Procedural Compliance Report */}
            <ProceduralComplianceReport
                matter={matter}
                tasks={tasks}
                documents={documents}
            />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                    <span className="text-xs font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                        Statutory Timeline
                    </span>
                </div>
                <button
                    className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors"
                    onClick={() => openModal('newTask', null, { matterId, openedFrom: 'matterDetail' })}
                >
                    + Add Task
                </button>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-2xs text-slate-400 dark:text-zinc-500 font-semibold">
                <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500" /> High priority
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> Medium priority
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-1 h-4 rounded-full bg-amber-400" /> Statutory deadline
                </span>
            </div>

            {/* Stage groups */}
            {stageGroups.map((group, idx) => (
                <div key={group.stageName} className="relative">
                    {/* Vertical connector line */}
                    {idx < stageGroups.length - 1 && (
                        <div className={`absolute left-4 top-8 w-0.5 h-[calc(100%+1.5rem)] -z-0 ${
                            group.isComplete ? 'bg-green-400/50' : 'bg-slate-200 dark:bg-zinc-700'
                        }`} />
                    )}

                    <StageHeader stage={group} stagesCount={stageGroups.length} />

                    <div className="ml-11 space-y-2">
                        {group.tasks.length > 0 ? (
                            group.tasks.map(task => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    onUpdate={s => onUpdateStatus(task.id, s)}
                                    openModal={openModal}
                                    isStatutory={isStatutoryTask(task)}
                                />
                            ))
                        ) : (
                            <p className="text-2xs text-slate-400 dark:text-zinc-600 italic pl-1">No tasks in this stage</p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};
