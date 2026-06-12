/**
 * ResidentPortalLogin — Standalone login page for Atrium Residents' Portal
 *
 * External-facing login at /portal/tenant/login for residents
 * to access their SC/MV financial ledger, download receipts,
 * and log maintenance tickets.
 *
 * Supports magic-link invitations: ?token=ABC auto-fills email and
 * marks the invite as accepted on successful login.
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { Logo, MailIcon } from '../../constants';

// Inline icon for alert circle
const AlertCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
);

const TenantPortalLogin: React.FC = () => {
    const { login } = useAuth();
    const { addToast } = useUI();
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [isRevoked, setIsRevoked] = useState(false);
    const [inviteToken, setInviteToken] = useState<string | null>(null);

    // Read token from URL on mount, and check for revoked redirect
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        if (token) setInviteToken(token);
        // If redirected here with ?revoked=1, show the revoked banner immediately
        if (params.get('revoked') === '1') {
            setIsRevoked(true);
        }
    }, []);

    // Look up invite by token
    const invite = useQuery(
        api.portals.getInviteByToken,
        inviteToken ? { token: inviteToken } : 'skip'
    );

    // Accept invite mutation
    const acceptInvite = useMutation(api.portals.acceptPortalInviteByToken);

    // Auto-fill email from invite when data arrives
    useEffect(() => {
        if (invite && invite.inviteeEmail && !email) {
            setEmail(invite.inviteeEmail);
        }
    }, [invite]);

    const handleSignIn = async () => {
        if (!email.trim() || !password) {
            setError('Please enter your email and password.');
            return;
        }
        setIsSubmitting(true);
        setError('');
        setIsRevoked(false);

        try {
            const result = await login(email.trim(), password);
            if (result.success) {
                // Accept the invite if we have a token
                if (inviteToken) {
                    try {
                        await acceptInvite({ token: inviteToken });
                    } catch (e) {
                        // Non-blocking — invite might already be accepted or expired
                        console.warn('Invite accept failed:', e);
                    }
                }
                addToast("Welcome to the Residents' Portal.", { type: 'success' });
                // Store portal type so App.tsx knows to show portal loading instead of LandingPage
                sessionStorage.setItem('practicepro_portal_type', 'tenant');
                // Use React Router navigate instead of window.location.href to preserve
                // in-memory React state (sessionToken, currentUser). A full page reload
                // destroys all state, causing the user to fall back to the LandingPage.
                navigate('/', { replace: true });
            } else {
                if (result.isRevoked) {
                    setError('Your portal access has been revoked.');
                    setIsRevoked(true);
                } else if (result.isLocked) {
                    setError('Your account has been locked. Please contact your property manager.');
                } else if (result.requiresMfa) {
                    setError('Multi-factor authentication is required. Please sign in through the main app.');
                } else {
                    setError(result.message || 'Invalid email or password.');
                }
            }
        } catch (err) {
            setError('Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !isSubmitting) handleSignIn();
    };

    // Show invite info banner if we have a valid invite
    const showInviteBanner = invite && invite.status === 'pending' && invite.expiresAt > Date.now();

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 flex flex-col overflow-x-hidden overflow-y-auto">
            {/* Ambient glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] sm:w-[800px] h-[400px] rounded-full blur-[120px] bg-amber-500/10 pointer-events-none" />

            {/* Brand header — top-left, matches landing page header positioning */}
            <div className="relative z-10 flex-shrink-0">
                <div className="container mx-auto px-4 sm:px-6 h-16 flex items-center">
                    <div className="flex items-center gap-2.5">
                        <Logo className="h-7 w-7 text-primary-500" />
                        <span className="text-[19px] font-bold tracking-tight text-white flex items-center">
                            Practice<span className="text-primary-500">Pro</span>
                            <span className="ml-2 text-[15px] font-black uppercase tracking-tight text-violet-400">
                                ATRIUM
                            </span>
                        </span>
                    </div>
                </div>
            </div>

            {/* Login card — centred in remaining space */}
            <div className="flex-1 flex items-center justify-center p-4 sm:p-6">
                <div className="relative z-10 w-full max-w-md">
                    <div className="text-center mb-6 sm:mb-8">
                        <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">Residents' Portal</h1>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            View your SC/MV payment status, download rent receipts, and log maintenance issues.
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                            Your portal is always accessible — sign in anytime with your email and password.
                        </p>
                    </div>

                    {/* Invite banner */}
                    {showInviteBanner && (
                        <div className="mb-4 px-4 py-3 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-300 text-sm">
                            <div className="flex items-start gap-2">
                                <MailIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold">You've been invited!</p>
                                    <p className="text-violet-400/80 text-xs mt-0.5">
                                        {invite.inviteeName
                                            ? `Welcome, ${invite.inviteeName}. Your email has been pre-filled.`
                                            : 'Your email has been pre-filled from the invitation.'}
                                        {invite.expiresAt && (
                                            <span> Set up your password before {new Date(invite.expiresAt).toLocaleDateString()} to get started.</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Expired/revoked invite banner */}
                    {invite && invite.status !== 'pending' && inviteToken && (
                        <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
                            {invite.status === 'expired' || invite.expiresAt < Date.now()
                                ? 'Your invitation link has expired, but you can still sign in if you already set up a password. Otherwise, ask your property manager for a new invitation.'
                                : invite.status === 'revoked'
                                ? 'This invitation has been revoked by the property manager.'
                                : invite.status === 'accepted'
                                ? 'This invitation has already been accepted. You can sign in directly.'
                                : null}
                        </div>
                    )}

                    {/* Access revoked banner */}
                    {isRevoked && (
                        <div className="mb-4 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
                            <div className="flex items-start gap-2">
                                <AlertCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold">Portal Access Revoked</p>
                                    <p className="text-rose-400/80 text-xs mt-0.5">
                                        Your access to the Residents' Portal has been revoked by the property manager. Please contact them to request a new invitation.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Login card */}
                    <div className="bg-white/[0.04] border border-white/[0.08] backdrop-blur-xl rounded-2xl p-5 sm:p-8 shadow-2xl">
                        <div className="space-y-4">
                            {error && !isRevoked && (
                                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
                                    {error}
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="your@email.com"
                                    disabled={isSubmitting}
                                    className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/30 transition-all disabled:opacity-50"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Enter your password"
                                        disabled={isSubmitting}
                                        className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/30 transition-all disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handleSignIn}
                                disabled={isSubmitting}
                                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-sm hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Signing in…
                                    </>
                                ) : (
                                    "Sign In to Residents' Portal"
                                )}
                            </button>

                            <button
                                onClick={() => { window.location.href = '/'; }}
                                disabled={isSubmitting}
                                className="w-full py-3 rounded-xl text-slate-400 text-sm font-medium hover:text-white hover:bg-white/[0.04] border border-white/[0.06] transition-all disabled:opacity-50"
                            >
                                Back to PracticePro
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TenantPortalLogin;
