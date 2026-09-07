
import { useCallback } from 'react';
import { useConvex } from "convex/react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';
import { buildEmailHtml } from '../utils/emailTemplate';

/**
 * Hook for external communications (Email, WhatsApp).
 */
export const useCommunications = (actions: any) => {
    const { currentUser, bearerToken } = useAuth() as any;
    const { addToast } = useUI();
    const convex = useConvex();
    const logAutomation = useMutation(api.sentry.logAutomation);

    /**
     * Send an email via Brevo with the FIRM'S identity and a delivery
     * record. Reworked 2026-09-08 (user feedback: "the email name did not
     * show the name of the firm" + "where do I see the record of mails
     * sent?"):
     *   • sender display name = the firm's name (was hardcoded
     *     "PracticePro Systems");
     *   • reply-to = the sending staff member (normal email behaviour);
     *   • every attempt is written to automation_logs (the Outbox) with
     *     its real outcome + provider error — previously this path wrote
     *     NO record at all;
     *   • returns the aggregate result so callers can stay open on
     *     failure instead of closing over a fire-and-forget send.
     */
    const handleSendEmail = useCallback(async (data: any): Promise<{
        success: boolean;
        sentCount: number;
        failedCount: number;
        firstError?: string;
    }> => {
        // Guard against missing/empty recipients — previously `data.to[0]`
        // would throw a TypeError if data.to was undefined or empty.
        const recipients = Array.isArray(data?.to) ? data.to : (data?.to ? [data.to] : []);
        if (recipients.length === 0) {
            addToast('No recipient specified — cannot send email.', { type: 'error' });
            return { success: false, sentCount: 0, failedCount: 0 };
        }
        addToast(`Sending email to ${recipients[0]}...`, { type: 'info' });
        const firmName: string = data.firmName || currentUser?.firmName || 'PracticePro';
        const results: { email: string; success: boolean; error?: string }[] = [];
        for (const recipient of recipients) {
            let result: any;
            try {
                result = await convex.action(api.communications.sendEmail, {
                    to: recipient,
                    toName: data.toName || undefined,
                    senderName: firmName,
                    replyTo: currentUser?.email || undefined,
                    subject: data.subject,
                    htmlContent: buildEmailHtml({
                        firmName,
                        body: data.body || '',
                        footerNote: data.footerNote,
                    }),
                    firmId: currentUser?.firmId || '',
                });
            } catch (e: any) {
                result = { success: false, error: e?.message || 'Send failed' };
            }
            results.push({ email: recipient, success: result?.success, error: result?.error });

            // Delivery record — the Outbox row (fire-and-forget logging
            // must never break the send loop; a logging failure is logged
            // to console only).
            const status = result?.simulated ? 'simulated' : result?.success ? 'sent' : 'failed';
            try {
                await logAutomation({
                    firmId: currentUser?.firmId || '',
                    userEmail: currentUser?.email,
                    sessionToken: (bearerToken ?? undefined) || undefined,
                    messageType: 'custom' as const,
                    channel: 'email' as const,
                    recipient: String(recipient),
                    messagePreview: String(data.subject || '').slice(0, 200),
                    direction: 'outbound' as const,
                    senderName: currentUser?.name || firmName,
                    status,
                    errorMessage: status === 'failed' ? result?.error : undefined,
                    messageId: result?.messageId,
                    triggeredBy: currentUser?.id,
                });
            } catch (logErr) {
                console.error('[useCommunications] log write failed (email already attempted):', logErr);
            }
        }

        const allSucceeded = results.every(r => r.success);
        const anySucceeded = results.some(r => r.success);

        if (allSucceeded) {
            addToast(`Email sent successfully to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'} — recorded in Messages → Outbox.`, { type: 'success' });
            if (actions.logActivity) {
                actions.logActivity('Sent Email', 'Contact', undefined, data.subject, data.matterId);
            }
        } else if (anySucceeded) {
            const failed = results.filter(r => !r.success).map(r => r.email);
            addToast(`Email sent to some recipients, but failed for: ${failed.join(', ')}`, { type: 'warning' });
        } else {
            const firstError = results[0]?.error || 'Unknown error';
            addToast(`Failed to send email: ${firstError}`, { type: 'error' });
        }
        return {
            success: allSucceeded,
            sentCount: results.filter(r => r.success).length,
            failedCount: results.filter(r => !r.success).length,
            firstError: results.find(r => !r.success)?.error,
        };
    }, [currentUser, bearerToken, convex, actions, addToast, logAutomation]);

    const handleRequestFinancialDocument = useCallback(async (matterId: string, type: string) => {
        addToast(`Requesting ${type} for matter...`, { type: 'info' });
        try {
            // Resolve the actual client userId from the matter's assigned client.
            // FIX: previously called api.matters.getMatterById — a function that
            // does NOT exist (no convex/matters.ts module) — so this query threw
            // on every invocation and silently fell into the "could not reach
            // client" fallback. The client notification was NEVER delivered.
            // Use the real on-demand getMatterDetails query instead.
            const matter = await convex.query(api.myFunctions.getMatterDetails, {
                matterId,
                firmId: currentUser?.firmId || '',
                requestUserId: currentUser?.id,
            });
            const clientId = (matter as any)?.clientId || (matter as any)?.clientIds?.[0] || (matter as any)?.matter?.clientId;
            if (!clientId) {
                addToast("Could not identify the client for this matter. Request not sent.", { type: 'error' });
                return;
            }
            await actions.addItem('notifications', {
                userId: clientId,
                title: 'Document Request',
                message: `A ${type} has been requested for your matter.`,
                type: 'document',
                isRead: false,
                createdAt: new Date().toISOString(),
                firmId: currentUser?.firmId,
                link: { view: 'matterDetail', id: matterId, context: { initialTab: 'documents' } },
            }, 'Notification');
            addToast("Request sent to client.", { type: 'success' });
        } catch (e) {
            console.error('[handleRequestFinancialDocument] Failed:', e);
            // Fallback: still send notification to current user as a reminder
            await actions.addItem('notifications', {
                userId: currentUser?.id || '',
                title: 'Document Request Reminder',
                message: `A ${type} has been requested for matter ${matterId}. Client notification pending.`,
                type: 'document',
                isRead: false,
                createdAt: new Date().toISOString(),
                firmId: currentUser?.firmId,
            }, 'Notification');
            addToast("Request logged. Could not reach client — reminder saved.", { type: 'warning' });
        }
    }, [currentUser, actions, addToast, convex]);

    return {
        handleSendEmail,
        handleRequestFinancialDocument,
    };
};
