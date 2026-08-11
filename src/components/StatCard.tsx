import React, { useState, useRef, useLayoutEffect } from 'react';
import { motion } from 'framer-motion';
import { EyeIcon, EyeOffIcon } from '../constants';
import Tooltip from './Tooltip';

interface StatCardProps {
    title: string;
    value: React.ReactNode;
    icon: React.ReactElement<{ className?: string }>;
    colorClass: string;
    onClick?: () => void;
    tooltipText?: string;
    scrollOnOverflow?: boolean;
    isSensitive?: boolean;
    /** Optional subtitle shown ABOVE the value (between title and value)
     *  so the value always sits on the bottom baseline across all cards. */
    subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    icon,
    colorClass,
    onClick,
    tooltipText,
    scrollOnOverflow = false,
    isSensitive = false,
    subtitle,
}) => {
    const [isRevealed, setIsRevealed] = useState(!isSensitive);
    const valueRef = useRef<HTMLDivElement>(null);
    const [needsMarquee, setNeedsMarquee] = useState(false);

    useLayoutEffect(() => {
        if (!scrollOnOverflow || !valueRef.current) return;
        const el = valueRef.current;
        const inner = el.firstElementChild as HTMLElement | null;
        if (inner) {
            setNeedsMarquee(inner.scrollWidth > el.clientWidth + 1);
        } else {
            setNeedsMarquee(el.scrollWidth > el.clientWidth + 1);
        }
    }, [scrollOnOverflow, value]);

    const toggleReveal = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsRevealed(!isRevealed);
    };

    const displayValue = isRevealed ? (
        value
    ) : (
        <span className="font-mono tracking-widest text-lg block opacity-60">••••••</span>
    );

    const textClass = (colorClass || 'bg-primary-500').replace('bg-', 'text-');

    // Value rendering — fixed h-8 baseline container so all numbers
    // sit on the same horizontal line across all 4 cards.
    const valueBlock = needsMarquee ? (
        <div className="overflow-hidden w-full flex items-baseline h-8" ref={valueRef}>
            <div className="stat-marquee-track">
                <span className="pr-8">{displayValue}</span>
                <span className="pr-8" aria-hidden="true">{displayValue}</span>
            </div>
        </div>
    ) : (
        <div
            ref={valueRef}
            className="flex items-baseline h-8 text-lg lg:text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
        >
            {displayValue}
        </div>
    );

    const valueWithTooltip = (tooltipText && !needsMarquee) ? (
        <Tooltip text={tooltipText}>
            {valueBlock}
        </Tooltip>
    ) : valueBlock;

    return (
        <motion.div
            onClick={onClick}
            title={isRevealed ? (needsMarquee ? tooltipText : undefined) : 'Click eye icon to reveal'}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            whileTap={onClick ? { scale: 0.98 } : undefined}
            className={`
                relative glass-card p-4 rounded-lg h-28
                ${onClick ? 'cursor-pointer' : ''}
                flex flex-col justify-between group
            `}
        >
            {/* Watermark icon — top-right, subtle */}
            <div className="absolute top-3 right-3 opacity-20 pointer-events-none text-slate-400">
                {React.cloneElement(icon, { className: `w-5 h-5 ${textClass}` })}
            </div>

            {/* Text content — title at top, subtitle (if any) below title,
                value at BOTTOM on a fixed baseline.
                This ensures all 4 cards have their numbers on the exact
                same horizontal line, regardless of whether a card has
                a subtitle or not. Previously the subtitle was BELOW the
                value, which pushed the value up on cards with subtitles
                (like "Managed Units" with "100% occupied"). */}
            <div className="relative z-10 flex flex-col justify-between h-full min-w-0">
                <div>
                    <p className="text-[11px] font-semibold tracking-wider text-slate-400 dark:text-zinc-400 uppercase leading-tight">
                        {title}
                    </p>
                    {subtitle && (
                        <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-0.5 truncate">{subtitle}</p>
                    )}
                </div>
                {valueWithTooltip}
            </div>

            {/* Sensitive data reveal toggle */}
            {isSensitive && (
                <button
                    onClick={toggleReveal}
                    aria-label={isRevealed ? 'Hide value' : 'Reveal value'}
                    className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-400 transition-colors absolute top-2 right-2 z-20"
                >
                    {isRevealed ? <EyeOffIcon className="w-3 h-3" /> : <EyeIcon className="w-3 h-3" />}
                </button>
            )}
        </motion.div>
    );
};

export default React.memo(StatCard);
