/**
 * ServiceTypePicker — cross-platform picker for selecting a service request type.
 *
 * Replaces the 2-column grid of buttons that took up too much vertical space
 * and felt clunky. This picker:
 *   - Shows the currently-selected option as a compact button (icon + label)
 *   - On MOBILE: opens a bottom-sheet that slides up from the bottom of the
 *     screen — feels native on both iOS and Android (Android's Material 3
 *     design language uses bottom sheets for picker-style selections).
 *   - On DESKTOP (sm+): opens a dropdown menu positioned below the button.
 *   - Each option shows the icon, label, and (optional) description.
 *   - Auto-closes on selection, on Escape, and on backdrop tap.
 *   - Body scroll is locked while the bottom sheet is open.
 *
 * The picker is controlled — parent owns the selectedKey state and passes
 * onChange to be notified when the user picks a new option. This keeps the
 * component reusable for both the Client Portal (Vega) and the Tenant
 * Portal (Atrium) without any product-specific logic baked in.
 */
import React, { useEffect, useRef, useState, useMemo } from 'react';

export interface ServiceTypeOption {
    key: string;
    label: string;
    description?: string;
    icon?: string;
    category?: string;
    defaultPriority?: 'low' | 'medium' | 'high' | 'urgent';
}

interface ServiceTypePickerProps {
    options: ServiceTypeOption[];
    selectedKey: string;
    onChange: (key: string) => void;
    label?: string;
    /** Visual hint — defaults to "Request Type" */
    placeholder?: string;
    disabled?: boolean;
}

