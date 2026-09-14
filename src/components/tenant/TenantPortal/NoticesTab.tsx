/**
 * TenantPortal Notices tab — resident notice board.
 *
 * Extracted from TenantPortal.tsx (P5 monolith split, 2026-09-14).
 * Body is verbatim from the original file — zero behavioral change.
 */
import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '../../../contexts/AuthContext';
import { BellIcon } from '../../../constants';
import { formatDate } from './shared';

// ─── Notice Board Tab ────────────────────────────────────────────────────────
export const NoticesTab: React.FC<{ tenantInfo: any; effectiveFirmId?: string }> = ({ tenantInfo, effectiveFirmId }) => {
  const { currentUser, bearerToken } = useAuth();
  const firmId = effectiveFirmId || currentUser?.firmId || '';

  // Fetch active notices for this firm, scoped to the tenant's property/unit
  const notices = useQuery(
    api.portals.getActiveNotices,
    firmId ? {
      firmId,
      propertyId: tenantInfo?.primaryPropertyId || undefined,
      unitId: tenantInfo?.primaryUnitId || undefined,
    } : 'skip'
  );

  const isLoading = notices === undefined;

  // Priority badge config
  const priorityConfig: Record<string, { bg: string; text: string; label: string; dot: string }> = {
    urgent: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-300', label: 'Urgent', dot: 'bg-rose-500' },
    important: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', label: 'Important', dot: 'bg-amber-500' },
    normal: { bg: 'bg-slate-50 dark:bg-zinc-800', text: 'text-slate-600 dark:text-zinc-400', label: 'General', dot: 'bg-slate-400' },
  };

  if (isLoading) {
    return (
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Notice Board</h3>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">Updates from your property manager</p>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-zinc-800 rounded-lg p-5 border border-slate-200 dark:border-zinc-700 animate-pulse">
              <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-3/4 mb-3" />
              <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-full mb-2" />
              <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const activeNotices = notices || [];

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Notice Board</h3>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">Updates from your property manager</p>

      {activeNotices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <BellIcon className="w-7 h-7 text-slate-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400 mb-1">No notices right now</p>
          <p className="text-xs text-slate-400 dark:text-zinc-500">When your property manager posts updates, they'll appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {activeNotices.map((notice: any) => {
            const pri = priorityConfig[notice.priority] || priorityConfig.normal;
            const isExpired = notice.expiresAt && notice.expiresAt < Date.now();
            return (
              <div
                key={notice._id}
                className={`bg-white dark:bg-zinc-800 rounded-lg border overflow-hidden transition-colors ${
                  notice.priority === 'urgent'
                    ? 'border-rose-200 dark:border-rose-800/50'
                    : notice.priority === 'important'
                    ? 'border-amber-200 dark:border-amber-800/50'
                    : 'border-slate-200 dark:border-zinc-700'
                }`}
              >
                {/* Pin indicator */}
                {notice.isPinned && (
                  <div className="px-5 pt-3 flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                    </svg>
                    <span className="text-2xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pinned</span>
                  </div>
                )}
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{notice.title}</h4>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold flex-shrink-0 ${pri.bg} ${pri.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${pri.dot}`} />
                      {pri.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{notice.body}</p>
                  <div className="mt-3 flex items-center gap-3 text-2xs text-slate-400 dark:text-zinc-500">
                    {notice.authorName && (
                      <span>Posted by {notice.authorName}</span>
                    )}
                    <span>{formatDate(notice.createdAt)}</span>
                    {notice.expiresAt && (
                      <span className={isExpired ? 'text-rose-500 font-medium' : ''}>
                        {isExpired ? 'Expired' : `Expires ${formatDate(notice.expiresAt)}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Financial Ledger Tab ────────────────────────────────────────────────────
