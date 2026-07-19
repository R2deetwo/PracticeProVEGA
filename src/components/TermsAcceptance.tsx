/**
 * TermsAcceptance — slim, non-blocking legal acceptance bar.
 *
 * LEGAL COMPLIANCE (NDPA §25):
 *   The acceptance timestamp + terms version is stored BOTH:
 *   1. In localStorage (for instant UI state — no network round-trip)
 *   2. In the Convex consent_log table (for legal demonstrability)
 *
 *   The server-side record is what satisfies NDPA §25's requirement
 *   for demonstrable consent. localStorage alone is insufficient
 *   (volatile, device-local, can be cleared by the user).
 */
import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';

interface TermsAcceptanceProps {
    onAccepted: () => void;
    onDeclined: () => void;
    onClose?: () => void;
}

const TERMS_VERSION = '2026-07-19-v3';
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
 * Detects whether this is a first-time acceptance or a version update.
 * Returns the previous version string (or null if first time).
 */
function getPreviousVersion(): string | null {
    try {
        return localStorage.getItem(TERMS_KEY);
    } catch {
        return null;
    }
}

/**
 * Opens the legal document in the appropriate way:
 * - On web: navigates to the clean /terms-of-service or /privacy-policy route
 * - On APK: opens in the device's external default browser
 */
function openLegalDocument(doc: 'terms' | 'privacy') {
    const path = doc === 'terms' ? '/terms-of-service' : '/privacy-policy';
    if (Capacitor.isNativePlatform()) {
        window.open(`${PRODUCTION_URL}${path}`, '_blank', 'noopener,noreferrer');
    } else {
        window.location.href = path;
    }
}

const TermsAcceptance: React.FC<TermsAcceptanceProps> = ({ onAccepted, onDeclined, onClose }) => {
    const [dismissed, setDismissed] = useState(false);
    const previousVersion = getPreviousVersion();
    const isUpdate = previousVersion !== null && previousVersion !== TERMS_VERSION;

    // P0 FIX: Persist consent to server (NDPA §25)
    const recordConsent = useMutation(api.myFunctions.recordConsent);

    if (dismissed) return null;

    const handleAccept = async () => {
        // 1. Store in localStorage for instant UI state
        markTermsAccepted();
        // 2. Persist to server for legal demonstrability (NDPA §25)
        // Fire-and-forget — don't block the UI on network. If it fails,
        // the localStorage record still works; the server record will
        // be retried on next login (checkConsentStatus query).
        try {
            await recordConsent({ termsVersion: TERMS_VERSION });
        } catch (err) {
            console.warn('[TermsAcceptance] Failed to persist consent server-side:', err);
        }
        onAccepted();
    };

    const handleDismiss = () => {
        setDismissed(true);
        onClose?.();
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[9998] animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-slate-900 dark:bg-zinc-950 border-t border-slate-700 dark:border-zinc-800 shadow-2xl">
                <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                    {/* Message + links */}
                    <div className="flex-1 min-w-0 text-center sm:text-left">
                        <p className="text-sm text-slate-200 dark:text-zinc-300">
                            {isUpdate ? (
                                <>We've updated our{' '}
                                    <button
                                        onClick={() => openLegalDocument('terms')}
                                        className="text-primary-400 hover:text-primary-300 font-semibold underline underline-offset-2"
                                    >Terms of Service</button>
                                    {' '}and{' '}
                                    <button
                                        onClick={() => openLegalDocument('privacy')}
                                        className="text-teal-400 hover:text-teal-300 font-semibold underline underline-offset-2"
                                    >Privacy Policy</button>
                                    . Please review and accept to continue.
                                </>
                            ) : (
                                <>By continuing, you agree to our{' '}
                                    <button
                                        onClick={() => openLegalDocument('terms')}
                                        className="text-primary-400 hover:text-primary-300 font-semibold underline underline-offset-2"
                                    >Terms of Service</button>
                                    {' '}and{' '}
                                    <button
                                        onClick={() => openLegalDocument('privacy')}
                                        className="text-teal-400 hover:text-teal-300 font-semibold underline underline-offset-2"
                                    >Privacy Policy</button>
                                    .
                                </>
                            )}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={handleDismiss}
                            className="text-xs text-slate-400 hover:text-slate-200 dark:hover:text-zinc-200 px-2 py-2 transition-colors"
                            title="Review later"
                        >
                            Later
                        </button>
                        <button
                            onClick={handleAccept}
                            className="px-5 py-2 text-sm font-bold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-md whitespace-nowrap"
                        >
                            Accept
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TermsAcceptance;