export const ServiceTypePicker: React.FC<ServiceTypePickerProps> = ({
    options,
    selectedKey,
    onChange,
    label = 'Request Type',
    placeholder = 'Select a type',
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const sheetRef = useRef<HTMLDivElement>(null);

    // Resolve the currently-selected option for display
    const selectedOption = useMemo(() => {
        return options.find(o => o.key === selectedKey) || null;
    }, [options, selectedKey]);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen]);

    // Lock body scroll while bottom sheet is open (mobile only)
    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    // Close dropdown when clicking outside (desktop only — the mobile sheet
    // has its own backdrop that handles this)
    useEffect(() => {
        if (!isOpen) return;
        const onClick = (e: MouseEvent) => {
            // Skip if the click was inside the button or dropdown
            if (buttonRef.current?.contains(e.target as Node)) return;
            if (dropdownRef.current?.contains(e.target as Node)) return;
            // On mobile, the sheet has its own backdrop — only treat this as
            // an outside click if the click target isn't part of the sheet
            if (sheetRef.current?.contains(e.target as Node)) return;
            setIsOpen(false);
        };
        // Defer attaching by one tick so the click that OPENED the picker
        // doesn't immediately close it
        const t = setTimeout(() => document.addEventListener('mousedown', onClick), 0);
        return () => {
            clearTimeout(t);
            document.removeEventListener('mousedown', onClick);
        };
    }, [isOpen]);

    const handleSelect = (key: string) => {
        onChange(key);
        setIsOpen(false);
    };

    if (disabled) {
        return (
            <div>
                {label && (
                    <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-2">
                        {label}
                    </label>
                )}
                <div className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-sm text-slate-400 cursor-not-allowed">
                    {selectedOption ? (
                        <span className="flex items-center gap-2">
                            {selectedOption.icon && <span className="text-lg">{selectedOption.icon}</span>}
                            <span>{selectedOption.label}</span>
                        </span>
                    ) : placeholder}
                </div>
            </div>
        );
    }

    return (
        <div className="relative">
            {label && (
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-2">
                    {label}
                </label>
            )}

            {/* Trigger button — shows the currently selected option */}
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setIsOpen(true)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border-2 border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-left transition-all hover:border-emerald-400 dark:hover:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    {selectedOption ? (
                        <>
                            <span className="text-lg flex-shrink-0">{selectedOption.icon || '📋'}</span>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-slate-800 dark:text-zinc-200 truncate">
                                    {selectedOption.label}
                                </p>
                                {selectedOption.description && (
                                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate">
                                        {selectedOption.description}
                                    </p>
                                )}
                            </div>
                        </>
                    ) : (
                        <span className="text-sm text-slate-400">{placeholder}</span>
                    )}
                </div>
                {/* Chevron — rotates 180deg when open */}
                <svg
                    className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {/* ─── Desktop dropdown (sm+) ────────────────────────────────────
                Positioned absolutely below the button. Width matches the button.
                Scrolls if there are many options. */}
            {isOpen && (
                <>
                    {/* Mobile bottom-sheet backdrop — only visible on small screens */}
                    <div
                        className="sm:hidden fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
                        onClick={() => setIsOpen(false)}
                    />

                    {/* Desktop dropdown (sm+) — anchored below button */}
                    <div
                        ref={dropdownRef}
                        className="hidden sm:block absolute z-30 mt-1 w-full bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-premium overflow-hidden"
                    >
                        <div className="max-h-72 overflow-y-auto custom-scrollbar py-1">
                            {options.length === 0 ? (
                                <div className="px-4 py-3 text-xs text-slate-400 text-center">
                                    No request types configured.
                                </div>
                            ) : (
                                options.map(opt => {
                                    const isSelected = opt.key === selectedKey;
                                    return (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            onClick={() => handleSelect(opt.key)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                                                isSelected
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                                    : 'hover:bg-slate-50 dark:hover:bg-zinc-700/50'
                                            }`}
                                        >
                                            <span className="text-lg flex-shrink-0">{opt.icon || '📋'}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-semibold truncate ${
                                                    isSelected
                                                        ? 'text-emerald-700 dark:text-emerald-300'
                                                        : 'text-slate-700 dark:text-zinc-200'
                                                }`}>
                                                    {opt.label}
                                                </p>
                                                {opt.description && (
                                                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate">
                                                        {opt.description}
                                                    </p>
                                                )}
                                            </div>
                                            {isSelected && (
                                                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Mobile bottom-sheet (sm:hidden) — slides up from bottom */}
                    <div
                        ref={sheetRef}
                        className="sm:hidden fixed inset-x-0 bottom-0 z-50 bg-white dark:bg-zinc-900 rounded-t-3xl shadow-premium max-h-[75vh] flex flex-col animate-[slideUp_0.25s_ease-out]"
                        role="dialog"
                        aria-modal="true"
                        aria-label={label}
                    >
                        {/* Drag handle */}
                        <div className="flex-shrink-0 pt-3 pb-2 flex justify-center">
                            <div className="w-10 h-1 bg-slate-200 dark:bg-zinc-700 rounded-full" />
                        </div>
                        {/* Header */}
                        <div className="flex-shrink-0 px-4 pb-3 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{label}</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 -mr-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                aria-label="Close"
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        {/* Options list */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 pb-6">
                            {options.length === 0 ? (
                                <div className="px-4 py-6 text-sm text-slate-400 text-center">
                                    No request types configured.
                                </div>
                            ) : (
                                options.map(opt => {
                                    const isSelected = opt.key === selectedKey;
                                    return (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            onClick={() => handleSelect(opt.key)}
                                            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors mb-1 ${
                                                isSelected
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                                    : 'hover:bg-slate-50 dark:hover:bg-zinc-800'
                                            }`}
                                        >
                                            <span className="text-2xl flex-shrink-0">{opt.icon || '📋'}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-semibold truncate ${
                                                    isSelected
                                                        ? 'text-emerald-700 dark:text-emerald-300'
                                                        : 'text-slate-700 dark:text-zinc-200'
                                                }`}>
                                                    {opt.label}
                                                </p>
                                                {opt.description && (
                                                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 truncate mt-0.5">
                                                        {opt.description}
                                                    </p>
                                                )}
                                            </div>
                                            {isSelected && (
                                                <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Inline keyframes for animations */}
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default ServiceTypePicker;
