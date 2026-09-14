/**
 * TenantPortal/PortalNav — top tab bar, mobile bottom navigation and the
 * "More" bottom sheet. Extracted from index.tsx (P5 monolith split,
 * 2026-09-14). JSX is verbatim.
 */
import React from 'react';
import { Receipt as ReceiptIcon, Home as HomeIcon } from 'lucide-react';
import NairaSymbol from '../../NairaSymbol';
import { ChatIcon, WrenchIcon, type TabId } from './shared';

export interface PortalTabDef {
  id: TabId; label: string; icon: React.ReactNode;
  badge?: number; disabled?: boolean;
}

export const PortalTabBar: React.FC<{
  tabs: PortalTabDef[]; activeTab: TabId; onTabChange: (t: TabId) => void;
}> = ({ tabs, activeTab, onTabChange }) => (
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 sm:px-6">
        <div className="flex gap-0 -mb-px overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap relative ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300'
              }`}
            >
              {tab.icon}
              <span className="text-xs sm:text-sm">{tab.label}</span>
              {tab.badge && tab.badge > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-2xs font-bold rounded-full flex items-center justify-center ml-0.5">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

);

export const PortalBottomNav: React.FC<{
  tabs: PortalTabDef[]; activeTab: TabId; onTabChange: (t: TabId) => void;
  messagingEnabled: boolean;
  unreadMessageCount: number;
  openMaintenanceCount: number;
  showMoreSheet: boolean;
  onOpenMore: () => void;
  onCloseMore: () => void;
}> = ({ tabs, activeTab, onTabChange, messagingEnabled, unreadMessageCount, openMaintenanceCount, showMoreSheet, onOpenMore, onCloseMore }) => (
  <>
      {/* ─── Mobile Bottom Navigation (portrait only) ──────────────────────
          A fixed bottom nav bar for mobile that provides quick access to the
          most-used tabs. Only visible on small screens (sm:hidden).
          Layout: Home | Ledger | Messages | More */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-around py-2 pb-safe">
        {[
          { id: 'dashboard' as TabId, label: 'Home', icon: <HomeIcon className="w-5 h-5" /> },
          { id: 'ledger' as TabId, label: 'Ledger', icon: <ReceiptIcon className="w-5 h-5" /> },
          ...(messagingEnabled ? [{ id: 'messages' as TabId, label: 'Messages', icon: <ChatIcon className="w-5 h-5" />, badge: unreadMessageCount }] : [{ id: 'maintenance' as TabId, label: 'Issues', icon: <WrenchIcon className="w-5 h-5" />, badge: openMaintenanceCount }]),
          { id: 'payments' as TabId, label: 'Pay', icon: <NairaSymbol className="w-5 h-4 inline" /> },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors relative ${
              activeTab === item.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-zinc-500'
            }`}
          >
            {item.icon}
            <span className="text-2xs font-bold">{item.label}</span>
            {(item as any).badge && (item as any).badge > 0 && (
              <span className="absolute top-0 right-1 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-3xs font-bold rounded-full flex items-center justify-center">
                {(item as any).badge > 99 ? '99+' : (item as any).badge}
              </span>
            )}
          </button>
        ))}
        {/* More button — opens a bottom sheet with the remaining tabs.
            SIMPLIFY FIX: it previously just jumped to the first remaining tab
            (always Notices) with no menu — users thought "More" was broken
            because the sheet the label promises never appeared. */}
        <button
          onClick={() => onOpenMore()}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-slate-400 dark:text-zinc-500"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          <span className="text-2xs font-bold">More</span>
        </button>
      </div>

      {/* ─── More sheet (mobile) ───────────────────────────────────────── */}
      {showMoreSheet && (
        <div className="sm:hidden fixed inset-0 z-40" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => onCloseMore()} />
          <div className="absolute bottom-0 inset-x-0 bg-white dark:bg-zinc-900 rounded-t-2xl border-t border-slate-200 dark:border-zinc-800 max-h-[70dvh] overflow-y-auto pb-safe animate-fade-in">
            <div className="sticky top-0 bg-white dark:bg-zinc-900 px-4 py-3 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">More</span>
              <button onClick={() => onCloseMore()} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 p-4">
              {tabs.filter(t => !['dashboard', 'ledger', 'messages', 'maintenance', 'payments'].includes(t.id) && !t.disabled).map(t => (
                <button
                  key={t.id}
                  onClick={() => { onCloseMore(); onTabChange(t.id); }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 active:scale-95 transition-all relative"
                >
                  {t.icon}
                  <span className="text-2xs font-bold text-center leading-tight">{t.label}</span>
                  {t.badge && t.badge > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 bg-red-500 text-white text-3xs font-bold rounded-full flex items-center justify-center">
                      {t.badge > 99 ? '99+' : t.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

  </>
);
