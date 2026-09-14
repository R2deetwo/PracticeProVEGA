/**
 * TenantPortal/PortalHeader — impersonation banner + sticky portal header
 * (greeting, theme toggle, font-size control, sign out). Extracted from
 * index.tsx (P5 monolith split, 2026-09-14). JSX is verbatim.
 */
import React from 'react';
import { EyeIcon } from '../../../constants';
import { SunIcon, MoonIcon } from './shared';
import { PortalFontSizeControl } from '../../portal/PortalFontSizeControl';

export const PortalHeader: React.FC<{
  isImpersonating: boolean;
  displayName: string;
  onReturnToAdmin: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onLogout: () => void;
}> = ({ isImpersonating, displayName, onReturnToAdmin, isDark, onToggleTheme, onLogout }) => (
  <>
      {/* Impersonation Banner — shown when admin is viewing as this tenant.
          Uses isImpersonating (synchronous) rather than originalUser (async query)
          so the banner — and the "Return to Admin" button — is always visible
          during impersonation, even if the admin's DB record is still loading
          or has a missing role. */}
      {isImpersonating && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <EyeIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
              You are previewing the portal as <strong>{displayName}</strong>
            </p>
          </div>
          <button
            onClick={onReturnToAdmin}
            className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex-shrink-0"
          >
            Return to Admin
          </button>
        </div>
      )}

      {/* Header — minimalist, sticky. Shows ONLY a time-of-day greeting.
          Resident name, unit, and address are shown in the green hero card below. */}
      <div className="flex-shrink-0 sticky top-0 z-20 border-b border-slate-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {new Date().getHours() < 12 ? 'Good Morning' : new Date().getHours() < 17 ? 'Good Afternoon' : 'Good Evening'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Theme Toggle */}
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
            >
              {isDark ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>
            {/* Font-size control */}
            <PortalFontSizeControl className="inline-flex" />
            {/* Sign Out */}
            <button
              onClick={onLogout}
              className="p-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
              title="Sign out"
              aria-label="Sign out"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

  </>
);
