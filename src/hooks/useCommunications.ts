
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
        addToast(`Sending email to ${data.to[0]}...`, { type: 'info' });
        try {
            const result = await convex.action(api.communications.sendEmail, {
                to: data.to[0],
                subject: data.subject,
                htmlContent: data.body,
                firmId: currentUser?.firmId || '',
                recordLog: true,
            });
            
            if (result.success) {
                addToast(`Email sent successfully.`, { type: 'success' });
                if (actions.logActivity) {
                    actions.logActivity('Sent Email', 'Contact', undefined, data.subject, data.matterId);
                }
            } else {
                addToast(`Failed to send email: ${result.error}`, { type: 'error' });
            }
        } catch (e) {
            console.error('[useCommunications] Failed to send email:', e);
            addToast(`Failed to send email.`, { type: 'error' });
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
