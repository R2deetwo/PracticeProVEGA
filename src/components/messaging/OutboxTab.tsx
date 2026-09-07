/**
 * OutboxTab — the sent-messages history ("Sent" folder).
 *
 * WHY THIS EXISTS (user feedback 2026-09-08): "where do I see the record
 * of mails sent?" — there was NO answer anywhere in the app. The
 * automation log (every email / WhatsApp / portal / in-app send, with
 * status and failure reason) was only reachable via Financials → Inbox
 * on the Atrium side, invisible from the Messages screen where users
 * actually compose. This tab puts the full delivery history — success,
 * failure, and the reason for every failure — one click away from the
 * Compose button that creates it.
 */
import React, { useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronDownIcon, MailIcon } from '../../constants';
import { summarizeError } from '../../utils/deliveryErrors';

const MSG_TYPE_LABELS: Record<string, string> = {
  custom: 'Custom Message',
  rent_reminder: 'Rent Reminder',
  late_notice: 'Late Notice',
  payment_receipt: 'Payment Receipt',
  service_charge_alert: 'Service Charge',
  access_restriction: 'Access Restriction',
  penalty_notice: 'Penalty Notice',
  lease_renewal: 'Lease Renewal',
  welcome_note: 'Welcome Note',
  promotion: 'Promotion',
  vendor_update: 'Vendor Update',
  general_announcement: 'Announcement',
  maintenance_update: 'Maintenance',
};

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
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const logs = useQuery(
    api.sentry.getAutomationLogs,
    firmId ? { firmId, limit: 100, userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) } : 'skip'
  ) || [];

  const filtered = useMemo(() => {
    const rows = (logs as any[]).filter(l => l.direction !== 'inbound');
    if (channelFilter === 'all') return rows;
    return rows.filter(l => l.channel === channelFilter);
  }, [logs, channelFilter]);

  const stats = useMemo(() => {
    const rows = (logs as any[]).filter(l => l.direction !== 'inbound');
    return {
      total: rows.length,
      delivered: rows.filter(l => l.status === 'sent').length,
      failed: rows.filter(l => l.status === 'failed').length,
    };
  }, [logs]);

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Outbox</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Every message this firm has sent — email, WhatsApp, portal and in-app — with its delivery status.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
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

      {/* Log list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-950/40">
        <div className="max-w-3xl mx-auto p-3 sm:p-4">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
                <MailIcon className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600 dark:text-zinc-300">
                {channelFilter === 'all' ? 'No messages sent yet' : `No ${channelFilter === 'in-app' ? 'in-app' : channelFilter} messages sent yet`}
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1">
                Compose a message with the Compose button — every send appears here with its delivery status.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((log: any) => {
                const st = STATUS_STYLES[log.status] || STATUS_STYLES.logged;
                const isExpanded = expandedId === log._id;
                return (
                  <div
                    key={log._id}
                    className={`rounded-xl border bg-white dark:bg-zinc-900 overflow-hidden transition-colors ${
                      log.status === 'failed'
                        ? 'border-rose-200 dark:border-rose-900/40'
                        : 'border-slate-200 dark:border-zinc-800'
                    }`}
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : log._id)}
                      className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors"
                    >
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${st.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {MSG_TYPE_LABELS[log.messageType] || log.messageType}
                          </span>
                          <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-full uppercase ${CHANNEL_STYLES[log.channel] || CHANNEL_STYLES.sms}`}>
                            {log.channel}
                          </span>
                          <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-full ${st.chip}`}>
                            {st.label}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
                          → {log.recipient}
                          {log.senderName ? ` · by ${log.senderName}` : ''}
                        </p>
                        {/* Failure reason — the thing users could never see before */}
                        {log.status === 'failed' && log.errorMessage && (
                          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 truncate">
                            {summarizeError(log.errorMessage, 120)}
                          </p>
                        )}
                        {!isExpanded && log.messagePreview && (
                          <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 truncate">
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
                      <div className="px-4 pb-3 pt-1 border-t border-slate-100 dark:border-zinc-800">
                        <div className="grid grid-cols-2 gap-2 text-2xs text-slate-400 dark:text-zinc-500 mb-2">
                          <span>Sent: {log.sentAt ? formatTimestamp(log.sentAt) : '—'}</span>
                          {log.messageId && <span className="truncate">Provider id: {log.messageId}</span>}
                        </div>
                        {log.errorMessage && (
                          <p className={`text-xs leading-relaxed mb-2 ${log.status === 'failed' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-zinc-400'}`}>
                            {log.errorMessage}
                          </p>
                        )}
                        {(log.messageContent || log.messagePreview) && (
                          <pre className="text-xs text-slate-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-zinc-800/60 rounded-lg p-3 border border-slate-100 dark:border-zinc-700/50 custom-scrollbar">
                            {log.messageContent || log.messagePreview}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
