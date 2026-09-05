/**
 * errorRecovery — pure decision layer for client crash/retry UX.
 *
 * BORN FROM A PRODUCTION INCIDENT (2026-09-05, the "death loop"):
 * a user with a legacy email-only session (no bearer token) rendered the
 * app shell via getUser (email bootstrap), then every strict-mode query
 * threw `Unauthenticated`. ConvexErrorBoundary classified the error as
 * CONNECTION (because the message carries the `[CONVEX Q(...)]` prefix),
 * retried every 3s forever with an uncapped counter labeled "/3" —
 * "attempt 22 of 3" — remounting the whole app each time and cycling
 * splash ↔ error screen.
 *
 * This module owns the two decisions that must NEVER be improvised again:
 *   1. WHAT KIND of failure is this? (classification — auth errors are
 *      checked FIRST so the `[CONVEX ...]` prefix can't mask them)
 *   2. SHOULD we retry, and when do we STOP? (bounded policies)
 *
 * Pure on purpose: no React, no DOM, no timers — fully unit-testable in
 * the repo's node test environment.
 */

export type ErrorCategory =
  | 'auth'
  | 'permission'
  | 'connection'
  | 'data'
  | 'render'
  | 'unknown';

export interface ErrorTranslation {
  title: string;
  subtitle: string;
  category: ErrorCategory;
}

// ─── Classification patterns (ORDER MATTERS) ────────────────────────────────
// Auth MUST be tested before connection: Convex client errors are prefixed
// `[CONVEX Q(...)] ...` which trivially matches any "convex" connection
// heuristic — that exact shadowing produced the death loop's wrong copy
// ("Your data is safe. We're reconnecting…") for a session rejection.

const AUTH_PATTERNS: RegExp[] = [
  /unauthenticated/i,
  /a verified session is required/i,
  /session token is invalid/i,
  /please sign in again/i,
  /not logged in/i,
  /session has expired/i,
];

const PERMISSION_PATTERNS: RegExp[] = [
  /^not authorized/i,
  /permission denied/i,
  /portal users do not have access/i,
  /belongs to a different firm/i,
  /administrator privileges/i,
];

