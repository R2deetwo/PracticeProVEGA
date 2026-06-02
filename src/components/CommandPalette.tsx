
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useUI } from '../contexts/UIContext';
import { useMatterState } from '../contexts/MatterContext';
import { useExecutionState } from '../contexts/ExecutionContext';
import { useDocumentState } from '../contexts/DocumentContext';
import { SearchIcon, DashboardIcon, MattersIcon, ContactsIcon, TasksIcon, CalendarIcon, CogIcon, PlusIcon, MoonIcon, SunIcon, ArchiveIcon, DocumentsIcon, ResearchIcon } from '../constants';

// Fuse.js is loaded via CDN
declare const Fuse: any;

type ResultType = 'Navigation' | 'Actions' | 'System' | 'Matter' | 'Contact' | 'Document' | 'Task';

interface SearchResult {
    id: string;
    title: string;
    subtitle?: string;
    icon: React.ReactNode;
    type: ResultType;
    action: () => void;
    score?: number;
}

const CommandPalette: React.FC = () => {
    const { isCommandPaletteOpen, setCommandPaletteOpen, navigateTo, openModal, theme, setTheme, toggleSidebar } = useUI();
    const { matterState } = useMatterState();
    const { executionState } = useExecutionState();
    const { documentState } = useDocumentState();
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // 1. Static Commands
    const staticCommands: SearchResult[] = useMemo(() => [
        // Navigation
        { id: 'nav-dashboard', title: 'Go to Dashboard', type: 'Navigation', icon: <DashboardIcon />, action: () => navigateTo('dashboard') },
        { id: 'nav-matters', title: 'Go to Matters', type: 'Navigation', icon: <MattersIcon />, action: () => navigateTo('matters') },
        { id: 'nav-contacts', title: 'Go to Contacts', type: 'Navigation', icon: <ContactsIcon />, action: () => navigateTo('contacts') },
        { id: 'nav-tasks', title: 'Go to Tasks', type: 'Navigation', icon: <TasksIcon />, action: () => navigateTo('tasks') },
        { id: 'nav-calendar', title: 'Go to Calendar', type: 'Navigation', icon: <CalendarIcon />, action: () => navigateTo('calendar') },
        { id: 'nav-research', title: 'Go to Research Studio', type: 'Navigation', icon: <ResearchIcon />, action: () => navigateTo('research') },
        { id: 'nav-archive', title: 'Go to Archive', type: 'Navigation', icon: <ArchiveIcon />, action: () => navigateTo('archive') },
        { id: 'nav-settings', title: 'Go to Settings', type: 'Navigation', icon: <CogIcon />, action: () => navigateTo('settings') },

        // Actions
        { id: 'act-new-matter', title: 'Create New Matter', type: 'Actions', icon: <PlusIcon />, action: () => openModal('newMatter') },
        { id: 'act-new-contact', title: 'Add New Contact', type: 'Actions', icon: <PlusIcon />, action: () => openModal('newContact') },
        { id: 'act-new-task', title: 'Create New Task', type: 'Actions', icon: <PlusIcon />, action: () => openModal('newTask') },
        { id: 'act-new-event', title: 'Schedule Event', type: 'Actions', icon: <PlusIcon />, action: () => openModal('newEvent') },
        { id: 'act-new-doc', title: 'Upload Document', type: 'Actions', icon: <PlusIcon />, action: () => openModal('newDocument') },

        // System
        { id: 'sys-theme', title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`, type: 'System', icon: theme === 'dark' ? <SunIcon /> : <MoonIcon />, action: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
        { id: 'sys-sidebar', title: 'Toggle Sidebar', type: 'System', icon: <div className="w-5 h-5 border border-current rounded flex items-center justify-center text-[10px]">|||</div>, action: () => toggleSidebar() },
    ], [navigateTo, openModal, theme, setTheme, toggleSidebar]);

    // 2. Dynamic Data Search Index
    const searchIndex = useMemo(() => {
        const dataItems: SearchResult[] = [];

        // Matters
        matterState.matters.forEach(m => {
            const client = matterState.contacts.find(c => c.id === m.clientId);
            dataItems.push({
                id: `matter-${m.id}`,
                title: m.title,
                subtitle: `${client?.name || 'Unknown'} • ${m.referenceNumber}`,
                type: 'Matter',
                icon: <MattersIcon />,
                action: () => navigateTo('matterDetail', m.id)
            });
        });

        // Contacts
        matterState.contacts.forEach(c => {
             dataItems.push({
                id: `contact-${c.id}`,
                title: c.name,
                subtitle: c.email,
                type: 'Contact',
                icon: <ContactsIcon />,
                action: () => navigateTo('contactDetail', c.id)
            });
        });

        // Tasks (Active only)
        executionState.tasks.filter(t => t.status !== 'done').forEach(t => {
             dataItems.push({
                id: `task-${t.id}`,
                title: t.title,
                subtitle: t.dueDate ? `Due: ${new Date(t.dueDate).toLocaleDateString('en-GB')}` : 'No due date',
                type: 'Task',
                icon: <TasksIcon />,
                action: () => openModal('viewTask', t.id)
            });
        });

        // Documents
        documentState.documents.forEach(d => {
             dataItems.push({
                id: `doc-${d.id}`,
                title: d.title,
                subtitle: d.file ? d.file.name : 'Generated Document',
                type: 'Document',
                icon: <DocumentsIcon />,
                action: () => navigateTo('documentDetail', d.id)
            });
        });

        return dataItems;
    }, [matterState, executionState, documentState, navigateTo, openModal]);

    // 3. Fuse Configuration
    const fuse = useMemo(() => {
        return new Fuse([...staticCommands, ...searchIndex], {
            keys: [
                { name: 'title', weight: 2 },
                { name: 'subtitle', weight: 1 },
                { name: 'type', weight: 0.5 }
            ],
            threshold: 0.3,
            includeScore: true
        });
    }, [staticCommands, searchIndex]);

    // 4. Filtering Logic
    const results = useMemo(() => {
        if (!query.trim()) return staticCommands; // Default to commands if empty
        
        const fuseResults = fuse.search(query).map((r: any) => r.item);
        return fuseResults.slice(0, 15); // Limit to 15 results for performance
    }, [query, fuse, staticCommands]);

    // Handle Open/Close Shortcut (Cmd+K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setCommandPaletteOpen(!isCommandPaletteOpen);
            }
            if (e.key === 'Escape' && isCommandPaletteOpen) {
                setCommandPaletteOpen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isCommandPaletteOpen, setCommandPaletteOpen]);

    // Reset state when opened
    useEffect(() => {
        if (isCommandPaletteOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isCommandPaletteOpen]);

    // Navigation within the list
    useEffect(() => {
        if (!isCommandPaletteOpen) return;

        const handleNav = (e: KeyboardEvent) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % results.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (results[selectedIndex]) {
                    results[selectedIndex].action();
                    setCommandPaletteOpen(false);
                }
            }
        };

        window.addEventListener('keydown', handleNav);
        return () => window.removeEventListener('keydown', handleNav);
    }, [isCommandPaletteOpen, results, selectedIndex, setCommandPaletteOpen]);

    // Ensure selected item is visible
    useEffect(() => {
        if (listRef.current) {
            const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);


    if (!isCommandPaletteOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => setCommandPaletteOpen(false)} />
            
            <div className="w-full max-w-2xl bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-slate-200 dark:border-zinc-700 overflow-hidden relative z-10 flex flex-col max-h-[70vh] animate-slide-in-up">
                <div className="flex items-center p-4 border-b border-slate-200 dark:border-zinc-700">
                    <SearchIcon className="w-5 h-5 text-slate-400 mr-3" />
                    <input autoComplete="off" data-lpignore="true" 
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                        placeholder="Type a command or search anything..."
                        className="flex-grow bg-transparent border-none outline-none text-lg text-slate-800 dark:text-white placeholder-slate-400"
                    />
                    <button onClick={() => setCommandPaletteOpen(false)} className="p-1 bg-slate-100 dark:bg-zinc-700 rounded text-xs font-bold text-slate-500">ESC</button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-2" ref={listRef}>
                    {results.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 dark:text-zinc-500">
                            <p>No results found for "{query}".</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {results.map((result: SearchResult, index: number) => (
                                <button
                                    key={result.id}
                                    onClick={() => { result.action(); setCommandPaletteOpen(false); }}
                                    className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors group ${index === selectedIndex ? 'bg-primary-600 text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-700'}`}
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={`w-8 h-8 flex-shrink-0 rounded-md flex items-center justify-center ${index === selectedIndex ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400'}`}>
                                            {React.cloneElement(result.icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5" })}
                                        </div>
                                        <div className="min-w-0">
                                            <span className="font-medium block truncate">{result.title}</span>
                                            {result.subtitle && (
                                                <span className={`text-xs truncate block ${index === selectedIndex ? 'text-primary-100' : 'text-slate-500 dark:text-zinc-400'}`}>{result.subtitle}</span>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded ${index === selectedIndex ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-zinc-700 text-slate-500'}`}>
                                        {result.type}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                
                <div className="p-2 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-200 dark:border-zinc-700 flex justify-between text-xs text-slate-400">
                    <div className="flex gap-3">
                        <span><strong className="font-medium">↑↓</strong> to navigate</span>
                        <span><strong className="font-medium">↵</strong> to select</span>
                    </div>
                    <span><strong>Cmd + K</strong> to open</span>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;
