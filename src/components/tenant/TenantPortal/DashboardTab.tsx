/**
 * TenantPortal Dashboard tab — card-based overview: identity hero, outstanding balance, wallet, quick services, recent notices.
 *
 * Extracted from TenantPortal.tsx (P5 monolith split, 2026-09-14).
 * Body is verbatim from the original file — zero behavioral change.
 */
import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useUI } from '../../../contexts/UIContext';
import NairaSymbol from '../../NairaSymbol';
import { formatNaira as formatNairaShared } from '../../../utils/formatting';
import { DownloadIcon, DocumentIcon, BellIcon } from '../../../constants';
import { Receipt as ReceiptIcon, Wifi as WifiIcon, PlugZap as BoltIcon } from 'lucide-react';
import { type TabId, WrenchIcon, TrashIcon, ChatIcon, UploadIcon, formatNaira } from './shared';

// ─── Shared Tenant Info Hook Helper ──────────────────────────────────────────
// All sub-tabs receive tenantInfo from the parent to avoid duplicate queries

// ─── Dashboard Tab (card-based overview, emulates reference design) ──────────
// Professional card layout: hero card (identity + property) → outstanding
// balance card → quick services grid (pay rent, service charge, electricity,
// internet, maintenance, messages) → recent notices preview.
//
// "Services" here are NOT just requests — they're actionable tiles for
// anything the resident can DO: pay rent, pay service charge, buy electricity,
// pay internet, report maintenance, send a message.
export const DashboardTab: React.FC<{
  tenantInfo: any; onNavigate: (tab: TabId) => void;
  userId?: string; effectiveFirmId?: string; email?: string;
}> = ({ tenantInfo, onNavigate, userId, effectiveFirmId, email }) => {
  const { currentUser, bearerToken } = useAuth();
  const { addToast } = useUI();

  // ── Resident Wallet (prepaid balance for auto-deducting charges) ──
  // Moved from the orchestrator during the P5 split: this tab is the sole
  // consumer, so the query + funding UI state live here now. (The Paystack
  // redirect VERIFY effect stays in index.tsx via useWalletFundingVerify —
  // it must run on portal mount regardless of active tab.)
  const walletData = useQuery(api.wallets.getMyWallet, userId ? { tenantId: userId, userEmail: email || undefined } : 'skip');
  const toggleAutoDeduct = useMutation(api.wallets.toggleAutoDeduct);
  const initiateWalletFunding = useAction(api.wallets.initiateWalletFunding);
  const [walletFundAmount, setWalletFundAmount] = useState('');
  const [isFunding, setIsFunding] = useState(false);
  // Uses the canonical formatNaira from utils/formatting.ts.
  const formatNaira = (n: number) => formatNairaShared(n, { withSymbol: true });

  // Derive outstanding balance from tenantInfo (if available)
  const outstandingBalance = tenantInfo?.outstandingBalance || 0;
  const hasOutstanding = outstandingBalance > 0;

  // ── Rent info (only shown when rent collection is enabled) ──
  const isRentCollection = tenantInfo?.primaryRentCollectionMode !== 'Management Only (No Rent)';
  const rentAmount = tenantInfo?.units?.[0]?.rentAmount || tenantInfo?.primaryRentAmount || 0;
  const rentFrequency = tenantInfo?.units?.[0]?.rentFrequency || 'Monthly';
  const leaseStart = tenantInfo?.units?.[0]?.leaseStart;
  const leaseEnd = tenantInfo?.units?.[0]?.leaseEnd;

  // Compute next rent due date from lease start + frequency
  const nextRentDue = useMemo(() => {
    if (!leaseStart || !isRentCollection) return null;
    const start = new Date(leaseStart).getTime();
    if (isNaN(start)) return null;
    const intervalMs = rentFrequency === 'Annually' ? 365 * 86400000
                     : rentFrequency === 'Quarterly' ? 90 * 86400000
                     : rentFrequency === 'Bi-Annually' ? 182 * 86400000
                     : 30 * 86400000;
    const now = Date.now();
    let next = start;
    for (let i = 0; i < 240 && next < now; i++) next += intervalMs;
    return next >= now ? next : null;
  }, [leaseStart, rentFrequency, isRentCollection]);

  // ─── CORE SERVICES (Configurable-by-Default) ──────────────────────
  // Per-property service toggles fetched from the backend. When a service
  // is 'inactive', the icon is grayed out with a tooltip:
  //   "This service is not applicable for your property."
  // This replaces the old static "Management-Only" message with a
  // data-driven, manager-configurable service architecture.
  const isManagementOnly = tenantInfo?.primaryRentCollectionMode === 'Management Only (No Rent)';
  const coreServices = tenantInfo?.primaryCoreServices || {
    serviceCharge: true,
    electricity: true,
    internet: true,
    wasteManagement: true,
  };
  const customFees: any[] = tenantInfo?.primaryCustomFees || [];

  // Quick services — actionable tiles. Each core service has an Active/Inactive
  // toggle controlled by the property manager via the Edit Property modal.
  // Inactive services are grayed out but VISIBLE (so residents know they exist).
  const services: { icon: React.ReactNode; label: string; tab: TabId; color: string; disabled?: boolean; tooltip?: string }[] = [
    // Pay Rent — hidden only when Management-Only (no rent collection at all)
    ...(isManagementOnly ? [] : [
      { icon: <NairaSymbol className="w-5 h-5 inline" />, label: 'Pay Rent', tab: 'payments' as TabId, color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
    ]),
    // Core services — each gated by its own Active/Inactive toggle
    { icon: <ReceiptIcon className="w-5 h-5" />, label: 'Service Charge', tab: 'ledger' as TabId, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400', disabled: false, tooltip: undefined },
    { icon: <BoltIcon className="w-5 h-5" />, label: 'Electricity', tab: 'ledger' as TabId, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400', disabled: !coreServices.electricity, tooltip: !coreServices.electricity ? 'This service is not applicable for your property.' : undefined },
    { icon: <WifiIcon className="w-5 h-5" />, label: 'Internet', tab: 'ledger' as TabId, color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400', disabled: !coreServices.internet, tooltip: !coreServices.internet ? 'This service is not applicable for your property.' : undefined },
    // Waste Management — new core service
    { icon: <TrashIcon className="w-5 h-5" />, label: 'Waste Mgmt', tab: 'ledger' as TabId, color: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400', disabled: !coreServices.wasteManagement, tooltip: !coreServices.wasteManagement ? 'This service is not applicable for your property.' : undefined },
    { icon: <WrenchIcon className="w-5 h-5" />, label: 'Maintenance', tab: 'maintenance' as TabId, color: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' },
    { icon: <ChatIcon className="w-5 h-5" />, label: 'Messages', tab: 'messages' as TabId, color: 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400' },
    { icon: <DownloadIcon className="w-5 h-5" />, label: 'Receipts', tab: 'receipts' as TabId, color: 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400' },
    { icon: <DocumentIcon className="w-5 h-5" />, label: 'Documents', tab: 'documents' as TabId, color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' },
  ];

  return (
    <div className="space-y-4 pb-8">
      {/* ─── Hero Card — slim, compact design ─────────────────────────── */}
      <div className="bg-brand-primary text-white rounded-premium p-3.5 shadow-premium">
        <div className="flex items-center justify-between mb-2">
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-bold text-white/70 uppercase tracking-widest mb-0.5">
              Residents' Portal
            </p>
            <h2 className="text-xl font-bold tracking-tight leading-tight">
              {tenantInfo?.tenantName || currentUser?.name?.split(' ')[0] || 'Resident'}
            </h2>
          </div>
        </div>
        {/* Unit + Address — compact, single block */}
        <div className="space-y-1 mb-2">
          {/* LINE 1: Unit only */}
          {tenantInfo?.primaryUnitName && (
            <div className="flex items-center gap-1.5">
              <svg className="w-3 h-3 text-white/70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9-4 9 4M3 7v10l9 4 9-4V7M3 7l9 4 9-4M12 11v10" />
              </svg>
              <p className="text-xs text-white/90 font-medium truncate">
                {tenantInfo.primaryUnitName}
              </p>
            </div>
          )}
          {/* LINE 2: Address only */}
          {tenantInfo?.primaryPropertyAddress && (
            <div className="flex items-center gap-1.5">
              <svg className="w-3 h-3 text-white/70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-xs text-white/80 truncate">
                {tenantInfo.primaryPropertyAddress}
              </p>
            </div>
          )}
        </div>
        {/* Outstanding Balance — compact */}
        <button
          onClick={() => onNavigate('ledger')}
          className="w-full text-left bg-white/10 hover:bg-white/15 rounded-lg p-2 active:scale-[0.98] transition-all border border-white/10"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xs font-bold text-white/70 uppercase tracking-widest">
                Outstanding Balance
              </p>
              <p className={`text-base font-black mt-0.5 ${hasOutstanding ? 'text-amber-200' : 'text-white'}`}>
                {formatNaira(outstandingBalance)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-white/90 font-semibold">
                {hasOutstanding ? 'View Breakdown' : 'All Caught Up'}
              </p>
              <ReceiptIcon className="w-3.5 h-3.5 text-white/70 ml-auto mt-0.5" />
            </div>
          </div>
        </button>

        {/* ─── Prepaid Wallet Card — compact ──────────────────────────── */}
        <div className="bg-gradient-to-br from-emerald-600/15 to-emerald-900/15 border border-emerald-500/20 rounded-lg p-2.5 mt-1.5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-2xs font-bold text-emerald-300/85 uppercase tracking-widest">Wallet Balance</p>
              <p className="text-lg font-black mt-0.5 text-white">{walletData?.wallet ? formatNaira(walletData.wallet.balance) : '₦0'}</p>
            </div>
            {walletData?.wallet && (
              <button
                onClick={() => toggleAutoDeduct?.({ tenantId: userId || '', enabled: !walletData.wallet.autoDeductEnabled, userEmail: email || undefined })}
                className={`text-2xs font-bold px-2.5 py-1 rounded-full transition-colors ${
                  walletData.wallet.autoDeductEnabled
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-white/10 text-white/60 border border-white/10'
                }`}
              >
                {walletData.wallet.autoDeductEnabled ? 'Auto-Deduct: ON' : 'Auto-Deduct: OFF'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50 text-xs">₦</span>
              <input
                type="number" min={100} step={100}
                value={walletFundAmount || ''}
                onChange={e => setWalletFundAmount?.(e.target.value)}
                placeholder="Amount"
                className="w-full pl-6 pr-2 py-1.5 bg-white/10 border border-white/15 text-white text-xs rounded-lg outline-none focus:border-emerald-400 placeholder:text-white/40"
              />
            </div>
            <button
              onClick={async () => {
                // FIX: the Fund button used to just navigate to the Payments
                // tab — the wallet could never actually be funded online
                // (initiateWalletFunding was threaded in but never called,
                // and the funding redirect reference was discarded). Now we
                // attempt a real Paystack funding session and redirect to
                // the authorization URL; if card payments aren't configured
                // for this firm we fall back to bank transfer + proof with
                // an honest explanation.
                const amount = parseFloat((walletFundAmount || '').replace(/[^0-9.]/g, ''));
                if (!amount || amount <= 0) return;
                if (setIsFunding) setIsFunding(true);
                try {
                  const propertyId = tenantInfo?.units?.[0]?.propertyId || tenantInfo?.propertyId || '';
                  const init = await initiateWalletFunding?.({
                    tenantId: userId || '',
                    firmId: effectiveFirmId || '',
                    propertyId,
                    amount,
                    email: email || '',
                  });
                  if (init?.authorizationUrl) {
                    addToast('Redirecting to the secure payment page…', { type: 'info' });
                    window.location.href = init.authorizationUrl;
                    return;
                  }
                  throw new Error('No payment URL returned.');
                } catch (e: any) {
                  addToast(
                    (e?.message || 'Online funding unavailable.') +
                    ' You can still fund by bank transfer from the Payments tab — your property manager will credit the wallet on confirmation.',
                    { type: 'warning' }
                  );
                  onNavigate('payments');
                } finally {
                  if (setIsFunding) setIsFunding(false);
                }
              }}
              disabled={isFunding || !walletFundAmount}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
            >
              {isFunding ? '…' : 'Fund'}
            </button>
          </div>
          <div className="flex gap-1.5 mt-1.5">
            {['5000', '10000', '20000'].map(amt => (
              <button key={amt} onClick={() => setWalletFundAmount?.(amt)}
                className="flex-1 text-2xs text-emerald-300/70 hover:text-emerald-300 py-0.5 border border-white/10 rounded hover:bg-white/5 transition-colors">
                ₦{parseInt(amt).toLocaleString('en-NG')}
              </button>
            ))}
          </div>
          {walletData?.wallet?.autoDeductEnabled && (
            <p className="text-2xs text-emerald-300/60 mt-2 leading-relaxed">
              ✓ Your monthly charges will be automatically deducted from this wallet when due. No manual transfer needed.
            </p>
          )}
          {walletData?.wallet && !walletData.wallet.autoDeductEnabled && (
            <p className="text-2xs text-white/40 mt-2 leading-relaxed">
              Enable auto-deduct to have your monthly charges automatically paid from your wallet.
            </p>
          )}

          {/* Wallet Transaction History (last 5) — tap-through inline */}
          {walletData?.recentTransactions && walletData.recentTransactions.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <p className="text-2xs font-bold text-white/50 uppercase tracking-widest mb-1.5">Recent Activity</p>
              <div className="space-y-1">
                {walletData.recentTransactions.slice(0, 3).map((tx: any) => (
                  <div key={tx._id} className="flex items-center justify-between text-2xs">
                    <span className="text-white/60 truncate flex-1">{tx.reason}</span>
                    <span className={tx.type === 'credit' ? 'text-emerald-300 font-bold ml-2' : 'text-white/80 font-bold ml-2'}>
                      {tx.type === 'credit' ? '+' : '−'}{formatNaira(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Rent Due + Lease Summary (only when rent collection is enabled) ─── */}
      {isRentCollection && rentAmount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {/* Next Rent Due Card */}
          {nextRentDue && (
            <button
              onClick={() => onNavigate('payments')}
              className="text-left bg-white dark:bg-zinc-800 rounded-lg p-3 border border-slate-200 dark:border-zinc-700 active:scale-[0.98] transition-transform"
            >
              <p className="text-2xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Next Rent Due</p>
              <p className="text-lg font-black text-slate-900 dark:text-white">{formatNaira(rentAmount)}</p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {new Date(nextRentDue).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                <span className="ml-1 text-slate-400">({rentFrequency})</span>
              </p>
            </button>
          )}
          {/* Lease Summary Card */}
          {leaseStart && leaseEnd && (
            <button
              onClick={() => onNavigate('documents')}
              className="text-left bg-white dark:bg-zinc-800 rounded-lg p-3 border border-slate-200 dark:border-zinc-700 active:scale-[0.98] transition-transform"
            >
              <p className="text-2xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Lease Period</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {new Date(leaseStart).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                {' → '}
                {new Date(leaseEnd).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {rentAmount > 0 ? `${formatNaira(rentAmount)} / ${rentFrequency.toLowerCase()}` : ''}
              </p>
            </button>
          )}
        </div>
      )}

      {/* ─── Quick Action Buttons ─────────────────────────────────────────── */}
      <div className="flex gap-2 mt-3">
        {isRentCollection && (
          <button
            onClick={() => onNavigate('payments')}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <NairaSymbol className="w-4 h-4" /> Pay Rent
          </button>
        )}
        <button
          onClick={() => onNavigate('maintenance')}
          className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          <WrenchIcon className="w-4 h-4" /> Report Issue
        </button>
        <button
          onClick={() => onNavigate('payments')}
          className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          <UploadIcon className="w-4 h-4" /> Upload Proof
        </button>
      </div>

      {/* ─── Quick Services Grid ────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-2.5">Quick Services</h3>
        <div className="grid grid-cols-4 gap-2.5">
          {services.map(service => (
            <button
              key={service.label}
              onClick={() => !service.disabled && onNavigate(service.tab)}
              disabled={service.disabled}
              title={service.tooltip}
              className={`flex flex-col items-center gap-1.5 p-2.5 rounded-2xl shadow-soft transition-transform ${
                service.disabled
                  ? 'bg-slate-50 dark:bg-zinc-800/50 opacity-50 cursor-not-allowed'
                  : 'bg-white dark:bg-zinc-800 active:scale-95'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${service.color} ${service.disabled ? 'grayscale' : ''}`}>
                {service.icon}
              </div>
              <span className={`text-2xs font-semibold text-center leading-tight ${
                service.disabled
                  ? 'text-slate-400 dark:text-zinc-500'
                  : 'text-slate-700 dark:text-zinc-300'
              }`}>
                {service.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Recent Notices Preview ─────────────────────────────────── */}
      <button
        onClick={() => onNavigate('notices')}
        className="w-full text-left bg-white dark:bg-zinc-800 rounded-2xl p-4 shadow-soft active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BellIcon className="w-4 h-4 text-amber-500" />
            Notices
          </h3>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">View All →</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-zinc-300 font-medium">
          Tap to see notices from your property manager
        </p>
      </button>
    </div>
  );
};

// ─── Notice Board Tab ────────────────────────────────────────────────────────
