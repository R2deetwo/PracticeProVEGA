import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Matter, Contact, Document, Task } from '../types';
import { useUI } from '../contexts/UIContext';
import { useMatterState } from '../contexts/MatterContext';
import { useExecutionState } from '../contexts/ExecutionContext';
import { useDocumentState } from '../contexts/DocumentContext';
import { MattersIcon, ContactsIcon, DocumentsIcon, TasksIcon } from '../constants';

// Fuse.js is loaded from a CDN in index.html
declare const Fuse: any;

type SearchableItem = (Matter | Contact | Document | Task) & { dataType: 'Matter' | 'Contact' | 'Document' | 'Task', clientName?: string };

const typeConfig: Record<SearchableItem['dataType'], { icon: React.FC<any>; color: string; headerColor: string }> = {
    Matter: { icon: MattersIcon, color: 'bg-primary-500 text-white', headerColor: 'text-primary-600 dark:text-primary-400' },
    Contact: { icon: ContactsIcon, color: 'bg-blue-500 text-white', headerColor: 'text-blue-600 dark:text-blue-400' },
    Document: { icon: DocumentsIcon, color: 'bg-teal-500 text-white', headerColor: 'text-teal-600 dark:text-teal-400' },
    Task: { icon: TasksIcon, color: 'bg-amber-500 text-white', headerColor: 'text-amber-600 dark:text-amber-400' },
};


