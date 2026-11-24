interface NotificationTypeMeta {
    key: string;
    label: string;
    description: string;
    defaultEnabled: boolean;
    alwaysOn?: boolean;
}

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
import { useQuery, useMutation, useAction } from 'convex/react';
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
import { Capacitor } from '@capacitor/core';
// REMINDERS & NOTIFICATION CENTER (owner direction 2026-11-22): device
// notification opt-in + reminder category toggles + reminder behaviour.
import {
  webNotificationPermission, requestWebNotificationPermission,
} from '../../utils/reminderEngine';
import { registerForNotifications } from '../../utils/notifications';
// Banner preview cycler (owner brief 2026-11-25) — admin-only internal
// preview control + the pure pub/sub module it drives.
import {
    BANNER_TEST_PRESETS,
    pushTestBanner,
    clearTestBanners,
    getTestBanners,
    subscribeTestBanners,
} from '../../utils/bannerTestCycler';
// ui/ primitives (ADR-0004) — new raw form elements are banned; the
// pref switches below are deduped into one PrefSwitch component (a single
// switch control per file instead of one per row).
import { Button, Select } from '../ui';

// ── PrefSwitch — one shared switch control for every notification toggle ──
// (ADR-0004 ratchet: previously each toggle row hand-rolled its own switch
// markup; the whole file now owns exactly ONE switch element.)
// ACCENT STANDARDIZATION (owner brief 2026-11-25): the switch fills with the
// skin-scoped primary accent (Brand Blue on Vega/Komplete, Atrium's emerald
// on Atrium) for every general toggle; the Property / Residents category is
// the one exception and pins Atrium green via tone="emerald".
const PrefSwitch: React.FC<{ checked: boolean; onToggle: () => void; label: string; tone?: 'primary' | 'emerald' | 'blue' }> = ({ checked, onToggle, label, tone = 'primary' }) => (
  <button
    onClick={onToggle}
    role="switch"
    aria-checked={checked}
    aria-label={label}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${checked ? (tone === 'emerald' ? 'bg-emerald-500' : 'bg-primary-600') : 'bg-slate-200 dark:bg-zinc-600'}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-900 shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

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
    color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
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
    color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20',
    description: 'Critical system emails — always enabled for security',
  },
};

