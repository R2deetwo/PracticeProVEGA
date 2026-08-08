

import React, { useState } from 'react';
import { EyeIcon, EyeOffIcon } from '../constants';

interface StatCardProps {
    title: string;
    value: React.ReactNode;
    icon: React.ReactElement<{ className?: string }>;
    colorClass: string;
    onClick?: () => void;
    tooltipText?: string;
    scrollOnOverflow?: boolean;  // kept for backward compat — no longer scrolls
    isSensitive?: boolean;
    /** Optional subtitle shown below the value */
    subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, colorClass, onClick, tooltipText, isSensitive = false, subtitle }) => {
    const [isRevealed, setIsRevealed] = useState(!isSensitive);

    const toggleReveal = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsRevealed(!isRevealed);
    };

    const displayValue = isRevealed ? value : <span className="font-mono tracking-widest text-lg mt-0.5 block opacity-60">••••••</span>;

    const textClass = (colorClass || 'bg-primary-500').replace('bg-', 'text-');

    return (
        <div
            onClick={onClick}
            title={isRevealed ? tooltipText : 'Click eye icon to reveal'}
            className={`
                relative overflow-hidden card-premium p-4 halo-hover h-24
                ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}
                flex flex-col justify-between group
            `}
        >
            {/* CRO AUDIT FIX — WATERMARK ICON in the top-right corner.
                Subtle, low-opacity (opacity-20), small (w-5 h-5).
                This frees up 100% of the horizontal card width for text
                and numbers — no more left-side icon container eating space. */}
            <div className="absolute top-3 right-3 opacity-20 pointer-events-none">
                {React.cloneElement(icon, { className: `w-5 h-5 ${textClass}` })}
            </div>

            {/* Text content — full width, flex column, title at top, value at bottom.
                CRO AUDIT FIX — unified stat number typography.
                Title: text-2xs font-bold tracking-widest uppercase (matches admin LABEL pattern).
                Value: text-lg lg:text-xl font-bold (matches admin stat values, was text-base lg:text-lg). */}
            <div className="relative z-10 flex flex-col justify-between h-full min-w-0">
                <p className="text-2xs font-bold tracking-widest text-slate-500 dark:text-zinc-400 uppercase truncate">{title}</p>
                <div className="text-lg lg:text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                    {displayValue}
                </div>
                {subtitle && (
                    <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-0.5 truncate">{subtitle}</p>
                )}
            </div>

            {/* Sensitive data reveal toggle */}
            {isSensitive && (
                <button
                    onClick={toggleReveal}
                    className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-400 transition-colors absolute top-2 right-2 z-20"
                >
                    {isRevealed ? <EyeOffIcon className="w-3 h-3" /> : <EyeIcon className="w-3 h-3" />}
                </button>
            )}
        </div>
    );
};

export default React.memo(StatCard);
