
import React from 'react';
import { LockClosedIcon, GridIcon, ListIcon } from '../constants';

interface ViewToggleProps {
    viewMode: 'list' | 'board';
    onViewModeChange: (mode: 'list' | 'board') => void;
    isLocked: boolean;
    onLock: () => void;
}

const ViewToggle: React.FC<ViewToggleProps> = ({ viewMode, onViewModeChange, isLocked, onLock }) => {
    return (
        <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg border border-slate-200 dark:border-zinc-700">
            <button
                onClick={() => onViewModeChange('list')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-zinc-700 shadow text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="List View"
            >
                <ListIcon className="w-4 h-4" />
            </button>
            <button
                onClick={() => onViewModeChange('board')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'board' ? 'bg-white dark:bg-zinc-700 shadow text-primary-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="Board View"
            >
                <GridIcon className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-slate-200 dark:bg-zinc-700 mx-1 self-center"></div>
            <button
                onClick={onLock}
                className="p-1.5 rounded-md transition-all hover:bg-white dark:hover:bg-zinc-700"
                title="Lock as default view"
            >
                <LockClosedIcon className={`w-4 h-4 ${isLocked ? 'text-primary-500' : 'text-slate-400'}`} />
            </button>
        </div>
    );
};

export default ViewToggle;