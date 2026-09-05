/**
 * EstateCommunitySettings.tsx — admin panel for managing Estate Community Features.
 *
 * Three modules, each toggleable per-firm via firmDetails.settings.communityFeatures:
 *   1. Amenity Booking — admin-defined bookable resources
 *   2. Estate Bulletin — community announcements
 *   3. Service Provider Directory — admin-curated vendor list
 *
 * PRICING MODEL (Aug 2026):
 *   - Pro / Enterprise / Komplete: INCLUDED FREE (core to estate manager persona)
 *   - Starter / Growth: ADD-ON at ₦5,000/month (below Sentry's ₦7,500)
 *   - Trial: 30 days free, once per firm
 *
 * Surfaces under Settings → Firm → Estate Community. Only renders for Atrium firms
 * (property managers — Vega legal firms don't manage physical estates).
 *
 * When the firm is below Pro and doesn't have an active add-on/trial, the
 * panel shows an upgrade/trial CTA instead of the module toggles.
 */

import React, { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { useFeatures } from '../../hooks/useFeatures';
import { SettingsCard } from './FirmSettings';
import { SubscriptionPlan } from '../../types';
import NairaSymbol from '../NairaSymbol';

const EstateCommunitySettings: React.FC = () => {
  const { coreState } = useCoreState();
  const { addToast } = useUI();
  const { currentUser, bearerToken } = useAuth();
  const updateFirm = useMutation(api.myFunctions.updateFirmSettings);

  const {
    canUseEstateCommunity,
    estateCommunityIncludedInPlan,
  } = useFeatures();

  const firm = coreState.firmDetails as any;
  const communityFeatures = firm?.settings?.communityFeatures || {
    amenityBooking: false,
    bulletin: false,
    serviceProviderDirectory: false,
  };

  const [saving, setSaving] = useState<string | null>(null);

  const toggleModule = async (module: 'amenityBooking' | 'bulletin' | 'serviceProviderDirectory', enabled: boolean) => {
    setSaving(module);
    try {
      const currentSettings = (firm?.settings as any) || {};
      await updateFirm({
        firmId: firm?.id || currentUser?.firmId || '',
        settings: {
          ...currentSettings,
          communityFeatures: {
            ...communityFeatures,
            [module]: enabled,
          },
        },
        userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined),
      } as any);
      addToast(`${module === 'amenityBooking' ? 'Amenity Booking' : module === 'bulletin' ? 'Estate Bulletin' : 'Service Provider Directory'} ${enabled ? 'enabled' : 'disabled'}.`, { type: 'success' });
    } catch (e: any) {
      addToast(`Failed to update: ${e.message || 'Unknown error'}`, { type: 'error' });
    } finally {
      setSaving(null);
    }
  };

  const modules = [
    {
      key: 'amenityBooking' as const,
      title: 'Amenity Booking',
      description: 'Let residents book shared amenities (gym, pool, clubhouse). Admin defines amenities, slot duration, and approval rules.',
      enabled: communityFeatures.amenityBooking,
      icon: '📅',
    },
    {
      key: 'bulletin' as const,
      title: 'Estate Bulletin',
      description: 'Post community announcements — events, meetings, holiday hours. Distinct from operational notices (rent reminders, SC updates).',
      enabled: communityFeatures.bulletin,
      icon: '📢',
    },
    {
      key: 'serviceProviderDirectory' as const,
      title: 'Service Provider Directory',
      description: 'Curate a list of vetted plumbers, electricians, cleaners. Residents browse and contact directly — you stay out of the middle.',
      enabled: communityFeatures.serviceProviderDirectory,
      icon: '🔧',
    },
  ];

  return (
    <SettingsCard title="Estate Community Features" id="estate-community">
      <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4 leading-relaxed">
        Optional community modules for residential estates. Enable the ones
        relevant to your properties — residents will see them in their portal
        as new tabs. All modules are admin-controlled: you define the content,
        residents consume it.
      </p>

      {/* ─── PRICING / ACCESS STATUS BANNER ────────────────────────────── */}
      {estateCommunityIncludedInPlan ? (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
            ✓ Included in your {firm?.subscriptionPlan === SubscriptionPlan.Enterprise ? 'Enterprise' : firm?.subscriptionPlan === SubscriptionPlan.Komplete ? 'Komplete' : 'Pro'} plan — no additional charge.
          </p>
        </div>
      ) : canUseEstateCommunity ? (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-amber-700 dark:text-amber-300 font-semibold">
            ⏰ Estate Community add-on is active (trial or paid). Manage your subscription in Settings → Subscription → Add-ons.
          </p>
        </div>
      ) : (
        <div className="mb-4 p-4 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-zinc-100">Add-on required</p>
              <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
                Estate Community is included free with <strong>Pro</strong> and above.
                On your current plan ({firm?.subscriptionPlan || 'Starter'}), it's available as an add-on.
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Add-on</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">
                <NairaSymbol />5,000<span className="text-xs font-normal text-slate-500">/mo</span>
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <a
              href="#subscription"
              className="text-center px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 transition-colors"
            >
              Start 30-day free trial
            </a>
            <a
              href="#subscription"
              className="text-center px-4 py-2 border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-300 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Upgrade to Pro
            </a>
          </div>
          <p className="text-2xs text-slate-500 dark:text-zinc-500 mt-2 leading-relaxed">
            Below Sentry pricing (₦7,500/mo). Bundle both add-ons for ₦10,000/mo and save ₦2,500.
          </p>
        </div>
      )}

      {/* ─── MODULE TOGGLES (disabled if no access) ────────────────────── */}
      <div className={`space-y-3 ${!canUseEstateCommunity ? 'opacity-50 pointer-events-none' : ''}`}>
        {modules.map((m) => (
          <div
            key={m.key}
            className={`p-4 rounded-lg border-2 transition-all ${
              m.enabled
                ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-900/10'
                : 'border-slate-200 dark:border-zinc-700'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{m.icon}</span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-zinc-100">{m.title}</h4>
                  {m.enabled && (
                    <span className="text-2xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">{m.description}</p>
              </div>

              <button
                onClick={() => toggleModule(m.key, !m.enabled)}
                disabled={saving === m.key || !canUseEstateCommunity}
                className={`flex-shrink-0 relative w-11 h-6 rounded-full transition-colors ${
                  m.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label={`Toggle ${m.title}`}
                aria-pressed={m.enabled}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                    m.enabled ? 'translate-x-5' : ''
                  }`}
                />
                {saving === m.key && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </span>
                )}
              </button>
            </div>

            {m.enabled && (
              <div className="mt-3 pt-3 border-t border-emerald-200/50 dark:border-emerald-800/50">
                <p className="text-2xs text-slate-500 dark:text-zinc-500">
                  {m.key === 'amenityBooking' && 'Manage amenities and review booking requests from the Estate tab.'}
                  {m.key === 'bulletin' && 'Post bulletins from the Estate tab — they appear in resident portals immediately.'}
                  {m.key === 'serviceProviderDirectory' && 'Add vetted providers from the Estate tab — residents browse and contact directly.'}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-700">
        <p className="text-2xs text-slate-500 dark:text-zinc-500 leading-relaxed">
          <strong className="text-slate-700 dark:text-zinc-300">Note:</strong> These
          modules are designed for residential estates with shared amenities and
          community life. If your portfolio is purely commercial properties,
          you probably don't need them — leave all three disabled.
        </p>
      </div>
    </SettingsCard>
  );
};

export default EstateCommunitySettings;
