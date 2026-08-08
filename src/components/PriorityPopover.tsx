
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
            style={{ position: 'fixed', top: `${position.top}px`, left: `${position.left}px`, opacity: position.opacity, transition: 'opacity 0.15s ease-in-out' }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg p-1.5 min-w-[140px] z-[9999]"
        >
            <div className="space-y-0.5">
                {priorityOptions.map(option => (
                    <button
                        key={option.level}
                        onClick={() => handleSelect(option.level)}
                        className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${task.priority === option.level ? 'bg-slate-100 dark:bg-slate-800/60' : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'}`}
                    >
                        <option.icon className={`w-4 h-4 ${option.colorClass}`} />
                        <span className="uppercase tracking-wide">{option.label}</span>
                        {task.priority === option.level && <div className="w-1.5 h-1.5 rounded-full bg-slate-400 ml-auto"></div>}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default PriorityPopover;
