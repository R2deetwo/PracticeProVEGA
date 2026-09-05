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

// R13: exported so the Signup flow can record the SAME version it accepted
// (Signup.tsx persists the consent at verification — kills the duplicate
// terms re-prompt fresh users were hitting on their first create action).
export const TERMS_VERSION = '2026-07-27-v4';
const TERMS_KEY = 'practicepro_terms_accepted_version';
const PRODUCTION_URL = 'https://practice-pro-vega.vercel.app';

// ─── ROLE-BASED TERMS VERSIONING ─────────────────────────────────────────
// Different user roles see different terms content. Bumping a role-specific
// version forces ONLY users in that role to re-accept — e.g. if we update
// the Portal Terms of Use, only portal residents see the prompt; firm
// admins are not bothered.
//
// Roles:
//   - 'founder'      — platform founder (practicepro.ng staff)
//   - 'admin'        — firm admin (Founder role in UserRole enum)
//   - 'lawyer'       — Vega lawyer / Atrium manager
//   - 'paralegal'    — Vega paralegal / Atrium associate
//   - 'portal_user'  — Resident / Client portal user (Tenant or Client role)
const ROLE_TERMS_VERSIONS: Record<string, string> = {
    founder: 'founder-v1',
    admin: 'admin-v1',
    lawyer: 'lawyer-v1',
    paralegal: 'paralegal-v1',
    portal_user: 'portal-v1',
};

/**
 * Resolve the user's role context for terms acceptance.
 * Portal users (Tenant/Client) → 'portal_user'.
 * Firm Founder role → 'founder' (if @practicepro.ng) or 'admin'.
 * Other roles → lowercase role name.
 */
function resolveRoleContext(user: any): string {
    if (!user) return 'unknown';
    const email = (user.email || '').toLowerCase();
    if (email.endsWith('@practicepro.ng')) return 'founder';
    const role = (user.role || '').toLowerCase();
    if (role === 'client' || role === 'tenant') return 'portal_user';
    if (role === 'founder') return 'admin';
    if (['admin', 'lawyer', 'paralegal'].includes(role)) return role;
    return 'unknown';
}

/**
 * Check if the user has accepted the CURRENT terms version (localStorage only).
 * This is the fast synchronous check used for initial UI gating.
 *
 * NOTE: This only checks localStorage. For the full check that includes
 * the server-side record (which survives APK reinstalls), use the
 * useTermsAcceptance hook below.
 */
export function hasAcceptedCurrentTerms(): boolean {
    try {
        return localStorage.getItem(TERMS_KEY) === TERMS_VERSION;
    } catch {
        return false;
    }
}

/**
 * Check if the user has accepted ANY version of the terms (localStorage).
 * This is used to avoid re-prompting users who already accepted a previous
 * version but whose localStorage was cleared (e.g., APK reinstall).
 *
 * If they accepted a PREVIOUS version, we check the server-side record
 * (via useTermsAcceptance hook) to confirm. If the server says they
 * accepted any version, we don't prompt again unless the version changes.
 */
export function hasAcceptedAnyTermsVersion(): boolean {
    try {
        const stored = localStorage.getItem(TERMS_KEY);
        // Also check the legacy 'accepted' flag
        const acceptedFlag = localStorage.getItem('practicepro_terms_accepted');
        return !!stored || acceptedFlag === 'true';
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
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { currentUser, bearerToken } = useAuth();
    const recordAcceptance = useMutation(api.myFunctions.recordTermsAcceptance);
    const previousVersion = getPreviousVersion();
    const isUpdate = previousVersion !== null && previousVersion !== TERMS_VERSION;
    const isFirstTime = previousVersion === null;

    if (dismissed) return null;

    const handleAccept = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        // 1. localStorage — for fast UI gating (bar doesn't reappear)
        markTermsAccepted();
        // 2. Database — for NDPA §25 demonstrable consent (durable, server-side)
        // Include roleContext + roleTermsVersion so per-role version bumps
        // only force re-acceptance for affected users.
        const roleContext = resolveRoleContext(currentUser);
        const roleTermsVersion = ROLE_TERMS_VERSIONS[roleContext] || undefined;
        try {
            await recordAcceptance({
                termsVersion: TERMS_VERSION,
                userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined),
                roleContext,
                roleTermsVersion,
            });
        } catch (err) {
            console.warn('[TermsAcceptance] Failed to record consent in database:', err);
        } finally {
            setIsSubmitting(false);
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
                                    . Accept to continue creating new entries. You can still view your existing data without accepting.
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
                            className="text-xs text-slate-400 hover:text-slate-200 dark:hover:text-zinc-200 px-3 py-2 transition-colors font-semibold"
                            title="Continue in read-only mode — you can view your data but won't be able to create new entries until you accept."
                        >
                            Not Now
                        </button>
                        <button
                            onClick={handleAccept}
                            disabled={isSubmitting}
                            className="px-5 py-2 text-sm font-bold text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors shadow-md whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? 'Saving…' : 'Accept'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TermsAcceptance;
