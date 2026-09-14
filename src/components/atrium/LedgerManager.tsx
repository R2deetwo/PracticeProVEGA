import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import { useUI } from '../../contexts/UIContext';
import { LedgerEntry, LedgerEntryStatus, LedgerEntryType } from '../../types';
import { formatNaira, formatLargeNumber, formatNairaWhole } from '../../utils/formatting';
import { isActiveFinancialRecord, makeLedgerIdempotencyKey } from '../../utils/financialLifecycle';
import { Home, Zap, Lock, AlertTriangle, CheckCircle2, Clock, XCircle, Sparkles, MoreVertical, ShieldCheck, Eye, EyeOff, Undo2, FlaskConical, Ban, FileSearch } from 'lucide-react';
import { useUnitDropdownOptions, usePropertyGroups } from '../../hooks/usePropertyGroups';
// ── Icons ─────────────────────────────────────────────────────────────────
const HashIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/>
    <line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>
  </svg>
);
const ReceiptIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
  </svg>
);
const TrendUpIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
);
const FilterIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
);
const PlusIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<LedgerEntryType, string> = {
  rent: 'Rent', service_charge: 'Service Charge', penalty: 'Penalty', deposit: 'Deposit',
};
const STATUS_STYLES: Record<LedgerEntryStatus, string> = {
  cleared: 'bg-emerald-900/40 text-emerald-400 border-emerald-800',
  pending: 'bg-amber-900/40 text-amber-400 border-amber-800',
  defaulted: 'bg-rose-900/40 text-rose-400 border-rose-800',
};
const TYPE_COLORS: Record<LedgerEntryType, string> = {
  rent: 'text-emerald-400', service_charge: 'text-sky-400', penalty: 'text-rose-400', deposit: 'text-violet-400',
};

