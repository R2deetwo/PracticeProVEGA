/**
 * BannerShell — Standardized banner presentation.
 *
 * Replaces the ad-hoc banner components (VersionRefreshBanner, ApkUpdateBanner,
 * CriticalLeaseBanner, TermsAcceptance, ToastRefreshNotification) with a
 * single shell that handles icon, color, action button, and dismiss.
 *
 * BannerLayer manages a queue — multiple banners stack vertically with gap.
 */
import React from 'react';

export type BannerType =
  | 'version-refresh'
  | 'apk-update'
  | 'critical-lease'
  | 'terms-acceptance'
  | 'trial-ending'
  | 'offline'
  | 'announcement';

interface BannerAction {
  label: string;
  onClick: () => void;
}

interface BannerShellProps {
  type: BannerType;
  message: string;
  action?: BannerAction;
  onDismiss?: () => void;
  /** Secondary action (e.g., "Remind me later") */
  secondaryAction?: BannerAction;
}

const BANNER_CONFIG: Record<BannerType, { icon: string; bg: string; text: string }> = {
  'version-refresh': {
    icon: '↻',
    bg: 'bg-blue-600',
    text: 'text-white',
  },
  'apk-update': {
    icon: '↓',
    bg: 'bg-emerald-600',
    text: 'text-white',
  },
  'critical-lease': {
    icon: '⚠',
    bg: 'bg-amber-500',
    text: 'text-white',
  },
  'terms-acceptance': {
    icon: '§',
    bg: 'bg-slate-800',
    text: 'text-white',
  },
  'trial-ending': {
    icon: '⏰',
    bg: 'bg-purple-600',
    text: 'text-white',
  },
  offline: {
    icon: '⊘',
    bg: 'bg-rose-600',
    text: 'text-white',
  },
  announcement: {
    icon: '★',
    bg: 'bg-primary-600',
    text: 'text-white',
  },
};

export const BannerShell: React.FC<BannerShellProps> = ({
  type,
  message,
  action,
  onDismiss,
  secondaryAction,
}) => {
  const config = BANNER_CONFIG[type] || BANNER_CONFIG.announcement;

  return (
    <div className={`${config.bg} ${config.text} rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto w-full`}>
      <span className="text-lg font-bold flex-shrink-0">{config.icon}</span>
      <p className="text-sm font-medium flex-1 min-w-0">{message}</p>
      {secondaryAction && (
        <button
          onClick={secondaryAction.onClick}
          className="text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
        >
          {secondaryAction.label}
        </button>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
        >
          {action.label}
        </button>
      )}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1.5 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
          aria-label="Dismiss banner"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default BannerShell;
