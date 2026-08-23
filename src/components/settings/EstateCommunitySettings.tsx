/**
 * EstateCommunitySettings.tsx — admin panel for managing Estate Community Features.
 *
 * Three modules, each toggleable per-firm via firmDetails.settings.communityFeatures:
 *   1. Amenity Booking — admin-defined bookable resources
 *   2. Estate Bulletin — community announcements
 *   3. Service Provider Directory — admin-curated vendor list
 *
 * Surfaces under Settings → Estate Community. Only renders for Atrium firms
 * (property managers — Vega legal firms don't manage physical estates).
 */

import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { SettingsCard } from './FirmSettings';

const EstateCommunitySettings: React.FC = () => {
  const { coreState } = useCoreState();
  const { addToast } = useUI();
  const { currentUser } = useAuth();
  const updateFirm = useMutation(api.myFunctions.updateFirmSettings);

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
        userEmail: currentUser?.email,
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

      <div className="space-y-3">
        {modules.map((m) => (
          <div
            key={m.key}
            className={`p-4 rounded-xl border-2 transition-all ${
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
                disabled={saving === m.key}
                className={`flex-shrink-0 relative w-11 h-6 rounded-full transition-colors ${
                  m.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-zinc-600'
                } disabled:opacity-50`}
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