const SearchOverlay: React.FC = () => {
    const { searchQuery, setSearchQuery, navigateTo, openModal } = useUI();
    const { matterState } = useMatterState();
    const { executionState } = useExecutionState();
    const { documentState } = useDocumentState();
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [activeIndex, setActiveIndex] = useState(-1);
    const resultsListRef = useRef<HTMLDivElement>(null);
    const MAX_RESULTS_PER_GROUP = 5;

    const searchData = useMemo(() => {
        const matters: SearchableItem[] = matterState.matters.map(m => ({
            ...m,
            dataType: 'Matter',
            clientName: matterState.contacts.find(c => c.id === m.clientId)?.name || ''
        }));
        const contacts: SearchableItem[] = matterState.contacts.map(c => ({ ...c, dataType: 'Contact' }));
        const documents: SearchableItem[] = documentState.documents.map(d => ({ ...d, dataType: 'Document' }));
        const tasks: SearchableItem[] = executionState.tasks.map(t => ({ ...t, dataType: 'Task' }));
    
        return [...matters, ...contacts, ...documents, ...tasks];
    }, [matterState.matters, matterState.contacts, documentState.documents, executionState.tasks]);

    const fuse = useMemo(() => {
        return new Fuse(searchData, {
            keys: [
                { name: 'title', weight: 2 },
                { name: 'name', weight: 2 },
                'suitNumber',
                'clientName',
                'email',
                'companyName',
                'description'
            ],
            includeScore: true,
            minMatchCharLength: 1,
        });
    }, [searchData]);

    const searchResults = useMemo(() => {
        if (!searchQuery || searchQuery.trim().length < 1) {
            setActiveIndex(-1);
            return null;
        }
        const results = fuse.search(searchQuery).map((result: any) => result.item);
        
        const grouped: { [key in SearchableItem['dataType']]?: SearchableItem[] } = {};
        results.forEach((item: SearchableItem) => {
            if (!grouped[item.dataType]) {
                grouped[item.dataType] = [];
            }
            grouped[item.dataType]!.push(item);
        });

        const totalCount = results.length;

        return { grouped, totalCount };
    }, [searchQuery, fuse]);

    const visibleResults = useMemo(() => {
        if (!searchResults) return [];
        const typeOrder: Record<SearchableItem['dataType'], number> = { 'Matter': 1, 'Contact': 2, 'Document': 3, 'Task': 4 };
        
        const visible: SearchableItem[] = [];
        (Object.keys(searchResults.grouped) as (keyof typeof searchResults.grouped)[])
          .sort((a,b) => typeOrder[a] - typeOrder[b])
          .forEach(dataType => {
            const items = searchResults.grouped[dataType];
            if (items) {
                visible.push(...items.slice(0, MAX_RESULTS_PER_GROUP));
            }
        });
        return visible;
    }, [searchResults]);
    
    const handleClose = () => {
        setSearchQuery(null);
    };

    const handleSelect = React.useCallback((item: SearchableItem) => {
        handleClose();
        switch (item.dataType) {
            case 'Matter': return navigateTo('matterDetail', item.id);
            case 'Contact': return navigateTo('contactDetail', item.id);
            case 'Document': return navigateTo('documentDetail', item.id);
            case 'Task': return openModal('viewTask', item.id);
        }
    }, [navigateTo, openModal]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (visibleResults.length === 0) return;
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setActiveIndex(prev => (prev + 1) % visibleResults.length);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setActiveIndex(prev => (prev - 1 + visibleResults.length) % visibleResults.length);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (activeIndex >= 0) {
                        handleSelect(visibleResults[activeIndex]);
                    }
                    break;
                case 'Escape':
                    handleClose();
                    break;
            }
        };
        if (searchQuery) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [searchQuery, visibleResults, activeIndex, handleSelect]);

    useEffect(() => {
        if (activeIndex >= 0 && visibleResults[activeIndex]) {
            const activeItem = visibleResults[activeIndex];
            const elementId = `search-result-${activeItem.dataType}-${activeItem.id}`;
            resultsListRef.current?.querySelector(`#${elementId}`)?.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex, visibleResults]);
    
     useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                handleClose();
            }
        };
        if (searchQuery) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [searchQuery]);

    if (!searchQuery) return null;

    const activeItem = visibleResults[activeIndex];

    return (
        <div ref={dropdownRef} className="absolute top-full mt-2 w-full sm:w-[500px] bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-h-[70vh] flex flex-col z-50 border border-slate-200 dark:border-zinc-700">
            <div className="p-3 border-b border-gray-200 dark:border-zinc-700 text-sm text-slate-600 dark:text-zinc-400">
                {searchResults && searchResults.totalCount > 0
                    ? <>Found {searchResults.totalCount} result{searchResults.totalCount === 1 ? '' : 's'} for "<strong>{searchQuery}</strong>"</>
                    : <>No results for "<strong>{searchQuery}</strong>"</>
                }
            </div>
            {searchResults && searchResults.totalCount > 0 ? (
                <div className="overflow-y-auto" ref={resultsListRef}>
                    {(Object.keys(searchResults.grouped) as (keyof typeof searchResults.grouped)[])
                     .sort((a,b) => {
                         const typeOrder: Record<SearchableItem['dataType'], number> = { 'Matter': 1, 'Contact': 2, 'Document': 3, 'Task': 4 };
                         return typeOrder[a] - typeOrder[b];
                     })
                     .map(dataType => {
                        const allItems = searchResults.grouped[dataType];
                        if (!allItems || allItems.length === 0) return null;

                        const itemsToShow = allItems.slice(0, MAX_RESULTS_PER_GROUP);
                        const config = typeConfig[dataType];
                        const Icon = config.icon;

                        return (
                            <div key={dataType}>
                                <h3 className={`px-4 py-2 text-xs font-bold uppercase bg-gray-50 dark:bg-zinc-700/50 sticky top-0 z-10 ${config.headerColor}`}>
                                    {dataType}s ({allItems.length})
                                </h3>
                                <ul>
                                    {itemsToShow.map(item => {
                                        const isActive = activeItem && activeItem.id === item.id && activeItem.dataType === item.dataType;
                                        return (
                                            <li key={`${item.dataType}-${item.id}`} id={`search-result-${item.dataType}-${item.id}`} className={isActive ? 'bg-primary-100 dark:bg-primary-900/40' : ''}>
                                               <button 
                                                    onClick={() => handleSelect(item)}
                                                    className="w-full text-left p-3 hover:bg-slate-100 dark:hover:bg-zinc-700 flex items-center gap-3 transition-colors"
                                               >
                                                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${config.color}`}>
                                                        <Icon className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm text-slate-800 dark:text-white">{'name' in item ? item.name : item.title}</p>
                                                        {item.dataType === 'Matter' && <p className="text-xs text-slate-500 dark:text-zinc-400">{'suitNumber' in item ? item.suitNumber : ''}</p>}
                                                        {item.dataType === 'Contact' && <p className="text-xs text-slate-500 dark:text-zinc-400">{'email' in item ? item.email : ''}</p>}
                                                    </div>
                                               </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        );
                    })}
                </div>
            ) : (
                 <p className="p-16 text-center text-slate-500">Try a different search term.</p>
            )}
        </div>
    );
};

export default SearchOverlay;