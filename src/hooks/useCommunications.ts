
import { useCallback } from 'react';
import { useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUI } from '../contexts/UIContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook for external communications (Email, WhatsApp).
 */
export const useCommunications = (actions: any) => {
    const { currentUser } = useAuth();
    const { addToast } = useUI();
    const convex = useConvex();

    const handleSendEmail = useCallback(async (data: any) => {
        // Guard against missing/empty recipients — previously `data.to[0]`
        // would throw a TypeError if data.to was undefined or empty.
        const recipients = Array.isArray(data?.to) ? data.to : (data?.to ? [data.to] : []);
        if (recipients.length === 0) {
            addToast('No recipient specified — cannot send email.', { type: 'error' });
            return;
        }
        addToast(`Sending email to ${recipients[0]}...`, { type: 'info' });
        try {
            // Send to the first recipient (the backend sendEmail action
            // accepts a single `to` address). If multiple recipients are
            // provided, we loop through them.
            const results: { email: string; success: boolean; error?: string }[] = [];
            for (const recipient of recipients) {
                const result = await convex.action(api.communications.sendEmail, {
                    to: recipient,
                    subject: data.subject,
                    htmlContent: data.body,
                    firmId: currentUser?.firmId || '',
                    recordLog: true,
                });
                results.push({ email: recipient, success: result.success, error: result.error });
            }

            const allSucceeded = results.every(r => r.success);
            const anySucceeded = results.some(r => r.success);

            if (allSucceeded) {
                addToast(`Email sent successfully to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}.`, { type: 'success' });
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
        } catch (e: any) {
            console.error('[useCommunications] Failed to send email:', e);
            addToast(e?.message || 'Failed to send email.', { type: 'error' });
        }
    }, [currentUser, convex, actions, addToast]);

    const handleRequestFinancialDocument = useCallback(async (matterId: string, type: string) => {
        addToast(`Requesting ${type} for matter...`, { type: 'info' });
        try {
            // Resolve the actual client userId from the matter's assigned client
            const matter = await convex.query(api.matters.getMatterById, { id: matterId });
            const clientId = matter?.clientId || matter?.clientIds?.[0];
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
