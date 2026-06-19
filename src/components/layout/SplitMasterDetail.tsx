
import React, { useState } from 'react';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronRightIcon, ChevronDownIcon, ListIcon } from '../../constants';

const BackIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
);

interface SplitMasterDetailProps {
    sidebarContent: React.ReactNode;
    detailContent: React.ReactNode;
    isDetailVisible: boolean;
    onCloseDetail: () => void;
    title: string;
}

export const SplitMasterDetail: React.FC<SplitMasterDetailProps> = ({
    sidebarContent,
    detailContent,
    isDetailVisible,
    onCloseDetail,
    title
}) => {
    const { activePeers } = useUI();
    const { currentUser } = useAuth();

    return (
        <div className="flex h-full w-full overflow-hidden bg-white dark:bg-zinc-900 relative">
            
            {/* --- MASTER PANE (Sidebar) --- */}
            <div
                className={`
                    flex-col h-full flex-shrink-0
                    bg-slate-50 dark:bg-zinc-900/50
                    border-r border-slate-200 dark:border-zinc-700
                    overflow-hidden relative
                    ${isDetailVisible ? 'hidden md:flex' : 'flex w-full md:w-auto'}
                    md:w-[340px] lg:w-[400px] xl:w-[440px]
                    landscape:md:w-[320px] landscape:lg:w-[380px]
                `}
            >
                {/* Content Container */}
                <div className="h-full flex flex-col opacity-100 visible">
                    {/* Header that contains the toggle */}
                    <div className="relative flex-grow flex flex-col overflow-hidden">
                        {sidebarContent}
                    </div>
                </div>
            </div>

            {/* --- DETAIL PANE --- */}
            <div 
                className={`
                    flex-col h-full flex-1 min-w-0 relative
                    bg-white dark:bg-zinc-900
                    ${isDetailVisible ? 'flex w-full fixed inset-0 z-20 pt-16 md:pt-0 md:static md:z-0' : 'hidden md:flex'}
                `}
            >
                {/* Mobile Header (Back Button) */}
                {/* Presence indicator removed as it now lives in the Global Header */}
                <div className="md:hidden flex-shrink-0 flex items-center justify-between px-4 h-16 border-b border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-sm absolute top-0 left-0 right-0 z-30">
                    <div className="flex items-center">
                        <button 
                            onClick={onCloseDetail}
                            className="flex items-center text-slate-600 dark:text-slate-300 mr-3 active:text-primary-600"
                        >
                            <BackIcon />
                            <span className="ml-1 text-sm font-semibold">Back</span>
                        </button>
                        <span className="font-bold truncate text-sm text-slate-900 dark:text-white">{title}</span>
                    </div>
                </div>
                
                {/* Desktop Content Container */}
                <div className="relative flex-1 overflow-hidden flex flex-col">
                    {/* Detail Content */}
                    <div className="flex-1 flex flex-col min-h-0">
                        {detailContent ? detailContent : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-zinc-700 animate-fade-in p-8 text-center">
                                <div className="mb-6 opacity-50 text-slate-400 dark:text-zinc-600">
                                    <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <p className="text-xl font-medium text-slate-500 dark:text-zinc-500">Select an item to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
