import React from 'react';
import { Lead } from '../../types';
import { ClientIntakeRecorder } from './ClientIntakeRecorder';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';

import { useUI } from '../../contexts/UIContext';

export const ClientIntakePortal: React.FC = () => {
    const { coreState, isDataLoaded } = useCoreState();
    const { handleCancelIntakeRequest } = useDataActions();
    const { selectedId: leadId } = useUI();

    const lead = coreState.leads.find(l => l.id === leadId);

    if (!lead) return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
            <p className="text-lg font-medium">Request not found</p>
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
            
            <ClientIntakeRecorder lead={lead} />

            <div className="mt-6 text-center">
                <button
                    onClick={() => handleCancelIntakeRequest(lead.id)}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                >
                    Cancel and Return to Dashboard
                </button>
            </div>
        </div>
    );
};
