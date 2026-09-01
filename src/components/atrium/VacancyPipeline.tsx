import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { LeadPipelineEntry, LeadPipelineStage } from '../../types';
import { formatLargeNumber } from '../../utils/formatting';
import { usePropertyGroups, useUnitDropdownOptions } from '../../hooks/usePropertyGroups';

// ── Icons ─────────────────────────────────────────────────────────────────
const UserPlusIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
    <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
  </svg>
);
const ChevronRightIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const StarIcon = ({ className = "w-4 h-4", filled = false }) => (
  <svg className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);
const TrashIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
  </svg>
);
const PlusIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

// ── Constants ─────────────────────────────────────────────────────────────
const STAGES: LeadPipelineStage[] = ['Inquiry', 'Vetted', 'Lease_Generated', 'Closed'];
const STAGE_LABELS: Record<LeadPipelineStage, string> = {
  Inquiry: 'Inquiry', Vetted: 'Vetted', Lease_Generated: 'Lease Generated', Closed: 'Closed',
};
const STAGE_COLORS: Record<LeadPipelineStage, string> = {
  Inquiry: 'bg-sky-900/40 border-sky-700 text-sky-400',
  Vetted: 'bg-amber-900/40 border-amber-700 text-amber-400',
  Lease_Generated: 'bg-violet-900/40 border-violet-700 text-violet-400',
  Closed: 'bg-emerald-900/40 border-emerald-700 text-emerald-400',
};
const STAGE_DOT: Record<LeadPipelineStage, string> = {
  Inquiry: 'bg-sky-400', Vetted: 'bg-amber-400', Lease_Generated: 'bg-violet-400', Closed: 'bg-emerald-400',
};
const NEXT_STAGE: Partial<Record<LeadPipelineStage, LeadPipelineStage>> = {
  Inquiry: 'Vetted', Vetted: 'Lease_Generated', Lease_Generated: 'Closed',
};

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-NG', { day: '2-digit', month: 'short' });
}

function ScoreBar({ score }: { score?: number }) {
  if (score === undefined) return <span className="text-2xs text-slate-600">No score</span>;
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-2xs font-bold ${pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>{pct}</span>
    </div>
  );
}

