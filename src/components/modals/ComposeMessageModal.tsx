/**
 * ComposeMessageModal — Unified multi-channel message composition.
 *
 * Three channels (tabs):
 *   1. WhatsApp — dispatches via Chakra Chat API (api.communications.sendWhatsApp).
 *      If the API fails or is unconfigured, offers a "Open in WhatsApp Web" fallback
 *      (https://wa.me/...).
 *   2. Email — requires a valid email address. Subject + HTML/plaintext body.
 *      Dispatches via api.communications.sendEmail.
 *   3. Portal Invite — requires a valid email. If email is missing, the tab is
 *      disabled (grayed out) with a hover tooltip:
 *      "Please update resident's email address to send a Tenant Portal invite."
 *
 * All sends are logged to the contact activity timeline via api.communications.logAuto
 * (if available) so there's a real audit trail instead of a fake "Message Sent" toast.
 */

import React, { useState, useMemo } from 'react';
import { useConvex, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useCoreState } from '../../contexts/CoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { XIcon, MailIcon, SendIcon, ExternalLinkIcon, UserCircleIcon, CheckCircleIcon } from '../../constants';
import { MessageSquare } from 'lucide-react';

export interface ComposeRecipient {
    name: string;
    phone?: string;
    email?: string;
    unitId?: string;
    unitName?: string;
    contactId?: string;
}

interface ComposeMessageModalProps {
    recipient: ComposeRecipient;
    onClose: () => void;
}

type Channel = 'whatsapp' | 'email' | 'portal';

const normalizePhone = (phone: string): string => {
    const clean = phone.replace(/\D/g, '').replace(/^0+/, '');
    return clean.startsWith('234') ? clean : `234${clean}`;
};

