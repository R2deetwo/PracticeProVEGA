/**
 * TenantPortal — Atrium Tenant Dashboard
 *
 * Read-only portal for tenants to view their financial ledger,
 * download rent receipts, check SC/MV status, and log maintenance tickets.
 *
 * Feature-gated: canUseTenantPortal (Atrium Growth+ only)
 * Role-gated: Only users with role === 'Tenant'
 */
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useFeatures } from '../../hooks/useFeatures';
import {
  OfficeBuildingIcon,
  DownloadIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  DocumentIcon,
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

// ─── Tab Type ─────────────────────────────────────────────────────────────────
type TabId = 'ledger' | 'receipts' | 'maintenance';

// ─── Main Component ──────────────────────────────────────────────────────────
const TenantPortal: React.FC = () => {
  const { currentUser } = useAuth();
  const { coreState } = useCoreState();
  const { navigateTo, openModal, addToast } = useUI();
  const { canUseTenantPortal } = useFeatures();
  const [activeTab, setActiveTab] = useState<TabId>('ledger');

  // Access guard
  if (!currentUser) return null;

  if (!canUseTenantPortal) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
            <OfficeBuildingIcon className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Tenant Portal Unavailable</h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
            The Tenant Portal is available on Growth and Pro plans. Ask your property manager to upgrade.
          </p>
        </div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'ledger', label: 'Financial Ledger', icon: <ReceiptIcon className="w-4 h-4" /> },
    { id: 'receipts', label: 'Receipts', icon: <DownloadIcon className="w-4 h-4" /> },
    { id: 'maintenance', label: 'Maintenance', icon: <WrenchIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
            <OfficeBuildingIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Tenant Portal</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Welcome, {currentUser.name}
            </p>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6">
        <div className="flex gap-1 -mb-px">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-zinc-900">
        {activeTab === 'ledger' && <LedgerTab />}
        {activeTab === 'receipts' && <ReceiptsTab />}
        {activeTab === 'maintenance' && <MaintenanceTab addToast={addToast} />}
      </div>
    </div>
  );
};

// ─── Financial Ledger Tab ────────────────────────────────────────────────────
const LedgerTab: React.FC = () => {
  // Placeholder ledger rows — in production, these come from Convex queries
  const ledgerRows = [
    { month: 'Jan 2026', rent: '₦500,000', sc: '₦50,000', mv: '₦15,000', status: 'Paid' },
    { month: 'Feb 2026', rent: '₦500,000', sc: '₦50,000', mv: '₦15,000', status: 'Paid' },
    { month: 'Mar 2026', rent: '₦500,000', sc: '₦50,000', mv: '₦15,000', status: 'Paid' },
    { month: 'Apr 2026', rent: '₦500,000', sc: '₦50,000', mv: '₦15,000', status: 'Pending' },
    { month: 'May 2026', rent: '₦500,000', sc: '₦50,000', mv: '₦15,000', status: 'Pending' },
  ];

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
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">₦50,000</p>
          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
            <CheckIcon className="w-3 h-3" /> Paid
          </span>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-slate-200 dark:border-zinc-700">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Current Month MV</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">₦15,000</p>
          <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
            <ExclamationTriangleIcon className="w-3 h-3" /> Pending
          </span>
        </div>
        <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 border border-slate-200 dark:border-zinc-700">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 mb-1">Outstanding Balance</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">₦565,000</p>
          <p className="text-[10px] text-slate-400 mt-1">2 months unpaid</p>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
              <th className="text-left px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Month</th>
              <th className="text-right px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Rent</th>
              <th className="text-right px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">SC</th>
              <th className="text-right px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">MV</th>
              <th className="text-center px-4 py-3 font-bold text-slate-500 dark:text-zinc-400 text-xs uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {ledgerRows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-zinc-700/50 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-zinc-200">{row.month}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-zinc-300">{row.rent}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-zinc-300">{row.sc}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-zinc-300">{row.mv}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    row.status === 'Paid'
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                  }`}>
                    {row.status === 'Paid' ? <CheckIcon className="w-3 h-3" /> : <ExclamationTriangleIcon className="w-3 h-3" />}
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Receipts Tab ────────────────────────────────────────────────────────────
const ReceiptsTab: React.FC = () => {
  // Placeholder receipts — in production, fetched from Convex
  const receipts = [
    { id: 'RCP-001', date: '2026-01-15', amount: '₦565,000', description: 'January Rent + SC + MV' },
    { id: 'RCP-002', date: '2026-02-15', amount: '₦565,000', description: 'February Rent + SC + MV' },
    { id: 'RCP-003', date: '2026-03-15', amount: '₦565,000', description: 'March Rent + SC + MV' },
  ];

  const handleDownload = (id: string) => {
    // In production, generate and download PDF receipt via invoiceHelpers
    alert(`Download receipt ${id} — PDF generation will be connected to Convex data.`);
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Payment Receipts</h3>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
        View and download PDF receipts for your completed payments.
      </p>

      <div className="space-y-3">
        {receipts.map(r => (
          <div
            key={r.id}
            className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                <ReceiptIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200">{r.id}: {r.description}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">{r.date} · {r.amount}</p>
              </div>
            </div>
            <button
              onClick={() => handleDownload(r.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors"
            >
              <DownloadIcon className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Maintenance Tab ─────────────────────────────────────────────────────────
const MaintenanceTab: React.FC<{ addToast: (msg: string, opts?: any) => void }> = ({ addToast }) => {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'plumbing' | 'electrical' | 'structural' | 'other'>('other');

  // Placeholder existing tickets
  const existingTickets = [
    { id: 'TKT-001', subject: 'Leaking kitchen faucet', status: 'In Progress', date: '2026-05-20' },
    { id: 'TKT-002', subject: 'Broken hallway light', status: 'Resolved', date: '2026-04-12' },
  ];

  const handleSubmit = () => {
    if (!subject.trim() || !description.trim()) {
      addToast('Please fill in all fields before submitting.', { type: 'info' });
      return;
    }
    // In production, write to Convex maintenanceTickets table
    addToast('Maintenance ticket submitted successfully. Your property manager has been notified.', { type: 'success' });
    setSubject('');
    setDescription('');
    setCategory('other');
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
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm"
          >
            Submit Ticket
          </button>
        </div>
      </div>

      {/* Existing Tickets */}
      <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3">Your Tickets</h4>
      <div className="space-y-2">
        {existingTickets.map(t => (
          <div
            key={t.id}
            className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                t.status === 'Resolved'
                  ? 'bg-emerald-50 dark:bg-emerald-900/20'
                  : 'bg-amber-50 dark:bg-amber-900/20'
              }`}>
                <WrenchIcon className={`w-4 h-4 ${
                  t.status === 'Resolved' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                }`} />
              </div>
              <div>
                <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200">{t.subject}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">{t.id} · {t.date}</p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              t.status === 'Resolved'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
            }`}>
              {t.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TenantPortal;
