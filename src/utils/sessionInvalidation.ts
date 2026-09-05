/**
 * sessionInvalidation — the single source of truth for wiping client-side
 * auth state when a session dies.
 *
 * BORN FROM THE DEATH-LOOP INCIDENT (2026-09-05): when a session is dead,
 * the client must retire ALL of it — email session, bearer, offline cache,
 * impersonation leftovers — or the next boot re-enters the same broken
 * state (e.g. "Return to Home" previously left `practicepro_session_bearer`
 * behind, so a revoked bearer survived the click and resurfaced on reload).
 *
 * Both ConvexErrorBoundary (outside AuthContext, works even when the
 * provider tree is crashed) and AuthContext (boot-time validation gate)
 * import this so they can never disagree about what "logged out" means.
 */

/** Every client-side key that carries identity/session state. */
export const AUTH_SESSION_KEYS = [
  'practicepro_user_session',
  'practicepro_portal_session',
  'practicepro_session_bearer',
  'practicepro_cached_user',
  'practicepro_portal_type',
  'practicepro_original_session',
  'practicepro_original_bearer',
  'practicepro_impersonation_role',
  'practicepro_pending_impersonate_token',
  'practicepro_session_locked',
] as const;

function safeStorages(): Storage[] {
  const out: Storage[] = [];
  for (const candidate of [globalThis.sessionStorage, globalThis.localStorage]) {
    if (candidate && typeof candidate.removeItem === 'function') out.push(candidate);
  }
  return out;
}

/** Remove every auth/session key from both storages. Never throws. */
export function clearAllAuthStorage(): void {
  for (const storage of safeStorages()) {
    for (const key of AUTH_SESSION_KEYS) {
      try {
        storage.removeItem(key);
      } catch {
        /* storage unavailable (private mode / SSR) — nothing to clear */
      }
    }
  }
}

/**
 * Where a freshly-invalidated user should land. Portal users (tenant /
 * client) are returned to THEIR login page so they don't have to hunt for
 * it; everyone else goes to the app landing page. The `expired` param lets
 * the login surfaces explain themselves (mirrors the existing `revoked=1`
 * convention used by the portal-revocation redirect in App.tsx).
 */
export function authSignInUrl(): string {
  try {
    const portalType =
      globalThis.sessionStorage?.getItem?.('practicepro_portal_type') ||
      globalThis.localStorage?.getItem?.('practicepro_portal_type');
    if (portalType === 'client') return '/portal/client/login?expired=1';
    if (portalType === 'tenant') return '/portal/tenant/login?expired=1';
  } catch {
    /* storage unavailable — default below */
  }
  return '/?expired=1';
}
