import React, { useState } from 'react';
import LedgerManager from './LedgerManager';
import ServiceChargeMonitor from './ServiceChargeMonitor';
import VacancyPipeline from './VacancyPipeline';
import { AtriumInbox } from './AtriumInbox';
import AutomationCenter from './AutomationCenter';

import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import ErrorBoundary from '../ErrorBoundary';

// ── Tab Icons ─────────────────────────────────────────────────────────────
const ShieldIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const LedgerIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
    <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
  </svg>
);
const BellIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
  </svg>
);
const FunnelIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);
const InboxIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

type TabId = 'defaulters' | 'ledger' | 'automations' | 'pipeline' | 'inbox';


interface Tab {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  badge?: number;
}

const RevenueEngine: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('defaulters');
  const { currentUser } = useAuth();
  const { coreState } = useCoreState();
  const firmId = coreState.firmDetails?.id || currentUser?.firmId || '';

  const { ledgerEntries, serviceCharges, leadsPipeline, automationLogs } = coreState;

  const criticalCount = (serviceCharges || []).filter(d => d.isDefaulter && (d.daysOverdue ?? 0) > 14).length;
  const pendingLedger = (ledgerEntries || []).filter(e => e.status === 'defaulted').length;
  const todayLogs = (automationLogs || []).filter(l => l.sentAt > Date.now() - 86400000).length;
  const activePipeline = (leadsPipeline || []).filter(l => l.stage !== 'Closed').length;

  const tabs: Tab[] = [
    { id: 'defaulters', label: 'Service Charges', shortLabel: 'Charges', icon: <ShieldIcon />, badge: criticalCount || undefined },
    { id: 'ledger', label: 'Payments & Receipts', shortLabel: 'Payments', icon: <LedgerIcon />, badge: pendingLedger || undefined },
    { id: 'inbox', label: 'Unified Inbox', shortLabel: 'Inbox', icon: <InboxIcon /> },
    { id: 'automations', label: 'Automation Center', shortLabel: 'Automations', icon: <BellIcon />, badge: todayLogs || undefined },
    { id: 'pipeline', label: 'Available Units', shortLabel: 'Vacancies', icon: <FunnelIcon />, badge: activePipeline || undefined },
  ];


  return (
    <div className="flex flex-col bg-slate-950 text-white" style={{ height: '100dvh' }}>
      {/* Top Header — compact on mobile */}
      <div className="flex-shrink-0 border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm landscape-shrink">
        {/* Title row */}
        <div className="px-4 sm:px-6 pt-3 pb-2 sm:pt-5 sm:pb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
              <ShieldIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-white tracking-tight leading-none">Revenue Monitor</h1>
              <p className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 uppercase tracking-widest font-medium landscape-hide">Atrium · Property OS</p>
            </div>
          </div>
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 bg-rose-950/60 border border-rose-800 rounded-xl px-2.5 py-1.5 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-[10px] sm:text-xs font-bold text-rose-400">{criticalCount} Critical</span>
            </div>
          )}
        </div>

        {/* Stats — 4-col on desktop, 2x2 on mobile, more compact */}
        <div className="px-3 sm:px-6 pb-2 sm:pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2 landscape-compact-stats">
          <div className="bg-slate-900 border border-emerald-900/40 rounded-xl p-2 sm:p-2.5">
            <p className="text-[7px] sm:text-[8px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">Collected</p>
            <p className="text-sm sm:text-base font-black text-emerald-400">
              ₦{((coreState.ledgerEntries || []).filter(e => {
                const d = new Date(e.timestamp || Date.now());
                const now = new Date();
                return e.status === 'cleared' && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
              }).reduce((s, e) => s + (e.amount || 0), 0) || 0).toLocaleString('en-NG', { notation: 'compact', maximumFractionDigits: 1 })}
            </p>
          </div>
          <div className="bg-slate-900 border border-amber-900/40 rounded-xl p-2 sm:p-2.5">
            <p className="text-[7px] sm:text-[8px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">Outstanding</p>
            <p className="text-sm sm:text-base font-black text-amber-400">
              ₦{((coreState.ledgerEntries || []).filter(e => e.status === 'pending').reduce((s, e) => s + (e.amount || 0), 0) || 0).toLocaleString('en-NG', { notation: 'compact', maximumFractionDigits: 1 })}
            </p>
          </div>
          <div className="bg-slate-900 border border-rose-900/40 rounded-xl p-2 sm:p-2.5">
            <p className="text-[7px] sm:text-[8px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">Defaults</p>
            <p className="text-sm sm:text-base font-black text-rose-400">{criticalCount}</p>
          </div>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-2 sm:p-2.5">
            <p className="text-[7px] sm:text-[8px] text-slate-500 uppercase tracking-widest font-bold mb-0.5">Vacant</p>
            <p className="text-sm sm:text-base font-black text-slate-300">{activePipeline}</p>
          </div>
        </div>
      </div>

      {/* Tab Bar — sticky, horizontally scrollable */}
      <div className="flex-shrink-0 bg-slate-900 border-b border-slate-800 overflow-x-auto no-scrollbar">
        <div className="flex px-3 sm:px-6 gap-0 flex-nowrap min-w-max">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold transition-all border-b-2 -mb-px flex-shrink-0 whitespace-nowrap ${
                  isActive
                    ? 'border-emerald-500 text-white'
                    : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700'
                }`}
              >
                <span className={`${isActive ? 'text-emerald-400' : 'text-slate-600'} w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0`}>
                  {React.cloneElement(tab.icon as React.ReactElement<any>, { className: 'w-4 h-4 sm:w-5 sm:h-5' })}
                </span>
                <span className="hidden sm:block">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                    tab.id === 'defaulters' ? 'bg-rose-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content — sub-modules handle their own internal scrolling, but we ensure a safety scroll here */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-44 sm:pb-12">
        <ErrorBoundary fallback={<div className="p-6 text-center text-rose-500">Failed to load this section. Please try refreshing.</div>}>
          <div className="h-full">
            {activeTab === 'defaulters' && <ServiceChargeMonitor />}
            {activeTab === 'ledger' && <LedgerManager />}
            {activeTab === 'inbox' && <AtriumInbox />}
            {activeTab === 'automations' && <AutomationCenter />}
            {activeTab === 'pipeline' && <VacancyPipeline />}
          </div>
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default RevenueEngine;

