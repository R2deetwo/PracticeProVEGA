/**
 * ScheduledTab — the Automation & Scheduled Dispatch Engine's control room.
 *
 * THE TRANSFORMATION (user directive, 2026-09-14): this area used to be a
 * static list; it is now the single place where ALL automated
 * tenant/client/vendor messaging is orchestrated:
 *
 *   1. AUTOMATION WORKFLOWS — pre-built, one-click-toggle sequences (rent
 *      collection ladder 7/3/1-day pre-due → due day → grace → Notice of
 *      Default → 14-day demand; service-charge notices; lease-expiry
 *      milestones; rent reviews). Per-step toggles, offset adjusters and
 *      channel pickers; "Who gets these?" resolves the live recipient list.
 *   2. LIVE QUEUE — every pending automated dispatch with its status
 *      (Queued / Sending / Paused / Sent / Failed / Cancelled), dispatch
 *      time, recipient and workflow origin — plus pause / resume / stop
 *      controls (e.g. a tenant already settled manually).
 *   3. YOUR SCHEDULED MESSAGES — human-scheduled sends, now with
 *      SCOPE-BASED RECIPIENT AUTO-POPULATION (all tenants / a building /
 *      overdue accounts / specific units), merge fields
 *      ({{tenant_name}} {{unit_number}} {{amount_due}} {{due_date}} …)
 *      and a live per-recipient preview.
 *
 * Engine mechanics live in convex/automationEngine.ts (nightly 6:30 UTC
 * evaluation + dispatch ledger idempotency) and convex/portals.ts
 * (5-minute dispatch processor with atomic claim). Payment suppression
 * (receipt uploaded → hold; verified → cancel; rejected → resume) is wired
 * in the payment-proof mutations and the Paystack webhook.
 */
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useConfirm } from '../ui/ConfirmDialog';
import { usePropertyGroups } from '../../hooks/usePropertyGroups';
import { PlusIcon, ClockIcon, TrashIcon, SendIcon, SearchIcon } from '../../constants';
import { MSG_TYPE_LABELS } from '../../utils/messageTypes';
import { isDueNow } from '../../messaging/sections';
import { renderMergeFields, hasMergeFields, nextRentDueTs, MERGE_FIELD_TAGS } from '../../utils/mergeFields';
import { AutomationWorkflows } from './AutomationWorkflows';
import { BoltIcon, PauseIcon, PlayIcon } from './ScheduledTabIcons';

const CHANNEL_STYLES: Record<string, string> = {
  whatsapp: 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
  email: 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
  sms: 'text-purple-700 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
};

const STATUS_STYLES: Record<string, string> = {
  scheduled: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400',
  sending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  paused: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  sent: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  failed: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
  cancelled: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Queued', sending: 'Sending', paused: 'Paused', sent: 'Sent', failed: 'Failed', cancelled: 'Cancelled',
};

const WORKFLOW_LABELS: Record<string, string> = {
  rent_collection: 'Rent collection', service_charge: 'Service charge',
  lease_expiry: 'Lease expiry', rent_review: 'Rent review',
};

const formatWhen = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `today at ${time}`;
  return `${d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })} · ${time}`;
};

type ScopeMode = 'all' | 'overdue' | 'building' | 'custom';

interface FormRecipient {
  key: string;
  unitId?: string;
  tenantName: string;
  email: string;
  phone: string;
  unitLabel: string;
  property: string;
  amountDue: number | null;
  dueLabel: string;
}

interface ScheduledTabProps {
  firmId: string;
}

