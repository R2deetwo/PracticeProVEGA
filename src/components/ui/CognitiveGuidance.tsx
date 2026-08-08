/**
 * Cognitive Guidance UI Components
 *
 * A layer of quiet, non-intrusive encouragement and validation across our pages.
 * These components use inline tips, micro-copy, and small feedback states so
 * users input clean, accurate data.
 *
 * Components:
 *   1. InfoTooltip — "Why It Matters" tooltip next to complex form labels
 *   2. ContextualBanner — "Progressive Nudge" box for empty states / multi-step flows
 *   3. SuccessMicroState — "Clean Data" affirmation when a section is completed
 *   4. SmartPlaceholder — dynamic placeholder text showing expected depth
 */
import React, { useState } from 'react';

// ─── 1. InfoTooltip ─────────────────────────────────────────────────────────

interface InfoTooltipProps {
    text: string;
    className?: string;
}

/**
 * A small info icon that shows a tooltip on hover.
 * Use next to complex form labels to explain WHY the information matters.
 *
 * Example:
 *   <label>Jurisdiction <InfoTooltip text="The jurisdiction determines which court rules apply. Selecting the wrong jurisdiction can invalidate your filing." /></label>
 */
export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, className = '' }) => {
    const [show, setShow] = useState(false);
    return (
        <span
            className={`relative inline-flex items-center ${className}`}
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
            onClick={(e) => { e.stopPropagation(); setShow(!show); }}
        >
            <svg className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 cursor-help transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            {show && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-900 dark:bg-zinc-800 text-white text-xs rounded-lg shadow-xl leading-relaxed pointer-events-none">
                    {text}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-slate-900 dark:bg-zinc-800 rotate-45" />
                </div>
            )}
        </span>
    );
};

// ─── 2. ContextualBanner ────────────────────────────────────────────────────

interface ContextualBannerProps {
    title?: string;
    message: string;
    actionLabel?: string;
    onAction?: () => void;
    variant?: 'info' | 'success' | 'warning';
    className?: string;
}

/**
 * A friendly, low-pressure inline alert for empty states or multi-step flows.
 * Guides the user to the next step without being pushy.
 *
 * Example:
 *   <ContextualBanner message="No documents yet. Create your first document to get started." actionLabel="New Document" onAction={() => openModal('newDocument')} />
 */
export const ContextualBanner: React.FC<ContextualBannerProps> = ({
    title,
    message,
    actionLabel,
    onAction,
    variant = 'info',
    className = '',
}) => {
    const variantClasses = {
        info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300',
        success: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300',
        warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300',
    };
    const iconColor = {
        info: 'text-blue-500',
        success: 'text-emerald-500',
        warning: 'text-amber-500',
    };
    const icons = {
        info: 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
        success: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        warning: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z',
    };

    return (
        <div className={`flex items-start gap-3 p-3 rounded-lg border ${variantClasses[variant]} ${className}`}>
            <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor[variant]}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={icons[variant]} />
            </svg>
            <div className="flex-1 min-w-0">
                {title && <p className="text-sm font-bold mb-0.5">{title}</p>}
                <p className="text-xs leading-relaxed">{message}</p>
            </div>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="flex-shrink-0 px-3 py-1.5 bg-white dark:bg-zinc-800 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors border border-slate-200 dark:border-zinc-700"
                >
                    {actionLabel}
                </button>
            )}
        </div>
    );
};

// ─── 3. SuccessMicroState ──────────────────────────────────────────────────

interface SuccessMicroStateProps {
    message: string;
    show: boolean;
    className?: string;
}

/**
 * A tiny feedback indicator showing when a key section is completed perfectly.
 * Fades in when `show` is true, fades out when false.
 *
 * Example:
 *   <SuccessMicroState message="✓ Court details matched perfectly." show={!!court && !!division} />
 */
export const SuccessMicroState: React.FC<SuccessMicroStateProps> = ({ message, show, className = '' }) => {
    return (
        <div
            className={`flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium transition-all duration-300 ${show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 h-0 overflow-hidden'} ${className}`}
        >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {message}
        </div>
    );
};

// ─── 4. SmartPlaceholder helper ─────────────────────────────────────────────

/**
 * Returns a dynamic placeholder string showing expected depth.
 * Use in input/textarea placeholder attributes.
 *
 * Example:
 *   <input placeholder={smartPlaceholder('case_title', 'e.g., Contract dispute arising from non-delivery at Lake-Nuwa...')} />
 */
export function smartPlaceholder(field: string, fallback: string): string {
    const placeholders: Record<string, string> = {
        case_title: 'e.g., Contract dispute arising from non-delivery at Lake-Nuwa...',
        court: 'e.g., Federal High Court of Nigeria, Lagos Division',
        matter_title: 'e.g., Adekunle v. State Bank — Breach of Contract',
        client_name: 'e.g., Barr. Chukwuma Okafor',
        property_address: 'e.g., 12 Adeola Odeku Street, Victoria Island, Lagos',
        rent_amount: 'e.g., ₦2,500,000 per annum',
        lease_term: 'e.g., 2 years commencing January 2026',
    };
    return placeholders[field] || fallback;
}
