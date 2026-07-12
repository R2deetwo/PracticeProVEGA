
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
import { ChevronRightIcon, LockClosedIcon, ResearchIcon } from '../constants';
import { useFeatures } from '../hooks/useFeatures';

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
    const [mobileWorkspaceView, setMobileWorkspaceView] = useState<'chat' | 'sources' | 'studio'>('chat');
    const [isSaving, setIsSaving] = useState(false);

    const selectedNotebookId = currentHistoryEntry.selectedResearchNotebookId || null;

    // ─── Auto-create notebook from DraftPro "Send to Research" ────────
    // When the user clicks "Send to Research" in DraftPro, we navigate
    // here with context containing: autoStartResearch, researchQuery, sources
    // This effect creates a notebook, adds the citations as sources, and
    // auto-starts the research chat with the query.
    const [hasProcessedResearchContext, setHasProcessedResearchContext] = useState(false);
    useEffect(() => {
        if (hasProcessedResearchContext) return;
        const ctx = currentHistoryEntry?.context || (window.history.state?.state as any) || {};
        if (ctx.autoStartResearch && ctx.sources && Array.isArray(ctx.sources) && ctx.sources.length > 0) {
            setHasProcessedResearchContext(true);
            const sources: any[] = ctx.sources;
            const query: string = ctx.researchQuery || 'Analyze these legal sources:';
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

                // Auto-send the research query as the first message
                setTimeout(() => {
                    dataHandlers.handleSendResearchMessage(
                        notebook.id,
                        `${query}\n\nPlease verify each citation — confirm it exists, check the citation format is correct, and identify any potential issues. Provide a validity assessment for each source.`,
                        []
                    );
                }, 500);
            }
        }
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

        return (
            <div className="flex-grow flex h-full relative overflow-hidden bg-slate-50 dark:bg-zinc-900">
                {!selectedNotebook && (
                    <>
                        <div className="w-full md:w-72 flex-shrink-0 h-full border-r border-slate-200 dark:border-zinc-800">
                            <ResearchNotebookColumn
                                notebooks={userNotebooks}
                                matters={matterState.matters}
                                selectedNotebookId={selectedNotebookId}
                                onSelect={handleSelectNotebook}
                                openModal={openModal}
                                onDeleteNotebook={confirmDeleteNotebook}
                                isLoading={isSaving}
                            />
                        </div>
                        <div className="hidden md:flex flex-1 items-center justify-center text-slate-400 dark:text-zinc-500 text-center p-8">
                            <div>
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto text-slate-300 dark:text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                <p className="mt-3 font-semibold text-sm">Select a notebook to begin.</p>
                                <button onClick={() => openModal('newResearchNotebook')} className="mt-3 text-xs text-primary-600 hover:underline">
                                    + New Notebook
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {selectedNotebook && (
                    <div className="flex-grow flex h-full overflow-hidden">
                        <div className={`
                            absolute inset-0 z-30 bg-white dark:bg-zinc-900
                            md:static md:flex md:w-56 lg:w-64 flex-shrink-0 h-full border-r border-slate-200 dark:border-zinc-800
                            ${mobileWorkspaceView === 'sources' ? 'flex' : 'hidden'}
                        `}>
                            <div className="w-full flex flex-col">
                                <ResearchSourceColumn
                                    notebookName={selectedNotebook.name}
                                    sources={sourcesForNotebook}
                                    selectedSourceIds={selectedSourceIds}
                                    onToggleSelection={toggleSourceSelection}
                                    onAddSource={() => openModal('addResearchSource', null, { notebookId: selectedNotebook.id })}
                                    onDeleteSource={dataHandlers.handleDeleteResearchSource}
                                    onOpenInDraftPro={(source) => {
                                        // Open the source content in DraftPro
                                        navigateTo('editor', null, {
                                            draftTitle: source.name,
                                            draftContent: source.content || '',
                                            disableAutoDraft: true,
                                            openedByAloa: false,
                                        });
                                    }}
                                    isLoading={isSaving}
                                    onBack={() => {
                                        if (window.innerWidth < 768) {
                                            setMobileWorkspaceView('chat');
                                        } else {
                                            handleBackToNotebooks();
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <div className={`flex-1 min-w-0 h-full flex flex-col ${mobileWorkspaceView === 'sources' || mobileWorkspaceView === 'studio' ? 'hidden md:flex' : 'flex'}`}>
                            <div className="md:hidden flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
                                <button onClick={handleBackToNotebooks} className="flex items-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    <ChevronRightIcon className="w-3.5 h-3.5 rotate-180 mr-1" /> Notebooks
                                </button>
                                <span className="font-bold text-xs truncate max-w-[110px] text-slate-900 dark:text-white">{selectedNotebook.name}</span>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setMobileWorkspaceView('sources')} className="text-[10px] font-bold text-primary-600 uppercase">Sources</button>
                                    <button onClick={() => setMobileWorkspaceView('studio')} className="text-[10px] font-bold text-indigo-600 uppercase">Studio</button>
                                </div>
                            </div>
                            <ResearchChat
                                notebookId={selectedNotebook.id}
                                messages={messagesForNotebook}
                                sources={sourcesForNotebook}
                                selectedSourceIds={selectedSourceIds}
                                onSendMessage={(notebookId, content, sIds) => dataHandlers.handleSendResearchMessage(notebookId, content, sIds)}
                            />
                        </div>

                        <div className={`
                            absolute inset-0 z-30 bg-white dark:bg-zinc-900
                            md:static md:flex md:w-[300px] lg:w-[340px] flex-shrink-0 h-full border-l border-slate-200 dark:border-zinc-800
                            ${mobileWorkspaceView === 'studio' ? 'flex' : 'hidden md:flex'}
                        `}>
                            <div className="w-full">
                                <ResearchStudio
                                    notebook={selectedNotebook}
                                    sources={sourcesForNotebook.filter(s => selectedSourceIds.includes(s.id))}
                                    openModal={openModal}
                                    navigate={navigateTo}
                                    onSwitchToChat={() => setMobileWorkspaceView('chat')}
                                    onClose={() => setMobileWorkspaceView('chat')}
                                />
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
            <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center mb-0">
                {/* Page header: same ResearchIcon as the sidebar nav, paired
                    with the "Research" title and "PracticePro Research" subtitle
                    so the page identity matches its navigation entry point. */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
                        <ResearchIcon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">Research</h2>
                        <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 -mt-0.5 truncate">PracticePro Research</p>
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