const isValidEmail = (email?: string): boolean => {
    if (!email || !email.trim()) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

export const ComposeMessageModal: React.FC<ComposeMessageModalProps> = ({ recipient, onClose }) => {
    const convex = useConvex();
    const { coreState } = useCoreState();
    const { currentUser } = useAuth();
    const { addToast } = useUI();

    const [activeChannel, setActiveChannel] = useState<Channel>(
        recipient.phone ? 'whatsapp' : isValidEmail(recipient.email) ? 'email' : 'whatsapp'
    );
    const [message, setMessage] = useState('');
    const [subject, setEmailSubject] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ success: boolean; channel: Channel; fallbackUrl?: string } | null>(null);
    const logAutomation = useMutation(api.sentry.logAutomation);

    const firmId = coreState.firmDetails?.id || currentUser?.firmId || '';
    const senderName = currentUser?.name || 'Property Manager';

    const hasPhone = !!recipient.phone?.trim();
    const hasEmail = isValidEmail(recipient.email);

    const channels: { id: Channel; label: string; icon: React.ReactNode; enabled: boolean; disabledReason?: string }[] = [
        {
            id: 'whatsapp',
            label: 'WhatsApp',
            icon: <MessageSquare className="w-4 h-4" />,
            enabled: hasPhone,
            disabledReason: hasPhone ? undefined : 'No phone number on file for this resident.',
        },
        {
            id: 'email',
            label: 'Email',
            icon: <MailIcon className="w-4 h-4" />,
            enabled: hasEmail,
            disabledReason: hasEmail ? undefined : "Please update resident's email address to send an email.",
        },
        {
            id: 'portal',
            label: 'Portal Invite',
            icon: <UserCircleIcon className="w-4 h-4" />,
            enabled: hasEmail,
            disabledReason: hasEmail ? undefined : "Please update resident's email address to send a Tenant Portal invite.",
        },
    ];

    const defaultMessage = useMemo(() => {
        const unitRef = recipient.unitName || '';
        return `Hello ${recipient.name}, this is a message from ${coreState.firmDetails?.name || senderName}${unitRef ? ` regarding ${unitRef}` : ''}.`;
    }, [recipient.name, recipient.unitName, coreState.firmDetails?.name, senderName]);

    const handleSend = async () => {
        const finalMessage = message.trim() || defaultMessage;
        if (!finalMessage) {
            addToast('Please enter a message.', { type: 'error' });
            return;
        }

        setIsSending(true);
        setSendResult(null);

        try {
            if (activeChannel === 'whatsapp' && hasPhone) {
                const to = normalizePhone(recipient.phone!);
                try {
                    const result = await convex.action(api.communications.sendWhatsApp, {
                        to,
                        messageText: finalMessage,
                        firmId,
                    });
                    if (result?.success) {
                        setSendResult({ success: true, channel: 'whatsapp' });
                        addToast('WhatsApp message sent via Chakra Chat API.', { type: 'success' });
                    } else {
                        // API returned failure — offer fallback
                        const fallbackUrl = `https://wa.me/${to}?text=${encodeURIComponent(finalMessage)}`;
                        setSendResult({ success: false, channel: 'whatsapp', fallbackUrl });
                        addToast('Chakra Chat API unavailable. Use the WhatsApp Web fallback below.', { type: 'info' });
                    }
                } catch (err: any) {
                    // API threw — offer fallback
                    const fallbackUrl = `https://wa.me/${to}?text=${encodeURIComponent(finalMessage)}`;
                    setSendResult({ success: false, channel: 'whatsapp', fallbackUrl });
                    addToast('Chakra Chat API error. WhatsApp Web fallback available.', { type: 'info' });
                }
            } else if (activeChannel === 'email' && hasEmail) {
                try {
                    const result = await convex.action(api.communications.sendEmail, {
                        to: recipient.email!,
                        subject: subject.trim() || `Message from ${coreState.firmDetails?.name || senderName}`,
                        htmlContent: `<div style="font-family:sans-serif;line-height:1.6;color:#1e293b;"><p>${finalMessage.replace(/\n/g, '<br/>')}</p><p style="color:#64748b;font-size:12px;margin-top:16px;">— ${senderName}</p></div>`,
                        firmId,
                    });
                    if (result?.success) {
                        setSendResult({ success: true, channel: 'email' });
                        addToast('Email sent successfully.', { type: 'success' });
                    } else {
                        setSendResult({ success: false, channel: 'email' });
                        addToast('Email delivery failed. Please try again.', { type: 'error' });
                    }
                } catch (err: any) {
                    setSendResult({ success: false, channel: 'email' });
                    addToast(err.message || 'Email delivery failed.', { type: 'error' });
                }
            } else if (activeChannel === 'portal' && hasEmail) {
                try {
                    await convex.mutation(api.portals.sendPortalMessage, {
                        firmId,
                        senderId: currentUser?.id || '',
                        senderName,
                        senderRole: 'admin',
                        subject: subject.trim() || `Portal Invite from ${coreState.firmDetails?.name || 'Management'}`,
                        content: finalMessage,
                        unitId: recipient.unitId,
                    });
                    setSendResult({ success: true, channel: 'portal' });
                    addToast('Portal invite sent successfully.', { type: 'success' });
                } catch (err: any) {
                    setSendResult({ success: false, channel: 'portal' });
                    addToast(err.message || 'Failed to send portal invite.', { type: 'error' });
                }
            }

            // Log to activity timeline (best-effort — don't fail if logging fails)
            try {
                await logAutomation({
                    firmId,
                    unitId: recipient.unitId,
                    messageType: 'custom',
                    channel: activeChannel,
                    recipient: activeChannel === 'whatsapp' ? recipient.phone : recipient.email,
                    messagePreview: finalMessage.substring(0, 200),
                    messageContent: finalMessage,
                    direction: 'outbound',
                    senderName,
                    status: sendResult?.success ? 'sent' : 'failed',
                    triggeredBy: currentUser?.id,
                } as any);
            } catch (logErr) {
                // Silent fail — logging is best-effort
                console.warn('Activity log failed:', logErr);
            }
        } finally {
            setIsSending(false);
        }
    };

    const handleClose = () => {
        if (isSending) return;
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/50 sm:backdrop-blur-sm" onClick={handleClose} />
            <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-700/60">
                {/* Accent */}
                <div className="h-1 w-full flex-shrink-0 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500" />

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0">
                    <div>
                        <p className="text-2xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wide-label">Compose Message</p>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                            {recipient.name}
                        </h2>
                        {recipient.unitName && (
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">{recipient.unitName}</p>
                        )}
                    </div>
                    <button onClick={handleClose} className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Channel Tabs */}
                <div className="px-5 pt-4 flex-shrink-0">
                    <div className="flex gap-1 bg-slate-100 dark:bg-zinc-800/60 p-1 rounded-lg">
                        {channels.map(ch => (
                            <button
                                key={ch.id}
                                    onClick={() => ch.enabled && setActiveChannel(ch.id)}
                                    disabled={!ch.enabled}
                                    title={ch.disabledReason}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-all ${
                                        activeChannel === ch.id && ch.enabled
                                            ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                                            : ch.enabled
                                                ? 'text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
                                                : 'text-slate-300 dark:text-zinc-600 cursor-not-allowed'
                                    }`}
                            >
                                {ch.icon}
                                {ch.label}
                            </button>
                        ))}
                    </div>
                    {/* Disabled channel reason tooltip */}
                    {!channels.find(c => c.id === activeChannel)?.enabled && (
                        <p className="text-2xs text-amber-600 dark:text-amber-400 mt-2 px-1">
                            {channels.find(c => c.id === activeChannel)?.disabledReason}
                        </p>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    {/* Recipient info */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-700/60">
                        <div className="p-1.5 bg-slate-200 dark:bg-zinc-700 rounded-lg flex-shrink-0">
                            <UserCircleIcon className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{recipient.name}</p>
                            <div className="flex flex-col gap-0.5">
                                <p className={`text-2xs ${hasPhone ? 'text-slate-500 dark:text-zinc-400' : 'text-slate-300 dark:text-zinc-600'}`}>
                                    Phone: {recipient.phone || '— not on file —'}
                                </p>
                                <p className={`text-2xs ${hasEmail ? 'text-slate-500 dark:text-zinc-400' : 'text-slate-300 dark:text-zinc-600'}`}>
                                    Email: {recipient.email || '— not on file —'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Email subject (only for email + portal channels) */}
                    {activeChannel === 'email' && hasEmail && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Subject</label>
                            <input
                                type="text"
                                value={subject}
                                onChange={e => setEmailSubject(e.target.value)}
                                placeholder="Enter subject line..."
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-slate-900 dark:text-white placeholder-slate-400"
                            />
                        </div>
                    )}

                    {/* Portal invite label */}
                    {activeChannel === 'portal' && hasEmail && (
                        <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/40">
                            <p className="text-xs font-bold text-violet-700 dark:text-violet-400">
                                Portal Invite
                            </p>
                            <p className="text-2xs text-violet-600 dark:text-violet-500 mt-0.5">
                                A pre-configured portal access link will be sent to {recipient.email}.
                            </p>
                        </div>
                    )}

                    {/* Message body */}
                    {activeChannel !== 'portal' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                                Message
                            </label>
                            <textarea
                                rows={5}
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder={defaultMessage}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-slate-900 dark:text-white placeholder-slate-400 resize-none"
                            />
                            <p className="text-2xs text-slate-400 mt-1">
                                Leave empty to use the default greeting.
                            </p>
                        </div>
                    )}

                    {/* Portal message body (portal channel also has a message) */}
                    {activeChannel === 'portal' && hasEmail && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                                Invite Message
                            </label>
                            <textarea
                                rows={3}
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                placeholder={`Hello ${recipient.name}, you've been invited to access the tenant portal...`}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-slate-900 dark:text-white placeholder-slate-400 resize-none"
                            />
                        </div>
                    )}

                    {/* Send result / fallback */}
                    {sendResult && (
                        <div className={`p-3 rounded-lg border animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                            sendResult.success
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40'
                                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800/40'
                        }`}>
                            {sendResult.success ? (
                                <div className="flex items-center gap-2">
                                    <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                                        {sendResult.channel === 'whatsapp' ? 'WhatsApp message sent!' :
                                         sendResult.channel === 'email' ? 'Email sent!' :
                                         'Portal invite sent!'}
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-2">
                                        {sendResult.channel === 'whatsapp' ? 'Chakra Chat API unavailable.' : 'Delivery failed.'}
                                    </p>
                                    {sendResult.fallbackUrl && (
                                        <a
                                            href={sendResult.fallbackUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
                                        >
                                            <ExternalLinkIcon className="w-3.5 h-3.5" />
                                            Fallback: Open in WhatsApp Web
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 px-5 py-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3 bg-white dark:bg-zinc-900">
                    <button
                        onClick={handleClose}
                        disabled={isSending}
                        className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={isSending || !channels.find(c => c.id === activeChannel)?.enabled}
                        className="px-6 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        {isSending ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Sending…
                            </>
                        ) : (
                            <>
                                <SendIcon className="w-3.5 h-3.5" />
                                Send {activeChannel === 'whatsapp' ? 'WhatsApp' : activeChannel === 'email' ? 'Email' : 'Invite'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ComposeMessageModal;
