
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
    
    useLayoutEffect(() => {
        if (anchorEl && popoverRef.current) {
            const anchorRect = anchorEl.getBoundingClientRect();
            const popoverRect = popoverRef.current.getBoundingClientRect();
            const margin = 10;

            let top, left;
            left = anchorRect.left;
            
            const spaceBelow = window.innerHeight - anchorRect.bottom;
            if (spaceBelow > popoverRect.height + margin) {
                top = anchorRect.bottom + 4;
            } else {
                top = anchorRect.top - popoverRect.height - 4;
            }
            
            // Boundary checks
            if (left < margin) {
                left = margin;
            }
            if (left + popoverRect.width > window.innerWidth - margin) {
                left = window.innerWidth - popoverRect.width - margin;
            }

            setPosition({ top, left, opacity: 1 });
        }
    }, [anchorEl]);

    const handleSelect = (priority: Task['priority']) => {
        onUpdate(task.id, priority);
        onClose();
    };

    return (
        <div
            ref={popoverRef}
            style={{ position: 'fixed', top: `${position.top}px`, left: `${position.left}px`, opacity: position.opacity, transition: 'opacity 0.2s ease-in-out' }}
            className="w-40 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl p-1 z-[999]"
        >
            <div className="space-y-1">
                {priorityOptions.map(option => (
                    <button
                        key={option.level}
                        onClick={() => handleSelect(option.level)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-bold uppercase tracking-wide transition-colors ${task.priority === option.level ? 'bg-slate-100 dark:bg-zinc-700' : 'hover:bg-slate-50 dark:hover:bg-zinc-700/50'}`}
                    >
                        <span className="flex items-center gap-2">
                             <option.icon className={`w-4 h-4 ${option.colorClass}`} />
                             {option.label}
                        </span>
                        {task.priority === option.level && <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default PriorityPopover;
