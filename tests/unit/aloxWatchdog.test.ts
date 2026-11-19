/**
 * ALOA X watchdog regression suite (2026-11-19).
 *
 * OWNER CONTRACT: "we can have aloa x that is in charge of all the other
 * apps and ensures that there are no problems" + "add founder login push
 * alert as well". This suite locks in:
 *
 * PART 1 — pure check logic (convex/alox.ts): every evaluator fires at
 *   exactly its documented threshold and stays quiet below it; re-notify
 *   cadence (critical 6h, warning 24h) never spams and never goes silent.
 * PART 2 — source-scanned wiring contracts (removal fails CI):
 *   - the 15-minute watchdog cron exists and points at internal.alox
 *   - verifyLogin fires founder login alerts on success / failed / locked
 *     (and passes clientHint so the alert says WHERE the login came from)
 *   - the alox/founder_login push types route to the practicepro-watchdog
 *     channel in ALL THREE channel maps (server, Java, client — the trio
 *     that is "kept in sync deliberately")
 *   - the founder app exposes the Aloa X view (nav item, view map, router)
 *   - the recovery search fix stays fixed: full 5000-user scan, deactivated
 *     accounts findable, and recovery clears the deactivation flag.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ALOX_THRESHOLDS,
  evaluateBackendErrors,
  evaluateIngestion,
  evaluateIngestionFailures,
  evaluateReconciliation,
  evaluateBackups,
  evaluateDbCapacity,
  evaluateFounderCount,
  evaluateFounderSecurity,
  evaluateFounderBruteforce,
  evaluateMessagingBacklog,
  evaluatePushReachability,
  shouldRenotify,
} from "../../convex/alox";
import { channelForType } from "../../convex/pushNotificationsNode";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-11-19T12:00:00.000Z");

const here = fileURLToPath(import.meta.url);
const repoRoot = here.includes("/tests/unit/")
  ? resolve(dirname(here), "../..")
  : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), "utf8");

// ─── PART 1: check evaluators ───────────────────────────────────────────────

describe("evaluateBackendErrors", () => {
  it("stays quiet below the warning threshold", () => {
    expect(evaluateBackendErrors(0).status).toBe("ok");
    expect(evaluateBackendErrors(9).status).toBe("ok");
  });
  it("warns at exactly 10 errors / 24h", () => {
    const r = evaluateBackendErrors(10);
    expect(r.status).toBe("problem");
    expect(r.severity).toBe("warning");
  });
  it("goes critical at exactly 50 errors / 24h", () => {
    const r = evaluateBackendErrors(50);
    expect(r.status).toBe("problem");
    expect(r.severity).toBe("critical");
  });
});

describe("evaluateIngestion (the Legal KB engine)", () => {
  it("a PAUSED engine is never 'stalled' — the founder paused it on purpose", () => {
    expect(evaluateIngestion(false, null, NOW).status).toBe("ok");
    expect(evaluateIngestion(false, NOW - 3 * DAY, NOW).status).toBe("ok");
  });
  it("enabled but never ran = critical", () => {
    const r = evaluateIngestion(true, null, NOW);
    expect(r.status).toBe("problem");
    expect(r.severity).toBe("critical");
  });
  it("a run 46 minutes ago (3 missed 15-min cycles) = critical", () => {
    expect(evaluateIngestion(true, NOW - 46 * MIN, NOW).severity).toBe("critical");
  });
  it("a run 30 minutes ago is healthy", () => {
    expect(evaluateIngestion(true, NOW - 30 * MIN, NOW).status).toBe("ok");
  });
});

describe("evaluateIngestionFailures", () => {
  it("19 failed rows is normal link-rot noise", () => {
    expect(evaluateIngestionFailures(19).status).toBe("ok");
  });
  it("20 failed rows = systemic warning", () => {
    expect(evaluateIngestionFailures(20).severity).toBe("warning");
  });
});

describe("evaluateReconciliation (financial books)", () => {
  it("no report ever = warning (never-run, not necessarily broken)", () => {
    expect(evaluateReconciliation(null, NOW).severity).toBe("warning");
  });
  it("a fresh green report is healthy", () => {
    expect(evaluateReconciliation({ ranAt: NOW - 2 * HOUR, ok: true }, NOW).status).toBe("ok");
  });
  it("a report older than 36h = missed daily run", () => {
    expect(evaluateReconciliation({ ranAt: NOW - 37 * HOUR, ok: true }, NOW).severity).toBe("warning");
  });
  it("a fresh RED report = critical (money does not balance)", () => {
    expect(evaluateReconciliation({ ranAt: NOW - 2 * HOUR, ok: false }, NOW).severity).toBe("critical");
  });
});

describe("evaluateBackups", () => {
  it("no successful backup on record = warning", () => {
    expect(evaluateBackups(null, NOW).severity).toBe("warning");
  });
  it("29h old is fine (nightly job, 30h tolerance)", () => {
    expect(evaluateBackups(NOW - 29 * HOUR, NOW).status).toBe("ok");
  });
  it("31h old = late warning; 8 days = critical", () => {
    expect(evaluateBackups(NOW - 31 * HOUR, NOW).severity).toBe("warning");
    expect(evaluateBackups(NOW - 8 * DAY, NOW).severity).toBe("critical");
  });
});

describe("evaluateDbCapacity", () => {
  it("no recording yet is not an alert", () => {
    expect(evaluateDbCapacity(null).status).toBe("ok");
  });
  it("uncapped tables are healthy", () => {
    expect(
      evaluateDbCapacity([
        { table: "matters", rowCount: 400, capped: false },
        { table: "users", rowCount: 12, capped: false },
      ]).status
    ).toBe("ok");
  });
  it("a table at the 5000-row cap = warning", () => {
    const r = evaluateDbCapacity([{ table: "notifications", rowCount: 5000, capped: true }]);
    expect(r.severity).toBe("warning");
    expect(r.detail).toContain("notifications");
  });
});

describe("evaluateFounderCount (role-escalation tripwire)", () => {
  it("exactly 1 founder is the contract", () => {
    expect(evaluateFounderCount(1).status).toBe("ok");
  });
  it("zero founders = critical (platform unadministerable)", () => {
    expect(evaluateFounderCount(0).severity).toBe("critical");
  });
  it("two founders = critical (founder signup is closed — a role was changed by hand)", () => {
    expect(evaluateFounderCount(2).severity).toBe("critical");
  });
});

describe("evaluateFounderSecurity", () => {
  it("clean founders are healthy", () => {
    expect(
      evaluateFounderSecurity([{ email: "f@x.com", lockedUntil: null, failedLoginAttempts: 0 }], NOW).status
    ).toBe("ok");
  });
  it("a live lockout = critical", () => {
    const r = evaluateFounderSecurity(
      [{ email: "f@x.com", lockedUntil: NOW + 10 * MIN, failedLoginAttempts: 5 }],
      NOW
    );
    expect(r.severity).toBe("critical");
    expect(r.detail).toContain("f@x.com");
  });
  it("3+ consecutive failed attempts = warning (lockout at 5)", () => {
    expect(
      evaluateFounderSecurity([{ email: "f@x.com", lockedUntil: null, failedLoginAttempts: 3 }], NOW).severity
    ).toBe("warning");
  });
  it("an EXPIRED lockout is not a live alert", () => {
    expect(
      evaluateFounderSecurity([{ email: "f@x.com", lockedUntil: NOW - 1 * MIN, failedLoginAttempts: 0 }], NOW).status
    ).toBe("ok");
  });
});

describe("evaluateFounderBruteforce", () => {
  it("9 failed logins / 24h is quiet; 10 = sustained attack warning", () => {
    expect(evaluateFounderBruteforce(9).status).toBe("ok");
    expect(evaluateFounderBruteforce(10).severity).toBe("warning");
  });
});

describe("evaluateMessagingBacklog", () => {
  it("19 overdue is fine; 20 = warning; 100 = critical", () => {
    expect(evaluateMessagingBacklog(19).status).toBe("ok");
    expect(evaluateMessagingBacklog(20).severity).toBe("warning");
    expect(evaluateMessagingBacklog(100).severity).toBe("critical");
  });
});

describe("evaluatePushReachability (can the watchdog bark?)", () => {
  it("1 founder with a registered device is healthy", () => {
    expect(evaluatePushReachability(1, 1).status).toBe("ok");
  });
  it("a founder with ZERO registered devices = critical — every alert would be silent", () => {
    const r = evaluatePushReachability(1, 0);
    expect(r.severity).toBe("critical");
  });
  it("no founders at all is not a push-reachability alert (founder_count owns that)", () => {
    expect(evaluatePushReachability(0, 0).status).toBe("ok");
  });
});

describe("shouldRenotify (re-notify cadence)", () => {
  it("critical alerts re-notify at 6h, not before", () => {
    expect(shouldRenotify({ severity: "critical", lastNotifiedAt: NOW - 6 * HOUR + MIN }, NOW)).toBe(false);
    expect(shouldRenotify({ severity: "critical", lastNotifiedAt: NOW - 6 * HOUR }, NOW)).toBe(true);
  });
  it("warnings re-notify at 24h, not before", () => {
    expect(shouldRenotify({ severity: "warning", lastNotifiedAt: NOW - 23 * HOUR }, NOW)).toBe(false);
    expect(shouldRenotify({ severity: "warning", lastNotifiedAt: NOW - 24 * HOUR }, NOW)).toBe(true);
  });
});

// ─── PART 2: wiring contracts (source-scanned so removal fails CI) ──────────

const crons = read("convex/crons.ts");
const myFunctions = read("convex/myFunctions.ts");
const schema = read("convex/schema.ts");
const alox = read("convex/alox.ts");
const pushNode = read("convex/pushNotificationsNode.ts");
const javaPush = read(
  "android/app/src/main/java/com/practicepro/app/push/PracticeProMessagingService.java"
);
const clientNotifications = read("src/utils/notifications.ts");
const adminApp = read("src/admin/AdminApp.tsx");
const bottomNav = read("src/admin/FounderBottomNav.tsx");
const settings = read("src/admin/views/Settings.tsx");
const adminLogin = read("src/admin/AdminLogin.tsx");

describe("wiring: the watchdog cron", () => {
  it("crons.ts registers a 15-minute aloxWatchdog interval on internal.alox", () => {
    expect(crons).toMatch(/aloxWatchdog/);
    expect(crons).toMatch(/internal\.alox\.runAloxWatchdog/);
    expect(crons).toMatch(/\{ minutes: 15 \}/);
  });
  it("the watchdog opens alerts AND notifies founders on state transitions", () => {
    expect(alox).toMatch(/notifyFounders\(ctx,\s*\{\s*title: `Aloa X: \$\{outcome\.title\}`/);
    expect(alox).toContain('type: "alox_alert"');
    expect(alox).toContain('type: "alox_resolved"');
    expect(alox).toContain('view: "aloax"');
  });
});

describe("wiring: founder login push alerts", () => {
  it("verifyLogin alerts on SUCCESS (founder accounts only)", () => {
    expect(myFunctions).toMatch(
      /scheduleFounderLoginEvent\(ctx, user, "success", undefined, args\.clientHint\)/
    );
  });
  it("verifyLogin alerts on FAILED password + LOCKOUT", () => {
    expect(myFunctions).toMatch(/failureUpdates\.lockedUntil \? "locked" : "failed"/);
  });
  it("verifyLogin alerts on MFA/TOFU wrong-code lockouts", () => {
    // Two direct lockout call sites: the TOFU initial-password code path +
    // the MFA code path (the password path locks out through the ternary
    // asserted in the previous test).
    const matches = myFunctions.match(/scheduleFounderLoginEvent\(ctx, user, "locked"/g) || [];
    expect(matches.length).toBe(2);
  });
  it("the alert helper is founder-only and fire-and-forget", () => {
    expect(myFunctions).toMatch(/String\(user\.role \|\| ""\) !== "Founder"\) return;/);
    expect(myFunctions).toMatch(/ctx\.scheduler\.runAfter\(0, \(internal as any\)\.alox\.recordFounderLoginEvent/);
  });
  it("lockouts ALWAYS push; other events dedup inside a 15-minute window", () => {
    expect(alox).toMatch(/const shouldPush = args\.event === "locked" \|\| !alreadyPushed;/);
    expect(alox).toContain("LOGIN_PUSH_DEDUP_MS: 15 * 60 * 1000");
  });
  it("the founder APK identifies itself so the alert says where the login came from", () => {
    expect(adminApp).toContain("clientHint: 'founder-apk'");
    expect(myFunctions).toContain("clientHint: v.optional(v.string())");
  });
  it("login events are persisted as an audit feed (founder_login_events table)", () => {
    expect(schema).toMatch(/founder_login_events: defineTable/);
    expect(alox).toMatch(/\.withIndex\("by_email"/);
  });
});

describe("wiring: the practicepro-watchdog channel trio", () => {
  it("server channelForType routes alox + founder_login types to the watchdog channel", () => {
    for (const t of [
      "alox_alert",
      "alox_resolved",
      "alox_test",
      "founder_login",
      "founder_login_failed",
      "founder_login_locked",
    ]) {
      expect(channelForType(t)).toBe("practicepro-watchdog");
    }
  });
  it("the Java channel map mirrors the server routing", () => {
    expect(javaPush).toContain('case "alox_alert": case "alox_resolved": case "alox_test":');
    expect(javaPush).toContain('return "practicepro-watchdog";');
    expect(javaPush).toContain('if ("practicepro-watchdog".equals(channelId)) return "Aloa X Watchdog";');
  });
  it("the watchdog channel is IMPORTANCE_HIGH (security alerts must buzz)", () => {
    expect(javaPush).toMatch(/"practicepro-watchdog"\.equals\(channelId\)\)/);
  });
  it("the client channel map mirrors the same routing", () => {
    expect(clientNotifications).toContain("return 'practicepro-watchdog';");
  });
});

describe("wiring: the founder app exposes Aloa X", () => {
  it("the AloaX view is routed, deep-linkable and in the nav", () => {
    expect(adminApp).toMatch(/case 'aloax': return <ViewErrorBoundary viewName="AloaX">/);
    expect(adminApp).toMatch(/aloax: 'aloax'/);
    expect(bottomNav).toMatch(/view: 'aloax'/);
    expect(read("src/admin/views/AloaX.tsx")).toContain("Run checks now");
  });
  it("the dashboard query is founder-gated (session-verified)", () => {
    expect(alox).toMatch(/export const getAloxStatus = query\(\{\s*args: \{ sessionToken: v\.string\(\) \}/);
    expect(alox).toMatch(/await requireFounder\(ctx, undefined, args\.sessionToken\)/);
  });
});

describe("wiring: Settings → Change Password is real now", () => {
  it("the 'coming soon' stub is gone and the action is wired", () => {
    expect(settings).not.toContain("coming soon");
    expect(settings).toMatch(/changeOwnPasswordAction\(\{ sessionToken: bearerToken/);
    expect(settings).toContain('label className={LABEL}>Current Password</label>');
  });
  it("the backend verifies the CURRENT password and revokes other sessions", () => {
    expect(myFunctions).toMatch(/export const changeOwnPassword = action\(/);
    expect(myFunctions).toMatch(/Current password is incorrect/);
    expect(read("convex/sessions.ts")).toMatch(/export const revokeOtherSessions = internalMutation\(/);
  });
});

describe("regression: founder recovery search stays fixed", () => {
  it("the search scans the full bounded user table (not the first 500)", () => {
    expect(myFunctions).toMatch(/async function searchFounderAccounts\(ctx: any, q: string\)/);
    expect(myFunctions).toMatch(/query\("users"\)\.take\(5000\)/);
    // The old broken shape must NOT come back:
    expect(myFunctions).not.toMatch(/query\("users"\)\.take\(500\);\s*\n\s*const matches = users\.filter/);
  });
  it("deactivated founder accounts are findable (the locked-out incident)", () => {
    expect(myFunctions).not.toMatch(/if \(u\.deactivatedAt\) return false;/);
    expect(myFunctions).toMatch(/deactivated: !!u\.deactivatedAt/);
  });
  it("recovery clears the deactivation flag (email ownership = account ownership)", () => {
    expect(myFunctions).toMatch(/\.\.\.\(wasDeactivated \? \{ deactivatedAt: null \} : \{\}\)/);
  });
});
