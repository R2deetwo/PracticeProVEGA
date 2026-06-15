
import * as React from 'react';
import { User, AppMode, UserRole, SubscriptionPlan } from '../types';
import { useQuery, useMutation, useAction, useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";

const LOCAL_STORAGE_USER_KEY = 'practicepro_user_session';
const PORTAL_SESSION_KEY = 'practicepro_portal_session';

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
    login: (email: string, password?: string, mfaCode?: string, rememberMe?: boolean) => Promise<{ success: boolean, message?: string, isLocked?: boolean, isRevoked?: boolean, requiresMfa?: boolean, mfaType?: string }>;
    signup: (firmName: string, fullName: string, email: string, password?: string, mode?: AppMode, inviteCode?: string, plan?: SubscriptionPlan, product?: 'legal' | 'property' | 'unified') => Promise<{ success: boolean, message?: string, requiresConfirmation?: boolean, debugCode?: string, code?: string }>;
    verifyEmail: (email: string, code: string) => Promise<{ success: boolean, message?: string }>;
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
        console.error("Failed to parse session", e);
    }
    return null;
};

export const AuthProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
    const convex = useConvex();
    const [sessionToken, setSessionToken] = React.useState<string | null>(getInitialToken);
    const [isStorageLoaded, setIsStorageLoaded] = React.useState(true);

    // State to handle impersonation
    const [originalSessionToken, setOriginalSessionToken] = React.useState<string | null>(null);

    // Local overrides for UI responsiveness (e.g. defaultViewModes)
    const [localUserOverrides, setLocalUserOverrides] = React.useState<Partial<User> | null>(null);

    const startSignupAction = useAction(api.myFunctions.startSignup);
    const verifyCodeMutation = useMutation(api.myFunctions.verifyCode);
    const deleteAccountMutation = useMutation(api.myFunctions.deleteAccount);
    const repairAccountMutation = useMutation(api.myFunctions.repairAccountConnection);
    const trackEventMutation = useMutation(api.analytics.trackEvent);
    const verifyLoginAction = useAction(api.myFunctions.verifyLogin);
    const leaveFirmMutation = useMutation(api.myFunctions.leaveFirm);
    const deleteFirmMutation = useMutation(api.myFunctions.deleteFirm);
    const repairAccountConnectionMutation = useMutation(api.myFunctions.repairAccountConnection);

    // Fetch user data based on the active session token (email)
    // Server-side try-catch in getUser prevents Convex from throwing to client.
    // This will return undefined (loading), null (not found), or the user object.
    const userData = useQuery(api.myFunctions.getUser, sessionToken ? { tokenIdentifier: sessionToken } : "skip");

    // Fetch original user data if impersonating
    const originalUserData = useQuery(api.myFunctions.getUser, originalSessionToken ? { tokenIdentifier: originalSessionToken } : "skip");

    // 2. Storage is already loaded synchronously, but keep effect for any future side-effects
    React.useEffect(() => {
        setIsStorageLoaded(true);
    }, []);

    const currentUser: User | null = React.useMemo(() => {
        // DEMO MODE BYPASS
        if (sessionToken === 'demo@practicepro.ng') {
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

        // Use backend data if available
        const data = userData;

        if (!data) return null;

        // If not verified, effectively not logged in for the app
        if (!data.isVerified) return null;

        // Defense-in-depth: A user with role="Pending" should not have an active session.
        // This catches cases where a portal user's access was revoked via
        // deletePortalInviteAndCleanup (which sets role="Pending" + isVerified=false)
        // but somehow their session token is still valid.
        if ((data as any).role === 'Pending') return null;

        // SECURITY: Explicit field mapping - NEVER spread raw data.
        // This ensures sensitive fields (password, mfaCode, verificationCode, etc.) 
        // are never transmitted to the frontend state.
        const combined = {
            id: data._id || data.id,
            firmId: data.firmId,
            name: data.name,
            email: data.email,
            role: (data.role as UserRole) || UserRole.Admin,
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
            // Explicitly excluded: password, mfaCode, verificationCode, failedLoginAttempts, lockedUntil
            ...localUserOverrides
        };

        return combined;
    }, [userData, sessionToken, localUserOverrides]);

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
        return {
            id: originalUserData._id,
            firmId: originalUserData.firmId,
            name: originalUserData.name,
            email: originalUserData.email,
            role: (originalUserData.role as UserRole) || UserRole.Admin,
            avatarUrl: originalUserData.avatarUrl,
            onboardingCompleted: originalUserData.onboardingCompleted,
            showProTips: originalUserData.showProTips ?? true,
        };
    }, [originalUserData]);

    const login = async (email: string, password?: string, mfaCode?: string, rememberMe: boolean = true) => {
        const token = email.toLowerCase().trim();

        // Bypass check for demo user
        if (token === 'demo@practicepro.ng') {
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
                mfaCode: mfaCode ? String(mfaCode) : undefined
            });

            if (!verifyResult.success) {
                // Determine if this is a lockout, MFA prompt, or just wrong password
                if (verifyResult.isLocked) {
                    return { success: false, message: verifyResult.message, isLocked: true };
                }
                if (verifyResult.requiresMfa) {
                    return { success: false, requiresMfa: true, mfaType: verifyResult.mfaType, debugCode: (verifyResult as any).debugCode };
                }
                return { success: false, message: verifyResult.message };
            }

            // 3. Set Session
            setSessionToken(token);
            
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
            console.error("Login verification failed:", error);
            const errorMsg = error?.message || String(error);

            // Return standard error without giving admin bypass
            return { success: false, message: `Login error: ${errorMsg}. Server may be unavailable.` };
        }
    };

    const refreshUser = async () => {
        if (!sessionToken) return;

        console.log("Manual Refresh Requested. Attempting Database Repair...");

        try {
            // 2. Run the Repair Mutation explicitly
            // This attempts to find any firm linked to this email and reconnect it in the DB
            const repairResult = await repairAccountMutation({ email: sessionToken });

            if (repairResult.success) {
                console.log("✅ Repair Successful! Found and linked firm.");
                // Force a query re-fetch by toggling the token briefly? No, mutation triggers update.
            } else {
                console.log("⚠️ Repair check complete. No hidden firm found for this email.", repairResult.message);
            }

        } catch (e) {
            console.error("Refresh/Repair failed:", e);
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

    const verifyEmail = async (email: string, code: string) => {
        try {
            const result = await verifyCodeMutation({ email, code });
            if (result.success) {
                const token = email.toLowerCase().trim();
                setSessionToken(token);
                sessionStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify({ token }));
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

        // Fire-and-forget tracking — NEVER block logout on analytics.
        // If the Convex connection is stale or the network is slow, awaiting
        // this mutation can cause the logout button to appear unresponsive.
        if (currentUser && currentUser.email !== 'demo@practicepro.ng') {
            trackEventMutation({
                firmId: currentUser.firmId || 'none',
                userId: currentUser.id,
                event: 'User Logout',
                properties: { email: currentUser.email }
            }).catch(e => console.warn("[Auth] Logout tracking failed:", e));
        }

        // Clear in-memory React state FIRST so the UI immediately stops rendering
        // as an authenticated user — this prevents stale renders on slow devices
        setSessionToken(null);
        if (originalSessionToken) {
            setOriginalSessionToken(null);
        }

        // SECURITY: When a portal user logs out, only clear the PORTAL session.
        // NEVER clear practicepro_user_session — that's the admin's session and
        // clearing it from localStorage would kill the admin's session on any
        // other open tab, which can cause cross-session contamination.
        if (isPortalUser) {
            sessionStorage.removeItem(PORTAL_SESSION_KEY);
            localStorage.removeItem(PORTAL_SESSION_KEY);
            sessionStorage.removeItem('practicepro_portal_type');
            localStorage.removeItem('practicepro_portal_type');
            // Do NOT clear LOCAL_STORAGE_USER_KEY — that belongs to the admin
        } else {
            // Admin logout — clear only the admin session
            sessionStorage.removeItem(LOCAL_STORAGE_USER_KEY);
            localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
            // Also clear any stale portal session since admin is fully logging out
            sessionStorage.removeItem(PORTAL_SESSION_KEY);
            localStorage.removeItem(PORTAL_SESSION_KEY);
            sessionStorage.removeItem('practicepro_portal_type');
            localStorage.removeItem('practicepro_portal_type');
        }
        localStorage.removeItem('practicepro_session_locked');

        // Redirect portal users to their specific login page, not the main landing page
        if (isPortalUser) {
            if (portalType === 'client' || currentUser?.role === 'Client') {
                window.location.href = '/portal/client/login';
            } else if (portalType === 'tenant' || currentUser?.role === 'Tenant') {
                window.location.href = '/portal/tenant/login';
            } else {
                window.location.href = '/';
            }
        } else {
            window.location.href = '/';
        }
    };

    const markOnboardingComplete = (firmId: string) => {
        // Handled by mutations
    };

    const deleteAccount = async () => {
        if (!sessionToken) return { success: false };
        try {
            await deleteAccountMutation({ email: sessionToken });
            await logout();
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    };

    const leaveFirm = async (firmId: string) => {
        if (!sessionToken) return { success: false };
        try {
            await leaveFirmMutation({ email: sessionToken, firmId });
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    };

    const deleteFirm = async (firmId: string) => {
        try {
            await deleteFirmMutation({ firmId, confirmed: true });
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    };

    const switchFirm = async (firmId: string) => {
        if (!currentUser || !sessionToken) return;
        try {
            await repairAccountConnectionMutation({ email: sessionToken, targetFirmId: firmId });
            // The userData query will automatically refetch when the user's firmId changes
        } catch (e) {
            console.error("Failed to switch firm", e);
        }
    };

    // Impersonation Logic
    const loginAsUser = (user: User) => {
        if (!originalSessionToken) {
            setOriginalSessionToken(sessionToken); // Save current admin session
        }
        setSessionToken(user.email.toLowerCase());
        sessionStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify({ token: user.email.toLowerCase() }));
    };

    const revertToOriginalUser = () => {
        if (originalSessionToken) {
            setSessionToken(originalSessionToken);
            sessionStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify({ token: originalSessionToken }));
            setOriginalSessionToken(null);
        }
    };

    // SAFETY TIMEOUT: Prevent splash screen hang on slow connections (e.g. Lagos mobile)
    // Strategy: First timeout triggers a silent retry; second timeout falls back to landing.
    const [retryCount, setRetryCount] = React.useState(0);
    const [hasTimedOut, setHasTimedOut] = React.useState(false);
    React.useEffect(() => {
        if (sessionToken && !userData && sessionToken !== 'demo@practicepro.ng') {
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
        } else if (userData) {
            setHasTimedOut(false);
            setRetryCount(0);
        }
    }, [sessionToken, userData, retryCount]);

    // Calculate final loading state
    // We are loading if: 
    // 1. LocalStorage hasn't been read yet
    // 2. OR we have a token (trying to auto-login) AND data hasn't arrived yet AND we haven't timed out yet
    const isLoading = !isStorageLoaded || (!!sessionToken && userData === undefined && sessionToken !== 'demo@practicepro.ng' && !hasTimedOut);

    // Detect if the user's account has been revoked (isVerified=false + role=Pending)
    // This happens when deletePortalInviteAndCleanup resets a portal user.
    // We expose this so the App can redirect them to the login page with a clear message
    // instead of showing "Loading your portal..." for 15 seconds.
    const isAccountRevoked = !!sessionToken && !!userData && !userData.isVerified && (userData as any).role === 'Pending';

    const value = {
        isAuthenticated: !!currentUser,
        currentUser,
        appMode: AppMode.Multi,
        isLoadingSession: isLoading,
        isAccountRevoked,
        login,
        signup,
        verifyEmail,
        resendConfirmation,
        logout,
        markOnboardingComplete,
        refreshUser,
        updateCurrentUser: (data: Partial<User>) => {
            setLocalUserOverrides(prev => ({ ...prev, ...data }));
        },
        loginAsDemoUser: (email?: string) => {
            if (email) {
                // Fire-and-forget tracking
                trackEventMutation({
                    firmId: 'demo_firm',
                    userId: 'demo_user',
                    event: 'Demo Signup',
                    properties: { email, source: 'Landing Page' },
                }).catch(e => console.warn("[Auth] Demo tracking failed:", e));
            }
            return login('demo@practicepro.ng');
        },
        deleteAccount,
        switchFirm,
        leaveFirm,
        deleteFirm,
        loginAsUser,
        originalUser,
        revertToOriginalUser
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
