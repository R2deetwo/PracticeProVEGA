
import React, { useState, useMemo } from 'react';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { ListIcon, SearchIcon, LawLibraryIcon, BookOpenIcon, BookmarkIcon } from '../../constants';
import { MOCK_CASE_LAW } from '../../utils/mockData';
import { CaseResult } from '../../types';

// ... (FilterPanel Component remains same)
const FilterPanel: React.FC<{
    activeCourts: Set<string>;
    onToggleCourt: (court: string) => void;
    subjectFilter: string;
    setSubjectFilter: (val: string) => void;
    yearRange: [number, number];
    setYearRange: (val: [number, number]) => void;
    statuteFilter: string;
    setStatuteFilter: (val: string) => void;
    coramFilter: string;
    setCoramFilter: (val: string) => void;
}> = ({ activeCourts, onToggleCourt, subjectFilter, setSubjectFilter, yearRange, setYearRange, statuteFilter, setStatuteFilter, coramFilter, setCoramFilter }) => {
    const courts = ['Supreme Court', 'Court of Appeal', 'National Industrial Court', 'Federal High Court', 'Investments & Securities Tribunal'];
    
    return (
        <div className="h-full flex flex-col p-4 space-y-6 overflow-y-auto bg-slate-50 dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800">
            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Courts</h4>
                <div className="space-y-2">
                    {courts.map(court => (
                        <label key={court} className="flex items-center gap-2 cursor-pointer group">
                            <div className={`w-4 h-4 flex-shrink-0 border rounded flex items-center justify-center transition-colors ${activeCourts.has(court) ? 'bg-primary-600 border-primary-600' : 'bg-white dark:bg-zinc-800 border-slate-300 dark:border-zinc-600 group-hover:border-primary-500'}`}>
                                {activeCourts.has(court) && <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                            </div>
                            <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={activeCourts.has(court)} onChange={() => onToggleCourt(court)} className="hidden" />
                            <span className={`text-sm ${activeCourts.has(court) ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-600 dark:text-zinc-400'}`}>{court}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Subject Matter</h4>
                <input autoComplete="off" data-lpignore="true"  
                    type="text" 
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                    placeholder="e.g. Land Law, Contract..." 
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 transition-shadow"
                />
            </div>

            <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Year Range: {yearRange[0]} - {yearRange[1]}</h4>
                <div className="flex gap-2">
                    <input autoComplete="off" data-lpignore="true"  
                        type="number" 
                        value={yearRange[0]} 
                        onChange={(e) => setYearRange([parseInt(e.target.value), yearRange[1]])}
                        className="w-full px-2 py-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-sm text-center"
                    />
                    <span className="self-center text-slate-400">-</span>
                    <input autoComplete="off" data-lpignore="true"  
                        type="number" 
                        value={yearRange[1]} 
                        onChange={(e) => setYearRange([yearRange[0], parseInt(e.target.value)])}
                        className="w-full px-2 py-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded text-sm text-center"
                    />
                </div>
            </div>

             <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Referenced Statute</h4>
                <input autoComplete="off" data-lpignore="true"  
                    type="text" 
                    value={statuteFilter}
                    onChange={(e) => setStatuteFilter(e.target.value)}
                    placeholder="e.g. Land Use Act..." 
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 transition-shadow"
                />
            </div>
            
             <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Justices (Coram)</h4>
                <input autoComplete="off" data-lpignore="true"  
                    type="text" 
                    value={coramFilter}
                    onChange={(e) => setCoramFilter(e.target.value)}
                    placeholder="e.g. Oputa, JSC..." 
                    className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 transition-shadow"
                />
            </div>
        </div>
    );
};

// ... (CaseList and ReadingPane remain same, focusing on LawReportsView changes)

const CaseList: React.FC<{
    cases: CaseResult[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onBookmark: (id: string) => void;
    bookmarkedIds: string[];
}> = ({ cases, selectedId, onSelect, onBookmark, bookmarkedIds }) => {
    if (cases.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center flex-1 w-full">
                <SearchIcon className="w-12 h-12 mb-4 opacity-20" />
                <p>No cases found matching your criteria.</p>
            </div>
        );
    }

    return (
        <div className="flex-grow overflow-y-auto">
            {cases.map(c => {
                const isSelected = c.id === selectedId;
                const isBookmarked = bookmarkedIds.includes(c.id);
                
                return (
                    <div 
                        key={c.id} 
                        onClick={() => onSelect(c.id)}
                        className={`p-4 border-b border-slate-100 dark:border-zinc-800 cursor-pointer transition-all ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20 border-l-4 border-l-primary-500 pl-3' : 'hover:bg-slate-50 dark:hover:bg-zinc-800/50 border-l-4 border-l-transparent'}`}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <h4 className={`font-bold text-sm ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-slate-800 dark:text-zinc-200'}`}>{c.parties}</h4>
                            <button 
                                onClick={(e) => { e.stopPropagation(); onBookmark(c.id); }}
                                className={`p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors ${isBookmarked ? 'text-yellow-500' : 'text-slate-300'}`}
                            >
                                <BookmarkIcon className="w-4 h-4" isFilled={isBookmarked} />
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mb-2 text-xs text-slate-500 dark:text-zinc-400">
                             <span className="font-mono bg-slate-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded">{c.citation}</span>
                             <span>•</span>
                             <span>{c.court} ({c.year})</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 leading-relaxed">{c.summary}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                            {c.tags?.slice(0, 3).map(tag => (
                                <span key={tag} className="text-2xs px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 rounded-full">{tag}</span>
                            ))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const ReadingPane: React.FC<{
    caseData: CaseResult;
    isFullScreen: boolean;
    onToggleFullScreen: () => void;
    openModal: (type: any, id: any, context: any) => void;
    isLocked: boolean;
    onBack: () => void;
}> = ({ caseData, isFullScreen, onToggleFullScreen, openModal, isLocked, onBack }) => {
    
    const handleAddToNotebook = () => {
        openModal('addCaseToNotebook', null, { caseData });
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 relative">
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900 z-10 sticky top-0">
                <div className="flex items-center gap-4">
                     <button onClick={onBack} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{caseData.parties}</h2>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 font-mono">{caseData.citation} • {caseData.court} • {caseData.year}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <button 
                        onClick={handleAddToNotebook}
                        className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 rounded-lg text-xs font-bold hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
                    >
                        <BookOpenIcon className="w-4 h-4" /> Save to Notebook
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-grow overflow-y-auto p-8 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-8">
                     
                     {/* Metadata Card */}
                     <div className="bg-slate-50 dark:bg-zinc-800/50 p-6 rounded-lg border border-slate-200 dark:border-zinc-700">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                            <div>
                                <h5 className="font-bold text-slate-500 dark:text-zinc-500 uppercase text-xs mb-1">Subject Matter</h5>
                                <p className="font-semibold text-slate-900 dark:text-zinc-200">{caseData.subjectMatter}</p>
                            </div>
                            <div>
                                <h5 className="font-bold text-slate-500 dark:text-zinc-500 uppercase text-xs mb-1">Status</h5>
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${caseData.status === 'Locus Classicus' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                                    {caseData.status || 'Good Law'}
                                </span>
                            </div>
                            {caseData.coram && (
                                <div className="sm:col-span-2">
                                    <h5 className="font-bold text-slate-500 dark:text-zinc-500 uppercase text-xs mb-1">Justices (Coram)</h5>
                                    <p className="text-slate-700 dark:text-zinc-300">{caseData.coram.join(', ')}</p>
                                </div>
                            )}
                             {caseData.referencedStatutes && (
                                <div className="sm:col-span-2">
                                    <h5 className="font-bold text-slate-500 dark:text-zinc-500 uppercase text-xs mb-1">Referenced Statutes</h5>
                                    <div className="flex flex-wrap gap-2">
                                        {caseData.referencedStatutes.map(s => (
                                            <span key={s} className="px-2 py-0.5 bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 rounded text-xs font-mono text-slate-600 dark:text-zinc-300">{s}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                     </div>

                    {/* Ratio Decidendi */}
                    <div className="relative pl-6 border-l-4 border-primary-500">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Ratio Decidendi</h3>
                        <p className="text-slate-700 dark:text-zinc-300 leading-relaxed italic text-lg font-serif">
                            "{caseData.ratioDecidendi}"
                        </p>
                    </div>

                    {/* Summary */}
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 border-b border-slate-200 dark:border-zinc-700 pb-2">Summary of Facts</h3>
                        <div className="prose prose-slate dark:prose-invert max-w-none text-justify leading-7">
                            <p>{caseData.summary}</p>
                        </div>
                    </div>
                    
                    {/* Issues */}
                    {caseData.issues && (
                        <div>
                             <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 border-b border-slate-200 dark:border-zinc-700 pb-2">Issues for Determination</h3>
                             <ul className="list-decimal list-inside space-y-2 text-slate-700 dark:text-zinc-300">
                                 {caseData.issues.map((issue, idx) => (
                                     <li key={idx} className="pl-2">{issue}</li>
                                 ))}
                             </ul>
                        </div>
                    )}

                    {/* Full Judgment Placeholder (or actual if available) */}
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 border-b border-slate-200 dark:border-zinc-700 pb-2">Judgment</h3>
                         <div className="prose prose-slate dark:prose-invert max-w-none text-justify leading-7 font-serif">
                            {caseData.fullText ? (
                                <p>{caseData.fullText}</p>
                            ) : (
                                <div className="p-8 text-center bg-slate-50 dark:bg-zinc-800 rounded-lg border border-dashed border-slate-300 dark:border-zinc-700 text-slate-500">
                                    <p>Full text judgment content would be rendered here.</p>
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

const LawReportsView: React.FC = () => {
    const { coreState, isDataLoaded } = useCoreState();
    const { handleToggleBookmarkCase } = useDataActions();
    const { openModal } = useUI();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
    const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
    
    // Layout State
    const [showFilters, setShowFilters] = useState(false);
    const [showList, setShowList] = useState(true);
    
    // Filters
    const [activeCourts, setActiveCourts] = useState<Set<string>>(new Set(['Supreme Court', 'Court of Appeal', 'National Industrial Court', 'Federal High Court', 'Investments & Securities Tribunal']));
    const [subjectFilter, setSubjectFilter] = useState('');
    const [yearRange, setYearRange] = useState<[number, number]>([1960, new Date().getFullYear()]);
    const [statuteFilter, setStatuteFilter] = useState('');
    const [coramFilter, setCoramFilter] = useState('');

    // Derived Data
    const filteredCases = useMemo(() => {
        const searchLower = searchTerm.toLowerCase();
        const statuteLower = statuteFilter.toLowerCase();
        const coramLower = coramFilter.toLowerCase();
        const subjectLower = subjectFilter.toLowerCase();
        
        return MOCK_CASE_LAW.filter(c => {
            const matchesSearch = !searchTerm || 
                c.citation.toLowerCase().includes(searchLower) ||
                c.parties.toLowerCase().includes(searchLower) ||
                c.summary.toLowerCase().includes(searchLower) ||
                (c.equivalentCitations && c.equivalentCitations.some(ec => ec.toLowerCase().includes(searchLower)));
            
            const matchesCourt = activeCourts.size === 0 || activeCourts.has(c.court);
            
            const matchesSubject = !subjectFilter || (
                (c.subjectMatter && c.subjectMatter.toLowerCase().includes(subjectLower)) ||
                (c.tags && c.tags.some(t => t.toLowerCase().includes(subjectLower)))
            );
            
            const matchesYear = c.year >= yearRange[0] && c.year <= yearRange[1];
            
            const matchesStatute = !statuteFilter || (c.referencedStatutes && c.referencedStatutes.some(s => s.toLowerCase().includes(statuteLower)));
            const matchesCoram = !coramFilter || (c.coram && c.coram.some(j => j.toLowerCase().includes(coramLower)));

            return matchesSearch && matchesCourt && matchesSubject && matchesYear && matchesStatute && matchesCoram;
        });
    }, [searchTerm, activeCourts, subjectFilter, yearRange, statuteFilter, coramFilter]);

    const selectedCase = useMemo(() => MOCK_CASE_LAW.find(c => c.id === selectedCaseId), [selectedCaseId]);

    const toggleCourt = (court: string) => setActiveCourts(prev => { const next = new Set(prev); if (next.has(court)) next.delete(court); else next.add(court); return next; });
    
    const handleCaseSelect = (id: string) => {
        setSelectedCaseId(id);
        setMobileView('detail');
    };
    
    const handleBackToList = () => {
        setMobileView('list');
        setSelectedCaseId(null);
    };

    const toggleFullScreenReading = () => {
        if (showList) {
            setShowList(false);
            setShowFilters(false);
        } else {
            setShowList(true);
            setShowFilters(true);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 w-full overflow-hidden">
            {/* Top Bar - Optimized for Mobile */}
            <div className="flex-shrink-0 h-14 md:h-16 border-b border-slate-200 dark:border-zinc-700 flex items-center px-4 md:px-6 gap-3 bg-white dark:bg-zinc-900 z-20 shadow-sm justify-between">
                <div className="flex items-center gap-3 flex-1 max-w-3xl">
                     <button 
                        onClick={() => setShowFilters(!showFilters)} 
                        className={`p-1.5 rounded-lg transition-colors ${showFilters ? 'bg-slate-200 dark:bg-zinc-700 text-slate-800 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800'}`}
                        title="Toggle Filters"
                    >
                        <ListIcon className="w-5 h-5" />
                    </button>
                    <div className="relative w-full">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input autoComplete="off" data-lpignore="true"  
                            type="text"
                            placeholder="Search case law..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 md:py-2 bg-slate-100 dark:bg-zinc-800 border-none rounded-lg focus:ring-2 focus:ring-primary-500 text-sm transition-all"
                        />
                    </div>
                </div>
                {/* Advanced Search Hint - Hidden on mobile */}
                <div className="hidden md:flex gap-4 text-xs text-slate-400">
                     <span>Supports: <strong className="text-slate-600 dark:text-slate-300">AND</strong>, <strong className="text-slate-600 dark:text-slate-300">OR</strong>, <strong className="text-slate-600 dark:text-slate-300">NOT</strong></span>
                </div>
            </div>

            <div className="flex-grow flex overflow-hidden relative w-full">
                {/* Mobile Filter Overlay */}
                <div className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity md:hidden ${showFilters ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowFilters(false)} />

                {/* Filter Panel (Responsive Drawer) */}
                <div className={`absolute inset-y-0 left-0 z-50 bg-white dark:bg-zinc-900 shadow-xl transition-transform duration-300 transform ${showFilters ? 'translate-x-0' : '-translate-x-full'} md:relative md:transform-none md:shadow-none md:border-r border-slate-200 dark:border-zinc-700 md:z-auto ${showFilters ? 'w-72 md:w-72' : 'w-0 md:w-0'} overflow-hidden flex-shrink-0`}>
                    <FilterPanel 
                        activeCourts={activeCourts} 
                        onToggleCourt={toggleCourt} 
                        subjectFilter={subjectFilter}
                        setSubjectFilter={setSubjectFilter}
                        yearRange={yearRange}
                        setYearRange={setYearRange}
                        statuteFilter={statuteFilter}
                        setStatuteFilter={setStatuteFilter}
                        coramFilter={coramFilter}
                        setCoramFilter={setCoramFilter}
                    />
                </div>
                
                {/* Case List (Responsive visibility) - ENSURED W-FULL */}
                <div className={`${mobileView === 'list' ? 'flex w-full' : 'hidden'} md:flex md:w-96 flex-shrink-0 border-r border-slate-200 dark:border-zinc-700 transition-all duration-300 ease-in-out ${showList ? 'md:opacity-100' : 'md:w-0 md:opacity-0 md:overflow-hidden'}`}>
                     <CaseList 
                        cases={filteredCases} 
                        selectedId={selectedCaseId} 
                        onSelect={handleCaseSelect} 
                        onBookmark={handleToggleBookmarkCase}
                        bookmarkedIds={coreState.bookmarkedCaseIds}
                    />
                </div>

                {/* Reading Pane (Responsive visibility) */}
                <div className={`${mobileView === 'detail' ? 'flex w-full' : 'hidden'} md:flex flex-1 min-w-0 bg-white dark:bg-zinc-900`}>
                    {selectedCase ? (
                        <ReadingPane 
                            caseData={selectedCase} 
                            isFullScreen={!showList}
                            onToggleFullScreen={toggleFullScreenReading}
                            openModal={openModal}
                            isLocked={false}
                            onBack={handleBackToList}
                        />
                    ) : (
                        // Centered Empty State Fix
                        <div className="flex-grow hidden md:flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-zinc-900/50 w-full h-full">
                            <div className="flex flex-col items-center">
                                <div className="p-6 bg-white dark:bg-zinc-800 rounded-full shadow-sm mb-4">
                                    <LawLibraryIcon className="w-16 h-16 text-slate-300 dark:text-zinc-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-700 dark:text-zinc-300">Case Law Intelligence Terminal</h3>
                                <p className="text-sm mt-2 max-w-md text-center mb-6 text-slate-500">Search thousands of Supreme Court and Court of Appeal precedents from 1960 to date.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LawReportsView;
