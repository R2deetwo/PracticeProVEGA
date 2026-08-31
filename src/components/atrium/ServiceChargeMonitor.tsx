import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import { ServiceCharge, ServiceChargeCategory } from '../../types';
import { formatLargeNumber } from '../../utils/formatting';
import { useUnitDropdownOptions, usePropertyGroups } from '../../hooks/usePropertyGroups';

// ── Icons ─────────────────────────────────────────────────────────────────
const AlertIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const BanIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
  </svg>
);
const ZapIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const MessageIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
);
const CheckIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const PlusIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const FilterIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────
const CYCLE_MS = { Monthly: 30 * 86400000, Quarterly: 90 * 86400000, Annually: 365 * 86400000 };
const CAT_ICONS: Record<ServiceChargeCategory, string> = {
  Diesel: '', Security: '', Cleaning: '', Water: '', Other: '',
};
const PENALTY_RATE = 0.05; // 5%

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Add Charge Modal ──────────────────────────────────────────────────────
const AddChargeModal: React.FC<{ firmId: string; onClose: () => void }> = ({ firmId, onClose }) => {
  const upsert = useMutation(api.sentry.upsertServiceCharge);
  const { currentUser } = useAuth();
  const { coreState } = useCoreState();
  const [form, setForm] = useState({ unitId: '', category: 'Diesel' as ServiceChargeCategory, amount: '', cycle: 'Annually' as 'Monthly' | 'Quarterly' | 'Annually', notes: '', nextDueDays: '0' });
  const [loading, setLoading] = useState(false);

  const units = useUnitDropdownOptions(coreState.properties || []);
  const { unitById } = usePropertyGroups(coreState.properties || []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unitId || !form.amount) return;
    setLoading(true);
    const nextDueDate = Date.now() + parseInt(form.nextDueDays) * 86400000;
    try {
      await upsert({ firmId, unitId: form.unitId, category: form.category, amount: parseFloat(form.amount), cycle: form.cycle, nextDueDate, notes: form.notes, userEmail: currentUser?.email });
      onClose();
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl my-4 sm:my-0">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="font-bold text-white text-lg">Add Service Charge</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Unit</label>
            <select value={form.unitId} onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500">
              <option value="">Select unit...</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ServiceChargeCategory }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500">
                {(['Diesel', 'Security', 'Cleaning', 'Water', 'Other'] as const).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Cycle</label>
              <select value={form.cycle} onChange={e => setForm(f => ({ ...f, cycle: e.target.value as any }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500">
                <option>Monthly</option><option>Quarterly</option><option>Annually</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Amount (₦)</label>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required min="0" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500" placeholder="0" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Next Due (days)</label>
              <input type="number" value={form.nextDueDays} onChange={e => setForm(f => ({ ...f, nextDueDays: e.target.value }))} min="0" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500" placeholder="0 = today" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Notes</label>
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500" placeholder="Optional note..." />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-500 transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : 'Add Charge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Penalty Confirm Modal ─────────────────────────────────────────────────
const PenaltyModal: React.FC<{ charge: ServiceCharge; firmId: string; onClose: () => void; onToast: (msg: string) => void }> = ({ charge, firmId, onClose, onToast }) => {
  const { currentUser } = useAuth();
  const applyPenalty = useMutation(api.sentry.applyLatePenalty);
  const logAuto = useMutation(api.sentry.logAutomation);
  const penalty = charge.amount * PENALTY_RATE;
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    setLoading(true);
    try {
      await applyPenalty({ firmId, serviceChargeId: charge._id as any, penaltyAmount: penalty, userEmail: currentUser?.email });
      await logAuto({ firmId, userEmail: currentUser?.email, unitId: charge.unitId, tenantId: charge.tenantId, messageType: 'penalty_notice', channel: 'whatsapp', recipient: charge.tenantId || 'unknown', messagePreview: `Late payment penalty of ₦${penalty.toLocaleString()} applied for ${charge.category} charge.`, status: 'simulated', triggeredBy: 'agent' });
      onToast(`₦${penalty.toLocaleString()} penalty applied & logged`);
      onClose();
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-rose-900/50 rounded-2xl w-full max-w-sm shadow-2xl my-4 sm:my-0">
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <ZapIcon className="w-6 h-6 text-rose-400" />
          </div>
          <h3 className="text-white font-bold text-lg mb-2">Apply Late Penalty</h3>
          <p className="text-slate-400 text-sm mb-1">A <span className="text-rose-400 font-bold">5% penalty</span> will be added to the ledger.</p>
          <p className="text-2xl font-black text-rose-400 my-4">₦{penalty.toLocaleString('en-NG')}</p>
          <p className="text-slate-600 text-xs mb-6">Category: {charge.category} · Overdue: {charge.daysOverdue ?? 0} days</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors">Cancel</button>
            <button onClick={handleApply} disabled={loading} className="flex-1 py-2.5 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-500 transition-colors disabled:opacity-50">
              {loading ? 'Applying...' : 'Apply Penalty'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Charge Row ────────────────────────────────────────────────────────────
const ChargeRow: React.FC<{
  charge: ServiceCharge;
  unitLabel: string;
  firmId: string;
  onPenalty: () => void;
  onRestrict: () => void;
  onSendWhatsApp: () => void;
  onMarkPaid: () => void;
  onPartialPayment: () => void;
}> = ({ charge, unitLabel, onPenalty, onRestrict, onSendWhatsApp, onMarkPaid, onPartialPayment }) => {
  const isCritical = (charge.daysOverdue ?? 0) > 14;
  const isPartial = charge.serviceChargeStatus === 'PARTIALLY_PAID';
  const isPaidFully = charge.serviceChargeStatus === 'PAID_FULLY';
  return (
    <div className={`relative flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3.5 border rounded-lg transition-all ${
      isPaidFully ? 'bg-emerald-950/20 border-emerald-800/40' :
      isCritical ? 'bg-rose-950/30 border-rose-800/60 shadow-rose-900/10 shadow-md' :
      isPartial ? 'bg-amber-950/20 border-amber-800/40' :
      charge.isDefaulter ? 'bg-amber-950/20 border-amber-800/40' :
      'bg-slate-900 border-slate-800'
    }`}>
      {isCritical && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-rose-500 rounded-r-full" />}
      
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Category icon */}
        <span className="text-xl flex-shrink-0 w-8 text-center">{charge.isMinimumVend ? '⚡' : CAT_ICONS[charge.category]}</span>
        {/* Unit info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{unitLabel}</p>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <span className={`text-3xs font-bold uppercase px-1.5 py-0.5 rounded-full ${
              isPaidFully ? 'bg-emerald-900/60 text-emerald-300' :
              isPartial ? 'bg-amber-900/60 text-amber-300' :
              isCritical ? 'bg-rose-900/60 text-rose-300' : charge.isDefaulter ? 'bg-amber-900/60 text-amber-300' : 'bg-slate-800 text-slate-500'
            }`}>{charge.isMinimumVend ? 'Min Vend' : charge.category}</span>
            {/* Status badge */}
            {isPaidFully && <span className="text-3xs font-bold text-emerald-400">Paid</span>}
            {isPartial && <span className="text-3xs font-bold text-amber-400">Partial (₦{(charge.outstandingBalance ?? 0).toLocaleString()} owed)</span>}
            <span className="text-2xs text-slate-500">{charge.cycle}</span>
            {charge.isDefaulter && !isPaidFully && <span className="text-2xs text-rose-400 font-bold">{charge.daysOverdue ?? 0}d overdue</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-4 border-t border-slate-800 sm:border-0 pt-3 sm:pt-0">
        {/* Amount + outstanding */}
        <div className="text-left sm:text-right flex-shrink-0 sm:w-28">
          <p className="text-xs font-black text-white">₦{charge.amount.toLocaleString('en-NG')}</p>
          {isPartial && <p className="text-2xs text-amber-400 font-bold">Bal: ₦{(charge.outstandingBalance ?? 0).toLocaleString()}</p>}
          <p className={`text-2xs ${charge.isDefaulter ? 'text-rose-400' : 'text-slate-500'}`}>Due: {formatDate(charge.nextDueDate)}</p>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onSendWhatsApp} aria-label="Send WhatsApp" title="Send WhatsApp" className="p-2.5 sm:p-2 text-slate-500 hover:text-green-400 hover:bg-slate-800 rounded-lg transition-colors">
            <MessageIcon className="w-5 h-5" />
          </button>
          {charge.isDefaulter && !charge.penaltyApplied && (
            <button onClick={onPenalty} aria-label="Apply Late Penalty" title="Apply Late Penalty" className="p-2.5 sm:p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors">
              <ZapIcon className="w-5 h-5" />
            </button>
          )}
          {isCritical && (
            <button onClick={onRestrict} aria-label="Restrict Access" title="Restrict Access" className="p-2.5 sm:p-2 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors">
              <BanIcon className="w-5 h-5" />
            </button>
          )}
          {!isPaidFully && (
            <button onClick={onPartialPayment} aria-label="Record Partial Payment" title="Record Partial Payment" className="p-2.5 sm:p-2 text-slate-500 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            </button>
          )}
          <button onClick={onMarkPaid} aria-label="Mark as Fully Paid" title="Mark as Fully Paid" className="p-2.5 sm:p-2 text-slate-500 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors">
            <CheckIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────
const ServiceChargeMonitor: React.FC = () => {
  const { currentUser } = useAuth();
  const { coreState } = useCoreState();
  const firmId = coreState.firmDetails?.id || currentUser?.firmId || '';

  const allCharges = coreState.serviceCharges || [];
  const markPaidMutation = useMutation(api.sentry.markChargeAsPaid);
  const logAuto = useMutation(api.sentry.logAutomation);
  const { queueMutation, isOnline } = useOfflineQueue();

  const [showAddModal, setShowAddModal] = useState(false);
  const [penaltyCharge, setPenaltyCharge] = useState<ServiceCharge | null>(null);
  const [partialPaymentCharge, setPartialPaymentCharge] = useState<ServiceCharge | null>(null);
  const [partialAmount, setPartialAmount] = useState('');
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState<'all' | 'defaulters' | 'critical' | 'partial'>('all');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const { unitById } = usePropertyGroups(coreState.properties || []);

  const getUnitLabel = (unitId: string): string => {
    // 1. Try the smart label from usePropertyGroups (includes unit name + property address)
    const unitOpt = unitById.get(unitId);
    if (unitOpt) {
      return unitOpt.unitName
        ? `${unitOpt.unitName} · ${unitOpt.shortAddress}`
        : unitOpt.shortAddress;
    }
    // 2. Fallback: try matching by property id directly
    const p = (coreState.properties || []).find(p => p.id === unitId);
    if (p?.address) return p.address;
    // 3. Try matching embedded units by scanning property.units arrays
    for (const prop of (coreState.properties || [])) {
      const embedded: any[] = (prop as any).units || [];
      const match = embedded.find((u: any) => u.id === unitId);
      if (match) {
        const uName = match.unitName || match.name || '';
        const shortAddr = (prop.address || '').split(',')[0] || 'Property';
        return uName ? `${uName} · ${shortAddr}` : shortAddr;
      }
    }
    // 4. Last resort
    return unitId;
  };

  const charges = useMemo(() => {
    if (filter === 'defaulters') return allCharges.filter(c => c.isDefaulter);
    if (filter === 'critical') return allCharges.filter(c => (c.daysOverdue ?? 0) > 14);
    if (filter === 'partial') return allCharges.filter(c => c.serviceChargeStatus === 'PARTIALLY_PAID');
    return allCharges;
  }, [allCharges, filter]);

  const defaulters = allCharges.filter(c => c.isDefaulter);
  const critical = allCharges.filter(c => (c.daysOverdue ?? 0) > 14);
  const partialPayers = allCharges.filter(c => c.serviceChargeStatus === 'PARTIALLY_PAID');
  const revenueAtRisk = defaulters.reduce((s, c) => s + c.amount + (c.penaltyApplied ? c.amount * PENALTY_RATE : 0), 0);

  const handleMarkPaid = async (charge: ServiceCharge) => {
    // IDEMPOTENCY (Phase 3): uuid per payment action — server-side dedup
    // prevents double-crediting on retry or offline replay.
    const idempotencyKey = uuidv4();
    // OFFLINE PATH — service charge collection in the field. Queue the
    // mark-paid mutation and inform the user. If we didn't queue, the
    // charge would show as unpaid forever and the tenant would be
    // penalized again next month despite having paid.
    if (!isOnline) {
      queueMutation({
        mutationName: 'markChargeAsPaid',
        args: {
          serviceChargeId: charge._id as any,
          paidAmount: charge.amount,
          firmId,
          channel: 'Bank Transfer',
          userEmail: currentUser?.email,
          idempotencyKey,
        },
        label: `${charge.category} charge marked paid — ${getUnitLabel(charge.unitId)}`,
      });
      showToast(`${charge.category} charge saved offline. Will sync when you reconnect.`);
      return;
    }
    await markPaidMutation({ serviceChargeId: charge._id as any, paidAmount: charge.amount, firmId, channel: 'Bank Transfer', userEmail: currentUser?.email, idempotencyKey });
    showToast(`${charge.category} charge marked as fully paid`);
  };

  const handlePartialPayment = async () => {
    if (!partialPaymentCharge || !partialAmount) return;
    const amount = parseFloat(partialAmount);
    if (isNaN(amount) || amount <= 0) return;

    // OFFLINE PATH — partial payment recording. Same field-use scenario
    // as full mark-paid. Queue the mutation and inform the user.
    if (!isOnline) {
      queueMutation({
        mutationName: 'markChargeAsPaid',
        args: {
          serviceChargeId: partialPaymentCharge._id as any,
          paidAmount: amount,
          firmId,
          channel: 'Bank Transfer',
          isPartialPayment: true,
          userEmail: currentUser?.email,
          idempotencyKey: uuidv4(),
        },
        label: `Partial payment ₦${amount.toLocaleString()} — ${getUnitLabel(partialPaymentCharge.unitId)}`,
      });
      showToast(`Partial payment of ₦${amount.toLocaleString()} saved offline. Will sync when you reconnect.`);
      setPartialPaymentCharge(null);
      setPartialAmount('');
      return;
    }

    await markPaidMutation({ serviceChargeId: partialPaymentCharge._id as any, paidAmount: amount, firmId, channel: 'Bank Transfer', isPartialPayment: true, userEmail: currentUser?.email, idempotencyKey: uuidv4() });
    showToast(`Partial payment of ₦${amount.toLocaleString()} recorded`);
    setPartialPaymentCharge(null);
    setPartialAmount('');
  };

  const handleRestrict = async (charge: ServiceCharge) => {
    await logAuto({ firmId, userEmail: currentUser?.email, unitId: charge.unitId, messageType: 'access_restriction', channel: 'whatsapp', recipient: charge.tenantId || 'tenant', messagePreview: `Access restriction notice sent for ${getUnitLabel(charge.unitId)} — ${charge.category} overdue ${charge.daysOverdue} days.`, status: 'simulated', triggeredBy: currentUser?.id });
    showToast('Access restriction notice sent via WhatsApp (simulated)');
  };

  const handleWhatsApp = async (charge: ServiceCharge) => {
    const isPartial = charge.serviceChargeStatus === 'PARTIALLY_PAID';
    const outstanding = charge.outstandingBalance ?? 0;
    const msgPreview = isPartial
      ? `Reminder: Your ${charge.category} charge has an outstanding balance of ₦${outstanding.toLocaleString()} (₦${(charge.amountPaidThisCycle ?? 0).toLocaleString()} paid of ₦${charge.amount.toLocaleString()}). Kindly complete payment.`
      : `Reminder: Your ${charge.category} charge of ₦${charge.amount.toLocaleString()} is ${charge.isDefaulter ? `${charge.daysOverdue} days overdue` : 'due soon'}.`;
    await logAuto({ firmId, userEmail: currentUser?.email, unitId: charge.unitId, messageType: 'service_charge_alert', channel: 'whatsapp', recipient: charge.tenantId || 'tenant', messagePreview: msgPreview, status: 'simulated', triggeredBy: currentUser?.id });
    showToast('WhatsApp reminder sent (simulated)');
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-950 text-white sm:overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Service Charge Monitor</h2>
            {critical.length > 0 && <span className="flex items-center gap-1 text-2xs font-bold bg-rose-900/50 text-rose-400 px-2 py-0.5 rounded-full border border-rose-800 animate-pulse"><AlertIcon className="w-3 h-3" />{critical.length} CRITICAL</span>}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">Automated defaulter tracking & enforcement</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition-colors sm:w-auto w-full">
          <PlusIcon /> Add Charge
        </button>
      </div>

      {/* Revenue at Risk Widget */}
      <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 px-4 sm:px-6 py-4">
        <div className="bg-rose-950/40 border border-rose-800/50 rounded-lg p-4">
          <p className="text-xs text-rose-400 uppercase tracking-wider font-bold mb-1">Revenue at Risk</p>
          <p className="text-2xl sm:text-3xl font-black text-rose-300">₦{formatLargeNumber(revenueAtRisk)}</p>
          <p className="text-2xs text-rose-700 mt-1">{defaulters.length} defaulting units</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Critical Defaults</p>
          <p className="text-2xl sm:text-3xl font-black text-rose-400">{critical.length}</p>
          <p className="text-2xs text-slate-600 mt-1">&gt;14 days overdue</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Active Charges</p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400">{(allCharges || []).filter(c => !c.isDefaulter).length}</p>
          <p className="text-2xs text-slate-600 mt-1">on-time payments</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex-shrink-0 px-6 pb-3 flex items-center gap-2 overflow-x-auto no-scrollbar flex-nowrap">
        <FilterIcon className="w-4 h-4 text-slate-600 flex-shrink-0" />
        {(['all', 'defaulters', 'critical', 'partial'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${filter === f ? (f === 'critical' ? 'bg-rose-600 text-white' : f === 'partial' ? 'bg-amber-600 text-white' : 'bg-slate-700 text-white') : 'text-slate-500 hover:text-slate-300'}`}>
            {f === 'all' ? `All (${(allCharges || []).length})` : f === 'defaulters' ? `Defaulters (${defaulters.length})` : f === 'partial' ? `Partial (${partialPayers.length})` : `Critical (${critical.length})`}
          </button>
        ))}
      </div>

      {/* Charges List */}
      <div className="flex-1 sm:overflow-y-auto px-4 sm:px-6 pb-44 sm:pb-6 space-y-2 custom-scrollbar scroll-smooth-ios">
        {!allCharges ? (
          [...Array(6)].map((_, i) => <div key={i} className="h-16 bg-slate-900 rounded-lg animate-pulse" />)
        ) : charges.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-600">
            <CheckIcon className="w-8 h-8 mb-2 text-emerald-600" />
            <p className="text-sm">{filter === 'all' ? 'No service charges configured' : 'No charges in this category'}</p>
          </div>
        ) : (
          charges.map(charge => (
            <ChargeRow
              key={charge._id}
              charge={charge}
              unitLabel={getUnitLabel(charge.unitId)}
              firmId={firmId}
              onPenalty={() => setPenaltyCharge(charge)}
              onRestrict={() => handleRestrict(charge)}
              onSendWhatsApp={() => handleWhatsApp(charge)}
              onMarkPaid={() => handleMarkPaid(charge)}
              onPartialPayment={() => { setPartialPaymentCharge(charge); setPartialAmount(''); }}
            />
          ))
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 text-white text-sm px-5 py-3 rounded-2xl shadow-xl z-50 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4">
          <CheckIcon className="w-4 h-4 text-emerald-400" /> {toast}
        </div>
      )}

      {showAddModal && <AddChargeModal firmId={firmId} onClose={() => setShowAddModal(false)} />}
      {penaltyCharge && <PenaltyModal charge={penaltyCharge} firmId={firmId} onClose={() => setPenaltyCharge(null)} onToast={showToast} />}
      
      {/* Partial Payment Modal */}
      {partialPaymentCharge && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPartialPaymentCharge(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-1">Record Partial Payment</h3>
            <p className="text-sm text-slate-400 mb-4">
              {partialPaymentCharge.isMinimumVend ? 'Minimum Vend' : partialPaymentCharge.category} — Total: ₦{partialPaymentCharge.amount.toLocaleString()}
              {partialPaymentCharge.serviceChargeStatus === 'PARTIALLY_PAID' && (
                <> (₦{(partialPaymentCharge.amountPaidThisCycle ?? 0).toLocaleString()} already paid)</>
              )}
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Payment Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">₦</span>
                  <input
                    type="text"
                    value={partialAmount}
                    onChange={e => setPartialAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 pl-8 text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                    placeholder="Enter amount received"
                    autoFocus
                  />
                </div>
                {partialPaymentCharge.serviceChargeStatus === 'PARTIALLY_PAID' && (
                  <p className="text-2xs text-amber-400 mt-1">
                    Outstanding: ₦{(partialPaymentCharge.outstandingBalance ?? 0).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setPartialPaymentCharge(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePartialPayment}
                  disabled={!partialAmount || parseFloat(partialAmount) <= 0}
                  className="flex-1 px-4 py-2.5 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Record Payment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceChargeMonitor;
