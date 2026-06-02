import React from 'react';
import { useUI } from '../contexts/UIContext';

const FeedbackIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
);

const FeedbackButton: React.FC = () => {
    const { openModal } = useUI();

    return (
        <div className="fixed bottom-40 right-4 z-50 md:bottom-28 md:right-8">
            <button
                onClick={() => openModal('feedback')}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 rounded-full shadow-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all transform hover:scale-105"
                aria-label="Provide feedback"
            >
                <FeedbackIcon />
                <span className="font-semibold text-sm hidden sm:inline">Feedback</span>
            </button>
        </div>
    );
};

export default FeedbackButton;
