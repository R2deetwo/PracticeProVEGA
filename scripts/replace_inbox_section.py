#!/usr/bin/env python3
"""Replace the inbox list section in MessagesView.tsx with the new unified version."""

import re
from pathlib import Path

filepath = Path('/home/z/my-project/src/components/MessagesView.tsx')
content = filepath.read_text(encoding='utf-8')

# Find the inbox list container — starts at '<div className="flex-1 overflow-y-auto custom-scrollbar">'
# and ends at the matching '</div>' that closes it (just before '{/* Inbox Thread Detail */}')
lines = content.split('\n')

# Find start line (1-indexed) — the div with className="flex-1 overflow-y-auto custom-scrollbar"
start_idx = None
for i, line in enumerate(lines):
    if 'className="flex-1 overflow-y-auto custom-scrollbar"' in line:
        start_idx = i
        break

if start_idx is None:
    raise SystemExit("Could not find start line")

# Find end line — the closing </div> that precedes the "{/* Inbox Thread Detail */}" comment
end_idx = None
for i in range(start_idx + 1, len(lines)):
    if '{/* Inbox Thread Detail */}' in lines[i]:
        # Walk backwards to find the closing </div> and the empty line before it
        for j in range(i - 1, start_idx, -1):
            if '</div>' in lines[j] and lines[j].strip() == '</div>':
                end_idx = j
                break
        break

if end_idx is None:
    raise SystemExit("Could not find end line")

print(f"Replacing lines {start_idx + 1} to {end_idx + 1}")
print(f"Start: {lines[start_idx].strip()}")
print(f"End:   {lines[end_idx].strip()}")

