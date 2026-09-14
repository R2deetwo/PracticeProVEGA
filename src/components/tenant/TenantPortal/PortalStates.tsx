/**
 * TenantPortal/PortalStates — blocking states extracted from index.tsx
 * (P5 monolith split, 2026-09-14). JSX is verbatim.
 */
import React from 'react';
import { ExclamationTriangleIcon, OfficeBuildingIcon } from '../../../constants';

/** firmId could not be resolved — repair UI instead of infinite skeletons. */
export const PortalDataUnavailable: React.FC<{
  isRepairing: boolean;
  setIsRepairing: (v: boolean) => void;
  repairFirmId: any;
  email: string;
  addToast: (msg: React.ReactNode, opts?: any) => void;
  logout: () => void;
}> = ({ isRepairing, setIsRepairing, repairFirmId, email, addToast, logout }) => (
      <div className="flex items-center justify-center min-h-[100dvh] bg-slate-50 dark:bg-zinc-950 p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mb-4">
            <ExclamationTriangleIcon className="w-8 h-8 text-rose-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Portal Data Unavailable</h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
            We couldn't load your portal data. Your account may need to be re-linked to your property manager's firm.
          </p>
          <button
            onClick={async () => {
              setIsRepairing(true);
              try {
                const result = await repairFirmId({ email: email });
                if (result.success) {
                  addToast('Account repaired! Refreshing...', { type: 'success' });
                  setTimeout(() => window.location.reload(), 1500);
                } else {
                  addToast('Could not auto-repair. Please contact your property manager.', { type: 'error' });
                }
              } catch {
                addToast('Repair failed. Please contact your property manager.', { type: 'error' });
              } finally {
                setIsRepairing(false);
              }
            }}
            disabled={isRepairing}
            className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRepairing ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Repairing...
              </span>
            ) : (
              'Repair My Account'
            )}
          </button>
          <button
            onClick={() => logout()}
            className="mt-3 block mx-auto text-sm text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>

);

/** Feature gate: Residents' Portal requires Atrium Growth/Pro. */
export const PortalUnavailable: React.FC = () => (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
            <OfficeBuildingIcon className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Residents' Portal Unavailable</h3>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">
            The Residents' Portal is available on Growth and Pro plans. Ask your property manager to upgrade.
          </p>
        </div>
      </div>

);

/** tenantInfo loaded but no property/unit assigned (post auto-relink). */
export const NoPropertyAssignment: React.FC<{
  isRepairing: boolean;
  setIsRepairing: (v: boolean) => void;
  repairFirmId: any;
  relinkToProperty: any;
  email: string;
  effectiveFirmId: string;
  addToast: (msg: React.ReactNode, opts?: any) => void;
}> = ({ isRepairing, setIsRepairing, repairFirmId, relinkToProperty, email, effectiveFirmId, addToast }) => (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center mb-4">
              <OfficeBuildingIcon className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No Property Assignment Found</h3>
            <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md mb-6">
              Your portal account is set up, but you haven't been linked to a specific property or unit yet.
              Please contact your property manager so they can assign you to a property and send you a new portal invitation.
            </p>
            <button
              onClick={async () => {
                setIsRepairing(true);
                try {
                  // First try to repair the firmId (it might be wrong/stale)
                  const firmResult = await repairFirmId({ email });
                  // Then try to relink to property
                  const result = await relinkToProperty({ email, firmId: firmResult?.firmId || effectiveFirmId });
                  if ((result.success && result.linked) || (firmResult?.success && firmResult?.firmId)) {
                    addToast('Account repaired! Refreshing...', { type: 'success' });
                    setTimeout(() => window.location.reload(), 1500);
                  } else {
                    addToast('Could not auto-repair. Please ask your property manager to re-send your portal invitation.', { type: 'error' });
                  }
                } catch {
                  addToast('Repair failed. Please contact your property manager.', { type: 'error' });
                } finally {
                  setIsRepairing(false);
                }
              }}
              disabled={isRepairing}
              className="px-6 py-3 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isRepairing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Repairing...
                </>
              ) : (
                'Try Repair Link'
              )}
            </button>
          </div>

);