// ── Add Lead Modal ────────────────────────────────────────────────────────
const AddLeadModal: React.FC<{ firmId: string; onClose: () => void }> = ({ firmId, onClose }) => {
  const addLead = useMutation(api.sentry.addLeadToPipeline);
  const { currentUser } = useAuth();
  const { coreState } = useCoreState();
  const [form, setForm] = useState({ unitId: '', applicantName: '', contactInfo: '', proposedRent: '', vettingScore: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const { flatUnits } = usePropertyGroups(coreState.properties || []);
  const units = useMemo(() => flatUnits.filter(u => u._raw && u._raw.status !== 'Occupied').map(u => ({ id: u.id, label: u.label })), [flatUnits]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unitId || !form.applicantName || !form.contactInfo) return;
    setLoading(true);
    try {
      await addLead({ firmId, unitId: form.unitId, applicantName: form.applicantName, contactInfo: form.contactInfo, proposedRent: form.proposedRent ? parseFloat(form.proposedRent) : undefined, vettingScore: form.vettingScore ? parseFloat(form.vettingScore) : undefined, notes: form.notes, userEmail: currentUser?.email });
      onClose();
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="font-bold text-white text-lg">Add Applicant</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Vacant Unit</label>
            <select value={form.unitId} onChange={e => setForm(f => ({ ...f, unitId: e.target.value }))} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500">
              <option value="">Select vacant unit...</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Applicant Name</label>
              <input value={form.applicantName} onChange={e => setForm(f => ({ ...f, applicantName: e.target.value }))} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500" placeholder="Full name" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Phone / Email</label>
              <input value={form.contactInfo} onChange={e => setForm(f => ({ ...f, contactInfo: e.target.value }))} required className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500" placeholder="+234..." />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Proposed Rent (₦)</label>
              <input type="number" value={form.proposedRent} onChange={e => setForm(f => ({ ...f, proposedRent: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500" placeholder="0" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Vetting Score (0-100)</label>
              <input type="number" min="0" max="100" value={form.vettingScore} onChange={e => setForm(f => ({ ...f, vettingScore: e.target.value }))} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500" placeholder="Leave blank to score later" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500 resize-none" placeholder="Employment, references, etc." />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-500 transition-colors disabled:opacity-50">
              {loading ? 'Adding...' : 'Add Applicant'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Lead Card (Kanban) ────────────────────────────────────────────────────
const LeadCard: React.FC<{ lead: LeadPipelineEntry; unitLabel: string; onAdvance: () => void; onScore: (s: number) => void }> = ({ lead, unitLabel, onAdvance, onScore }) => {
  const [editScore, setEditScore] = useState(false);
  const [scoreInput, setScoreInput] = useState(String(lead.vettingScore ?? ''));
  const next = NEXT_STAGE[lead.stage];

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg p-3 transition-all space-y-2.5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-bold text-white">{lead.applicantName}</p>
          <p className="text-2xs text-slate-500">{lead.contactInfo}</p>
        </div>
        {lead.proposedRent && <span className="text-xs font-black text-emerald-400">₦{formatLargeNumber(lead.proposedRent)}</span>}
      </div>
      <p className="text-2xs text-slate-600 truncate">{unitLabel}</p>
      <div className="space-y-1">
        <p className="text-3xs text-slate-600 uppercase tracking-wider">Vetting Score</p>
        {editScore ? (
          <div className="flex gap-1">
            <input type="number" min="0" max="100" value={scoreInput} onChange={e => setScoreInput(e.target.value)} className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:ring-1 focus:ring-emerald-500" />
            <button onClick={() => { onScore(parseInt(scoreInput) || 0); setEditScore(false); }} className="px-2 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-500">OK</button>
          </div>
        ) : (
          <div className="cursor-pointer" onClick={() => setEditScore(true)}>
            <ScoreBar score={lead.vettingScore} />
          </div>
        )}
      </div>
      {lead.notes && <p className="text-2xs text-slate-600 italic truncate">"{lead.notes}"</p>}
      <div className="flex items-center justify-between pt-1">
        <span className="text-3xs text-slate-700">{formatDate(lead.createdAt)}</span>
        {next && (
          <button onClick={onAdvance} className="flex items-center gap-1 text-2xs font-bold px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors">
            {STAGE_LABELS[next]} <ChevronRightIcon className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────
const VacancyPipeline: React.FC = () => {
  const { currentUser } = useAuth();
  const { coreState } = useCoreState();
  const firmId = coreState.firmDetails?.id || currentUser?.firmId || '';

  // FIX: previously read `coreState.leadsPipeline` — a key that getFirmData
  // NEVER returns. The Kanban board was permanently empty in production and
  // Add Applicant / advance-stage / score edits were invisible (no
  // subscription, no refetch). Switched to the real live query
  // (sentry.getPipelineByFirm) so the board renders and updates reactively.
  const liveLeads = useQuery(
    api.sentry.getPipelineByFirm,
    firmId ? { firmId, userEmail: currentUser?.email } : 'skip'
  );
  const leads = (liveLeads ?? (coreState as any).leadsPipeline ?? []) as any[];
  const advanceStage = useMutation(api.sentry.advanceLeadStage);
  const [showAdd, setShowAdd] = useState(false);

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

  const byStage = useMemo(() => {
    const map: Record<LeadPipelineStage, LeadPipelineEntry[]> = { Inquiry: [], Vetted: [], Lease_Generated: [], Closed: [] };
    leads.forEach((l: any) => { if (map[l.stage as LeadPipelineStage]) map[l.stage as LeadPipelineStage].push(l); });
    return map;
  }, [leads]);

  const conversionRate = useMemo(() => {
    if (leads.length === 0) return 0;
    return Math.round((leads.filter((l: any) => l.stage === 'Closed').length / leads.length) * 100);
  }, [leads]);

  const handleAdvance = async (lead: LeadPipelineEntry) => {
    const next = NEXT_STAGE[lead.stage];
    if (!next) return;
    await advanceStage({ leadId: lead._id as any, stage: next, userEmail: currentUser?.email });
  };

  const handleScore = async (lead: LeadPipelineEntry, score: number) => {
    await advanceStage({ leadId: lead._id as any, stage: lead.stage, vettingScore: score, userEmail: currentUser?.email });
  };

  return (
    <div className="min-h-full flex flex-col bg-slate-950 text-white sm:overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Vacancy Pipeline</h2>
          <p className="text-xs text-slate-500 mt-0.5">Inquiry → Closed conversion tracking</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          {/* SIMPLIFY FIX: the old "Share Application Link" button was removed —
              it copied a bare /apply URL (no propertyId) that 404'd, then told
              users to use a per-unit Share feature that didn't exist anywhere.
              Real share links now come from each property's unit card (Vacant/
              Listed units → "Share" chip), which copies a working
              /apply/:propertyId?unit=<name> link to this pipeline. */}
          <button onClick={() => setShowAdd(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition-colors sm:w-auto w-full">
            <PlusIcon /> Add Applicant
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 sm:px-6 py-4">
        {STAGES.map(s => (
          <div key={s} className={`border rounded-lg p-3 text-center ${STAGE_COLORS[s]}`}>
            <p className="text-xl sm:text-2xl font-black">{byStage[s].length}</p>
            <p className="text-3xs sm:text-2xs uppercase tracking-wider font-bold mt-0.5 opacity-80">{STAGE_LABELS[s]}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex-shrink-0 px-6 pb-3">
        <div className="flex items-center gap-3 mb-1">
          <p className="text-2xs text-slate-500 uppercase tracking-wider">Pipeline Flow</p>
          <span className="text-2xs font-bold text-emerald-400">{conversionRate}% conversion rate</span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
          {STAGES.map(s => {
            const total = (leads || []).length || 1;
            const pct = (byStage[s].length / total) * 100;
            return <div key={s} className={`${STAGE_DOT[s]} transition-all`} style={{ width: `${pct}%` }} title={`${STAGE_LABELS[s]}: ${byStage[s].length}`} />;
          })}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto px-4 sm:px-6 pb-44 sm:pb-6 custom-scrollbar">
        <div className="flex gap-4 h-full min-w-max">
          {STAGES.map(stage => (
            <div key={stage} className="w-64 flex-shrink-0 flex flex-col">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-3 border ${STAGE_COLORS[stage]}`}>
                <div className={`w-2 h-2 rounded-full ${STAGE_DOT[stage]}`} />
                <span className="text-xs font-bold uppercase tracking-wider">{STAGE_LABELS[stage]}</span>
                <span className="ml-auto text-xs font-black">{byStage[stage].length}</span>
              </div>
              <div className="flex-1 sm:overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {byStage[stage].length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-slate-700 border-2 border-dashed border-slate-800 rounded-lg">
                    <UserPlusIcon className="w-6 h-6 mb-1" />
                    <p className="text-xs">No applicants</p>
                  </div>
                ) : (
                  byStage[stage].map(lead => (
                    <LeadCard
                      key={lead._id}
                      lead={lead}
                      unitLabel={getUnitLabel(lead.unitId)}
                      onAdvance={() => handleAdvance(lead)}
                      onScore={(s) => handleScore(lead, s)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAdd && <AddLeadModal firmId={firmId} onClose={() => setShowAdd(false)} />}
    </div>
  );
};

export default VacancyPipeline;
