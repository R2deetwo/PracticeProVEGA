


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
    /** Optional subtitle shown below the value */
    subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, colorClass, onClick, tooltipText, scrollOnOverflow = false, isSensitive = false, subtitle }) => {
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

    const bgClass = colorClass || 'bg-primary-500';
    const textClass = (colorClass || 'bg-primary-500').replace('bg-', 'text-');

    return (
        <div
            onClick={onClick}
            title={isRevealed ? tooltipText : 'Click eye icon to reveal'}
            className={`
                relative overflow-hidden card-premium p-4 sm:p-5 halo-hover
                ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}
                h-full min-h-[80px] flex items-center gap-3 group
            `}
            style={{ contain: 'layout paint style' }}
        >
            {/* Icon — locked inside bounding frame, never clips out */}
            <div className={`relative z-10 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${bgClass} bg-opacity-10 text-opacity-100 flex-shrink-0 shadow-sm border border-white/10`}>
                {React.cloneElement(icon, { className: `w-4 h-4 sm:w-5 sm:h-5 ${textClass}` })}
            </div>

            {/* Text content — fluid, min-w-0 prevents overflow push */}
            <div className="relative z-10 flex flex-col justify-center min-w-0 flex-1 gap-0.5">
                <p className="text-2xs sm:text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis mb-0">{title}</p>
                <div
                    ref={containerRef}
                    className={`text-sm sm:text-lg lg:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight ${scrollOnOverflow && isRevealed ? 'overflow-hidden whitespace-nowrap' : ''}`}
                >
                    {valueContent}
                </div>
                {subtitle && (
                    <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-0.5 truncate">{subtitle}</p>
                )}
                {isSensitive && (
                    <button
                        onClick={toggleReveal}
                        className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-400 transition-colors absolute top-0 right-0"
                    >
                        {isRevealed ? <EyeOffIcon className="w-3 h-3" /> : <EyeIcon className="w-3 h-3" />}
                    </button>
                )}
            </div>

            {/* Decorative Background Icon — strictly contained inside the card bounds */}
            <div className="absolute right-0 top-0 opacity-[0.03] dark:opacity-[0.05] text-slate-900 dark:text-white pointer-events-none transform -rotate-12 transition-transform duration-700 group-hover:scale-110 group-hover:rotate-0 overflow-hidden w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                {React.cloneElement(icon, { className: "w-16 h-16 sm:w-20 sm:h-20" })}
            </div>
        </div>
    );
};

export default React.memo(StatCard);
