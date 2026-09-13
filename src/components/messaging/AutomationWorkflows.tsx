/**
 * AutomationWorkflows — the pre-built automation library panel.
 *
 * THE USER'S SPEC (2026-09-14): "transform the Scheduled Messages area into
 * an active, user-triggerable Automation & Scheduled Dispatch Engine" with
 * out-of-the-box workflows, ONE-CLICK toggles, adjustable offset days, and
 * visibility into who will be messaged. This panel renders one card per
 * workflow (rent collection ladder, service-charge notices, lease
 * milestones, rent reviews) straight from the engine's defaults merged with
 * the firm's stored overrides:
 *
 *   ┌────────────────────────────────────────────────┐
 *   │ ● Rent & Service Charge Collections      [ON]  │
 *   │   description…                                 │
 *   │   ▸ 7 days before due    [✓]  − 7 [±]  Email   │
 *   │   ▸ 3 days before due    [✓]  − 3 [±]  Auto    │
 *   │   ▸ Notice of Default    [✓]  + 7 [±]  Auto    │
 *   │   …                                            │
 *   │   [Who gets these? ▾]                          │
 *   └────────────────────────────────────────────────┘
 *
 * Changes save immediately (optimistic toggle + mutation) — no "Save" button
 * to forget. Everything the panel stamps flows into the engine's nightly
 * evaluation at 6:30 UTC and the 5-minute dispatch queue below it.
 */
import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { BoltIcon } from './ScheduledTabIcons';

interface WorkflowStep {
  key: string;
  label: string;
  offsetDays: number;
  enabled: boolean;
  channel: 'auto' | 'email' | 'whatsapp';
  messageType: string;
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
  sample: Array<{
    tenantName: string | null; unit: string; property: string;
    email: string | null; phone: string | null; amountDue: number | null;
    anchor: string; paid: boolean;
  }>;
}

const offsetLabel = (d: number) => (d === 0 ? 'on the day' : d < 0 ? `${-d} day${-d === 1 ? '' : 's'} before` : `${d} day${d === 1 ? '' : 's'} after`);

const CHANNEL_LABELS: Record<string, string> = { auto: 'Email → WhatsApp', email: 'Email only', whatsapp: 'WhatsApp only' };

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

