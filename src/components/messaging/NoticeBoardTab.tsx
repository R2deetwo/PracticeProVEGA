/**
 * NoticeBoardTab — Notice board management for property managers.
 * Allows creating, viewing, archiving, and restoring notices.
 * Email notifications are handled server-side by createNotice → sendNoticeEmailsForFirm.
 */
import React, { useState, useMemo } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';
import { usePropertyGroups } from '../../hooks/usePropertyGroups';
import { PlusIcon, BellIcon, TrashIcon } from '../../constants';

interface NoticeBoardTabProps {
  firmId: string;
  allNotices: any[];
}

const NOTICE_PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300',
  important: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  normal: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400',
};

export const NoticeBoardTab: React.FC<NoticeBoardTabProps> = ({ firmId, allNotices }) => {
  const { currentUser } = useAuth();
  const { coreState } = useCoreState();
  const { addToast } = useUI();
  // Product-aware terminology. For Vega (legal-only) firms, notices go to
  // clients, not residents. For Atrium/Komplete, notices go to residents.
  // Default audience is "clients" for legal-only, "residents" for property-bearing.
  const { hasPropertyFeatures, hasLegalFeatures } = useProduct();
  const audienceNoun = hasLegalFeatures && !hasPropertyFeatures ? 'clients' : 'residents';

  const createNotice = useMutation(api.portals.createNotice);
  const archiveNotice = useMutation(api.portals.archiveNotice);
  const restoreNotice = useMutation(api.portals.restoreNotice);

  // Form state
  const [showNoticeForm, setShowNoticeForm] = useState(false);
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeBody, setNewNoticeBody] = useState('');
  const [newNoticePriority, setNewNoticePriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [newNoticePinned, setNewNoticePinned] = useState(false);
  const [newNoticePropertyId, setNewNoticePropertyId] = useState('');
  const [newNoticeUnitId, setNewNoticeUnitId] = useState('');
  const [isPostingNotice, setIsPostingNotice] = useState(false);

  // Property groups for targeting
  const properties = (coreState as any).properties || (coreState as any).firmDetails?.properties || [];
  const { flatUnits } = usePropertyGroups(properties);

  const propertyOptions = useMemo(() => {
    const seen = new Map<string, { propertyId: string; address: string }>();
    for (const u of flatUnits) {
      const key = u.shortAddress;
      if (!seen.has(key)) {
        seen.set(key, { propertyId: u.id, address: u.address });
      }
    }
    return Array.from(seen.values());
  }, [flatUnits]);

  const unitsForProperty = useMemo(() => {
    if (!newNoticePropertyId) return [];
    const selected = flatUnits.find((u: any) => u.id === newNoticePropertyId);
    if (!selected) return [];
    return flatUnits.filter((u: any) => u.shortAddress === selected.shortAddress);
  }, [flatUnits, newNoticePropertyId]);

  const activeNotices = useMemo(() => (allNotices as any[]).filter((n: any) => n.status === 'active'), [allNotices]);
  const archivedNotices = useMemo(() => (allNotices as any[]).filter((n: any) => n.status === 'archived'), [allNotices]);

  const handlePostNotice = async () => {
    if (!newNoticeTitle.trim() || !newNoticeBody.trim()) {
      addToast('Please enter a title and message for the notice.', { type: 'error' });
      return;
    }
    setIsPostingNotice(true);
    try {
      await createNotice({
        firmId,
        authorId: currentUser?.id || '',
        authorName: currentUser?.name || '',
        title: newNoticeTitle.trim(),
        body: newNoticeBody.trim(),
        priority: newNoticePriority,
        isPinned: newNoticePinned,
        propertyId: newNoticePropertyId || undefined,
        unitId: newNoticeUnitId || undefined,
      });
      setNewNoticeTitle('');
      setNewNoticeBody('');
      setNewNoticePriority('normal');
      setNewNoticePinned(false);
      setNewNoticePropertyId('');
      setNewNoticeUnitId('');
      setShowNoticeForm(false);
      addToast(`Notice posted successfully. Emails will be sent to ${audienceNoun} based on your notification settings.`, { type: 'success' });
    } catch (err: any) {
      addToast(err.message || 'Failed to create notice.', { type: 'error' });
    } finally {
      setIsPostingNotice(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Notice Board</h2>
              <p className="text-xs text-slate-500 dark:text-zinc-400">Post updates visible to {audienceNoun} on their portal. Emails are sent based on your notification settings.</p>
            </div>
            <button
              onClick={() => setShowNoticeForm(!showNoticeForm)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg shadow-sm transition-all ${
                showNoticeForm
                  ? 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              <PlusIcon className="w-3.5 h-3.5" />
              {showNoticeForm ? 'Cancel' : 'New Notice'}
            </button>
          </div>

          {/* Create Notice Form */}
          {showNoticeForm && (
            <div className="mt-3 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-200 dark:border-zinc-700 p-4 space-y-3">
              <p className="text-2xs text-slate-500 dark:text-zinc-400 -mb-1">
                Announcement to all {audienceNoun} — posted to the portal notice board and emailed to everyone. To message specific tenants instead, use Inbox → Compose.
              </p>
              <input
                type="text"
                value={newNoticeTitle}
                onChange={e => setNewNoticeTitle(e.target.value)}
                placeholder="Notice title..."
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-600 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              />
              <textarea
                value={newNoticeBody}
                onChange={e => setNewNoticeBody(e.target.value)}
                placeholder="Notice content..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-600 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 resize-none"
              />

              {/* Property / Unit Targeting */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase mb-1">Target Property</label>
                  <select
                    value={newNoticePropertyId}
                    onChange={e => { setNewNoticePropertyId(e.target.value); setNewNoticeUnitId(''); }}
                    className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                  >
                    <option value="">All Properties (Global)</option>
                    {propertyOptions.map(po => (
                      <option key={po.propertyId} value={po.propertyId}>{po.address}</option>
                    ))}
                  </select>
                </div>
                {newNoticePropertyId && unitsForProperty.length > 1 && (
                  <div>
                    <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase mb-1">Target Unit</label>
                    <select
                      value={newNoticeUnitId}
                      onChange={e => setNewNoticeUnitId(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm"
                    >
                      <option value="">All Units</option>
                      {unitsForProperty.map((u: any) => (
                        <option key={u.id} value={u.id}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Priority + Pin */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-600 dark:text-zinc-400">Priority:</label>
                  {(['normal', 'important', 'urgent'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setNewNoticePriority(p)}
                      className={`px-2.5 py-1 rounded text-2xs font-bold transition-colors ${newNoticePriority === p ? NOTICE_PRIORITY_COLORS[p] + ' ring-2 ring-offset-1' : 'bg-slate-100 dark:bg-zinc-700 text-slate-400 dark:text-zinc-500'}`}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newNoticePinned}
                    onChange={e => setNewNoticePinned(e.target.checked)}
                    className="rounded border-slate-300 dark:border-zinc-600 text-amber-500 focus:ring-amber-500/30"
                  />
                  <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Pin to top</span>
                </label>
              </div>

              <div className="flex items-center gap-2 justify-end pt-1">
                <button
                  onClick={() => setShowNoticeForm(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePostNotice}
                  disabled={isPostingNotice}
                  className="px-4 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  <BellIcon className="w-3.5 h-3.5" />
                  {isPostingNotice ? 'Posting...' : 'Post Notice'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notices List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto p-4 sm:p-6">
          {activeNotices.length === 0 && archivedNotices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                <BellIcon className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
              </div>
              <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">No notices yet</p>
              <p className="text-xs text-slate-400 mt-1">Post a notice to keep your {audienceNoun} informed</p>
              <button
                onClick={() => setShowNoticeForm(true)}
                className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-bold hover:bg-amber-700 transition-colors flex items-center gap-1.5"
              >
                <PlusIcon className="w-3.5 h-3.5" /> Create First Notice
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Active Notices */}
              {activeNotices.length > 0 && (
                <div>
                  <h3 className="text-2xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-2">Active ({activeNotices.length})</h3>
                  <div className="space-y-2">
                    {activeNotices.map((notice: any) => {
                      const matchedUnit = flatUnits.find((u: any) => u.id === notice.propertyId);
                      const scopeLabel = notice.propertyId
                        ? matchedUnit?.address || notice.propertyId
                        : 'All Properties';
                      return (
                        <div key={notice._id} className="p-4 rounded-lg border bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                {notice.isPinned && (
                                  <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                                )}
                                <span className="text-sm font-bold text-slate-800 dark:text-zinc-200">{notice.title}</span>
                                <span className={`px-1.5 py-0.5 rounded text-3xs font-bold flex-shrink-0 ${NOTICE_PRIORITY_COLORS[notice.priority] || NOTICE_PRIORITY_COLORS.normal}`}>
                                  {notice.priority}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 mb-2">{notice.body}</p>
                              <div className="flex items-center gap-3 text-2xs text-slate-400 dark:text-zinc-500">
                                <span>{new Date(notice.createdAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                <span className="flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                  {scopeLabel}
                                </span>
                                {notice.authorName && <span>by {notice.authorName}</span>}
                              </div>
                            </div>
                            <button
                              onClick={() => archiveNotice({ noticeId: notice._id }).then(() => addToast('Notice archived.', { type: 'success' })).catch((e: any) => addToast(e.message || 'Failed to archive.', { type: 'error' }))}
                              className="p-1.5 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors flex-shrink-0"
                              title="Archive notice"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Archived Notices */}
              {archivedNotices.length > 0 && (
                <details className="group">
                  <summary className="text-2xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 cursor-pointer hover:text-slate-600 dark:hover:text-zinc-300 transition-colors">
                    Archived ({archivedNotices.length})
                  </summary>
                  <div className="mt-2 space-y-2">
                    {archivedNotices.map((notice: any) => (
                      <div key={notice._id} className="flex items-center justify-between gap-3 p-3 bg-slate-50/50 dark:bg-zinc-800/50 rounded-lg opacity-60">
                        <span className="text-xs text-slate-500 dark:text-zinc-400 truncate">{notice.title}</span>
                        <button
                          onClick={() => restoreNotice({ noticeId: notice._id }).then(() => addToast('Notice restored.', { type: 'success' })).catch((e: any) => addToast(e.message || 'Failed to restore.', { type: 'error' }))}
                          className="text-2xs font-bold text-amber-600 hover:text-amber-500 flex-shrink-0"
                        >
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoticeBoardTab;
