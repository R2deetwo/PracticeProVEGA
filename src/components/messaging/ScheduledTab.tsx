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
import { PlusIcon, ClockIcon, TrashIcon, SendIcon, SearchIcon, UsersIcon } from '../../constants';
import { MSG_TYPE_LABELS } from '../../utils/messageTypes';
import { isDueNow } from '../../messaging/sections';
import { renderMergeFields, hasMergeFields, nextRentDueTs, MERGE_FIELD_TAGS } from '../../utils/mergeFields';
import { AutomationWorkflows } from './AutomationWorkflows';
import { BoltIcon, PauseIcon, PlayIcon, ChevronDownIcon } from './ScheduledTabIcons';
import { SectionErrorBoundary } from '../ui/SectionErrorBoundary';
import {
  SCHEDULE_TEMPLATES,
  templateForType,
  isPristineTemplateText,
  type MessageTemplate,
} from '../../utils/messageTemplates';

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
  // NOTE (2026-09-14 incident): the Upcoming projection query moved into the
  // <UpcomingProjection> child below, wrapped in a SectionErrorBoundary.
  // Reason: the Vercel frontend auto-deploys on push but the Convex backend
  // deploys via the manual promote workflow — when this query ran here and
  // the backend lacked getUpcomingAutomation, the whole Messages page died
  // behind the ROOT error boundary. Isolated + boundary-scoped, a version
  // skew now degrades to one inline card while the rest of the tab works.
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

  /** Pre-populate from the picked template — the listed types ARE the templates
   *  (user spec 2026-09-14): selecting one fills the text residents receive. */
  const applyTemplate = (tpl: MessageTemplate) => {
    setScheduleForm((prev) => ({ ...prev, messageType: tpl.type as typeof prev.messageType, content: tpl.template }));
  };

  /** Open the composer; if it's empty, seed it with the current type's template
   *  so the user immediately SEES what will be sent. */
  const openScheduleForm = () => {
    setShowScheduleForm(true);
    setScheduleForm((prev) => {
      if (prev.content.trim()) return prev;
      const t = templateForType(prev.messageType);
      return t ? { ...prev, content: t.template } : prev;
    });
  };

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

  // ── WHO GETS THIS MESSAGE? (restored 2026-09-14, round 2) ────────────────
  // USER CONTEXT: "I wonder why you got rid of the 'who gets this message?'
  // in the scheduled messages schedules." The fan-out design (one DB row per
  // recipient, manual AND engine) used to render one card per row with a
  // name truncated to ~100px — a 30-resident send buried the queue under 30
  // identical cards and the recipients were near-invisible. Rows sharing the
  // same content + send time + workflow step now collapse into ONE card with
  // an explicit "Who gets this message?" expander listing every recipient.
  const unitLabelFor = (unitId: string | null | undefined): string | null => {
    if (!unitId) return null;
    const u = flatUnits.find((f: any) => String(f.id) === String(unitId));
    if (!u) return null;
    return (u as any).unitName ? `${(u as any).unitName}, ${(u as any).shortAddress || (u as any).address}` : ((u as any).shortAddress || (u as any).address);
  };

  const groupKeyOf = (m: any) => [
    m.channel, m.messageType, m.workflowKey || 'manual', m.stepKey || '',
    String(m.content || ''), Math.round(Number(m.scheduledFor || 0) / 60000),
  ].join('\u00a6');

  const groupRows = (rows: any[]): Array<{ key: string; rows: any[] }> => {
    const map = new Map<string, any[]>();
    for (const r of rows) {
      const k = groupKeyOf(r);
      const bucket = map.get(k);
      if (bucket) bucket.push(r); else map.set(k, [r]);
    }
    return Array.from(map.entries()).map(([key, rs]) => ({ key, rows: rs }));
  };

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // ── Group-card renderer (mobile-first, 2026-09-14 round 2) ──────────────
  // One card per (content + send time + workflow step): identical fan-out
  // rows collapse into ONE card, and every card carries an explicit
  // "Who gets this message?" expander with the full recipient list.
  const handleCancelGroup = async (group: { key: string; rows: any[] }) => {
    const label = MSG_TYPE_LABELS[group.rows[0]?.messageType as keyof typeof MSG_TYPE_LABELS] || 'message';
    const count = group.rows.length;
    const ok = await confirm({
      title: `Stop this ${label}?`,
      message: `It will no longer be sent to ${count} recipient${count === 1 ? '' : 's'}. You can always schedule a new one.`,
      confirmLabel: 'Stop it',
      cancelLabel: 'Leave it',
      danger: true,
    });
    if (!ok) return;
    let stopped = 0, failed = 0;
    for (const row of group.rows) {
      try {
        await cancelScheduled({ messageId: row._id, ...auth });
        stopped++;
      } catch {
        failed++;
      }
    }
    if (stopped > 0 && failed === 0) addToast(`Stopped for ${stopped} recipient${stopped === 1 ? '' : 's'}.`, { type: 'success' });
    else if (stopped > 0) addToast(`Stopped for ${stopped}, failed for ${failed}.`, { type: 'error' });
    else addToast('Failed to stop message.', { type: 'error' });
  };

  const renderGroupCard = (group: { key: string; rows: any[] }, variant: 'mine' | 'automation') => {
    const lead = group.rows[0];
    const count = group.rows.length;
    const multi = count > 1;
    const expanded = expandedGroups.has(group.key);
    const pausedCount = group.rows.filter((r: any) => r.status === 'paused').length;
    const allPaused = pausedCount === count && count > 0;
    const anyDue = group.rows.some((r: any) => isDueNow(r) && r.status === 'scheduled' && r.pauseReason !== 'payment_review');
    const wf = workflowLabel(lead);
    const statusLabel = allPaused
      ? 'On hold'
      : pausedCount > 0 ? `${count - pausedCount} of ${count} held` : (STATUS_LABELS[lead.status] || lead.status);
    const statusCls = pausedCount > 0 ? STATUS_STYLES.paused : (STATUS_STYLES[lead.status] || STATUS_STYLES.scheduled);
    const recipientsSummary = multi
      ? `${count} recipient${count === 1 ? '' : 's'}`
      : recipientLabel(lead);
    const leadPaused = lead.status === 'paused';
    return (
      <div
        key={group.key}
        className={`rounded-xl border transition-colors ${
          allPaused
            ? 'bg-orange-50/70 dark:bg-orange-900/10 border-orange-200 dark:border-orange-900/40'
            : variant === 'automation'
              ? 'bg-slate-50/70 dark:bg-zinc-800/40 border-slate-200/70 dark:border-zinc-800'
              : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800'
        }`}
      >
        <div className="p-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`px-1.5 py-0.5 rounded text-2xs font-bold uppercase ${CHANNEL_STYLES[lead.channel] || 'text-slate-500 bg-slate-100'}`}>
                  {lead.channel}
                </span>
                <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400">
                  {MSG_TYPE_LABELS[lead.messageType as keyof typeof MSG_TYPE_LABELS] || lead.messageType}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-2xs font-bold ${statusCls}`}>{statusLabel}</span>
                {wf && (
                  <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400">
                    {wf}
                  </span>
                )}
                {anyDue && (
                  <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                    due now
                  </span>
                )}
              </div>
              <p className={`text-xs leading-relaxed line-clamp-2 mb-1 ${variant === 'automation' ? 'text-slate-500 dark:text-zinc-500' : 'text-slate-600 dark:text-zinc-400'}`}>
                {lead.content}
              </p>
              <div className="text-2xs text-slate-400 dark:text-zinc-500 font-bold">
                {lead.scheduledFor ? `Goes out ${formatWhen(lead.scheduledFor)}` : 'No date set'}
              </div>
              {lead.pauseReason === 'payment_review' && (
                <p className="text-2xs text-orange-600 dark:text-orange-400 mt-1 leading-relaxed">
                  Held automatically — a payment receipt is awaiting verification. It will resume if the payment is rejected.
                </p>
              )}
            </div>
            {/* Single dispatch: one-tap hold/stop stay in the header. */}
            {!multi && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {leadPaused && (
                  <button
                    onClick={() => handleResume(lead)}
                    className="p-1.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    title="Resume this dispatch"
                  >
                    <PlayIcon className="w-3.5 h-3.5" />
                  </button>
                )}
                {!leadPaused && lead.status === 'scheduled' && (
                  <button
                    onClick={() => handlePause(lead)}
                    className="p-1.5 rounded text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                    title="Hold this dispatch (e.g. the tenant already settled)"
                  >
                    <PauseIcon className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleCancel(lead)}
                  className="p-1.5 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                  title={variant === 'mine' ? 'Stop this scheduled message' : 'Stop this automatic message'}
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* WHO GETS THIS MESSAGE? — the restored, unmissable affordance */}
          <button
            onClick={() => toggleGroup(group.key)}
            className={`mt-2 w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border text-left transition-colors ${
              expanded
                ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-900/40'
                : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 hover:border-primary-300 dark:hover:border-primary-800'
            }`}
            aria-expanded={expanded}
          >
            <UsersIcon className="w-4 h-4 flex-shrink-0 text-primary-600 dark:text-primary-400" />
            <span className="text-xs font-bold text-primary-700 dark:text-primary-300 flex-shrink-0">Who gets this message?</span>
            <span className="text-2xs text-slate-500 dark:text-zinc-400 truncate flex-1 min-w-0 text-right">
              {expanded ? 'hide' : recipientsSummary}
            </span>
            <ChevronDownIcon className={`w-3.5 h-3.5 flex-shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>

          {/* Expanded: the full recipient list, each with its own controls */}
          {expanded && (
            <div className="mt-2 rounded-lg border border-slate-200 dark:border-zinc-700 divide-y divide-slate-100 dark:divide-zinc-800 overflow-hidden">
              {group.rows.map((row: any) => {
                const rPaused = row.status === 'paused';
                const unit = unitLabelFor(row.unitId);
                const contact = row.recipientEmail || row.recipientPhone;
                return (
                  <div key={row._id} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-900/60">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${rPaused ? 'bg-orange-400' : 'bg-emerald-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 truncate">{recipientLabel(row)}</p>
                      <p className="text-2xs text-slate-400 dark:text-zinc-500 truncate">
                        {unit || ''}{unit && contact ? ' · ' : ''}{contact || ''}
                        {rPaused ? ' · on hold' : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {rPaused && (
                        <button
                          onClick={() => handleResume(row)}
                          className="p-1.5 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                          title="Resume this dispatch"
                        >
                          <PlayIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {!rPaused && row.status === 'scheduled' && (
                        <button
                          onClick={() => handlePause(row)}
                          className="p-1.5 rounded text-slate-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
                          title="Hold this dispatch (e.g. the tenant already settled)"
                        >
                          <PauseIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleCancel(row)}
                        className="p-1.5 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                        title="Stop this scheduled message"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {multi && (
                <button
                  onClick={() => handleCancelGroup(group)}
                  className="w-full px-3 py-2.5 text-2xs font-bold text-rose-600 dark:text-rose-400 bg-white dark:bg-zinc-900/60 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-colors text-left"
                >
                  Stop all {count} dispatches
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // History groups by the same key — a 30-recipient send is ONE line with
  // an expandable recipient list, not 30 identical rows.
  const historyGroupRow = (group: { key: string; rows: any[] }) => {
    const lead = group.rows[0];
    const count = group.rows.length;
    const expanded = expandedGroups.has(group.key);
    const okCount = group.rows.filter((r: any) => r.status === 'sent').length;
    return (
      <div key={group.key} className="p-2.5 rounded-lg border border-slate-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
        <button onClick={() => toggleGroup(group.key)} className="w-full flex items-center gap-2 flex-wrap text-left">
          <span className={`px-1.5 py-0.5 rounded text-2xs font-bold ${STATUS_STYLES[lead.status] || ''}`}>
            {count > 1 ? `${okCount}/${count} sent` : (STATUS_LABELS[lead.status] || lead.status)}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-2xs font-bold uppercase ${CHANNEL_STYLES[lead.channel] || ''}`}>{lead.channel}</span>
          <span className="text-2xs text-slate-400 truncate flex-1 min-w-0">{lead.content?.slice(0, 90)}{(lead.content?.length || 0) > 90 ? '…' : ''}</span>
          <span className="text-2xs text-slate-400 truncate max-w-[10rem]">
            {count > 1 ? `${count} recipients` : `→ ${recipientLabel(lead)}`}
          </span>
          <span className="text-2xs text-slate-400 flex-shrink-0">{lead.sentAt ? formatWhen(lead.sentAt) : ''}</span>
          <ChevronDownIcon className={`w-3 h-3 text-slate-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`} />
        </button>
        {expanded && (
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap gap-1.5">
            {group.rows.map((row: any) => (
              <span
                key={row._id}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-2xs font-semibold max-w-full ${
                  row.status === 'sent'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                    : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
                }`}
                title={row.failureReason || undefined}
              >
                <span className="truncate max-w-[12rem]">{recipientLabel(row)}</span>
                {row.status !== 'sent' && <span className="font-bold">· {STATUS_LABELS[row.status] || row.status}</span>}
              </span>
            ))}
          </div>
        )}
        {lead.failureReason && !expanded && (
          <p className="text-2xs text-rose-500 dark:text-rose-400 mt-1 truncate">{lead.failureReason}</p>
        )}
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      {ConfirmDialog}
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between gap-2 mb-1 flex-wrap">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Scheduled & Automation</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400 hidden sm:block">
                The engine room — every automated reminder is orchestrated and dispatched from here.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto sm:justify-end">
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
                onClick={() => {
                  if (showScheduleForm) {
                    setShowScheduleForm(false);
                  } else {
                    openScheduleForm();
                  }
                }}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg shadow-sm transition-all ${
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
              <span className="text-2xs text-slate-400 dark:text-zinc-500 font-medium hidden sm:inline">
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
              <div className="space-y-2">{groupRows(automationQueue).map((g) => renderGroupCard(g, 'automation'))}</div>
            )}
          </section>

          {/* ── 2b. Upcoming — the 14-day automation projection ── */}
          {/* Isolated child + SectionErrorBoundary: if the backend doesn't
              have the projection query yet (version skew), this section
              degrades to an inline card instead of killing the tab. */}
          <UpcomingProjection firmId={firmId} auth={auth} />

          {/* ── 3. Your scheduled messages ── */}
          <section>
            <h3 className="text-2xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400 mb-2 px-1">
              Your scheduled messages ({mine.length})
              <span className="normal-case font-medium tracking-normal text-slate-400 dark:text-zinc-500 hidden sm:inline">
                — your own sends, one card per message with its recipients
              </span>
            </h3>
            {mine.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-zinc-500 px-1">
                None of your own yet —{' '}
                <button onClick={openScheduleForm} className="font-bold text-primary-600 dark:text-primary-400 hover:underline">
                  schedule one
                </button>{' '}
                to a whole audience or a single tenant.
              </p>
            ) : (
              <div className="space-y-2">{groupRows(mine).map((g) => renderGroupCard(g, 'mine'))}</div>
            )}
          </section>

          {/* ── Schedule form (scope + merge fields + preview) ── */}
          {showScheduleForm && (
            <section className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Schedule a message</h3>

              {/* Message template — the listed types pre-populate the text */}
              <div>
                <label className="block text-2xs font-bold text-slate-500 uppercase mb-1.5">Message template</label>
                <div className="flex flex-wrap gap-1.5">
                  {SCHEDULE_TEMPLATES.map((tpl) => {
                    const active = scheduleForm.messageType === tpl.type
                      && (tpl.template.trim() === scheduleForm.content.trim() || (tpl.key === 'blank' && !scheduleForm.content.trim()));
                    return (
                      <button
                        key={tpl.key}
                        onClick={() => applyTemplate(tpl)}
                        className={`px-3 py-1.5 text-2xs font-bold rounded-lg transition-colors ${
                          active
                            ? 'bg-primary-600 text-white'
                            : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                        }`}
                        title={tpl.description}
                      >
                        {tpl.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-1.5">
                  {SCHEDULE_TEMPLATES.find((t) => t.type === scheduleForm.messageType && t.key !== 'blank')?.description
                    || 'Write your own message — tags below fill in per recipient.'}
                </p>
              </div>

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
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setScheduleForm((prev) => {
                        // Auto-swap the template text unless the user customized it —
                        // picking "Late payment notice" fills the notice text.
                        const tpl = templateForType(nextType);
                        const swap = tpl && isPristineTemplateText(prev.content);
                        return { ...prev, messageType: nextType, content: swap ? (tpl as MessageTemplate).template : prev.content };
                      });
                    }}
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
                <div className="space-y-1.5">{groupRows(history).map(historyGroupRow)}</div>
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

// ─────────────────────────────────────────────────────────────────────────────
// UpcomingProjection — the 14-day "what will the engine send" projection.
//
// Extracted from the ScheduledTab body (2026-09-14 incident) so its
// getUpcomingAutomation query is the ONLY thing that can fail here. The
// SectionErrorBoundary turns a backend version skew ("Could not find
// public function") into a compact inline card; workflows, the live
// queue and your scheduled messages keep rendering above it.
// ─────────────────────────────────────────────────────────────────────────────
interface UpcomingProjectionProps {
  firmId: string;
  auth: { userEmail?: string; sessionToken?: string };
}

const UpcomingProjection: React.FC<UpcomingProjectionProps> = ({ firmId, auth }) => {
  // UPCOMING PROJECTION (2026-09-14): the user expected to see planned
  // automation BEFORE it sends ("see upcoming messages like queued
  // messages"). The Live Queue only holds each morning's batch for ~30
  // minutes (engine enqueues 07:30 WAT → dispatches 08:00), so this query
  // projects the next 14 days from the workflow configs + live anchors.
  // It is a PLAN, not a promise — the nightly engine re-checks paid/
  // paused/opt-out gates at enqueue time, so rows here can still drop out.
  const upcoming = useQuery(
    api.automationEngine.getUpcomingAutomation,
    firmId && auth.userEmail ? { firmId, days: 14, ...auth } : 'skip'
  );
  const [upcomingExpanded, setUpcomingExpanded] = useState(true);

  return (
    <SectionErrorBoundary sectionName="Upcoming automation">
      <section>
        <div className="flex items-center gap-2 mb-2 px-1">
          <BoltIcon className="w-3.5 h-3.5 text-cyan-500" />
          <button
            onClick={() => setUpcomingExpanded((v) => !v)}
            className="flex items-center gap-2 text-2xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 transition-colors"
          >
            Upcoming (next 14 days){upcoming?.rows ? ` — ${upcoming.rows.length} planned` : ''}
            <ChevronDownIcon className={`w-3 h-3 transition-transform ${upcomingExpanded ? 'rotate-180' : ''}`} />
          </button>
          <span className="text-2xs text-slate-400 dark:text-zinc-500 font-medium hidden sm:inline">
            — what the engine is lined up to send; plans, not promises
          </span>
        </div>
        {upcomingExpanded && (
          <>
            <p className="text-2xs text-slate-400 dark:text-zinc-500 mb-2 px-1 leading-relaxed">
              Projected from your workflow steps and each unit's current dates. The engine re-checks
              everything the morning it sends — residents who pay, upload receipts, or opt out drop out
              of this list automatically.
              {(upcoming as any)?.truncated && ' Showing the first 300 planned sends.'}
            </p>
            {!upcoming || upcoming.rows.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 text-xs text-slate-400 dark:text-zinc-500 leading-relaxed">
                No automated messages planned for the next two weeks. Enable a workflow above and this
                projection fills in as anchors (rent due dates, charge cycles, lease expiries) approach.
              </div>
            ) : (
              <div className="space-y-1.5">
                {Object.entries(
                  upcoming.rows.reduce<Record<string, any[]>>((acc, r: any) => {
                    const dayKey = new Date(r.triggerAt).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' });
                    (acc[dayKey] = acc[dayKey] || []).push(r);
                    return acc;
                  }, {})
                ).map(([day, rows]) => (
                  <div key={day} className="p-2.5 rounded-lg border border-slate-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-2xs font-bold text-slate-600 dark:text-zinc-300">{day}</span>
                      <span className="text-2xs text-slate-400">· {rows.length} planned</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {rows.map((r: any, i: number) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-2xs font-semibold bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-400 max-w-full"
                          title={`${(WORKFLOW_LABELS[r.workflowKey] || r.workflowKey)} · ${r.stepTitle}${r.tenantName ? ` · ${r.tenantName}` : ''}${r.unitLabel ? ` (${r.unitLabel}, ${r.propertyName})` : ''} · via ${r.channel}`}
                        >
                          <BoltIcon className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="truncate max-w-[14rem]">
                            {r.stepTitle} · {r.tenantName || 'resident'}{r.unitLabel ? ` (${r.unitLabel})` : ''}
                          </span>
                          {r.paidThisPeriod && (
                            <span className="font-bold text-emerald-600 dark:text-emerald-400" title="Paid this period — the engine will suppress this send">· paid</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </SectionErrorBoundary>
  );
};
