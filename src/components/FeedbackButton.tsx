import React from 'react';
import { useUI } from '../contexts/UIContext';

const FeedbackIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
);

/**
 * FeedbackButton — inline (non-floating) button for submitting feedback.
 * Rendered only in Settings > My Profile > General tab.
 */
const FeedbackButton: React.FC = () => {
    const { openModal } = useUI();

    return (
        <div className="mt-2">
            <button
                onClick={() => openModal('feedback')}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 dark:bg-zinc-800/60 text-slate-600 dark:text-zinc-300 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700/60 transition-all"
                aria-label="Provide feedback"
            >
                <FeedbackIcon />
                <span className="font-semibold text-sm">Share Feedback</span>
            </button>
        </div>
    );
};

export default FeedbackButton;
