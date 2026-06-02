

import React, { useRef, useState, useLayoutEffect } from 'react';
import { EyeIcon, EyeOffIcon } from '../constants';

interface StatCardProps {
    title: string;
    value: React.ReactNode;
    icon: React.ReactElement<{ className?: string }>;
    colorClass: string;
    onClick?: () => void;
    tooltipText?: string;
    scrollOnOverflow?: boolean;
    isSensitive?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, colorClass, onClick, tooltipText, scrollOnOverflow = false, isSensitive = false }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [scrollAmount, setScrollAmount] = useState(0);
    const [isRevealed, setIsRevealed] = useState(!isSensitive);

    useLayoutEffect(() => {
        if (scrollOnOverflow && containerRef.current && textRef.current && isRevealed) {
            const overflow = textRef.current.scrollWidth - containerRef.current.clientWidth;
            setScrollAmount(overflow > 0 ? overflow : 0);
        } else {
            setScrollAmount(0);
        }
    }, [value, scrollOnOverflow, isRevealed]);

    const style = { '--scroll-amount': `${scrollAmount}px` } as React.CSSProperties;

    const toggleReveal = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsRevealed(!isRevealed);
    };

    const displayValue = isRevealed ? value : <span className="font-mono tracking-widest text-lg mt-0.5 block opacity-60">••••••</span>;

    const valueContent = (scrollOnOverflow && isRevealed) ? (
        <span
            ref={textRef}
            className="inline-block transition-transform duration-[3000ms] ease-in-out group-hover:-translate-x-[var(--scroll-amount)]"
            style={style}
        >
            {displayValue}
        </span>
    ) : displayValue;

    // Use lighter colors for border, text color comes from props mapping logic in parent usually
    // We normalize to bg classes for the icon background
    const bgClass = colorClass || 'bg-primary-500';
    const textClass = (colorClass || 'bg-primary-500').replace('bg-', 'text-');

    return (
        <div
            onClick={onClick}
            title={isRevealed ? tooltipText : 'Click eye icon to reveal'}
            className={`
                relative overflow-hidden card-premium p-5 halo-hover
                ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}
                h-full flex items-center justify-between group
            `}
        >
            {/* Decorative Background Icon - Defensive Layer */}
            <div className="absolute -right-6 -top-6 opacity-[0.03] dark:opacity-[0.05] text-slate-900 dark:text-white pointer-events-none transform -rotate-12 transition-transform duration-700 group-hover:scale-110 group-hover:rotate-0">
                {React.cloneElement(icon, { className: "w-32 h-32" })}
            </div>

            <div className="relative z-10 flex flex-col justify-center min-w-0 pr-2">
                <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap truncate">{title}</p>
                    {isSensitive && (
                        <button
                            onClick={toggleReveal}
                            className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-400 transition-colors"
                        >
                            {isRevealed ? <EyeOffIcon className="w-3 h-3" /> : <EyeIcon className="w-3 h-3" />}
                        </button>
                    )}
                </div>
                <div
                    ref={containerRef}
                    className={`text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight ${scrollOnOverflow && isRevealed ? 'overflow-hidden whitespace-nowrap' : 'break-all'}`}
                >
                    {valueContent}
                </div>
            </div>

            <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center ${bgClass} bg-opacity-10 text-opacity-100 flex-shrink-0 shadow-sm border border-white/10`}>
                {React.cloneElement(icon, { className: `w-5 h-5 ${textClass}` })}
            </div>
        </div>
    );
};

export default React.memo(StatCard);
