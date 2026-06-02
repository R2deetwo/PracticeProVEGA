import React from 'react';

interface AIConsentModalProps {
    onAccept: () => void;
    onDecline: () => void;
}

const AIConsentModal: React.FC<AIConsentModalProps> = ({ onAccept, onDecline }) => {
    return (
        <div className="p-2 sm:p-6 max-w-lg mx-auto">
            <div className="flex items-center justify-center w-16 h-16 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-full mb-6 mx-auto">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            
            <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white mb-2">AI Processing Consent</h2>
            
            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-4 mb-8 text-center px-2">
                <p>
                    PracticePro VEGA uses specialized AI Agents (ALOA, ALDIA, etc.) to assist with legal drafting, research, and data extraction.
                </p>
                <div className="bg-slate-50 dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700 text-left">
                    <ul className="list-disc pl-5 space-y-2">
                        <li><strong>Data Minimization:</strong> Only relevant data is processed by the AI.</li>
                        <li><strong>No Model Training:</strong> Your private case data is <strong>never</strong> used to train foundational AI models.</li>
                        <li><strong>Security:</strong> All inputs remain isolated within your firm's encrypted workspace.</li>
                        <li><strong>Oversight:</strong> The AI acts as a tool; human legal review is always required.</li>
                    </ul>
                </div>
                <p className="font-medium text-slate-700 dark:text-slate-200">
                    Do you consent to the processing of your queries and documents by our AI agents in accordance with our Terms of Service?
                </p>
            </div>
            
            <div className="flex gap-3">
                <button 
                    onClick={onDecline}
                    className="flex-1 py-3 px-4 border border-slate-300 dark:border-zinc-600 rounded-xl font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                >
                    Decline
                </button>
                <button 
                    onClick={onAccept}
                    className="flex-1 py-3 px-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 shadow-md transition-colors"
                >
                    I Consent
                </button>
            </div>
        </div>
    );
};

export default AIConsentModal;