export const ScheduledTab: React.FC<ScheduledTabProps> = ({ firmId }) => {
  const { currentUser, bearerToken } = useAuth();
  const { addToast } = useUI();
  const { confirm, ConfirmDialog } = useConfirm();
  const { coreState } = useCoreState();
  const sessionToken = (bearerToken ?? undefined) || undefined;
  const auth = { userEmail: currentUser?.email, sessionToken };

  // ── Data ─────────────────────────────────────────────────────────────────
  const queue = useQuery(
    api.automationEngine.getAutomationQueue,
    firmId && currentUser ? { firmId, ...auth } : 'skip'
  );
  const cancelScheduled = useMutation(api.portals.cancelScheduledMessage);
  const createScheduled = useMutation(api.portals.createScheduledMessage);
  const pauseAutomation = useMutation(api.automationEngine.pauseScheduledAutomation);
  const resumeAutomation = useMutation(api.automationEngine.resumeScheduledAutomation);

  // Overdue-account recipients (engine's real service-charge resolver).
  const overduePreview = useQuery(
    api.automationEngine.previewWorkflowTargets,
    firmId && currentUser ? { firmId, workflowKey: 'service_charge', ...auth } : 'skip'
  );

  // Unit catalogue for scope-based auto-population.
  const properties = (coreState as any).properties || (coreState as any).firmDetails?.properties || [];
  const { flatUnits } = usePropertyGroups(properties as any[]);

  // ── Classification (manual vs automation) ────────────────────────────────
  const { mine, automationQueue } = useMemo(() => {
    const pending = (queue?.pending || []) as any[];
    const paused = (queue?.paused || []) as any[];
    const all = [...pending, ...paused];
    return {
      mine: all.filter((m) => !m.isAutomation),
      automationQueue: all.filter((m) => m.isAutomation),
    };
  }, [queue]);
  const history = (queue?.history || []) as any[];

  // ── Schedule form state ──────────────────────────────────────────────────
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    channel: 'email' as 'email' | 'whatsapp',
    messageType: 'rent_reminder',
    content: '',
    scheduledFor: '',
  });
  const [scopeMode, setScopeMode] = useState<ScopeMode>('custom');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [recipientSearch, setRecipientSearch] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleProgress, setScheduleProgress] = useState('');

  const buildings = useMemo(() => {
    const seen = new Map<string, string>();
    for (const u of flatUnits) seen.set(u.shortAddress, u.address);
    return Array.from(seen.entries()).map(([short, full]) => ({ short, full }));
  }, [flatUnits]);

  /** The auto-populated recipient list for the current scope. */
  const recipients = useMemo<FormRecipient[]>(() => {
    if (scopeMode === 'overdue') {
      return (((overduePreview as any)?.sample || []) as any[]).map((t: any, i: number): FormRecipient => ({
        key: `overdue-${i}`,
        unitId: undefined,
        tenantName: t.tenantName || '',
        email: t.email || '',
        phone: t.phone || '',
        unitLabel: t.unit || '',
        property: t.property || '',
        amountDue: t.amountDue ?? null,
        dueLabel: t.anchor || '',
      }));
    }
    let units: any[] = flatUnits as any[];
    if (scopeMode === 'building' && buildingFilter) units = units.filter((u) => u.shortAddress === buildingFilter);
    if (scopeMode === 'custom') units = units.filter((u) => selectedUnitIds.includes(u.id));
    if (scopeMode === 'custom' && recipientSearch) {
      const q = recipientSearch.toLowerCase();
      units = units.filter((u) =>
        (u.tenantName || '').toLowerCase().includes(q) ||
        (u.unitName || '').toLowerCase().includes(q) ||
        (u.address || '').toLowerCase().includes(q));
    }
    return units
      .filter((u) => u.tenantEmail || u.tenantPhone)
      .map((u): FormRecipient => ({
        key: u.id,
        unitId: u.id,
        tenantName: u.tenantName || '',
        email: u.tenantEmail || '',
        phone: u.tenantPhone || '',
        unitLabel: u.unitName || '',
        property: u.shortAddress || u.address || '',
        amountDue: (u.rentAmount || 0) + (u.serviceCharge || 0) || null,
        dueLabel: new Date(nextRentDueTs(Date.now(), u.leaseStart ? new Date(u.leaseStart).getTime() : null))
          .toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }),
      }));
  }, [scopeMode, buildingFilter, selectedUnitIds, flatUnits, overduePreview, recipientSearch]);

  const contactable = useMemo(
    () => recipients.filter((r) => (scheduleForm.channel === 'email' ? !!r.email : !!r.phone)),
    [recipients, scheduleForm.channel]
  );

  const insertTag = (tag: string) => {
    setScheduleForm((prev) => ({ ...prev, content: prev.content + (prev.content && !prev.content.endsWith(' ') ? ' ' : '') + tag }));
  };

  const previewContent = useMemo(() => {
    const first = contactable[0] || recipients[0];
    if (!first) return scheduleForm.content;
    return renderMergeFields(scheduleForm.content, {
      tenant_name: first.tenantName || 'Tenant',
      unit_number: first.unitLabel ? `${first.unitLabel}, ${first.property}` : first.property,
      amount_due: first.amountDue,
      due_date: first.dueLabel,
      property_name: first.property,
      payment_link: 'your portal payment link',
    });
  }, [scheduleForm.content, contactable, recipients]);

  const toggleUnit = (id: string) => {
    setSelectedUnitIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const setChannel = (channel: 'email' | 'whatsapp') => setScheduleForm((prev) => ({ ...prev, channel }));

  const handleScheduleMessage = async () => {
    const { channel, messageType, content, scheduledFor } = scheduleForm;
    if (!content.trim() || !scheduledFor) {
      addToast('Please fill in the message, date and time.', { type: 'error' });
      return;
    }
    if (contactable.length === 0) {
      addToast(
        scopeMode === 'overdue'
          ? 'No overdue accounts right now — pick a different audience.'
          : `No recipients with ${channel === 'email' ? 'an email address' : 'a phone number'} in this selection.`,
        { type: 'error' }
      );
      return;
    }
    if (new Date(scheduledFor).getTime() <= Date.now()) {
      addToast('Pick a future date and time.', { type: 'error' });
      return;
    }
    const scheduledForTs = new Date(scheduledFor).getTime();
    setIsScheduling(true);
    let ok = 0, failedCount = 0;
    try {
      for (let i = 0; i < contactable.length; i++) {
        const r = contactable[i];
        setScheduleProgress(`${i + 1} / ${contactable.length} — ${r.tenantName || r.email || r.phone}`);
        const rendered = renderMergeFields(content, {
          tenant_name: r.tenantName,
          unit_number: r.unitLabel ? `${r.unitLabel}, ${r.property}` : r.property,
          amount_due: r.amountDue,
          due_date: r.dueLabel,
          property_name: r.property,
        });
        try {
          await createScheduled({
            firmId,
            channel,
            messageType,
            content: rendered.trim(),
            scheduledFor: scheduledForTs,
            recipientEmail: channel === 'email' ? r.email : undefined,
            recipientPhone: channel === 'whatsapp' ? r.phone : undefined,
            recipientName: r.tenantName || r.email || r.phone,
            ...(r.unitId ? { unitId: r.unitId } : {}),
            ...auth,
          });
          ok++;
        } catch {
          failedCount++;
        }
      }
      if (ok > 0 && failedCount === 0) {
        addToast(`Scheduled for ${ok} recipient${ok === 1 ? '' : 's'} · ${new Date(scheduledForTs).toLocaleString('en-NG')}`, { type: 'success' });
        setScheduleForm((prev) => ({ ...prev, content: '' }));
        setShowScheduleForm(false);
        setSelectedUnitIds([]);
      } else if (ok > 0) {
        addToast(`Scheduled for ${ok}, failed for ${failedCount}.`, { type: 'error' });
        setSelectedUnitIds([]);
      } else {
        addToast('Scheduling failed — please try again.', { type: 'error' });
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to schedule message.', { type: 'error' });
    } finally {
      setIsScheduling(false);
      setScheduleProgress('');
    }
  };

  const handleCancel = async (msg: any) => {
    const label = MSG_TYPE_LABELS[msg.messageType as keyof typeof MSG_TYPE_LABELS] || msg.messageType;
    const ok = await confirm({
      title: 'Stop this message?',
      message: `This ${label} will no longer be sent. You can always schedule a new one.`,
      confirmLabel: 'Stop it',
      cancelLabel: 'Leave it',
      danger: true,
    });
    if (!ok) return;
    try {
      await cancelScheduled({ messageId: msg._id, ...auth });
      addToast('Message stopped.', { type: 'success' });
    } catch (e: any) {
      addToast(e.message || 'Failed to stop message.', { type: 'error' });
    }
  };

  const handlePause = async (msg: any) => {
    try {
      await pauseAutomation({ messageId: msg._id, ...auth });
      addToast('Dispatch held — resume it any time.', { type: 'success' });
    } catch (e: any) {
      addToast(e.message || 'Failed to pause.', { type: 'error' });
    }
  };

  const handleResume = async (msg: any) => {
    try {
      await resumeAutomation({ messageId: msg._id, ...auth });
      addToast('Dispatch resumed.', { type: 'success' });
    } catch (e: any) {
      addToast(e.message || 'Failed to resume.', { type: 'error' });
    }
  };

  const recipientLabel = (msg: any) =>
    msg.recipientName || msg.recipientEmail || msg.recipientPhone || `${(msg.tenantIds || []).length} recipient(s)`;

  const workflowLabel = (msg: any) => {
    if (msg.workflowKey && msg.stepKey) return `${WORKFLOW_LABELS[msg.workflowKey] || msg.workflowKey} · ${msg.stepKey}`;
    if (msg.pauseReason === 'payment_review') return 'held — payment under review';
    return null;
  };

  // ── Row renderer (shared by pending sections) ────────────────────────────
  const renderRow = (msg: any, variant: 'mine' | 'automation') => {
    const due = isDueNow(msg);
    const paused = msg.status === 'paused';
    const wf = workflowLabel(msg);
    return (
      <div
        key={msg._id}
        className={`p-3.5 rounded-xl border transition-colors ${
          paused
            ? 'bg-orange-50/70 dark:bg-orange-900/10 border-orange-200 dark:border-orange-900/40'
            : variant === 'automation'
              ? 'bg-slate-50/70 dark:bg-zinc-800/40 border-slate-200/70 dark:border-zinc-800'
              : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`px-1.5 py-0.5 rounded text-2xs font-bold uppercase ${CHANNEL_STYLES[msg.channel] || 'text-slate-500 bg-slate-100'}`}>
                {msg.channel}
              </span>
              <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400">
                {MSG_TYPE_LABELS[msg.messageType as keyof typeof MSG_TYPE_LABELS] || msg.messageType}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-2xs font-bold ${STATUS_STYLES[msg.status] || STATUS_STYLES.scheduled}`}>
                {STATUS_LABELS[msg.status] || msg.status}
              </span>
              {wf && (
                <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400">
                  {wf}
                </span>
              )}
              {due && !paused && msg.status === 'scheduled' && (
                <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                  due now
                </span>
              )}
            </div>
            <p className={`text-xs leading-relaxed line-clamp-2 mb-1 ${variant === 'automation' ? 'text-slate-500 dark:text-zinc-500' : 'text-slate-600 dark:text-zinc-400'}`}>
              {msg.content}
            </p>
            <div className="flex items-center gap-2 text-2xs text-slate-400 dark:text-zinc-500 flex-wrap">
              <span className="font-bold">
                {paused ? 'On hold' : msg.scheduledFor ? `Goes out ${formatWhen(msg.scheduledFor)}` : 'No date set'}
              </span>
              <span aria-hidden>·</span>
              <span className="truncate">→ {recipientLabel(msg)}</span>
            </div>
            {msg.pauseReason === 'payment_review' && (
              <p className="text-2xs text-orange-600 dark:text-orange-400 mt-1 leading-relaxed">
                Held automatically — this tenant uploaded a payment receipt awaiting verification. It will
                resume if the payment is rejected.
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {paused && (
              <button
                onClick={() => handleResume(msg)}
                className="p-1.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                title="Resume this dispatch"
              >
                <PlayIcon className="w-3.5 h-3.5" />
              </button>
            )}
            {!paused && msg.status === 'scheduled' && (
              <button
                onClick={() => handlePause(msg)}
                className="p-1.5 rounded text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                title="Hold this dispatch (e.g. the tenant already settled)"
              >
                <PauseIcon className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={() => handleCancel(msg)}
              className="p-1.5 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
              title={variant === 'mine' ? 'Stop this scheduled message' : 'Stop this automatic message'}
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const historyRow = (msg: any) => (
    <div key={msg._id} className="p-2.5 rounded-lg border border-slate-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`px-1.5 py-0.5 rounded text-2xs font-bold ${STATUS_STYLES[msg.status] || ''}`}>
          {STATUS_LABELS[msg.status] || msg.status}
        </span>
        <span className={`px-1.5 py-0.5 rounded text-2xs font-bold uppercase ${CHANNEL_STYLES[msg.channel] || ''}`}>{msg.channel}</span>
        <span className="text-2xs text-slate-400 truncate flex-1 min-w-0">{msg.content?.slice(0, 90)}…</span>
        <span className="text-2xs text-slate-400 truncate max-w-[8rem]">→ {recipientLabel(msg)}</span>
        <span className="text-2xs text-slate-400 flex-shrink-0">{msg.sentAt ? formatWhen(msg.sentAt) : ''}</span>
      </div>
      {msg.failureReason && (
        <p className="text-2xs text-rose-500 dark:text-rose-400 mt-1 truncate">{msg.failureReason}</p>
      )}
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      {ConfirmDialog}
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Scheduled & Automation</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                The engine room — every automated reminder is orchestrated and dispatched from here.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {automationQueue.length > 0 && (
                <span className="px-2.5 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 text-xs font-bold rounded-full">
                  {automationQueue.length} queued
                </span>
              )}
              {mine.length > 0 && (
                <span className="px-2.5 py-1 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 text-xs font-bold rounded-full">
                  {mine.length} waiting
                </span>
              )}
              <button
                onClick={() => setShowScheduleForm(!showScheduleForm)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg shadow-sm transition-all ${
                  showScheduleForm
                    ? 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                <PlusIcon className="w-3.5 h-3.5" />
                {showScheduleForm ? 'Close' : 'Schedule Message'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-950/40">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-8">

          {/* ── 1. Automation workflows ── */}
          <AutomationWorkflows firmId={firmId} />

          {/* ── 2. Live queue (automation dispatches) ── */}
          <section>
            <div className="flex items-center gap-2 mb-2 px-1">
              <ClockIcon className="w-3.5 h-3.5 text-teal-500" />
              <h3 className="text-2xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                Live queue ({automationQueue.length})
              </h3>
              <span className="text-2xs text-slate-400 dark:text-zinc-500 font-medium">
                — automated dispatches waiting to go out; pause any of them
              </span>
            </div>
            {automationQueue.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-xs text-slate-400 dark:text-zinc-500 leading-relaxed">
                Nothing queued. The engine evaluates your workflows every morning at 7:30 AM — reminders for
                rent, service charges and lease milestones land here the day they're due, and send themselves
                within minutes. Payment receipts a tenant uploads automatically hold their reminders while
                verification runs.
              </div>
            ) : (
              <div className="space-y-2">{automationQueue.map((msg: any) => renderRow(msg, 'automation'))}</div>
            )}
          </section>

          {/* ── 3. Your scheduled messages ── */}
          <section>
            <h3 className="text-2xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400 mb-2 px-1">
              Your scheduled messages ({mine.length})
            </h3>
            {mine.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500 px-1">
                None of your own yet —{' '}
                <button onClick={() => setShowScheduleForm(true)} className="font-bold text-primary-600 dark:text-primary-400 hover:underline">
                  schedule one
                </button>{' '}
                to a whole audience or a single tenant.
              </p>
            ) : (
              <div className="space-y-2">{mine.map((msg: any) => renderRow(msg, 'mine'))}</div>
            )}
          </section>

          {/* ── Schedule form (scope + merge fields + preview) ── */}
          {showScheduleForm && (
            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Schedule a message</h3>

              {/* Audience scope */}
              <div>
                <label className="block text-2xs font-bold text-slate-500 uppercase mb-1.5">Audience</label>
                <div className="flex flex-wrap gap-1.5">
                  {([
                    ['custom', 'Pick recipients'],
                    ['building', 'A whole building'],
                    ['all', 'All tenants'],
                    ['overdue', 'Overdue accounts'],
                  ] as Array<[ScopeMode, string]>).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setScopeMode(mode)}
                      className={`px-3 py-1.5 text-2xs font-bold rounded-lg transition-colors ${
                        scopeMode === mode
                          ? 'bg-primary-600 text-white'
                          : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {scopeMode === 'building' && (
                <div>
                  <label className="block text-2xs font-bold text-slate-500 uppercase mb-1">Building</label>
                  <select
                    value={buildingFilter}
                    onChange={(e) => setBuildingFilter(e.target.value)}
                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                  >
                    <option value="">Choose a building…</option>
                    {buildings.map((b) => (
                      <option key={b.short} value={b.short}>{b.full}</option>
                    ))}
                  </select>
                </div>
              )}

              {scopeMode === 'custom' && (
                <div className="space-y-2">
                  <div className="relative">
                    <SearchIcon className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      placeholder="Search tenants, units or buildings…"
                      className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-sm text-slate-900 dark:text-white placeholder-slate-400"
                    />
                  </div>
                  <div className="max-h-44 overflow-y-auto custom-scrollbar rounded-lg border border-slate-200 dark:border-zinc-700 divide-y divide-slate-100 dark:divide-zinc-800">
                    {flatUnits
                      .filter((u: any) => {
                        if (!recipientSearch) return true;
                        const q = recipientSearch.toLowerCase();
                        return (u.tenantName || '').toLowerCase().includes(q)
                          || (u.unitName || '').toLowerCase().includes(q)
                          || (u.address || '').toLowerCase().includes(q);
                      })
                      .slice(0, 60)
                      .map((u: any) => (
                        <button
                          key={u.id}
                          onClick={() => toggleUnit(u.id)}
                          className={`w-full flex items-center gap-2.5 p-2.5 text-left transition-colors ${
                            selectedUnitIds.includes(u.id) ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-zinc-800/60'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                            selectedUnitIds.includes(u.id)
                              ? 'bg-primary-600 border-primary-600 text-white'
                              : 'border-slate-300 dark:border-zinc-600'
                          }`}>
                            {selectedUnitIds.includes(u.id) && (
                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z" /></svg>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">
                              {u.tenantName || '(no name)'} {u.unitName ? `— ${u.unitName}` : ''}
                            </span>
                            <span className="block text-2xs text-slate-400 truncate">{u.address}</span>
                          </span>
                          <span className="text-2xs text-slate-400 flex-shrink-0">
                            {u.tenantEmail ? '✉' : ''}{u.tenantPhone ? (u.tenantEmail ? ' · ' : '') + '☎' : ''}
                          </span>
                        </button>
                      ))}
                  </div>
                  {selectedUnitIds.length === 0 && (
                    <p className="text-2xs text-slate-400">Tap to select recipients — or switch to a building / all-tenants audience.</p>
                  )}
                </div>
              )}

              {/* Recipient summary */}
              <div className="flex items-center justify-between text-2xs">
                <span className="text-slate-500 dark:text-zinc-400">
                  <strong className="text-slate-700 dark:text-zinc-200">{contactable.length}</strong> recipient
                  {contactable.length === 1 ? '' : 's'} with {scheduleForm.channel === 'email' ? 'email' : 'phone'} contact
                  {scopeMode === 'overdue' && recipients.length > 0 && ` · ${recipients.length} overdue account(s) total`}
                </span>
                {recipients.length > 0 && (
                  <button
                    className="font-bold text-primary-600 dark:text-primary-400 hover:underline"
                    onClick={() => setScopeMode(scopeMode === 'all' ? 'custom' : scopeMode)}
                  >
                    {recipients.length > contactable.length
                      ? `${recipients.length - contactable.length} unreachable in this audience`
                      : 'auto-populated from live data'}
                  </button>
                )}
              </div>

              {/* Channel / type / time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-slate-500 uppercase mb-1">Channel</label>
                  <select
                    value={scheduleForm.channel}
                    onChange={(e) => setChannel(e.target.value as 'email' | 'whatsapp')}
                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                  >
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-bold text-slate-500 uppercase mb-1">Message Type</label>
                  <select
                    value={scheduleForm.messageType}
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, messageType: e.target.value }))}
                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                  >
                    {Object.entries(MSG_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-bold text-slate-500 uppercase mb-1">Send At</label>
                  <input
                    type="datetime-local"
                    value={scheduleForm.scheduledFor}
                    onChange={(e) => setScheduleForm((prev) => ({ ...prev, scheduledFor: e.target.value }))}
                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Merge fields toolbar */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-2xs font-bold text-slate-500 uppercase">Message</label>
                  <span className="text-2xs text-slate-400">tags resolve per recipient at send time</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {MERGE_FIELD_TAGS.map(({ tag, label }) => (
                    <button
                      key={tag}
                      onClick={() => insertTag(tag)}
                      className="px-2 py-1 rounded-md bg-slate-100 dark:bg-zinc-800 text-2xs font-mono font-bold text-slate-600 dark:text-zinc-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-400 transition-colors"
                      title={label}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <textarea
                  value={scheduleForm.content}
                  onChange={(e) => setScheduleForm((prev) => ({ ...prev, content: e.target.value }))}
                  placeholder={`Hi ${'{'}tenant_name{'}'}, your rent of ${'{'}amount_due{'}'} for ${'{'}unit_number{'}'} is due on ${'{'}due_date{'}'}…`}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-600 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                />
              </div>

              {/* Live per-recipient preview */}
              {scheduleForm.content.trim() && contactable.length > 0 && (
                <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 p-3">
                  <div className="text-2xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Preview — as {contactable[0].tenantName || contactable[0].email || contactable[0].phone} will see it
                  </div>
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-zinc-300 whitespace-pre-line">
                    {previewContent}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 justify-end pt-1">
                {scheduleProgress && (
                  <span className="text-2xs text-primary-600 dark:text-primary-400 font-bold">{scheduleProgress}</span>
                )}
                <button onClick={() => setShowScheduleForm(false)} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-zinc-400 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
                  Close
                </button>
                <button
                  onClick={handleScheduleMessage}
                  disabled={isScheduling}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                    isScheduling ? 'bg-primary-400 text-white' : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                >
                  <ClockIcon className="w-3.5 h-3.5" />
                  {isScheduling ? 'Scheduling…' : `Schedule for ${contactable.length || '—'}`}
                </button>
              </div>
            </section>
          )}

          {/* ── Recent dispatch history ── */}
          {history.length > 0 && (
            <section>
              <details className="group">
                <summary className="list-none cursor-pointer select-none px-1 mb-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-slate-400 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="text-2xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                      Recent dispatches ({history.length})
                    </span>
                  </div>
                </summary>
                <div className="space-y-1.5">{history.map(historyRow)}</div>
              </details>
            </section>
          )}

          <p className="text-2xs text-slate-400 dark:text-zinc-500 text-center pt-1 pb-2 flex items-center justify-center gap-1">
            <SendIcon className="w-3 h-3" /> Full send history with provider responses lives in the Sent tab
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScheduledTab;
