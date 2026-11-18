/**
 * founderBoot — the pure boot-gating rules for the Founder APK.
 *
 * FOUNDER-REPORTED (2026-11-18): opening the founder APK showed the splash
 * and a permission dialog, then a permanent BLACK SCREEN — the app never
 * loaded. Reproduced headlessly the same day: with a stored session whose
 * getUser lookup resolves to null, the auth provider computed
 *
 *     isLoadingSession: sessionToken && !userData ? true : false
 *
 * Convex useQuery returns `undefined` while the query is in flight but
 * `null` when the query RESOLVED to no user. The expression above treats
 * BOTH as "still loading", so the resolved-empty case can never finish:
 * showSplash stays true forever and the app parks on the splash's final
 * near-black (#0e0e11) frame — reported as "splash, then black screen,
 * never loads".
 *
 * The fix: "loading" must mean PENDING ONLY (isSessionQueryPending). A
 * resolved-empty session falls through to the login screen.
 *
 * SESSION_WATCHDOG_MS covers the other half — a session query that NEVER
 * resolves (backend unreachable, deploy mismatch) also used to park the
 * app on the splash. If the query is still pending that long after the
 * cinematic completed, the founder app drops the splash and renders the
 * login screen. The founder app must never strand the founder on a black
 * screen, whatever the backend is doing.
 */

/**
 * How long after the splash cinematic completes we keep waiting on a
 * pending session query before dropping the splash. Generous enough that
 * a healthy-but-slow first connect (websocket setup on a debug-signed
 * WebView) is never interrupted; short enough that the founder is never
 * stuck on a near-black frame for more than a few seconds.
 */
export const SESSION_WATCHDOG_MS = 4000;

/**
 * True only while the session query is genuinely IN FLIGHT.
 * - no usable session token (null/empty)     → false (fresh install: nothing to wait for)
 * - token + query pending                    → true  (userData === undefined)
 * - token + query resolved to no user        → FALSE (userData === null — the
 *   black-screen bug: the old expression returned true here forever)
 * - token + user resolved                    → false
 *
 * The token check is truthy (not `!== null`) to match the old behavior for
 * empty-string tokens — a stored session without a usable token must not
 * gate the splash.
 */
export function isSessionQueryPending(
  sessionToken: string | null,
  userData: unknown
): boolean {
  return !!sessionToken && userData === undefined;
}
