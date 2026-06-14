import React, { useState } from 'react';
import { useUI } from '../../contexts/UIContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { MailIcon } from '../../constants';

const SendPostActivationEmailModal: React.FC = () => {
    const { closeModal, modalContext, addToast } = useUI();
    const { coreState, isDataLoaded } = useCoreState();
    const convex = useConvex();
    const { email, name, content } = modalContext || {};
    const [isSending, setIsSending] = useState(false);
    const [editableContent, setEditableContent] = useState(
        content || `Dear ${name},\n\nThank you for completing our intake process. We have activated your matter with our firm and created a secure client portal for you.\n\nYou will receive a separate email shortly with instructions on how to log in.\n\nWe look forward to working with you.\n\nSincerely,\nThe Team at ${coreState.firmDetails?.name || 'our firm'}`
    );

    const handleSend = async () => {
        if (!email) {
            addToast('No email address found for this client.', { type: 'error' });
            return;
        }
        setIsSending(true);
        try {
            const result = await convex.action(api.communications.sendEmail, {
                to: email,
                subject: 'Next Steps for Your Matter',
                htmlContent: editableContent.replace(/\n/g, '<br/>'),
                firmId: coreState.firmDetails?.id || '',
                recordLog: true,
            });

            if (result.success) {
                addToast(`Post-activation email sent to ${name}.`, { type: 'success' });
                closeModal();
            } else if (result.simulated) {
                addToast(`Email simulated (Brevo not configured). Post-activation email prepared for ${name}.`, { type: 'info' });
                closeModal();
            } else {
                addToast(`Failed to send email: ${result.error || 'Unknown error'}`, { type: 'error' });
            }
        } catch (err: any) {
            console.error('[SendPostActivationEmailModal] Failed:', err);
            addToast(err.message || 'Failed to send email. Please try again.', { type: 'error' });
        } finally {
            setIsSending(false);
        }
    };

    if (!email || !name) {
        return <p className="text-sm text-red-500">Error: Could not load email content — missing client email or name.</p>;
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-zinc-400">
                This is the AI-drafted email ready to send to your new client, <strong>{name}</strong>. You can edit it before sending.
            </p>

            <div className="border border-slate-200 dark:border-zinc-700 rounded-lg p-4 bg-slate-50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                    <p><span className="font-semibold">From:</span> {coreState.firmDetails?.name || 'Firm'}</p>
                    <p><span className="font-semibold">To:</span> {email}</p>
                </div>
                <h3 className="font-bold text-lg mt-2">Subject: Next Steps for Your Matter</h3>
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-700 text-sm">
                    <textarea
                        value={editableContent}
                        onChange={(e) => setEditableContent(e.target.value)}
                        rows={10}
                        className="w-full p-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-md"
                    />
                </div>
            </div>
             <div className="pt-4 flex flex-col sm:flex-row justify-end gap-2">
                <button type="button" onClick={() => closeModal()} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                    Close
                </button>
                 <button 
                    type="button"
                    onClick={handleSend}
                    disabled={isSending}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <MailIcon className="w-4 h-4" />
                    {isSending ? 'Sending...' : 'Send Email'}
                </button>
            </div>
        </div>
    );
};

export default SendPostActivationEmailModal;
