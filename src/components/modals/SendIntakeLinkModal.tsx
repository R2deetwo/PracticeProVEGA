
import React from 'react';
import { Lead, User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { MailIcon } from '../../constants';

const SendIntakeLinkModal: React.FC = () => {
  const { closeModal, addToast, editingId } = useUI();
  const { coreState, isDataLoaded } = useCoreState();
  const { loginAsUser } = useAuth();
  const lead = coreState.leads.find(l => l.id === editingId);
  
  if (!lead) {
    return <p>Error: Could not find lead information.</p>;
  }

  const handleViewAsClient = () => {
    const clientUser = coreState.users.find(u => u.email.toLowerCase() === lead.email.toLowerCase() && u.role === 'Client');
    if (clientUser) {
      loginAsUser(clientUser);
      closeModal();
    } else {
      addToast('Could not find the client user account for simulation.', { type: 'error' });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-zinc-400">
        This simulates the email a prospective client would receive. Click the button below to view the intake portal from the client's perspective.
      </p>

      <div className="border border-slate-200 dark:border-zinc-700 rounded-lg p-4 bg-slate-50 dark:bg-zinc-900">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <p><span className="font-semibold">From:</span> {coreState.firmDetails.name}</p>
          <p><span className="font-semibold">To:</span> {lead.email}</p>
        </div>
        <h3 className="font-bold text-lg mt-2">Subject: Your Legal Intake with {coreState.firmDetails.name}</h3>
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-700 text-sm space-y-3">
          <p>Dear {lead.name},</p>
          <p>Thank you for reaching out to our firm. To help us understand your needs better and get started on your case, please follow the link below to access our secure intake portal.</p>
          <div className="text-center py-4">
             <div className="px-6 py-3 bg-primary-600 text-white rounded-lg font-bold shadow-sm opacity-50 cursor-not-allowed">
              Access Secure Intake Portal (Link)
            </div>
          </div>
          <p>Sincerely,</p>
          <p>The Team at {coreState.firmDetails.name}</p>
        </div>
      </div>
       <div className="pt-4 flex flex-col sm:flex-row justify-end gap-2">
        {/* FIX: Wrapped closeModal in an arrow function to prevent passing the event object and causing a type error. */}
        <button type="button" onClick={() => closeModal()} className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl font-bold text-sm hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors">
          Close
        </button>
         <button 
          type="button"
          onClick={handleViewAsClient} 
          className="px-5 py-2 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 transition-colors shadow-md"
        >
          View Intake Portal as Client
        </button>
      </div>
    </div>
  );
};

export default SendIntakeLinkModal;
