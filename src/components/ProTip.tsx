
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTipManager } from '../hooks/useTipManager';
import { InfoIcon } from '../constants';

interface ProTipProps {
    id: string;
    children: React.ReactNode;
}

const ProTip: React.FC<ProTipProps> = ({ id, children }) => {
    const { isTipVisible, dismissTip, snoozeTip } = useTipManager();
    const [isRendered, setIsRendered] = React.useState(isTipVisible(id, 'Pro-Tip'));
    const [isExiting, setIsExiting] = React.useState(false);

    const [isSnoozeOpen, setSnoozeOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const snoozeBtnRef = useRef<HTMLButtonElement>(null);
    const [snoozePos, setSnoozePos] = useState({ top: 0, left: 0 });

    React.useEffect(() => {
        const shouldBeVisible = isTipVisible(id, 'Pro-Tip');
        if (shouldBeVisible) {
            setIsRendered(true);
            setIsExiting(false);
        } else if (isRendered) {
            setIsExiting(true);
        }
    }, [isTipVisible, id, isRendered]);

    // Close snooze on click outside
    useEffect(() => {
        if (!isSnoozeOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (snoozeBtnRef.current && !snoozeBtnRef.current.contains(target)) {
                // Also check if click is inside the portal dropdown
                const portalEl = document.getElementById('snooze-portal-dropdown');
                if (portalEl && portalEl.contains(target)) return;
                setSnoozeOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isSnoozeOpen]);

    // Calculate snooze dropdown position when opening
    useEffect(() => {
        if (isSnoozeOpen && snoozeBtnRef.current) {
            const rect = snoozeBtnRef.current.getBoundingClientRect();
            setSnoozePos({
                top: rect.bottom + 4,
                left: rect.right - 112, // 112px = w-28 dropdown width, right-aligned
            });
        }
    }, [isSnoozeOpen]);

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
            className={`relative overflow-hidden group bg-primary-50 dark:bg-primary-900/50 p-4 rounded-lg border-l-4 border-primary-500 flex items-start gap-4 shadow-sm ${isExiting ? 'animate-tip-exit' : 'animate-tip-enter'}`}
        >
            {/* Background Icon - contained by overflow-hidden on parent */}
            <InfoIcon className="absolute -bottom-4 -right-4 w-24 h-24 text-primary-500/10 dark:text-primary-400/5 pointer-events-none" />

            <div className="flex-shrink-0 mt-1 z-10">
                <InfoIcon className="w-5 h-5 text-primary-600" />
            </div>
            <div className="flex-grow z-10">
                <h4 className="font-bold text-primary-900 dark:text-primary-100 mb-1">Pro-Tip</h4>
                <p className="text-sm text-primary-800 dark:text-primary-200 leading-relaxed">{children}</p>
            </div>
            <div className="relative z-20 flex items-center gap-1 opacity-100 transition-opacity">
                {/* Snooze button — dropdown rendered via Portal to avoid
                    clipping by parent's overflow-hidden. Previously the
                    dropdown was position:absolute inside the overflow-hidden
                    container, causing it to be cropped. */}
                <button
                    ref={snoozeBtnRef}
                    onClick={(e) => { e.stopPropagation(); setSnoozeOpen(p => !p); }}
                    className="p-1 rounded-full text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50"
                    aria-label="Snooze tip"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-1.707 1.707A1 1 0 003 15h14a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-2zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" /></svg>
                </button>
                {/* Portal dropdown — rendered to document.body, NOT inside
                    the overflow-hidden parent. Positions beneath the bell icon. */}
                {isSnoozeOpen && createPortal(
                    <div
                        id="snooze-portal-dropdown"
                        className="fixed z-[9999] w-28 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg animate-fade-in"
                        style={{ top: snoozePos.top, left: snoozePos.left }}
                    >
                        <button onClick={(e) => handleSnooze(e, 1)} className="block w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-t-md">For 1 Day</button>
                        <button onClick={(e) => handleSnooze(e, 7)} className="block w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-b-md">For 1 Week</button>
                    </div>,
                    document.body
                )}
                <button
                    onClick={handleDismiss}
                    className="p-1 rounded-full text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50"
                    aria-label="Dismiss tip"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414-1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </button>
            </div>
        </div>
    );
};

export default ProTip;
