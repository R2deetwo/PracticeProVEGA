/**
 * TenantPortal — Atrium Residents' Portal
 *
 * Read-only portal for residents to view their financial ledger,
 * download rent receipts, check SC/MV status, log maintenance tickets,
 * and view messages from their property manager.
 *
 * Feature-gated: canUseTenantPortal (Atrium Growth+ only)
 * Role-gated: Only users with role === 'Tenant'
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useFeatures } from '../../hooks/useFeatures';
import NairaSymbol from '../NairaSymbol';
import {
  EyeIcon,
  OfficeBuildingIcon,
  DownloadIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  DocumentIcon,
  MailIcon,
  BellIcon,
} from '../../constants';

// ─── Local Icons ──────────────────────────────────────────────────────────────
const ReceiptIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <path d="M8 7h8" /><path d="M8 11h8" /><path d="M8 15h5" />
  </svg>
);

const WrenchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

const ChatIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatNaira = (amount: number) => (
  <span className="inline-flex items-center">
    <NairaSymbol />{amount.toLocaleString()}
  </span>
);

const formatDate = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' });
};

// ─── Tab Type ─────────────────────────────────────────────────────────────────
type TabId = 'ledger' | 'receipts' | 'maintenance' | 'messages';

// ─── Main Component ──────────────────────────────────────────────────────────
const TenantPortal: React.FC = () => {
  const { currentUser, originalUser, revertToOriginalUser, logout } = useAuth();
  const { coreState } = useCoreState();
  const { addToast } = useUI();
  const { canUseTenantPortal } = useFeatures();
  const [activeTab, setActiveTab] = useState<TabId>('ledger');

  // Access guard
  if (!currentUser) return null;

  // SAFETY NET: Portal users with a valid Tenant role should ALWAYS be able
  // to access their portal. The canUseTenantPortal feature gate is meant to
  // control whether ADMINS can create portal invites — it should never block
  // an already-authenticated portal user from accessing their own dashboard.
  // Only show the upgrade prompt if the user is NOT a Tenant role (e.g. admin previewing).
  if (!canUseTenantPortal && currentUser.role !== 'Tenant') {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
            <OfficeBuildingIcon className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Residents' Portal Unavailable</h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
            The Residents' Portal is available on Growth and Pro plans. Ask your property manager to upgrade.
          </p>
        </div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'ledger', label: 'Ledger', icon: <ReceiptIcon className="w-4 h-4" /> },
    { id: 'receipts', label: 'Receipts', icon: <DownloadIcon className="w-4 h-4" /> },
    { id: 'maintenance', label: 'Maintenance', icon: <WrenchIcon className="w-4 h-4" /> },
    { id: 'messages', label: 'Messages', icon: <ChatIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Impersonation Banner — shown when admin is viewing as this tenant */}
      {originalUser && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <EyeIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
              You are previewing the portal as <strong>{currentUser.name || currentUser.email}</strong>
            </p>
          </div>
          <button
            onClick={revertToOriginalUser}
            className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex-shrink-0"
          >
            Return to Admin
          </button>
        </div>
      )}
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 sm:px-6 py-4 sm:py-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
              <OfficeBuildingIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Residents' Portal</h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Welcome, {currentUser.name}
              </p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="px-3 py-1.5 text-xs font-bold text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 sm:px-6">
        <div className="flex gap-0 -mb-px overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 dark:bg-zinc-900">
        {activeTab === 'ledger' && <LedgerTab />}
        {activeTab === 'receipts' && <ReceiptsTab addToast={addToast} />}
        {activeTab === 'maintenance' && <MaintenanceTab addToast={addToast} />}
        {activeTab === 'messages' && <MessagesTab />}
      </div>

      {/* Trust Badges */}
      <div className="flex-shrink-0 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[10px] text-slate-400 dark:text-zinc-500">
          <span className="flex items-center gap-1">
            <CheckIcon className="w-3 h-3 text-emerald-500" /> Secure Portal
          </span>
          <span className="flex items-center gap-1">
            <BanknotesIcon className="w-3 h-3 text-emerald-500" /> Payment Verified
          </span>
          <span className="flex items-center gap-1">
            <DocumentIcon className="w-3 h-3 text-emerald-500" /> Audit Trail
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── Financial Ledger Tab ────────────────────────────────────────────────────
const LedgerTab: React.FC = () => {
  const { currentUser } = useAuth();
  const { coreState } = useCoreState();
  const firmId = currentUser?.firmId || '';
  const userId = currentUser?.id || '';
  const email = currentUser?.email || '';

  // First, resolve the correct tenant ID using getTenantInfo
  // This handles the case where properties store tenantId as email instead of Convex _id
  const tenantInfo = useQuery(
    api.portals.getTenantInfo,
    firmId && userId ? { firmId, userId, email } : 'skip'
  );

  // Use the resolved tenantId from getTenantInfo, or fall back to currentUser.id
  const resolvedTenantId = tenantInfo?.tenantId || userId;

  // Fetch ledger entries from Convex using the resolved tenant ID
  const ledgerEntries = useQuery(
    api.portals.getTenantLedger,
    firmId && resolvedTenantId ? { firmId, tenantId: resolvedTenantId } : 'skip'
  );

  // Fetch service charges from Convex to compute current SC/MV
  const serviceCharges = useQuery(
    api.sentry.getServiceChargesByFirm,
    firmId ? { firmId } : 'skip'
  );

  const isLoading = ledgerEntries === undefined || serviceCharges === undefined;

  // Compute tenant-specific service charges
  const tenantServiceCharges = useMemo(() => {
    if (!serviceCharges || !resolvedTenantId) return [];
    return serviceCharges.filter((sc: any) => sc.tenantId === resolvedTenantId);
  }, [serviceCharges, resolvedTenantId]);

  // Summary calculations
  const currentMonthSC = useMemo(() => {
    return tenantServiceCharges
      .filter((sc: any) => !sc.isMinimumVend)
      .reduce((sum: number, sc: any) => sum + (sc.outstandingBalance ?? sc.amount), 0);
  }, [tenantServiceCharges]);

  const currentMonthMV = useMemo(() => {
    return tenantServiceCharges
      .filter((sc: any) => sc.isMinimumVend)
      .reduce((sum: number, sc: any) => sum + (sc.outstandingBalance ?? sc.amount), 0);
  }, [tenantServiceCharges]);

  const outstandingBalance = useMemo(() => {
    if (!ledgerEntries) return 0;
    return ledgerEntries
      .filter((e: any) => e.status === 'pending' || e.status === 'defaulted')
      .reduce((sum: number, e: any) => sum + e.amount, 0);
  }, [ledgerEntries]);

  const scPaid = tenantServiceCharges.filter((sc: any) => !sc.isMinimumVend && sc.serviceChargeStatus === 'PAID_FULLY').length > 0;
  const mvStatus = tenantServiceCharges.filter((sc: any) => sc.isMinimumVend).length > 0
    ? (tenantServiceCharges.filter((sc: any) => sc.isMinimumVend && sc.serviceChargeStatus === 'PAID_FULLY').length > 0 ? 'paid' : 'pending')
    : null;

  if (isLoading) {
    return (
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-slate-200 dark:border-zinc-700 animate-pulse">
              <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-24 mb-2" />
              <div className="h-7 bg-slate-200 dark:bg-zinc-700 rounded w-32 mb-1" />
              <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-16" />
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-6 animate-pulse">
          <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-full mb-3" />
          <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-3/4 mb-3" />
          <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-1/2" />
        </div>
      </div>
    );
  }

  const hasLedgerData = ledgerEntries && ledgerEntries.length > 0;
  const hasServiceCharges = tenantServiceCharges.length > 0;

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Payment Ledger</h3>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
        View your rent, Service Charge (SC), and Minimum Vend (MV) obligations and payment status.
      </p>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-slate-200 dark:border-zinc-700">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Current Month SC</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatNaira(currentMonthSC)}
          </p>
          {hasServiceCharges && !currentMonthSC ? (
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
              <CheckIcon className="w-3 h-3" /> Paid
            </span>
          ) : currentMonthSC > 0 ? (
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
              <ExclamationTriangleIcon className="w-3 h-3" /> Due
            </span>
          ) : null}
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-slate-200 dark:border-zinc-700">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Current Month MV</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {currentMonthMV > 0 ? formatNaira(currentMonthMV) : '—'}
          </p>
          {mvStatus === 'paid' ? (
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
              <CheckIcon className="w-3 h-3" /> Paid
            </span>
          ) : mvStatus === 'pending' ? (
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
              <ExclamationTriangleIcon className="w-3 h-3" /> Pending
            </span>
          ) : null}
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-slate-200 dark:border-zinc-700">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Outstanding Balance</p>
          <p className={`text-2xl font-bold ${outstandingBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {outstandingBalance > 0 ? formatNaira(outstandingBalance) : formatNaira(0)}
          </p>
          {outstandingBalance > 0 && (
            <p className="text-[10px] text-slate-400 mt-1">
              {ledgerEntries?.filter((e: any) => e.status === 'pending' || e.status === 'defaulted').length || 0} unpaid {ledgerEntries?.filter((e: any) => e.status === 'pending' || e.status === 'defaulted').length === 1 ? 'entry' : 'entries'}
            </p>
          )}
          {outstandingBalance === 0 && hasLedgerData && (
            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
              <CheckIcon className="w-3 h-3" /> All Clear
            </span>
          )}
        </div>
      </div>

      {/* Service Charges Section */}
      {hasServiceCharges && (
        <div className="mb-6">
          <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3">Service Charges</h4>
          <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                    <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Category</th>
                    <th className="text-right px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Amount</th>
                    <th className="text-right px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Outstanding</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Cycle</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tenantServiceCharges.map((sc: any) => {
                    const isMV = sc.isMinimumVend;
                    const statusLabel = sc.serviceChargeStatus === 'PAID_FULLY'
                      ? 'Paid' : sc.serviceChargeStatus === 'PARTIALLY_PAID'
                      ? 'Partial' : 'Unpaid';
                    return (
                      <tr key={sc._id} className="border-b border-slate-100 dark:border-zinc-700/50 last:border-0">
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-zinc-200">
                          {isMV ? (sc.category === 'Other' ? 'Minimum Vend' : sc.category) : sc.category}
                          {isMV && <span className="ml-1 text-[9px] text-emerald-500 font-bold">(MV)</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-zinc-300">{formatNaira(sc.amount)}</td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-zinc-300">
                          {formatNaira(sc.outstandingBalance ?? sc.amount)}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500 dark:text-zinc-400 text-xs">{sc.cycle}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            sc.serviceChargeStatus === 'PAID_FULLY'
                              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                              : sc.serviceChargeStatus === 'PARTIALLY_PAID'
                              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
                          }`}>
                            {sc.serviceChargeStatus === 'PAID_FULLY'
                              ? <CheckIcon className="w-3 h-3" />
                              : <ExclamationTriangleIcon className="w-3 h-3" />}
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      {hasLedgerData ? (
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
                  <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Period</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Type</th>
                  <th className="text-right px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Amount</th>
                  <th className="text-center px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Ref</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((entry: any) => (
                  <tr key={entry._id} className="border-b border-slate-100 dark:border-zinc-700/50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-zinc-200">
                      {entry.period || formatDate(entry.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-zinc-300 capitalize">
                      {entry.type?.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-zinc-300">
                      {formatNaira(entry.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        entry.status === 'cleared'
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                          : entry.status === 'defaulted'
                          ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
                          : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                      }`}>
                        {entry.status === 'cleared'
                          ? <CheckIcon className="w-3 h-3" />
                          : <ExclamationTriangleIcon className="w-3 h-3" />}
                        {entry.status === 'cleared' ? 'Paid' : entry.status === 'defaulted' ? 'Defaulted' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 dark:text-zinc-500 text-xs font-mono">
                      {entry.txHash || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-zinc-700 flex items-center justify-center mb-3">
            <ReceiptIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">No payment records found</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Your property manager will add ledger entries as payments become due.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Receipts Tab ────────────────────────────────────────────────────────────
const ReceiptsTab: React.FC<{ addToast: (msg: React.ReactNode, opts?: any) => void }> = ({ addToast }) => {
  const { currentUser } = useAuth();
  const firmId = currentUser?.firmId || '';
  const userId = currentUser?.id || '';
  const email = currentUser?.email || '';

  // Resolve the correct tenant ID
  const tenantInfo = useQuery(
    api.portals.getTenantInfo,
    firmId && userId ? { firmId, userId, email } : 'skip'
  );
  const resolvedTenantId = tenantInfo?.tenantId || userId;

  // Fetch ledger entries — receipts are cleared entries
  const ledgerEntries = useQuery(
    api.portals.getTenantLedger,
    firmId && resolvedTenantId ? { firmId, tenantId: resolvedTenantId } : 'skip'
  );

  const isLoading = ledgerEntries === undefined;

  // Filter for cleared entries (these are receipts)
  const receipts = useMemo(() => {
    if (!ledgerEntries) return [];
    return ledgerEntries.filter((e: any) => e.status === 'cleared');
  }, [ledgerEntries]);

  const handleDownload = (entry: any) => {
    addToast('PDF generation coming soon. Your receipt details are visible below.', { type: 'info' });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-zinc-700" />
              <div className="flex-1">
                <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-48 mb-2" />
                <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-32" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Payment Receipts</h3>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
        View and download PDF receipts for your completed payments.
      </p>

      {receipts.length > 0 ? (
        <div className="space-y-3">
          {receipts.map((r: any) => (
            <div
              key={r._id}
              className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                  <ReceiptIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="min-w-0 sm:min-w-0">
                  <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200">
                    {r.description || `${r.type?.replace('_', ' ')} — ${r.period || formatDate(r.timestamp)}`}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {formatDate(r.timestamp)} · {formatNaira(r.amount)}
                    {r.paymentRef && <span className="ml-2">Ref: {r.paymentRef}</span>}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDownload(r)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors"
              >
                <DownloadIcon className="w-3.5 h-3.5" /> PDF
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-zinc-700 flex items-center justify-center mb-3">
            <DownloadIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">No receipts yet</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Receipts will appear here after your payments are confirmed.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Maintenance Tab ─────────────────────────────────────────────────────────
const MaintenanceTab: React.FC<{ addToast: (msg: React.ReactNode, opts?: any) => void }> = ({ addToast }) => {
  const { currentUser } = useAuth();
  const { coreState } = useCoreState();
  const firmId = currentUser?.firmId || '';
  const userId = currentUser?.id || '';
  const email = currentUser?.email || '';

  // Resolve the correct tenant ID
  const tenantInfo = useQuery(
    api.portals.getTenantInfo,
    firmId && userId ? { firmId, userId, email } : 'skip'
  );
  const resolvedTenantId = tenantInfo?.tenantId || userId;

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'plumbing' | 'electrical' | 'structural' | 'other'>('other');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch tickets from Convex
  const tickets = useQuery(
    api.portals.getMaintenanceTicketsByTenant,
    resolvedTenantId ? { tenantId: resolvedTenantId } : 'skip'
  );

  // Mutation for creating a ticket
  const createTicket = useMutation(api.portals.createMaintenanceTicket);

  // Find the tenant's property to get propertyId
  const tenantProperty = useMemo(() => {
    if (!coreState?.properties) return null;
    return coreState.properties.find(
      (p: any) => p.currentTenantId === resolvedTenantId || p.tenantId === resolvedTenantId
    );
  }, [coreState?.properties, resolvedTenantId]);

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      addToast('Please fill in all fields before submitting.', { type: 'info' });
      return;
    }
    if (!tenantProperty) {
      addToast('No property found for your account. Please contact your property manager.', { type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      await createTicket({
        firmId,
        propertyId: tenantProperty.id,
        tenantId: resolvedTenantId,
        tenantName: currentUser?.name || undefined,
        subject: subject.trim(),
        description: description.trim(),
        category,
      });
      addToast('Maintenance ticket submitted successfully. Your property manager has been notified.', { type: 'success' });
      setSubject('');
      setDescription('');
      setCategory('other');
    } catch (err: any) {
      addToast(err.message || 'Failed to submit ticket. Please try again.', { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = tickets === undefined;

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      open: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', label: 'Open' },
      in_progress: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', label: 'In Progress' },
      resolved: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', label: 'Resolved' },
      closed: { bg: 'bg-slate-100 dark:bg-zinc-700', text: 'text-slate-600 dark:text-zinc-400', label: 'Closed' },
    };
    const c = config[status] || config.open;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${c.bg} ${c.text}`}>
        {status === 'resolved' || status === 'closed' ? <CheckIcon className="w-3 h-3" /> : <ExclamationTriangleIcon className="w-3 h-3" />}
        {c.label}
      </span>
    );
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Maintenance Tickets</h3>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
        Log maintenance issues directly into your property manager's workflow.
      </p>

      {/* New Ticket Form */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-5 mb-6">
        <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3">Report New Issue</h4>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="plumbing">Plumbing</option>
              <option value="electrical">Electrical</option>
              <option value="structural">Structural / Roof</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g., Leaking roof in bedroom"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the issue in detail..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </div>
      </div>

      {/* Existing Tickets */}
      <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3">Your Tickets</h4>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-zinc-700" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-40 mb-2" />
                  <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : tickets && tickets.length > 0 ? (
        <div className="space-y-2">
          {tickets.map((t: any) => (
            <div
              key={t._id}
              className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 flex flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  t.status === 'resolved' || t.status === 'closed'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20'
                    : t.status === 'in_progress'
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'bg-amber-50 dark:bg-amber-900/20'
                }`}>
                  <WrenchIcon className={`w-4 h-4 ${
                    t.status === 'resolved' || t.status === 'closed'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : t.status === 'in_progress'
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200 truncate">{t.subject}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    {t.category && <span className="capitalize">{t.category}</span>}
                    {t.category && ' · '}
                    {formatDate(t.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0">{getStatusBadge(t.status)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-zinc-700 flex items-center justify-center mb-3">
            <WrenchIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">No maintenance tickets</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Use the form above to report any issues in your unit.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Messages Tab ────────────────────────────────────────────────────────────
const MessagesTab: React.FC = () => {
  const { currentUser } = useAuth();
  const userId = currentUser?.id || '';
  const firmId = currentUser?.firmId || '';
  const email = currentUser?.email || '';

  // Resolve the correct tenant ID
  const tenantInfo = useQuery(
    api.portals.getTenantInfo,
    firmId && userId ? { firmId, userId, email } : 'skip'
  );
  const resolvedTenantId = tenantInfo?.tenantId || userId;

  // Fetch inbound messages for this tenant from Convex
  const messages = useQuery(
    api.portals.getInboundMessagesByTenant,
    resolvedTenantId ? { tenantId: resolvedTenantId } : 'skip'
  );

  const isLoading = messages === undefined;

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return (
          <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        );
      case 'email':
        return <MailIcon className="w-4 h-4 text-blue-500" />;
      case 'sms':
        return <ChatIcon className="w-4 h-4 text-violet-500" />;
      default:
        return <BellIcon className="w-4 h-4 text-slate-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-zinc-700" />
              <div className="flex-1">
                <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Messages</h3>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
        Recent messages from your property manager.
      </p>

      {messages && messages.length > 0 ? (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {messages.map((msg: any) => (
            <div
              key={msg._id}
              className={`bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 ${
                !msg.isRead ? 'border-l-4 border-l-emerald-400' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {getChannelIcon(msg.channel)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {msg.senderName && (
                      <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">{msg.senderName}</span>
                    )}
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 capitalize">{msg.channel}</span>
                    {!msg.isRead && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-slate-700 dark:text-zinc-300 break-words">{msg.content}</p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">
                    {formatDate(msg.receivedAt)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 dark:bg-zinc-700 flex items-center justify-center mb-3">
            <ChatIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">No messages</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            No messages from your property manager.
          </p>
        </div>
      )}
    </div>
  );
};

export default TenantPortal;