const CONNECTION_PATTERNS: RegExp[] = [
  /\[convex/i, // the transport-level error prefix
  /websocket/i,
  /convex\.cloud/i,
  /connection (lost|interrupted|closed)/i,
  /networkerror/i,
  /failed to fetch/i,
  /network request failed/i,
  /timed? ?out/i,
];

const DATA_PATTERNS: RegExp[] = [
  /not found/i,
  /does not exist/i,
  /record not found/i,
];

const RENDER_PATTERNS: RegExp[] = [
  /typeerror/i,
  /is not a function/i,
  /is undefined/i,
  /is null/i,
  /cannot read propert/i,
];

const matches = (msg: string, patterns: RegExp[]): boolean =>
  patterns.some((p) => p.test(msg));

export function classifyConvexError(rawMessage: unknown): ErrorTranslation {
  const msg = (rawMessage == null ? '' : String(rawMessage));

  // 1. AUTH — a session rejection. Retrying cannot mint a token; the only
  //    sane resolution is a clean sign-in. Capped at a couple of SHORT
  //    retries purely to survive storage races (cross-tab login).
  if (matches(msg, AUTH_PATTERNS)) {
    return {
      category: 'auth',
      title: 'Your session has ended',
      subtitle:
        'You were signed out — your session expired or was signed in on another device. Your data is safe. Please sign in again to continue.',
    };
  }

  // 2. PERMISSION — the caller is authenticated but not allowed. Retry is
  //    pointless and a re-login won't help either; show the fact.
  if (matches(msg, PERMISSION_PATTERNS)) {
    return {
      category: 'permission',
      title: 'You don\u2019t have access to this',
      subtitle:
        'Your account isn\u2019t permitted to perform this action. If you believe this is a mistake, contact your administrator or support.',
    };
  }

  // 3. CONNECTION — transport problems. The ONLY category where sustained
  //    retrying is genuinely useful (network blips, Convex hiccups).
  if (matches(msg, CONNECTION_PATTERNS)) {
    return {
      category: 'connection',
      title: 'Connection interrupted',
      subtitle:
        'Your data is safe. We\u2019re reconnecting to the server automatically \u2014 this usually resolves in a few seconds.',
    };
  }

  // 4. DATA — the requested record is gone. One retry covers delete races.
  if (matches(msg, DATA_PATTERNS)) {
    return {
      category: 'data',
      title: 'Something went missing',
      subtitle:
        'The item you were looking for may have been moved or deleted. Try navigating back and refreshing.',
    };
  }

  // 5. RENDER — deterministic code faults. A couple of retries in case the
  //    fault was a transient hydration order, then stop.
  if (matches(msg, RENDER_PATTERNS)) {
    return {
      category: 'render',
      title: 'We\u2019ve hit a slight operational bump',
      subtitle:
        'Don\u2019t worry \u2014 your data is safe. Our system is attempting to recover automatically.',
    };
  }

  return {
    category: 'unknown',
    title: 'We\u2019ve hit a slight operational bump',
    subtitle:
      'Your data is safe. Our system is attempting to recover automatically \u2014 this usually resolves in a moment.',
  };
}

// ─── Retry policies (BOUNDED — the death loop must be impossible) ───────────

export interface RetryPolicy {
  /** Total AUTOMATIC retries allowed before we stop and surface buttons. */
  maxAutoRetries: number;
  /** Delay before the first retry (ms). */
  baseDelayMs: number;
  /** Multiplier applied per completed attempt (1 = flat). */
  backoffFactor: number;
  /** Ceiling on any single delay (ms). */
  maxDelayMs: number;
}

export const RETRY_POLICIES: Record<ErrorCategory, RetryPolicy> = {
  // Two short, flat retries — only to survive a storage/hydration race
  // where a freshly-issued bearer lands ~1s after the first rejection.
  auth: { maxAutoRetries: 2, baseDelayMs: 1500, backoffFactor: 1, maxDelayMs: 1500 },
  // The only unbounded-in-spirit category — but still CAPPED, with proper
  // exponential backoff: 3s, 6s, 12s, 24s, 48s, then stop and show buttons.
  connection: { maxAutoRetries: 5, baseDelayMs: 3000, backoffFactor: 2, maxDelayMs: 48000 },
  // Never auto-retry: the server will answer the same way every time.
  permission: { maxAutoRetries: 0, baseDelayMs: 0, backoffFactor: 1, maxDelayMs: 0 },
  // One retry — covers read-after-delete races, nothing else.
  data: { maxAutoRetries: 1, baseDelayMs: 2000, backoffFactor: 1, maxDelayMs: 2000 },
  // Deterministic faults: two retries max.
  render: { maxAutoRetries: 2, baseDelayMs: 3000, backoffFactor: 1, maxDelayMs: 3000 },
  unknown: { maxAutoRetries: 2, baseDelayMs: 3000, backoffFactor: 1, maxDelayMs: 3000 },
};

/**
 * Delay (ms) before the next automatic retry, or `null` when the policy is
 * exhausted and the UI must stop retrying and surface manual actions.
 * `attemptsSoFar` = automatic retries already performed in this burst.
 */
export function retryDelayFor(
  policy: RetryPolicy,
  attemptsSoFar: number
): number | null {
  if (attemptsSoFar >= policy.maxAutoRetries) return null;
  const raw = policy.baseDelayMs * Math.pow(policy.backoffFactor, attemptsSoFar);
  return Math.min(Math.max(Math.round(raw), 0), policy.maxDelayMs);
}

/**
 * If the app renders error-free for this long after a recovery, the retry
 * burst is forgotten (counter reset) — a healthy-but-long-lived session
 * must never accumulate attempts across unrelated transient hiccups.
 * (Pre-incident behavior: an instance counter that only ever grew —
 * the "attempt 22" half of the bug.)
 */
export const STABILITY_RESET_MS = 60_000;

/** Convenience: the exact retry schedule a policy produces (for tests/UI). */
export function retryScheduleFor(policy: RetryPolicy): number[] {
  const schedule: number[] = [];
  for (let i = 0; i < policy.maxAutoRetries; i++) {
    schedule.push(retryDelayFor(policy, i) as number);
  }
  return schedule;
}
