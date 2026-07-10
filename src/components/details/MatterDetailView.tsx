
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MoreVertical, ListChecks } from 'lucide-react';
import { Matter, WorkflowDefinition, User, Document, Task, TimeEntry, Expense, CalendarEvent, Invoice, CustomEventType, NotePage, ClientMessage, FirmDetails, ModalType, AppMode, Contact, View, TaskStatus, MatterType } from '../../types';
import { ChevronRightIcon, GavelIconLarge, ScalesIcon, CogIcon, TrashIcon, CloudArrowUpIcon, LockClosedIcon, EditIcon } from '../../constants';
import { useUI } from '../../contexts/UIContext';
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { usePermissions } from '../../hooks/usePermissions';
import MatterStageTracker from '../MatterStageTracker';
import BillingSummaryWidget from './BillingSummaryWidget';
import { DocumentsTab } from './DocumentsTab';
import { TasksAndEventsTab } from './TasksAndEventsTab';

// Matter types that involve court proceedings, judgements, or formal endorsements.
// All other types are considered transactional/non-contentious.
const CONTENTIOUS_MATTER_TYPES: string[] = [
    MatterType.CivilLitigation,
    MatterType.CriminalDefense,
    MatterType.FamilyLaw,
    MatterType.EmploymentLabor,
];
import TeamDiscussionTab from './TeamDiscussionTab';
// import ActivityLogTab from './ActivityLogTab'; // Removed
// import { AiIntakeAnalysis } from './AiIntakeAnalysis'; // Removed
// import FilingDeadlineNotice from './FilingDeadlineNotice'; // Removed
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useExecutionState } from '../../contexts/ExecutionContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { MatterBrief } from './MatterBrief'; // NOTE: kept for now in case we want to re-mount parts of it under Endorsements later. Safe to remove after launch.
import BacklinksPanel from '../BacklinksPanel'; // NOTE: backlinks panel is currently non-functional (no persistence layer). Kept for future wiring.
import ErrorBoundary from '../ErrorBoundary';
import { MattersSkeleton } from '../toolkit/Skeleton';

