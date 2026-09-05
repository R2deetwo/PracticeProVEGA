/**
 * R17/P0 regression suite — the "death loop" incident (2026-09-05).
 *
 * A user with a legacy email-only session rendered the app shell, every
 * strict-mode query threw `Unauthenticated`, and ConvexErrorBoundary:
 *   - classified it as CONNECTION (the `[CONVEX Q(...)]` prefix shadowed
 *     the auth signal) and showed "we're recovering" copy;
 *   - retried every 3s FOREVER with an uncapped counter labeled "/3"
 *     ("attempt 22 of 3"), remounting the whole app each time.
 *
 * These tests lock the two decisions that must never regress:
 *   1. classification order — auth beats the Convex transport prefix;
 *   2. every retry policy is BOUNDED, with the schedule it claims.
 */
import { describe, it, expect, afterEach } from "vitest";
import {
  classifyConvexError,
  RETRY_POLICIES,
  retryDelayFor,
  retryScheduleFor,
  STABILITY_RESET_MS,
} from "../../src/utils/errorRecovery";
import {
  clearAllAuthStorage,
  authSignInUrl,
  AUTH_SESSION_KEYS,
} from "../../src/utils/sessionInvalidation";

// ─── Classification ──────────────────────────────────────────────────────────

describe("classifyConvexError — auth must outrank the transport prefix", () => {
  // VERBATIM the production error that produced the incident.
  const INCIDENT_MESSAGE =
    "Error: [CONVEX Q(sentry:getInboundMessages)] [Request ID: 3a018cfd68b594e6] " +
    "Server Error Uncaught Error: Unauthenticated: a verified session is required. " +
    "Please sign in again.";

  it("classifies the exact incident message as auth (not connection)", () => {
    expect(classifyConvexError(INCIDENT_MESSAGE).category).toBe("auth");
  });

  it("classifies the invalid/expired/revoked token message as auth", () => {
    const msg =
      "Uncaught Error: Unauthenticated: the session token is invalid, expired, or revoked. Please sign in again.";
    expect(classifyConvexError(msg).category).toBe("auth");
  });

  it("auth copy explains a sign-in, not a 'we are recovering' connection", () => {
    const t = classifyConvexError("Unauthenticated: a verified session is required.");
    expect(t.category).toBe("auth");
    expect(t.title.toLowerCase()).toContain("session");
    expect(t.subtitle.toLowerCase()).toContain("sign in");
    expect(t.subtitle.toLowerCase()).not.toContain("reconnect");
  });

  it("firm-mismatch rejections are permission, NOT auth (re-login won't help)", () => {
    expect(classifyConvexError("Not authorized: cannot access data belonging to a different firm.").category)
      .toBe("permission");
  });

  it("administrator-privilege rejections are permission", () => {
    expect(classifyConvexError("Permission denied. This action requires Administrator privileges.").category)
      .toBe("permission");
  });

  it("transport errors are connection", () => {
    expect(classifyConvexError("[CONVEX Q(a:b)] Connection lost while streaming").category).toBe("connection");
    expect(classifyConvexError("WebSocket closed before handshake completed").category).toBe("connection");
    expect(classifyConvexError("Network request failed").category).toBe("connection");
    expect(classifyConvexError("TypeError: failed to fetch").category).toBe("connection");
  });

  it("not-found → data, typeerror → render, junk → unknown", () => {
    expect(classifyConvexError("Message not found").category).toBe("data");
    expect(classifyConvexError("TypeError: x is not a function").category).toBe("render");
    expect(classifyConvexError("something completely different").category).toBe("unknown");
  });

  it("null/undefined messages degrade to unknown, never throw", () => {
    expect(classifyConvexError(null).category).toBe("unknown");
    expect(classifyConvexError(undefined).category).toBe("unknown");
    expect(classifyConvexError(42).category).toBe("unknown");
  });
});

// ─── Bounded retry policies (the "22 of 3" cure) ─────────────────────────────