function formatTs(ts: number) {
  return new Date(ts).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── Add Entry Modal ───────────────────────────────────────────────────────
const AddEntryModal: React.FC<{ firmId: string; onClose: () => void }> = ({ firmId, onClose }) => {
  const { currentUser, bearerToken } = useAuth();
  const addEntry = useMutation(api.sentry.addLedgerEntry);
  const { coreState } = useCoreState();
  const { addToast } = useUI();
  const { queueMutation, isOnline } = useOfflineQueue();
  const [form, setForm] = useState({ unitId: '', amount: '', type: 'rent' as LedgerEntryType, status: 'cleared' as LedgerEntryStatus, channel: 'Bank Transfer', description: '', paymentRef: '' });
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const units = useUnitDropdownOptions(coreState.properties || []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unitId || !form.amount) return;
    setLoading(true);
    try {
      // IDEMPOTENCY (accounting-integrity round): one key per SUBMIT, shared
      // by the online call and the offline queue replay, so a flaky
      // connection can never book the same payment twice.
      const idempotencyKey = makeLedgerIdempotencyKey({
        firmId,
        unitId: form.unitId,
        amount: parseFloat(form.amount),
        type: form.type,
        nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      // OFFLINE PATH — manual ledger entries are typically done by an
      // agent or accountant who may be in the field. Queue when offline.
      if (!isOnline) {
        queueMutation({
          mutationName: 'addLedgerEntry',
          args: {
            firmId,
            unitId: form.unitId,
            amount: parseFloat(form.amount),
            type: form.type,
            status: form.status,
            channel: form.channel,
            description: form.description,
            paymentRef: form.paymentRef,
            idempotencyKey,
            userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined),
          },
          label: `${form.type} ledger entry — ${formatNairaWhole(form.amount)}`,
        });
        addToast('Ledger entry saved offline. Will sync when you reconnect.', { type: 'info', duration: 6000 });
        onClose();
        return;
      }
      await addEntry({ firmId, unitId: form.unitId, amount: parseFloat(form.amount), type: form.type, status: form.status, channel: form.channel, description: form.description, paymentRef: form.paymentRef, idempotencyKey, userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) });
      onClose();
    } finally { setLoading(false); }
  };

  const TYPE_OPTIONS: { value: LedgerEntryType; label: string; icon: React.ReactNode }[] = [
    { value: 'rent', label: 'Rent', icon: <Home className="w-5 h-5" /> },
    { value: 'service_charge', label: 'Service Charge', icon: <Zap className="w-5 h-5" /> },
    { value: 'deposit', label: 'Deposit', icon: <Lock className="w-5 h-5" /> },
    { value: 'penalty', label: 'Penalty', icon: <AlertTriangle className="w-5 h-5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-white text-lg">Record a Payment</h3>
            <p className="text-xs text-slate-500 mt-0.5">This goes into the Atrium ledger — separate from formal invoices</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Property */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-semibold">Which property?</label>
            <select value={form.unitId} onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="">Select a property...</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </div>

          {/* Type pills */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-semibold">What type of payment?</label>
            <div className="grid grid-cols-4 gap-2">
              {TYPE_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => setForm(f => ({ ...f, type: opt.value }))}
                  className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-2xs font-bold transition-all ${
                    form.type === opt.value
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}>
                  <span className="flex items-center justify-center mb-0.5">{opt.icon}</span>{opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-semibold">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₦</span>
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required min="0" className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500" placeholder="0.00" />
            </div>
          </div>

          {/* Did they pay? */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-semibold">Did they pay?</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['cleared', 'Yes, paid', 'border-emerald-600 bg-emerald-900/30 text-emerald-300', <CheckCircle2 className="w-3.5 h-3.5" />], 
                ['pending', 'Pending', 'border-amber-600 bg-amber-900/30 text-amber-300', <Clock className="w-3.5 h-3.5" />], 
                ['defaulted', 'Defaulted', 'border-rose-600 bg-rose-900/30 text-rose-300', <XCircle className="w-3.5 h-3.5" />]
              ] as const).map(([val, label, activeClass, icon]) => (
                <button key={val as string} type="button" onClick={() => setForm(f => ({ ...f, status: val as LedgerEntryStatus }))}
                  className={`py-2 px-2 rounded-lg border text-2xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    form.status === val ? activeClass : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                  }`}>{icon} {label as string}</button>
              ))}
            </div>
          </div>

          {/* Advanced toggle */}
          <button type="button" onClick={() => setShowAdvanced(v => !v)} className="text-2xs text-slate-500 hover:text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1">
            {showAdvanced ? '▾' : '▸'} Advanced options
          </button>
          {showAdvanced && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Payment Channel</label>
                <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500">
                  {['Bank Transfer', 'Cash', 'POS', 'Mobile Transfer', 'Cheque'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Payment Reference</label>
                <input value={form.paymentRef} onChange={e => setForm(f => ({ ...f, paymentRef: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500" placeholder="e.g. TXN-2025-0412" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Notes</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500" placeholder="Optional note..." />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-500 transition-colors disabled:opacity-50">
              {loading ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Lifecycle Action Modal (void / test / reinstate) ─────────────────────
type LifecycleAction = 'void' | 'test' | 'reinstate' | 'unmark';

const LIFECYCLE_COPY: Record<LifecycleAction, { title: string; body: string; confirm: string; tone: string; placeholder: string }> = {
  void: {
    title: 'Void this ledger entry?',
    body: 'Voiding is a reversal ANNOTATION, not a deletion: the record stays in the books for the audit trail, but drops out of every total (income, risk, tenant outstanding). This is the accounting-correct way to retire a booked entry that was recorded in error.',
    confirm: 'Void Entry',
    tone: 'bg-rose-600 hover:bg-rose-500',
    placeholder: 'e.g. Duplicate of TX-… booked twice by a flaky connection',
  },
  test: {
    title: 'Mark this entry as test data?',
    body: 'Test-quarantined records stay visible for forensic completeness but are excluded from every revenue and risk figure. Use this for payments recorded while testing the app — the "records I don\'t remember" problem.',
    confirm: 'Mark as Test',
    tone: 'bg-violet-600 hover:bg-violet-500',
    placeholder: 'e.g. Recorded while testing the payment flow on my own account',
  },
  reinstate: {
    title: 'Reinstate this voided entry?',
    body: 'Restores the entry to the books with its original status. Both the void and this reinstatement remain in the audit trail — the history shows both directions, which is exactly what an auditor wants to see.',
    confirm: 'Reinstate Entry',
    tone: 'bg-emerald-600 hover:bg-emerald-500',
    placeholder: 'e.g. Voided in error — payment verified against bank statement',
  },
  unmark: {
    title: 'Return this test entry to the books?',
    body: 'Removes the test-data quarantine: the entry counts toward revenue and risk again. The mark and this unmark both stay in the audit trail.',
    confirm: 'Return to Active',
    tone: 'bg-emerald-600 hover:bg-emerald-500',
    placeholder: 'e.g. This was a real payment, mistakenly quarantined',
  },
};

const LifecycleActionModal: React.FC<{
  entry: LedgerEntry;
  action: LifecycleAction;
  onClose: () => void;
  onDone: (msg: string) => void;
}> = ({ entry, action, onClose, onDone }) => {
  const { currentUser, bearerToken } = useAuth();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const voidEntry = useMutation(api.financialIntegrity.voidLedgerEntry);
  const reinstateEntry = useMutation(api.financialIntegrity.reinstateLedgerEntry);
  const markTest = useMutation(api.financialIntegrity.markLedgerEntryAsTest);
  const unmarkTest = useMutation(api.financialIntegrity.unmarkLedgerEntryAsTest);

  const copy = LIFECYCLE_COPY[action];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = reason.trim();
    if (clean.length < 3) { setError('A reason is required — this is the audit trail.'); return; }
    setLoading(true); setError('');
    try {
      const base = { entryId: String((entry as any)._id ?? (entry as any).id), reason: clean, userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) };
      if (action === 'void') await voidEntry(base);
      else if (action === 'reinstate') await reinstateEntry(base);
      else if (action === 'test') await markTest(base);
      else await unmarkTest(base);
      onDone(`${copy.confirm} succeeded — recorded in the audit trail.`);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'The action failed. Nothing was changed.');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="font-bold text-white text-lg">{copy.title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-400 flex items-center justify-between">
            <span className="truncate">{TYPE_LABELS[entry.type]} · {formatNairaWhole(entry.amount)}</span>
            <span className="font-mono text-3xs text-slate-600 ml-2">{entry.txHash?.slice(0, 14)}</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{copy.body}</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5 font-semibold">Reason <span className="text-rose-400">(required — becomes part of the audit trail)</span></label>
            <textarea
              value={reason}
              onChange={e => { setReason(e.target.value); if (error) setError(''); }}
              rows={3}
              autoFocus
              placeholder={copy.placeholder}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 resize-none"
            />
            {error && <p className="text-xs text-rose-400 mt-1.5">{error}</p>}
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className={`flex-1 py-2.5 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${copy.tone}`}>
              {loading ? 'Working…' : copy.confirm}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Audit Trail Modal ────────────────────────────────────────────────────
const ACTION_STYLES: Record<string, string> = {
  void: 'bg-rose-900/40 text-rose-400 border-rose-800',
  reinstate: 'bg-emerald-900/40 text-emerald-400 border-emerald-800',
  mark_test: 'bg-violet-900/40 text-violet-400 border-violet-800',
  unmark_test: 'bg-emerald-900/40 text-emerald-400 border-emerald-800',
  edit: 'bg-sky-900/40 text-sky-400 border-sky-800',
  delete: 'bg-rose-900/40 text-rose-400 border-rose-800',
};

const AuditTrailModal: React.FC<{
  firmId: string;
  scope?: { tableName?: string; recordId?: string; label?: string };
  onClose: () => void;
}> = ({ firmId, scope, onClose }) => {
  const { currentUser, bearerToken } = useAuth();
  const rows = useQuery(
    api.financialIntegrity.getFinancialAuditLog,
    firmId ? {
      firmId,
      limit: 150,
      ...(scope?.tableName ? { tableName: scope.tableName } : {}),
      ...(scope?.recordId ? { recordId: scope.recordId } : {}),
      userEmail: currentUser?.email,
      sessionToken: (bearerToken ?? undefined),
    } : 'skip'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h3 className="font-bold text-white text-lg flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-400" /> Financial Audit Trail</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {scope?.label ? <>Scope: <span className="text-slate-400">{scope.label}</span> · </> : null}
              Append-only — every void, edit and test-mark, with its reason
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {!rows ? (
            [...Array(5)].map((_, i) => <div key={i} className="h-16 bg-slate-800 rounded-lg animate-pulse" />)
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-600">
              <ShieldCheck className="w-8 h-8 mb-2" />
              <p className="text-sm">No lifecycle actions recorded yet</p>
              <p className="text-xs mt-1">Voids, edits, test-marks and reinstatements will appear here</p>
            </div>
          ) : rows.map(r => (
            <div key={r.id} className="bg-slate-800/50 border border-slate-800 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-3xs font-black uppercase px-1.5 py-0.5 rounded-full border ${ACTION_STYLES[r.action] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>{r.action.replace('_', ' ')}</span>
                <span className="text-2xs text-slate-500 font-mono">{r.tableName} · {String(r.recordId).slice(0, 18)}</span>
                <span className="text-2xs text-slate-600 ml-auto">{new Date(r.createdAt).toLocaleString('en-NG')}</span>
              </div>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed"><span className="text-slate-500">Reason:</span> {r.reason}</p>
              <p className="text-3xs text-slate-600 mt-1">by {r.actorEmail || 'system'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Cash Flow Bar Chart ───────────────────────────────────────────────────
const CashFlowChart: React.FC<{ data: Record<string, { income: number; risk: number }> }> = ({ data }) => {
  const entries = Object.entries(data);
  const max = Math.max(...entries.flatMap(([, v]) => [v.income, v.risk]), 1);
  return (
    <div className="flex items-end gap-1.5 h-20">
      {entries.map(([month, v]) => (
        <div key={month} className="flex-1 flex flex-col items-center gap-0.5">
          <div className="w-full flex flex-col-reverse gap-0.5">
            <div className="w-full rounded-sm bg-emerald-500/80 transition-all" style={{ height: `${(v.income / max) * 60}px` }} title={`Income: ${formatNairaWhole(v.income)}`} />
            {v.risk > 0 && <div className="w-full rounded-sm bg-rose-500/60" style={{ height: `${(v.risk / max) * 60}px` }} title={`At Risk: ${formatNairaWhole(v.risk)}`} />}
          </div>
          <span className="text-3xs text-slate-600 font-medium">{month.slice(5)}</span>
        </div>
      ))}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────
const LedgerManager: React.FC = () => {
  const { currentUser, bearerToken } = useAuth();
  const { coreState } = useCoreState();
  const { addToast } = useUI();
  const firmId = coreState.firmDetails?.id || currentUser?.firmId || '';

  const entries = coreState.ledgerEntries || [];

  // FINANCIAL LIFECYCLE (accounting-integrity round): the client mirror of
  // the server's getCashFlowSummary semantics — voided and test-marked
  // records are annotations, not money, and never enter a total. The
  // predicate is the same one the server queries use (mirrored in
  // src/utils/financialLifecycle.ts, equivalence-locked by unit test).
  const cashFlow = useMemo(() => {
    const activeEntries = entries.filter(e => isActiveFinancialRecord(e.recordStatus));
    const cleared = activeEntries.filter(e => e.status === "cleared");
    const defaulted = activeEntries.filter(e => e.status === "defaulted");
    const pending = activeEntries.filter(e => e.status === "pending");

    const totalIncome = cleared.reduce((s, e) => s + e.amount, 0);
    const revenueAtRisk = defaulted.reduce((s, e) => s + e.amount, 0) + pending.reduce((s, e) => s + e.amount, 0);

    const now = new Date();
    const monthlyData: Record<string, { income: number; risk: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyData[key] = { income: 0, risk: 0 };
    }

    for (const e of activeEntries) {
      const d = new Date(e.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (monthlyData[key]) {
        if (e.status === "cleared") monthlyData[key].income += e.amount;
        else monthlyData[key].risk += e.amount;
      }
    }

    return { totalIncome, revenueAtRisk, totalTransactions: activeEntries.length, monthlyData };
  }, [entries]);

  const [filterType, setFilterType] = useState<LedgerEntryType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<LedgerEntryStatus | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  // Lifecycle UI state: voided/test rows are hidden from the working view by
  // default (they don't count) but one toggle away for forensic transparency.
  const [showLifecycleRecords, setShowLifecycleRecords] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [lifecycleModal, setLifecycleModal] = useState<{ entry: LedgerEntry; action: LifecycleAction } | null>(null);
  const [auditScope, setAuditScope] = useState<{ tableName?: string; recordId?: string; label?: string } | null | undefined>(undefined);

  // Close the row kebab menu on any outside click / scroll.
  useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
  }, [menuFor]);

  const hiddenCount = useMemo(() => entries.filter(e => !isActiveFinancialRecord(e.recordStatus)).length, [entries]);

  const { unitById } = usePropertyGroups(coreState.properties || []);

  const getUnitLabel = (unitId: string): string => {
    const unitOpt = unitById.get(unitId);
    if (unitOpt) {
      return unitOpt.unitName
        ? `${unitOpt.unitName} · ${unitOpt.shortAddress}`
        : unitOpt.shortAddress;
    }
    const p = (coreState.properties || []).find(p => p.id === unitId);
    if (p?.address) return p.address;
    for (const prop of (coreState.properties || [])) {
      const embedded: any[] = (prop as any).units || [];
      const match = embedded.find((u: any) => u.id === unitId);
      if (match) {
        const uName = match.unitName || match.name || '';
        const shortAddr = (prop.address || '').split(',')[0] || 'Property';
        return uName ? `${uName} · ${shortAddr}` : shortAddr;
      }
    }
    return 'Unknown Property';
  };

  const filtered = useMemo(() => {
    const propMap = new Map((coreState.properties || []).map(p => [p.id, p.address.toLowerCase()]));
    return entries.filter(e => {
      // Lifecycle-hidden records (voided/test) stay out of the working view
      // unless explicitly toggled in — they don't count, but they remain
      // inspectable for forensics.
      if (!showLifecycleRecords && !isActiveFinancialRecord(e.recordStatus)) return false;
      if (filterType !== 'all' && e.type !== filterType) return false;
      if (filterStatus !== 'all' && e.status !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        const propAddr = propMap.get(e.unitId) || '';
        if (
          !propAddr.includes(q) &&
          !(e.description || '').toLowerCase().includes(q) &&
          !(e.channel || '').toLowerCase().includes(q) &&
          !(e.paymentRef || '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [entries, filterType, filterStatus, search, coreState.properties, showLifecycleRecords]);

  const generateReceipt = (entry: LedgerEntry) => {
    // Record Rent Payment — calls the Atrium ledger directly from the cog menu
    const win = window.open('', '_blank');
    if (!win) return;
    const firm = coreState.firmDetails;
    // FIX: description/paymentRef were interpolated RAW into document.write —
    // any '<' in user text broke the receipt markup (self-XSS in the print
    // window). Escape all user-originated values.
    const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch] as string));
    win.document.write(`
      <html><head><title>Receipt ${entry.txHash}</title>
      <style>body{font-family:monospace;max-width:400px;margin:40px auto;padding:20px;border:1px solid #ccc}
      .logo{font-size:20px;font-weight:bold;color:#10b981;margin-bottom:4px}
      .hash{font-size:10px;color:#666;margin-bottom:20px}
      table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px solid #eee}
      .total{font-weight:bold;font-size:18px;color:#10b981;margin-top:20px}
      .footer{font-size:10px;color:#999;margin-top:20px;text-align:center}
      </style></head><body>
      <div class="logo">${esc(firm?.name || 'Atrium OS')}</div>
      <div class="hash">TX: ${esc(entry.txHash)}</div>
      <table>
        <tr><td>Date</td><td>${formatTs(entry.timestamp)}</td></tr>
        <tr><td>Type</td><td>${TYPE_LABELS[entry.type]}</td></tr>
        <tr><td>Status</td><td>${entry.status.toUpperCase()}</td></tr>
        <tr><td>Channel</td><td>${entry.channel || 'N/A'}</td></tr>
        ${entry.paymentRef ? `<tr><td>Ref</td><td>${esc(entry.paymentRef)}</td></tr>` : ''}
        ${entry.description ? `<tr><td>Note</td><td>${esc(entry.description)}</td></tr>` : ''}
      </table>
      <div class="total">${formatNairaWhole(entry.amount)}</div>
      <div class="footer">This is an auto-generated receipt from Atrium OS.<br/>Hash: ${entry.txHash} — Immutable Record</div>
      </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-950 text-white sm:overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">Financial Ledger</h2>
          <p className="text-xs text-slate-500 mt-0.5">Immutable append-only financial truth</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAuditScope(null)}
            title="Financial audit trail — every void, edit and test-mark with its reason"
            className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-lg transition-colors border border-slate-700"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Audit Trail
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-emerald-500/20 sm:w-auto w-full">
            <PlusIcon /> Record Entry
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-3 gap-3 px-4 sm:px-6 py-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendUpIcon className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Total Income</span>
          </div>
          <p className="text-2xl font-black text-emerald-400">₦{formatLargeNumber(cashFlow?.totalIncome ?? 0)}</p>
          <p className="text-2xs text-slate-600 mt-1">{cashFlow?.totalTransactions ?? 0} transactions</p>
        </div>
        <div className="bg-slate-900 border border-rose-900/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Revenue at Risk</span>
          </div>
          <p className="text-2xl font-black text-rose-400">₦{formatLargeNumber(cashFlow?.revenueAtRisk ?? 0)}</p>
          <p className="text-2xs text-slate-600 mt-1">Pending + Defaulted</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <HashIcon className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">6-Month Flow</span>
          </div>
          <CashFlowChart data={cashFlow?.monthlyData ?? {}} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 px-6 pb-3 flex flex-wrap items-center gap-2">
        <FilterIcon className="w-4 h-4 text-slate-600" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by property or description..."
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-emerald-500 w-56"
        />
        {(['all', 'rent', 'service_charge', 'penalty', 'deposit'] as const).map(t => (
          <button key={t} onClick={() => setFilterType(t)} className={`px-3 py-1 rounded-full text-2xs font-bold uppercase tracking-wider transition-colors ${filterType === t ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            {t === 'all' ? 'All Types' : TYPE_LABELS[t]}
          </button>
        ))}
        <div className="h-4 w-px bg-slate-800" />
        {(['all', 'cleared', 'pending', 'defaulted'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1 rounded-full text-2xs font-bold uppercase tracking-wider transition-colors ${filterStatus === s ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
            {s === 'all' ? 'All Status' : s}
          </button>
        ))}
        {hiddenCount > 0 && (
          <>
            <div className="h-4 w-px bg-slate-800" />
            <button
              onClick={() => setShowLifecycleRecords(v => !v)}
              title="Voided and test-quarantined records are excluded from all totals. They stay in the books for the audit trail."
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-2xs font-bold uppercase tracking-wider transition-colors ${showLifecycleRecords ? 'bg-violet-900/50 text-violet-300 border border-violet-800' : 'text-slate-500 hover:text-slate-300 border border-transparent'}`}
            >
              {showLifecycleRecords ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showLifecycleRecords ? 'Hide' : 'Show'} voided/test ({hiddenCount})
            </button>
          </>
        )}
        <span className="ml-auto text-xs text-slate-600">{filtered.length} entries</span>
      </div>

      {/* Table */}
      <div className="flex-1 sm:overflow-y-auto px-6 pb-44 sm:pb-6">
        {!entries ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-slate-900 rounded-lg animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-600">
            <HashIcon className="w-8 h-8 mb-2" />
            <p className="text-sm">No ledger entries yet</p>
            <p className="text-xs mt-1">Record your first transaction to begin</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map(entry => {
              const nonActive = !isActiveFinancialRecord(entry.recordStatus);
              const isVoided = entry.recordStatus === 'voided';
              const isTest = entry.recordStatus === 'test';
              const lifecycleTip = isVoided
                ? `Voided ${entry.voidedAt ? new Date(entry.voidedAt).toLocaleDateString('en-NG') : ''} by ${entry.voidedByEmail || 'unknown'} — "${entry.voidReason || 'no reason recorded'}"`
                : isTest ? 'Test-quarantined record — excluded from all totals' : '';
              return (
              <div key={entry._id} className={`group relative bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-lg px-4 py-3.5 transition-all ${nonActive ? 'opacity-50 hover:opacity-80 border-dashed' : ''}`}>
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Type dot */}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${nonActive ? 'bg-slate-600' : entry.status === 'cleared' ? 'bg-emerald-500' : entry.status === 'defaulted' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                    
                    {/* Meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-sm font-bold truncate ${nonActive ? 'text-slate-400 line-through decoration-slate-600' : 'text-white'}`}>
                          {getUnitLabel(entry.unitId)} — {entry.description || TYPE_LABELS[entry.type]}
                        </p>
                        <span className={`text-3xs font-black uppercase px-1.5 py-0.5 rounded-full bg-slate-800 ${TYPE_COLORS[entry.type]}`}>
                          {TYPE_LABELS[entry.type]}
                        </span>
                        {isVoided && (
                          <span title={lifecycleTip} className="flex items-center gap-1 text-3xs font-black uppercase px-1.5 py-0.5 rounded-full bg-rose-900/40 text-rose-400 border border-rose-800">
                            <Ban className="w-2.5 h-2.5" /> Voided
                          </span>
                        )}
                        {isTest && (
                          <span title={lifecycleTip} className="flex items-center gap-1 text-3xs font-black uppercase px-1.5 py-0.5 rounded-full bg-violet-900/40 text-violet-400 border border-violet-800">
                            <FlaskConical className="w-2.5 h-2.5" /> Test
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-2xs text-slate-500">{formatTs(entry.timestamp)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 border-t border-slate-800 md:border-0 pt-3 md:pt-0">
                    <div className="flex items-center gap-3">
                      <span className={`text-3xs font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLES[entry.status]}`}>
                        {entry.status}
                      </span>
                      <span className={`font-black text-base tabular-nums ${nonActive ? 'text-slate-500 line-through decoration-slate-700' : entry.status === 'cleared' ? 'text-emerald-400' : entry.status === 'defaulted' ? 'text-rose-400' : 'text-amber-400'}`}>
                        ₦{entry.amount.toLocaleString('en-NG')}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <button onClick={() => generateReceipt(entry)} aria-label="Generate Receipt" title="Generate Receipt" className="p-2 text-slate-500 hover:text-emerald-400 hover:bg-slate-700 rounded-lg transition-all">
                        <ReceiptIcon className="w-5 h-5 sm:w-4 sm:h-4" />
                      </button>
                      {/* Lifecycle kebab — void / test-mark / reinstate, each
                          audited with a mandatory reason */}
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setMenuFor(menuFor === String(entry._id) ? null : String(entry._id)); }}
                          aria-label="Record actions"
                          title="Void, mark as test, or view audit history"
                          className={`p-2 rounded-lg transition-all ${menuFor === String(entry._id) ? 'text-white bg-slate-700' : 'text-slate-500 hover:text-white hover:bg-slate-700'}`}
                        >
                          <MoreVertical className="w-5 h-5 sm:w-4 sm:h-4" />
                        </button>
                        {menuFor === String(entry._id) && (
                          <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-full mt-1 z-30 w-52 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl py-1 text-sm">
                            <button
                              onClick={() => { setMenuFor(null); setAuditScope({ tableName: 'ledger_entries', recordId: String((entry as any)._id ?? (entry as any).id), label: `${TYPE_LABELS[entry.type]} · ${formatNairaWhole(entry.amount)}` }); }}
                              className="w-full text-left px-3 py-2 hover:bg-slate-700 text-slate-300 flex items-center gap-2"
                            >
                              <FileSearch className="w-3.5 h-3.5 text-sky-400" /> Audit history
                            </button>
                            {!nonActive && (
                              <>
                                <button
                                  onClick={() => { setMenuFor(null); setLifecycleModal({ entry, action: 'void' }); }}
                                  className="w-full text-left px-3 py-2 hover:bg-slate-700 text-rose-400 flex items-center gap-2"
                                >
                                  <Ban className="w-3.5 h-3.5" /> Void entry…
                                </button>
                                <button
                                  onClick={() => { setMenuFor(null); setLifecycleModal({ entry, action: 'test' }); }}
                                  className="w-full text-left px-3 py-2 hover:bg-slate-700 text-violet-400 flex items-center gap-2"
                                >
                                  <FlaskConical className="w-3.5 h-3.5" /> Mark as test data…
                                </button>
                              </>
                            )}
                            {isVoided && (
                              <button
                                onClick={() => { setMenuFor(null); setLifecycleModal({ entry, action: 'reinstate' }); }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-700 text-emerald-400 flex items-center gap-2"
                              >
                                <Undo2 className="w-3.5 h-3.5" /> Reinstate entry…
                              </button>
                            )}
                            {isTest && (
                              <button
                                onClick={() => { setMenuFor(null); setLifecycleModal({ entry, action: 'unmark' }); }}
                                className="w-full text-left px-3 py-2 hover:bg-slate-700 text-emerald-400 flex items-center gap-2"
                              >
                                <Undo2 className="w-3.5 h-3.5" /> Return to active…
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddModal && <AddEntryModal firmId={firmId} onClose={() => setShowAddModal(false)} />}
      {lifecycleModal && (
        <LifecycleActionModal
          entry={lifecycleModal.entry}
          action={lifecycleModal.action}
          onClose={() => setLifecycleModal(null)}
          onDone={(msg) => addToast(msg, { type: 'success' })}
        />
      )}
      {auditScope !== undefined && (
        <AuditTrailModal firmId={firmId} scope={auditScope ?? undefined} onClose={() => setAuditScope(undefined)} />
      )}
    </div>
  );
};

export default LedgerManager;
