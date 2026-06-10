
import React from 'react';
import { PlusIcon } from '../constants';

interface EmptyStateProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    actionLabel?: string;
    onAction?: () => void;
    secondaryActionLabel?: string;
    onSecondaryAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    icon,
    actionLabel,
    onAction,
    secondaryActionLabel,
    onSecondaryAction
}) => {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-8 text-center animate-fade-in w-full">
            <div className="mb-4">
                <div className="text-slate-300 dark:text-zinc-600 transform scale-100 mx-auto">
                    {icon}
                </div>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
            <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-sm mb-6 leading-relaxed">
                {description}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                {actionLabel && onAction && (
                    <button
                        onClick={onAction}
                        className="px-5 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <PlusIcon className="w-4 h-4" />
                        {actionLabel}
                    </button>
                )}
                {secondaryActionLabel && onSecondaryAction && (
                    <button
                        onClick={onSecondaryAction}
                        className="px-5 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all text-sm"
                    >
                        {secondaryActionLabel}
                    </button>
                )}
            </div>
        </div>
    );
};

export default EmptyState;
