
import React, { useState } from 'react';
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
import { ChevronRightIcon } from '../constants';

const ResearchPlaceholder: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 dark:text-zinc-500 p-8">
        <svg xmlns="http://www.w3.org/2000/svg" className="w-20 h-20 text-slate-300 dark:text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 2H20v15H6.5A2.5 2.5 0 0 1 4 14.5v-10A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        <h3 className="mt-4 text-lg font-semibold text-slate-600 dark:text-zinc-300">PracticePro Research</h3>
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

    const [activeTab, setActiveTab] = useState<ResearchTab>('research_notes');
    const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
    const [mobileWorkspaceView, setMobileWorkspaceView] = useState<'chat' | 'sources' | 'studio'>('chat');
    const [isSaving, setIsSaving] = useState(false);

    const selectedNotebookId = currentHistoryEntry.selectedResearchNotebookId || null;

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
                                onSendMessage={dataHandlers.handleSendResearchMessage}
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

    const tabDef: { id: ResearchTab; label: string }[] = [
        { id: 'research_notes', label: 'AI Notebooks' },
        { id: 'case_law', label: 'Case Law' },
        { id: 'notes', label: 'Practice Notes' },
    ];

    return (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-zinc-900">
            <div className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center mb-0">
                <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Research</h2>
                <div className="p-1 bg-slate-100 dark:bg-zinc-800 rounded-lg flex gap-1 border border-slate-200 dark:border-zinc-700">
                    {tabDef.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-3 md:px-4 py-1.5 text-xs md:text-sm font-semibold rounded-md transition-all ${activeTab === tab.id ? 'bg-white dark:bg-zinc-700 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-grow min-h-0 overflow-hidden">
                {activeTab === 'research_notes' && renderMyResearch()}
                {activeTab === 'case_law' && <LawReportsView />}
                {activeTab === 'notes' && (
                    <div className="h-full overflow-hidden p-0 bg-transparent">
                        <NotesView noBox={true} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResearchView;
