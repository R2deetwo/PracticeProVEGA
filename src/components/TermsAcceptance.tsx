/**
 * TermsAcceptance — slim, non-blocking legal acceptance bar.
 *
 * DESIGN PHILOSOPHY (top-tier SaaS pattern):
 *   Top-tier companies (Slack, Notion, GitHub) don't block the app with
 *   a full-screen modal. They show a slim bar at the bottom of the screen
 *   with inline links to the legal documents and a single accept button.
 *   The app remains fully usable — the bar is a gentle nudge, not a gate.
 *
 *   - First-time users: "By continuing, you agree to our Terms and Privacy Policy"
 *   - Returning users (version update): "We've updated our Terms. Please review and accept."
 *   - Never blocks the app — always dismissible
 *   - Links open the full documents in a clean route (web) or external browser (APK)
 *   - Single "Accept" button — no checkboxes, no expandable sections
 *
 * LEGAL COMPLIANCE (NDPA §25 — Demonstrable Consent):
 *   The acceptance timestamp + terms version is stored in BOTH:
 *   1. localStorage (for fast UI gating — so the bar doesn't reappear)
 *   2. The Convex database (for legal proof — durable, server-side record)
 *
 *   Previously consent was ONLY in localStorage (volatile, device-local).
 *   Now the database record is the legally authoritative one, satisfying
 *   NDPA §25's requirement for demonstrable consent records.
 */
import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuth } from '../contexts/AuthContext';

interface TermsAcceptanceProps {
    onAccepted: () => void;
    onDeclined: () => void;
    onClose?: () => void;
}

const TERMS_VERSION = '2026-07-27-v4';
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
        // Open in a new tab so the user can review while the app stays open
        window.open(path, '_blank', 'noopener,noreferrer');
    }
}

const TermsAcceptance: React.FC<TermsAcceptanceProps> = ({ onAccepted, onDeclined, onClose }) => {
    const [dismissed, setDismissed] = useState(false);
    const { currentUser } = useAuth();
    const recordAcceptance = useMutation(api.myFunctions.recordTermsAcceptance);
    const previousVersion = getPreviousVersion();
    const isUpdate = previousVersion !== null && previousVersion !== TERMS_VERSION;
    const isFirstTime = previousVersion === null;

    if (dismissed) return null;

    const handleAccept = async () => {
        // 1. localStorage — for fast UI gating (bar doesn't reappear)
        markTermsAccepted();
        // 2. Database — for NDPA §25 demonstrable consent (durable, server-side)
        try {
            await recordAcceptance({
                termsVersion: TERMS_VERSION,
                userEmail: currentUser?.email,
            });
        } catch (err) {
            console.warn('[TermsAcceptance] Failed to record consent in database:', err);
        }
        onAccepted();
    };

    const handleDecline = () => {
        setDismissed(true);
        onDeclined();
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
                                    . Please review and accept to continue creating new entries.
                                </>
                            ) : (
                                <>You can view your existing data, but{' '}
                                    <strong className="text-white">you must accept our{' '}
                                        <button
                                            onClick={() => openLegalDocument('terms')}
                                            className="text-primary-400 hover:text-primary-300 font-semibold underline underline-offset-2"
                                        >Terms of Service</button>
                                        {' '}and{' '}
                                        <button
                                            onClick={() => openLegalDocument('privacy')}
                                            className="text-teal-400 hover:text-teal-300 font-semibold underline underline-offset-2"
                                        >Privacy Policy</button>
                                    </strong>{' '}
                                    to create new entries.
                                </>
                            )}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={handleDecline}
                            className="text-xs text-slate-400 hover:text-red-400 px-3 py-2 transition-colors font-semibold"
                            title="Log out"
                        >
                            Decline
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
