
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
        // In a real system, this would send an email/notification to the client
        await actions.addItem('notifications', {
            userId: 'client', // Placeholder
            title: 'Document Request',
            message: `A ${type} has been requested for your matter.`,
            type: 'document',
            isRead: false,
            createdAt: new Date().toISOString(),
            firmId: currentUser?.firmId,
        }, 'Notification');
        addToast("Request sent to client.", { type: 'success' });
    }, [currentUser, actions, addToast]);

    return {
        handleSendEmail,
        handleRequestFinancialDocument,
    };
};
