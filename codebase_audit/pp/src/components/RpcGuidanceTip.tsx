import React, { useState, useRef, useEffect } from 'react';
import { useTipManager } from '../hooks/useTipManager';

const RpcIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.257 3.099c.636-1.21 2.864-1.21 3.5 0l5.882 11.238c.64 1.22-.44 2.663-1.75 2.663H4.115c-1.31 0-2.39-1.443-1.75-2.663L8.257 3.099zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-4a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
);


interface RpcGuidanceTipProps {
    id: string;
    children: React.ReactNode;
}

const RpcGuidanceTip: React.FC<RpcGuidanceTipProps> = ({ id, children }) => {
    const { isTipVisible, dismissTip, snoozeTip } = useTipManager();
    const [isRendered, setIsRendered] = React.useState(isTipVisible(id, 'Workflow'));
    const [isExiting, setIsExiting] = React.useState(false);

    const [isSnoozeOpen, setSnoozeOpen] = useState(false);
    const [popoverPosition, setPopoverPosition] = useState<'top' | 'bottom'>('bottom');
    const containerRef = useRef<HTMLDivElement>(null);
    const snoozeButtonRef = useRef<HTMLButtonElement>(null);
    
    React.useEffect(() => {
        const shouldBeVisible = isTipVisible(id, 'Workflow');
        if (shouldBeVisible) {
            setIsRendered(true);
            setIsExiting(false);
        } else if (isRendered) {
            setIsExiting(true);
        }
    }, [isTipVisible, id, isRendered]);

    useEffect(() => {
        if (isSnoozeOpen && snoozeButtonRef.current) {
            const rect = snoozeButtonRef.current.getBoundingClientRect();
            if (window.innerHeight - rect.bottom < 120) {
                setPopoverPosition('top');
            } else {
                setPopoverPosition('bottom');
            }
        }
    }, [isSnoozeOpen]);
    
     useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setSnoozeOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDismiss = (e: React.MouseEvent) => {
        e.stopPropagation();
        dismissTip(id);
    };
    
    const handleSnooze = (e: React.MouseEvent, days: number) => {
        e.stopPropagation();
        snoozeTip(id, days);
        setSnoozeOpen(false);
    };

    const handleAnimationEnd = () => {
        if (isExiting) {
            setIsRendered(false);
        }
    };

    if (!isRendered) {
        return null;
    }

    return (
        <div 
            ref={containerRef}
            onAnimationEnd={handleAnimationEnd}
            className={`relative overflow-hidden group bg-yellow-50 dark:bg-yellow-900/50 p-4 rounded-lg border-l-4 border-yellow-400 dark:border-yellow-600 flex items-start gap-4 ${isExiting ? 'animate-tip-exit' : 'animate-tip-enter'}`}
        >
            <RpcIcon className="absolute -bottom-4 -right-4 w-24 h-24 text-yellow-500/10 dark:text-yellow-400/5" />
            <div className="flex-shrink-0 mt-1 z-10">
                <RpcIcon className="w-5 h-5 text-yellow-500" />
            </div>
            <div className="flex-grow z-10">
                <h4 className="font-bold text-yellow-800 dark:text-yellow-200">RPC Guidance</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">{children}</p>
            </div>
            <div className="relative z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button
                    ref={snoozeButtonRef}
                    onClick={(e) => { e.stopPropagation(); setSnoozeOpen(p => !p); }}
                    className="p-1 rounded-full text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                    aria-label="Snooze tip"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-1.707 1.707A1 1 0 003 15h14a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
                </button>
                 {isSnoozeOpen && (
                    <div className={`absolute right-0 w-28 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50 ${popoverPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                        <button onClick={(e) => handleSnooze(e, 1)} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-600">For 1 Day</button>
                        <button onClick={(e) => handleSnooze(e, 7)} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-600">For 1 Week</button>
                    </div>
                )}
                <button
                    onClick={handleDismiss}
                    className="p-1 rounded-full text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/50"
                    aria-label="Dismiss tip"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
            </div>
        </div>
    );
};

export default RpcGuidanceTip;