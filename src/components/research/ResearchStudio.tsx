import React, { useState, useRef } from 'react';
import { StudioAnalysisResult, ResearchNotebook, ResearchSource, ModalType } from '../../types';
import { PlayIcon, PauseIcon, SparklesIcon, CalendarIcon, ListIcon, GavelIconLarge, DownloadIcon, SearchIcon, DocumentsIcon, BookOpenIcon, TargetIcon, DismissIcon, ChevronRightIcon } from '../../constants';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { analyzeSources, AnalysisType } from '../../agents/ResearchAgent';
import { parseAloaMarkdown } from '../../utils/markdownUtils';

interface ResearchStudioProps {
    notebook: ResearchNotebook;
    sources: ResearchSource[];
    openModal: (type: ModalType, id?: string | null, context?: any) => void;
    navigate: (view: any, id?: string | null, context?: any) => void;
    onSwitchToChat: () => void;
    onClose: () => void;
}

// --- AUDIO PLAYER (compact) ---
const CompactAudioPlayer: React.FC<{ items: StudioAnalysisResult[]; sourceCount: number }> = ({ items, sourceCount }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [progress, setProgress] = useState(0);

    const textScript = React.useMemo(() => {
        if (items.length === 0) {
            return `Welcome to your Research Studio. You have ${sourceCount} sources connected. Select a tool below to generate an audio briefing.`;
        }
        const latest = items[0];
        const cleanContent = latest.content.replace(/[*#]/g, '').replace(/\[.*?\]/g, '');
        return `Here is your ${latest.title}. ${cleanContent}`;
    }, [items, sourceCount]);

    React.useEffect(() => {
        let interval: number;
        if (isPlaying && !isPaused) {
            interval = window.setInterval(() => setProgress(p => (p + 1) % 100), 100);
        }
        return () => clearInterval(interval);
    }, [isPlaying, isPaused]);

    React.useEffect(() => {
        return () => { window.speechSynthesis.cancel(); };
    }, []);

    const handlePlay = () => {
        if (isPlaying && !isPaused) {
            window.speechSynthesis.pause();
            setIsPaused(true);
            setIsPlaying(false);
        } else if (isPaused) {
            window.speechSynthesis.resume();
            setIsPaused(false);
            setIsPlaying(true);
        } else {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(textScript);
            utterance.rate = 1.0;
            utterance.onend = () => { setIsPlaying(false); setIsPaused(false); setProgress(0); };
            window.speechSynthesis.speak(utterance);
            setIsPlaying(true);
        }
    };

    return (
        <div className="flex items-center gap-3 p-3 bg-zinc-900 dark:bg-black rounded-lg border border-zinc-700 dark:border-zinc-800">
            <button
                onClick={handlePlay}
                className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-white text-zinc-900 rounded-full hover:scale-105 transition-transform shadow"
            >
                {isPlaying ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4 ml-0.5" />}
            </button>
            <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold tracking-wider text-indigo-400 uppercase mb-1">Deep Dive</p>
                <p className="text-xs font-semibold text-white truncate">
                    {items.length > 0 ? items[0].title : `Audio Briefing · ${sourceCount} sources`}
                </p>
            </div>
            <div className="flex items-center gap-0.5 h-6 w-16">
                {Array.from({ length: 20 }).map((_, i) => {
                    let h = '20%';
                    if (isPlaying) {
                        const seed = (i + progress) % 20;
                        h = `${20 + Math.sin(seed * 0.7) * 80}%`;
                    }
                    return (
                        <div
                            key={i}
                            className={`w-0.5 rounded-full transition-all duration-100 ${i < 10 ? 'bg-indigo-400' : 'bg-zinc-600'}`}
                            style={{ height: h }}
                        />
                    );
                })}
            </div>
            <span className="text-[10px] text-zinc-500 w-10 text-right">{isPlaying ? 'Playing' : 'Ready'}</span>
        </div>
    );
};

// Analysis tool definitions
const ANALYSIS_TOOLS = [
    { id: 'Chronology', name: 'Chronology', icon: CalendarIcon, description: 'Timeline of key events', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800', prompt: 'Create a detailed chronological timeline of all events.' },
    { id: 'Brief', name: 'Case Brief', icon: BookOpenIcon, description: 'Facts, issues, rules', color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800', prompt: 'Draft a comprehensive case brief.' },
    { id: 'Digest', name: 'Pleading Digest', icon: ListIcon, description: 'Claims & defences', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800', prompt: 'Digest the pleadings into a clear summary of claims and defenses.' },
    { id: 'Matrix', name: 'Legal Matrix', icon: GavelIconLarge, description: 'Evidence vs elements', color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800', prompt: 'Create a legal matrix mapping evidence to specific legal elements.' },
    { id: 'Gap Analysis', name: 'Gap Analysis', icon: SearchIcon, description: 'Missing evidence', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', prompt: 'Perform a discovery gap analysis to identify missing evidence and witnesses.' },
    { id: 'Adversarial', name: 'Adversarial', icon: TargetIcon, description: 'Find weaknesses', color: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', prompt: 'Act as opposing counsel. Identify the three weakest points in our position.' },
];

// --- RESULT CARD (compact) ---
const ResultCard: React.FC<{ item: StudioAnalysisResult; onDelete: () => void; onSave: () => void; onSendToDraft: () => void }> = ({ item, onDelete, onSave, onSendToDraft }) => {
    const [expanded, setExpanded] = useState(true);
    const contentHtml = parseAloaMarkdown(item.content);

    return (
        <div className="bg-white dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700 rounded-lg overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-zinc-900/50 border-b border-slate-100 dark:border-zinc-700">
                <button
                    onClick={() => setExpanded(e => !e)}
                    className="flex items-center gap-2 text-left flex-1 min-w-0"
                >
                    <SparklesIcon className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                    <span className="font-semibold text-xs text-slate-800 dark:text-white truncate">{item.title}</span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <ChevronRightIcon className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </button>
                <div className="flex items-center gap-1 ml-2">
                    <button onClick={onSendToDraft} title="Send to DraftPro" className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded hover:bg-indigo-100 transition-colors">
                        DraftPro (Beta)
                    </button>
                    <button onClick={onSave} title="Save as document" className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:text-zinc-300 bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded hover:bg-slate-50 transition-colors">
                        <DownloadIcon className="w-3 h-3" /> Save
                    </button>
                    <button onClick={onDelete} title="Dismiss" className="p-1 text-slate-400 hover:text-red-500 transition-colors rounded">
                        <DismissIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            {/* Content */}
            {expanded && (
                <div className="p-4 max-h-80 overflow-y-auto custom-scrollbar">
                    <div
                        className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: contentHtml }}
                    />
                </div>
            )}
        </div>
    );
};

export const ResearchStudio: React.FC<ResearchStudioProps> = ({
    notebook,
    sources,
    openModal,
    navigate,
    onSwitchToChat,
    onClose
}) => {
    const { coreState, isDataLoaded } = useCoreState();
    const { handleSaveAnalysisResult, handleDeleteAnalysisResult } = useDataActions();
    const [loadingType, setLoadingType] = useState<string | null>(null);
    const resultsRef = useRef<HTMLDivElement>(null);

    const generatedItems = coreState.researchAnalysisResults
        .filter(r => r.notebookId === notebook.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const handleGenerate = async (typeId: string) => {
        if (sources.length === 0) return;
        setLoadingType(typeId);
        const config = ANALYSIS_TOOLS.find(t => t.id === typeId);
        if (!config) { setLoadingType(null); return; }

        try {
            const content = await analyzeSources(sources, config.prompt);
            const newItem: StudioAnalysisResult = {
                id: Date.now().toString(),
                firmId: coreState.firmDetails.id,
                notebookId: notebook.id,
                type: config.name as AnalysisType,
                title: config.name,
                content,
                timestamp: new Date().toISOString()
            };
            handleSaveAnalysisResult(newItem);
            setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
        } catch (error: any) {
            console.error('Analysis failed:', error);
            // P1 FIX: Show error to user instead of silent console.error
            const errorItem: StudioAnalysisResult = {
                id: `error-${Date.now()}`,
                type: loadingType || 'summary',
                title: 'Analysis Failed',
                content: error?.message || 'An error occurred during analysis. Please try again.',
                timestamp: new Date().toISOString(),
                sources: [],
                isError: true,
            };
            handleSaveAnalysisResult(errorItem);
        } finally {
            setLoadingType(null);
        }
    };

    const handleSaveItem = (item: StudioAnalysisResult) => {
        openModal('newDocument', null, {
            draftTitle: `${item.title} – ${notebook.name}`,
            draftContent: item.content,
            categoryId: 'cat_research'
        });
    };

    const handleSendToDraftPro = (item: StudioAnalysisResult) => {
        navigate('editor', null, {
            draftTitle: `${item.title} – ${notebook.name}`,
            draftContent: item.content
        });
    };

    if (sources.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-10 text-center bg-slate-50/50 dark:bg-zinc-900/50">
                <div className="p-5 bg-white dark:bg-zinc-800 rounded-2xl mb-5 shadow-sm border border-slate-100 dark:border-zinc-700 relative">
                    <DocumentsIcon className="w-12 h-12 text-slate-300 dark:text-zinc-600" />
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-800">
                        <PauseIcon className="w-2.5 h-2.5 text-white fill-current" />
                    </div>
                </div>
                <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2 uppercase tracking-tight">Strategy Studio Locked</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-xs leading-relaxed">
                    The Strategy Studio requires at least one source (PDF, link, or text) to run analysis.
                </p>
                <div className="mt-6 flex flex-col gap-3 w-full max-w-xs px-4">
                    <button
                        onClick={() => openModal('addResearchSource', null, { notebookId: notebook.id })}
                        className="px-4 py-2.5 bg-primary-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-primary-500/20 hover:scale-[1.02] transition-transform"
                    >
                        Add Your First Source
                    </button>
                    <button onClick={onClose} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest">
                        Dismiss
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
            {/* Compact Header */}
            <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                        <SparklesIcon className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-slate-800 dark:text-white leading-tight">Strategy Studio</h2>
                        <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Advanced Tools</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Close Studio"
                >
                    <DismissIcon className="w-4 h-4" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-4 space-y-5">

                    {/* Deep Dive Player */}
                    <CompactAudioPlayer items={generatedItems} sourceCount={sources.length} />

                    {/* Tool Chips */}
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">Insight Generators</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {ANALYSIS_TOOLS.map(tool => {
                                const Icon = tool.icon;
                                const isLoading = loadingType === tool.id;
                                return (
                                    <button
                                        key={tool.id}
                                        onClick={() => handleGenerate(tool.id)}
                                        disabled={!!loadingType}
                                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed ${tool.color}`}
                                    >
                                        <div className="flex-shrink-0">
                                            {isLoading
                                                ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                : <Icon className="w-4 h-4" />
                                            }
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold leading-tight truncate">{tool.name}</p>
                                            <p className="text-[10px] opacity-70 leading-tight truncate">{tool.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Results */}
                    {generatedItems.length > 0 && (
                        <div ref={resultsRef} className="space-y-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Analysis Results</p>
                            {loadingType && (
                                <div className="animate-pulse bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-3">
                                    <div className="h-2.5 bg-slate-200 dark:bg-zinc-700 rounded w-1/3 mb-2" />
                                    <div className="h-2 bg-slate-200 dark:bg-zinc-700 rounded w-full mb-1.5" />
                                    <div className="h-2 bg-slate-200 dark:bg-zinc-700 rounded w-4/5" />
                                </div>
                            )}
                            {generatedItems.map(item => (
                                <ResultCard
                                    key={item.id}
                                    item={item}
                                    onDelete={() => handleDeleteAnalysisResult(item.id)}
                                    onSave={() => handleSaveItem(item)}
                                    onSendToDraft={() => handleSendToDraftPro(item)}
                                />
                            ))}
                        </div>
                    )}

                    {loadingType && generatedItems.length === 0 && (
                        <div className="animate-pulse bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg p-3">
                            <div className="h-2.5 bg-slate-200 dark:bg-zinc-700 rounded w-1/3 mb-2" />
                            <div className="h-2 bg-slate-200 dark:bg-zinc-700 rounded w-full mb-1.5" />
                            <div className="h-2 bg-slate-200 dark:bg-zinc-700 rounded w-4/5" />
                        </div>
                    )}

                    <button
                        onClick={onSwitchToChat}
                        className="w-full text-center text-xs text-slate-400 hover:text-blue-600 transition-colors py-2"
                    >
                        ← Back to Chat
                    </button>

                    {/* Open in new tab — desktop only */}
                    <button
                        onClick={() => window.open(window.location.href, '_blank')}
                        className="hidden md:flex w-full items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 transition-colors py-2 border-t border-slate-100 dark:border-zinc-700/50 mt-2"
                        title="Open Research Studio in a new tab"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                        Open in new tab
                    </button>
                </div>
            </div>
        </div>
    );
};
