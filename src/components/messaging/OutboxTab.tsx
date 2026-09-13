/**
 * OutboxTab — the sent-messages history (the "Sent" tab).
 *
 * MESSAGES OVERHAUL: this is now the ONE send-history for the whole firm
 * (the duplicate Audit Trail tab in Financials → Inbox and the Message
 * Logs feed in Reminder Rules were removed and point here). Every
 * email / WhatsApp / portal / in-app send lands here with its delivery
 * status, the reason for every failure, and the provider's message id.
 *
 * 2026-09-12 (Task 39 / Item 1 — Chakra 402 billing gate): failed rows now
 * show the MAPPED reason (errorClass → friendly text) by default; the raw
 * provider string sits behind an admin-only "Details" toggle. A
 * plan-upgrade failure additionally renders the persistent billing banner
 * with the Chakra upgrade link, and "Retry failed (24h)" re-routes every
 * failed WhatsApp send from the last 24h through the send helper (with its
 * automatic approved-template fallback, which is how the 24-hour window is
 * respected).
 */
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { ChevronDownIcon, MailIcon, TrashIcon } from '../../constants';
import { useConfirm } from '../ui/ConfirmDialog';
import {
  summarizeError,
  mappedErrorClass,
  WHATSAPP_ERROR_CLASS_MESSAGES,
  CHAKRA_WHATSAPP_BILLING_URL,
} from '../../utils/deliveryErrors';
import { MSG_TYPE_LABELS } from '../../utils/messageTypes';
// WHATSAPP MANUAL SHARE (2026-09-14): the API integration is retired —
// whatsapp-channel rows get a one-tap wa.me handoff (message prefilled,
// user hits send in WhatsApp) instead of an undeliverable automated send.
import { whatsappShareUrl } from '../../utils/whatsappShare';

// WhatsApp brand glyph for the share button (not in shared constants).
const WhatsAppGlyph = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

// Archive-box icon (not in shared constants) — the Sent tab's archive action.
const ArchiveBoxIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

// Undo/restore icon for archived rows.
const UndoIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l-4-4 4-4M5 10h11a4 4 0 014 4v1a4 4 0 01-4 4H9" />
  </svg>
);

const CHANNEL_STYLES: Record<string, string> = {
  whatsapp: 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
  email: 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
  portal: 'text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30',
  sms: 'text-purple-700 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
  'in-app': 'text-indigo-700 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30',
};

