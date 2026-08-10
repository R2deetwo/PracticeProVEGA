/**
 * PriorityPopover — Dropdown menu for task priority selection.
 *
 * Anchored directly below the trigger pill using getBoundingClientRect() +
 * position: fixed. Rendered via createPortal at document.body level to
 * escape any transformed ancestor containers (which break position: fixed).
 *
 * Auto-flips above if not enough space below. Viewport-clamped horizontally.
 * Follows the trigger on scroll/resize.
 */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Task, TaskPriority } from '../types';
import { PriorityHighIcon, PriorityMediumIcon, PriorityLowIcon } from '../constants';

interface PriorityPopoverProps {
    task: Task;
    onUpdate: (taskId: string, priority: Task['priority']) => void;
    onClose: () => void;
    anchorEl: HTMLElement | null;
}

const priorityOptions: { level: Task['priority']; label: string; icon: React.FC<{className?: string}>; colorClass: string }[] = [
    { level: TaskPriority.High, label: 'High', icon: PriorityHighIcon, colorClass: 'text-red-500' },
    { level: TaskPriority.Medium, label: 'Medium', icon: PriorityMediumIcon, colorClass: 'text-yellow-500' },
    { level: TaskPriority.Low, label: 'Low', icon: PriorityLowIcon, colorClass: 'text-blue-500' },
];

const PriorityPopover: React.FC<PriorityPopoverProps> = ({ task, onUpdate, onClose, anchorEl }) => {
    const popoverRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: -9999, left: -9999, opacity: 0 });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node) && anchorEl && !anchorEl.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [onClose, anchorEl]);

    // Measure + position the popover. Also re-measure on scroll/resize so
    // the popover follows the trigger button if the user scrolls the table.
    useLayoutEffect(() => {
        if (!anchorEl || !popoverRef.current) return;

        const measure = () => {
            const anchorRect = anchorEl.getBoundingClientRect();
            const popoverRect = popoverRef.current!.getBoundingClientRect();
            const margin = 10;

            // ANCHOR DIRECTLY BELOW the trigger button
            let top = anchorRect.bottom + 4;
            let left = anchorRect.left;

            // Flip above if not enough space below
            const spaceBelow = window.innerHeight - anchorRect.bottom;
            if (spaceBelow < popoverRect.height + margin) {
                top = anchorRect.top - popoverRect.height - 4;
            }

            // Boundary checks — keep within viewport
            if (left < margin) left = margin;
            if (left + popoverRect.width > window.innerWidth - margin) {
                left = window.innerWidth - popoverRect.width - margin;
            }

            setPosition({ top, left, opacity: 1 });
        };

        measure();
        // Re-measure on scroll + resize so popover follows the trigger
        window.addEventListener('scroll', measure, true);
        window.addEventListener('resize', measure);
        return () => {
            window.removeEventListener('scroll', measure, true);
            window.removeEventListener('resize', measure);
        };
    }, [anchorEl]);

    const handleSelect = (priority: Task['priority']) => {
        onUpdate(task.id, priority);
        onClose();
    };

    return createPortal(
        <div
            ref={popoverRef}
            style={{ position: 'fixed', top: `${position.top}px`, left: `${position.left}px`, opacity: position.opacity, transition: 'opacity 0.15s ease-in-out' }}
            className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl z-[9999] py-1 w-32 animate-fade-in-up"
        >
            {priorityOptions.map(option => (
                <button
                    key={option.level}
                    onClick={() => handleSelect(option.level)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-200 flex items-center justify-between gap-2"
                >
                    <div className="flex items-center gap-2">
                        <option.icon className={`w-3.5 h-3.5 ${option.colorClass}`} />
                        {/* Title Case — labels are already "High"/"Medium"/"Low" */}
                        <span>{option.label}</span>
                    </div>
                    {task.priority === option.level && <div className="w-1.5 h-1.5 rounded-full bg-primary-500"></div>}
                </button>
            ))}
        </div>,
        document.body,
    );
};

export default PriorityPopover;
