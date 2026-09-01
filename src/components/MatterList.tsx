
import * as React from 'react';
import { useMemo, useState, useCallback } from 'react';
import { Matter, MatterStatus, TaskStatus, View, SelectedId, WorkflowDefinition } from '../types';
import { useMatterState } from '../contexts/MatterContext';
import { useExecutionState } from '../contexts/ExecutionContext';
import { useDocumentState } from '../contexts/DocumentContext';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { useHighlight } from '../hooks/useHighlight';
import { useAuth } from '../contexts/AuthContext';
import { getInitials, getUserColor, formatDueDate, getDueDateColor } from '../utils/colorUtils';
import { ShieldCheckIcon, TrashIcon, PlusIcon, CloudArrowUpIcon, SearchIcon, MattersIcon } from '../constants';
import InlineMatterReview from './InlineMatterReview';
import { MattersSkeleton } from './toolkit/Skeleton';
import MatterBoardView from './MatterBoardView';

// ─── Icons (inline so no new imports needed) ────────────────────────────────
const ListIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
);
const BoardIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    </svg>
);
const DownloadIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);
const XIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
);

// ─── CSV Export ──────────────────────────────────────────────────────────────
function exportMattersToCSV(matters: Matter[], contacts: any[], notePages: any[]) {
    const headers = ['Reference', 'Title', 'Client', 'Type', 'Stage', 'Status', 'Court', 'Created', 'Latest Endorsements'];
    const rows = matters.map(m => {
        const client = contacts.find((c: any) => c.id === m.clientId);
        
        // Find endorsements for this matter
        const matterNotes = notePages
            .filter((n: any) => n.matterId === m.id && n.type === 'endorsement')
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            
        // Combine up to 3 latest endorsements into a single string
        const endorsementsText = matterNotes.slice(0, 3)
            .map((n: any) => `[${new Date(n.createdAt).toLocaleDateString('en-GB')}] ${n.title}: ${n.content.replace(/<[^>]*>?/gm, '').substring(0, 100)}...`)
            .join(' | ');

        return [
            m.referenceNumber || '',
            `"${m.title.replace(/"/g, '""')}"`,
            `"${(client?.name || 'Unknown').replace(/"/g, '""')}"`,
            m.type || '',
            m.stage || '',
            m.status || '',
            `"${(m.court || '').replace(/"/g, '""')}"`,
            m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-GB') : '',
            `"${endorsementsText.replace(/"/g, '""')}"`
        ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `matters_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Filter Presets ──────────────────────────────────────────────────────────
type Preset = 'all' | 'my-active' | 'overdue' | 'this-month';

const PRESETS: { id: Preset; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'my-active', label: 'My Active' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'this-month', label: 'This Month' },
];

// ─── Matter Card Item ────────────────────────────────────────────────────────
const MatterCardItem: React.FC<{
    matter: Matter;
    isActive?: boolean;
    isSelected?: boolean;
    onSelect?: (id: string, checked: boolean) => void;
    selectionMode?: boolean;
}> = ({ matter, isActive, isSelected, onSelect, selectionMode }) => {
    const { matterState } = useMatterState();
    const { executionState } = useExecutionState();
    const { documentState } = useDocumentState();
    const { coreState } = useCoreState();
    const { handleDeleteMatter, archiveItem } = useDataActions();
    const { openModal, closeModal, navigateTo, addToast } = useUI();

    const client = matterState.contacts.find((c: any) => c.id === matter.clientId);
    const matterTasks = executionState.tasks.filter(t => t.matterId === matter.id);
    const assignedUsers = (matter.assignedUsers || []).map(id => coreState.users.find(u => u.id === id)).filter(Boolean) as any[];
    const pendingTasks = matterTasks.filter(t => t.status !== TaskStatus.Done);
    const overdueTasks = pendingTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date());

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        const docCount = documentState.documents.filter(d => d.matterId === matter.id).length;
        const taskCount = matterTasks.length;
        openModal('deleteConfirmation', matter.id, {
            title: `Delete Matter "${matter.title}"?`,
            message: (
                <div className="space-y-3">
                    <p>Are you sure you want to <strong>permanently delete</strong> this matter?</p>
                    {(taskCount > 0 || docCount > 0) && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg space-y-1">
                            <p className="text-red-700 dark:text-red-400 font-bold text-2xs uppercase tracking-wider">Will also delete:</p>
                            {taskCount > 0 && <p className="text-xs text-red-600 dark:text-red-400">• {taskCount} Tasks</p>}
                            {docCount > 0 && <p className="text-xs text-red-600 dark:text-red-400">• {docCount} Documents</p>}
                        </div>
                    )}
                </div>
            ),
            onConfirm: async () => {
                try {
                    await handleDeleteMatter(matter.id, matter.title);
                    closeModal();
                } catch (err: any) {
                    console.error('[MatterList] Delete failed:', err);
                    addToast('Could not delete this matter. Please try again.', { type: 'error' });
                }
            },
            onConfirmArchive: () => {
                archiveItem('matters', matter.id, matter.title, matter);
                closeModal();
            },
            archiveText: 'Archive Instead',
            confirmText: 'Delete Everything'
        });
    };

    return (
        <div
            onClick={() => selectionMode && onSelect ? onSelect(matter.id, !isSelected) : navigateTo('matterDetail', matter.id)}
            className={`group relative p-3.5 mb-2 rounded-lg border-l-4 cursor-pointer transition-all duration-300 hover:shadow-lg hover:bg-slate-50 dark:hover:bg-zinc-800 min-h-[48px] ${isActive ? 'border-l-primary-600 bg-primary-50 dark:bg-primary-950/30' : isSelected ? 'border-l-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 shadow-sm'}`}
        >
            <div className="flex items-start gap-2">
                {/* Checkbox — visible on hover or when selection mode active */}
                <div
                    className={`flex-shrink-0 mt-0.5 transition-opacity ${selectionMode ? 'opacity-100' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100'}`}
                    onClick={e => { e.stopPropagation(); onSelect?.(matter.id, !isSelected); }}
                >
                    <input autoComplete="off" data-lpignore="true" 
                        type="checkbox"
                        checked={!!isSelected}
                        onChange={() => {}}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <div className="flex-1 min-w-0 pr-2">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate group-hover:text-primary-600 transition-colors leading-tight">{matter.title}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-2xs text-slate-500 dark:text-zinc-400 font-medium truncate max-w-[120px]">
                                    {client?.name || 'Deleted Client'}
                                </span>
                                {client?.isArchived && (
                                    <span className="px-1.5 py-0.5 text-3xs font-bold uppercase rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" title="This client has been archived — restore from Contacts to reactivate.">
                                        Archived
                                    </span>
                                )}
                                {!client && matter.clientId && (
                                    <span className="px-1.5 py-0.5 text-3xs font-bold uppercase rounded bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400" title="The client record was deleted. Use the 'Link Client' action on the matter detail page to reassign.">
                                        Orphaned
                                    </span>
                                )}
                                <span className="px-1.5 py-0.5 text-3xs font-bold uppercase rounded bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">{matter.stage}</span>
                                {matter.nextAdjournedDate && (
                                    <span className="px-1.5 py-0.5 text-3xs font-bold uppercase rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        {new Date(matter.nextAdjournedDate).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}
                                    </span>
                                )}
                                {overdueTasks.length > 0 && (
                                    <span className="px-1.5 py-0.5 text-3xs font-bold uppercase rounded bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">{overdueTasks.length} overdue</span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <InlineMatterReview matter={matter} />
                            <button onClick={handleDelete} className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-opacity"><TrashIcon className="w-3.5 h-3.5" /></button>
                        </div>
                    </div>
                    {assignedUsers.length > 0 && (
                        <div className="flex -space-x-1 mt-1.5 pt-1.5 border-t border-slate-100 dark:border-zinc-700/50">
                            {assignedUsers.slice(0, 4).map((user: any) => (
                                <div key={user.id} className={`w-4 h-4 rounded-full border border-white dark:border-zinc-800 flex items-center justify-center text-[7px] text-white font-bold ${getUserColor(user.name)}`}>{getInitials(user.name)}</div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Main MatterList ─────────────────────────────────────────────────────────
interface MatterListProps {
    viewMode?: 'list' | 'board';
    onViewModeChange?: (mode: 'list' | 'board') => void;
    onNavigate?: (view: View, id?: string | null, context?: any) => void;
    isCompact?: boolean;
}

export const MatterList: React.FC<MatterListProps> = ({ viewMode: propViewMode, onViewModeChange, onNavigate, isCompact }) => {
    const { matterState } = useMatterState();
    const { coreState, isDataLoaded } = useCoreState();
    const { executionState } = useExecutionState();
    const { documentState } = useDocumentState();
    const { openModal, selectedId, navigateTo: uiNavigateTo } = useUI();
    const { handleUpdateMatterStage, handleUpdateMatter } = useDataActions();
    const { currentUser } = useAuth();
    const navigateTo = onNavigate || uiNavigateTo;

    // BRIEF #1a: Interactive Target Highlighting — highlights the "New" button
    // when the user clicks "Create your first matter" in the checklist.
    const mattersContainerRef = React.useRef<HTMLDivElement>(null);
    useHighlight(mattersContainerRef, 'matters', 'ring');

    const [searchTerm, setSearchTerm] = useState('');
    const [preset, setPreset] = useState<Preset>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [localViewMode, setLocalViewMode] = useState<'list' | 'board'>(propViewMode || 'list');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const viewMode = propViewMode ?? localViewMode;

    const handleViewModeChange = (mode: 'list' | 'board') => {
        setLocalViewMode(mode);
        onViewModeChange?.(mode);
        setSelectedIds(new Set());
    };

    const validMatters = useMemo(() => matterState.matters.filter((m: any) => m.title && m.id), [matterState.matters]);
    
    const uniqueTypes = useMemo(() => Array.from(new Set(validMatters.map((m: any) => m.type).filter(Boolean))), [validMatters]);

    // Filter by preset
    const presetFiltered = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return validMatters.filter((m: any) => {
            if (preset === 'my-active') return m.status === MatterStatus.Active && m.assignedUsers?.includes(currentUser?.id);
            if (preset === 'overdue') {
                return executionState.tasks.some(t => t.matterId === m.id && t.status !== TaskStatus.Done && t.dueDate && new Date(t.dueDate) < now);
            }
            if (preset === 'this-month') return new Date(m.createdAt) >= startOfMonth;
            return true;
        });
    }, [validMatters, preset, currentUser, executionState.tasks]);

    const filteredMatters = useMemo(() => {
        let result = presetFiltered;
        if (typeFilter !== 'all') {
            result = result.filter(m => m.type === typeFilter);
        }
        if (!searchTerm) return result;
        const lower = searchTerm.toLowerCase();
        return result.filter((m: any) =>
            m.title.toLowerCase().includes(lower) ||
            m.referenceNumber?.toLowerCase().includes(lower) ||
            matterState.contacts.find((c: any) => c.id === m.clientId)?.name.toLowerCase().includes(lower)
        );
    }, [presetFiltered, searchTerm, typeFilter, matterState.contacts]);

    // Bulk actions
    const selectionMode = selectedIds.size > 0;
    const allSelected = filteredMatters.length > 0 && filteredMatters.every(m => selectedIds.has(m.id));

    const toggleSelect = useCallback((id: string, checked: boolean) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            checked ? next.add(id) : next.delete(id);
            return next;
        });
    }, []);

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredMatters.map(m => m.id)));
        }
    };

    const bulkClose = async () => {
        const selected = filteredMatters.filter(m => selectedIds.has(m.id));
        for (const m of selected) {
            await handleUpdateMatter({ ...m, status: MatterStatus.Closed });
        }
        setSelectedIds(new Set());
    };

    const bulkExportCSV = () => {
        const selected = filteredMatters.filter(m => selectedIds.has(m.id));
        exportMattersToCSV(selected, matterState.contacts, documentState.notePages);
    };

    // Enriched matters for board view
    const enrichedMatters = useMemo(() => filteredMatters.map((m: any) => {
        const matterTasks = executionState.tasks.filter(t => t.matterId === m.id && t.status !== TaskStatus.Done && t.dueDate);
        const nextTask = [...matterTasks].sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];
        return {
            ...m,
            hasExternalAccess: m.hasExternalAccess || false,
            nextDeadline: nextTask ? { date: nextTask.dueDate!, title: nextTask.title } : null,
        };
    }), [filteredMatters, executionState.tasks]);

    if (!isDataLoaded) return <MattersSkeleton />;

    return (
        <div ref={mattersContainerRef} className="flex flex-col h-full bg-slate-50/50 dark:bg-zinc-950 border-r border-slate-200 dark:border-zinc-800">

            {/* ── Header ── */}
            <div className="sticky top-0 pt-safe z-30 flex-shrink-0 py-2.5 px-4 glass border-b border-slate-100 dark:border-zinc-800 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Matters</h2>
                    <div className="flex items-center gap-1.5">

                        {/* View toggle */}
                        <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5">
                            <button
                                onClick={() => handleViewModeChange('list')}
                                title="List View"
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-zinc-700 shadow text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <ListIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => handleViewModeChange('board')}
                                title="Board View"
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'board' ? 'bg-white dark:bg-zinc-700 shadow text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <BoardIcon className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Ingest button REMOVED per user request — the New
                            button is sufficient for creating matters. The
                            ingestion wizard is still accessible via the
                            modal system if needed elsewhere. */}
                        <button id="new-matter-button" data-item-id="checklist-cta-hasMatter" onClick={() => openModal('newMatter')} className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all shadow-sm flex items-center gap-2 text-xs font-bold">
                            <PlusIcon className="w-4 h-4" /> New
                        </button>
                    </div>
                </div>

                {/* ── Consolidated Filter Row ── */}
                {/* Filter pills (All / My Active / Overdue / This Month) have been
                    consolidated into a single dropdown next to the Practice Areas
                    dropdown for a cleaner, more scannable layout. */}
                <div className="flex gap-2 flex-wrap items-center">
                    {/* Status preset filter (was a row of pills) */}
                    <select
                        value={preset}
                        onChange={(e) => setPreset(e.target.value as Preset)}
                        className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-zinc-300 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                    >
                        {PRESETS.map(p => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                    </select>

                    {uniqueTypes.length > 0 && (
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-slate-700 dark:text-zinc-300 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                        >
                            <option value="all">All Practice Areas</option>
                            {uniqueTypes.map((type: any) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    )}
                    
                    {viewMode === 'board' && (
                        <button
                            onClick={() => navigateTo('settings', null, { settingsTargetId: 'workflow-management' })}
                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-2xs font-bold text-slate-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 rounded-lg transition-colors border border-slate-200 dark:border-zinc-700 shadow-sm"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> Edit Case Stages
                        </button>
                    )}
                </div>

                {/* ── Search ── */}
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input autoComplete="off" data-lpignore="true" 
                        type="text"
                        placeholder="Search matters..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    />
                </div>
            </div>

            {/* ── Bulk Actions Bar ── */}
            {selectionMode && (
                <div className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold animate-fade-in z-20">
                    <button onClick={() => setSelectedIds(new Set())} className="p-1 rounded hover:bg-indigo-700"><XIcon className="w-4 h-4" /></button>
                    <span className="flex-1">{selectedIds.size} selected</span>
                    <button
                        onClick={() => openModal('assignUsers', null, { matterIds: Array.from(selectedIds) })}
                        className="px-3 py-1 bg-white/20 rounded-lg hover:bg-white/30 transition-all text-xs"
                    >
                        Assign
                    </button>
                    <button
                        onClick={bulkClose}
                        className="px-3 py-1 bg-white/20 rounded-lg hover:bg-white/30 transition-all text-xs"
                    >
                        Close
                    </button>
                    <button
                        onClick={bulkExportCSV}
                        className="px-3 py-1 bg-white/20 rounded-lg hover:bg-white/30 transition-all text-xs flex items-center gap-1"
                    >
                        <DownloadIcon className="w-3.5 h-3.5" /> Export CSV
                    </button>
                </div>
            )}

            {/* ── Content ── */}
            {viewMode === 'board' ? (
                <div className="flex-1 overflow-hidden">
                    <MatterBoardView
                        matters={enrichedMatters}
                        workflows={executionState.workflows || []}
                        contacts={matterState.contacts}
                        users={coreState.users}
                        onUpdateStage={(matterId, stage) => handleUpdateMatterStage(matterId, stage)}
                        onViewDetails={(id) => navigateTo('matterDetail', id)}
                        openModal={openModal}
                    />
                </div>
            ) : (
                <>
                {/* Select all row — unified with Properties page:
                    sticky header OUTSIDE the scroll container, same padding/border. */}
                {filteredMatters.length > 0 && (
                    <div className="bg-slate-50 dark:bg-zinc-900/50 px-4 py-2 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                        <div
                            onClick={toggleSelectAll}
                            className="flex items-center gap-2 cursor-pointer group"
                        >
                            <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${allSelected ? 'bg-primary-600 border-primary-600' : 'border-slate-300 dark:border-zinc-700 group-hover:border-primary-400'}`}>
                                {allSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                                {!allSelected && selectedIds.size > 0 && <div className="w-2.5 h-0.5 bg-primary-600 rounded"></div>}
                            </div>
                            <span className="text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest group-hover:text-primary-600 transition-colors">Select all</span>
                        </div>
                        <span className="text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{filteredMatters.length} Total Matters</span>
                    </div>
                )}
                <div className="flex-grow overflow-y-auto custom-scrollbar p-2 pb-16 md:pb-2">
                    {filteredMatters.length > 0 ? (
                        filteredMatters.map(m => (
                            <MatterCardItem
                                key={m.id}
                                matter={m}
                                isActive={selectedId === m.id}
                                isSelected={selectedIds.has(m.id)}
                                onSelect={toggleSelect}
                                selectionMode={selectionMode}
                            />
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                                <MattersIcon className="w-8 h-8 text-slate-400 dark:text-zinc-500" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-700 dark:text-zinc-300 mb-1">No Matters Found</h3>
                            <p className="text-xs text-slate-400 dark:text-zinc-500 mb-4 max-w-[200px]">
                                {searchTerm ? 'No matches found. Try a different search.' : 'Create your first matter to get started.'}
                            </p>
                            {!searchTerm && (
                                <button
                                    onClick={() => openModal('newMatter')}
                                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all shadow-sm flex items-center gap-2 text-xs font-bold"
                                >
                                    <PlusIcon className="w-4 h-4" /> New Matter
                                </button>
                            )}
                        </div>
                    )}
                </div>
                </>
            )}
        </div>
    );
};
