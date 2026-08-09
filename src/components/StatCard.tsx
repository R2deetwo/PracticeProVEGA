// Test commit to verify Cloudflare auto-deploy + Refresh to Update prompt.
// If you're seeing this in the live bundle, the CI/CD pipeline is working.
import React, { useState, useRef, useLayoutEffect } from 'react';
import { EyeIcon, EyeOffIcon } from '../constants';
import Tooltip from './Tooltip';

interface StatCardProps {
    title: string;
    value: React.ReactNode;
    icon: React.ReactElement<{ className?: string }>;
    colorClass: string;
    onClick?: () => void;
    /**
     * Tooltip text shown when hovering/tapping the value area.
     * Use this for the *full-figure* companion to a compact displayed
     * value (e.g. title="₦17.4M", tooltipText="₦17,400,000.00").
     */
    tooltipText?: string;
    /**
     * If true, the value will horizontally auto-scroll (marquee) when
     * it overflows the card width. Use this for long status strings
     * like "0 Paid / 9 Unpaid | ₦0 Collected / ₦12,600,000 Pending".
     */
    scrollOnOverflow?: boolean;
    isSensitive?: boolean;
    /** Optional subtitle shown below the value */
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

    // ─── Value rendering ────────────────────────────────────────────────
    // SPEC COMPLIANCE — Pixel-Perfect Refactor §2.2:
    //   "Place primary metric numbers inside a fixed baseline container
    //    (flex items-baseline h-8) so all numbers sit on the exact same
    //    horizontal baseline."
    //
    // The h-8 (32px) fixed-height baseline container ensures the value
    // text sits on the same horizontal line across all 4 cards regardless
    // of whether a card has a subtitle, status pill, or empty space below.
    //
    // For marquee mode, the baseline container wraps the scrolling track.
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
        <div
            onClick={onClick}
            title={isRevealed ? (needsMarquee ? tooltipText : undefined) : 'Click eye icon to reveal'}
            className={`
                relative overflow-hidden card-premium p-4 halo-hover h-28
                ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}
                flex flex-col justify-between group
            `}
        >
            {/* Watermark icon — top-right, subtle.
                Spec §1: opacity-20 w-5 h-5 text-slate-400 absolute top-3 right-3 */}
            <div className="absolute top-3 right-3 opacity-20 pointer-events-none text-slate-400">
                {React.cloneElement(icon, { className: `w-5 h-5 ${textClass}` })}
            </div>

            {/* Text content — full width, flex column, title at top, value at bottom.
                SPEC COMPLIANCE §2.1 — Title Header Styling:
                  text-[11px] font-semibold tracking-wider text-slate-400
                  uppercase leading-tight mb-2
                The leading-tight + mb-2 eliminates the awkward vertical gap
                that was pushing metric figures down to different heights.
                text-slate-400 (was text-slate-500) per spec. */}
            <div className="relative z-10 flex flex-col justify-between h-full min-w-0">
                <p className="text-[11px] font-semibold tracking-wider text-slate-400 dark:text-zinc-400 uppercase leading-tight mb-2">
                    {title}
                </p>
                {valueWithTooltip}
                {subtitle && (
                    <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-0.5 truncate">{subtitle}</p>
                )}
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
        </div>
    );
};

export default React.memo(StatCard);
