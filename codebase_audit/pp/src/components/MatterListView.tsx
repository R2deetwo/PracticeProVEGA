import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Matter, User, Contact, AppMode, ModalType, View, NotePage, TaskStatus } from '../types';
import { getInitials, getUserColor, formatDueDate, getDueDateColor } from '../utils/colorUtils';
import Tooltip from './Tooltip';
import { ShieldCheckIcon, MattersIcon, EditIcon, ArchiveIcon, TrashIcon, ChevronRightIcon, PlusIcon, SearchIcon, CloudArrowUpIcon } from '../constants';
import EmptyState from './EmptyState';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { useUI } from '../contexts/UIContext';
import { useMatterState } from '../contexts/MatterContext';
import { useFinanceState } from '../contexts/FinanceContext';
import { useExecutionState } from '../contexts/ExecutionContext';
import { useDocumentState } from '../contexts/DocumentContext';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { MatterDetailView } from './details/MatterDetailView';

type SortableKey = 'title' | 'client' | 'stage' | 'referenceNumber' | 'type' | 'nextDeadline';
type SortDirection = 'asc' | 'desc';

interface EnrichedMatter extends Matter {
    hasExternalAccess: boolean;
    nextDeadline: { date: string; title: string } | null;
}



const MatterSidebarItem: React.FC<{
    matter: EnrichedMatter;
    clientName: string;
    isActive: boolean;
    onClick: () => void;
    openModal: (type: ModalType, id?: string | null, context?: any) => void;
    isUpdating?: boolean;
}> = ({ matter, clientName, isActive, onClick, openModal, isUpdating }) => {

    // Calculate status color
    const statusColor = matter.status === 'Active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
        matter.status === 'Archived' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
            'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400';

    return (
        <div
            onClick={onClick}
            className={`
                flex flex-col p-3 cursor-pointer rounded-xl transition-all font-sans group relative overflow-hidden mb-1 border-l-4
                ${isActive
                    ? 'bg-primary-50 dark:bg-zinc-800 border-y-2 border-r-2 border-primary-600 dark:border-primary-500 border-l-primary-600 shadow-xl transform scale-[1.02] z-10 ring-4 ring-primary-500/30 dark:ring-primary-400/20'
                    : 'bg-white dark:bg-zinc-800 border-y-2 border-r-2 border-slate-100 dark:border-zinc-700 border-l-slate-200 dark:border-l-zinc-600 hover:border-primary-200 dark:hover:border-primary-900/50 hover:shadow-lg shadow-sm'}
            `}>
            <div className="flex justify-between items-start mb-1 overflow-hidden">
                <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md ${statusColor}`}>
                    {matter.status}
                </span>
                {matter.nextDeadline && (
                    <span className={`text-[10px] font-semibold ${getDueDateColor(matter.nextDeadline.date)}`}>
                        {formatDueDate(matter.nextDeadline.date)}
                    </span>
                )}
            </div>

            <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center text-lg font-bold shadow-sm ${isActive ? 'bg-white text-primary-600 ring-2 ring-primary-100' : 'bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400'}`}>
                    {matter.title.substring(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 relative">
                    <div className="flex items-center gap-2 mb-0.5">
                        <h4 className={`text-sm font-bold truncate ${isActive ? 'text-primary-900 dark:text-primary-50' : 'text-slate-900 dark:text-white'}`}>
                            {matter.title}
                        </h4>
                        {isUpdating && (
                            <div className="flex-shrink-0 w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                        {clientName}
                    </p>
                </div>
            </div>

            <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-zinc-800 px-1 py-0.5 rounded border border-slate-100 dark:border-zinc-700">
                    {matter.referenceNumber}
                </span>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); openModal('editMatter', matter.id); }} className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded text-slate-400 hover:text-primary-600">
                        <EditIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

interface MatterListViewProps {
    onViewDetails: (id: string) => void;
    onUpdateMatterAssignment?: (matterId: string, assignedUserIds: string[]) => void;
    onAssignClick?: (e: React.MouseEvent, matter: Matter) => void;
    isCompact?: boolean;
}

const MatterListView: React.FC<MatterListViewProps> = ({ onViewDetails, onUpdateMatterAssignment, onAssignClick, isCompact }) => {
    const { matterState, matterActions } = useMatterState();
    const { financeState, financeActions } = useFinanceState();
    const { executionState, executionActions } = useExecutionState();
    const { documentState, documentActions } = useDocumentState();
    const { coreState } = useCoreState();
    const { currentUser, appMode } = useAuth();
    const { selectedId, navigateTo, openModal } = useUI();
    
    // De-structure state
    const { matters, contacts } = matterState;
    const { users } = coreState;

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Pending' | 'Archived' | 'Closed' | 'Reviewed' | 'New' | 'Stale' | 'Recent'>('Active');
    const [updatingMatterIds, setUpdatingMatterIds] = useState<Set<string>>(new Set());

    const wrappedUpdateMatterStage = async (id: string, stage: string) => {
        setUpdatingMatterIds(prev => new Set(prev).add(id));
        try {
            await matterActions.updateMatter({ id, stage, stageLastUpdated: new Date().toISOString() });
        } finally {
            setUpdatingMatterIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const wrappedUpdateMatter = async (matter: Matter) => {
        setUpdatingMatterIds(prev => new Set(prev).add(matter.id));
        try {
            await matterActions.updateMatter(matter);
        } finally {
            setUpdatingMatterIds(prev => {
                const next = new Set(prev);
                next.delete(matter.id);
                return next;
            });
        }
    };

    // Adapters for MatterDetailView
    const handleUpdateMatterNote = (note: NotePage) => {
        documentActions.handleUpdatePageContent(note.id, note.title, note.content);
    };

    const handleDeleteMatterNote = (noteId: string) => {
        documentActions.onDeletePage(noteId);
    };

    // Enrich matters with nextDeadline for the sidebar
    const enrichedMatters: EnrichedMatter[] = useMemo(() => {
        return matters.map(m => {
            const matterTasks = executionState.tasks.filter(t => t.matterId === m.id && t.status !== TaskStatus.Done && t.dueDate);
            const sortedTasks = matterTasks.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
            const nextTask = sortedTasks[0];
            
            return {
                ...m,
                hasExternalAccess: false,
                nextDeadline: nextTask ? { date: nextTask.dueDate!, title: nextTask.title } : null
            };
        });
    }, [matters, executionState.tasks]);

    // Sort logic
    const sortedMatters = useMemo(() => {
        let filtered = enrichedMatters;

        // Status Filter
        if (statusFilter !== 'All') {
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            const twoDays = 2 * oneDay;
            const sevenDays = 7 * oneDay;
            const fourteenDays = 14 * oneDay;

            if (statusFilter === 'New') {
                filtered = filtered.filter(m => (now - new Date(m.createdAt || 0).getTime()) < sevenDays);
            } else if (statusFilter === 'Recent') {
                filtered = filtered.filter(m => (now - new Date(m.stageLastUpdated || m.createdAt || 0).getTime()) < twoDays);
            } else if (statusFilter === 'Stale') {
                filtered = filtered.filter(m => (now - new Date(m.stageLastUpdated || m.createdAt || 0).getTime()) > fourteenDays);
            } else if (statusFilter === 'Reviewed') {
                filtered = filtered.filter(m => (now - new Date(m.stageLastUpdated || m.createdAt || 0).getTime()) < oneDay);
            } else {
                filtered = filtered.filter(m => m.status === statusFilter);
            }
        }

        // Search Filter
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            filtered = filtered.filter(m =>
                m.title.toLowerCase().includes(lower) ||
                m.referenceNumber.toLowerCase().includes(lower) ||
                contacts.find(c => c.id === m.clientId)?.name.toLowerCase().includes(lower)
            );
        }

        // Default sort by updated/created
        return filtered.sort((a, b) => {
            const dateA = new Date(a.stageLastUpdated || a.createdAt || 0).getTime();
            const dateB = new Date(b.stageLastUpdated || b.createdAt || 0).getTime();
            return dateB - dateA;
        });
    }, [matters, searchTerm, statusFilter, contacts]);


    // Detail View Data Preparation
    const selectedMatter = useMemo(() => {
        if (!selectedId) return null;
        // Use the RAW matter from appState to ensure we have the clean object for the DetailView, 
        // though EnrichedMatter is compatible, finding it in appState is safer for updates
        return matterState.matters.find(m => m.id === selectedId);
    }, [selectedId, matterState.matters]);

    if (!currentUser) return null; // Guard against null user

    return (
        <div className="flex h-full w-full bg-white dark:bg-zinc-900 border-x border-slate-200 dark:border-zinc-800 overflow-hidden">
            {/* Left Sidebar (Matter List) */}
            <div className={`w-full md:w-80 flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 ${selectedId ? 'hidden md:flex' : 'flex'}`}>

                {/* Header */}
                <div className="sticky top-0 z-10 glass flex-shrink-0 p-4 border-b border-slate-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-xl text-slate-900 dark:text-white">Matters</h3>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => openModal('matterIngestion')}
                                className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all shadow-sm text-xs font-bold"
                                title="Bulk Ingest Matters"
                            >
                                <CloudArrowUpIcon className="w-4 h-4" /> Ingest
                            </button>
                            <button
                                onClick={() => openModal('newMatter')}
                                className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-opacity shadow-sm text-xs font-bold"
                            >
                                <PlusIcon className="w-4 h-4" /> New
                            </button>
                        </div>
                    </div>

                    <div className="relative mb-3">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input autoComplete="off" data-lpignore="true" 
                            type="text"
                            placeholder="Search matters..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
                        {(['Active', 'Recent', 'New', 'Stale', 'Reviewed', 'Pending', 'Archived', 'All'] as const).map(status => (
                            <button key={status} onClick={() => setStatusFilter(status)}
                                className={`${status === statusFilter ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 bg-slate-100 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'} whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-bold transition-all`}>
                                {status}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List Content */}
                <div className="flex-grow overflow-y-auto scroll-smooth-ios custom-scrollbar pb-nav">
                    {sortedMatters.length > 0 ? (
                        <div className="space-y-3 p-2">
                            {sortedMatters.map((matter) => (
                                <MatterSidebarItem
                                    key={matter.id}
                                    matter={matter}
                                    clientName={contacts.find(c => c.id === matter.clientId)?.name || 'Unknown Client'}
                                    isActive={selectedId === matter.id}
                                    onClick={() => onViewDetails(matter.id)}
                                    openModal={openModal}
                                />
                            ))}
                        </div>
                    ) : (
                        <EmptyState
                            title="No Matters"
                            description={searchTerm ? "No matches found." : "No matters in this category."}
                            icon={<MattersIcon className="w-full h-full" />}
                            actionLabel={!searchTerm ? "Create Matter" : undefined}
                            onAction={!searchTerm ? () => openModal('newMatter') : undefined}
                        />
                    )}
                </div>
            </div>

            {/* Right Panel (Detail View) */}
            <div className={`flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-zinc-900 ${!selectedId ? 'hidden md:flex' : 'flex'}`}>
                {selectedMatter ? (
                    <MatterDetailView />
                ) : (
                    <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-zinc-500">
                        <div className="w-24 h-24 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6 shadow-iner">
                            <MattersIcon className="w-10 h-10 text-slate-300 dark:text-zinc-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 dark:text-zinc-300 mb-2">Select a Matter</h3>
                        <p className="max-w-md mx-auto">Choose a matter from the list to view details, manage tasks, documents, and finances.</p>
                    </div>
                )}
            </div>
        </div >
    );
};

export default MatterListView;