describe("retry policies — every category is bounded", () => {
  it("no category allows infinite retries", () => {
    for (const policy of Object.values(RETRY_POLICIES)) {
      expect(policy.maxAutoRetries).toBeLessThan(10);
      expect(Number.isFinite(policy.maxAutoRetries)).toBe(true);
    }
  });

  it("auth: exactly 2 short flat retries, then STOP", () => {
    expect(retryScheduleFor(RETRY_POLICIES.auth)).toEqual([1500, 1500]);
    expect(retryDelayFor(RETRY_POLICIES.auth, 2)).toBeNull();
    expect(retryDelayFor(RETRY_POLICIES.auth, 3)).toBeNull(); // never resurrects
  });

  it("connection: 5 retries with exponential backoff 3s→48s, then STOP", () => {
    expect(retryScheduleFor(RETRY_POLICIES.connection)).toEqual([3000, 6000, 12000, 24000, 48000]);
    expect(retryDelayFor(RETRY_POLICIES.connection, 5)).toBeNull();
  });

  it("permission: NEVER auto-retries", () => {
    expect(retryDelayFor(RETRY_POLICIES.permission, 0)).toBeNull();
    expect(RETRY_POLICIES.permission.maxAutoRetries).toBe(0);
  });

  it("delays never exceed the policy ceiling", () => {
    for (const policy of Object.values(RETRY_POLICIES)) {
      for (let i = 0; i < policy.maxAutoRetries + 2; i++) {
        const d = retryDelayFor(policy, i);
        if (d !== null) expect(d).toBeLessThanOrEqual(policy.maxDelayMs);
      }
    }
  });

  it("stability reset window is 60s", () => {
    expect(STABILITY_RESET_MS).toBe(60_000);
  });
});

// ─── Session invalidation (clean sign-out leaves nothing behind) ─────────────

describe("sessionInvalidation — total wipe + correct landing URL", () => {
  const makeStorage = () => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
      setItem: (k: string, v: string) => void map.set(k, String(v)),
      removeItem: (k: string) => void map.delete(k),
      clear: () => void map.clear(),
      key: (i: number) => Array.from(map.keys())[i] ?? null,
      get length() {
        return map.size;
      },
    };
  };

  let sessionStub: any;
  let localStub: any;

  afterEach(() => {
    delete (globalThis as any).sessionStorage;
    delete (globalThis as any).localStorage;
  });

  it("clearAllAuthStorage removes every auth key from BOTH storages", () => {
    sessionStub = makeStorage();
    localStub = makeStorage();
    (globalThis as any).sessionStorage = sessionStub;
    (globalThis as any).localStorage = localStub;

    for (const key of AUTH_SESSION_KEYS) {
      sessionStub.setItem(key, "x");
      localStub.setItem(key, "x");
    }
    sessionStub.setItem("unrelated_user_pref", "keep-me");
    localStub.setItem("unrelated_user_pref", "keep-me");

    clearAllAuthStorage();

    for (const key of AUTH_SESSION_KEYS) {
      expect(sessionStub.getItem(key)).toBeNull();
      expect(localStub.getItem(key)).toBeNull();
    }
    expect(sessionStub.getItem("unrelated_user_pref")).toBe("keep-me");
    expect(localStub.getItem("unrelated_user_pref")).toBe("keep-me");
  });

  it("clearAllAuthStorage is a no-op (not a crash) with no storage at all", () => {
    expect(() => clearAllAuthStorage()).not.toThrow();
  });

  it("the dead bearer does NOT survive the wipe (the incident's sticky state)", () => {
    sessionStub = makeStorage();
    (globalThis as any).sessionStorage = sessionStub;
    sessionStub.setItem("practicepro_session_bearer", "dead-token");
    clearAllAuthStorage();
    expect(sessionStub.getItem("practicepro_session_bearer")).toBeNull();
  });

  it("app users land on the landing page with the expired flag", () => {
    expect(authSignInUrl()).toBe("/?expired=1");
  });

  it("tenant portal users land on THEIR login page", () => {
    sessionStub = makeStorage();
    (globalThis as any).sessionStorage = sessionStub;
    sessionStub.setItem("practicepro_portal_type", "tenant");
    expect(authSignInUrl()).toBe("/portal/tenant/login?expired=1");
  });

  it("client portal users land on THEIR login page", () => {
    localStub = makeStorage();
    (globalThis as any).localStorage = localStub;
    localStub.setItem("practicepro_portal_type", "client");
    expect(authSignInUrl()).toBe("/portal/client/login?expired=1");
  });
});
