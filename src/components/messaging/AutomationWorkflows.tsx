/**
 * AutomationWorkflows — the pre-built automation library panel.
 *
 * INTUITIVENESS REDESIGN (user feedback, 2026-09-14):
 *   1. "When I increase the days, the number does not change — it does but
 *      at the bottom in a smaller font." → Step titles are now SEMANTIC and
 *      number-free ("Notice of Default"), and the offset stepper shows the
 *      number BIG and centred — the number being changed IS the number being
 *      displayed, with the before/after wording flipping automatically.
 *   2. "I cannot see what the messages they want to send look like." → Every
 *      step has "See the message": the exact text residents receive, rendered
 *      with a live recipient's details (or a realistic sample). "Edit
 *      message" rewrites the template the engine sends; "Reset" returns to
 *      the factory text.
 *   3. "I thought there would be ability to turn it off per unit as well." →
 *      Per-unit opt-outs: quick mute next to any recipient in "Who gets
 *      these?", plus a firm-wide per-unit management panel.
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │ ● Rent & Service Charge Collections            [ON]  │
 *   │   ▸ Notice of Default      [−] 7 [+] days after      │
 *   │     the rent due date · See the message              │
 *   │   ▸ Who gets these? →                               │
 *   └──────────────────────────────────────────────────────┘
 *
 * Changes save immediately (optimistic toggle + mutation) — no "Save" button
 * to forget. Everything the panel stamps flows into the engine's nightly
 * evaluation at 6:30 UTC and the 5-minute dispatch queue below it.
 */
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { BoltIcon, PauseIcon, PlayIcon, ShieldIcon } from './ScheduledTabIcons';
import { UsersIcon, EyeIcon, SearchIcon } from '../../constants';

interface WorkflowStep {
  key: string;
  label: string;
  title?: string;
  offsetDays: number;
  enabled: boolean;
  channel: 'auto' | 'email' | 'whatsapp';
  messageType: string;
  /** effective text residents receive (custom override or default) */
  subject?: string;
  /** factory text — the Reset target */
  defaultSubject?: string;
  subjectEdited?: boolean;
}

interface WorkflowCard {
  key: string;
  name: string;
  description: string;
  anchor: string;
  enabled: boolean;
  steps: WorkflowStep[];
  isCustomized: boolean;
}

interface TargetPreview {
  count: number;
  total?: number;
  sample: Array<{
    tenantName: string | null; unit: string; property: string;
    email: string | null; phone: string | null; amountDue: number | null;
    anchor: string; paid: boolean; unitId?: string; optedOut?: boolean;
  }>;
}

interface UnitStatus {
  unitKey: string;
  label: string;
  tenantName: string;
  property: string;
  optedOut: boolean;
}

/** Short anchor noun for the stepper sentence, per workflow. */
const ANCHOR_SHORT: Record<string, string> = {
  rent_collection: 'the rent due date',
  service_charge: 'the due date',
  lease_expiry: 'lease expiry',
  rent_review: 'the review date',
};

const CHANNEL_LABELS: Record<string, string> = { auto: 'Email → WhatsApp', email: 'Email only', whatsapp: 'WhatsApp only' };

const fmtDay = (d: number) => (d < 0 ? `${-d} day${-d === 1 ? '' : 's'} before` : d === 0 ? 'on the day' : `${d} day${d === 1 ? '' : 's'} after`);

const rangeSummary = (offsets: number[]): string => {
  if (!offsets.length) return '';
  const min = Math.min(...offsets);
  const max = Math.max(...offsets);
  return min === max ? fmtDay(min) : `${fmtDay(min)} → ${fmtDay(max)}`;
};

/** Toggle switch — one click, no modals. */
const Switch: React.FC<{ on: boolean; onChange: (next: boolean) => void; label: string; accent?: boolean }> = ({ on, onChange, label, accent }) => (
  <button
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={(e) => { e.stopPropagation(); onChange(!on); }}
    className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${on ? (accent ? 'bg-teal-600' : 'bg-primary-600') : 'bg-slate-300 dark:bg-zinc-700'}`}
  >
    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4.5 left-0.5' : 'left-0.5'}`}
      style={{ transform: on ? 'translateX(16px)' : 'translateX(0)' }} />
  </button>
);

const ChevronIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

