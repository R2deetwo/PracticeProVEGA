
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useUI } from '../contexts/UIContext';
import { useMatterState } from '../contexts/MatterContext';
import { useExecutionState } from '../contexts/ExecutionContext';
import { useDocumentState } from '../contexts/DocumentContext';
import { useCoreState } from '../contexts/CoreContext';
import { useProduct } from '../contexts/ProductContext';
import { useFeatures } from '../hooks/useFeatures';
import { usePermissions } from '../hooks/usePermissions';
import { SearchIcon, DashboardIcon, MattersIcon, ContactsIcon, TasksIcon, CalendarIcon, CogIcon, PlusIcon, MoonIcon, SunIcon, ArchiveIcon, DocumentsIcon, ResearchIcon, OfficeBuildingIcon } from '../constants';
import Fuse from 'fuse.js';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { resolveContactById } from '../utils/resolveContact';
import { useAuth } from '../contexts/AuthContext';
import { useQuery_experimental } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { searchResultDestination, type ServerSearchResult } from '../utils/searchGrouping';

import { Z_CLASS } from '../overlays/constants';
type ResultType = 'Navigation' | 'Actions' | 'System' | 'Matter' | 'Contact' | 'Document' | 'Task' | 'Property';

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
    const { coreState } = useCoreState();
    // PRODUCT FILTERING: previously every static command showed for every
    // product — Atrium-only firms saw "Go to Research Studio" and landed on
    // a "Feature Not Available" wall. Commands are filtered by the firm's
    // product mode.
    // K-2 (nav parity): the filter now uses the SAME authoritative product
    // resolution as every other surface (useProduct) instead of a local
    // re-derivation — the local copy missed the 'komplete'/'sentry' spellings
    // and drifted from ProductContext's alias map.
    const { isLegal, hasPropertyFeatures } = useProduct();
    const isLegalFirm = isLegal;
    const isPropertyFirm = hasPropertyFeatures;
    // UX-15 (lock parity): the palette is the third nav surface. Locks that
    // the Sidebar/BottomNav enforce (Research = Growth+; Financials = Pro+
    // for Vega-only firms; Analytics = Growth+) must behave identically
    // here — a locked entry either hides (when the surface itself is
    // hidden) or opens the upgrade modal instead of navigating.
    const features = useFeatures();
    const permissions = usePermissions();
    const researchLocked = !features.canUseResearchStudio;
    const reportingLocked = !features.canUseReportGenerator;
    const billingLocked = !hasPropertyFeatures && !features.canUseAdvancedBilling;
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    // Focus trap container — wraps the whole palette (input + list). While
    // open, Tab cycles only within the palette so keyboard users can't
    // reach background UI behind the backdrop.
    const paletteRef = useRef<HTMLDivElement>(null);
    useFocusTrap(paletteRef, isCommandPaletteOpen);

    // UX-14: the desktop palette now searches the SAME server index as the
    // mobile FullScreenSearch (api.search.searchAll) instead of a client-side
    // Fuse over the synced subset — the 1,000-row/table sync cap used to give
    // desktop and mobile different answers for the same query on large firms.
    // Commands stay local; DATA results come from the server. The legacy
    // client index remains the honest fallback for demo/unauthenticated
    // sessions (server search requires a firm bearer).
    const { currentUser, bearerToken } = useAuth();
    const [debouncedQuery, setDebouncedQuery] = useState('');
    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(query), 250);
        return () => clearTimeout(t);
    }, [query]);
    const trimmedServerQuery = debouncedQuery.trim();
    const isDemo = currentUser?.email === 'demo@practicepro.ng';
    const canServerSearch = !isDemo && Boolean(currentUser?.firmId && currentUser?.email) && trimmedServerQuery.length >= 2;
    const serverState = useQuery_experimental({
        query: api.search.searchAll,
        args: canServerSearch
            ? { userEmail: currentUser!.email!, sessionToken: bearerToken ?? undefined, query: trimmedServerQuery }
            : 'skip',
        throwOnError: false,
    }) as { status: 'pending' } | { status: 'success'; data: ServerSearchResult } | { status: 'error'; error: Error };

    // 1. Static Commands (product-filtered)
    const staticCommands: SearchResult[] = useMemo(() => [
        // Navigation
        { id: 'nav-dashboard', title: 'Go to Dashboard', type: 'Navigation', icon: <DashboardIcon />, action: () => navigateTo('dashboard') },
        ...(isLegalFirm ? ([{ id: 'nav-matters', title: 'Go to Matters', type: 'Navigation', icon: <MattersIcon />, action: () => navigateTo('matters') }] as SearchResult[]) : []),
        ...(isPropertyFirm ? ([{ id: 'nav-properties', title: 'Go to Properties', type: 'Navigation', icon: <OfficeBuildingIcon />, action: () => navigateTo('properties') }] as SearchResult[]) : []),
        { id: 'nav-contacts', title: 'Go to Contacts', type: 'Navigation', icon: <ContactsIcon />, action: () => navigateTo('contacts') },
        { id: 'nav-tasks', title: 'Go to Tasks', type: 'Navigation', icon: <TasksIcon />, action: () => navigateTo('tasks') },
        { id: 'nav-calendar', title: 'Go to Calendar', type: 'Navigation', icon: <CalendarIcon />, action: () => navigateTo('calendar') },
        ...(isLegalFirm ? ([{ id: 'nav-research', title: researchLocked ? 'Research Studio (Upgrade)' : 'Go to Research Studio', type: 'Navigation', icon: <ResearchIcon />, action: () => researchLocked ? openModal('upgradePlan') : navigateTo('research') }] as SearchResult[]) : []),
        // REACHABILITY FIXES: Timeline and Billing Monitor are fully built
        // views that previously had NO navigation entry anywhere — only
        // reachable by typing the URL. Exposed here (and Timeline is linked
        // from Reporting) so they're discoverable.
        ...(isLegalFirm ? ([{ id: 'nav-timeline', title: 'Go to Timeline (Case Roadmap)', type: 'Navigation', icon: <CalendarIcon />, action: () => navigateTo('timeline') }] as SearchResult[]) : []),
        ...(isLegalFirm ? ([{ id: 'nav-billing-monitor', title: 'Open Retainer Billing Monitor', type: 'Navigation', icon: <DashboardIcon />, action: () => navigateTo('billingMonitor') }] as SearchResult[]) : []),
        // UX-26: Archive palette entry now carries the same permission gate
        // (solo/admin) the Sidebar and BottomNav apply, instead of being the
        // one ungated path into the archive.
        ...(permissions.canViewArchive ? ([{ id: 'nav-archive', title: 'Go to Archive', type: 'Navigation', icon: <ArchiveIcon />, action: () => navigateTo('archive') }] as SearchResult[]) : []),
        // UX-26 (palette permission parity): Financials/Analytics nav entries
        // previously absent here — desktop palette users had no keyboard path
        // to the money surfaces. Added with the SAME lock rules as Sidebar.
        ...(permissions.canViewBilling ? ([{ id: 'nav-billing', title: billingLocked ? 'Financials (Upgrade)' : 'Go to Financials', type: 'Navigation', icon: <DashboardIcon />, action: () => billingLocked ? openModal('upgradePlan') : navigateTo('billing') }] as SearchResult[]) : []),
        ...(permissions.canViewBilling ? ([{ id: 'nav-reporting', title: reportingLocked ? 'Analytics (Upgrade)' : 'Go to Analytics', type: 'Navigation', icon: <DashboardIcon />, action: () => reportingLocked ? openModal('upgradePlan') : navigateTo('reporting') }] as SearchResult[]) : []),
        { id: 'nav-settings', title: 'Go to Settings', type: 'Navigation', icon: <CogIcon />, action: () => navigateTo('settings') },

        // Actions
        { id: 'act-new-matter', title: 'Create New Matter', type: 'Actions', icon: <PlusIcon />, action: () => openModal('newMatter') },
        { id: 'act-new-contact', title: 'Add New Contact', type: 'Actions', icon: <PlusIcon />, action: () => openModal('newContact') },
        { id: 'act-new-task', title: 'Create New Task', type: 'Actions', icon: <PlusIcon />, action: () => openModal('newTask') },
        { id: 'act-new-event', title: 'Schedule Event', type: 'Actions', icon: <PlusIcon />, action: () => openModal('newEvent') },
        { id: 'act-new-doc', title: 'Upload Document', type: 'Actions', icon: <PlusIcon />, action: () => openModal('batchUpload') },

        // System
        { id: 'sys-theme', title: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`, type: 'System', icon: theme === 'dark' ? <SunIcon /> : <MoonIcon />, action: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
        { id: 'sys-sidebar', title: 'Toggle Sidebar', type: 'System', icon: <div className="w-5 h-5 border border-current rounded flex items-center justify-center text-2xs">|||</div>, action: () => toggleSidebar() },
    ], [navigateTo, openModal, theme, setTheme, toggleSidebar, isLegalFirm, isPropertyFirm, researchLocked, reportingLocked, billingLocked, permissions.canViewBilling, permissions.canViewArchive]);

    // 2. Dynamic Data Search Index
    const searchIndex = useMemo(() => {
        const dataItems: SearchResult[] = [];

        // Matters
        matterState.matters.forEach(m => {
            const client = resolveContactById(matterState.contacts, m.clientId);
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

        // Properties — property-capable firms only (Atrium / Komplete),
        // matching the Sidebar/BottomNav gating (K-2 nav parity: desktop
        // search must not surface modules the firm cannot open).
        if (isPropertyFirm) {
            (coreState.properties || []).forEach(p => {
                dataItems.push({
                    id: `property-${p.id}`,
                    title: p.name || p.address || 'Unnamed Property',
                    subtitle: p.address || p.type || '',
                    type: 'Property',
                    icon: <OfficeBuildingIcon />,
                    action: () => navigateTo('propertyDetail', p.id)
                });
            });
        }

        return dataItems;
    }, [matterState, executionState, documentState, coreState.properties, navigateTo, openModal, isPropertyFirm]);

    // 3.5 Server Data Items (UX-14) — built from the server response when it
    // is available; the client index below remains the fallback.
    const serverDataItems = useMemo((): SearchResult[] | null => {
        if (!(canServerSearch && serverState.status === 'success')) return null;
        const data = serverState.data;
        const out: SearchResult[] = [];
        const push = (rows: { id: string }[] | undefined, type: ResultType, icon: React.ReactNode, decorate: (row: any) => { title: string; subtitle?: string }) => {
            (rows || []).forEach(row => {
                const { title, subtitle } = decorate(row);
                const dest = searchResultDestination(type as any, row.id);
                out.push({
                    id: `${type.toLowerCase()}-${row.id}`,
                    title,
                    subtitle,
                    type,
                    icon,
                    action: () => dest.modal ? openModal(dest.modal as any, row.id) : navigateTo(dest.view as any, row.id),
                });
            });
        };
        push(data.matters, 'Matter', <MattersIcon />, (m) => ({ title: m.title, subtitle: m.suitNumber }));
        push(data.contacts, 'Contact', <ContactsIcon />, (c) => ({ title: c.name, subtitle: c.email }));
        push(data.documents, 'Document', <DocumentsIcon />, (d) => ({ title: d.title }));
        push(data.tasks, 'Task', <TasksIcon />, (t) => ({ title: t.title }));
        if (isPropertyFirm) {
            push(data.properties, 'Property', <OfficeBuildingIcon />, (p) => ({ title: p.address, subtitle: p.status }));
        }
        return out;
    }, [canServerSearch, serverState, isPropertyFirm, openModal, navigateTo]);


    // 4. Filtering Logic
    const results = useMemo(() => {
        if (!query.trim()) return staticCommands; // Default to commands if empty

        // Commands always match locally; DATA results come from the server
        // when it answered (UX-14), otherwise the legacy client index.
        const commandFuse = new Fuse(staticCommands, { keys: [{ name: 'title', weight: 2 }, { name: 'type', weight: 0.5 }], threshold: 0.3, includeScore: true });
        const commandMatches = commandFuse.search(query).map((r: any) => r.item);

        const dataItems = serverDataItems ?? searchIndex;
        const dataMatches: SearchResult[] = serverDataItems
            ? dataItems // server already filtered by the query
            : new Fuse(dataItems, { keys: [{ name: 'title', weight: 2 }, { name: 'subtitle', weight: 1 }], threshold: 0.3, includeScore: true }).search(query).map((r: any) => r.item);

        const merged = [...commandMatches, ...dataMatches];
        return merged.slice(0, 15); // Limit to 15 results for performance
    }, [query, staticCommands, serverDataItems, searchIndex]);

    // UX-14 truncation state — the 15-row cap is honest about what it hides.
    const totalMatches = useMemo(() => {
        if (!query.trim()) return staticCommands.length;
        const dataItems = serverDataItems ?? searchIndex;
        const dataCount = serverDataItems
            ? dataItems.length
            : new Fuse(dataItems, { keys: [{ name: 'title', weight: 2 }, { name: 'subtitle', weight: 1 }], threshold: 0.3 }).search(query).length;
        const commandFuse = new Fuse(staticCommands, { keys: [{ name: 'title', weight: 2 }, { name: 'type', weight: 0.5 }], threshold: 0.3 });
        return commandFuse.search(query).length + dataCount;
    }, [query, staticCommands, serverDataItems, searchIndex]);

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

    // Ensure selected item is visible — use querySelector with data-index
    // to avoid off-by-one issues from wrapper divs
    useEffect(() => {
        if (listRef.current) {
            const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            }
        }
    }, [selectedIndex]);


    if (!isCommandPaletteOpen) return null;

    return (
        <div ref={paletteRef} role="dialog" aria-modal="true" aria-label="Command palette" className={`fixed inset-0 ${Z_CLASS.palette} flex items-start justify-center pt-[10vh] px-4`}>
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity" onClick={() => setCommandPaletteOpen(false)} />
            
            <div className="w-full max-w-2xl bg-white dark:bg-zinc-800 rounded-lg shadow-2xl border border-slate-200 dark:border-zinc-700 overflow-hidden relative z-10 flex flex-col max-h-[70vh] animate-slide-in-up">
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
                                    data-index={index}
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
                                    <span className={`text-2xs font-bold uppercase tracking-wider px-2 py-1 rounded ${index === selectedIndex ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-zinc-700 text-slate-500'}`}>
                                        {result.type}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                    {results.length > 0 && totalMatches > results.length && (
                        <p className="px-3 py-2 text-2xs text-slate-400 dark:text-zinc-500 text-center border-t border-slate-100 dark:border-zinc-800">
                            Showing {results.length} of {totalMatches} — refine your search to see the rest.
                        </p>
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
