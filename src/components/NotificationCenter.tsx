/**
 * NotificationCenter — In-app notification center for the user app.
 *
 * Shows persistent notifications from the `app_notifications` table:
 *   - App update alerts with direct APK download
 *   - System announcements
 *   - Security alerts
 *
 * Accessed via a bell icon in the header. Shows unread badge count.
 * Tapping a notification with actionType='apk_download' opens the
 * download URL in the browser.
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Capacitor } from '@capacitor/core';
import { useUI } from '../contexts/UIContext';

interface NotificationCenterProps {
  userId: string;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { navigateTo } = useUI();
  const notifications = useQuery(api.pushNotifications.getUserNotifications,
    userId ? { userId, limit: 30 } : 'skip'
  );
  const unreadCount = useQuery(api.pushNotifications.getUnreadNotificationCount,
    userId ? { userId } : 'skip'
  );
  const markRead = useMutation(api.pushNotifications.markNotificationRead);
  const markAllRead = useMutation(api.pushNotifications.markAllNotificationsRead);

  const handleNotificationClick = async (notif: any) => {
    // Mark as read
    if (!notif.isRead) {
      try { await markRead({ notificationId: notif._id }); } catch {}
    }

    // Handle action
    if (notif.actionType === 'apk_download' && notif.actionUrl) {
      if (Capacitor.isNativePlatform()) {
        // Open in system browser for download
        import('@capacitor/browser').then(({ Browser }) => {
          Browser.open({ url: notif.actionUrl });
        }).catch(() => {
          window.open(notif.actionUrl, '_blank');
        });
      } else {
        window.open(notif.actionUrl, '_blank');
      }
    } else if (notif.actionType === 'external_url' && notif.actionUrl) {
      window.open(notif.actionUrl, '_blank');
    } else if (notif.link?.view) {
      // BRIEF #3: Deep-link navigation — pass the full link context through
      // so the destination page can auto-select the specific conversation,
      // receipt, or matter. Previously, only the view was navigated to,
      // dropping the `activeConversationId` and other context fields.
      const link = notif.link;
      const navContext: any = { ...link.context };
      // Flatten common link fields into the navigation context so the
      // destination page's `currentHistoryEntry.context` reads them.
      if (link.initialTab) navContext.initialTab = link.initialTab;
      if (link.activeConversationId) navContext.activeConversationId = link.activeConversationId;
      if (link.id) navContext.selectedInboxId = link.id;
      navigateTo(link.view, link.id || null, navContext);
    }

    setIsOpen(false);
  };

  const handleMarkAllRead = async () => {
    try { await markAllRead({ userId }); } catch {}
  };

  const count = unreadCount || 0;

  return (
    <>
      {/* Bell icon with unread badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-2xs font-bold rounded-full flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Notification dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-[2000]" onClick={() => setIsOpen(false)} />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-700 z-[2001] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-zinc-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notifications</h3>
              {count > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notifications list */}
            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              {!notifications || notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <svg className="w-8 h-8 mx-auto text-slate-300 dark:text-zinc-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                  <p className="text-xs text-slate-400 dark:text-zinc-500">No notifications</p>
                </div>
              ) : (
                notifications.map((notif: any) => (
                  <button
                    key={notif._id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`w-full text-left p-3 border-b border-slate-50 dark:border-zinc-700/50 hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors ${
                      !notif.isRead ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {/* Priority indicator */}
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
                        notif.priority === 'high' ? 'bg-red-500' :
                        notif.priority === 'normal' ? 'bg-emerald-500' : 'bg-slate-300'
                      }`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-xs font-bold text-slate-900 dark:text-white truncate ${
                            !notif.isRead ? '' : 'text-slate-500 dark:text-zinc-400'
                          }`}>
                            {notif.title}
                          </p>
                          <span className="text-2xs text-slate-400 flex-shrink-0">
                            {timeAgo(notif.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2 mt-0.5">
                          {notif.body}
                        </p>

                        {/* Action button */}
                        {notif.actionType === 'apk_download' && notif.actionUrl && (
                          <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 text-white text-2xs font-bold rounded-lg">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                            Download Update
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
};

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export default NotificationCenter;
