/**
 * TermsAcceptance — a modal shown on first app access (and after any
 * material change to the Terms/Privacy Policy) that requires the user
 * to accept the Terms & Conditions and Privacy Policy before they can
 * use the app.
 *
 * DESIGN:
 *   - Shown on app load if the user hasn't accepted the CURRENT version
 *     of the terms (tracked by version number in localStorage).
 *   - When the terms are updated, the version bumps and users see the
 *     modal again on next access.
 *   - The user can read both documents inline (collapsible sections)
 *     or open them in full-page view.
 *   - Two checkboxes: "I agree to the Terms" and "I agree to the Privacy
 *     Policy". Both must be checked to proceed.
 *   - A "Decline" button is available — it logs the user out and shows
 *     a message that the app requires acceptance to function.
 *
 * LEGAL COMPLIANCE:
 *   - The acceptance timestamp + terms version is stored in localStorage
 *     and could be synced to the user's Convex record for audit purposes.
 *   - This satisfies the requirement that users must agree before using
 *     the app, and that the agreement is tracked.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { Capacitor } from '@capacitor/core';

interface TermsAcceptanceProps {
    onAccepted: () => void;
    onDeclined: () => void;
    /** Called when the user opens a full-page legal document — closes the
     * modal without logging out. The user will see the modal again when
     * they return to the app (if they haven't accepted yet). */
    onClose?: () => void;
}

const TERMS_VERSION = '2026-07-09-v2';
const TERMS_KEY = 'practicepro_terms_accepted_version';
const PRODUCTION_URL = 'https://practice-pro-vega.vercel.app';

export function hasAcceptedCurrentTerms(): boolean {
    try {
        return localStorage.getItem(TERMS_KEY) === TERMS_VERSION;
    } catch {
        return false;
    }
}

export function markTermsAccepted() {
    try {
        localStorage.setItem(TERMS_KEY, TERMS_VERSION);
        localStorage.setItem('practicepro_terms_accepted_at', new Date().toISOString());
    } catch { /* ignore */ }
}

/**
 * Opens the legal document in the appropriate way:
 * - On web: navigates to the clean /terms-of-service or /privacy-policy route
 *   (which renders without the app sidebar/layout)
 * - On APK: opens in the device's external default browser via Capacitor Browser
 */
async function openLegalDocument(doc: 'terms' | 'privacy') {
    const path = doc === 'terms' ? '/terms-of-service' : '/privacy-policy';
    if (Capacitor.isNativePlatform()) {
        // On APK: open in the device's external default browser.
        // window.open with _blank triggers the system browser on Android.
        window.open(`${PRODUCTION_URL}${path}`, '_blank');
    } else {
        // On web: navigate to the route (the parent modal will close via onClose)
        window.location.href = path;
    }
}

