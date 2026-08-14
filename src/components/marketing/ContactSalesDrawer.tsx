import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';

/**
 * ContactSalesDrawer — Unauthenticated slide-out drawer for high-intent lead capture.
 *
 * Architecture:
 * - Completely independent of auth state (no user session required)
 * - Manages its own open/close state via `isOpen` prop
 * - Submits to `salesInquiries.submitSalesInquiry` Convex mutation (no auth token)
 * - On success: inline confirmation replaces the form, no page redirect
 * - On mobile: renders as a bottom sheet; desktop: right-side slide panel
 */
const ContactSalesDrawer: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    source?: string; // e.g. "Enterprise Pricing CTA", "Komplete Callout", "Footer"
}> = ({ isOpen, onClose, source = 'landing_page' }) => {
    const [formData, setFormData] = useState({
        email: '',
        name: '',
        companyName: '',
        message: '',
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isVisible, setIsVisible] = useState(false);

    const submitInquiry = useMutation(api.salesInquiries.submitSalesInquiry);

    // Animate in/out
    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => setIsVisible(true));
        } else {
            setIsVisible(false);
        }
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    const validate = useCallback(() => {
        const newErrors: Record<string, string> = {};
        if (!formData.email.trim()) {
            newErrors.email = 'Work email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }
        if (!formData.name.trim()) {
            newErrors.name = 'Your name is required';
        }
        if (!formData.message.trim()) {
            newErrors.message = 'Please describe your needs';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;

        setIsSubmitting(true);
        try {
            await submitInquiry({
                email: formData.email.trim(),
                name: formData.name.trim(),
                companyName: formData.companyName.trim() || undefined,
                message: formData.message.trim(),
                source,
                productInterest: undefined, // Could be passed from the landing page context
            });
            setIsSubmitted(true);
        } catch (err) {
            console.error('[ContactSales] Submission failed:', err);
            setErrors({ submit: 'Something went wrong. Please try again or email us directly at practiceprosystems@gmail.com' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => {
            onClose();
            if (isSubmitted) {
                setIsSubmitted(false);
                setFormData({ email: '', name: '', companyName: '', message: '' });
                setErrors({});
            }
        }, 300);
    };

    const updateField = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => {
                const next = { ...prev };
                delete next[field];
                return next;
            });
        }
    };

    if (!isOpen) return null;

    // CRITICAL: Use createPortal to render at document.body level.
    // The LandingPage has <main className="animate-swap-in"> which applies
    // a CSS transform — this creates a containing block that traps
    // position:fixed elements, causing the modal to appear at the top of
    // the page instead of centered in the viewport. Portaling to
    // document.body escapes the transformed parent.
    return createPortal(
        <>
            {/* Backdrop — flex container that centers the panel in the viewport */}
            <div
                className={`fixed inset-0 z-[9500] bg-black/40 backdrop-blur-sm transition-opacity duration-300 flex items-end sm:items-center sm:justify-center p-0 sm:p-4 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                onClick={handleClose}
            >
            {/* Panel — bottom sheet on mobile, centered in viewport on desktop.
                Uses the backdrop as a flex container so the form is always
                vertically centered in the visible viewport, regardless of
                scroll position. */}
            <div
                className={`relative z-[9600] flex flex-col bg-white dark:bg-zinc-900 shadow-2xl border border-slate-200 dark:border-zinc-700
                    transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]
                    ${isVisible ? 'opacity-100 translate-y-0 sm:scale-100' : 'opacity-0 translate-y-full sm:translate-y-0 sm:scale-95'}
                    w-full rounded-t-2xl max-h-[85vh]
                    sm:w-[440px] sm:max-w-[90vw] sm:rounded-2xl sm:max-h-[80vh]`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-zinc-700/60">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Contact Sales</h2>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">No account needed — we will reach out directly.</p>
                    </div>
                    <button
                        onClick={handleClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                        aria-label="Close"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isSubmitted ? (
                        /* ── Success State ── */
                        <div className="flex flex-col items-center justify-center h-full text-center px-4">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center mb-6">
                                <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Message Sent</h3>
                            <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed max-w-xs">
                                Thank you. One of our legal technology consultants will reach out to you directly via your email within 24 hours.
                            </p>
                            <button
                                onClick={handleClose}
                                className="mt-8 px-6 py-2.5 rounded-lg text-sm font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                            >
                                Back to Browsing
                            </button>
                        </div>
                    ) : (
                        /* ── Form State ── */
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {/* Work Email */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
                                    Work Email <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={e => updateField('email', e.target.value)}
                                        placeholder="you@firm.com"
                                        className={`w-full pl-10 pr-3 py-2.5 rounded-lg text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white border ${errors.email ? 'border-red-400 dark:border-red-500' : 'border-slate-200 dark:border-zinc-700'} focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-500`}
                                    />
                                </div>
                                {errors.email && <p className="text-2xs text-red-500 mt-1">{errors.email}</p>}
                            </div>

                            {/* Full Name */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
                                    Full Name <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={e => updateField('name', e.target.value)}
                                        placeholder="Full name"
                                        className={`w-full pl-10 pr-3 py-2.5 rounded-lg text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white border ${errors.name ? 'border-red-400 dark:border-red-500' : 'border-slate-200 dark:border-zinc-700'} focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-500`}
                                    />
                                </div>
                                {errors.name && <p className="text-2xs text-red-500 mt-1">{errors.name}</p>}
                            </div>

                            {/* Firm / Company Name */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
                                    Firm / Company Name <span className="text-slate-400 dark:text-zinc-500">(optional)</span>
                                </label>
                                <div className="relative">
                                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                    <input
                                        type="text"
                                        value={formData.companyName}
                                        onChange={e => updateField('companyName', e.target.value)}
                                        placeholder="Firm or company name"
                                        className="w-full pl-10 pr-3 py-2.5 rounded-lg text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white border border-slate-200 dark:border-zinc-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-500"
                                    />
                                </div>
                            </div>

                            {/* Message */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 dark:text-zinc-400 mb-1.5">
                                    Message <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <svg className="absolute left-3 top-3 w-4 h-4 text-slate-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                    <textarea
                                        required
                                        rows={4}
                                        value={formData.message}
                                        onChange={e => updateField('message', e.target.value)}
                                        placeholder="Tell us about your firm's legal or property management operations..."
                                        className={`w-full pl-10 pr-3 py-2.5 rounded-lg text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-white border ${errors.message ? 'border-red-400 dark:border-red-500' : 'border-slate-200 dark:border-zinc-700'} focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-zinc-500`}
                                    />
                                </div>
                                {errors.message && <p className="text-2xs text-red-500 mt-1">{errors.message}</p>}
                            </div>

                            {/* Submit error */}
                            {errors.submit && (
                                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
                                    <p className="text-xs text-red-600 dark:text-red-400">{errors.submit}</p>
                                </div>
                            )}

                            {/* Privacy note */}
                            <p className="text-2xs text-slate-400 dark:text-zinc-500 leading-relaxed">
                                Your information is processed securely in accordance with our Privacy Policy and the Nigeria Data Protection Act 2023. We will never share your data with third parties.
                            </p>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full py-3 rounded-lg text-sm font-bold text-white bg-gradient-to-br from-primary-500 to-primary-700 hover:from-primary-400 hover:to-primary-600 shadow-lg shadow-primary-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                        Sending...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                                        Send Message
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
            </div>
        </>,
        document.body
    );
};

export default ContactSalesDrawer;