export const AutomationWorkflows: React.FC<{ firmId: string }> = ({ firmId }) => {
  const { currentUser, bearerToken } = useAuth();
  const { addToast } = useUI();
  const sessionToken = (bearerToken ?? undefined) || undefined;

  const overview = useQuery(
    api.automationEngine.getAutomationOverview,
    firmId && currentUser ? { firmId, userEmail: currentUser.email, sessionToken } : 'skip'
  );
  const setWorkflowEnabled = useMutation(api.automationEngine.setWorkflowEnabled);
  const updateWorkflowStep = useMutation(api.automationEngine.updateWorkflowStep);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [previewFor, setPreviewFor] = useState<string | null>(null);
  const preview = useQuery(
    api.automationEngine.previewWorkflowTargets,
    previewFor && firmId && currentUser ? { firmId, workflowKey: previewFor, userEmail: currentUser.email, sessionToken } : 'skip'
  );

  const auth = { userEmail: currentUser?.email, sessionToken };

  const toggleWorkflow = async (wf: WorkflowCard, next: boolean) => {
    try {
      await setWorkflowEnabled({ firmId, workflowKey: wf.key, enabled: next, ...auth });
      addToast(`${wf.name} ${next ? 'enabled' : 'paused'}.`, { type: 'success' });
    } catch (e: any) {
      addToast(e.message || 'Could not update the workflow.', { type: 'error' });
    }
  };

  const saveStep = async (wf: WorkflowCard, step: WorkflowStep, patch: Partial<WorkflowStep>) => {
    try {
      await updateWorkflowStep({
        firmId, workflowKey: wf.key, stepKey: step.key,
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(patch.offsetDays !== undefined ? { offsetDays: patch.offsetDays } : {}),
        ...(patch.channel !== undefined ? { channel: patch.channel } : {}),
        ...auth,
      });
    } catch (e: any) {
      addToast(e.message || 'Could not save the step.', { type: 'error' });
    }
  };

  const workflows: WorkflowCard[] = (overview as any)?.workflows || [];

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <BoltIcon className="w-3.5 h-3.5 text-amber-500" />
        <h3 className="text-2xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
          Automation workflows
        </h3>
        <span className="text-2xs text-slate-400 dark:text-zinc-500 font-medium">
          — every automated reminder is orchestrated here, evaluated daily at 7:30 AM
        </span>
      </div>

      {overview === undefined && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs text-slate-400">Loading workflows…</div>
      )}

      {workflows.map((wf) => {
        const open = expanded === wf.key;
        const activeSteps = wf.steps.filter((s) => s.enabled).length;
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
                  {wf.enabled && (
                    <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                      {activeSteps} message{activeSteps === 1 ? '' : 's'} active
                    </span>
                  )}
                </div>
                <p className={`text-xs leading-relaxed mt-1 ${wf.enabled ? 'text-slate-500 dark:text-zinc-400' : 'text-slate-400 dark:text-zinc-500'}`}>
                  {wf.description}
                </p>
                <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-1">
                  Anchored to {wf.anchor}.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <svg
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <Switch on={wf.enabled} accent onChange={(next) => toggleWorkflow(wf, next)} label={`Enable ${wf.name}`} />
              </div>
            </div>

            {/* Steps — per-step toggle, offset adjuster, channel */}
            {open && (
              <div className="px-4 pb-4 space-y-1.5 border-t border-slate-100 dark:border-zinc-800 pt-3">
                {wf.steps.map((step) => (
                  <div
                    key={step.key}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-zinc-800/50"
                  >
                    <Switch on={step.enabled} onChange={(next) => saveStep(wf, step, { enabled: next })} label={step.label} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-700 dark:text-zinc-300 truncate">{step.label}</div>
                      <div className="text-2xs text-slate-400 dark:text-zinc-500">{offsetLabel(step.offsetDays)}</div>
                    </div>
                    {/* Offset adjuster — tweak without rewriting the rule */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => saveStep(wf, step, { offsetDays: step.offsetDays - 1 })}
                        className="w-6 h-6 rounded-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-800"
                        title="One day earlier"
                      >−</button>
                      <span className="text-2xs font-bold text-slate-500 dark:text-zinc-400 w-10 text-center tabular-nums">
                        {step.offsetDays === 0 ? 'day 0' : `${step.offsetDays > 0 ? '+' : ''}${step.offsetDays}d`}
                      </span>
                      <button
                        onClick={() => saveStep(wf, step, { offsetDays: step.offsetDays + 1 })}
                        className="w-6 h-6 rounded-md bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-zinc-800"
                        title="One day later"
                      >+</button>
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
                ))}

                {/* Recipient auto-population preview */}
                <div className="pt-2">
                  {previewFor === wf.key ? (
                    <div className="rounded-lg border border-teal-200 dark:border-teal-900/50 bg-teal-50/50 dark:bg-teal-900/10 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                          Who gets these — {preview === undefined ? 'resolving…' : `${preview.count} recipient${preview.count === 1 ? '' : 's'} right now`}
                        </span>
                        <button onClick={() => setPreviewFor(null)} className="text-2xs text-slate-400 hover:text-slate-600 font-bold">close</button>
                      </div>
                      {preview?.sample && preview.sample.length > 0 && (
                        <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                          {preview.sample.map((t, i) => (
                            <div key={i} className="flex items-center gap-2 text-2xs text-slate-600 dark:text-zinc-400">
                              <span className="font-bold truncate max-w-[10rem]">{t.tenantName || '(no name)'}</span>
                              <span className="truncate">{t.unit ? `${t.unit} · ` : ''}{t.property}</span>
                              {t.amountDue != null && <span className="text-teal-600 dark:text-teal-400 font-bold tabular-nums">₦{t.amountDue.toLocaleString('en-NG')}</span>}
                              {t.paid && <span className="px-1 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold">paid</span>}
                              <span className="text-slate-300 dark:text-zinc-600">due {t.anchor}</span>
                            </div>
                          ))}
                          {preview.count > preview.sample.length && (
                            <div className="text-2xs text-slate-400">+ {preview.count - preview.sample.length} more…</div>
                          )}
                        </div>
                      )}
                      {preview && preview.count === 0 && (
                        <p className="text-2xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                          No live targets today — recipients appear automatically as rent/charges come due.
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewFor(wf.key); }}
                      className="text-2xs font-bold text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      Who gets these? →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

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