export const NotificationSettings: React.FC = () => {
  const { currentUser, bearerToken } = useAuth();
  const { coreState } = useCoreState();
  const { addToast } = useUI();
  const { isProperty, isLegal, hasPropertyFeatures } = useProduct();
  const { handleUpdateUser } = useDataActions();

  const firmId = coreState?.firmDetails?.id || currentUser?.firmId || '';

  // DEMO SESSION GUARD (2026-11-22): getNotificationPreferences is
  // session-authed server-side; DEV demo sessions carry no bearer, so the
  // query throws Unauthenticated and trips the error boundary ("Something
  // went wrong" for demo users opening this tab). Skip it for demo — the
  // tab renders with defaults (same pattern as the Header's app-notification
  // queries).
  const isDemoSession = currentUser?.email === 'demo@practicepro.ng';

  // Fetch notification preferences (merged with defaults)
  const prefsData = useQuery(api.portals.getNotificationPreferences, firmId && !isDemoSession ? { firmId, sessionToken: (bearerToken ?? undefined) || undefined } : 'skip');
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
      await updatePrefs({ firmId, preferences: { [typeKey]: newEnabled }, userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) || undefined });
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
  const NOTIFICATION_TYPES = useMemo<Record<string, NotificationTypeMeta[]>>(() => ({
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
      {/* ── Reminders & Device Notifications ──
          Owner direction 2026-11-22: a clean preferences home for the new
          reminder engine + Notification Center. Category toggles gate what
          the engine fires; the device block covers native (APK) permission
          and web Notification API opt-in. Kept compact — one card, no
          clutter on core screens. */}
      <RemindersAndDeviceCard />

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
                <PrefSwitch
                  checked={isChecked}
                  label={label}
                  onToggle={() => {
                    if (!currentUser) return;
                    const current = currentUser?.notificationSettings || {};
                    handleUpdateUser(currentUser.id, { notificationSettings: { ...current, [key]: !isChecked } });
                  }}
                />
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

                    {/* Toggle switch — skin-scoped primary accent for general
                        categories; Atrium green strictly for the Property /
                        Residents domain (owner brief 2026-11-25). */}
                    <button
                      onClick={() => !isAlwaysOn && handleToggle(type.key)}
                      disabled={isAlwaysOn || isSaving}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 ${
                        isEnabled
                          ? (category === 'property'
                              ? 'bg-emerald-500 focus:ring-emerald-500/30'
                              : 'bg-primary-600 focus:ring-primary-500/30')
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

      {/* ─── Test Push Notification ─────────────────────────────────── */}
      {/* Allows the user to verify their device is properly registered for
          FCM push notifications. Sends a test payload to their registered
          device tokens. Only visible on native platforms (APK). */}
      <div className="mt-6 p-4 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm font-bold text-slate-800 dark:text-zinc-200">Test Push Notification</p>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Send a test notification to verify your device is registered for push alerts.
            </p>
          </div>
          <TestPushButton />
        </div>
      </div>

      {/* ─── Banner Preview Cycler (admin-only internal tool) ───────── */}
      <BannerPreviewCycler />
    </div>
  );
};

// ─── Reminders & Device Notifications card ─────────────────────────────────
const RemindersAndDeviceCard: React.FC = () => {
  const { currentUser } = useAuth();
  const { handleUpdateUser } = useDataActions();
  const { addToast } = useUI();
  const [deviceStatus, setDeviceStatus] = useState<'checking' | 'granted' | 'default' | 'denied' | 'unsupported'>(() => {
    if (Capacitor.isNativePlatform()) return 'checking';
    return (webNotificationPermission() as any) || 'unsupported';
  });
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    import('@capacitor/local-notifications').then(async ({ LocalNotifications }) => {
      try {
        const status = await LocalNotifications.checkPermissions();
        setDeviceStatus(status.display === 'granted' ? 'granted' : status.display === 'denied' ? 'denied' : 'default');
      } catch {
        setDeviceStatus('default');
      }
    }).catch(() => setDeviceStatus('default'));
  }, []);

  const handleEnableDevice = async () => {
    setEnabling(true);
    try {
      let ok = false;
      if (Capacitor.isNativePlatform()) {
        ok = await registerForNotifications();
      } else {
        ok = await requestWebNotificationPermission();
      }
      setDeviceStatus(ok ? 'granted' : (Capacitor.isNativePlatform() ? 'denied' : webNotificationPermission() as any));
      addToast(
        ok
          ? 'Device notifications enabled.'
          : 'Permission was not granted. You can enable notifications in your device/browser settings.',
        { type: ok ? 'success' : 'info', duration: 6000 }
      );
    } finally {
      setEnabling(false);
    }
  };

  const prefs = currentUser?.notificationSettings || {};
  const setUserPref = (patch: Record<string, any>) => {
    if (!currentUser) return;
    handleUpdateUser(currentUser.id, { notificationSettings: { ...currentUser.notificationSettings, ...patch } });
  };

  const categoryToggles: { key: string; label: string; desc: string }[] = [
    { key: 'reminderEvents', label: 'Reminders & Deadlines', desc: 'Event reminders, court/hearing dates, inspections and scheduled events.' },
    { key: 'reminderDraftsAI', label: 'AI Drafts & Analysis', desc: 'DraftPro/Vox completed drafts and document analysis results needing review.' },
    { key: 'reminderMatterUpdates', label: 'Matters & Tasks', desc: 'Matter/record status updates, assigned tasks, overdue items and escalations.' },
    { key: 'reminderPayments', label: 'Payments & Billing', desc: 'Payments, wallet updates, receipts and billing/subscription alerts.' },
    { key: 'reminderMessages', label: 'Messages', desc: 'Relevant messages and connected messaging updates.' },
  ];

  const leadOptions: { value: number; unit: 'minutes' | 'hours' | 'days'; label: string }[] = [
    { value: 10, unit: 'minutes', label: '10 minutes before' },
    { value: 30, unit: 'minutes', label: '30 minutes before' },
    { value: 60, unit: 'minutes', label: '1 hour before' },
    { value: 120, unit: 'minutes', label: '2 hours before' },
    { value: 1, unit: 'days', label: '1 day before' },
  ];
  const leadValue = `${prefs.defaultReminderLead ?? 30}|${prefs.defaultReminderLeadUnit ?? 'minutes'}`;
  const snoozeOptions = [10, 30, 60];
  const snoozeValue = prefs.defaultSnoozeMinutes ?? 10;

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Reminders & Device Notifications</h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400">What the Notification Center reminds you about, and how reminders reach you</p>
        </div>
      </div>

      {/* Device notifications */}
      <div className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-100 dark:border-zinc-700/60">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">Device notifications</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500">
            {deviceStatus === 'granted' && 'Enabled — reminders and alerts reach your notification shade / desktop.'}
            {deviceStatus === 'default' && 'Not enabled yet — turn on to get reminders outside the app.'}
            {deviceStatus === 'denied' && 'Blocked — allow notifications for this app in your device/browser settings.'}
            {deviceStatus === 'unsupported' && 'Your browser does not support desktop notifications; in-app notifications still work.'}
            {deviceStatus === 'checking' && 'Checking permission…'}
          </p>
        </div>
        {deviceStatus === 'granted' ? (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-2xs font-bold flex-shrink-0">
            <CheckIcon className="w-3 h-3" /> On
          </span>
        ) : (
          <Button
            variant="bare"
            onClick={handleEnableDevice}
            disabled={enabling || deviceStatus === 'unsupported'}
            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex-shrink-0"
          >
            {enabling ? 'Enabling…' : 'Enable'}
          </Button>
        )}
      </div>

      {/* Category toggles */}
      <div className="pt-3">
        <p className="text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-2">Notify me about</p>
        <div className="space-y-2.5">
          {categoryToggles.map(({ key, label, desc }) => {
            const isChecked = (prefs as any)[key] !== false;
            return (
              <div key={key} className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">{label}</p>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">{desc}</p>
                </div>
                <PrefSwitch
                  checked={isChecked}
                  label={label}
                  onToggle={() => setUserPref({ [key]: !isChecked })}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Reminder behaviour */}
      <div className="pt-4 mt-4 border-t border-slate-100 dark:border-zinc-700/60 grid sm:grid-cols-2 gap-4">
        <div>
          <Select
            id="defaultReminderLead"
            styleVariant="settings"
            label="Default reminder lead time"
            labelClassName="text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5"
            value={leadValue}
            onChange={(e) => {
              const [value, unit] = e.target.value.split('|');
              setUserPref({ defaultReminderLead: parseInt(value, 10), defaultReminderLeadUnit: unit as any });
            }}
          >
            {leadOptions.map(o => (
              <option key={o.label} value={`${o.value}|${o.unit}`}>{o.label}</option>
            ))}
          </Select>
          <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-1">Used when you create a new event with notifications on.</p>
        </div>
        <div>
          <Select
            id="defaultSnoozeMinutes"
            styleVariant="settings"
            label="Snooze duration"
            labelClassName="text-2xs font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5"
            value={snoozeValue}
            onChange={(e) => setUserPref({ defaultSnoozeMinutes: parseInt(e.target.value, 10) })}
          >
            {snoozeOptions.map(m => (
              <option key={m} value={m}>{m === 60 ? '1 hour' : `${m} minutes`}</option>
            ))}
          </Select>
          <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-1">The Snooze quick action on a reminder notification.</p>
        </div>
      </div>
    </div>
  );
};

// ─── Banner Preview Cycler (admin-only internal tool) ──────────────────────
// Owner brief 2026-11-25: a clean internal preview control that cycles and
// triggers TEST banner notifications (Founder Announcement, System/Platform
// Notice, Urgent Compliance/Billing Alert) so spacing, dismissal behaviour
// and styling can be inspected on the REAL Dashboard banner surface, on
// desktop and mobile viewports. Injected rows are client-side only (never
// Convex), session-dismissable, and capped at 3.
const BannerPreviewCycler: React.FC = () => {
  const { currentUser } = useAuth();
  const { navigateTo } = useUI();
  const [rows, setRows] = useState(getTestBanners());

  useEffect(() => subscribeTestBanners(next => setRows(next)), []);

  // Internal/admin tool — never surfaced to regular members.
  if (currentUser?.role !== 'Admin') return null;

  const hasActive = rows.length > 0;

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h14a1 1 0 011 1v10a1 1 0 01-1 1H7.414a2 2 0 00-1.414.586l-3 3V4z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">Banner Preview <span className="text-2xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">(internal)</span></h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400">Trigger test banners to inspect styling, spacing and dismissal on your Dashboard.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {BANNER_TEST_PRESETS.map(preset => (
          <Button
            key={preset.id}
            variant="bare"
            onClick={() => pushTestBanner(preset.id)}
            className="px-3 py-1.5 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-200 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-600 transition-colors"
          >
            {preset.buttonLabel}
          </Button>
        ))}
        {hasActive && (
          <Button
            variant="bare"
            onClick={() => clearTestBanners()}
            className="px-3 py-1.5 text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors"
          >
            Clear test banners
          </Button>
        )}
      </div>
      <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-2">
        Test banners appear in the Dashboard carousel (client-side only — nothing is sent to users).{' '}
        <Button variant="bare" onClick={() => navigateTo('dashboard')} className="text-primary-600 dark:text-primary-400 font-bold hover:underline">Open Dashboard →</Button>
      </p>
    </div>
  );
};

// ─── Test Push Button (separate component for hook isolation) ──────────────
const TestPushButton: React.FC = () => {
  const { addToast } = useUI();
  const { currentUser, bearerToken } = useAuth();
  // Sept 2026: moved to pushNotificationsNode (node runtime) so the action
  // dispatches FCM inline and returns the REAL delivery result.
  const testPush = useAction(api.pushNotificationsNode.sendTestPushToUser);
  const [isSending, setIsSending] = useState(false);

  const handleTestPush = async () => {
    if (!currentUser?.email) return;
    setIsSending(true);
    try {
      const result = await testPush({ userEmail: currentUser.email, sessionToken: (bearerToken ?? undefined) });
      if (result?.success && (result.sent || 0) > 0) {
        addToast(`Test push delivered to ${result.sent} device(s). Check your notification shade.`, { type: 'success' });
      } else if (result?.reason === 'FCM_NOT_CONFIGURED' || result?.reason === 'LEGACY_FCM_REMOVED' || result?.reason === 'INVALID_SERVICE_ACCOUNT') {
        addToast(`Server FCM problem: ${result.error || result.reason}. Ask your administrator to set FIREBASE_SERVICE_ACCOUNT_JSON on the backend.`, { type: 'error', duration: 10000 });
      } else if (result?.reason === 'NO_REGISTERED_DEVICES') {
        addToast(result.error || 'No registered devices found. Make sure you have the APK installed and notifications enabled.', { type: 'info', duration: 8000 });
      } else if ((result?.failed || 0) > 0) {
        addToast(`FCM reported ${result.failed} failure(s): ${(result.errors || [result.error]).filter(Boolean).join(' | ')}`, { type: 'error', duration: 10000 });
      } else {
        addToast('No devices were notified. Make sure you have the APK installed and notifications enabled.', { type: 'info', duration: 6000 });
      }
    } catch (e: any) {
      // PUSH TEST FIX (2026-09-14): a rejected bearer (session expired /
      // revoked — e.g. the old 10-session cap silently revoking the active
      // device) surfaced as a raw "Unauthenticated…" string with no way
      // forward. Translate it into the actionable instruction: sign out and
      // back in (which mints a fresh session), which ALSO re-registers the
      // FCM token with the new session.
      const msg = String(e?.message || '');
      const isAuth = /unauthenticated|session token|sign in|session has expired|verified session/i.test(msg);
      addToast(
        isAuth
          ? 'Your session has expired — please sign out and sign back in, then try again. (This also refreshes your device registration.)'
          : (msg || 'Failed to send test push.'),
        { type: 'error', duration: isAuth ? 9000 : 5000 }
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <button
      onClick={handleTestPush}
      disabled={isSending}
      className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
    >
      {isSending ? (
        <>
          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Sending...
        </>
      ) : (
        <>
          <BellIcon className="w-3.5 h-3.5" />
          Send Test Push
        </>
      )}
    </button>
  );
};

export default NotificationSettings;
