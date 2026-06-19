import React from 'react';
import { AloaIcon } from '../../constants';
import { useAloa } from '../../contexts/AloaProvider';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';
import { getAssistantName, getAssistantFullName } from '../../utils/assistantIdentity';

const AloaHelpModal: React.FC = () => {
    const { togglePanel } = useAloa();
    const { closeModal } = useUI();
    const { isProperty } = useProduct();
    const assistantName = getAssistantName(isProperty);
    const assistantFullName = getAssistantFullName(isProperty);

    const handleTryDemo = () => {
        closeModal();
        // A small delay to ensure the modal is closed before opening ARIA
        setTimeout(() => {
            togglePanel();
        }, 300);
    };

    return (
        <div className="space-y-6 text-sm text-slate-600 dark:text-zinc-300">
            <div className="text-center">
                <AloaIcon className="w-16 h-16 mx-auto text-primary-500" />
                <h3 className="text-2xl font-bold mt-2 text-slate-900 dark:text-white">{assistantName}®: {isProperty ? 'Your AI Assistant' : 'Your AI Paralegal'}</h3>
                <p className="mt-1">{assistantName}® ({assistantFullName}) is designed to be your proactive {isProperty ? 'property assistant' : 'legal assistant'}, helping you manage your {isProperty ? 'operations' : 'practice'} more efficiently.</p>
            </div>

            <div>
                <h4 className="font-bold text-lg mb-2 text-slate-800 dark:text-white">What {assistantName}® Can Do</h4>
                <ul className="space-y-2">
                    <li className="flex gap-3"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span><strong>{isProperty ? 'Summarize property documents' : 'Summarize legal documents'}</strong> to get the key points instantly.</span></li>
                    <li className="flex gap-3"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span><strong>Find deadlines</strong> {isProperty ? 'based on Nigerian property regulations' : 'based on Nigerian court rules'}.</span></li>
                    <li className="flex gap-3"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span><strong>Navigate anywhere</strong> in your workspace with commands.</span></li>
                    <li className="flex gap-3"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span><strong>Create tasks, events, or {isProperty ? 'properties' : 'matters'}</strong> directly from chat.</span></li>
                    <li className="flex gap-3"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-500 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg><span>Give you your <strong>Daily Briefing</strong> on critical items.</span></li>
                </ul>
            </div>

            <div>
                <h4 className="font-bold text-lg mb-2 text-slate-800 dark:text-white">How to Talk to {assistantName}®</h4>
                <p>Use natural language for your requests. Here are some examples:</p>
                <div className="mt-2 space-y-1 text-sm bg-slate-100 dark:bg-zinc-700/50 p-3 rounded-md">
                    <p className="font-mono">"Go to my {isProperty ? 'properties' : 'matters'}"</p>
                    <p className="font-mono">"What are my overdue tasks?"</p>
                    <p className="font-mono">{isProperty ? '"Create a new task to schedule inspection by Tuesday"' : '"Create a new task to file response by Tuesday"'}</p>
                </div>
            </div>
            
            <div>
                <h4 className="font-bold text-lg mb-2 text-slate-800 dark:text-white">Privacy & Data</h4>
                <p>{assistantName}® processes your text commands via Google Gemini's secure API. Your prompts are used to provide responses but are not stored to train the model. PracticePro never stores private {isProperty ? 'occupant' : 'client'} data within the AI's memory.</p>
            </div>

            <div className="pt-4 flex justify-center">
                <button
                    onClick={handleTryDemo}
                    className="px-6 py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-colors shadow-sm"
                >
                    Try a Demo Conversation
                </button>
            </div>
        </div>
    );
};

export default AloaHelpModal;