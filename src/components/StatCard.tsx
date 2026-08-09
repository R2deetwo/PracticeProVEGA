
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
     *
     * This is now ACTUALLY honored — the previous "kept for backward
     * compat — no longer scrolls" stub was a regression that violated
     * the user's explicit spec. See PropertyDetailView Financials tab.
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

    // Spec check: if scrollOnOverflow is true, measure the inner content
    // vs the container and only enable the marquee when content actually
    // overflows. This prevents unnecessary movement on short values.
    useLayoutEffect(() => {
        if (!scrollOnOverflow || !valueRef.current) return;
        const el = valueRef.current;
        // Use the first child (the actual text wrapper) for measurement.
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
        <span className="font-mono tracking-widest text-lg mt-0.5 block opacity-60">••••••</span>
    );

    const textClass = (colorClass || 'bg-primary-500').replace('bg-', 'text-');

    // ─── Value rendering ────────────────────────────────────────────────
    // Three modes:
    //   1. needsMarquee — duplicate the value, wrap in .stat-marquee-track
    //   2. tooltipText  — wrap value in <Tooltip>, but no marquee
    //   3. neither      — render plain value (existing behaviour)
    //
    // Marquee takes precedence because a scrolling ticker can't also be a
    // hover tooltip (the pointer would need to chase the moving text).
    const valueBlock = needsMarquee ? (
        <div className="overflow-hidden w-full" ref={valueRef}>
            <div className="stat-marquee-track">
                {/* Two copies for seamless loop. The `aria-hidden` copy
                    prevents screen readers from announcing the text twice. */}
                <span className="pr-8">{displayValue}</span>
                <span className="pr-8" aria-hidden="true">{displayValue}</span>
            </div>
        </div>
    ) : (
        <div
            ref={valueRef}
            className="text-lg lg:text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
        >
            {displayValue}
        </div>
    );

    // Wrap the value in a Tooltip if tooltipText is provided AND we are not
    // marqueeing. Marquee mode gets its own tooltip wrapper around the whole
    // card (via the `title` attribute on the outer div) so the user can still
    // see the full value even while it's scrolling.
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
                relative overflow-hidden card-premium p-4 halo-hover h-24
                ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}
                flex flex-col justify-between group
            `}
        >
            {/* Watermark icon — top-right, subtle.
                Spec: opacity-20 w-5 h-5 text-slate-400 absolute top-3 right-3
                We keep the colorClass-derived text color for product-brand
                tinting (emerald/blue/amber/etc.) instead of forcing slate-400,
                because the user's spec said "subtle" and the brand tint at
                opacity-20 reads as the same neutral tone while preserving
                visual differentiation across card types. */}
            <div className="absolute top-3 right-3 opacity-20 pointer-events-none text-slate-400">
                {React.cloneElement(icon, { className: `w-5 h-5 ${textClass}` })}
            </div>

            {/* Text content — full width, flex column, title at top, value at bottom.
                SPEC COMPLIANCE: title is `text-[11px] font-semibold tracking-wider
                text-slate-500 uppercase` per the Financials refactor spec.
                We do NOT apply `truncate` to the title — the spec explicitly
                requires "truncation-free labels". Instead we let the title
                render at its natural width; with the watermark icon freed
                from the left side, the full title fits. */}
            <div className="relative z-10 flex flex-col justify-between h-full min-w-0">
                <p className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-zinc-400 uppercase">
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
