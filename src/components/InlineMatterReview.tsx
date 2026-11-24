import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Matter } from '../types';
import { BellIcon, BellPlusIcon, TrashIcon, CheckCircleIcon } from '../constants';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';
import { Button } from './ui';
import { Z_CLASS } from '../overlays/constants';

interface InlineMatterReviewProps {
    matter: Matter;
}

/** Review-reminder presets (owner brief 2026-11-24): the popover must show
 *  1 / 3 / 7 / 14 days (plus 1 month & custom) — and never clip: the menu
 *  renders through a document.body PORTAL with fixed positioning measured
 *  from the bell button, so no card/row `overflow-hidden` can cut it off. */
const PRESET_DAYS: Array<{ days: number; label: string }> = [
    { days: 1, label: '1 day' },
    { days: 3, label: '3 days' },
    { days: 7, label: '1 week' },
    { days: 14, label: '2 weeks' },
    { days: 30, label: '1 month' },
];

const InlineMatterReview: React.FC<InlineMatterReviewProps> = ({ matter }) => {
    const { updateItem } = useDataActions();
    const [isOpen, setIsOpen] = useState(false);
    const [showCustomDate, setShowCustomDate] = useState(false);
    const [customDateValue, setCustomDateValue] = useState('');
    const anchorRef = useRef<HTMLButtonElement | null>(null);
    const popoverRef = useRef<HTMLDivElement | null>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

    const reminder = matter.reviewReminder;

    const getDaysUntil = (isoString: string): number => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const target = new Date(isoString);
        target.setHours(0, 0, 0, 0);
        return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    };

    const daysUntil = reminder && !reminder.dismissed ? getDaysUntil(reminder.remindAt) : null;
    const isDue = daysUntil !== null && daysUntil <= 0;
    const isSoon = daysUntil !== null && daysUntil > 0 && daysUntil <= 3;

    const updateMatter = (updatedMatter: Matter) => {
        updateItem('matters', updatedMatter, updatedMatter.title);
        setIsOpen(false);
        setShowCustomDate(false);
        setCustomDateValue('');
    };

    const setReminder = (days: number) => {
        const date = new Date();
        date.setDate(date.getDate() + days);
        updateMatter({
            ...matter,
            reviewReminder: { remindAt: date.toISOString(), dismissed: false }
        });
    };

    const handleCustomDateSubmit = () => {
        if (!customDateValue) return;
        updateMatter({
            ...matter,
            reviewReminder: { remindAt: new Date(customDateValue).toISOString(), dismissed: false }
        });
    };

    const clearReminder = (e: React.MouseEvent) => {
        e.stopPropagation();
        updateMatter({ ...matter, reviewReminder: undefined });
    };

    const dismissReminder = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (reminder) {
            updateMatter({ ...matter, reviewReminder: { ...reminder, dismissed: true } });
        }
    };

    const formatDate = (isoString: string) => {
        return new Date(isoString).toLocaleDateString("en-GB", { month: 'short', day: 'numeric' });
    };

    // ── Portal positioning: measure the bell, place the menu BELOW-RIGHT of
    //    it in viewport coordinates; clamp so it never runs off the screen.
    useLayoutEffect(() => {
        if (!isOpen || !anchorRef.current) return;
        const rect = anchorRef.current.getBoundingClientRect();
        const MENU_W = 176; // w-44
        const MENU_H = showCustomDate ? 170 : 236;
        let left = Math.min(rect.left, window.innerWidth - MENU_W - 8);
        left = Math.max(8, left);
        let top = rect.bottom + 6;
        if (top + MENU_H > window.innerHeight - 8) {
            // Flip above the bell when the menu would clip the bottom edge.
            top = Math.max(8, rect.top - MENU_H - 6);
        }
        setMenuPos({ top, left });
    }, [isOpen, showCustomDate]);

    // Outside-click / Escape closes (and cancels the custom-date step).
    useEffect(() => {
        if (!isOpen) return;
        const onPointerDown = (e: PointerEvent | MouseEvent) => {
            if (
                anchorRef.current && !anchorRef.current.contains(e.target as Node) &&
                popoverRef.current && !popoverRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
                setShowCustomDate(false);
            }
        };
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
                setShowCustomDate(false);
            }
        };
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isOpen]);

    if (reminder && !reminder.dismissed) {
        return (
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-3xs font-bold transition-all group ${
                isDue ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                isSoon ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            }`} onClick={(e) => e.stopPropagation()}>
                <BellIcon className="w-3 h-3 flex-shrink-0" />
                <span className="whitespace-nowrap">
                    {isDue ? 'Review overdue' : isSoon ? `Review in ${daysUntil} day${daysUntil === 1 ? '' : 's'}` : `Review ${formatDate(reminder.remindAt)}`}
                </span>

                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity ml-1">
                    {isDue && (
                        <button onClick={dismissReminder} aria-label="Mark Done" title="Mark Done" className="hover:text-green-600 bg-white/50 dark:bg-black/20 rounded p-0.5">
                            <CheckCircleIcon className="w-3 h-3" />
                        </button>
                    )}
                    <button onClick={clearReminder} aria-label="Clear Reminder" title="Clear Reminder" className="hover:text-red-500 bg-white/50 dark:bg-black/20 rounded p-0.5">
                        <TrashIcon className="w-3 h-3" />
                    </button>
                </div>
            </div>
        );
    }

    const menu = !isOpen ? null : (
        <div
            ref={popoverRef}
            style={menuPos ? { position: 'fixed', top: menuPos.top, left: menuPos.left } : { position: 'fixed', top: -9999, left: -9999 }}
            className={`w-44 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl p-2 animate-fade-in-up ${Z_CLASS.panelOverlay}`}
            onClick={(e) => e.stopPropagation()}
            role="menu"
            aria-label="Review matter in"
        >
            {!showCustomDate ? (
                <>
                    <div className="text-3xs font-bold text-slate-400 uppercase tracking-wider mb-1 px-1">Review Matter In:</div>
                    <div className="flex flex-col gap-0.5">
                        {PRESET_DAYS.map((preset) => (
                            <Button
                                key={preset.days}
                                variant="bare"
                                size="sm"
                                onClick={() => setReminder(preset.days)}
                                className="text-left px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:hover:bg-zinc-700 rounded text-slate-700 dark:text-zinc-200 transition-colors justify-start"
                            >
                                {preset.label}
                            </Button>
                        ))}
                        <div className="h-px bg-slate-100 dark:bg-zinc-700 my-0.5" />
                        <Button
                            variant="bare"
                            size="sm"
                            onClick={() => setShowCustomDate(true)}
                            className="text-left px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:hover:bg-zinc-700 rounded text-slate-700 dark:text-zinc-200 transition-colors justify-start"
                        >
                            Custom...
                        </Button>
                    </div>
                </>
            ) : (
                <div className="flex flex-col gap-2">
                    <div className="text-3xs font-bold text-slate-400 uppercase tracking-wider px-1">Select Date:</div>
                    <input autoComplete="off" data-lpignore="true"
                        type="date"
                        value={customDateValue}
                        onChange={e => setCustomDateValue(e.target.value)}
                        className="w-full text-xs px-2 py-1 rounded border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200"
                    />
                    <div className="flex items-center gap-1 mt-1">
                        <Button
                            variant="bare"
                            size="sm"
                            onClick={() => setShowCustomDate(false)}
                            className="flex-1 py-1 text-2xs font-bold rounded bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 justify-center"
                        >
                            Back
                        </Button>
                        <Button
                            variant="bare"
                            size="sm"
                            disabled={!customDateValue}
                            onClick={handleCustomDateSubmit}
                            className="flex-1 py-1 text-2xs font-bold rounded bg-primary-600 text-white justify-center disabled:opacity-50"
                        >
                            Set
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <div className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
            <Button
                ref={anchorRef}
                variant="bare"
                size="sm"
                iconOnly
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 flex items-center justify-center p-1.5 rounded-md text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-all shadow-sm sm:shadow-none"
                title="Set Review Reminder"
                aria-label="Set review reminder"
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <BellPlusIcon className="w-3.5 h-3.5" />
            </Button>
            {/* PORTAL: renders at document.body — immune to the matter card's
                overflow-hidden, so every preset is fully visible & clickable. */}
            {createPortal(menu, document.body)}
        </div>
    );
};

export default InlineMatterReview;