const TermsAcceptance: React.FC<TermsAcceptanceProps> = ({ onAccepted, onDeclined, onClose }) => {
    const [agreedTerms, setAgreedTerms] = useState(false);
    const [agreedPrivacy, setAgreedPrivacy] = useState(false);
    const [showTerms, setShowTerms] = useState(false);
    const [showPrivacy, setShowPrivacy] = useState(false);
    const { navigateTo } = useUI();

    const canProceed = agreedTerms && agreedPrivacy;

    const handleAccept = () => {
        if (!canProceed) return;
        markTermsAccepted();
        onAccepted();
    };

    const handleDecline = () => {
        onDeclined();
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200 dark:border-zinc-800 flex items-center gap-3 sticky top-0 bg-white dark:bg-zinc-900 z-10">
                    <div className="p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Welcome to PracticePro</h2>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">Please review and accept our legal agreements to continue.</p>
                    </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
                        Before you start using PracticePro, we need you to review and agree to our Terms of Service and Privacy Policy. These documents explain how the app works, what we collect, and your rights as a user.
                    </p>

                    {/* Terms of Service collapsible */}
                    <div className="border border-slate-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                        <button
                            onClick={() => setShowTerms(!showTerms)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-zinc-800/50 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <span className="text-sm font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-4.5a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 9.75v4.5m15 0v3a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 17.25v-3m15 0H4.5" />
                                </svg>
                                Terms of Service
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); openLegalDocument('terms'); onClose?.(); }}
                                    className="text-xs text-primary-600 dark:text-primary-400 font-bold hover:underline"
                                >
                                    Open full page →
                                </button>
                                <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 text-slate-400 transition-transform ${showTerms ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </button>
                        {showTerms && (
                            <div className="px-4 py-3 text-xs text-slate-600 dark:text-zinc-400 space-y-2 max-h-40 overflow-y-auto">
                                <p><strong>1. Acceptance:</strong> By using PracticePro, you agree to these terms.</p>
                                <p><strong>2. License:</strong> You receive a non-exclusive, non-transferable license to use the app for your professional practice.</p>
                                <p><strong>3. User Responsibilities:</strong> You are responsible for the accuracy of documents generated and must review all AI-generated content before use.</p>
                                <p><strong>4. Privacy:</strong> Your use of the app is also governed by our Privacy Policy.</p>
                                <p><strong>5. Limitation of Liability:</strong> PracticePro is provided "as is" without warranties. We are not liable for indirect or consequential damages.</p>
                                <p><strong>6. Changes:</strong> We may update these terms at any time. Continued use constitutes acceptance of the updated terms.</p>
                                <p className="text-slate-400 italic">Click "Open full page →" to read the complete Terms of Service.</p>
                            </div>
                        )}
                    </div>

                    {/* Privacy Policy collapsible */}
                    <div className="border border-slate-200 dark:border-zinc-700 rounded-lg overflow-hidden">
                        <button
                            onClick={() => setShowPrivacy(!showPrivacy)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-zinc-800/50 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <span className="text-sm font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                                </svg>
                                Privacy Policy
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); openLegalDocument('privacy'); onClose?.(); }}
                                    className="text-xs text-teal-600 dark:text-teal-400 font-bold hover:underline"
                                >
                                    Open full page →
                                </button>
                                <svg xmlns="http://www.w3.org/2000/svg" className={`w-4 h-4 text-slate-400 transition-transform ${showPrivacy ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </button>
                        {showPrivacy && (
                            <div className="px-4 py-3 text-xs text-slate-600 dark:text-zinc-400 space-y-2 max-h-40 overflow-y-auto">
                                <p><strong>1. Data Collection:</strong> We collect your name, email, firm details, and the documents you create. API keys are stored locally on your device.</p>
                                <p><strong>2. Data Use:</strong> Your data is used to provide the app's features. AI processing uses your Gemini API key and is subject to Google's privacy policy.</p>
                                <p><strong>3. Data Storage:</strong> Data is stored in your browser's local storage and in our Convex backend. Documents are not stored on our servers unless you sync them.</p>
                                <p><strong>4. Data Sharing:</strong> We do not sell or share your data with third parties except as required by law.</p>
                                <p><strong>5. Your Rights:</strong> You can export or delete your data at any time from Settings → Data & Export.</p>
                                <p><strong>6. Security:</strong> We use industry-standard encryption. Biometric data never leaves your device.</p>
                                <p className="text-slate-400 italic">Click "Open full page →" to read the complete Privacy Policy.</p>
                            </div>
                        )}
                    </div>

                    {/* Checkboxes */}
                    <div className="space-y-3 pt-2">
                        <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                            <input
                                type="checkbox"
                                checked={agreedTerms}
                                onChange={(e) => setAgreedTerms(e.target.checked)}
                                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm text-slate-700 dark:text-zinc-300">
                                I have read and agree to the <button onClick={() => { openLegalDocument('terms'); onClose?.(); }} className="text-primary-600 dark:text-primary-400 font-bold hover:underline">Terms of Service</button>
                            </span>
                        </label>
                        <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                            <input
                                type="checkbox"
                                checked={agreedPrivacy}
                                onChange={(e) => setAgreedPrivacy(e.target.checked)}
                                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm text-slate-700 dark:text-zinc-300">
                                I have read and agree to the <button onClick={() => { openLegalDocument('privacy'); onClose?.(); }} className="text-teal-600 dark:text-teal-400 font-bold hover:underline">Privacy Policy</button>
                            </span>
                        </label>
                    </div>

                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 leading-relaxed pt-1">
                        These agreements may be updated from time to time. If you continue to use PracticePro after an update, you are deemed to have accepted the revised terms. If you do not agree, you should uninstall the app or stop using it.
                    </p>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-zinc-800 flex gap-3 sticky bottom-0 bg-white dark:bg-zinc-900">
                    <button
                        onClick={handleDecline}
                        className="px-4 py-2.5 text-sm font-bold text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-zinc-700 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                        Decline & Exit
                    </button>
                    <button
                        onClick={handleAccept}
                        disabled={!canProceed}
                        className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                    >
                        Accept & Continue
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TermsAcceptance;
