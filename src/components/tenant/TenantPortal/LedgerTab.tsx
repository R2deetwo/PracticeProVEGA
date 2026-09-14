/**
 * TenantPortal Ledger tab — financial ledger (rent, service charge, electricity, internet).
 *
 * Extracted from TenantPortal.tsx (P5 monolith split, 2026-09-14).
 * Body is verbatim from the original file — zero behavioral change.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '../../../contexts/AuthContext';
import { CheckIcon, ExclamationTriangleIcon } from '../../../constants';
import { Receipt as ReceiptIcon } from 'lucide-react';
import { formatNaira, formatDate } from './shared';

export const LedgerTab: React.FC<{ tenantInfo: any; effectiveFirmId?: string }> = ({ tenantInfo, effectiveFirmId }) => {
  const { currentUser, bearerToken } = useAuth();
  const firmId = effectiveFirmId || currentUser?.firmId || '';
  const userId = currentUser?.id || '';
  const resolvedTenantId = tenantInfo?.tenantId || userId;

  // ── Categorized sub-tabs (All / SC / Electricity / Internet / Waste / Rent) ──
  const [ledgerSubTab, setLedgerSubTab] = useState<string>('all');
  const [ledgerSearch, setLedgerSearch] = useState('');

  // Read ?tab= from URL for Quick Service routing (e.g. /portal/ledger?tab=service_charge)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam) {
      setLedgerSubTab(tabParam);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const ledgerEntries = useQuery(
    api.portals.getTenantLedger,
    firmId && resolvedTenantId ? { firmId, tenantId: resolvedTenantId, email: currentUser?.email } : 'skip'
  );

  // Fetch service charges from Convex to compute current SC/MV.
  // SECURITY: tenant-scoped endpoint (portals.getTenantServiceCharges) —
  // the old firm-wide sentry.getServiceChargesByFirm leaked every other
  // tenant's charges into the tenant portal before client-side filtering.
  const serviceCharges = useQuery(
    api.portals.getTenantServiceCharges,
    firmId && resolvedTenantId ? { firmId, tenantId: resolvedTenantId, email: currentUser?.email } : 'skip'
  );

  const isLoading = ledgerEntries === undefined || serviceCharges === undefined;

  // ROUND 6: the server endpoint (portals.getTenantServiceCharges) already
  // scopes rows via possibleTenantIds {userId, email, Convex user _id, raw
  // tenant ids}. The old client re-filter `sc.tenantId === resolvedTenantId`
  // was stricter than the server and HID legitimately-matched rows whenever
  // the backfilled tenantId (Convex user _id) differed from the portal's
  // resolvedTenantId (raw contact id) — exactly the rows the round-6
  // migration backfills. Server result is authoritative; use it directly.
  const tenantServiceCharges = useMemo(() => serviceCharges || [], [serviceCharges]);

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
            <div key={i} className="bg-white dark:bg-zinc-800 rounded-lg p-4 border border-slate-200 dark:border-zinc-700 animate-pulse">
              <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-24 mb-2" />
              <div className="h-7 bg-slate-200 dark:bg-zinc-700 rounded w-32 mb-1" />
              <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-16" />
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-6 animate-pulse">
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
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
        View your rent, Service Charge (SC), and Minimum Vend (MV) obligations and payment status.
      </p>

      {/* Estate Compliance Notice */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/50 rounded-lg p-3 mb-4 flex items-start gap-2">
        <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          <strong>Estate Compliance Notice:</strong> Payment status and timeliness records are synchronized with estate management logs. Frequent late payments may result in administrative late charges or temporary service suspension per estate regulations.
        </p>
      </div>

      {/* Categorized Sub-Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {[
          { key: 'all', label: 'All Charges' },
          { key: 'service_charge', label: 'Service Charge' },
          { key: 'electricity', label: 'Electricity' },
          { key: 'internet', label: 'Internet' },
          { key: 'waste', label: 'Waste Mgmt' },
          { key: 'rent', label: 'Rent' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setLedgerSubTab(tab.key)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              ledgerSubTab === tab.key
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 hover:border-emerald-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search box */}
      {hasLedgerData && ledgerEntries.length > 5 && (
        <div className="mb-4">
          <input
            type="text"
            value={ledgerSearch}
            onChange={e => setLedgerSearch(e.target.value)}
            placeholder="Search by type, amount, or date…"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg outline-none focus:border-emerald-400 dark:text-zinc-200"
          />
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 border border-slate-200 dark:border-zinc-700">
          <p className="text-2xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Current Month SC</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatNaira(currentMonthSC)}
          </p>
          {hasServiceCharges && !currentMonthSC ? (
            <span className="inline-flex items-center gap-1 mt-1 text-2xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
              <CheckIcon className="w-3 h-3" /> Paid
            </span>
          ) : currentMonthSC > 0 ? (
            <span className="inline-flex items-center gap-1 mt-1 text-2xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
              <ExclamationTriangleIcon className="w-3 h-3" /> Due
            </span>
          ) : null}
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 border border-slate-200 dark:border-zinc-700">
          <p className="text-2xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Current Month MV</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {currentMonthMV > 0 ? formatNaira(currentMonthMV) : '—'}
          </p>
          {mvStatus === 'paid' ? (
            <span className="inline-flex items-center gap-1 mt-1 text-2xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
              <CheckIcon className="w-3 h-3" /> Paid
            </span>
          ) : mvStatus === 'pending' ? (
            <span className="inline-flex items-center gap-1 mt-1 text-2xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
              <ExclamationTriangleIcon className="w-3 h-3" /> Pending
            </span>
          ) : null}
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-4 border border-slate-200 dark:border-zinc-700">
          <p className="text-2xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Outstanding Balance</p>
          <p className={`text-2xl font-bold ${outstandingBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {outstandingBalance > 0 ? formatNaira(outstandingBalance) : formatNaira(0)}
          </p>
          {outstandingBalance > 0 && (
            <p className="text-2xs text-slate-400 mt-1">
              {ledgerEntries?.filter((e: any) => e.status === 'pending' || e.status === 'defaulted').length || 0} unpaid {ledgerEntries?.filter((e: any) => e.status === 'pending' || e.status === 'defaulted').length === 1 ? 'entry' : 'entries'}
            </p>
          )}
          {outstandingBalance === 0 && hasLedgerData && (
            <span className="inline-flex items-center gap-1 mt-1 text-2xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
              <CheckIcon className="w-3 h-3" /> All Clear
            </span>
          )}
        </div>
      </div>

      {/* Service Charges Section — filtered by selected sub-tab */}
      {hasServiceCharges && (() => {
        const filteredCharges = ledgerSubTab === 'all'
          ? tenantServiceCharges
          : ledgerSubTab === 'service_charge'
          ? tenantServiceCharges.filter((sc: any) => !sc.isMinimumVend)
          : ledgerSubTab === 'electricity'
          ? tenantServiceCharges.filter((sc: any) => sc.isMinimumVend)
          : ledgerSubTab === 'rent'
          ? [] // Rent entries come from ledger_entries, not service_charges
          : []; // internet, waste — filtered from ledger entries below

        if (filteredCharges.length === 0 && ledgerSubTab !== 'all' && ledgerSubTab !== 'rent') return null;

        return (
        <div className="mb-6">
          <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3">
            {ledgerSubTab === 'all' ? 'Service Charges' : ledgerSubTab === 'service_charge' ? 'Service Charges' : ledgerSubTab === 'electricity' ? 'Electricity / Minimum Vend' : 'Charges'}
          </h4>
          <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden">
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
                  {filteredCharges.map((sc: any) => {
                    const isMV = sc.isMinimumVend;
                    const statusLabel = sc.serviceChargeStatus === 'PAID_FULLY'
                      ? 'Paid' : sc.serviceChargeStatus === 'PARTIALLY_PAID'
                      ? 'Partial' : 'Unpaid';
                    return (
                      <tr key={sc._id} className="border-b border-slate-100 dark:border-zinc-700/50 last:border-0">
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-zinc-200">
                          {isMV ? (sc.category === 'Other' ? 'Minimum Vend' : sc.category) : sc.category}
                          {isMV && <span className="ml-1 text-3xs text-emerald-500 font-bold">(MV)</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-zinc-300">{formatNaira(sc.amount)}</td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-zinc-300">
                          {formatNaira(sc.outstandingBalance ?? sc.amount)}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500 dark:text-zinc-400 text-xs">{sc.cycle}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold ${
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
        );
      })()}

      {/* Ledger Table — filtered by sub-tab (rent entries) */}
      {hasLedgerData ? (
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden">
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
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold ${
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
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-lg bg-slate-100 dark:bg-zinc-700 flex items-center justify-center mb-3">
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
