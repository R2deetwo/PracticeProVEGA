
import * as React from 'react';
import { User, AppMode, UserRole, SubscriptionPlan } from '../types';
import { useQuery, useMutation, useAction, useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { setSentryUser, clearSentryUser } from '../utils/sentry';
import { identifyUser, resetUser as resetAnalyticsUser } from '../utils/analytics';
import { removeAllBeforeUnloadGuards } from '../utils/tabNavigation';
import { setInMemoryApiKey } from '../utils/aiUtils';

const LOCAL_STORAGE_USER_KEY = 'practicepro_user_session';
const PORTAL_SESSION_KEY = 'practicepro_portal_session';
// R13: bearer session token issued by the login gateway (verifyLogin →
// convex/sessions.createSession). Stored client-side; verified
// server-side by SHA-256 hash. Round 15's call-site sweep will send it on
// every Convex call so resolveCaller can trust possession instead of the
// spoofable caller-supplied email.
const BEARER_KEY = 'practicepro_session_bearer';

// Helper to determine if we're on a portal route
// Checks both sessionStorage (same-tab) and localStorage (cross-tab/persistent)
const isPortalRoute = () => {
    try {
        return window.location.pathname.startsWith('/portal/') ||
               sessionStorage.getItem('practicepro_portal_type') !== null ||
               localStorage.getItem('practicepro_portal_type') !== null;
    } catch {
        return false;
    }
};

export interface AuthContextType {
    isAuthenticated: boolean;
    currentUser: User | null;
    appMode: AppMode;
    isAccountRevoked: boolean;
    /** R13: server-issued bearer token for the current login (null = legacy email session). */
    bearerToken: string | null;
    login: (email: string, password?: string, mfaCode?: string, rememberMe?: boolean, portalType?: 'tenant' | 'client') => Promise<{ success: boolean, message?: string, isLocked?: boolean, isRevoked?: boolean, requiresMfa?: boolean, mfaType?: string }>;
    signup: (firmName: string, fullName: string, email: string, password?: string, mode?: AppMode, inviteCode?: string, plan?: SubscriptionPlan, product?: 'legal' | 'property' | 'unified') => Promise<{ success: boolean, message?: string, requiresConfirmation?: boolean, debugCode?: string, code?: string }>;
    verifyEmail: (email: string, code: string, password?: string) => Promise<{ success: boolean, message?: string }>;
    resendConfirmation: (email: string) => Promise<{ success: boolean, message?: string }>;
    logout: () => Promise<void>;
    updateCurrentUser: (data: Partial<User>) => void;
    markOnboardingComplete: (firmId: string) => void;
    isLoadingSession: boolean;
    refreshUser: () => Promise<void>;
    loginAsDemoUser: (email?: string) => void;
    deleteAccount: () => Promise<{ success: boolean, message?: string }>;
    leaveFirm: (firmId: string) => Promise<{ success: boolean, message?: string }>;
    deleteFirm: (firmId: string) => Promise<{ success: boolean, message?: string }>;
    switchFirm: (firmId: string) => Promise<void>;
    loginAsUser: (user: User) => void;
    originalUser: User | null;
    isImpersonating: boolean;
    revertToOriginalUser: () => void;
}

export const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = React.useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};


const getInitialToken = () => {
    try {
        // B1 SHIP-BLOCKER FIX: Server-verified impersonation tokens.
        // OLD (insecure): ?impersonate=email — anyone could impersonate anyone.
        // NEW (secure): ?impersonateToken=xxx — founder calls createImpersonationToken
        // (server-verified), gets an opaque token, appends to URL. We read it
        // synchronously here, store it, and the AuthProvider effect verifies it
        // asynchronously via verifyImpersonationToken. If verification fails, the
        // session is cleared.
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const impersonateToken = urlParams.get('impersonateToken');
            if (impersonateToken) {
                // Store the token for async verification by the AuthProvider effect.
                // Don't set the session yet — wait for server verification.
                try { sessionStorage.setItem('practicepro_pending_impersonate_token', impersonateToken); } catch {}
                // Clean the URL immediately (before App.tsx reads it)
                urlParams.delete('impersonateToken');
                const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '') + window.location.hash;
                window.history.replaceState({}, '', newUrl);
                // Return null — session will be set after async verification.
                return null;
            }

            // R16 Phase B: the legacy ?impersonate=email URL param was REMOVED.
            // It seeded the client session with a caller-chosen email — a
            // client-side identity spoof (post-cutover it could no longer read
            // any data without a bearer, but the app shell still rendered as
            // the victim and old audit links depended on it). Impersonation now
            // goes exclusively through the server-verified impersonateToken
            // flow above (admin-guarded, audited, session-minting).
            const legacyImpersonateEmail = urlParams.get('impersonate');
            if (legacyImpersonateEmail) {
                console.warn('[Auth] REJECTED: the ?impersonate=email URL param no longer logs anyone in. Use ?impersonateToken=xxx (issued via createImpersonationToken).');
                // Clean the inert param from the URL so stale deep links
                // don't leave confusing state behind.
                urlParams.delete('impersonate');
                const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '') + window.location.hash;
                window.history.replaceState({}, '', newUrl);
                // Fall through to the normal session check — no identity is seeded.
            }
        } catch { /* URL parsing failed — fall through to normal session check */ }

        // If on a portal route, prioritize portal session
        if (isPortalRoute()) {
            const portalSession = sessionStorage.getItem(PORTAL_SESSION_KEY) || localStorage.getItem(PORTAL_SESSION_KEY);
            if (portalSession) {
                const session = JSON.parse(portalSession);
                if (session && session.token) return session.token.toLowerCase();
            }
        }

        // Check app session
        const sessionStored = sessionStorage.getItem(LOCAL_STORAGE_USER_KEY);
        if (sessionStored) {
            const session = JSON.parse(sessionStored);
            if (session && session.token) return session.token.toLowerCase();
        }
        const localStored = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
        if (localStored) {
            const session = JSON.parse(localStored);
            if (session && session.token) return session.token.toLowerCase();
        }

        // Fallback: check portal session even if not on portal route
        // (handles the case where isPortalRoute() returns false on initial load)
        const portalSession = sessionStorage.getItem(PORTAL_SESSION_KEY) || localStorage.getItem(PORTAL_SESSION_KEY);
        if (portalSession) {
            const session = JSON.parse(portalSession);
            if (session && session.token) return session.token.toLowerCase();
        }
    } catch (e) {
        console.error("Failed to parse session");
    }
    return null;
};