# The new unified inbox list section
new_section = '''<div className="flex-1 overflow-y-auto custom-scrollbar">
                                {isInboxLoading ? (
                                    <div className="p-3">
                                        <ListItemSkeleton count={6} />
                                    </div>
                                ) : (() => {
                                    // ─── UNIFIED INBOX LIST ────────────────────────────────────
                                    // Previously this branch was split into two halves:
                                    //   isProperty  → show residents' inbound + resident conversations
                                    //   !isProperty → show client conversations only
                                    // That broke for Komplete (unified) firms where BOTH isProperty
                                    // AND isLegal are true — client conversations were filtered out
                                    // because the property branch excluded participantRole === 'Client'.
                                    //
                                    // Now we always show ALL portal conversations regardless of role.
                                    // WhatsApp/Email inbound messages are shown only when the firm
                                    // has property management (they come from the Atrium inbox).
                                    // Internal client messages (legacy matter-scoped messages) are
                                    // shown only when the firm has legal practice.
                                    //
                                    // Each conversation gets a color-coded badge based on its type:
                                    //   🔧 → amber "Ticket" (maintenance)
                                    //   📋 → red   "Request" (client service request)
                                    //   ✅ → blue  "Replied" (admin's last reply)
                                    //   (default) → emerald "Portal"

                                    const hasAnyMessages =
                                        atriumInbound.length > 0 ||
                                        (portalConversations as any[]).length > 0 ||
                                        clientMessages.length > 0;

                                    if (!hasAnyMessages) {
                                        return (
                                            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                                                <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                                                    <svg className="w-8 h-8 text-slate-300 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                                </div>
                                                <p className="text-sm text-slate-400">No messages yet</p>
                                                <p className="text-xs text-slate-300 mt-1">
                                                    {isUnified
                                                        ? 'WhatsApp, email, and portal messages from clients and residents will appear here.'
                                                        : isProperty
                                                        ? "WhatsApp, email, and portal messages from residents will appear here."
                                                        : 'Messages from your clients on their matters will appear here.'}
                                                </p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <>
                                            {/* ── Inbound WhatsApp/Email messages (Atrium/Komplete only) ── */}
                                            {isProperty && (atriumInbound as any[]).map((msg: any) => (
                                                <div
                                                    key={msg._id}
                                                    onClick={() => { setSelectedInboxId(msg._id); markInboundRead({ messageId: msg._id }); }}
                                                    className={`p-3 border-b border-slate-100 dark:border-zinc-800 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-zinc-800 ${selectedInboxId === msg._id ? 'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-l-primary-500' : ''}`}
                                                >
                                                    <div className="flex justify-between items-start mb-1">
                                                        <div className="flex items-center gap-2">
                                                            {!msg.isRead && <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />}
                                                            <span className={`text-sm truncate max-w-[160px] ${!msg.isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-zinc-300'}`}>
                                                                {msg.senderName || msg.senderContact}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                                                            {msg.receivedAt ? new Date(msg.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[10px] mb-1">
                                                        <span className={`px-1.5 py-0.5 rounded uppercase font-bold ${CHANNEL_COLORS[msg.channel] || 'text-slate-500 bg-slate-100'}`}>
                                                            {CHANNEL_LABELS[msg.channel] || msg.channel}
                                                        </span>
                                                        {msg.unitId && <span className="text-slate-400">Unit</span>}
                                                    </div>
                                                    <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2">{msg.content}</p>
                                                </div>
                                            ))}

                                            {/* ── ALL portal conversations (clients AND residents) ── */}
                                            {(portalConversations as any[]).map((conv: any) => {
                                                const convId = String(conv._id);
                                                const isSelected = selectedConvIds.has(convId);
                                                const convType = detectConversationType(conv);
                                                const typeStyle = CONVERSATION_TYPE_STYLES[convType];
                                                const roleLabel = getRoleLabel(conv);
                                                const isThisSelected = selectedInboxId === convId && selectedInboxType === 'conversation';
                                                // Active-row tint + left accent bar follow the conversation type
                                                const activeTint = convType === 'service_request'
                                                    ? 'bg-rose-50 dark:bg-rose-900/20 border-l-rose-500'
                                                    : convType === 'maintenance'
                                                    ? 'bg-amber-50 dark:bg-amber-900/20 border-l-amber-500'
                                                    : convType === 'admin_reply'
                                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-blue-500'
                                                    : 'bg-emerald-50 dark:bg-emerald-900/20 border-l-emerald-500';
                                                return (
                                                    <div
                                                        key={conv._id}
                                                        onClick={() => {
                                                            setSelectedInboxId(convId);
                                                            setSelectedInboxType('conversation');
                                                            if ((conv.unreadByAdmin || 0) > 0) markConvReadByAdmin({ conversationId: convId });
                                                        }}
                                                        className={`p-3 border-b border-slate-100 dark:border-zinc-800 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-zinc-800 ${isThisSelected ? `border-l-2 ${activeTint}` : ''} ${isSelected ? 'bg-rose-50 dark:bg-rose-900/10' : ''}`}
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                {/* Multi-select checkbox (only relevant in bulk-delete mode) */}
                                                                <button
                                                                    onClick={(e) => toggleConvSelection(convId, e)}
                                                                    className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                                                                        isSelected
                                                                            ? 'bg-rose-600 border-rose-600'
                                                                            : 'border-slate-300 dark:border-zinc-600 hover:border-rose-500'
                                                                    }`}
                                                                    title={isSelected ? 'Deselect' : 'Select for bulk delete'}
                                                                >
                                                                    {isSelected && (
                                                                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                        </svg>
                                                                    )}
                                                                </button>
                                                                {/* Unread dot — color matches the conversation type */}
                                                                {(conv.unreadByAdmin || 0) > 0
                                                                    ? <span className={`w-2 h-2 rounded-full ${typeStyle.dot} flex-shrink-0`} />
                                                                    : (conv.lastMessageBy === 'admin' && <CheckIcon className="w-3 h-3 text-emerald-500 flex-shrink-0" />)}
                                                                <span className={`text-sm truncate max-w-[140px] ${(conv.unreadByAdmin || 0) > 0 ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-600 dark:text-zinc-300'}`}>
                                                                    {conv.participantName || 'Portal User'}
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-400 flex-shrink-0">
                                                                {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 text-[10px] mb-1 flex-wrap">
                                                            {/* Primary type badge — color-coded by conversation kind */}
                                                            <span className={`px-1.5 py-0.5 rounded uppercase font-bold ${typeStyle.badge}`}>
                                                                {typeStyle.label}
                                                            </span>
                                                            {/* Role chip — only show for unified firms where the
                                                                inbox mixes clients and residents. */}
                                                            {isUnified && (
                                                                <span className={`px-1.5 py-0.5 rounded uppercase font-bold ${
                                                                    roleLabel === 'Client'
                                                                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                                                                        : 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                                                                }`}>
                                                                    {roleLabel}
                                                                </span>
                                                            )}
                                                            {(conv.unreadByAdmin || 0) > 1 && (
                                                                <span className={`px-1.5 py-0.5 rounded-full text-white font-bold ${typeStyle.dot}`}>
                                                                    {conv.unreadByAdmin}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2">{conv.lastMessagePreview}</p>
                                                    </div>
                                                );
                                            })}

                                            {/* ── Internal client messages (legacy matter-scoped messages, Vega only) ── */}
                                            {!isProperty && clientMessages
                                                .filter((m: any) => !m.isRead)
                                                .map((msg: any) => (
                                                    <div
                                                        key={msg.id}
                                                        onClick={() => { navigateTo('matterDetail', msg.matterId, { initialTab: 'messages' }); }}
                                                        className="p-3 border-b border-slate-100 dark:border-zinc-800 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-zinc-800"
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">Client Message</span>
                                                            <span className="text-[10px] text-slate-400 flex-shrink-0">{msg.timestamp ? timeAgo(msg.timestamp) : ''}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-500 dark:text-zinc-400 line-clamp-2">{msg.content}</p>
                                                    </div>
                                                ))}
                                        </>
                                    );
                                })()}
                            </div>'''

# Replace the lines from start_idx to end_idx (inclusive) with the new section
new_lines = lines[:start_idx] + new_section.split('\n') + lines[end_idx + 1:]
new_content = '\n'.join(new_lines)

filepath.write_text(new_content, encoding='utf-8')
print(f"Successfully replaced {end_idx - start_idx + 1} lines with {len(new_section.split(chr(10)))} new lines")
