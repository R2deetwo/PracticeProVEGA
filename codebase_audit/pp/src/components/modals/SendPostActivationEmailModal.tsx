import React from 'react';
import { useUI } from '../../contexts/UIContext';
import { MailIcon } from '../../constants';
import { useCoreState } from '../../contexts/CoreContext';

const SendPostActivationEmailModal: React.FC = () => {
    const { closeModal, modalContext, addToast } = useUI();
    const { coreState, isDataLoaded } = useCoreState();
    const { email, name, content } = modalContext || {};

    const handleSend = () => {
        addToast(`Post-activation email sent to ${name}.`, { type: 'success' });
        closeModal();
    };

    if (!email || !name) {
        return <p>Error: Could not load email content.</p>;
    }
    
    const emailContent = content || `Dear ${name},\n\nThank you for completing our intake process. We have activated your matter with our firm and created a secure client portal for you.\n\nYou will receive a separate email shortly with instructions on how to log in.\n\nWe look forward to working with you.\n\nSincerely,\nThe Team at ${coreState.firmDetails.name}`;

    return (
        <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-zinc-400">
                This is the AI-drafted email ready to send to your new client, <strong>{name}</strong>. You can edit it before sending.
            </p>

            <div className="border border-slate-200 dark:border-zinc-700 rounded-lg p-4 bg-slate-50 dark:bg-zinc-900/50">
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                    <p><span className="font-semibold">From:</span> {coreState.firmDetails.name}</p>
                    <p><span className="font-semibold">To:</span> {email}</p>
                </div>
                <h3 className="font-bold text-lg mt-2">Subject: Next Steps for Your Matter</h3>
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-700 text-sm">
                    <textarea
                        defaultValue={emailContent}
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
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                    <MailIcon className="w-4 h-4" />
                    Send Email
                </button>
            </div>
        </div>
    );
};

export default SendPostActivationEmailModal;