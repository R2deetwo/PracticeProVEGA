import React, { useState } from 'react';
import { Lead } from '../../types';
import { ClientIntakeRecorder } from './ClientIntakeRecorder';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { useConfirm } from '../ui/ConfirmDialog';

export const ClientIntakePortal: React.FC = () => {
    const { coreState, isDataLoaded } = useCoreState();
    const { handleCancelIntakeRequest } = useDataActions();
    const { selectedId: leadId, navigateTo, addToast } = useUI();
    const [isCancelling, setIsCancelling] = useState(false);
    const { confirm, ConfirmDialog } = useConfirm();

    const lead = coreState.leads.find(l => l.id === leadId);

    // Show loading skeleton while data is still being fetched
    if (!lead && !isDataLoaded) return (
        <div className="h-full flex flex-col items-center justify-center p-8">
            <div className="w-full max-w-md bg-white dark:bg-zinc-800 rounded-xl p-6 animate-pulse">
                <div className="h-8 bg-slate-200 dark:bg-zinc-700 rounded w-3/4 mx-auto mb-4" />
                <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-full mb-2" />
                <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-2/3 mx-auto mb-8" />
                <div className="h-32 bg-slate-200 dark:bg-zinc-700 rounded w-full" />
            </div>
        </div>
    );

    // Only show "not found" after data has finished loading
    if (!lead && isDataLoaded) return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
            <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-700 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            </div>
            <p className="text-lg font-medium text-slate-700 dark:text-zinc-200">Request not found</p>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">This intake request may have been removed or the link is invalid.</p>
            <button
                onClick={() => navigateTo('dashboard')}
                className="mt-4 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
            >
                Back to Dashboard
            </button>
        </div>
    );


    return (
        <div>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-md p-6 mb-6 text-center">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">New Service Request</h2>
                <p className="mt-2 text-slate-600 dark:text-zinc-300 max-w-2xl mx-auto">
                    Thank you for choosing {coreState.firmDetails.name}. To get started, please use the intake assistant below to tell us about your new legal issue.
                </p>
            </div>
            
            <ClientIntakeRecorder lead={lead!} />

            <div className="mt-6 text-center">
                <button
                    onClick={async () => {
                        const ok = await confirm({
                            title: 'Cancel intake request?',
                            message: 'Are you sure you want to cancel this intake request? Any information entered will be lost.',
                            confirmLabel: 'Cancel Request',
                            cancelLabel: 'Keep Editing',
                            danger: true,
                        });
                        if (!ok) return;
                        setIsCancelling(true);
                        try {
                            await handleCancelIntakeRequest(lead.id);
                            addToast('Intake request cancelled', { type: 'info' });
                            navigateTo('dashboard');
                        } catch {
                            addToast('Failed to cancel request. Please try again.', { type: 'error' });
                        } finally {
                            setIsCancelling(false);
                        }
                    }}
                    disabled={isCancelling}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isCancelling ? 'Cancelling...' : 'Cancel and Return to Dashboard'}
                </button>
            </div>
            {ConfirmDialog}
        </div>
    );
};