const TabButton: React.FC<{ label: string; isActive: boolean; onClick: () => void; badgeCount?: number }> = ({ label, isActive, onClick, badgeCount }) => (
    <button
        onClick={onClick}
        className={`flex-none text-center relative whitespace-nowrap py-3 px-4 border-b-2 font-semibold text-sm transition-colors ${isActive
            ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-900/10'
            : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
    >
        {label}
        {badgeCount !== undefined && badgeCount > 0 && (
            <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse">
                {badgeCount}
            </span>
        )}
    </button>
);

const SlimDetailItem: React.FC<{ label: string, value: React.ReactNode, icon?: React.ReactNode }> = ({ label, value, icon }) => (
    <div className="flex flex-col justify-center min-w-0">
        <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest truncate mb-0.5 leading-none">{label}</span>
        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-zinc-200 truncate w-full leading-tight">
            {icon && <span className="opacity-60 flex-shrink-0 -mt-0.5 scale-90">{icon}</span>}
            <span className="truncate">{value}</span>
        </div>
    </div>
);

type MatterTab = 'notes' | 'schedule_tasks' | 'billing' | 'documents';

const MatterDetailViewContent: React.FC = () => {
    const { addToast, closeModal, openModal, navigateTo, selectedId, currentHistoryEntry, updateCurrentHistoryEntry } = useUI();
    const { matterState, matterActions } = useMatterState();
    const { coreState, coreActions } = useCoreState();
    const { documentState, documentActions } = useDocumentState();
    const { executionState, executionActions } = useExecutionState();
    const { financeState, financeActions } = useFinanceState();
    const { currentUser } = useAuth();
    const { canViewBilling } = usePermissions();
    const setMatterPrivacyMutation = useMutation(api.myFunctions.setMatterPrivacy);
    const [privacyLoading, setPrivacyLoading] = useState(false);
    
    // On-demand fetch for deep-linking/refresh scenarios
    const onDemandMatter = useQuery(
        api.myFunctions.getMatterDetails, 
        (!matterState.matters.find(m => m.id === selectedId) && selectedId && currentUser?.firmId) 
            ? { matterId: selectedId, firmId: currentUser.firmId } 
            : 'skip'
    );

    // Track whether the on-demand query is still loading (undefined = loading, null = not found)
    const isOnDemandLoading = selectedId && onDemandMatter === undefined && !matterState.matters.find(m => m.id === selectedId);

    // TASK: Timeout fallback — if the on-demand query takes more than 8 seconds,
    // stop showing the skeleton and show a "not found" message instead.
    // This prevents the indefinite skeleton hang on slow connections (APK).
    const [hasTimedOut, setHasTimedOut] = useState(false);
    useEffect(() => {
        if (!isOnDemandLoading) {
            setHasTimedOut(false);
            return;
        }
        const timer = setTimeout(() => setHasTimedOut(true), 8000);
        return () => clearTimeout(timer);
    }, [isOnDemandLoading, selectedId]);

    // ── Derived helpers wired to contexts ──────────────────────────────────────
    const users = coreState.users;
    const onGoBack = () => navigateTo('matters');
    const onUpdateStage = (id: string, stage: string) => matterActions.updateMatter({ id, stage, stageLastUpdated: new Date().toISOString() });
    const onUpdateMatter = (m: any) => matterActions.updateMatter(m);
    const handleUpdateTaskStatus = (taskId: string, status: any) => executionActions.handleUpdateTaskStatus(taskId, status);
    const onDeleteTimeEntry = (id: string) => financeActions.deleteTimeEntry(id, 'Time Entry');
    const onDeleteExpense = (id: string) => financeActions.deleteExpense(id, 'Expense');
    const onViewDocumentDetails = (id: string) => navigateTo('documentDetail', id);
    
    const matterData = useMemo(() => {
        const inState = matterState.matters.find(m => m.id === selectedId);
        if (inState) return inState;
        return onDemandMatter ? onDemandMatter : null;
    }, [matterState.matters, selectedId, onDemandMatter]);
    
    // Filtered data for this matter — all computed unconditionally so hooks always fire in same order
    const documents = useMemo(() => {
        if (onDemandMatter?.documents) return onDemandMatter.documents;
        return documentState.documents.filter(d => d.matterId === selectedId);
    }, [documentState.documents, selectedId, onDemandMatter]);

    const tasks = useMemo(() => {
        if (onDemandMatter?.tasks) return onDemandMatter.tasks;
        return executionState.tasks.filter(t => t.matterId === selectedId);
    }, [executionState.tasks, selectedId, onDemandMatter]);

    const timeEntries = useMemo(() => {
        if (onDemandMatter?.timeEntries) return onDemandMatter.timeEntries;
        return financeState.timeEntries.filter(t => t.matterId === selectedId);
    }, [financeState.timeEntries, selectedId, onDemandMatter]);

    const expenses = useMemo(() => {
        if (onDemandMatter?.expenses) return onDemandMatter.expenses;
        return financeState.expenses.filter(e => e.matterId === selectedId);
    }, [financeState.expenses, selectedId, onDemandMatter]);

    const events = useMemo(() => {
        if (onDemandMatter?.events) return onDemandMatter.events;
        return executionState.events.filter(e => e.matterId === selectedId);
    }, [executionState.events, selectedId, onDemandMatter]);

    const invoices = useMemo(() => {
        // Invoices aren't part of getMatterDetails yet, stick to filter or add later
        return financeState.invoices.filter(i => i.matter && i.matter.id === selectedId);
    }, [financeState.invoices, selectedId]);

    const notePages = useMemo(() => {
        if (onDemandMatter?.notes) return onDemandMatter.notes;
        return documentState.notePages.filter(n => n.matterId === selectedId);
    }, [documentState.notePages, selectedId, onDemandMatter]);

    const resolveTab = (t?: string): MatterTab => {
        if (t === 'endorsements_logs' || t === 'endorsements') return 'notes';
        // Legacy aliases: 'overview' (old Brief tab) and 'processes' both
        // redirect to 'notes' (Endorsements) since the Brief tab was removed
        // per user request — it was non-functional.
        if (t === 'processes' || t === 'overview' || t === 'brief') return 'notes';
        const validTabs: MatterTab[] = ['notes', 'schedule_tasks', 'billing', 'documents'];
        return validTabs.includes(t as MatterTab) ? (t as MatterTab) : 'notes'; // default to Endorsements (first tab)
    };

    const initialTab = currentHistoryEntry.initialTab || currentHistoryEntry.context?.initialTab;
    const [activeTab, setActiveTab] = useState<MatterTab>(resolveTab(initialTab));
    const [showWorkflow, setShowWorkflow] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [updatingStage, setUpdatingStage] = useState<string | null>(null);

    // Robust persistent baseline logic per tab
    const getTabBaseline = (tab: MatterTab) => {
        const matterId = matterData?.id || selectedId || '';
        const key = `matter_v3_${matterId}_${currentUser?.id}_${tab}`;
        const stored = localStorage.getItem(key);
        return stored ? parseInt(stored, 10) : 0;
    };

    const updateTabBaseline = (tab: MatterTab) => {
        const matterId = matterData?.id || selectedId || '';
        const key = `matter_v3_${matterId}_${currentUser?.id}_${tab}`;
        localStorage.setItem(key, Date.now().toString());
    };

    // When entering the view or changing tabs, mark the CURRENT active tab as read
    useEffect(() => {
        if (!matterData) return;
        updateTabBaseline(activeTab);
        return () => { updateTabBaseline(activeTab); };
    }, [activeTab, matterData?.id]);

    // Auto-initialize baseline for new matters to avoid "everything is unread" shock
    useEffect(() => {
        if (!matterData) return;
        const isNewMatter = matterData.createdAt && (Date.now() - new Date(matterData.createdAt).getTime() < 60000);
        if (isNewMatter) {
            ['overview', 'notes', 'schedule_tasks', 'billing'].forEach(t => {
                if (getTabBaseline(t as MatterTab) === 0) {
                    updateTabBaseline(t as MatterTab);
                }
            });
        }
    }, [matterData?.id, matterData?.createdAt]);

    // Is this a contentious matter type that requires formal court endorsements?
    const isContentious = matterData ? CONTENTIOUS_MATTER_TYPES.includes(matterData.type) : false;

    const tabBadges = useMemo(() => {
        const checkUnread = (tab: MatterTab, items: any[], dateField: string, authorField: string = 'authorId') => {
            if (activeTab === tab) return 0;
            const baseline = getTabBaseline(tab);
            return items.filter(item => {
                const date = item[dateField];
                const authorId = String(item[authorField] || item.creatorId || item.uploadedBy || '');
                const currentUserId = String(currentUser?.id);
                if (!date || authorId === currentUserId) return false;
                return new Date(date).getTime() > baseline;
            }).length;
        };

        // Note badge counts both plain notes AND endorsements
        const noteItems = notePages.filter((n: any) => n.matterId === matterData?.id && (n.type === 'user' || n.type === 'endorsement'));

        return {
            docs: checkUnread('documents', documents, 'dateFiled'),
            tasks: checkUnread('schedule_tasks', tasks, 'createdAt') + checkUnread('schedule_tasks', events, 'created_at'),
            notes: checkUnread('notes', noteItems, 'createdAt'),
            finance: canViewBilling ? checkUnread('billing', invoices, 'issueDate') : 0
        };
    }, [documents, tasks, events, notePages, invoices, currentUser?.id, matterData?.id, activeTab, canViewBilling]);

    const client = matterState.contacts.find(c => c.id === matterData?.clientId);
    const workflow = executionState.workflows.find(w => w.type === matterData?.type);

    const stages = useMemo(() => {
        if (!workflow) return [];
        if (matterData?.subCategory && workflow.subCategories && workflow.subCategories[matterData.subCategory]) {
            return workflow.subCategories[matterData.subCategory].stages || [];
        }
        return workflow.default?.stages || [];
    }, [workflow, matterData?.subCategory]);

    const handleTabClick = (tab: MatterTab) => {
        setActiveTab(tab);
        // Persist tab state in history context so it's remembered when navigating back
        if (updateCurrentHistoryEntry) {
            updateCurrentHistoryEntry({ context: { ...currentHistoryEntry?.context, initialTab: tab } });
        }
    };



    const handleStageUpdate = async (newStage: string) => {
        setUpdatingStage(newStage);
        // Simulate a brief delay to show the spinner/proactive feedback as requested by user
        // This makes the interaction feel more substantial before the optimistic update takes over
        await new Promise(resolve => setTimeout(resolve, 800));

        onUpdateStage(matterData!.id, newStage);
        addToast(`Matter moved to ${newStage}`, { type: 'success' });
        setUpdatingStage(null);
    };

    const confirmDelete = () => {
        const associatedTaskCount = tasks.length;
        const associatedDocCount = documents.length;
        const associatedNoteCount = notePages.filter((n: any) => n.matterId === matterData!.id).length;
        const associatedEventCount = events.length;

        openModal('deleteConfirmation', matterData!.id, {
            title: `Delete Matter "${matterData!.title}"?`,
            message: (
                <div className="space-y-3">
                    <p>Are you sure you want to <strong>permanently delete</strong> this matter?</p>
                    
                    <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl space-y-2">
                        <p className="text-red-700 dark:text-red-400 font-bold text-xs uppercase tracking-wider">Associated Data Blast Radius:</p>
                        <ul className="text-xs text-red-600 dark:text-red-400 space-y-1 font-medium">
                            {associatedTaskCount > 0 && <li>• {associatedTaskCount} Tasks will be deleted</li>}
                            {associatedDocCount > 0 && <li>• {associatedDocCount} Documents will be deleted</li>}
                            {associatedNoteCount > 0 && <li>• {associatedNoteCount} Endorsements/Notes will be deleted</li>}
                            {associatedEventCount > 0 && <li>• {associatedEventCount} Calendar Events will be removed</li>}
                        </ul>
                    </div>

                    <p className="text-slate-500 dark:text-zinc-400 text-xs italic">
                        Warning: This action cannot be undone. All private matter data will be permanently wiped.
                    </p>
                </div>
            ),
            onConfirm: async () => {
                if (!matterData) return;
                try {
                    await matterActions.deleteMatter(matterData.id, matterData.title);
                    closeModal();
                    onGoBack();
                } catch (err: any) {
                    console.error('[MatterDetailView] Delete failed:', err);
                    // Keep modal open so user sees the error
                }
            },
            confirmText: 'Delete Everything',
            confirmButtonClass: 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/30'
        });
    };

    const handleDraftDocument = () => { if (matterData) navigateTo('editor', null, { matterId: matterData.id }); };

    const handleTogglePrivacy = async () => {
        if (!matterData || !currentUser?.firmId || !currentUser?.id) return;
        setPrivacyLoading(true);
        try {
            await setMatterPrivacyMutation({
                matterId: matterData.id,
                firmId: currentUser.firmId,
                isPrivate: !(matterData as any).isPrivate,
                requestUserId: currentUser.id,
            });
            addToast((matterData as any).isPrivate ? 'Matter is now visible to all firm members.' : 'Matter is now private — only assigned team members can access it.', { type: 'success' });
        } catch (err: any) {
            addToast(err?.message || 'Could not update matter privacy.', { type: 'error' });
        } finally {
            setPrivacyLoading(false);
        }
    };


    const formattedDate = useMemo(() => {
        if (!matterData?.createdAt && !matterData?.stageLastUpdated) return 'Unknown';
        try { return new Date(matterData.createdAt || matterData.stageLastUpdated || '').toLocaleDateString('en-GB'); } catch (e) { return 'Invalid Date'; }
    }, [matterData?.createdAt, matterData?.stageLastUpdated]);

    // All hooks have now been called; safe to execute early returns.
    if (isOnDemandLoading && !hasTimedOut) {
        return <MattersSkeleton />;
    }
    if (!matterData) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                <p className="text-lg font-medium mb-2">{hasTimedOut ? 'Taking too long to load' : 'Matter not found'}</p>
                <p className="text-sm text-slate-400 mb-4">{hasTimedOut ? 'Your connection may be slow. Try going back and opening the matter again.' : 'This matter may have been deleted or you may not have access.'}</p>
                <button onClick={onGoBack} className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg font-bold text-sm hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
                    Back to Matters
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-900">
            <header className="sticky top-0 z-10 glass flex-shrink-0 border-b border-slate-200 dark:border-zinc-800 shadow-sm">
                <div className="px-4 pt-3 sm:px-6">
                    <div className="flex items-center justify-between mb-2">
                        <button onClick={onGoBack} className="flex items-center text-[10px] font-bold uppercase text-slate-400 hover:text-primary-600 transition-colors">
                            <ChevronRightIcon className="w-3 h-3 rotate-180 mr-1" /> Back
                        </button>
                        <div className="flex items-center gap-1.5">
                            {/* Open in new tab — desktop only */}
                            <button
                                onClick={() => window.open(window.location.href, '_blank')}
                                className="hidden md:flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                title="Open in new tab"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                </svg>
                            </button>
                            {/* Workflow Progress toggle icon */}
                            <button
                                onClick={() => setShowWorkflow(v => !v)}
                                title="Workflow Progress"
                                className={`p-1.5 rounded-lg transition-colors ${showWorkflow ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}
                            >
                                <ListChecks className="w-4 h-4" />
                            </button>

                            {/* ⋮ More menu */}
                            <div className="relative">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowMoreMenu(m => !m); }}
                                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                    title="More actions"
                                >
                                    <MoreVertical className="w-4 h-4" />
                                </button>
                                {showMoreMenu && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                                        <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-slate-200 dark:border-zinc-700 py-1 overflow-hidden">
                                            <button
                                                onClick={() => { setShowMoreMenu(false); openModal('editMatter', matterData.id); }}
                                                className="w-full px-3 py-2.5 text-[11px] font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 text-left flex items-center gap-2"
                                            >
                                                <EditIcon className="w-3.5 h-3.5 shrink-0" /> Edit Matter
                                            </button>
                                            <button
                                                onClick={() => { setShowMoreMenu(false); handleTogglePrivacy(); }}
                                                disabled={privacyLoading}
                                                className={`w-full px-3 py-2.5 text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-zinc-700 text-left flex items-center gap-2 ${(matterData as any).isPrivate ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-zinc-300'}`}
                                            >
                                                <LockClosedIcon className="w-3.5 h-3.5 shrink-0" />
                                                {(matterData as any).isPrivate ? 'Remove Privacy' : 'Make Private'}
                                                {privacyLoading && <span className="ml-auto text-[10px] opacity-60">...</span>}
                                            </button>
                                            {currentUser?.role === 'Admin' && (
                                                <button
                                                    onClick={() => { setShowMoreMenu(false); openModal('editWorkflow', workflow?.id, { subCategoryName: matterData.subCategory }); }}
                                                    className="w-full px-3 py-2.5 text-[11px] font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 text-left flex items-center gap-2"
                                                >
                                                    <CogIcon className="w-3.5 h-3.5 shrink-0" /> Edit Workflow
                                                </button>
                                            )}
                                            <div className="my-1 border-t border-slate-100 dark:border-zinc-700" />
                                            <button
                                                onClick={() => { setShowMoreMenu(false); confirmDelete(); }}
                                                className="w-full px-3 py-2.5 text-[11px] font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-left flex items-center gap-2"
                                            >
                                                <TrashIcon className="w-3.5 h-3.5 shrink-0" /> Delete Matter
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                        </div>
                    </div>
                    <div className="mb-1">
                        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-tight truncate">{matterData.title}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-slate-400">{matterData.referenceNumber}</span>
                        </div>
                    </div>
                    {showWorkflow && (
                        <div className="mb-2">
                            {stages && stages.length > 0 ? (
                                <MatterStageTracker currentStage={matterData.stage} stages={stages} onStageChange={handleStageUpdate} updatingStage={updatingStage} />
                            ) : (
                                <div className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs rounded border border-amber-200 dark:border-amber-800 flex items-center justify-between">
                                    <span><strong>Safe Mode:</strong> Workflow definition missing.</span>
                                    <button onClick={() => openModal('editMatter', matterData.id)} className="underline font-bold">Edit Matter Type</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>



                <nav className="flex w-full overflow-x-auto custom-scrollbar border-t border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                    {/* Tab order: Endorsements (first) → Tasks → Finance → Documents (last).
                        The 'Brief' tab was removed per user request — it was non-functional
                        (MatterBrief component rendered mostly-empty widgets that duplicated
                        info already shown in Endorsements and Tasks). */}
                    <TabButton label="Endorsements" isActive={activeTab === 'notes'} onClick={() => handleTabClick('notes')} badgeCount={tabBadges.notes} />
                    <TabButton label="Tasks" isActive={activeTab === 'schedule_tasks'} onClick={() => handleTabClick('schedule_tasks')} badgeCount={tabBadges.tasks} />
                    {canViewBilling && <TabButton label="Finance" isActive={activeTab === 'billing'} onClick={() => handleTabClick('billing')} />}
                    <TabButton label="Documents" isActive={activeTab === 'documents'} onClick={() => handleTabClick('documents')} badgeCount={tabBadges.docs} />
                </nav>
            </header>

            <main className="flex-grow overflow-y-auto custom-scrollbar p-4 bg-slate-50 dark:bg-zinc-900">
                <div className="max-w-5xl mx-auto">

                    {activeTab === 'notes' ? (
                        <div className="space-y-4">
                            <div>
                                <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200 dark:border-zinc-700">
                                    <div className="w-1 h-5 bg-primary-500 rounded-full" />
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">Endorsements</h3>
                                </div>
                                <TeamDiscussionTab
                                    matterId={matterData.id}
                                    notes={notePages}
                                    users={users}
                                    currentUser={currentUser || {} as User}
                                    onAddNote={(matterId, title, content, type) => documentActions.handleAddMatterNote(matterId, title, content)}
                                    onUpdateNote={(note) => documentActions.handleUpdatePageContent(note.id, note.title, note.content)}
                                    onDeleteNote={(id, title) => documentActions.onDeletePage(id)}
                                    openModal={openModal}
                                    lastViewedAt={getTabBaseline('notes')}
                                    filterType="all"
                                />
                            </div>
                            {/* Bidirectional backlinks — notes that mention this matter via [[Matter Title]].
                                Uses real-time content-based matching: scans all notes for [[...]] patterns
                                that match this matter's title. No schema migration needed. */}
                            <BacklinksPanel
                                entityId={matterData.id}
                                entityType="matter"
                                entityLabel={matterData.title}
                                notes={documentState.notePages || []}
                                navigateTo={navigateTo}
                            />
                        </div>
                    ) : activeTab === 'schedule_tasks' ? (
                        <TasksAndEventsTab
                            tasks={tasks}
                            events={events}
                            matterId={matterData.id}
                            matter={matterData}
                            documents={documents}
                            openModal={openModal}
                            onUpdateTaskStatus={handleUpdateTaskStatus}
                            lastViewedAt={getTabBaseline('schedule_tasks')}
                            currentUser={currentUser || {} as User}
                            navigateTo={navigateTo}
                        />
                    ) : activeTab === 'billing' ? (
                        !canViewBilling ? null : <BillingSummaryWidget matter={matterData} timeEntries={timeEntries} expenses={expenses} invoices={invoices} openModal={openModal} onDeleteTimeEntry={onDeleteTimeEntry} onDeleteExpense={onDeleteExpense} navigateTo={navigateTo} />
                    ) : activeTab === 'documents' ? (
                        // Top-level Documents tab — promoted from the Brief sub-tab
                        // so the matter detail page has a cleaner tab order.
                        <div className="min-h-[400px]">
                            <DocumentsTab
                                documents={documents}
                                matterId={matterData.id}
                                openModal={openModal}
                                onViewDocumentDetails={onViewDocumentDetails}
                                users={users}
                                onDraftDocument={handleDraftDocument}
                                variant="embedded"
                                lastViewedAt={getTabBaseline('documents')}
                            />
                        </div>
                    ) : null}
                </div>
            </main>
        </div>
    );
};

export const MatterDetailView: React.FC = () => (
    <ErrorBoundary>
        <MatterDetailViewContent />
    </ErrorBoundary>
);
