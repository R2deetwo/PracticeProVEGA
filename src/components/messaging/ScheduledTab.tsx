/**
 * ScheduledTab — Scheduled messages management.
 * Create, view, and cancel scheduled messages across channels.
 */
import React, { useState, useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useUI } from '../../contexts/UIContext';
import { PlusIcon, ClockIcon, TrashIcon } from '../../constants';

const MSG_TYPE_LABELS: Record<string, string> = {
  custom: 'Custom',
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
  whatsapp: 'text-green-500 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
  email: 'text-blue-500 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
  sms: 'text-purple-500 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
};

interface ScheduledTabProps {
  firmId: string;
}

export const ScheduledTab: React.FC<ScheduledTabProps> = ({ firmId }) => {
  const { addToast } = useUI();

  const scheduledMessages = useQuery(api.portals.getScheduledMessagesByFirm, firmId ? { firmId } : 'skip') || [];
  const cancelScheduled = useMutation(api.portals.cancelScheduledMessage);
  const createScheduled = useMutation(api.portals.createScheduledMessage);

  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    channel: 'email' as 'email' | 'whatsapp' | 'sms',
    messageType: 'custom',
    content: '',
    scheduledFor: '',
  });

  const pendingScheduled = useMemo(
    () => (scheduledMessages as any[]).filter((m: any) => m.status === 'pending').length,
    [scheduledMessages]
  );

  const handleScheduleMessage = async () => {
    if (!scheduleForm.content.trim() || !scheduleForm.scheduledFor) {
      addToast('Please fill in all required fields.', { type: 'error' });
      return;
    }
    try {
      await createScheduled({
        firmId,
        channel: scheduleForm.channel,
        messageType: scheduleForm.messageType,
        content: scheduleForm.content.trim(),
        scheduledFor: new Date(scheduleForm.scheduledFor).getTime(),
      });
      setScheduleForm({ channel: 'email', messageType: 'custom', content: '', scheduledFor: '' });
      setShowScheduleForm(false);
      addToast('Message scheduled successfully.', { type: 'success' });
    } catch (err: any) {
      addToast(err.message || 'Failed to schedule message.', { type: 'error' });
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Scheduled Messages</h2>
            <div className="flex items-center gap-2">
              {pendingScheduled > 0 && (
                <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-full">
                  {pendingScheduled} pending
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
                {showScheduleForm ? 'Cancel' : 'Schedule Message'}
              </button>
            </div>
          </div>

          {showScheduleForm && (
            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Channel</label>
                  <select
                    value={scheduleForm.channel}
                    onChange={(e) => setScheduleForm(prev => ({ ...prev, channel: e.target.value as any }))}
                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                  >
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="sms" disabled>SMS (Not Available)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Message Type</label>
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
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Send At</label>
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
                  Cancel
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

      {/* Scheduled List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto p-4 sm:p-6">
          {(scheduledMessages as any[]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                <ClockIcon className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
              </div>
              <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">No scheduled messages</p>
              <p className="text-xs text-slate-400 mt-1">Schedule messages to be sent at a future date and time</p>
              <button
                onClick={() => setShowScheduleForm(true)}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 transition-colors flex items-center gap-1.5"
              >
                <PlusIcon className="w-3.5 h-3.5" /> Schedule First Message
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {(scheduledMessages as any[]).map((msg: any) => (
                <div key={msg._id} className={`p-4 rounded-xl border bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 ${msg.status === 'sent' ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${CHANNEL_STYLES[msg.channel] || 'text-slate-500 bg-slate-100'}`}>
                          {msg.channel}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400">
                          {MSG_TYPE_LABELS[msg.messageType] || msg.messageType}
                        </span>
                        {msg.status === 'pending' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">Pending</span>
                        )}
                        {msg.status === 'sent' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">Sent</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2">{msg.content}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {msg.scheduledFor ? new Date(msg.scheduledFor).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : 'No date set'}
                      </p>
                    </div>
                    {msg.status === 'pending' && (
                      <button
                        onClick={() => cancelScheduled({ messageId: msg._id }).then(() => addToast('Scheduled message cancelled.', { type: 'success' })).catch((e: any) => addToast(e.message || 'Failed to cancel.', { type: 'error' }))}
                        className="p-1.5 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors flex-shrink-0"
                        title="Cancel scheduled message"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduledTab;
