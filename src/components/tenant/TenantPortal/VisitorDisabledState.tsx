/**
 * Shown when Sentry Pass (VMS) is not enabled — discoverable state + request-to-enable button.
 *
 * Extracted from TenantPortal.tsx (P5 monolith split, 2026-09-14).
 * Body is verbatim from the original file — zero behavioral change.
 */
import React from 'react';
import { VisitorIcon } from '../../../constants';
import { ChatIcon } from './shared';

// ─── Visitor Disabled State ──────────────────────────────────────────────────
// Shown when Sentry Pass is not enabled by the property manager. Makes the feature
// discoverable instead of hidden, so residents know it exists.
// Also provides a "Request Manager to Enable Sentry Pass" button that dispatches
// an automated request message to the property manager.
export const VisitorDisabledState: React.FC<{ onRequestEnable?: () => void; isRequesting?: boolean }> = ({ onRequestEnable, isRequesting }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
      <VisitorIcon className="w-8 h-8 text-slate-400 dark:text-zinc-500" />
    </div>
    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Visitor Access Codes</h3>
    <p className="text-sm text-slate-600 dark:text-zinc-400 max-w-sm mb-4">
      Generate 6-digit access codes for your visitors, contractors, and delivery
      personnel. Codes are verified at the Sentry Pass for seamless entry.
    </p>
    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4 max-w-sm mb-4">
      <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">
        Feature Not Yet Active
      </p>
      <p className="text-xs text-amber-600 dark:text-amber-500">
        Your property manager hasn't enabled visitor access codes yet. Use the
        button below to send an automated request.
      </p>
    </div>
    {onRequestEnable && (
      <button
        onClick={onRequestEnable}
        disabled={isRequesting}
        className="px-4 py-2.5 bg-emerald-600 text-white rounded-md text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isRequesting ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Sending Request...
          </>
        ) : (
          <>
            <ChatIcon className="w-4 h-4" />
            Request Manager to Enable Sentry Pass
          </>
        )}
      </button>
    )}
  </div>
);

// ─── Help & Support Tab ──────────────────────────────────────────────────────
// Replaces the old standalone "Security" tab. Organizes content into three
// accordion sections: Security & Privacy, Resident Guide & FAQs, and
// Contact Property Manager. Provides quick navigation to Messages tab.
