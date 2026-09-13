/**
 * ScheduledTab — Scheduled messages management.
 *
 * MESSAGES UX FIX (2026-09-14): the tab previously dumped EVERY row from
 * `scheduled_messages` — including payment receipts, late notices and other
 * system-automation traffic that merely PASSES THROUGH the table on its way
 * out (the table doubles as the dispatch queue), plus already-sent history.
 * Users reasonably asked: "I can see payment receipts — why are they
 * scheduled? What do I do with them?"
 *
 * Now the tab answers that question structurally:
 *   1. "Your scheduled messages" — messages a human deliberately scheduled
 *      for a future time (cancel / reschedule decisions live here).
 *   2. "Automation queue" — receipts, reminders and alerts the system
 *      queues automatically when payments or events happen. They send
 *      themselves (usually within minutes) — nothing to do, cancel only if
 *      you want to stop one. Collapsed by default, muted styling.
 *   3. Sent / failed history is NOT shown here — it lives in the Sent tab.
 *
 * The schedule form also gained the missing recipient field: previously it
 * created rows with no resolvable recipient, which the dispatch cron could
 * only fail ("No email address could be resolved").
 */
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../ui/ConfirmDialog';
import { PlusIcon, ClockIcon, TrashIcon, SendIcon } from '../../constants';
import { MSG_TYPE_LABELS } from '../../utils/messageTypes';
import { partitionScheduledMessages, isDueNow } from '../../messaging/sections';

// Bolt icon (not in shared constants) — marks system-automation traffic.
const BoltIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor">
    <path d="M11.983 1.907a.75.75 0 00-1.292-.657l-8.5 9.5A.75.75 0 002.75 12h4.572l-1.305 6.093a.75.75 0 001.292.657l8.5-9.5A.75.75 0 0015.25 8h-4.572l1.305-6.093z" />
  </svg>
);

const CHANNEL_STYLES: Record<string, string> = {
  whatsapp: 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
  email: 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
  sms: 'text-purple-700 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
};

const formatWhen = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `today at ${time}`;
  return `${d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })} · ${time}`;
};

interface ScheduledTabProps {
  firmId: string;
}

