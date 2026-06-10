import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useUI } from '../../contexts/UIContext';
import { MattersIcon, PlusIcon } from '../../constants';
import { timeAgo } from '../../utils/colorUtils';

const ClientDashboard: React.FC = () => {
    const { currentUser } = useAuth();
    const { matterState } = useMatterState();
    const { navigateTo, openModal } = useUI();

    if (!currentUser || currentUser.role !== 'Client') {
        return <div>Access Denied.</div>;
    }

    const clientContact = matterState.contacts.find(c => c.userId === currentUser.id);
    const clientMatters = clientContact 
        ? matterState.matters.filter(m => m.clientId === clientContact.id) 
        : [];

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white">Your Matters</h2>
                <button
                    onClick={() => openModal('newLead', null, { name: currentUser.name, email: currentUser.email, isClientRequest: true })}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 text-sm flex items-center justify-center sm:justify-start gap-2"
                >
                    <PlusIcon className="w-5 h-5" />
                    Request Another Service
                </button>
            </div>
            {clientMatters.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-zinc-800 rounded-lg shadow-md">
                    <MattersIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-white">No Matters Found</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">There are no matters currently associated with your account.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clientMatters.map(matter => (
                        <div
                            key={matter.id}
                            onClick={() => navigateTo('matterDetail', matter.id)}
                            className="bg-white dark:bg-zinc-800 rounded-lg shadow-md p-6 cursor-pointer hover:shadow-xl transition-shadow duration-300 group hover:-translate-y-1"
                        >
                            <h3 className="font-bold text-lg text-primary-600 dark:text-primary-400 group-hover:underline truncate">{matter.title}</h3>
                            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Suit No: {matter.suitNumber || 'N/A'}</p>
                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-700 text-xs text-slate-500 dark:text-zinc-400">
                                <p><strong>Stage:</strong> {matter.stage}</p>
                                <p><strong>Last Update:</strong> {timeAgo(matter.stageLastUpdated)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ClientDashboard;