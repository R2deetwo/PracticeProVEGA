
import React, { useState, useEffect } from 'react';
import { useMatterState } from '../contexts/MatterContext';
import { useDocumentState } from '../contexts/DocumentContext';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ResearchNotebookColumn } from './research/ResearchNotebookColumn';
import { ResearchSourceColumn } from './research/ResearchSourceColumn';
import { ResearchChat } from './research/ResearchChat';
import { ResearchStudio } from './research/ResearchStudio';
import LawReportsView from './research/LawReportsView';
import NotesView from './NotesView';
import ErrorBoundary from './ErrorBoundary';
import { ChevronRightIcon, LockClosedIcon, ResearchIcon, PlusIcon } from '../constants';
import { useFeatures } from '../hooks/useFeatures';
import { readHashContext, type ContextResult } from '../utils/tabNavigation';

/** Helper: extract context from ContextResult, log on error */
function extractContext(result: ContextResult): Record<string, any> {
    if (result.status === 'ok') return result.context;
    if (result.status === 'error') {
        console.warn('[ResearchView] Context decode error:', result.reason);
    }
    return {};
}

const ResearchPlaceholder: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 dark:text-zinc-500 p-8">
        {/* Use the SAME ResearchIcon that appears in the sidebar navigation
            so the page is visually consistent with its entry point. */}
        <div className="w-20 h-20 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mb-4">
            <ResearchIcon className="w-12 h-12 text-primary-500 dark:text-primary-400" />
        </div>
        <h3 className="mt-2 text-lg font-semibold text-slate-600 dark:text-zinc-300">PracticePro Research</h3>
        <p className="mt-2 text-sm max-w-sm">Create a notebook to organise your case sources and run AI-powered legal analysis.</p>
        <button
            onClick={onClick}
            className="mt-5 px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 text-sm"
        >
            Create Your First Notebook
        </button>
    </div>
);

type ResearchTab = 'research_notes' | 'case_law' | 'notes';

