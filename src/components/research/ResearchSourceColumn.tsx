
import React, { useState } from 'react';
import { ResearchSource } from '../../types';
import { PlusIcon, GlobeIcon, DocumentIcon, ChevronRightIcon, DismissIcon } from '../../constants';

interface ResearchSourceColumnProps {
    notebookName: string;
    sources: ResearchSource[];
    selectedSourceIds: string[];
    onToggleSelection: (sourceId: string) => void;
    onAddSource: () => void;
    onBack: () => void;
    onDeleteSource?: (sourceId: string, sourceName: string) => void;
    onOpenInDraftPro?: (source: ResearchSource) => void;
    isLoading?: boolean;
    onAddWebSource?: (source: { name: string; type: string; content: string; url?: string }) => void;
}

const SourceCard: React.FC<{
    source: ResearchSource;
    isSelected: boolean;
    onToggle: (id: string) => void;
    onDelete?: (id: string, name: string) => void;
    onOpenInDraftPro?: (source: ResearchSource) => void;
}> = ({ source, isSelected, onToggle, onDelete, onOpenInDraftPro }) => {
    const [confirmDelete, setConfirmDelete] = useState(false);

    const getIcon = () => {
        const iconBaseClass = `w-7 h-7 flex-shrink-0 rounded-md flex items-center justify-center transition-all duration-200`;
        if (source.type === 'web') {
            return (
                <div className={`${iconBaseClass} ${isSelected ? 'bg-blue-600 text-white' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'}`}>
                    <GlobeIcon className="w-3.5 h-3.5" />
                </div>
            );
        }
        if (source.type === 'pdf') {
            return (
                <div className={`${iconBaseClass} ${isSelected ? 'bg-blue-600 text-white' : 'bg-red-100 dark:bg-red-900/30 text-red-600'} font-bold text-3xs tracking-tighter`}>
                    PDF
                </div>
            );
        }
        return (
            <div className={`${iconBaseClass} ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-zinc-700 text-slate-500'}`}>
                <DocumentIcon className="w-3.5 h-3.5" />
            </div>
        );
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirmDelete) {
            onDelete?.(source.id, source.name);
        } else {
            setConfirmDelete(true);
            setTimeout(() => setConfirmDelete(false), 3000);
        }
    };

    return (
        <div
            onClick={() => { setConfirmDelete(false); onToggle(source.id); }}
            className={`p-2 rounded-lg border transition-all group cursor-pointer relative flex items-center gap-2 ${isSelected
                ? 'bg-blue-50/80 dark:bg-blue-900/10 border-blue-400/50 dark:border-blue-600/50 shadow-sm'
                : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-700'
                }`}
        >
            {/* Selection Checkbox */}
            <div className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                isSelected 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'border-slate-300 dark:border-zinc-600 bg-transparent'
            }`}>
                {isSelected && <div className="w-1.5 h-1.5 bg-white dark:bg-zinc-900 rounded-full scale-75" />}
            </div>

            {getIcon()}

            <div className="min-w-0 flex-grow">
                <p className={`font-semibold text-2xs truncate leading-tight ${isSelected ? 'text-blue-900 dark:text-blue-100' : 'text-slate-800 dark:text-white'}`} title={source.name}>
                    {source.name}
                </p>
                <p className={`text-3xs mt-0.5 ${isSelected ? 'text-blue-600/70 dark:text-blue-400/70' : 'text-slate-400/80 dark:text-zinc-500/80'}`}>
                    {source.type === 'web' ? 'Website' : source.type === 'pdf' ? 'PDF' : 'Note'}
                </p>
            </div>

            {onDelete && (
                <button
                    onClick={handleDeleteClick}
                    className={`flex-shrink-0 p-1 rounded-md transition-all opacity-0 group-hover:opacity-100 ${confirmDelete
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 opacity-100'
                        : 'text-slate-400 hover:text-red-500'
                    }`}
                >
                    <DismissIcon className="w-3 h-3" />
                </button>
            )}
            {onOpenInDraftPro && source.content && (
                <button
                    onClick={(e) => { e.stopPropagation(); onOpenInDraftPro(source); }}
                    className="flex-shrink-0 p-1 rounded-md transition-all opacity-0 group-hover:opacity-100 text-slate-400 hover:text-primary-500"
                    title="Open in DraftPro"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                </button>
            )}
        </div>
    );
};

export const ResearchSourceColumn: React.FC<ResearchSourceColumnProps> = ({
    notebookName,
    sources,
    selectedSourceIds,
    onToggleSelection,
    onAddSource,
    onBack,
    onDeleteSource,
    onOpenInDraftPro,
    isLoading,
    onAddWebSource
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<Array<{ title: string; url: string; snippet: string }>>([]);
    const [showResults, setShowResults] = useState(false);

    const handleWebSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setShowResults(true);
        try {
            const { searchWebClient, fetchUrlContentClient } = await import('../../utils/webFetchClient');
            const result = await searchWebClient(searchQuery);
            if (result.success && result.results.length > 0) {
                setSearchResults(result.results.slice(0, 8));
            } else {
                setSearchResults([]);
            }
        } catch (err) {
            console.error('[Research] Web search failed:', err);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    const handleAddSourceFromSearch = async (result: { title: string; url: string; snippet: string }) => {
        if (!onAddWebSource) return;
        // Fetch the full content of the URL
        try {
            const { fetchUrlContentClient } = await import('../../utils/webFetchClient');
            const fetchResult = await fetchUrlContentClient(result.url);
            onAddWebSource({
                name: result.title,
                type: 'web',
                content: fetchResult.success && fetchResult.content
                    ? fetchResult.content.substring(0, 20000)
                    : result.snippet,
                url: result.url,
            });
        } catch {
            onAddWebSource({
                name: result.title,
                type: 'web',
                content: result.snippet,
                url: result.url,
            });
        }
        // Remove from search results
        setSearchResults(prev => prev.filter(r => r.url !== result.url));
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-zinc-900/50">
            {/* Header */}
            <div className="px-3 pt-3 pb-2 border-b border-slate-200 dark:border-zinc-700">
                <button
                    onClick={onBack}
                    className="flex items-center text-2xs font-bold text-slate-500 hover:text-blue-600 transition-colors mb-2 uppercase tracking-wider"
                >
                    <ChevronRightIcon className="w-3 h-3 rotate-180 mr-1" /> Notebooks
                </button>
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider">
                        Sources <span className="text-slate-400">({sources.length})</span>
                    </h3>
                    {selectedSourceIds.length > 0 && (
                        <span className="text-2xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full">
                            {selectedSourceIds.length} active
                        </span>
                    )}
                </div>
            </div>

            {/* ─── Web Search Input ──────────────────────────────── */}
            <div className="px-3 py-2 border-b border-slate-200 dark:border-zinc-700">
                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !isSearching) handleWebSearch(); }}
                        placeholder="Search the web for sources..."
                        className="w-full pl-8 pr-3 py-2 text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-slate-700 dark:text-zinc-200"
                    />
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    {searchQuery && (
                        <button
                            onClick={() => { setSearchQuery(''); setShowResults(false); setSearchResults([]); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <DismissIcon className="w-3 h-3" />
                        </button>
                    )}
                </div>
                {isSearching && (
                    <p className="text-3xs text-slate-400 mt-1 flex items-center gap-1">
                        <span className="w-2 h-2 border border-slate-400 border-t-transparent rounded-full animate-spin" />
                        Searching the web...
                    </p>
                )}
            </div>

            {/* ─── Search Results ────────────────────────────────── */}
            {showResults && !isSearching && (
                <div className="px-3 py-2 max-h-64 overflow-y-auto custom-scrollbar border-b border-slate-200 dark:border-zinc-700">
                    {searchResults.length === 0 ? (
                        <p className="text-2xs text-slate-400 text-center py-3">No results found. Try a different query.</p>
                    ) : (
                        <>
                            <p className="text-3xs font-bold uppercase tracking-wider text-slate-400 mb-2">{searchResults.length} web results — click + to add as source</p>
                            {searchResults.map((result, i) => (
                                <div key={i} className="group flex items-start gap-2 p-2 rounded-lg hover:bg-white dark:hover:bg-zinc-800 transition-colors mb-1">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-2xs font-semibold text-slate-700 dark:text-zinc-200 truncate">{result.title}</p>
                                        <p className="text-3xs text-slate-400 truncate">{result.url}</p>
                                        <p className="text-2xs text-slate-500 dark:text-zinc-400 line-clamp-2 mt-0.5">{result.snippet}</p>
                                    </div>
                                    <button
                                        onClick={() => handleAddSourceFromSearch(result)}
                                        className="flex-shrink-0 p-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                                        title="Add as source"
                                    >
                                        <PlusIcon className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}

            {/* Add Source */}
            <div className="px-3 py-2">
                <button
                    onClick={onAddSource}
                    className="w-full py-2 px-3 bg-white dark:bg-zinc-800 border border-dashed border-slate-300 dark:border-zinc-600 rounded-lg text-xs font-semibold text-slate-500 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all flex items-center justify-center gap-1.5"
                >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Add Source
                </button>
            </div>

            {/* Selection hint */}
            {sources.length > 0 && (
                <p className="px-3 pb-1 text-3xs text-slate-400 dark:text-zinc-600">
                    Click to select · AI will focus on selected sources
                </p>
            )}

            {/* Source List */}
            <div className="flex-grow overflow-y-auto px-3 pb-3 space-y-1.5 custom-scrollbar">
                {isLoading && (
                    <div className="animate-pulse p-2.5 rounded-lg border border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-800/30">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-zinc-700 flex items-center justify-center">
                                <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="h-2.5 bg-slate-200 dark:bg-zinc-700 rounded w-2/3" />
                                <div className="h-2 bg-slate-200 dark:bg-zinc-700 rounded w-1/3" />
                            </div>
                        </div>
                    </div>
                )}
                {sources.length === 0 && !isLoading ? (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-400 dark:text-zinc-500 text-center">
                        <p className="text-xs font-medium">No sources yet</p>
                        <p className="text-2xs mt-1">Upload PDFs, text files,<br />or add URLs above.</p>
                    </div>
                ) : (
                    sources.map(source => (
                        <SourceCard
                            key={source.id}
                            source={source}
                            isSelected={selectedSourceIds.includes(source.id)}
                            onToggle={onToggleSelection}
                            onDelete={onDeleteSource}
                            onOpenInDraftPro={onOpenInDraftPro}
                        />
                    ))
                )}
            </div>
        </div>
    );
};