export const AuthProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const convex = useConvex();
    const [sessionToken, setSessionToken] = React.useState<string | null>(getInitialToken);
    // R13: bearer token from the login gateway. Survives refresh via storage
    // (session + localStorage when rememberMe) so it's available for logout
    // revocation and the Round 15 call-site sweep.
    const [bearerToken, setBearerToken] = React.useState<string | null>(() => {
        try {
            return sessionStorage.getItem(BEARER_KEY) || localStorage.getItem(BEARER_KEY);
        } catch { return null; }
    });
    const [isStorageLoaded, setIsStorageLoaded] = React.useState(true);

    // B1 SHIP-BLOCKER FIX: Async verification of server-issued impersonation tokens.
    // When getInitialToken() finds ?impersonateToken=xxx in the URL, it stores the
    // token in sessionStorage and returns null (no session yet). This effect runs
    // once on mount, verifies the token server-side, and sets the session if valid.
    // If verification fails (expired, used, not found), the pending token is cleared
    // and the user sees the landing page.
    const [impersonateTokenPending, setImpersonateTokenPending] = React.useState<boolean>(() => {
        try {
            return sessionStorage.getItem('practicepro_pending_impersonate_token') !== null;
        } catch {
            return false;
        }
    });

    React.useEffect(() => {
        if (!impersonateTokenPending) return;
        let cancelled = false;

        const verifyToken = async () => {
            try {
                const pendingToken = sessionStorage.getItem('practicepro_pending_impersonate_token');
                if (!pendingToken) {
                    setImpersonateTokenPending(false);
                    return;
                }

                // Call the server to verify the token and get the target email
                const result = await convex.mutation(api.impersonation.verifyImpersonationToken, {
                    token: pendingToken,
                });

                if (cancelled) return;

                if (result?.targetEmail) {
                    // Token verified — set the session
                    const token = result.targetEmail.toLowerCase().trim();
                    const sessionData = JSON.stringify({ token });
                    try { sessionStorage.setItem(LOCAL_STORAGE_USER_KEY, sessionData); } catch {}
                    try { localStorage.setItem(LOCAL_STORAGE_USER_KEY, sessionData); } catch {}
                    setSessionToken(token);
                }
            } catch (err: any) {
                console.error('[Auth] Impersonation token verification failed:', err.message);
                // Token invalid/expired/used — clear pending state, user sees landing page
            } finally {
                if (!cancelled) {
                    try { sessionStorage.removeItem('practicepro_pending_impersonate_token'); } catch {}
                    setImpersonateTokenPending(false);
                }
            }
        };

        verifyToken();

        return () => { cancelled = true; };
    }, [convex, impersonateTokenPending]);

    // State to handle impersonation
    // RESTORE: On initial load, check if we were in the middle of an
    // impersonation session (page was refreshed). If so, restore the
    // originalSessionToken so revertToOriginalUser() works and the
    // auto-revert guard can fire if the impersonated user is not a portal user.
    const [originalSessionToken, setOriginalSessionToken] = React.useState<string | null>(() => {
        try {
            return sessionStorage.getItem('practicepro_original_session') || null;
        } catch {
            return null;
        }
    });

    // IMPERSONATION ROLE OVERRIDE
    // When an admin impersonates a portal user via loginAsUser(), the
    // expected role ('Tenant'/'Client') is stored here and takes precedence
    // over the target user's actual DB role in the `currentUser` memo.
    //
    // This is the critical fix for the "residents see admin dashboard" bug.
    // Previously, the currentUser memo always used userData.role (the actual
    // DB role). If the target's DB role had drifted to 'Admin' (data
    // corruption, legacy migration gap, invite sent to an existing admin
    // email), the admin would end up viewing the admin dashboard instead of
    // the TenantPortal — exactly what the user reported.
    //
    // The override is persisted to sessionStorage so it survives the route
    // change reload (App.tsx redirects impersonating admins from /settings
    // to /portal/tenant/<token>, which causes a full page reload).
    const [impersonationRoleOverride, setImpersonationRoleOverride] = React.useState<UserRole | null>(() => {
        try {
            const stored = sessionStorage.getItem('practicepro_impersonation_role');
            // Only restore if we're also restoring originalSessionToken —
            // otherwise the override is stale and should be ignored.
            if (stored && sessionStorage.getItem('practicepro_original_session')) {
                return stored as UserRole;
            }
            return null;
        } catch {
            return null;
        }
    });

    // Local overrides for UI responsiveness (e.g. defaultViewModes)
    const [localUserOverrides, setLocalUserOverrides] = React.useState<Partial<User> | null>(null);

    // Note: Founder impersonation via ?impersonate=email URL param is
    // handled synchronously in getInitialToken() above — no useEffect
    // needed. The token is set as the initial useState value, so the
    // getUser query fires immediately on mount without a landing page flash.

    const startSignupAction = useAction(api.myFunctions.startSignup);
    const verifyCodeMutation = useMutation(api.myFunctions.verifyCode);
    const deleteAccountMutation = useMutation(api.myFunctions.deleteAccount);
    const repairAccountMutation = useMutation(api.myFunctions.repairAccountConnection);
    const trackEventMutation = useMutation(api.analytics.trackEvent);
    const verifyLoginAction = useAction(api.myFunctions.verifyLogin);
    const revokeSessionMutation = useMutation(api.sessions.revokeSession);
    const startImpersonationSessionMutation = useMutation(api.myFunctions.startImpersonationSession);
    const leaveFirmMutation = useMutation(api.myFunctions.leaveFirm);
    const deleteFirmMutation = useMutation(api.myFunctions.deleteFirm);
    const repairAccountConnectionMutation = useMutation(api.myFunctions.repairAccountConnection);

    // Fetch user data based on the active session token (email).
    // CRITICAL: When on a portal route (/portal/*), pass preferPortalRole=true
    // so getUser returns the portal-role record (Tenant/Client) when the same
    // email exists as BOTH an admin record AND a portal record. This is the
    // fix for the "residents see admin dashboard" bug — without this flag,
    // getUser returned the first matching record (usually the older Admin
    // record) and the user ended up in the admin dashboard after logging in
    // via /portal/tenant/login.
    //
    // REQUIRES: npx convex deploy (Task 8 backend changes must be live).
    const userData = useQuery(
        api.myFunctions.getUser,
        sessionToken
            ? { tokenIdentifier: sessionToken, preferPortalRole: isPortalRoute() }
            : "skip"
    );

    // Fetch original user data if impersonating.
    // The original admin session is NEVER a portal session.
    const originalUserData = useQuery(api.myFunctions.getUser, originalSessionToken ? { tokenIdentifier: originalSessionToken } : "skip");

    // 2. Storage is already loaded synchronously, but keep effect for any future side-effects
    React.useEffect(() => {
        setIsStorageLoaded(true);
    }, []);

    // ─── API Key Sync (server → localStorage) ──────────────────────────
    // B2 SHIP-BLOCKER FIX: Server API key is NO LONGER synced to localStorage.
    // Previously: localStorage.setItem('practicepro_custom_gemini_key', serverApiKey)
    // — any XSS could exfiltrate the key and bill the firm.
    // Now: the key stays in React state (in-memory only) and is exposed via
    // a module-level setter that aiUtils.getGeminiApiKey() reads. The key is
    // never written to localStorage, never appears in network requests from
    // the client (it's used directly in Gemini API calls), and is cleared
    // on logout.
    // (The serverApiKey query moved BELOW the session validity gate — see
    // R17/P0 block. It must not fire with an unvalidated bearer: a dead
    // token made it throw during render, the boundary replaced the
    // provider tree, and the validation verdict could never land.)

    // ─── R17/P0: session validity gate (death-loop fix, 2026-09-05) ──────
    // Strict identity (R16) rejects every guarded call without a VALID
    // bearer. Two client states used to render an authenticated shell with
    // a dead identity, so every query threw and the error boundary retried
    // forever (the splash ↔ "connection interrupted" death loop):
    //   (a) legacy email-only sessions — logins from before the R13 session
    //       system (no `practicepro_session_bearer` anywhere in storage);
    //   (b) bearers that expired/were revoked server-side (30-day TTL,
    //       10-session cap, revokeAllUserSessions).
    // The gate retires both to the login screen BEFORE the shell renders,
    // and stays live for the whole session: validateSessionToken is a
    // reactive query — when revokeSession patches the row mid-session, the
    // query re-runs, resolves null, and the effect signs the client out.
    const isDemoSession = sessionToken === 'demo@practicepro.ng';
    const shouldValidateSession = !!sessionToken && !!bearerToken && !isDemoSession && !impersonateTokenPending;
    const sessionValidation = useQuery(
        api.sessions.validateSessionToken,
        shouldValidateSession ? { token: bearerToken as string } : "skip"
    );

    // Re-read the bearer straight from storage (NOT the boot-time state):
    // another tab may have logged in since this tab booted, and clearing
    // shared storage on a stale view would murder that tab's fresh session.
    const readStoredBearer = (): string | null => {
        try {
            return sessionStorage.getItem(BEARER_KEY) || localStorage.getItem(BEARER_KEY);
        } catch { return null; }
    };

    // (a) Legacy email-only session: no bearer exists, so strict-mode calls
    // can never succeed. Retire on boot. (Online only — while offline, the
    // read-only cached-user fallback keeps working; when connectivity
    // returns, the error boundary's auth handling catches it and offers a
    // clean sign-in.)
    React.useEffect(() => {
        if (!sessionToken || bearerToken || isDemoSession || impersonateTokenPending) return;
        // Cross-tab guard: a fresh login elsewhere would have stored a new
        // bearer — adopt it instead of retiring the session.
        const storedBearer = readStoredBearer();
        if (storedBearer) {
            setBearerToken(storedBearer);
            return;
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) return;
        console.warn('[Auth] Retiring legacy email-only session (no bearer token) — strict mode requires a verified session. Please sign in again.');
        try {
            sessionStorage.removeItem(LOCAL_STORAGE_USER_KEY);
            localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
            sessionStorage.removeItem(PORTAL_SESSION_KEY);
            localStorage.removeItem(PORTAL_SESSION_KEY);
        } catch {}
        setSessionToken(null);
    }, [sessionToken, bearerToken, isDemoSession, impersonateTokenPending]);

    // (b) Bearer rejected by the server (invalid / expired / revoked):
    // undefined = still validating, object = valid — only a resolved null
    // means dead. Covers boot AND mid-session revocation. Cross-tab guard:
    // if storage now holds a DIFFERENT bearer, another tab re-logged-in —
    // adopt it instead of clearing.
    React.useEffect(() => {
        if (!shouldValidateSession || sessionValidation !== null) return;
        const storedBearer = readStoredBearer();
        if (storedBearer && storedBearer !== bearerToken) {
            setBearerToken(storedBearer);
            return;
        }
        console.warn('[Auth] Session token rejected by the server — retiring to the login screen.');
        try {
            sessionStorage.removeItem(BEARER_KEY);
            localStorage.removeItem(BEARER_KEY);
            sessionStorage.removeItem(LOCAL_STORAGE_USER_KEY);
            localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
            sessionStorage.removeItem(PORTAL_SESSION_KEY);
            localStorage.removeItem(PORTAL_SESSION_KEY);
        } catch {}
        setBearerToken(null);
        setSessionToken(null);
    }, [sessionValidation, shouldValidateSession, bearerToken]);

    // ─── API Key Sync (server → localStorage) ──────────────────────
    // B2 SHIP-BLOCKER FIX: Server API key is NO LONGER synced to localStorage.
    // Previously: localStorage.setItem('practicepro_custom_gemini_key', serverApiKey)
    // — any XSS could exfiltrate the key and bill the firm.
    // Now: the key stays in React state (in-memory only) and is exposed via
    // a module-level setter that aiUtils.getGeminiApiKey() reads. The key is
    // never written to localStorage, never appears in network requests from
    // the client (it's used directly in Gemini API calls), and is cleared
    // on logout.
    //
    // R17/P0: gated on a VALIDATED bearer (sessionValidation truthy) — with
    // a dead token this must never fire, or it throws during render before
    // the gate can retire the session (the scenario-B smoke failure).
    const serverApiKey = useQuery(api.myFunctions.getUserApiKey,
        (bearerToken && sessionValidation) ? { tokenIdentifier: sessionToken ?? '', sessionToken: bearerToken ?? undefined } : "skip");

    React.useEffect(() => {
        if (serverApiKey && typeof serverApiKey === 'string' && serverApiKey.length > 0) {
            // Set the in-memory key — aiUtils.getGeminiApiKey() will read this.
            // Do NOT write to localStorage.
            setInMemoryApiKey(serverApiKey);
        } else if (!sessionToken) {
            // Session ended — clear the in-memory key.
            setInMemoryApiKey(null);
        }
    }, [serverApiKey, sessionToken]);

    const currentUser: User | null = React.useMemo(() => {
        // DEMO MODE BYPASS — development builds only
        if (import.meta.env.DEV && sessionToken === 'demo@practicepro.ng') {
            const demoProduct = sessionStorage.getItem('practicepro_demo_product') || 'vega';
            const isAtrium = demoProduct === 'atrium';
            return {
                id: 'demo_user_id',
                firmId: isAtrium ? 'atrium-demo-firm-id' : 'demo_firm_id',
                name: isAtrium ? 'David Atrium' : 'Demo User',
                email: 'demo@practicepro.ng',
                role: UserRole.Admin,
                avatarUrl: isAtrium
                    ? 'https://ui-avatars.com/api/?name=David+Atrium&background=2563eb&color=fff'
                    : 'https://ui-avatars.com/api/?name=Demo+User&background=0D8ABC&color=fff',
                onboardingCompleted: true,
                showProTips: true,
                product: isAtrium ? 'atrium' : 'vega'
            };
        }

        const data = userData;

        if (!data) {
            // ─── OFFLINE FALLBACK ─────────────────────────────────────────
            // If the Convex query hasn't returned data (undefined), it could be
            // because we're offline. If we have a cached user in localStorage,
            // use that so the app doesn't show a blank screen. The cached user
            // is read-only — mutations will fail offline, but at least the user
            // can VIEW their matters, properties, tasks, etc.
            //
            // SECURITY: The cached role is NOT trusted for admin access. If a
            // user was demoted from Admin → Lawyer server-side (or had their
            // account revoked entirely), the cached copy would still say Admin.
            // To prevent privilege escalation through a stale cache, we demote
            // Admin/Founder → Lawyer in the offline fallback. The user can
            // still VIEW their matters (read-only since mutations fail offline
            // anyway), but they cannot access admin settings, the founder
            // dashboard, or perform destructive admin actions while offline.
            // When they reconnect, the real server-side role takes effect.
            if (sessionToken && typeof navigator !== 'undefined' && !navigator.onLine) {
                try {
                    const cached = localStorage.getItem('practicepro_cached_user');
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        if (parsed && parsed.token === sessionToken && parsed.user) {
                            const cachedUser = { ...parsed.user };
                            // Strip admin privileges from the offline cache.
                            // Admins become Lawyers (or stay as their existing
                            // non-admin role if they were e.g. a Paralegal).
                            // Founders also become Lawyers — founder dashboard
                            // is never available offline.
                            if (cachedUser.role === 'Admin' || cachedUser.role === 'Founder') {
                                cachedUser.role = 'Lawyer';
                            }
                            // Mark as offline-cache so the UI can show a
                            // "read-only offline mode" indicator if desired.
                            (cachedUser as any).isOfflineCache = true;
                            return cachedUser;
                        }
                    }
                } catch {}
            }
            return null;
        }

        if (!data.isVerified) return null;

        // Pending users: they joined a firm but haven't been approved yet.
        // Instead of returning null (which makes them look logged out and
        // bounces them to the landing page), return a user object with
        // role='Pending' so the app can show a "Waiting for approval" screen.
        if ((data as any).role === 'Pending') {
            const pendingUser: User = {
                id: (data as any)._id || (data as any).id || '',
                firmId: data.firmId || null,
                joinedFirmIds: data.joinedFirmIds || [],
                name: data.name || '',
                email: data.email || data.tokenIdentifier || '',
                role: UserRole.Pending,
                showProTips: false,
                onboardingCompleted: true,
                _id: (data as any)._id,
            } as User;
            return pendingUser;
        }

        const rawRole = (data as any).role;
        const effectiveRole: string | undefined = (originalSessionToken && impersonationRoleOverride)
            ? impersonationRoleOverride
            : rawRole;

        if (!effectiveRole || typeof effectiveRole !== 'string' || effectiveRole.trim() === '') {
            console.warn('[Auth] Rejecting user with missing/null role:', data.email);
            return null;
        }

        const combined = {
            id: data._id || data.id,
            firmId: data.firmId,
            name: data.name,
            email: data.email,
            role: effectiveRole as UserRole,
            avatarUrl: data.avatarUrl,
            onboardingCompleted: data.onboardingCompleted,
            showProTips: data.showProTips ?? true,
            defaultViewModes: data.defaultViewModes,
            product: data.product,
            barNumber: data.barNumber,
            notificationSettings: data.notificationSettings,
            accessibleMatterIds: data.accessibleMatterIds,
            isMfaEnabled: data.isMfaEnabled,
            portalPresenceHidden: data.portalPresenceHidden,
            portalAccessToken: (data as any).portalAccessToken,
            ...localUserOverrides
        };

        // ─── Cache user for offline use ──────────────────────────────────
        // Every time we successfully fetch the user from the backend, cache
        // it in localStorage. When the app loads offline, we'll use this
        // cached data instead of showing a blank screen.
        try {
            localStorage.setItem('practicepro_cached_user', JSON.stringify({
                token: sessionToken,
                user: combined,
                cachedAt: Date.now(),
            }));
        } catch {}

        return combined;
    }, [userData, sessionToken, localUserOverrides, impersonationRoleOverride, originalSessionToken]);

    // Persist portal type to BOTH sessionStorage and localStorage so we can
    // redirect correctly on refresh/logout. localStorage ensures the portal type
    // survives tab closure and cross-tab navigation, fixing the session persistence
    // bug where portal users get kicked to the landing page on refresh.
    // This is a side-effect of currentUser changing, not part of the memo.
    React.useEffect(() => {
        if (currentUser) {
            if (currentUser.role === UserRole.Client) {
                sessionStorage.setItem('practicepro_portal_type', 'client');
                localStorage.setItem('practicepro_portal_type', 'client');
            } else if (currentUser.role === UserRole.Tenant) {
                sessionStorage.setItem('practicepro_portal_type', 'tenant');
                localStorage.setItem('practicepro_portal_type', 'tenant');
            } else {
                // Non-portal user (Admin, etc.) — clear any stale portal type flag
                // to prevent session conflicts (Bug 14)
                sessionStorage.removeItem('practicepro_portal_type');
                localStorage.removeItem('practicepro_portal_type');
            }
        }
    }, [currentUser?.role]);

    // Ensure portal users have an access token for token-based URLs.
    // This runs after login — the token is needed for building portal URLs
    // like /portal/tenant/{token}. Non-blocking; if it fails, the old
    // /portal/tenant URL still works.
    React.useEffect(() => {
        if (!currentUser) return;
        if (currentUser.role !== UserRole.Client && currentUser.role !== UserRole.Tenant) return;
        if ((currentUser as any).portalAccessToken) return; // Already has token

        // Use the Convex client directly to call the mutation (can't use hooks here)
        convex.mutation(api.portals.ensurePortalAccessToken, { email: currentUser.email || '' })
            .then((token: string | null) => {
                if (token) {
                    // Update the local user object with the new token
                    setLocalUserOverrides(prev => ({ ...prev, portalAccessToken: token }));
                }
            })
            .catch(() => {
                // Non-critical — old URL format still works
            });
    }, [currentUser?.role, currentUser?.email, (currentUser as any)?.portalAccessToken]);

    const originalUser: User | null = React.useMemo(() => {
        if (!originalUserData) return null;
        // SECURITY: Same missing-role rejection as currentUser.
        // Previously this fell back to UserRole.Admin, which meant a malformed
        // original-user record would silently escalate to Admin on revert.
        const rawOrigRole = (originalUserData as any).role;
        if (!rawOrigRole || typeof rawOrigRole !== 'string' || rawOrigRole.trim() === '') {
            console.warn('[Auth] Rejecting originalUser with missing/null role:', originalUserData.email);
            return null;
        }
        return {
            id: originalUserData._id,
            firmId: originalUserData.firmId,
            name: originalUserData.name,
            email: originalUserData.email,
            role: rawOrigRole as UserRole,
            avatarUrl: originalUserData.avatarUrl,
            onboardingCompleted: originalUserData.onboardingCompleted,
            showProTips: originalUserData.showProTips ?? true,
        };
    }, [originalUserData]);

    // ── SECURITY: Auto-revert impersonation of revoked accounts ──
    // Narrower than the previous version: we ONLY auto-revert when the target
    // account is genuinely revoked (!isVerified or role === 'Pending').
    //
    // For other role mismatches (e.g. the target's DB role drifted to 'Admin'
    // due to data corruption), the impersonationRoleOverride in the currentUser
    // memo takes precedence — the admin sees the TenantPortal with the
    // expected role, instead of being silently reverted to their own admin
    // dashboard (which was the root cause of the "residents see admin
    // dashboard" bug reported by the user).
    //
    // The loginAsUser() security checks (admin-only caller, portal-user-only
    // target, cross-firm guard) still prevent privilege escalation at the
    // initiation point.
    const isImpersonating = !!originalSessionToken;
    React.useEffect(() => {
        if (!isImpersonating) return;
        if (!userData) return; // Still loading or user not found
        if (userData.isVerified && (userData as any).role !== 'Pending') return; // Account is fine

        console.warn(
            '[Auth] Impersonation auto-revert: target account is revoked or pending:',
            userData.email,
            { isVerified: userData.isVerified, role: (userData as any).role }
        );
        // Restore the original admin session
        setSessionToken(originalSessionToken);
        sessionStorage.setItem(
            LOCAL_STORAGE_USER_KEY,
            JSON.stringify({ token: originalSessionToken })
        );
        setOriginalSessionToken(null);
        sessionStorage.removeItem('practicepro_original_session');
        // Clear the role override too
        setImpersonationRoleOverride(null);
        sessionStorage.removeItem('practicepro_impersonation_role');
        // Surface a clear error to the admin via a window event that App.tsx
        // can listen for and display as a toast.
        try {
            window.dispatchEvent(
                new CustomEvent('practicepro:impersonation-rejected', {
                    detail: {
                        targetEmail: userData.email,
                        targetRole: (userData as any).role,
                        reason: 'Target account is revoked or pending.',
                    },
                })
            );
        } catch {
            // Event dispatch is best-effort
        }
    }, [isImpersonating, userData, originalSessionToken]);

    const login = async (email: string, password?: string, mfaCode?: string, rememberMe: boolean = true, portalType?: 'tenant' | 'client') => {
        const token = email.toLowerCase().trim();

        // Bypass check for demo user — DEV builds only
        if (import.meta.env.DEV && token === 'demo@practicepro.ng') {
            setSessionToken(token);
            sessionStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify({ token }));
            return { success: true };
        }

        // Real User: Verify against DB before setting session
        try {
            if (!password) {
                 return { success: false, message: "Password required." };
            }

            const verifyResult: any = await verifyLoginAction({
                email: String(token || ''),
                passwordHash: "",        // No longer used client-side
                rawPassword: String(password || ''),   // Sent over TLS; hashed PBKDF2 server-side
                mfaCode: mfaCode ? String(mfaCode) : undefined,
                // Pass portalType when logging in from a portal route so the
                // backend can resolve the correct user record when the same
                // email exists as BOTH an admin record AND a portal record.
                // REQUIRES: npx convex deploy (Task 8 backend changes must be live).
                portalType,
            });

            if (!verifyResult.success) {
                // Determine if this is a lockout, MFA prompt, or just wrong password
                if (verifyResult.isLocked) {
                    return { success: false, message: verifyResult.message, isLocked: true };
                }
                if (verifyResult.requiresMfa) {
                    // Task 20: codeHint (first 2 digits) lets the login UI show
                    // "your code starts with 64" so the user can match the
                    // prompt to the correct (newest) email.
                    return { success: false, requiresMfa: true, mfaType: verifyResult.mfaType, debugCode: (verifyResult as any).debugCode, codeHint: (verifyResult as any).codeHint ?? null };
                }
                // R16 TOFU close: account has no stored password — the first
                // login must claim it with an emailed code (same UI flow as
                // MFA; the password field already holds the desired password).
                if ((verifyResult as any).requiresInitialPassword) {
                    return { success: false, requiresInitialPassword: true, mfaType: (verifyResult as any).mfaType, codeHint: (verifyResult as any).codeHint ?? null };
                }
                return { success: false, message: verifyResult.message };
            }

            // 3. Set Session
            setSessionToken(token);

            // ─── R13: persist the login-gateway's bearer session ──────────
            // verifyLogin (convex) issued an opaque 256-bit token after
            // verifying password (+ MFA). Store it: logout will REVOKE it
            // server-side, and Round 15's sweep sends it on every call so
            // the backend trusts possession, not the spoofable email string.
            const bearer = (verifyResult as any).sessionToken || null;
            setBearerToken(bearer);
            try {
                if (bearer) {
                    sessionStorage.setItem(BEARER_KEY, bearer);
                    if (rememberMe) {
                        localStorage.setItem(BEARER_KEY, bearer);
                    } else {
                        localStorage.removeItem(BEARER_KEY);
                    }
                } else {
                    // Login gateway couldn't issue one (non-blocking failure
                    // server-side) — clear any stale bearer from a previous
                    // login so we never send a dead token.
                    sessionStorage.removeItem(BEARER_KEY);
                    localStorage.removeItem(BEARER_KEY);
                }
            } catch { /* storage unavailable — bearer stays in memory only */ }

            // ─── Clear demo product flag on real login ──────────────────
            // The demo flag ('practicepro_demo_product') is set by the
            // LeadCaptureModal when a user clicks "Try Demo". If demo login
            // fails (which it always does in production), the flag is left
            // behind in sessionStorage and ProductContext reads it as the
            // product — bypassing the safety net that should force Komplete
            // firms to 'unified'. Clearing it here ensures real users get
            // their actual product from firmDetails, not a stale demo flag.
            sessionStorage.removeItem('practicepro_demo_product');
            
            const sessionData = JSON.stringify({ token });
            
            // Store in appropriate key based on portal context
            const isPortal = sessionStorage.getItem('practicepro_portal_type') ||
                (typeof window !== 'undefined' && window.location.pathname.startsWith('/portal/'));
            
            if (isPortal) {
                sessionStorage.setItem(PORTAL_SESSION_KEY, sessionData);
                if (rememberMe) {
                    localStorage.setItem(PORTAL_SESSION_KEY, sessionData);
                } else {
                    localStorage.removeItem(PORTAL_SESSION_KEY);
                }
                // Clear app session to prevent conflict
                sessionStorage.removeItem(LOCAL_STORAGE_USER_KEY);
                localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
            } else {
                sessionStorage.setItem(LOCAL_STORAGE_USER_KEY, sessionData);
                if (rememberMe) {
                    localStorage.setItem(LOCAL_STORAGE_USER_KEY, sessionData);
                } else {
                    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
                }
                // Clear portal session to prevent conflict (Bug 14)
                sessionStorage.removeItem(PORTAL_SESSION_KEY);
                localStorage.removeItem(PORTAL_SESSION_KEY);
                // Also clear portal type flag from BOTH storages to prevent
                // isPortalRoute() from returning true on next refresh, which
                // would cause the app session to be ignored in getInitialToken()
                sessionStorage.removeItem('practicepro_portal_type');
                localStorage.removeItem('practicepro_portal_type');
            }
            
            setOriginalSessionToken(null);
            return { success: true };

        } catch (error: any) {
            // Login verification failed
            const errorMsg = error?.message || String(error);

            // Return standard error without giving admin bypass
            return { success: false, message: `Login error: ${errorMsg}. Server may be unavailable.` };
        }
    };

    const refreshUser = async () => {
        if (!sessionToken) return;

        // Manual Refresh Requested

        try {
            // 2. Run the Repair Mutation explicitly
            // This attempts to find any firm linked to this email and reconnect it in the DB
            const repairResult = await repairAccountMutation({ email: sessionToken, sessionToken: bearerToken ?? undefined });

            if (repairResult.success) {
                // Repair Successful
                // Force a query re-fetch by toggling the token briefly? No, mutation triggers update.
            } else {
                // Repair check complete — no hidden firm found
            }

        } catch (e) {
            // Refresh/Repair failed
        }
    };

    const signup = async (firmName: string, fullName: string, email: string, password?: string, mode?: AppMode, inviteCode?: string, plan?: SubscriptionPlan, product?: 'legal' | 'property' | 'unified') => {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Connection timed out. Please check your internet.")), 15000)
        );

        try {
            // Sanitize args to guarantee only serializable primitives are passed to Convex.
            // This prevents "Converting circular structure to JSON" errors if a React
            // synthetic event or DOM element accidentally leaks into the arguments.
            const safeArgs = {
                fullName: String(fullName || ''),
                email: String(email || ''),
                password: password ? String(password) : undefined,
                product: product ? String(product) : undefined,
            };
            const result: any = await Promise.race([
                startSignupAction(safeArgs),
                timeoutPromise
            ]);

            if (!result.success) {
                return { success: false, message: result.message, code: result.code };
            }

            return { success: true, requiresConfirmation: true, debugCode: result?.debugCode };
        } catch (e: any) {
            console.error("Signup error:", e);
            let msg = "Could not start signup. Please try again.";
            if (typeof e?.message === 'string') {
                if (e.message.includes("timed out")) msg = "Server connection timed out. Please check your internet and try again.";
                else if (e.message.includes("Network")) msg = "Network error. Check your connection.";
                else if (e.message.includes("circular") || e.message.includes("JSON")) msg = "A technical error occurred. Please refresh the page and try again.";
                else if (e.message.includes("Unrecognized") || e.message.includes("Invalid argument")) msg = "Invalid signup data. Please check your inputs.";
                else msg = e.message;
            }

            return { success: false, message: msg };
        }
    };

    const verifyEmail = async (email: string, code: string, password?: string) => {
        try {
            const result = await verifyCodeMutation({ email, code });
            if (result.success) {
                // R17/P0: mint a REAL session immediately. The old flow left
                // a code-verified but BEARER-LESS email session — under strict
                // identity every guarded query then threw and the app entered
                // the death loop. When the signup form collected a password
                // (it always does — validatePassword enforces it), run the
                // login gateway right here so the fresh user lands in the app
                // with a verified bearer. Fallback (no password / mint
                // failure): the legacy email session, which the boot gate
                // will retire to the login screen at the next load.
                if (password) {
                    try {
                        const minted = await login(email, password);
                        if (minted.success) return { success: true };
                        console.warn('[Auth] Post-verification session mint failed, falling back to email session:', minted.message);
                    } catch (e: any) {
                        console.warn('[Auth] Post-verification session mint threw, falling back to email session:', e?.message);
                    }
                }
                const token = email.toLowerCase().trim();
                setSessionToken(token);
                sessionStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify({ token }));
                // Clear any stale bearer from a previous user's login in this
                // browser so it can never be misattributed to this session.
                setBearerToken(null);
                try { sessionStorage.removeItem(BEARER_KEY); localStorage.removeItem(BEARER_KEY); } catch {}
                return { success: true };
            }
            return { success: false, message: result.message };
        } catch (e: any) {
            return { success: false, message: e.message || "Verification failed." };
        }
    };

    const resendConfirmation = async (email: string) => {
        try {
            const safeArgs = { fullName: String("User"), email: String(email || ''), password: undefined, product: undefined };
            const result: any = await startSignupAction(safeArgs);
            // startSignup now returns { success: false } for verified accounts instead of throwing
            if (result && !result.success) {
                if (result.code === 'EMAIL_EXISTS') {
                    return { success: false, message: "This account is already verified. Please log in." };
                }
                return { success: false, message: result.message || "Failed to resend." };
            }
            return { success: true };
        } catch (e) {
            return { success: false, message: "Failed to resend." };
        }
    }

    const logout = async () => {
        // Capture portal type BEFORE clearing session so we can redirect to the right login page
        const portalType = sessionStorage.getItem('practicepro_portal_type');
        const isPortalUser = currentUser?.role === 'Client' || currentUser?.role === 'Tenant';

        // ─── R13: REVOKE the server session before clearing anything ──────
        // A stored bearer token that survives logout is exactly the kind of
        // dangling credential the identity phase exists to eliminate. Best
        // effort: send via BOTH the live mutation AND a sendBeacon POST
        // (unload-safe — logout navigates away immediately after; the beacon
        // is queued by the browser and survives the navigation). Server-side
        // revoke is idempotent, so double delivery is harmless.
        const bearerToRevoke = (() => {
            try {
                return sessionStorage.getItem(BEARER_KEY) || localStorage.getItem(BEARER_KEY);
            } catch { return null; }
        })();
        if (bearerToRevoke) {
            try {
                revokeSessionMutation({ token: bearerToRevoke }).catch(() => { /* beacon is the fallback */ });
            } catch { /* mutation not ready — beacon below still fires */ }
            try {
                const convexUrl =
                    (import.meta as any).env?.VITE_CONVEX_URL ||
                    'https://gregarious-malamute-537.convex.cloud';
                const payload = JSON.stringify({ path: 'sessions:revokeSession', args: { token: bearerToRevoke } });
                if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
                    navigator.sendBeacon(
                        `${convexUrl}/api/mutation`,
                        new Blob([payload], { type: 'application/json' })
                    );
                }
            } catch { /* best effort only */ }
            setBearerToken(null);
            try { sessionStorage.removeItem(BEARER_KEY); localStorage.removeItem(BEARER_KEY); } catch {}
        }

        // Suppress the browser's "Leave site?" beforeunload dialog during logout.
        // We're intentionally navigating away — the user has already confirmed
        // (or it's an automatic logout like session expiry). Without this, the
        // browser shows a "Leave site? Changes you made may not be saved" dialog
        // which is confusing because logout is intentional, not accidental.
        // We do this by temporarily removing any beforeunload listeners and
        // setting a flag that our own beforeunload handler (if any) can check.
        (window as any).__suppressBeforeUnload = true;

        // Clear Sentry + PostHog user context on logout
        try { clearSentryUser(); resetAnalyticsUser(); } catch {}

        // Fire-and-forget tracking — NEVER block logout on analytics.
        if (currentUser && currentUser.email !== 'demo@practicepro.ng') {
            trackEventMutation({
                firmId: currentUser.firmId || 'none',
                userId: currentUser.id,
                event: 'User Logout',
                properties: { email: currentUser.email },
                userEmail: currentUser.email, sessionToken: (bearerToken ?? undefined) || undefined
            }).catch(e => console.warn("[Auth] Logout tracking failed:", e));
        }

        // TASK: Clear ALL matter drafts so a different user logging in doesn't
        // see the previous user's form data.
        try {
            const keysToRemove = Object.keys(localStorage).filter(k => k.startsWith('draft_newMatter_'));
            keysToRemove.forEach(k => localStorage.removeItem(k));
        } catch { /* Non-critical */ }

        // Clear the demo product flag so it doesn't persist into the next session
        sessionStorage.removeItem('practicepro_demo_product');

        // SECURITY: When a portal user logs out, only clear the PORTAL session.
        if (isPortalUser) {
            sessionStorage.removeItem(PORTAL_SESSION_KEY);
            localStorage.removeItem(PORTAL_SESSION_KEY);
            sessionStorage.removeItem('practicepro_portal_type');
            localStorage.removeItem('practicepro_portal_type');
            localStorage.removeItem('practicepro_cached_user');
        } else {
            sessionStorage.removeItem(LOCAL_STORAGE_USER_KEY);
            localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
            sessionStorage.removeItem(PORTAL_SESSION_KEY);
            localStorage.removeItem(PORTAL_SESSION_KEY);
            sessionStorage.removeItem('practicepro_portal_type');
            localStorage.removeItem('practicepro_portal_type');
            localStorage.removeItem('practicepro_cached_user');
        }
        localStorage.removeItem('practicepro_session_locked');

        // B2 FIX: Clear the in-memory Gemini API key on logout so the next
        // user (if any) doesn't inherit the previous user's key.
        setInMemoryApiKey(null);

        // Clear in-memory React state AFTER clearing storage but BEFORE navigation.
        // This ensures the UI immediately stops rendering as authenticated.
        setSessionToken(null);
        if (originalSessionToken) {
            setOriginalSessionToken(null);
            sessionStorage.removeItem('practicepro_original_session');
        }
        if (impersonationRoleOverride) {
            setImpersonationRoleOverride(null);
            sessionStorage.removeItem('practicepro_impersonation_role');
        }

        // Use location.replace() instead of location.href to avoid the
        // browser's "Leave site?" beforeunload dialog. replace() replaces
        // the current history entry, so the user can't press Back to
        // return to the authenticated state. This is the correct behavior
        // for logout — there's no reason to keep the authenticated page
        // in history.
        //
        // We also null out window.onbeforeunload right before navigating
        // to suppress any "Leave site?" dialog that might fire from
        // the browser's default behavior during navigation.
        const redirectUrl = isPortalUser
            ? (portalType === 'client' || currentUser?.role === 'Client'
                ? '/portal/client/login'
                : portalType === 'tenant' || currentUser?.role === 'Tenant'
                    ? '/portal/tenant/login'
                    : '/')
            : '/';

        // Suppress beforeunload dialog
        window.onbeforeunload = null;
        // Remove ALL beforeunload listeners registered by installBeforeUnloadGuard.
        // This is the critical fix for the double-confirm bug: the suppress flag
        // alone wasn't enough because some browsers still fire the native dialog
        // if any beforeunload listener calls preventDefault. Removing the listeners
        // entirely guarantees no "Leave site?" dialog after the user has already
        // confirmed sign-out.
        removeAllBeforeUnloadGuards();

        // SIGN-OUT LOOP FIX: Previously 50ms was too short — React could
        // re-render the portal dashboard before the navigation fired,
        // and App.tsx's /portal/tenant/login redirect (which checks
        // `currentUser`) would see the stale authenticated user and
        // redirect BACK to /portal/tenant, trapping the user in the portal.
        // Fix: Use 200ms delay + clear currentUser cache synchronously
        // by also removing the cached user key BEFORE navigation.
        setTimeout(() => {
            // Double-check: ensure all session keys are gone before navigating
            try {
                sessionStorage.removeItem(PORTAL_SESSION_KEY);
                localStorage.removeItem(PORTAL_SESSION_KEY);
                sessionStorage.removeItem(LOCAL_STORAGE_USER_KEY);
                localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
                localStorage.removeItem('practicepro_cached_user');
                sessionStorage.removeItem('practicepro_portal_type');
                localStorage.removeItem('practicepro_portal_type');
            } catch {}
            window.location.replace(redirectUrl);
        }, 200);
    };

    const markOnboardingComplete = (firmId: string) => {
        // Handled by mutations
    };

    const deleteAccount = async () => {
        if (!sessionToken) return { success: false };
        try {
            await deleteAccountMutation({ email: sessionToken, sessionToken: bearerToken ?? undefined });
            await logout();
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    };

    const leaveFirm = async (firmId: string) => {
        if (!sessionToken) return { success: false };
        try {
            await leaveFirmMutation({ email: sessionToken, firmId, sessionToken: bearerToken ?? undefined });
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    };

    const deleteFirm = async (firmId: string) => {
        try {
            await deleteFirmMutation({ firmId, confirmed: true, userEmail: currentUser?.email ?? undefined, sessionToken: bearerToken ?? undefined });
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    };

    const switchFirm = async (firmId: string) => {
        if (!currentUser || !sessionToken) return;
        try {
            await repairAccountConnectionMutation({ email: sessionToken, targetFirmId: firmId, sessionToken: bearerToken ?? undefined });
            // The userData query will automatically refetch when the user's firmId changes
        } catch (e) {
            console.error("Failed to switch firm", e);
        }
    };

    // Impersonation Logic
    // SECURITY: Impersonation is an Admin-only action and can only target
    // portal users (Client/Tenant). Non-admin callers are silently rejected,
    // and attempting to impersonate a non-portal user is also rejected.
    const loginAsUser = async (user: User) => {
        // Only Admins can impersonate. If we somehow get here from a non-admin
        // session (e.g. a UI bug, an attacker calling the function), bail out.
        if (currentUser?.role !== UserRole.Admin) {
            console.warn('[Auth] Impersonation blocked: caller is not an Admin.', currentUser?.email);
            return;
        }
        // Only allow impersonating portal users. Impersonating another Admin,
        // Lawyer, or Paralegal would be a privilege escalation.
        if (user.role !== UserRole.Client && user.role !== UserRole.Tenant) {
            console.warn('[Auth] Impersonation blocked: target is not a portal user.', user.email, user.role);
            return;
        }
        // Cross-firm impersonation guard: admin can only impersonate users in their own firm.
        if (user.firmId && currentUser.firmId && user.firmId !== currentUser.firmId) {
            console.warn('[Auth] Impersonation blocked: target is in a different firm.', user.email);
            return;
        }

        // ── R16 STRICT MODE: mint a REAL session for the target user ────
        // The legacy flow swapped the email identity string (dead under
        // strict mode — every guarded call would reject it). The server
        // mutation verifies: admin bearer session, portal-only target,
        // same firm; then issues a session for the target (audited in
        // securityEvents) and returns its token exactly once.
        let impersonationToken: string | null = null;
        try {
            const result: any = await startImpersonationSessionMutation({
                sessionToken: bearerToken ?? undefined,
                targetUserId: (user as any)._id || (user as any).id,
            });
            impersonationToken = result?.sessionToken || null;
        } catch (e: any) {
            console.warn('[Auth] Impersonation session could not be minted:', e?.message);
            return;
        }

        if (!originalSessionToken) {
            setOriginalSessionToken(sessionToken); // Save current admin session
            // PERSIST: Store the original admin token in sessionStorage so that
            // if the page is refreshed during impersonation, we can restore the
            // admin session. Without this, a refresh during a failed
            // impersonation would leave the admin permanently stuck as the
            // impersonated user with no way to revert.
            try {
                sessionStorage.setItem('practicepro_original_session', sessionToken || '');
                // R16: also persist the original admin BEARER so guarded calls
                // work again immediately after revert-on-refresh.
                if (bearerToken) {
                    sessionStorage.setItem('practicepro_original_bearer', bearerToken);
                }
            } catch {
                // sessionStorage might be unavailable (private mode) — non-critical
            }
        }
        // ROLE OVERRIDE: Persist the expected portal role. The currentUser memo
        // will use this instead of the target user's actual DB role, so the
        // admin sees the TenantPortal even if the DB role has drifted to
        // 'Admin' or is null/undefined.
        setImpersonationRoleOverride(user.role);
        try {
            sessionStorage.setItem('practicepro_impersonation_role', user.role);
        } catch {
            // Non-critical
        }
        setSessionToken(user.email.toLowerCase());
        sessionStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify({ token: user.email.toLowerCase() }));
        // Swap the bearer to the impersonation session (guarded calls now
        // resolve as the target user — exactly the impersonation semantics).
        if (impersonationToken) {
            setBearerToken(impersonationToken);
            try { sessionStorage.setItem(BEARER_KEY, impersonationToken); } catch {}
        }
    };

    const revertToOriginalUser = () => {
        // R16: revoke the impersonation session (it was minted for the target
        // user — leaving it live would leave a usable bearer around).
        if (bearerToken) {
            revokeSessionMutation({ token: bearerToken }).catch(() => {});
        }
        // R16: restore the original admin BEARER (guarded calls work again
        // as the admin immediately; falls back to the persisted copy when
        // reverting after a refresh).
        let originalBearer: string | null = null;
        try {
            originalBearer = sessionStorage.getItem('practicepro_original_bearer');
        } catch {}
        setBearerToken(originalBearer);
        try {
            if (originalBearer) {
                sessionStorage.setItem(BEARER_KEY, originalBearer);
                sessionStorage.removeItem('practicepro_original_bearer');
            } else {
                sessionStorage.removeItem(BEARER_KEY);
            }
        } catch {}

        if (originalSessionToken) {
            setSessionToken(originalSessionToken);
            sessionStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify({ token: originalSessionToken }));
            setOriginalSessionToken(null);
            sessionStorage.removeItem('practicepro_original_session');
            // Clear the role override so the admin's actual DB role is used again
            setImpersonationRoleOverride(null);
            sessionStorage.removeItem('practicepro_impersonation_role');
        } else {
            // FALLBACK: If originalSessionToken was lost (e.g. page refresh),
            // try to restore from sessionStorage.
            try {
                const stored = sessionStorage.getItem('practicepro_original_session');
                if (stored) {
                    setSessionToken(stored);
                    sessionStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify({ token: stored }));
                    setOriginalSessionToken(null);
                    sessionStorage.removeItem('practicepro_original_session');
                    setImpersonationRoleOverride(null);
                    sessionStorage.removeItem('practicepro_impersonation_role');
                }
            } catch {
                // Non-critical
            }
        }
    };

    // SAFETY TIMEOUT: Prevent splash screen hang on slow connections (e.g. Lagos mobile)
    // Strategy: First timeout triggers a silent retry; second timeout falls back to landing.
    const [retryCount, setRetryCount] = React.useState(0);
    const [hasTimedOut, setHasTimedOut] = React.useState(false);
    React.useEffect(() => {
        const validationPending = shouldValidateSession && sessionValidation === undefined;
        if (sessionToken && sessionToken !== 'demo@practicepro.ng' && (!userData || validationPending)) {
            // Increase to 20s for first attempt; 15s for retries
            const timeoutMs = retryCount === 0 ? 20000 : 15000;
            const timer = setTimeout(() => {
                if (retryCount < 1) {
                    // Graceful retry: briefly clear and reset token to trigger re-fetch
                    console.warn(`[Auth] Session load timed out (attempt ${retryCount + 1}). Retrying...`);
                    setRetryCount(r => r + 1);
                    // Force Convex to retry the query by toggling
                    setSessionToken(null);
                    setTimeout(() => setSessionToken(sessionToken), 500);
                } else {
                    console.warn("[Auth] Session load timed out after retry. Falling back to landing page.");
                    setHasTimedOut(true);

                    // SECURITY: Only clear the session that belongs to the current user.
                    // If this is a portal user timeout, don't nuke the admin's session.
                    const isPortalSession = isPortalRoute();
                    if (isPortalSession) {
                        sessionStorage.removeItem(PORTAL_SESSION_KEY);
                        localStorage.removeItem(PORTAL_SESSION_KEY);
                    } else {
                        sessionStorage.removeItem(LOCAL_STORAGE_USER_KEY);
                        localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
                    }
                    // Clear portal type flag regardless
                    sessionStorage.removeItem('practicepro_portal_type');
                    localStorage.removeItem('practicepro_portal_type');
                }
            }, timeoutMs);
            return () => clearTimeout(timer);
        } else if (userData && !(shouldValidateSession && sessionValidation === undefined)) {
            setHasTimedOut(false);
            setRetryCount(0);
        }
    }, [sessionToken, userData, retryCount, sessionValidation, shouldValidateSession]);

    // Calculate final loading state
    // We are loading if:
    // 1. LocalStorage hasn't been read yet
    // 2. OR we have a token (trying to auto-login) AND data hasn't arrived yet AND we haven't timed out yet
    //
    // OFFLINE FIX: If we're offline AND have a cached user, don't keep loading —
    // the currentUser memo will return the cached user, so we should stop loading.
    const hasOfflineCache = (() => {
        if (!sessionToken || typeof navigator === 'undefined' || navigator.onLine) return false;
        try {
            const cached = localStorage.getItem('practicepro_cached_user');
            return cached && JSON.parse(cached)?.token === sessionToken;
        } catch { return false; }
    })();

    // Hold the splash while the session validity gate is pending: the shell
    // must never render with an unverified bearer (that flash is step one of
    // the death loop). The 20s/15s safety timeout (extended below) breaks
    // the wait if Convex never answers.
    const isSessionValidationPending =
        shouldValidateSession && sessionValidation === undefined && !hasTimedOut && !hasOfflineCache;
    const isLoading = !isStorageLoaded
        || (!!sessionToken && userData === undefined && sessionToken !== 'demo@practicepro.ng' && !hasTimedOut && !hasOfflineCache)
        || isSessionValidationPending;

    // Detect if the user's account has been revoked (isVerified=false + role=Pending)
    // This happens when deletePortalInviteAndCleanup resets a portal user.
    // We expose this so the App can redirect them to the login page with a clear message
    // instead of showing "Loading your portal..." for 15 seconds.
    const isAccountRevoked = !!sessionToken && !!userData && !userData.isVerified && (userData as any).role === 'Pending';

    // ─── Sentry + PostHog user context ─────────────────────────────────
    // Set/clear the user identity in both crash reporting and analytics
    // whenever currentUser changes.
    React.useEffect(() => {
        if (currentUser) {
            setSentryUser({
                id: currentUser.id,
                email: currentUser.email,
                name: currentUser.name,
            });
            identifyUser(currentUser.id, {
                email: currentUser.email,
                name: currentUser.name,
                role: currentUser.role,
            });
        } else {
            clearSentryUser();
            resetAnalyticsUser();
        }
    }, [currentUser]);

    const updateCurrentUser = React.useCallback((data: Partial<User>) => {
        setLocalUserOverrides(prev => ({ ...prev, ...data }));
    }, []);

    const loginAsDemoUser = React.useCallback((email?: string) => {
        // SECURITY: Demo login only works in development builds
        if (!import.meta.env.DEV) {
            console.warn("[Auth] Demo login is not available in production.");
            return Promise.resolve({ success: false, message: "Demo mode is not available in production." });
        }
        // Round 8: the pre-login 'Demo Signup' analytics event was removed —
        // analytics.trackEvent now requires a verified session (auth retrofit),
        // and this call fired before login with synthetic ids.
        return login('demo@practicepro.ng');
    }, [trackEventMutation, login]);

    const value = React.useMemo(() => ({
        isAuthenticated: !!currentUser,
        currentUser,
        appMode: AppMode.Multi,
        isLoadingSession: isLoading,
        isAccountRevoked,
        // R13: server-issued bearer session token (null = legacy email session).
        bearerToken,
        login,
        signup,
        verifyEmail,
        resendConfirmation,
        logout,
        markOnboardingComplete,
        refreshUser,
        updateCurrentUser,
        loginAsDemoUser,
        deleteAccount,
        switchFirm,
        leaveFirm,
        deleteFirm,
        loginAsUser,
        originalUser,
        isImpersonating: !!originalSessionToken,
        revertToOriginalUser
    }), [
        currentUser, isLoading, isAccountRevoked, bearerToken,
        login, signup, verifyEmail, resendConfirmation, logout,
        markOnboardingComplete, refreshUser, updateCurrentUser, loginAsDemoUser,
        deleteAccount, switchFirm, leaveFirm, deleteFirm, loginAsUser,
        originalUser, originalSessionToken, revertToOriginalUser
    ]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