export const ScheduledTab: React.FC<ScheduledTabProps> = ({ firmId }) => {
  const { bearerToken } = useAuth();
  const { addToast } = useUI();
  const { currentUser } = useAuth() as any;
  const { confirm, ConfirmDialog } = useConfirm();

  const scheduledMessages = useQuery(api.portals.getScheduledMessagesByFirm, firmId ? { firmId } : 'skip') || [];
  const cancelScheduled = useMutation(api.portals.cancelScheduledMessage);
  const createScheduled = useMutation(api.portals.createScheduledMessage);

  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    channel: 'email' as 'email' | 'whatsapp',
    messageType: 'custom',
    recipient: '',
    content: '',
    scheduledFor: '',
  });

  // ── Classification: human-scheduled vs system automation ────────────────
  const { mine, automationQueue } = useMemo(
    () => partitionScheduledMessages(scheduledMessages as any[]),
    [scheduledMessages]
  );
  const pendingScheduled = mine.length + automationQueue.length;

  const setChannel = (channel: 'email' | 'whatsapp') =>
    setScheduleForm(prev => ({ ...prev, channel }));

  const handleScheduleMessage = async () => {
    const { channel, messageType, recipient, content, scheduledFor } = scheduleForm;
    const trimmedRecipient = recipient.trim();
    if (!content.trim() || !scheduledFor) {
      addToast('Please fill in the message, date and time.', { type: 'error' });
      return;
    }
    if (channel === 'email' && !/^\S+@\S+\.\S+$/.test(trimmedRecipient)) {
      addToast('Enter the recipient\'s email address.', { type: 'error' });
      return;
    }
    if (channel === 'whatsapp' && trimmedRecipient.replace(/\D/g, '').length < 10) {
      addToast('Enter the recipient\'s phone number (with country code, e.g. +234…).', { type: 'error' });
      return;
    }
    if (new Date(scheduledFor).getTime() <= Date.now()) {
      addToast('Pick a future date and time.', { type: 'error' });
      return;
    }
    try {
      await createScheduled({
        firmId,
        channel,
        messageType,
        content: content.trim(),
        scheduledFor: new Date(scheduledFor).getTime(),
        recipientEmail: channel === 'email' ? trimmedRecipient : undefined,
        recipientPhone: channel === 'whatsapp' ? trimmedRecipient : undefined,
        recipientName: trimmedRecipient,
        userEmail: currentUser?.email,
        sessionToken: (bearerToken ?? undefined) || undefined,
      });
      setScheduleForm({ channel: 'email', messageType: 'custom', recipient: '', content: '', scheduledFor: '' });
      setShowScheduleForm(false);
      addToast('Message scheduled.', { type: 'success' });
    } catch (err: any) {
      addToast(err.message || 'Failed to schedule message.', { type: 'error' });
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
      await cancelScheduled({ messageId: msg._id, userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) || undefined });
      addToast('Message stopped.', { type: 'success' });
    } catch (e: any) {
      addToast(e.message || 'Failed to stop message.', { type: 'error' });
    }
  };

  // One row renderer shared by both sections (variant tweaks via props).
  const renderRow = (msg: any, variant: 'mine' | 'automation') => {
    const due = isDueNow(msg);
    return (
      <div
        key={msg._id}
        className={`p-3.5 rounded-xl border transition-colors ${
          variant === 'automation'
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
              {variant === 'mine' ? (
                <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400">
                  {due ? 'Sending soon…' : 'Waiting'}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 rounded text-2xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                  {due ? 'Sending now…' : 'Queued'}
                </span>
              )}
            </div>
            <p className={`text-xs leading-relaxed line-clamp-2 mb-1 ${variant === 'automation' ? 'text-slate-500 dark:text-zinc-500' : 'text-slate-600 dark:text-zinc-400'}`}>
              {msg.content}
            </p>
            <div className="flex items-center gap-2 text-2xs text-slate-400 dark:text-zinc-500 flex-wrap">
              <span className="font-bold">
                {msg.scheduledFor ? (due ? 'Goes out' : 'Goes out') : 'No date set'}
                {msg.scheduledFor ? ` ${formatWhen(msg.scheduledFor)}` : ''}
              </span>
              {(msg.recipientName || msg.recipientEmail || msg.recipientPhone || (msg.tenantIds || []).length > 0) && (
                <span aria-hidden>·</span>
              )}
              <span className="truncate">
                → {msg.recipientName || msg.recipientEmail || msg.recipientPhone || `${(msg.tenantIds || []).length} recipient(s)`}
              </span>
            </div>
          </div>
          <button
            onClick={() => handleCancel(msg)}
            className="p-1.5 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors flex-shrink-0"
            title={variant === 'mine' ? 'Stop this scheduled message' : 'Stop this automatic message'}
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col min-h-0">
      {ConfirmDialog}
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 sm:px-6 py-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Scheduled</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Messages set to go out at a future time — yours first, the system's automatic ones below.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {mine.length > 0 && (
                <span className="px-2.5 py-1 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 text-xs font-bold rounded-full">
                  {mine.length} waiting
                </span>
              )}
              {automationQueue.length > 0 && (
                <span className="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 text-xs font-bold rounded-full">
                  {automationQueue.length} auto
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

          {/* Schedule form — now with the recipient the dispatch cron needs */}
          {showScheduleForm && (
            <div className="mt-2 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, messageType: e.target.value }))}
                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                  >
                    {Object.entries(MSG_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-slate-500 uppercase mb-1">
                    Recipient {scheduleForm.channel === 'email' ? 'email' : 'phone (e.g. +234…)'}
                  </label>
                  <input
                    type={scheduleForm.channel === 'email' ? 'email' : 'tel'}
                    value={scheduleForm.recipient}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, recipient: e.target.value }))}
                    placeholder={scheduleForm.channel === 'email' ? 'name@example.com' : '+234 801 234 5678'}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-600 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-slate-500 uppercase mb-1">Send At</label>
                  <input
                    type="datetime-local"
                    value={scheduleForm.scheduledFor}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, scheduledFor: e.target.value }))}
                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                  />
                </div>
              </div>
              <textarea
                value={scheduleForm.content}
                onChange={(e) => setScheduleForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Message content..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-600 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 resize-none"
              />
              <div className="flex items-center gap-2 justify-end pt-1">
                <button onClick={() => setShowScheduleForm(false)} className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-zinc-400 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
                  Close
                </button>
                <button
                  onClick={handleScheduleMessage}
                  className="px-4 py-1.5 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-1.5"
                >
                  <ClockIcon className="w-3.5 h-3.5" />
                  Schedule
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-950/40">
        <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
          {pendingScheduled === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                <ClockIcon className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
              </div>
              <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">Nothing is scheduled</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 max-w-sm leading-relaxed">
                When you schedule a message — or the system queues a receipt or reminder — it waits here
                until it goes out. Anything already sent shows up in the Sent tab instead.
              </p>
              <button
                onClick={() => setShowScheduleForm(true)}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 transition-colors flex items-center gap-1.5"
              >
                <PlusIcon className="w-3.5 h-3.5" /> Schedule First Message
              </button>
            </div>
          ) : (
            <>
              {/* ── Your scheduled messages ── */}
              {mine.length > 0 && (
                <section>
                  <h3 className="text-2xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-400 mb-2 px-1">
                    Your scheduled messages ({mine.length})
                  </h3>
                  <div className="space-y-2">
                    {mine.map((msg: any) => renderRow(msg, 'mine'))}
                  </div>
                </section>
              )}

              {/* ── Automation queue (system receipts / reminders / alerts) ── */}
              {automationQueue.length > 0 && (
                <section>
                  <details className="group">
                    <summary className="list-none cursor-pointer select-none">
                      <div className="flex items-center gap-2 mb-2 px-1">
                        <svg className="w-3 h-3 text-slate-400 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="text-2xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                          Automation queue ({automationQueue.length})
                        </span>
                        <BoltIcon className="w-3 h-3 text-amber-400" />
                      </div>
                    </summary>
                    <div className="rounded-xl border border-slate-200/70 dark:border-zinc-800 bg-amber-50/50 dark:bg-amber-900/5 p-3 mb-2">
                      <p className="text-xs leading-relaxed text-amber-800/80 dark:text-amber-300/70">
                        <span className="font-bold">Why are receipts here?</span> When a payment is marked
                        received, a lease event fires, or a charge falls due, PracticePro queues the receipt
                        or reminder here and it sends itself within minutes. Nothing for you to do — only
                        stop one if it was sent in error.
                      </p>
                    </div>
                    <div className="space-y-2">
                      {automationQueue.map((msg: any) => renderRow(msg, 'automation'))}
                    </div>
                  </details>
                </section>
              )}

              {mine.length === 0 && automationQueue.length > 0 && (
                <p className="text-xs text-slate-400 dark:text-zinc-500 text-center pt-2">
                  You haven't scheduled any messages of your own yet —{' '}
                  <button onClick={() => setShowScheduleForm(true)} className="font-bold text-primary-600 dark:text-primary-400 hover:underline">
                    schedule one
                  </button>
                  .
                </p>
              )}
            </>
          )}

          <p className="text-2xs text-slate-400 dark:text-zinc-500 text-center pt-1 pb-2 flex items-center justify-center gap-1">
            <SendIcon className="w-3 h-3" /> Delivered and failed sends live in the Sent tab
          </p>
        </div>
      </div>
    </div>
  );
};

export default ScheduledTab;