const STATUS_STYLES: Record<string, { chip: string; dot: string; label: string }> = {
  sent: { chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', dot: 'bg-emerald-500', label: 'Delivered' },
  simulated: { chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', dot: 'bg-amber-500', label: 'Not configured' },
  failed: { chip: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', dot: 'bg-rose-500', label: 'Failed' },
  sending: { chip: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', dot: 'bg-sky-500', label: 'Sending' },
  logged: { chip: 'bg-slate-100 text-slate-700 dark:bg-zinc-700 dark:text-zinc-300', dot: 'bg-slate-400', label: 'Logged' },
};

const CHANNEL_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'email', label: 'Email' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'portal', label: 'Portal' },
  { key: 'in-app', label: 'In-App' },
] as const;

const formatTimestamp = (ts: number) => {
  const d = new Date(ts);
  const date = d.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
};

const timeAgo = (ts: number) => {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatTimestamp(ts);
};

interface OutboxTabProps {
  firmId: string;
}

export const OutboxTab: React.FC<OutboxTabProps> = ({ firmId }) => {
  const { currentUser, bearerToken } = useAuth() as any;
  const { addToast } = useUI();
  const { confirm, ConfirmDialog } = useConfirm();
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Per-row "Details" toggle: reveals the RAW provider error (admin-only
  // surface — this tab is firm-facing; tenants never see provider strings).
  const [showRawIds, setShowRawIds] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState(false);
  const [retrySummary, setRetrySummary] = useState<string | null>(null);
  // Row management (2026-09-14): archive hides a row (restorable), delete
  // removes it permanently. Both are firm-verified on the server.
  const archiveLog = useMutation(api.sentry.archiveAutomationLog);
  const deleteLog = useMutation(api.sentry.deleteAutomationLog);
  // GROUPED operations (2026-09-14): the user asked "why are sent messages
  // not organized in terms of who they are sent to so that instead of
  // having to delete messages one at a time we can delete all messages sent
  // to a particular person at once?" — the list now groups by recipient and
  // these mutations act on a whole group in one call.
  const archiveLogGroup = useMutation(api.sentry.archiveAutomationLogsByRecipient);
  const deleteLogGroup = useMutation(api.sentry.deleteAutomationLogsByRecipient);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [busyRecipient, setBusyRecipient] = useState<string | null>(null);
  // One recipient group expanded at a time (message detail rows keep their
  // own expandedId). All groups collapsed = the tidy default.
  const [expandedRecipient, setExpandedRecipient] = useState<string | null>(null);

  const logs = useQuery(
    api.sentry.getAutomationLogs,
    firmId ? { firmId, limit: 100, userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) } : 'skip'
  ) || [];

  // Firm's WhatsApp gateway health (whatsapp_settings.gatewayBlocked*) —
  // written by the server whenever a send hits the Chakra 402 billing gate,
  // cleared by any successful send. Drives the persistent admin banner.
  const waSettings = useQuery(
    api.whatsappTemplates.getWhatsAppSettings,
    currentUser?.email && bearerToken
      ? { sessionToken: bearerToken, userEmail: currentUser.email }
      : 'skip'
  ) as any;

  const retryFailed = useMutation(api.communications.retryFailedWhatsApp as any);

  const filtered = useMemo(() => {
    const rows = (logs as any[]).filter(l => l.direction !== 'inbound' && !l.isArchived);
    if (channelFilter === 'all') return rows;
    return rows.filter(l => l.channel === channelFilter);
  }, [logs, channelFilter]);

  // ── RECIPIENT GROUPING (2026-09-14) ──────────────────────────────
  // Group the sent rows by recipient so the list reads "who you've messaged"
  // instead of a flat firehose — and so a whole recipient's history can be
  // archived/deleted in one action. Groups sort by most recent activity;
  // rows inside a group sort newest-first.
  const recipientGroups = useMemo(() => {
    const byRecipient = new Map<string, any[]>();
    for (const row of filtered) {
      const key = String(row.recipient || 'Unknown recipient').trim() || 'Unknown recipient';
      const arr = byRecipient.get(key);
      if (arr) arr.push(row);
      else byRecipient.set(key, [row]);
    }
    const groups = Array.from(byRecipient.entries()).map(([recipient, rows]) => ({
      recipient,
      rows: [...rows].sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0)),
      lastAt: Math.max(...rows.map(r => r.sentAt || 0)),
      delivered: rows.filter(r => r.status === 'sent').length,
      failed: rows.filter(r => r.status === 'failed').length,
    }));
    groups.sort((a, b) => b.lastAt - a.lastAt);
    return groups;
  }, [filtered]);

  // Archived rows (restorable) — the audit-friendly alternative to deleting.
  const archived = useMemo(
    () => (logs as any[]).filter(l => l.direction !== 'inbound' && l.isArchived),
    [logs]
  );

  const stats = useMemo(() => {
    const rows = (logs as any[]).filter(l => l.direction !== 'inbound' && !l.isArchived);
    return {
      total: rows.length,
      delivered: rows.filter(l => l.status === 'sent').length,
      failed: rows.filter(l => l.status === 'failed').length,
      failedWhatsApp: rows.filter(l => l.status === 'failed' && l.channel === 'whatsapp').length,
    };
  }, [logs]);

  // Persistent 402 billing banner: the server-written blocked flag (source
  // of truth), OR any visible log classified as the billing gate (covers
  // the window before the flag existed and multi-firm edge cases).
  const blockedClass = waSettings?.gatewayBlockedClass || '';
  const billingBlocked =
    blockedClass === 'plan_upgrade_required' ||
    blockedClass === 'payment_issue' ||
    (logs as any[]).some(
      (l) => l.status === 'failed' && l.channel === 'whatsapp' && mappedErrorClass(l.errorClass, l.errorMessage) === 'plan_upgrade_required'
    );

  const toggleRaw = (id: string) => {
    setShowRawIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRetryFailed = async () => {
    if (retrying) return;
    setRetrying(true);
    setRetrySummary(null);
    try {
      const res: any = await retryFailed({
        firmId,
        userEmail: currentUser?.email,
        sessionToken: bearerToken ?? undefined,
      });
      if (res?.attempted) {
        setRetrySummary(
          `Retried ${res.attempted} failed message(s): ${res.succeeded} delivered, ${res.stillFailed} still failed.` +
            (res.stillFailed > 0 && res.errors?.length ? ` First error: ${summarizeError(res.errors[0], 120)}` : '')
        );
      } else {
        setRetrySummary('No failed WhatsApp messages from the last 24 hours to retry.');
      }
    } catch (e: any) {
      setRetrySummary(`Retry failed: ${summarizeError(e?.message || String(e), 120)}`);
    } finally {
      setRetrying(false);
    }
  };

  // ── Row management: archive / delete / restore ─────────────────────────
  const handleArchive = async (log: any, next: boolean) => {
    if (busyRowId) return;
    setBusyRowId(log._id);
    try {
      await archiveLog({
        logId: log._id,
        archived: next,
        userEmail: currentUser?.email,
        sessionToken: bearerToken ?? undefined,
      });
      if (expandedId === log._id) setExpandedId(null);
      addToast(next ? 'Message archived.' : 'Message restored.', { type: 'success' });
    } catch (e: any) {
      addToast(e?.message || 'Failed. Try again.', { type: 'error' });
    } finally {
      setBusyRowId(null);
    }
  };

  const handleDelete = async (log: any) => {
    const label = (MSG_TYPE_LABELS as Record<string, string>)[log.messageType] || log.messageType;
    const ok = await confirm({
      title: 'Delete this sent message?',
      message: `The ${label} to ${log.recipient || 'this recipient'} will be permanently removed from your send history. Archive it instead if you might need the record.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (!ok) return;
    if (busyRowId) return;
    setBusyRowId(log._id);
    try {
      await deleteLog({
        logId: log._id,
        userEmail: currentUser?.email,
        sessionToken: bearerToken ?? undefined,
      });
      if (expandedId === log._id) setExpandedId(null);
      addToast('Message deleted.', { type: 'success' });
    } catch (e: any) {
      addToast(e?.message || 'Failed. Try again.', { type: 'error' });
    } finally {
      setBusyRowId(null);
    }
  };

  // ── Group management: whole-recipient archive / delete ────────────
  const handleArchiveGroup = async (recipient: string, next: boolean) => {
    if (busyRecipient) return;
    setBusyRecipient(recipient);
    try {
      const res: any = await archiveLogGroup({
        recipient,
        archived: next,
        userEmail: currentUser?.email,
        sessionToken: bearerToken ?? undefined,
      });
      addToast(
        next
          ? `Archived ${res?.updated ?? ''} message${res?.updated === 1 ? '' : 's'} to ${recipient}. Restore them below.`
          : `Restored ${res?.updated ?? ''} message${res?.updated === 1 ? '' : 's'} to ${recipient}.`,
        { type: 'success' }
      );
      if (!next) setExpandedRecipient(recipient);
    } catch (e: any) {
      addToast(e?.message || 'Failed. Try again.', { type: 'error' });
    } finally {
      setBusyRecipient(null);
    }
  };

  const handleDeleteGroup = async (recipient: string, count: number) => {
    const ok = await confirm({
      title: `Delete all ${count} messages to this recipient?`,
      message: `Every message sent to ${recipient} will be permanently removed from your send history. Archive them instead if you might need the records.`,
      confirmLabel: 'Delete all',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (!ok) return;
    if (busyRecipient) return;
    setBusyRecipient(recipient);
    try {
      const res: any = await deleteLogGroup({
        recipient,
        userEmail: currentUser?.email,
        sessionToken: bearerToken ?? undefined,
      });
      if (expandedRecipient === recipient) setExpandedRecipient(null);
      addToast(`Deleted ${res?.deleted ?? count} message${(res?.deleted ?? count) === 1 ? '' : 's'} to ${recipient}.`, { type: 'success' });
    } catch (e: any) {
      addToast(e?.message || 'Failed. Try again.', { type: 'error' });
    } finally {
      setBusyRecipient(null);
    }
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      {ConfirmDialog}
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Sent</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Every message your firm has sent — email, WhatsApp, portal and in-app — with its delivery status and the reason for any failure.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {stats.failedWhatsApp > 0 && (
                <button
                  onClick={handleRetryFailed}
                  disabled={retrying}
                  title="Re-send every failed WhatsApp message from the last 24 hours through the send helper (approved templates used automatically outside the 24-hour window)."
                  className="px-2.5 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs font-bold rounded-full hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors disabled:opacity-50"
                >
                  {retrying ? 'Retrying…' : `Retry failed (24h)`}
                </button>
              )}
              {stats.failed > 0 && (
                <span className="px-2.5 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs font-bold rounded-full">
                  {stats.failed} failed
                </span>
              )}
              <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-full">
                {stats.delivered} delivered
              </span>
            </div>
          </div>

          {/* ── Persistent 402 billing banner (cannot be dismissed — the ──
              gateway is rejecting template sends until the plan is upgraded
              or the migration to direct Meta is done). */}
          {billingBlocked && (
            <div className="mb-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 flex items-start gap-2">
              <span className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5">⚠</span>
              <div className="min-w-0 flex-1 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                <span className="font-bold">WhatsApp plan inactive.</span>{' '}
                {WHATSAPP_ERROR_CLASS_MESSAGES[blockedClass || 'plan_upgrade_required']} Every business-initiated (template) send is being
                rejected by the Chakra billing gate — messages will not deliver until this is resolved.
                <a
                  href={CHAKRA_WHATSAPP_BILLING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 inline-flex items-center gap-0.5 font-bold text-amber-900 dark:text-amber-200 underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-100"
                >
                  Upgrade WhatsApp plan →
                </a>
              </div>
            </div>
          )}

          {retrySummary && (
            <div className="mb-2 p-2.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
              {retrySummary}
            </div>
          )}

          {/* Channel filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {CHANNEL_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setChannelFilter(f.key)}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
                  channelFilter === f.key
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Log list — grouped by recipient (2026-09-14) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-950/40">
        <div className="max-w-4xl mx-auto p-3 sm:p-4">
          {recipientGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                <MailIcon className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600 dark:text-zinc-300">
                {channelFilter === 'all' ? 'No messages sent yet' : `No ${channelFilter === 'in-app' ? 'in-app' : channelFilter} messages sent yet`}
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                Send a message with the New Message button — every send appears here with its delivery status.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recipientGroups.map(group => {
                const isGroupOpen = expandedRecipient === group.recipient;
                const groupBusy = busyRecipient === group.recipient;
                return (
                  <div
                    key={group.recipient}
                    className={`rounded-xl border bg-white dark:bg-zinc-900 overflow-hidden transition-colors ${
                      group.failed > 0
                        ? 'border-rose-200 dark:border-rose-900/40'
                        : 'border-slate-200 dark:border-zinc-800'
                    }`}
                  >
                    {/* ── Group header: recipient + counts + group actions ── */}
                    <div className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors">
                      <button
                        onClick={() => setExpandedRecipient(isGroupOpen ? null : group.recipient)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                        aria-label={isGroupOpen ? 'Collapse messages' : 'Show messages'}
                      >
                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center flex-shrink-0 text-xs font-black">
                          {group.recipient.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-full sm:max-w-[220px]">
                              {group.recipient}
                            </span>
                            <span className="text-2xs font-bold text-slate-400 dark:text-zinc-500">
                              {group.rows.length} message{group.rows.length === 1 ? '' : 's'}
                            </span>
                            {group.delivered > 0 && (
                              <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                {group.delivered} delivered
                              </span>
                            )}
                            {group.failed > 0 && (
                              <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                                {group.failed} failed
                              </span>
                            )}
                          </div>
                          <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-0.5 truncate">
                            Last: {group.rows[0] ? ((MSG_TYPE_LABELS as Record<string, string>)[group.rows[0].messageType] || group.rows[0].messageType) : '—'} · {timeAgo(group.lastAt)}
                          </p>
                        </div>
                        <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isGroupOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {/* Whole-group actions — one tap archives/deletes the
                          ENTIRE history for this recipient. */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* WhatsApp handoff — shares the LATEST message to this
                            recipient (codes/references included). */}
                        {group.rows.some((r: any) => r.channel === 'whatsapp') && (() => {
                          const waRow = group.rows.find((r: any) => r.channel === 'whatsapp' && (r.messageContent || r.messagePreview));
                          if (!waRow) return null;
                          return (
                            <a
                              href={whatsappShareUrl(waRow.recipient, waRow.messageContent || waRow.messagePreview)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1.5 text-2xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                              title={`Open WhatsApp to ${group.recipient} with the latest message prefilled`}
                            >
                              <WhatsAppGlyph className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">WhatsApp</span>
                            </a>
                          );
                        })()}
                        <button
                          onClick={() => handleArchiveGroup(group.recipient, true)}
                          disabled={groupBusy}
                          className="flex items-center gap-1 px-2 py-1.5 text-2xs font-bold text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                          title={`Archive all ${group.rows.length} messages to ${group.recipient} (restorable below)`}
                        >
                          <ArchiveBoxIcon className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Archive all</span>
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(group.recipient, group.rows.length)}
                          disabled={groupBusy}
                          className="flex items-center gap-1 px-2 py-1.5 text-2xs font-bold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors disabled:opacity-50"
                          title={`Delete all ${group.rows.length} messages to ${group.recipient} permanently`}
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Delete all</span>
                        </button>
                      </div>
                    </div>

                    {/* ── Group rows (individual messages) ── */}
                    {isGroupOpen && (
                      <div className="border-t border-slate-100 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800">
                        {group.rows.map((log: any) => {
                const st = STATUS_STYLES[log.status] || STATUS_STYLES.logged;
                const isExpanded = expandedId === log._id;
                const isWhatsApp = log.channel === 'whatsapp';
                // MAPPED reason — never the raw provider string by default.
                const mapped = isWhatsApp && log.status === 'failed'
                  ? (WHATSAPP_ERROR_CLASS_MESSAGES[mappedErrorClass(log.errorClass, log.errorMessage)] || null)
                  : null;
                const showRaw = showRawIds.has(log._id);
                return (
                  <div key={log._id}>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : log._id)}
                      className="w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors"
                    >
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${st.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {(MSG_TYPE_LABELS as Record<string, string>)[log.messageType] || log.messageType}
                          </span>
                          <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-full uppercase ${CHANNEL_STYLES[log.channel] || CHANNEL_STYLES.sms}`}>
                            {log.channel}
                          </span>
                          <span
                            className={`text-2xs font-bold px-1.5 py-0.5 rounded-full ${st.chip}`}
                            title={log.status === 'failed' ? (mapped || summarizeError(log.errorMessage, 200)) : undefined}
                          >
                            {st.label}
                          </span>
                        </div>
                        {log.status === 'failed' && (
                          <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5 truncate">
                            {mapped || summarizeError(log.errorMessage, 120)}
                          </p>
                        )}
                        {!isExpanded && log.messagePreview && (
                          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5 truncate">
                            {log.messagePreview}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-2xs text-slate-400 dark:text-zinc-500 whitespace-nowrap">
                          {log.sentAt ? timeAgo(log.sentAt) : '—'}
                        </span>
                        <ChevronDownIcon className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3 pt-1">
                        <div className="grid grid-cols-2 gap-2 text-2xs text-slate-400 dark:text-zinc-500 mb-2">
                          <span>Sent: {log.sentAt ? formatTimestamp(log.sentAt) : '—'}</span>
                          {log.messageId && <span className="truncate">Provider id: {log.messageId}</span>}
                        </div>
                        {log.status === 'failed' && (
                          <div className="mb-2">
                            <p className="text-xs leading-relaxed text-rose-600 dark:text-rose-400">
                              <span className="font-bold">Reason: </span>
                              {mapped || summarizeError(log.errorMessage, 200)}
                            </p>
                            {log.errorMessage && (
                              <button
                                onClick={() => toggleRaw(log._id)}
                                className="mt-1 text-2xs font-bold text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 underline underline-offset-2"
                              >
                                {showRaw ? 'Hide details' : 'Details'}
                              </button>
                            )}
                            {showRaw && log.errorMessage && (
                              <pre className="mt-1 text-2xs text-slate-500 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-zinc-800/60 rounded-lg p-2 border border-slate-100 dark:border-zinc-700/50 custom-scrollbar">
                                {log.errorMessage}
                              </pre>
                            )}
                          </div>
                        )}
                        {(log.messageContent || log.messagePreview) && (
                          <pre className="text-xs text-slate-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-zinc-800/60 rounded-lg p-3 border border-slate-100 dark:border-zinc-700/50 custom-scrollbar">
                            {log.messageContent || log.messagePreview}
                          </pre>
                        )}

                        {/* ── Row management: share + archive + delete (single message) ── */}
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          {/* WHATSAPP MANUAL SHARE — the integration is retired;
                              wa.me opens WhatsApp with this exact message
                              prefilled to the recipient (codes and references
                              included). */}
                          {log.channel === 'whatsapp' && (log.messageContent || log.messagePreview) && (
                            <a
                              href={whatsappShareUrl(log.recipient, log.messageContent || log.messagePreview)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-2.5 py-1.5 text-2xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                              title="Open WhatsApp with this message prefilled — review and send"
                            >
                              <WhatsAppGlyph className="w-3.5 h-3.5" />
                              Send via WhatsApp
                            </a>
                          )}
                          <button
                            onClick={() => handleArchive(log, true)}
                            disabled={busyRowId === log._id}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-2xs font-bold text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                            title="Hide this message from the Sent list (restorable)"
                          >
                            <ArchiveBoxIcon className="w-3.5 h-3.5" />
                            Archive
                          </button>
                          <button
                            onClick={() => handleDelete(log)}
                            disabled={busyRowId === log._id}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-2xs font-bold text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete this message permanently"
                          >
                            <TrashIcon className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Archived rows (restorable) ── */}
          {archived.length > 0 && (
            <details className="group mt-4">
              <summary className="list-none cursor-pointer select-none">
                <div className="flex items-center gap-2 px-1 pb-1">
                  <svg className="w-3 h-3 text-slate-400 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-2xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                    Archived ({archived.length})
                  </span>
                  <ArchiveBoxIcon className="w-3 h-3 text-slate-400" />
                </div>
              </summary>
              <div className="mt-2 space-y-2">
                {archived.map((log: any) => {
                  const st = STATUS_STYLES[log.status] || STATUS_STYLES.logged;
                  return (
                    <div key={log._id} className="flex items-center justify-between gap-3 p-3 bg-slate-100/60 dark:bg-zinc-800/50 rounded-xl border border-slate-200/60 dark:border-zinc-800 opacity-75">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300 truncate">
                            {(MSG_TYPE_LABELS as Record<string, string>)[log.messageType] || log.messageType}
                          </span>
                          <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-full uppercase ${CHANNEL_STYLES[log.channel] || CHANNEL_STYLES.sms}`}>
                            {log.channel}
                          </span>
                          <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-full ${st.chip}`}>{st.label}</span>
                        </div>
                        <p className="text-2xs text-slate-400 dark:text-zinc-500 truncate">
                          → {log.recipient} · {log.sentAt ? timeAgo(log.sentAt) : '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleArchive(log, false)}
                          disabled={busyRowId === log._id}
                          className="flex items-center gap-1 px-2 py-1.5 text-2xs font-bold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 rounded-lg transition-colors disabled:opacity-50"
                          title="Move back to the Sent list"
                        >
                          <UndoIcon className="w-3.5 h-3.5" />
                          Restore
                        </button>
                        <button
                          onClick={() => handleDelete(log)}
                          disabled={busyRowId === log._id}
                          className="p-1.5 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors disabled:opacity-50"
                          title="Delete permanently"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};