const ResearchView: React.FC = () => {
    const { matterState } = useMatterState();
    const { documentState } = useDocumentState();
    const { coreState } = useCoreState();
    const dataHandlers = useDataActions();
    const { openModal, closeModal, currentHistoryEntry, updateCurrentHistoryEntry, navigateTo } = useUI();
    const { currentUser } = useAuth();
    const { canUseResearchStudio } = useFeatures();

    const [activeTab, setActiveTab] = useState<ResearchTab>('research_notes');
    const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
    const [mobileWorkspaceView, setMobileWorkspaceView] = useState<'notebooks' | 'chat' | 'sources' | 'studio'>('chat');
    const [isSaving, setIsSaving] = useState(false);

    // ─── Prompt-First Research Pipeline state ──────────────────────────
    // When the user arrives from DraftPro's citation panel, the context
    // may include a `prefillQuery` (AI-generated search query) that should
    // be pre-filled into the chat input but NOT auto-sent. We store these
    // here so ResearchChat can read them.
    const [prefillState, setPrefillState] = useState<{
        query: string;
        context?: string;
        documentTitle?: string;
    } | null>(null);

    const selectedNotebookId = currentHistoryEntry.selectedResearchNotebookId || null;

    // ─── Bridge: ALOA / DraftPro may send `selectedNotebookId` (camelCase)
    //     in either the in-app context OR the URL hash. Map it to the
    //     internal `selectedResearchNotebookId` field. Also reads the hash
    //     for the new-tab case.
    //
    // FIX: Do NOT strip the hash after reading. The hash is the durable,
    // refresh-proof source of truth. Instead, use a processed-flag keyed
    // by the context's `id` field to prevent re-triggering.
    const [processedCtxId, setProcessedCtxId] = useState<string | null>(null);
    useEffect(() => {
        const ctx =
            currentHistoryEntry?.context ||
            (window.history.state?.state as any) ||
            extractContext(readHashContext()) ||
            {};
        // Idempotency: skip if we've already processed this context
        const ctxId = ctx.id || ctx.selectedNotebookId || 'unknown';
        if (ctxId === processedCtxId) return;
        if (ctx.selectedNotebookId && !currentHistoryEntry.selectedResearchNotebookId) {
            updateCurrentHistoryEntry({ selectedResearchNotebookId: ctx.selectedNotebookId });
            setProcessedCtxId(ctxId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentHistoryEntry?.context, processedCtxId]);

    // ─── Auto-create notebook from DraftPro "Send to Research" ────────
    // When the user clicks "Send to Research" in DraftPro, we navigate
    // here with context containing: autoStartResearch, researchQuery, sources.
    //
    // Context can arrive via TWO channels:
    //   1. In-app navigation: `currentHistoryEntry.context` (SPA router state)
    //   2. New-tab navigation: `#__ctx=<base64>` URL hash fragment
    //      (decoded by `readHashContext()`). This is the path used when
    //      DraftPro opens Research in a new browser tab via openInNewTab().
    //
    // This effect handles BOTH. Two modes:
    //   (a) Auto-start mode (autoStartResearch=true): creates notebook,
    //       adds sources, auto-sends the research query as first message.
    //   (b) Prompt-First mode (prefillQuery set): creates notebook, adds
    //       sources, but does NOT auto-send. Instead, stores the prefill
    //       query in state so ResearchChat can pre-fill the input and
    //       wait for the user to press Enter.
    const [hasProcessedResearchContext, setHasProcessedResearchContext] = useState(false);
    useEffect(() => {
        if (hasProcessedResearchContext) return;
        const ctx =
            currentHistoryEntry?.context ||
            (window.history.state?.state as any) ||
            extractContext(readHashContext()) ||
            {};
        const hasSources = ctx.sources && Array.isArray(ctx.sources) && ctx.sources.length > 0;
        const shouldStart = (ctx.autoStartResearch || ctx.promptFirstMode) && hasSources;
        if (!shouldStart) return;
        setHasProcessedResearchContext(true);
        // FIX: Do NOT strip the hash — it's the durable source of truth.
        // The hasProcessedResearchContext flag prevents re-triggering.
        const sources: any[] = ctx.sources;
        const query: string = ctx.researchQuery || ctx.prefillQuery || 'Analyze these legal sources:';
        const docTitle: string = ctx.documentTitle || 'Draft Research';

        // Create a new research notebook
        const notebook = dataHandlers.handleAddResearchNotebook({
            name: `Citation Research — ${docTitle.substring(0, 40)}`,
            firmId: currentUser?.firmId || coreState?.firmDetails?.id || '',
            userId: currentUser?.id || '',
        });

        if (notebook?.id) {
            // Select the notebook
            updateCurrentHistoryEntry({ selectedResearchNotebookId: notebook.id });

            // Add each citation as a source
            for (const cite of sources) {
                dataHandlers.handleAddResearchSource(notebook.id, {
                    name: `[${cite.number}] ${cite.text.substring(0, 60)}`,
                    type: 'text',
                    content: `Citation [${cite.number}]: ${cite.text}\nType: ${cite.type}\nJurisdiction: ${cite.jurisdiction || 'N/A'}\nURL: ${cite.url || 'N/A'}`,
                });
            }

            if (ctx.promptFirstMode && ctx.prefillQuery) {
                // ─── Prompt-First mode: pre-fill, don't auto-send ───
                setPrefillState({
                    query: ctx.prefillQuery,
                    context: ctx.prefillContext,
                    documentTitle: docTitle,
                });
                // After the user sends the pre-filled query, the AI should
                // fire an automatic "invitation" message offering to
                // validate the loaded sources. We set a flag that the
                // first message from the user triggers this.
                // (The ResearchChat component handles the actual prefill UX;
                //  the invitation message is sent by the AI backend when it
                //  receives the user's first query with the loaded sources.)
            } else {
                // ─── Auto-start mode: send the query immediately ───
                setTimeout(() => {
                    dataHandlers.handleSendResearchMessage(
                        notebook.id,
                        `${query}\n\nPlease verify each citation — confirm it exists, check the citation format is correct, and identify any potential issues. Provide a validity assessment for each source.`,
                        []
                    );
                }, 500);
            }
        }
        // FIX: Hash is no longer stripped — it survives refresh as the
        // durable source of truth. hasProcessedResearchContext prevents
        // re-triggering on the same page session.
    }, [currentHistoryEntry?.context, hasProcessedResearchContext]);

    const handleSelectNotebook = (id: string) => {
        updateCurrentHistoryEntry({ selectedResearchNotebookId: id });
        const initialSources = documentState.researchSources.filter(s => s.notebookId === id).map(s => s.id);
        setSelectedSourceIds(initialSources);
        setMobileWorkspaceView('chat');
    };

    const confirmDeleteNotebook = (notebookId: string, notebookName: string) => {
        openModal('deleteConfirmation', notebookId, {
            title: `Delete Notebook?`,
            message: `Are you sure you want to delete "${notebookName}" and all its contents? This cannot be undone.`,
            onConfirm: () => {
                if (selectedNotebookId === notebookId) {
                    updateCurrentHistoryEntry({ selectedResearchNotebookId: null });
                }
                dataHandlers.handleDeleteResearchNotebook(notebookId, notebookName);
                closeModal();
            },
        });
    };

    const handleBackToNotebooks = () => {
        updateCurrentHistoryEntry({ selectedResearchNotebookId: null });
    };

    const isAdmin = currentUser?.role === 'Admin';
    const userNotebooks = documentState.researchNotebooks.filter(nb => isAdmin || nb.userId === currentUser?.id);
    const selectedNotebook = userNotebooks.find(nb => nb.id === selectedNotebookId);
    const sourcesForNotebook = selectedNotebook ? documentState.researchSources.filter(s => s.notebookId === selectedNotebook.id) : [];

    const messagesForNotebook = (useQuery(
        api.myFunctions.getResearchMessages,
        selectedNotebook ? { notebookId: selectedNotebook.id } : "skip"
    ) || []).map((m: any) => ({ ...m, id: m._id || m.id }));

    const analysisResultsForNotebook = useQuery(
        api.myFunctions.getResearchAnalysisResults,
        selectedNotebook ? { notebookId: selectedNotebook.id } : "skip"
    ) || [];

    const toggleSourceSelection = (sourceId: string) => {
        setSelectedSourceIds(prev =>
            prev.includes(sourceId) ? prev.filter(id => id !== sourceId) : [...prev, sourceId]
        );
    };

    const prevSourcesRef = React.useRef<string[]>([]);
    React.useEffect(() => {
        const currentIds = sourcesForNotebook.map(s => s.id);
        const prevIds = prevSourcesRef.current;
        const newIds = currentIds.filter(id => !prevIds.includes(id));
        
        if (newIds.length > 0) {
            setSelectedSourceIds(prev => [...prev, ...newIds]);
        }
        prevSourcesRef.current = currentIds;
    }, [sourcesForNotebook]);

    const renderMyResearch = () => {
        // AI Notebooks (Research Studio) requires Growth+ plan
        if (!canUseResearchStudio) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <div className="max-w-md bg-white dark:bg-zinc-900 p-10 rounded-3xl shadow-xl border border-slate-100 dark:border-zinc-800 flex flex-col items-center">
                        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-6">
                            <LockClosedIcon className="w-8 h-8 text-indigo-500" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3">AI Research Studio Locked</h2>
                        <p className="text-slate-500 dark:text-zinc-400 leading-relaxed mb-6">
                            AI-powered legal analysis, notebook workspaces, and source synthesis are available on the Growth plan and above. Upgrade to unlock the full Research Studio.
                        </p>
                        <button
                            onClick={() => navigateTo('settings', null, { settingsTargetId: 'subscription-management' })}
                            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg"
                        >
                            Upgrade to Growth
                        </button>
                    </div>
                </div>
            );
        }

        if (userNotebooks.length === 0 && !selectedNotebookId) {
            return <ResearchPlaceholder onClick={() => openModal('newResearchNotebook')} />;
        }

        // ─── New 3-pane layout (desktop) ─────────────────────────────────
        // Notebooks (left, always visible) | Chat (center) | Sources+Studio (right, tabbed)
        // This fixes the previous UX issue where selecting a notebook made the
        // notebooks list disappear — users had to click "back" to switch.
        return (
            <div className="flex-grow flex h-full relative overflow-hidden bg-slate-50 dark:bg-zinc-900">
                {/* ─── Pane 1: Notebooks (always visible on desktop, slide-in on mobile) ─── */}
                <div className={`
                    absolute inset-0 z-30 bg-white dark:bg-zinc-900
                    md:static md:flex md:w-64 lg:w-72 flex-shrink-0 h-full border-r border-slate-200 dark:border-zinc-800
                    ${mobileWorkspaceView === 'notebooks' ? 'flex' : 'hidden md:flex'}
                `}>
                    <div className="w-full flex flex-col">
                        <ResearchNotebookColumn
                            notebooks={userNotebooks}
                            matters={matterState.matters}
                            selectedNotebookId={selectedNotebookId}
                            onSelect={(id) => {
                                handleSelectNotebook(id);
                                setMobileWorkspaceView('chat');
                            }}
                            openModal={openModal}
                            onDeleteNotebook={confirmDeleteNotebook}
                            isLoading={isSaving}
                        />
                    </div>
                </div>

                {/* ─── Pane 2: Chat (center) ─── */}
                {!selectedNotebook ? (
                    <div className="hidden md:flex flex-1 items-center justify-center text-slate-400 dark:text-zinc-500 text-center p-8">
                        <div className="max-w-sm">
                            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                                <ResearchIcon className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
                            </div>
                            <p className="font-semibold text-sm text-slate-600 dark:text-zinc-300">Select a notebook to begin</p>
                            <p className="mt-1.5 text-xs text-slate-400 dark:text-zinc-500 leading-relaxed">
                                Each notebook is a dedicated workspace for analyzing sources, drafting arguments, and chatting with AI.
                            </p>
                            <button
                                onClick={() => openModal('newResearchNotebook')}
                                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 transition-colors"
                            >
                                <PlusIcon className="w-3.5 h-3.5" />
                                New Notebook
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={`flex-1 min-w-0 h-full flex flex-col ${mobileWorkspaceView === 'notebooks' || mobileWorkspaceView === 'sources' || mobileWorkspaceView === 'studio' ? 'hidden md:flex' : 'flex'}`}>
                        {/* Mobile sub-header for navigation between panes */}
                        <div className="md:hidden flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
                            <button
                                onClick={() => setMobileWorkspaceView('notebooks')}
                                className="flex items-center text-2xs font-bold text-slate-500 uppercase tracking-wider"
                            >
                                <ChevronRightIcon className="w-3.5 h-3.5 rotate-180 mr-1" /> Notebooks
                            </button>
                            <span className="font-bold text-xs truncate max-w-[110px] text-slate-900 dark:text-white">{selectedNotebook.name}</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setMobileWorkspaceView('sources')}
                                    className={`text-2xs font-bold uppercase ${mobileWorkspaceView === 'sources' ? 'text-primary-600' : 'text-slate-400'}`}
                                >
                                    Sources
                                </button>
                                <button
                                    onClick={() => setMobileWorkspaceView('studio')}
                                    className={`text-2xs font-bold uppercase ${mobileWorkspaceView === 'studio' ? 'text-indigo-600' : 'text-slate-400'}`}
                                >
                                    Studio
                                </button>
                            </div>
                        </div>
                        <ResearchChat
                            notebookId={selectedNotebook.id}
                            messages={messagesForNotebook}
                            sources={sourcesForNotebook}
                            selectedSourceIds={selectedSourceIds}
                            onSendMessage={(notebookId, content, sIds) =>
                                dataHandlers.handleSendResearchMessage(notebookId, content, sIds, sourcesForNotebook)}
                            prefillQuery={prefillState?.query}
                            prefillContext={prefillState?.context}
                            prefillDocumentTitle={prefillState?.documentTitle}
                        />
                    </div>
                )}

                {/* ─── Pane 3: Sources + Studio (right, tabbed on desktop, slide-in on mobile) ─── */}
                {selectedNotebook && (
                    <div className={`
                        absolute inset-0 z-30 bg-white dark:bg-zinc-900
                        md:static md:flex md:w-[300px] lg:w-[360px] flex-shrink-0 h-full border-l border-slate-200 dark:border-zinc-800
                        ${mobileWorkspaceView === 'sources' || mobileWorkspaceView === 'studio' ? 'flex' : 'hidden md:flex'}
                    `}>
                        <div className="w-full flex flex-col">
                            {/* Desktop tab switcher — toggles between Sources and Studio in the right pane */}
                            <div className="hidden md:flex items-center gap-1 px-3 py-2 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 shrink-0">
                                <button
                                    onClick={() => setMobileWorkspaceView('sources')}
                                    className={`flex-1 px-3 py-1.5 text-2xs font-bold uppercase tracking-wider rounded-md transition-all ${
                                        mobileWorkspaceView !== 'studio'
                                            ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'
                                    }`}
                                >
                                    Sources ({sourcesForNotebook.length})
                                </button>
                                <button
                                    onClick={() => setMobileWorkspaceView('studio')}
                                    className={`flex-1 px-3 py-1.5 text-2xs font-bold uppercase tracking-wider rounded-md transition-all ${
                                        mobileWorkspaceView === 'studio'
                                            ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'
                                    }`}
                                >
                                    Studio
                                </button>
                            </div>

                            {/* Mobile back button */}
                            <div className="md:hidden flex items-center px-3 py-2 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
                                <button
                                    onClick={() => setMobileWorkspaceView('chat')}
                                    className="flex items-center text-2xs font-bold text-slate-500 uppercase tracking-wider"
                                >
                                    <ChevronRightIcon className="w-3.5 h-3.5 mr-1" /> Back to Chat
                                </button>
                            </div>

                            <div className="flex-1 min-h-0 overflow-hidden">
                                {mobileWorkspaceView === 'studio' ? (
                                    <div className="h-full">
                                        <ResearchStudio
                                            notebook={selectedNotebook}
                                            sources={sourcesForNotebook.filter(s => selectedSourceIds.includes(s.id))}
                                            analysisResults={analysisResultsForNotebook}
                                            openModal={openModal}
                                            navigate={navigateTo}
                                            onSwitchToChat={() => setMobileWorkspaceView('chat')}
                                            onClose={() => setMobileWorkspaceView('chat')}
                                        />
                                    </div>
                                ) : (
                                    /* Default: Sources panel (also shown when mobileWorkspaceView === 'chat' on desktop) */
                                    <div className="h-full">
                                        <ResearchSourceColumn
                                            notebookName={selectedNotebook.name}
                                            sources={sourcesForNotebook}
                                            selectedSourceIds={selectedSourceIds}
                                            onToggleSelection={toggleSourceSelection}
                                            onAddSource={() => openModal('addResearchSource', null, { notebookId: selectedNotebook.id })}
                                            onAddWebSource={(source) => {
                                                dataHandlers.handleAddResearchSource(selectedNotebook.id, {
                                                    name: source.name,
                                                    type: source.type,
                                                    content: source.content,
                                                });
                                            }}
                                            onDeleteSource={dataHandlers.handleDeleteResearchSource}
                                            onOpenInDraftPro={(source) => {
                                                navigateTo("editor", null, {
                                                    draftTitle: source.name,
                                                    draftContent: source.content || '',
                                                    disableAutoDraft: true,
                                                    openedByAloa: false,
                                                });
                                            }}
                                            isLoading={isSaving}
                                            onBack={() => setMobileWorkspaceView('chat')}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const tabDef: { id: ResearchTab; label: string; locked?: boolean }[] = [
        { id: 'research_notes', label: 'AI Notebooks', locked: !canUseResearchStudio },
        { id: 'case_law', label: 'Case Law' },
        { id: 'notes', label: 'Practice Notes' },
    ];

    return (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-zinc-900">
            <div className="sticky top-0 pt-safe z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center mb-0">
                {/* Page header: same ResearchIcon as the sidebar nav, paired
                    with the "Research" title and "PracticePro Research" subtitle
                    so the page identity matches its navigation entry point. */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
                        <ResearchIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">Research</h2>
                        <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 -mt-0.5 truncate">PracticePro Research</p>
                    </div>
                </div>
                <div className="p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg flex gap-1 border border-slate-200 dark:border-zinc-700 flex-shrink-0">
                    {tabDef.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-3 md:px-4 py-1.5 text-xs md:text-sm font-semibold rounded-md transition-all flex items-center gap-1.5 ${activeTab === tab.id ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'}`}
                        >
                            {tab.label}
                            {tab.locked && <LockClosedIcon className="w-3 h-3 text-slate-400" />}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-grow min-h-0 overflow-hidden">
                <ErrorBoundary>
                    {activeTab === 'research_notes' && renderMyResearch()}
                    {activeTab === 'case_law' && <LawReportsView />}
                    {activeTab === 'notes' && (
                        <div className="h-full overflow-hidden p-0 bg-transparent">
                            <NotesView noBox={true} />
                        </div>
                    )}
                </ErrorBoundary>
            </div>
        </div>
    );
};

export default ResearchView;
