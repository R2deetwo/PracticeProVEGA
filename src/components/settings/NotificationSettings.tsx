/**
 * NotificationSettings — Per-firm email notification toggle preferences
 *
 * Displays all notification types grouped by category (Property, Legal, Portal, System).
 * Each type has a toggle that controls whether emails are sent for that event.
 * Types marked `alwaysOn` (system-critical) cannot be toggled off.
 *
 * Data is persisted via the `notification_preferences` Convex table.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';
import {
  BellIcon, MailIcon, ShieldCheckIcon, OfficeBuildingIcon,
  CheckIcon, XIcon, LockClosedIcon,
} from '../../constants';

// ── Category metadata ────────────────────────────────────────────────────
const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  property: {
    label: 'Property / Residents',
    icon: <OfficeBuildingIcon className="w-4 h-4" />,
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
    description: 'Emails sent to residents and property stakeholders',
  },
  legal: {
    label: 'Legal / Clients',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>,
    color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20',
    description: 'Emails sent to clients and legal team members',
  },
  portal: {
    label: 'Portal / Account',
    icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
    description: 'Account and portal access notifications',
  },
  system: {
    label: 'System / Security',
    icon: <ShieldCheckIcon className="w-4 h-4" />,
    color: 'text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800',
    description: 'Critical system emails — always enabled for security',
  },
};

export const NotificationSettings: React.FC = () => {
  const { currentUser } = useAuth();
  const { coreState } = useCoreState();
  const { addToast } = useUI();
  const { isProperty, isLegal, hasPropertyFeatures } = useProduct();
  const { handleUpdateUser } = useDataActions();

  const firmId = coreState?.firmDetails?.id || currentUser?.firmId || '';

  // Fetch notification preferences (merged with defaults)
  const prefsData = useQuery(api.portals.getNotificationPreferences, firmId ? { firmId } : 'skip');
  const updatePrefs = useMutation(api.portals.updateNotificationPreferences);

  // Local state for optimistic updates
  const [localPrefs, setLocalPrefs] = useState<Record<string, { enabled: boolean; alwaysOn: boolean }>>({});
  const [saving, setSaving] = useState<Set<string>>(new Set());

  // Sync server data to local state
  useEffect(() => {
    if (prefsData?.preferences) {
      setLocalPrefs(prefsData.preferences);
    }
  }, [prefsData]);

  // Toggle handler
  const handleToggle = useCallback(async (typeKey: string) => {
    const current = localPrefs[typeKey];
    if (!current || current.alwaysOn) return; // Can't toggle always-on types

    const newEnabled = !current.enabled;
    setLocalPrefs(prev => ({ ...prev, [typeKey]: { ...prev[typeKey], enabled: newEnabled } }));
    setSaving(prev => new Set(prev).add(typeKey));

    try {
      await updatePrefs({ firmId, preferences: { [typeKey]: newEnabled } });
      addToast(`${typeKey.replace(/_/g, ' ')} emails ${newEnabled ? 'enabled' : 'disabled'}.`, { type: 'success' });
    } catch (err: any) {
      // Revert on error
      setLocalPrefs(prev => ({ ...prev, [typeKey]: { ...prev[typeKey], enabled: !newEnabled } }));
      addToast(err.message || 'Failed to update preference.', { type: 'error' });
    } finally {
      setSaving(prev => {
        const next = new Set(prev);
        next.delete(typeKey);
        return next;
      });
    }
  }, [firmId, localPrefs, updatePrefs, addToast]);

  // Group types by category
  const typeDefaults = prefsData?.preferences
    ? Object.entries(prefsData.preferences).reduce((acc, [key, val]) => {
        // We need category info from the backend constant — since the query
        // only returns { enabled, alwaysOn }, we'll categorize from a local mirror.
        return acc;
      }, {} as Record<string, any[]>)
    : {};

  // Use local category mirror (must match NOTIFICATION_TYPE_DEFAULTS in portals.ts)
  const NOTIFICATION_TYPES = useMemo(() => ({
    property: [
      { key: 'notice_board_post', label: 'Notice Board Post', description: 'A new notice is published on the notice board', defaultEnabled: true },
      { key: 'portal_message', label: 'New Portal Message', description: 'Admin sends a message to a resident', defaultEnabled: true },
      { key: 'rent_reminder', label: 'Rent Reminder', description: 'Upcoming or overdue rent reminder', defaultEnabled: true },
      { key: 'late_payment_notice', label: 'Late Payment Notice', description: 'Formal notice of overdue payment', defaultEnabled: true },
      { key: 'payment_receipt', label: 'Payment Receipt', description: 'Confirmation of a received payment', defaultEnabled: true },
      { key: 'service_charge_alert', label: 'Service Charge Alert', description: 'New or updated service charge', defaultEnabled: true },
      { key: 'service_charge_due', label: 'Service Charge Due', description: 'Service charge payment is due', defaultEnabled: true },
      { key: 'maintenance_update', label: 'Maintenance Update', description: 'Status change on a maintenance ticket', defaultEnabled: false },
      { key: 'access_restriction', label: 'Access Restriction', description: 'Property access restriction notice', defaultEnabled: true },
      { key: 'lease_renewal', label: 'Lease Renewal Notice', description: 'Lease renewal reminder or notice', defaultEnabled: true },
      { key: 'penalty_notice', label: 'Penalty Notice', description: 'Late fee or penalty issued', defaultEnabled: true },
      { key: 'default_notice', label: 'Default Notice', description: 'Formal default notice before legal action', defaultEnabled: true },
      { key: 'eviction_notice', label: 'Eviction Notice', description: 'Formal eviction notice', defaultEnabled: true },
    ],
    legal: [
      { key: 'matter_activation', label: 'Matter Activation', description: 'A new matter is activated for a client', defaultEnabled: false },
      { key: 'document_upload', label: 'Document Upload', description: 'New document added to a matter', defaultEnabled: false },
      { key: 'task_assignment', label: 'Task Assignment', description: 'A task is assigned to a team member', defaultEnabled: false },
      { key: 'court_filing', label: 'Court Filing Update', description: 'Update on a court filing', defaultEnabled: false },
      { key: 'deadline_reminder', label: 'Deadline Reminder', description: 'Upcoming filing or statutory deadline', defaultEnabled: true },
    ],
    portal: [
      { key: 'portal_invitation', label: 'Portal Invitation', description: 'Invitation to join the portal', defaultEnabled: true, alwaysOn: true },
      { key: 'password_reset', label: 'Password Reset', description: 'Password reset request', defaultEnabled: true, alwaysOn: true },
      { key: 'portal_access_revoked', label: 'Portal Access Revoked', description: 'Portal access has been revoked', defaultEnabled: true },
      // ── Portal Inbound (admin-facing) ──
      // These notify the PRACTITIONER when a portal user submits something.
      { key: 'portal_new_message', label: 'New Portal Message', description: 'A client or resident sent a new portal message', defaultEnabled: true },
      { key: 'portal_maintenance_ticket', label: 'New Maintenance Ticket', description: 'A resident submitted a new maintenance ticket', defaultEnabled: true },
      { key: 'portal_service_request', label: 'New Service Request', description: 'A client submitted a new service request', defaultEnabled: true },
      { key: 'portal_payment_proof', label: 'Payment Proof Submitted', description: 'A resident uploaded a payment proof for review', defaultEnabled: true },
    ],
    system: [
      { key: 'verification_code', label: 'Verification Code', description: 'Email verification during signup', defaultEnabled: true, alwaysOn: true },
      { key: 'security_breach', label: 'Security Breach', description: 'NDPA breach notification', defaultEnabled: true, alwaysOn: true },
    ],
  }), []);

  // Compute stats
  const totalToggleable = Object.values(NOTIFICATION_TYPES).flat().filter(t => !t.alwaysOn).length;
  const enabledCount = Object.values(NOTIFICATION_TYPES).flat().filter(t => {
    const pref = localPrefs[t.key];
    return pref?.enabled ?? t.defaultEnabled;
  }).length;

  return (
    <div className="space-y-6">
      {/* ── My In-App Notifications ──
          Per-user in-app notification preferences (moved from Profile Settings).
          These control which in-app notifications YOU receive — distinct from
          the firm-wide email notifications below. */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <BellIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">My In-App Notifications</h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Control which in-app notifications you personally receive</p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            { key: 'newMessage', label: 'New Messages', desc: 'Receive a notification for new direct messages or channel mentions.' },
            { key: 'assignedToMatter', label: isProperty ? 'Assigned to a Property' : 'Assigned to a Matter', desc: isProperty ? 'Get notified when an Admin assigns you to a new property.' : 'Get notified when an Admin assigns you to a new matter.' },
            { key: 'taskAssignedToMe', label: 'Task Assigned to Me', desc: 'Get notified when a colleague assigns a task directly to you.' },
            { key: 'newTaskInMyMatter', label: isProperty ? 'New Task in My Property' : 'New Task in My Matter', desc: isProperty ? 'Receive a notification when a new task is created in a property you are assigned to.' : 'Receive a notification when a new task is created in a matter you are part of.' },
            { key: 'eventTaskHalfway', label: 'Halfway Point Reminders', desc: 'Receive a notification when halfway between the start and due date for a task or event.' },
            ...(currentUser?.role === 'Admin' ? [
              { key: 'taskStartedByTeamMember', label: 'Task Started (Admin)', desc: "Get notified when a team member moves a task to 'In Progress'." },
              { key: 'taskCompletedByTeamMember', label: 'Task Completed (Admin)', desc: "Get notified when any user in the firm marks a task as 'Done'." },
            ] : []),
          ].map(({ key, label, desc }) => {
            const isChecked = (currentUser?.notificationSettings as any)?.[key] !== false;
            return (
              <div key={key} className="flex items-center justify-between py-1">
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">{label}</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">{desc}</p>
                </div>
                <button
                  onClick={() => {
                    const current = currentUser?.notificationSettings || {};
                    handleUpdateUser(currentUser.id, { notificationSettings: { ...current, [key]: !isChecked } });
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${isChecked ? 'bg-blue-600' : 'bg-slate-200 dark:bg-zinc-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-900 shadow-sm transition-transform ${isChecked ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Firm Email Notifications ── */}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
            <MailIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Email Notifications</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Control which events trigger email notifications to recipients</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-zinc-400">
            {enabledCount} of {totalToggleable + Object.values(NOTIFICATION_TYPES).flat().filter(t => t.alwaysOn).length} enabled
          </span>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-lg p-3.5">
        <div className="flex items-start gap-2.5">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">How this works</p>
            <p className="text-2xs text-blue-600 dark:text-blue-400 mt-0.5 leading-relaxed">
              When an event occurs (e.g. posting a notice, sending a receipt), the system checks these settings before
              sending an email. Disabling a type means only in-app notifications are delivered — no emails. Types marked
              with a lock icon are always enabled for security and cannot be turned off.
            </p>
          </div>
        </div>
      </div>

      {/* Category sections */}
      {Object.entries(NOTIFICATION_TYPES).map(([category, types]) => {
        const meta = CATEGORY_META[category];
        if (!meta) return null;
        // Hide irrelevant categories based on product.
        // IMPORTANT: use hasPropertyFeatures (not isProperty) so Komplete
        // firms keep their property notification settings. isProperty is
        // only for the assistant name (ARIA vs ALOA).
        if (category === 'property' && !hasPropertyFeatures) return null;
        if (category === 'legal' && !isLegal) return null;

        return (
          <div key={category} className="bg-white dark:bg-zinc-900 rounded-lg border border-slate-200 dark:border-zinc-800 overflow-hidden">
            {/* Category header */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-zinc-800 flex items-center gap-2.5">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${meta.color}`}>
                {meta.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-bold text-slate-800 dark:text-zinc-200">{meta.label}</h3>
                <p className="text-2xs text-slate-500 dark:text-zinc-400">{meta.description}</p>
              </div>
              <span className="text-2xs font-bold text-slate-400 dark:text-zinc-500">
                {types.filter(t => localPrefs[t.key]?.enabled ?? t.defaultEnabled).length}/{types.length} on
              </span>
            </div>

            {/* Type rows */}
            <div className="divide-y divide-slate-50 dark:divide-zinc-800/50">
              {types.map(type => {
                const pref = localPrefs[type.key];
                const isEnabled = pref?.enabled ?? type.defaultEnabled;
                const isAlwaysOn = !!type.alwaysOn;
                const isSaving = saving.has(type.key);

                return (
                  <div
                    key={type.key}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">{type.label}</span>
                        {isAlwaysOn && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-3xs font-bold text-slate-500 dark:text-zinc-400">
                            <LockClosedIcon className="w-2.5 h-2.5" />
                            Always on
                          </span>
                        )}
                        {!isAlwaysOn && !isEnabled && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-3xs font-bold text-slate-400 dark:text-zinc-500">Off</span>
                        )}
                      </div>
                      <p className="text-2xs text-slate-500 dark:text-zinc-500 mt-0.5">{type.description}</p>
                    </div>

                    {/* Toggle switch */}
                    <button
                      onClick={() => !isAlwaysOn && handleToggle(type.key)}
                      disabled={isAlwaysOn || isSaving}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 ${
                        isEnabled
                          ? 'bg-emerald-500 focus:ring-emerald-500/30'
                          : 'bg-slate-200 dark:bg-zinc-700 focus:ring-slate-400/30'
                      } ${isAlwaysOn ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'} ${isSaving ? 'opacity-60' : ''}`}
                      title={isAlwaysOn ? 'This notification type cannot be disabled' : isEnabled ? 'Click to disable' : 'Click to enable'}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-900 shadow-sm transition-transform duration-200 ${
                          isEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Footer note */}
      <div className="flex items-center gap-2 text-2xs text-slate-400 dark:text-zinc-500 px-1">
        <LockClosedIcon className="w-3 h-3" />
        <span>Locked items are always enabled for security and compliance. They cannot be turned off.</span>
      </div>
    </div>
  );
};

export default NotificationSettings;
