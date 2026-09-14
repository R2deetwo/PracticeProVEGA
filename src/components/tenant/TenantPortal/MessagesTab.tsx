/**
 * TenantPortal Messages tab — two-way messaging with the property manager (when enabled).
 *
 * Extracted from TenantPortal.tsx (P5 monolith split, 2026-09-14).
 * Body is verbatim from the original file — zero behavioral change.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useConfirm } from '../../ui/ConfirmDialog';
import { surfaceUploadError } from '../../../utils/convexUpload';
import { MessageActionsMenu, type MessageActionItem } from '../../messaging/MessageThread';
import { DownloadIcon, DocumentIcon, MailIcon } from '../../../constants';
import { ChatIcon, PaperclipIcon, SendIcon, formatDate } from './shared';

export const MessagesTab: React.FC<{ tenantInfo: any; effectiveFirmId?: string; portalSettings: any; addToast: (msg: React.ReactNode, opts?: any) => void }> = ({ tenantInfo, effectiveFirmId, portalSettings, addToast }) => {
  const { currentUser, bearerToken } = useAuth();
  const userId = currentUser?.id || '';
  const firmId = effectiveFirmId || currentUser?.firmId || '';
  const email = currentUser?.email || '';
  const resolvedTenantId = tenantInfo?.tenantId || userId;
  const { confirm, ConfirmDialog } = useConfirm();

  // Conversation-based queries
  const conversations = useQuery(
    api.portals.getPortalConversationsByParticipant,
    userId ? { participantId: userId } : 'skip'
  );

  // Also fetch legacy inbound messages (WhatsApp/Email from PM)
  const inboundMessages = useQuery(
    api.portals.getInboundMessagesByTenant,
    resolvedTenantId ? { tenantId: resolvedTenantId } : 'skip'
  );

  // Active conversation messages
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const conversationMessages = useQuery(
    api.portals.getConversationMessages,
    activeConversationId ? { conversationId: activeConversationId } : 'skip'
  );

  // Mutations
  const sendMessage = useMutation(api.portals.sendPortalMessage);
  const markRead = useMutation(api.portals.markConversationReadByParticipant);
  // Uses the proper batch mutation api.portals.markInboundMessagesReadByTenant
  // (deployed via Task 8 npx convex deploy) to mark ALL unread inbound
  // messages as read in a single call. More efficient than the per-message
  // api.sentry.markMessageAsRead workaround used before Convex was deployed.
  const markInboundRead = useMutation(api.portals.markInboundMessagesReadByTenant);
  const deleteMessage = useMutation(api.portals.softDeletePortalMessage);
  const generateUploadUrl = useMutation(api.myFunctions.generateUploadUrl);

  // State
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
  // v2 message actions: the open actions menu (⋮ tap, long-press, or
  // right-click). One at a time; holds the message id + anchor position.
  const [actionMenu, setActionMenu] = useState<{ id: string; top: number; left: number } | null>(null);
  const [pendingFiles, setPendingFiles] = useState<{ file: File; name: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [chatAtBottom, setChatAtBottom] = useState(true);
  const lastSeenChatIdRef = useRef<string | null>(null);

  // ── Auto-scroll policy (FIX 2026-09-14: “when I try to scroll up to see
  //    previous messages it scrolls back down”) ──
  // The old effect keyed on the `conversationMessages` ARRAY IDENTITY —
  // every Convex push (heartbeat, notifications, any query update) returns
  // a fresh array, so the effect re-fired constantly and yanked the resident
  // to the bottom while they read history. Fix (same pattern as the staff
  // MessageThread): only scroll when a GENUINELY NEW message arrives AND the
  // user is at the bottom (or the new message is the resident's own send).
  const handleChatScroll = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    setChatAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  }, []);

  useEffect(() => {
    if (!conversationMessages || conversationMessages.length === 0) return;
    const last = conversationMessages[conversationMessages.length - 1] as any;
    const lastId = last?._id ? String(last._id) : null;
    const isNew = lastId !== null && lastId !== lastSeenChatIdRef.current;
    if (lastId !== null) lastSeenChatIdRef.current = lastId;
    if (!isNew) return;
    const isMine = last?.senderId === userId;
    if (chatAtBottom || isMine) {
      const timer = setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      return () => clearTimeout(timer);
    }
    // New message from the manager while the resident is scrolled up:
    // stay put — the “Jump to latest” pill surfaces instead.
  }, [conversationMessages, chatAtBottom, userId]);

  // Opening a (different) thread: reset the tracker and snap to bottom.
  useEffect(() => {
    lastSeenChatIdRef.current = null;
    setChatAtBottom(true);
    if (conversationMessages && conversationMessages.length > 0) {
      const t = setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 50);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  // Mark conversation as read when opened — AND when new messages arrive
  // while the thread is open (fixes the tenant-side badge re-inflating
  // while you're looking at the thread: the old effect only fired when the
  // conversation id CHANGED, so fresh admin replies re-added unread counts).
  useEffect(() => {
    if (activeConversationId) {
      markRead({ conversationId: activeConversationId }).catch(() => {});
    }
  }, [activeConversationId, conversationMessages?.length]);

  // ── BUG FIX (Task 10 + Task 11): Clear the unread inbound-messages badge ──
  // When the tenant opens the Messages tab, mark all their unread
  // atrium_inbound_messages as read. This clears the red notification badge
  // on the Messages tab.
  //
  // Uses api.portals.markInboundMessagesReadByTenant (deployed via Task 8
  // npx convex deploy) — a single batch call that marks ALL unread messages
  // for this tenant as read. More efficient than the per-message workaround.
  //
  // Falls back gracefully: if the mutation fails (e.g. Convex not yet
  // deployed), the badge won't clear but no crash occurs.
  useEffect(() => {
    if (!inboundMessages || inboundMessages.length === 0) return;
    const unreadMessages = (inboundMessages as any[]).filter((m: any) => !m.isRead);
    if (unreadMessages.length === 0) return;
    // Fire-and-forget — non-blocking. markInboundMessagesReadByTenant takes
    // tenantId (Convex _id or email — mirrors getInboundMessagesByTenant's
    // lookup logic).
    markInboundRead({ tenantId: resolvedTenantId }).catch(() => {});
    // Also try by email — legacy data may be indexed by both tenantId and email.
    if (email && email !== resolvedTenantId) {
      markInboundRead({ tenantId: email }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboundMessages]);

  // Resolve file URLs for attachments using Convex query
  const [urlStorageIds, setUrlStorageIds] = useState<string[]>([]);
  const fileUrlResults = useQuery(
    api.myFunctions.getFileUrl,
    urlStorageIds.length > 0 ? { storageId: urlStorageIds[0] } : 'skip'
  );
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});

  // Collect unique storage IDs from conversation messages
  useEffect(() => {
    if (!conversationMessages) return;
    const ids = new Set<string>();
    for (const msg of conversationMessages) {
      if (msg.attachments) {
        for (const sid of msg.attachments) {
          if (!fileUrls[sid]) ids.add(sid);
        }
      }
    }
    setUrlStorageIds(Array.from(ids));
  }, [conversationMessages]);

  // Resolve file URLs one at a time
  useEffect(() => {
    if (fileUrlResults && urlStorageIds.length > 0) {
      setFileUrls(prev => ({ ...prev, [urlStorageIds[0]]: fileUrlResults }));
      setUrlStorageIds(prev => prev.slice(1));
    }
  }, [fileUrlResults, urlStorageIds]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validFiles = files.filter(f => {
      if (f.size > maxSize) {
        addToast(`"${f.name}" exceeds 10MB limit.`, { type: 'error' });
        return false;
      }
      return true;
    });
    setPendingFiles(prev => [...prev, ...validFiles.map(f => ({ file: f, name: f.name }))]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim() && pendingFiles.length === 0) {
      addToast('Please type a message or attach a file.', { type: 'info' });
      return;
    }
    // OFFLINE GUARD — file uploads cannot be queued (single-use URLs).
    // Fail fast with a clear message so the user knows to reconnect.
    if (pendingFiles.length > 0 && !navigator.onLine) {
      addToast("You're offline. File upload requires internet — please reconnect and try again.", { type: 'error', duration: 6000 });
      return;
    }
    setIsSending(true);
    try {
      // Upload files first
      const storageIds: string[] = [];
      const fileNames: string[] = [];
      for (const { file, name } of pendingFiles) {
        try {
          const postUrl = await generateUploadUrl();
          const res = await fetch(postUrl, { method: 'POST', body: file });
          if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
          const { storageId } = await res.json();
          if (storageId) {
            storageIds.push(storageId);
            fileNames.push(name);
          }
        } catch (uploadErr: any) {
          surfaceUploadError(addToast, file, uploadErr);
        }
      }

      await sendMessage({
        firmId,
        senderId: userId,
        senderName: currentUser?.name,
        senderEmail: email,
        senderRole: 'Tenant',
        content: messageContent.trim(),
        attachments: storageIds.length > 0 ? storageIds : undefined,
        attachmentNames: fileNames.length > 0 ? fileNames : undefined,
        propertyId: tenantInfo?.primaryPropertyId || undefined,
        unitId: tenantInfo?.primaryUnitId || undefined,
        // THREADING FIX: Pass the active conversation ID so the message
        // continues in the same thread instead of creating a new one.
        conversationId: activeConversationId || undefined,
      });
      setMessageContent('');
      setPendingFiles([]);
    } catch (err: any) {
      addToast(err.message || 'Failed to send message.', { type: 'error' });
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Get the active conversation object
  const activeConversation = conversations?.find((c: any) => String(c._id) === activeConversationId);

  // Format time for chat bubbles
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isLoading = conversations === undefined;

  // ─── Chat View (when a conversation is active) ────────────────────────
  if (activeConversationId && activeConversation) {
    // MOBILE COMPACTNESS (2026-09-14): group consecutive same-sender
    // messages — the sender label row (name + timestamp + ⋮) only renders
    // when the sender CHANGES or there is a >5-minute gap. Previously every
    // single bubble carried a full label row + a 12px gap (space-y-3),
    // which read as “a lot of gaps between the messages” on phones.
    const visibleChatMessages = ((conversationMessages as any[]) || []).filter((msg: any) => !msg.isDeleted);
    const fiveMin = 5 * 60 * 1000;
    const showLabelFor = (idx: number): boolean => {
      const msg = visibleChatMessages[idx];
      const prev = visibleChatMessages[idx - 1];
      if (!prev) return true;
      const dayChange = new Date(msg.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
      const gap = Math.abs(new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime()) > fiveMin;
      const senderChange = (prev.senderId || prev.senderName) !== (msg.senderId || msg.senderName);
      return senderChange || gap || dayChange;
    };
    return (
      <div className="flex flex-col h-[calc(100dvh-230px)] min-h-[340px]">
        {/* Chat header */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-t-xl">
          <button
            onClick={() => setActiveConversationId(null)}
            className="p-1.5 -ml-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
              {(activeConversation.participantName || 'PM').charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              Property Manager
            </h4>
            <p className="text-2xs text-slate-500 dark:text-zinc-400">
              {activeConversation.unitId
                ? `Unit ${tenantInfo?.primaryUnitName || activeConversation.unitId}`
                : activeConversation.propertyId ? 'Property conversation' : 'General'}
            </p>
          </div>
          {(activeConversation.unreadByParticipant || 0) > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 bg-emerald-500 text-white text-2xs font-bold rounded-full flex items-center justify-center">
              {activeConversation.unreadByParticipant}
            </span>
          )}
        </div>

        {/* Messages area
            ── WHY this doesn't render through the shared MessageThread (yet) ──
            The staff app's Team/Client&Tenant/AI threads all render through
            src/components/messaging/MessageThread.tsx + the canonical
            src/messaging/model.ts. The portals deliberately keep their own
            thread renderer for now:
            1. IDENTITY PERSPECTIVE: here the PARTICIPANT is "me" — the firm's
               replies are "them". The model now supports this via
               normalizePortalMessage(msg, undefined, { perspective: 'participant' }),
               but the render adoption is staged separately to keep this
               release surgical.
            2. SIGNED ATTACHMENT URLS: portal attachments resolve through the
               fileUrls map (portal-token access) — the shared AttachmentGrid
               builds public staff-side storage URLs, which would 404 here.
            3. PORTAL DESIGN LANGUAGE: emerald accent + participant-side delete
               semantics (soft-delete visible only to the participant).
            Revisit once MessageThread grows a URL-resolver prop. */}
        <div
          ref={chatScrollRef}
          onScroll={handleChatScroll}
          className="relative flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-1.5 bg-slate-50 dark:bg-zinc-900 custom-scrollbar"
        >
          {/* Jump to latest — surfaces whenever the resident scrolls up */}
          {!chatAtBottom && visibleChatMessages.length > 0 && (
            <button
              onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="sticky top-2 ml-auto mr-1 flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-zinc-700 border border-slate-200 dark:border-zinc-600 shadow-lg text-slate-500 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-600 transition-colors z-10"
              aria-label="Scroll to latest message"
              title="Jump to latest"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 13l-7 7-7-7M14 6l-2-2-2 2" />
              </svg>
            </button>
          )}
          {conversationMessages === undefined ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : conversationMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ChatIcon className="w-10 h-10 text-slate-300 dark:text-zinc-600 mb-2" />
              <p className="text-sm text-slate-400">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            // BUG FIX (Task 10): Filter out isDeleted messages — the backend
            // softDeletePortalMessage mutation marks them as isDeleted:true
            // but getConversationMessages still returns them. Without this
            // filter, deleted messages would stay visible forever (the user's
            // "delete doesn't work" complaint).
            visibleChatMessages
              .map((msg: any, idx: number) => {
              const isMe = msg.senderId === userId;
              const isDeleted = msg.isDeleted;
              // Compact grouping: label row only when the sender changes or
              // a >5min/day gap breaks the run (see showLabelFor above).
              const showLabel = showLabelFor(idx);

              // Show deleted placeholder for soft-deleted messages
              if (isDeleted) {
                return (
                  <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                      isMe
                        ? 'bg-emerald-600/20 text-emerald-300/60 dark:text-emerald-400/40 rounded-tr-none italic'
                        : 'bg-slate-100 dark:bg-zinc-800/50 text-slate-400 dark:text-zinc-500 border border-slate-200/50 dark:border-zinc-700/50 rounded-tl-none italic'
                    }`}>
                      <p className="text-xs">This message was deleted</p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] group ${isMe ? 'order-2' : 'order-1'}`}>
                    {/* Sender label — ONLY when the sender changes / time gap
                        (compact grouping). Timestamp + ⋮ actions live here. */}
                    {showLabel && (
                    <div className={`flex items-center gap-1.5 mb-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <span className="text-2xs font-bold text-slate-400 dark:text-zinc-500">
                        {isMe ? 'You' : (msg.senderName || 'Property Manager')}
                      </span>
                      <span className="text-2xs text-slate-300 dark:text-zinc-600">
                        {formatTime(msg.createdAt)}
                      </span>
                      {/* ⋮ actions — Copy for every message, Delete for own */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setActionMenu({ id: String(msg._id), top: rect.bottom + 4, left: isMe ? rect.right - 170 : rect.left });
                        }}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-200/70 dark:hover:bg-zinc-700/70 focus:opacity-100 focus:outline-none opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity"
                        aria-label="Message actions"
                        title="Message actions (or long-press the message)"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" />
                        </svg>
                      </button>
                    </div>
                    )}
                    {/* Bubble — slimmer padding on mobile (py-2 / px-3.5) */}
                    <div
                      className={`group relative rounded-2xl px-3.5 py-2 shadow-sm ${
                        isMe
                          ? 'bg-emerald-600 text-white rounded-tr-none'
                          : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 rounded-tl-none'
                      }`}
                      onContextMenu={(e) => {
                        // Long-press (Android) / right-click (desktop) → same menu
                        e.preventDefault();
                        setActionMenu({ id: String(msg._id), top: e.clientY + 6, left: e.clientX });
                      }}
                    >
                      <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>

                      {/* (Delete affordance moved to the ⋮ / long-press actions
                          menu — see MessageActionsMenu render near ConfirmDialog.
                          Copy is available for every message; Delete only for
                          own messages, with the same in-app confirmation.) */}

                      {/* Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {msg.attachments.map((storageId: string, idx: number) => {
                            const fileName = msg.attachmentNames?.[idx] || `File ${idx + 1}`;
                            const fileUrl = fileUrls[storageId];
                            const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(fileName);
                            return (
                              <div key={storageId + idx} className={`rounded-lg overflow-hidden ${
                                isMe ? 'bg-emerald-500/30' : 'bg-slate-100 dark:bg-zinc-700'
                              }`}>
                                {isImage && fileUrl ? (
                                  <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                                    <img src={fileUrl} alt={fileName} className="max-w-full max-h-48 object-contain rounded" />
                                  </a>
                                ) : (
                                  <a
                                    href={fileUrl || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-2 px-3 py-2 text-xs font-medium ${
                                      isMe ? 'text-emerald-100' : 'text-slate-600 dark:text-zinc-300'
                                    }`}
                                  >
                                    <DocumentIcon className="w-4 h-4 flex-shrink-0" />
                                    <span className="truncate">{fileName}</span>
                                    <DownloadIcon className="w-3.5 h-3.5 flex-shrink-0 ml-auto" />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Compose area (only if messaging is enabled) */}
        {portalSettings?.tenantMessagingEnabled && (
          <div className="flex-shrink-0 border-t border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-b-xl">
            {/* Pending files preview */}
            {pendingFiles.length > 0 && (
              <div className="px-3 pt-2 flex gap-2 flex-wrap">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-700 rounded-lg px-2.5 py-1.5 text-xs">
                    <PaperclipIcon className="w-3 h-3 text-slate-400" />
                    <span className="max-w-[120px] truncate text-slate-700 dark:text-zinc-300">{f.name}</span>
                    <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500 ml-0.5">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 p-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                multiple
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                title="Attach file"
              >
                <PaperclipIcon className="w-5 h-5" />
              </button>
              <textarea
                value={messageContent}
                onChange={e => setMessageContent(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none max-h-32"
                style={{ minHeight: '40px' }}
              />
              <button
                onClick={handleSendMessage}
                disabled={isSending || (!messageContent.trim() && pendingFiles.length === 0)}
                className="p-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {isSending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <SendIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Conversation List View ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-700" />
              <div className="flex-1">
                <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Messages</h3>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
        {portalSettings?.tenantMessagingEnabled
          ? `Conversations with your property manager${tenantInfo?.primaryUnitName ? ` (Unit ${tenantInfo.primaryUnitName})` : ''}.`
          : 'Recent messages from your property manager.'}
      </p>

      {/* Quick send (only if messaging is enabled and no active conversation) */}
      {portalSettings?.tenantMessagingEnabled && (
        <div className="mb-6">
          {/* If there's an existing conversation, show a button to open it */}
          {conversations && conversations.length > 0 ? (
            <button
              onClick={() => setActiveConversationId(String(conversations[0]._id))}
              className="w-full flex items-center gap-3 bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-4 hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                <ChatIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white">Continue Conversation</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 truncate">
                  {conversations[0].lastMessagePreview || 'No messages yet'}
                </p>
              </div>
              {(conversations[0].unreadByParticipant || 0) > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 bg-emerald-500 text-white text-2xs font-bold rounded-full flex items-center justify-center">
                  {conversations[0].unreadByParticipant}
                </span>
              )}
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            /* No conversation yet — inline compose to start one */
            <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-4">
              <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-2">Start a Conversation</h4>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mb-3">
                Contact your property manager directly.
              </p>
              <div className="flex items-end gap-2">
                <textarea
                  value={messageContent}
                  onChange={e => setMessageContent(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  rows={2}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={isSending || !messageContent.trim()}
                  className="self-end w-10 h-10 flex-shrink-0 flex items-center justify-center bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Send message"
                  title="Send"
                >
                  {isSending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <SendIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inbound messages (WhatsApp/Email from PM — these come via WhatsApp) */}
      {inboundMessages && inboundMessages.length > 0 && (
        <div className="mb-6">
          <h4 className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
            Incoming Messages
          </h4>
          <div className="space-y-2">
            {inboundMessages.map((msg: any) => (
              <div
                key={msg._id}
                className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    msg.channel === 'whatsapp' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-blue-50 dark:bg-blue-900/20'
                  }`}>
                    {msg.channel === 'whatsapp' ? (
                      <svg className="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    ) : (
                      <MailIcon className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-bold text-slate-600 dark:text-zinc-300">
                        {msg.senderName || 'Property Manager'}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-3xs font-bold uppercase ${
                        msg.channel === 'whatsapp' ? 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30' : 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30'
                      }`}>
                        {msg.channel || 'message'}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 dark:text-zinc-300 break-words">{msg.content}</p>
                    <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-1">
                      {formatDate(msg.receivedAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!conversations || conversations.length === 0) && (!inboundMessages || inboundMessages.length === 0) && (
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-lg bg-slate-100 dark:bg-zinc-700 flex items-center justify-center mb-3">
            <ChatIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">No messages</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            {portalSettings?.tenantMessagingEnabled
              ? 'Start a conversation with your property manager.'
              : 'No messages from your property manager.'}
          </p>
        </div>
      )}
      {/* v2 message actions menu (⋮ / long-press / right-click) — Copy for
          every message, Delete only for own messages (in-app confirmation
          via the ConfirmDialog below, same flow as before). */}
      {actionMenu && (() => {
        // `as any` — conversationMessages rows are dynamically shaped
        // (legacy inbound + conversation rows merged); typed access would
        // reject the fields the bespoke renderer relies on.
        const target = (conversationMessages || []).find((m: any) => String(m._id) === actionMenu.id) as any;
        if (!target) return null;
        const ownMessage = target.senderId === userId;
        const items: MessageActionItem[] = ownMessage ? [{
          label: 'Delete message',
          danger: true,
          onSelect: async () => {
            const ok = await confirm({
              title: 'Delete this message?',
              message: 'The message will be removed from this conversation for you. The property manager will still have a record for their files.',
              confirmLabel: 'Delete',
              cancelLabel: 'Cancel',
              danger: true,
            });
            if (!ok) return;
            setDeletingMessageId(String(target._id));
            try {
              await deleteMessage({ messageId: String(target._id), requesterId: userId });
              addToast('Message deleted.', { type: 'success', duration: 2500 });
            } catch (err: any) {
              addToast(err.message || 'Failed to delete message.', { type: 'error' });
            } finally {
              setDeletingMessageId(null);
            }
          },
        }] : [];
        return (
          <MessageActionsMenu
            top={actionMenu.top}
            left={actionMenu.left}
            onClose={() => setActionMenu(null)}
            copyText={target.content}
            items={items}
          />
        );
      })()}
      {/* In-app confirmation dialog — replaces browser window.confirm() */}
      {ConfirmDialog}
    </div>
  );
};

// ─── Payments Tab (Upload Payment Proof) ─────────────────────────────────────
