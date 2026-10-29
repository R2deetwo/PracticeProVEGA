/**
 * EstateExplorer — the desktop frame: the Atrium workspace as a visitor
 * plays it (R41).
 *
 * The app's own split layout — sidebar nav, Properties master list,
 * detail pane — at the workspace's real typography, running the shared
 * estateChrome replica on the demo estate. Hovering a property card
 * shows the "Open →" hint; clicking opens the property the way the app
 * does (multi-unit estates land on the Units tab); a unit click expands
 * the card into its larger form; More pulls the full detail + action
 * set. Everything that would mutate answers with an honest preview
 * toast. The ALOA FAB and every nav surface stay live to the touch.
 */
import React from 'react';
import { Menu, ChevronLeft, ChevronRight, Search, Bell } from 'lucide-react';
import { MANAGER, FIRM_LABEL } from './estateDemoData';
import {
    useEstateExplorerState, PropertiesPanel, PropertyDetail, DetailEmptyState,
    EstateToast, WORKSPACE_NAV, WORKSPACE_NAV_OPS,
} from './estateChrome';

const NavRow: React.FC<{
    label: string;
    icon: React.ReactNode;
    active?: boolean;
    onClick: () => void;
}> = ({ label, icon, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-2xs font-semibold transition-colors ${
            active ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
        }`}
    >
        {icon}
        <span className="truncate">{label}</span>
    </button>
);

export const EstateExplorer: React.FC = () => {
    const state = useEstateExplorerState();

    return (
        <div
            className="relative flex flex-col h-full w-full bg-white overflow-hidden select-none"
            role="region"
            aria-label="Atrium workspace — interactive preview"
        >
            {/* ── The app's global header ── */}
            <div className="h-11 flex-shrink-0 flex items-center gap-2 px-3 bg-white border-b border-slate-200">
                <button
                    onClick={() => state.showToast('Preview — the sidebar is always one tap away in the product.')}
                    aria-label="Menu"
                    className="text-slate-500 hover:text-slate-800"
                >
                    <Menu className="w-4 h-4" />
                </button>
                <ChevronLeft className="w-4 h-4 text-slate-300" />
                <ChevronRight className="w-4 h-4 text-slate-300" />
                <div className="flex-1 max-w-[210px] relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <div className="w-full pl-8 pr-2 py-1.5 text-2xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                        <span>Search...</span>
                        <kbd className="text-3xs font-bold text-slate-400 border border-slate-200 rounded px-1">⌘K</kbd>
                    </div>
                </div>
                {/* The product switcher — Atrium is live on this workspace */}
                <div className="flex rounded-full border border-slate-200 p-0.5 flex-shrink-0" aria-label="Product switcher">
                    <span className="px-2 py-0.5 rounded-full text-3xs font-black text-slate-400">VEGA</span>
                    <span className="px-2 py-0.5 rounded-full text-3xs font-black bg-primary-600 text-white">ATRIUM</span>
                </div>
                <button
                    onClick={() => state.showToast('Preview — notifications open the notification center.')}
                    aria-label="Notifications"
                    className="relative text-slate-500 hover:text-slate-800 flex-shrink-0"
                >
                    <Bell className="w-4 h-4" />
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500" />
                </button>
                <div className="w-6 h-6 rounded-full bg-emerald-700 text-white text-2xs font-black flex items-center justify-center flex-shrink-0" title={MANAGER.name}>
                    {MANAGER.initials}
                </div>
            </div>

            {/* ── The split body ── */}
            <div className="flex flex-1 min-h-0">
                {/* Sidebar — the workspace nav */}
                <aside className="w-[118px] flex-shrink-0 bg-white border-r border-slate-200 flex-col hidden sm:flex">
                    <div className="px-2.5 py-2.5 border-b border-slate-100 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary-600 text-white text-2xs font-black flex items-center justify-center flex-shrink-0">
                            AT
                        </div>
                        <div className="min-w-0">
                            <p className="text-2xs font-bold text-slate-800 truncate leading-tight">{FIRM_LABEL.name}</p>
                            <p className="text-3xs text-slate-400 uppercase tracking-wider">{FIRM_LABEL.sub}</p>
                        </div>
                    </div>
                    <nav className="flex-1 overflow-y-auto py-2 space-y-0.5">
                        <p className="px-2.5 text-3xs font-bold text-slate-400 uppercase tracking-widest mb-1">Main Menu</p>
                        {WORKSPACE_NAV.map(item => (
                            <NavRow
                                key={item.label}
                                label={item.label}
                                icon={item.icon}
                                active={item.label === 'Properties'}
                                onClick={() =>
                                    item.label === 'Properties'
                                        ? undefined
                                        : state.showToast(`Preview keeps to Properties — ${item.label} opens in the product.`)
                                }
                            />
                        ))}
                        <p className="px-2.5 text-3xs font-bold text-slate-400 uppercase tracking-widest mb-1 mt-3">Operations</p>
                        {WORKSPACE_NAV_OPS.map(item => (
                            <NavRow
                                key={item.label}
                                label={item.label}
                                icon={item.icon}
                                onClick={() => state.showToast(`Preview keeps to Properties — ${item.label} opens in the product.`)}
                            />
                        ))}
                    </nav>
                </aside>

                {/* Master — the Properties list */}
                <div className="w-[218px] flex-shrink-0 hidden md:block">
                    <PropertiesPanel state={state} hintLabel="Click a property to explore" />
                </div>

                {/* Detail — the property workspace */}
                <div className="flex-1 min-w-0 bg-white">
                    {state.property ? (
                        <PropertyDetail property={state.property} state={state} variant="desktop" onBack={state.closeProperty} />
                    ) : (
                        <DetailEmptyState showToast={state.showToast} />
                    )}
                </div>
            </div>

            <EstateToast toast={state.toast} />
        </div>
    );
};