export const AutomationWorkflows: React.FC<{ firmId: string }> = ({ firmId }) => {
  const { currentUser, bearerToken } = useAuth();
  const { addToast } = useUI();
  const sessionToken = (bearerToken ?? undefined) || undefined;
  const auth = { userEmail: currentUser?.email, sessionToken };

  const overview = useQuery(
    api.automationEngine.getAutomationOverview,
    firmId && currentUser ? { firmId, userEmail: currentUser.email, sessionToken } : 'skip'
  );
  const setWorkflowEnabled = useMutation(api.automationEngine.setWorkflowEnabled);
  const updateWorkflowStep = useMutation(api.automationEngine.updateWorkflowStep);
  const setUnitOptOut = useMutation(api.automationEngine.setUnitAutomationOptOut);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [previewFor, setPreviewFor] = useState<string | null>(null);
  const [msgOpen, setMsgOpen] = useState<string | null>(null);       // "wfKey/stepKey" — See the message
  const [editing, setEditing] = useState<string | null>(null);       // same key, edit mode on
  const [editDraft, setEditDraft] = useState('');
  const [unitPanelOpen, setUnitPanelOpen] = useState(false);
  const [unitSearch, setUnitSearch] = useState('');

  const preview = useQuery(
    api.automationEngine.previewWorkflowTargets,
    previewFor && firmId && currentUser ? { firmId, workflowKey: previewFor, userEmail: currentUser.email, sessionToken } : 'skip'
  );

  const unitStatus = useQuery(
    api.automationEngine.listUnitAutomationStatus,
    unitPanelOpen && firmId && currentUser ? { firmId, userEmail: currentUser.email, sessionToken } : 'skip'
  );

  const workflows: WorkflowCard[] = (overview as any)?.workflows || [];
  const optedOutUnits: Array<{ unitKey: string; label: string }> = (overview as any)?.optedOutUnits || [];

  const toggleWorkflow = async (wf: WorkflowCard, next: boolean) => {
    try {
      await setWorkflowEnabled({ firmId, workflowKey: wf.key, enabled: next, ...auth });
      addToast(`${wf.name} ${next ? 'enabled' : 'paused'}.`, { type: 'success' });
    } catch (e: any) {
      addToast(e.message || 'Could not update the workflow.', { type: 'error' });
    }
  };

  const saveStep = async (wf: WorkflowCard, step: WorkflowStep, patch: Partial<WorkflowStep> & { subject?: string }) => {
    try {
      await updateWorkflowStep({
        firmId, workflowKey: wf.key, stepKey: step.key,
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(patch.offsetDays !== undefined ? { offsetDays: patch.offsetDays } : {}),
        ...(patch.channel !== undefined ? { channel: patch.channel } : {}),
        ...(patch.subject !== undefined ? { subject: patch.subject } : {}),
        ...auth,
      });
    } catch (e: any) {
      addToast(e.message || 'Could not save the step.', { type: 'error' });
    }
  };

  const saveSubject = async (wf: WorkflowCard, step: WorkflowStep, text: string) => {
    try {
      await updateWorkflowStep({ firmId, workflowKey: wf.key, stepKey: step.key, subject: text, ...auth });
      addToast(
        text.trim() ? 'Message updated — residents now receive your wording.' : 'Message reset to the PracticePro default.',
        { type: 'success' }
      );
      setEditing(null);
    } catch (e: any) {
      addToast(e.message || 'Could not save the message.', { type: 'error' });
    }
  };

  const toggleUnitAutomation = async (unitKey: string, optOut: boolean, label?: string) => {
    try {
      await setUnitOptOut({ firmId, unitKey, optOut, ...(label ? { label } : {}), ...auth });
      addToast(
        optOut
          ? 'Automation off for this unit — its residents get no automated reminders.'
          : 'Automation back on for this unit.',
        { type: 'success' }
      );
    } catch (e: any) {
      addToast(e.message || 'Could not update this unit.', { type: 'error' });
    }
  };

  /** CONSISTENCY (2026-09-14, user feedback): "some have a real name, some
   * have variables — stick with one." The message preview used to render
   * with a live recipient's REAL details (or a fabricated sample) while the
   * editor showed raw {{variables}} — two different presentations of the
   * same message. Now the preview shows THE TEMPLATE ITSELF, with the
   * {{tags}} visible, exactly as the editor shows it and exactly as it is
   * stored. One presentation; what you see is what every resident receives,
   * with their own details filled in at send time. */

  const filteredUnits = useMemo(() => {
    const list: UnitStatus[] = (unitStatus as any)?.units || [];
    if (!unitSearch) return list.slice(0, 80);
    const q = unitSearch.toLowerCase();
    return list.filter((u) => u.label.toLowerCase().includes(q) || u.property.toLowerCase().includes(q)).slice(0, 80);
  }, [unitStatus, unitSearch]);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-1 flex-wrap">
        <BoltIcon className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <h3 className="text-2xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
          Automation workflows
        </h3>
        <span className="text-2xs text-slate-400 dark:text-zinc-500 font-medium hidden sm:inline">
          — every automated reminder is orchestrated here, evaluated daily at 7:30 AM
        </span>
      </div>

      {overview === undefined && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs text-slate-400">Loading workflows…</div>
      )}

      {workflows.map((wf) => {
        const open = expanded === wf.key;
        const activeSteps = wf.steps.filter((s) => s.enabled).length;
        const activeOffsets = wf.steps.filter((s) => s.enabled).map((s) => s.offsetDays);
        const anchorShort = ANCHOR_SHORT[wf.key] || 'the trigger date';
        // 2026-09-14 (overlap-guard UI): the two PAYMENT ladders share due dates
        // in practice; the engine now guarantees at most ONE payment reminder per
        // resident per day. Surface that promise on both cards so the names
        // ("Rent Collection Ladder" vs "Service Charge Reminders") can't be read
        // as double-messaging.
        const isPaymentLadder = wf.key === 'rent_collection' || wf.key === 'service_charge';
        return (
          <div
            key={wf.key}
            className={`rounded-xl border transition-colors ${
              wf.enabled
                ? 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800'
                : 'bg-slate-50/70 dark:bg-zinc-800/40 border-slate-200/70 dark:border-zinc-800'
            }`}
          >
            {/* Card header — click to expand, toggle to enable */}
            <div
              className="flex items-start justify-between gap-3 p-4 cursor-pointer select-none"
              onClick={() => setExpanded(open ? null : wf.key)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-bold ${wf.enabled ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-zinc-400'}`}>
                    {wf.name}
                  </span>
                  {wf.isCustomized && (
                    <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400">
                      customized
                    </span>
                  )}
                  {wf.enabled && activeSteps > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                      {activeSteps} message{activeSteps === 1 ? '' : 's'} active
                    </span>
                  )}
                  {optedOutUnits.length > 0 && (
                    <span
                      onClick={(e) => { e.stopPropagation(); setUnitPanelOpen(true); }}
                      className="px-1.5 py-0.5 rounded text-2xs font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 cursor-pointer"
                      title="Units excluded from all automation"
                    >
                      {optedOutUnits.length} unit{optedOutUnits.length === 1 ? '' : 's'} off
                    </span>
                  )}
                </div>
                <p className={`text-xs leading-relaxed mt-1 ${open ? '' : 'line-clamp-2'} ${wf.enabled ? 'text-slate-500 dark:text-zinc-400' : 'text-slate-400 dark:text-zinc-500'}`}>
                  {wf.description}
                </p>
                {isPaymentLadder && (
                  <p className="text-2xs text-teal-600 dark:text-teal-400 mt-1.5 flex items-center gap-1 flex-wrap">
                    <ShieldIcon className="w-3 h-3 flex-shrink-0" />
                    One payment reminder per resident per day — never double-sends with the other ladder.
                  </p>
                )}
                {wf.enabled && activeSteps > 0 && (
                  <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-1 tabular-nums">
                    Sends {rangeSummary(activeOffsets)} — anchored to {anchorShort.replace('the ', '').replace('the ', '')}.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <ChevronIcon className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                <Switch on={wf.enabled} accent onChange={(next) => toggleWorkflow(wf, next)} label={`Enable ${wf.name}`} />
              </div>
            </div>

            {/* Steps — semantic title, BIG offset stepper, message preview */}
            {open && (
              <div className="px-4 pb-4 space-y-2 border-t border-slate-100 dark:border-zinc-800 pt-3">
                {wf.steps.map((step) => {
                  const stepKey = `${wf.key}/${step.key}`;
                  const msgOpenHere = msgOpen === stepKey;
                  const editingHere = editing === stepKey;
                  const isBefore = step.offsetDays < 0;
                  const phrase = step.offsetDays === 0 ? `on ${anchorShort}` : `${isBefore ? 'days before' : 'days after'} ${anchorShort}`;
                  return (
                    <div
                      key={step.key}
                      className={`p-3 rounded-lg space-y-2 transition-colors ${
                        step.enabled ? 'bg-slate-50 dark:bg-zinc-800/50' : 'bg-slate-50/50 dark:bg-zinc-800/25 opacity-70'
                      }`}
                    >
                      {/* Identity + channel */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Switch on={step.enabled} onChange={(next) => saveStep(wf, step, { enabled: next })} label={step.title || step.label} />
                          <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate">
                            {step.title || step.label}
                          </span>
                          {step.subjectEdited && (
                            <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 flex-shrink-0">
                              custom text
                            </span>
                          )}
                        </div>
                        <select
                          value={step.channel}
                          onChange={(e) => saveStep(wf, step, { channel: e.target.value as WorkflowStep['channel'] })}
                          className="text-2xs font-bold rounded-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 px-1.5 py-1 flex-shrink-0"
                          title="Delivery channel"
                        >
                          {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>

                      {/* THE TIMING — the number being changed IS the number being displayed */}
                      <div className="flex items-center gap-2.5 flex-wrap pl-[52px]">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => saveStep(wf, step, { offsetDays: step.offsetDays - 1 })}
                            className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-95 transition-all"
                            title="One day earlier"
                          >−</button>
                          <span className="text-base font-extrabold text-slate-900 dark:text-white w-8 text-center tabular-nums leading-none py-0.5">
                            {Math.abs(step.offsetDays)}
                          </span>
                          <button
                            onClick={() => saveStep(wf, step, { offsetDays: step.offsetDays + 1 })}
                            className="w-7 h-7 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-sm font-bold hover:bg-slate-100 dark:hover:bg-zinc-800 active:scale-95 transition-all"
                            title="One day later"
                          >+</button>
                        </div>
                        <span className="text-xs font-semibold text-slate-500 dark:text-zinc-400">
                          {phrase}
                        </span>
                        <button
                          onClick={() => { setMsgOpen(msgOpenHere ? null : stepKey); setEditing(null); }}
                          className={`ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-2xs font-bold transition-colors ${
                            msgOpenHere
                              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                              : 'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                          }`}
                        >
                          <EyeIcon className="w-3 h-3" />
                          {msgOpenHere ? 'Hide the message' : 'See the message'}
                        </button>
                      </div>

                      {/* Message preview / editor — BOTH show the raw
                          template with {{tags}}: one presentation, exactly
                          what is stored and sent (tags fill per recipient). */}
                      {msgOpenHere && !editingHere && (
                        <div className="ml-[52px] rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-2xs font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                              The message every resident receives
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setEditDraft(step.subject || ''); setEditing(stepKey); }}
                                className="text-2xs font-bold text-primary-600 dark:text-primary-400 hover:underline"
                              >
                                Edit message
                              </button>
                              {step.subjectEdited && (
                                <button
                                  onClick={() => saveSubject(wf, step, '')}
                                  className="text-2xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:underline"
                                  title="Return to the PracticePro default wording"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-xs leading-relaxed text-slate-700 dark:text-zinc-300 whitespace-pre-line">
                            {step.subject || ''}
                          </p>
                          <p className="text-2xs text-slate-400 dark:text-zinc-500 leading-relaxed">
                            Tags like {' {{tenant_name}}'}, {' {{amount_due}}'} and {' {{due_date}}'} fill in each resident's own
                            details automatically at send time — nobody else ever sees another resident's name or amount.
                          </p>
                        </div>
                      )}

                      {/* Message editor */}
                      {editingHere && (
                        <div className="ml-[52px] rounded-lg border border-primary-200 dark:border-primary-900/40 bg-white dark:bg-zinc-900 p-3 space-y-2">
                          <span className="text-2xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                            Edit the message
                          </span>
                          <textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            rows={8}
                            placeholder="Write the message residents will receive…"
                            className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-600 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                          />
                          <p className="text-2xs text-slate-400 dark:text-zinc-500 leading-relaxed">
                            Saving <strong>replaces</strong> the text every resident receives for this step. Tags like
                            {' {{tenant_name}}'}, {' {{amount_due}}'}, {' {{due_date}}'} and {' {{payment_link}}'} fill in
                            each resident's own details at send time.
                          </p>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setEditing(null)}
                              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-zinc-400 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveSubject(wf, step, editDraft)}
                              disabled={!editDraft.trim()}
                              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                                editDraft.trim() ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-primary-400/50 text-white cursor-not-allowed'
                              }`}
                            >
                              Save message
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Recipient auto-population preview */}
                <div className="pt-2">
                  {previewFor === wf.key ? (
                    <div className="rounded-lg border border-teal-200 dark:border-teal-900/50 bg-teal-50/50 dark:bg-teal-900/10 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                          <UsersIcon className="w-3 h-3" />
                          Who gets these — {preview === undefined ? 'resolving…' : `${preview.count} resident${preview.count === 1 ? '' : 's'} right now`}
                        </span>
                        <button onClick={() => setPreviewFor(null)} className="text-2xs text-slate-400 hover:text-slate-600 font-bold">close</button>
                      </div>
                      {preview?.sample && preview.sample.length > 0 && (
                        <div className="max-h-44 overflow-y-auto custom-scrollbar space-y-1">
                          {preview.sample.map((t, i) => (
                            <div
                              key={i}
                              className={`flex items-center gap-2 text-2xs text-slate-600 dark:text-zinc-400 ${t.optedOut ? 'opacity-50' : ''}`}
                            >
                              <span className="font-bold truncate max-w-[9rem]">{t.tenantName || '(no name)'}</span>
                              <span className="truncate">{t.unit ? `${t.unit} · ` : ''}{t.property}</span>
                              {t.amountDue != null && <span className="text-teal-600 dark:text-teal-400 font-bold tabular-nums">₦{t.amountDue.toLocaleString('en-NG')}</span>}
                              {t.paid && <span className="px-1 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold">paid</span>}
                              {t.optedOut && <span className="px-1 rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold">automation off</span>}
                              {t.unitId && (
                                <button
                                  onClick={() => toggleUnitAutomation(String(t.unitId), !t.optedOut, `${t.unit || t.property}${t.tenantName ? ` — ${t.tenantName}` : ''}`)}
                                  className={`ml-auto p-1 rounded flex-shrink-0 transition-colors ${
                                    t.optedOut
                                      ? 'text-orange-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                                      : 'text-slate-300 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                                  }`}
                                  title={t.optedOut ? 'Turn automation back on for this unit' : 'Turn automation off for this unit'}
                                >
                                  {t.optedOut ? <PlayIcon className="w-3 h-3" /> : <PauseIcon className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {preview && preview.count === 0 && (
                        <p className="text-2xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                          No live targets today — recipients appear automatically as rent/charges come due.
                        </p>
                      )}
                      {preview?.total != null && preview.total > preview.count && (
                        <p className="text-2xs text-orange-600 dark:text-orange-400 mt-2">
                          {preview.total - preview.count} excluded by per-unit settings.
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewFor(wf.key); }}
                      className="flex items-center gap-1.5 text-2xs font-bold text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      <UsersIcon className="w-3 h-3" />
                      Who gets these? →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Per-unit automation settings — the user's "turn it off per unit" switch */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <button
          onClick={() => setUnitPanelOpen(!unitPanelOpen)}
          className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <UsersIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">Per-unit settings</span>
              {(overview as any)?.optedOutUnits?.length > 0 && (
                <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400">
                  {(overview as any).optedOutUnits.length} unit{(overview as any).optedOutUnits.length === 1 ? '' : 's'} excluded
                </span>
              )}
            </div>
            <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-1">
              Turn automated reminders off for specific units — those residents are skipped by every workflow above.
            </p>
          </div>
          <ChevronIcon className={`w-3.5 h-3.5 text-slate-400 transition-transform flex-shrink-0 ${unitPanelOpen ? 'rotate-90' : ''}`} />
        </button>

        {unitPanelOpen && (
          <div className="px-4 pb-4 space-y-2 border-t border-slate-100 dark:border-zinc-800 pt-3">
            <div className="relative">
              <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
                placeholder="Search units, tenants or buildings…"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400"
              />
            </div>
            {unitStatus === undefined && (
              <p className="text-2xs text-slate-400">Loading units…</p>
            )}
            <div className="max-h-56 overflow-y-auto custom-scrollbar rounded-lg border border-slate-200 dark:border-zinc-700 divide-y divide-slate-100 dark:divide-zinc-800">
              {filteredUnits.map((u) => (
                <div key={u.unitKey} className={`flex items-center justify-between gap-3 p-2.5 ${u.optedOut ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">{u.label}</p>
                    <p className="text-2xs text-slate-400 dark:text-zinc-500 truncate">
                      {u.optedOut ? 'No automated reminders — skipped by all workflows' : u.tenantName ? `${u.tenantName} · ${u.property}` : u.property}
                    </p>
                  </div>
                  <Switch
                    on={!u.optedOut}
                    onChange={(next) => toggleUnitAutomation(u.unitKey, !next, u.label)}
                    label={`Automation for ${u.label}`}
                  />
                </div>
              ))}
              {unitStatus !== undefined && filteredUnits.length === 0 && (
                <p className="p-3 text-2xs text-slate-400">
                  {unitSearch ? 'No units match that search.' : 'No units yet — add properties first.'}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Vega roadmap note (architecture slot, per the user's directive) */}
      <p className="text-2xs text-slate-400 dark:text-zinc-500 leading-relaxed px-1">
        Vega (legal practice) workflows — court-date and hearing reminders, retainer cycles, filing deadlines —
        plug into this same engine when the practice view ships. Onboarding, registration and account emails are
        transactional and are deliberately NOT orchestrated here.
      </p>
    </section>
  );
};

export default AutomationWorkflows;
