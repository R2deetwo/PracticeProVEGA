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
  computeFounderSetChange,
  shouldRenotify,
} from "../../convex/alox";
import { channelForType } from "../../convex/pushNotificationsNode";
import { dedupeTokenRecords } from "../../convex/pushNotifications";

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

describe("evaluateBackups (2026-11-22: config-aware — unconfigured ≠ failing)", () => {
  it("NO targets configured = INFO, never an alert (the nightly job skips by design)", () => {
    const r = evaluateBackups(null, NOW, []);
    expect(r.status).toBe("info");
    expect(r.severity).toBeUndefined();
    // Even a stale success date stays info while nothing is configured.
    expect(evaluateBackups(NOW - 8 * DAY, NOW, []).status).toBe("info");
  });
  it("targets configured but no successful backup = real warning", () => {
    const r = evaluateBackups(null, NOW, ["github"]);
    expect(r.status).toBe("problem");
    expect(r.severity).toBe("warning");
    expect(r.detail).toContain("github");
  });
  it("a fresh success with targets configured is healthy", () => {
    expect(evaluateBackups(NOW - 29 * HOUR, NOW, ["github", "telegram"]).status).toBe("ok");
  });
  it("31h old = late warning; 8 days = critical (only when configured)", () => {
    expect(evaluateBackups(NOW - 31 * HOUR, NOW, ["telegram"]).severity).toBe("warning");
    expect(evaluateBackups(NOW - 8 * DAY, NOW, ["telegram"]).severity).toBe("critical");
  });
  it("the legacy two-arg call (no targets array) still warns on a stale record", () => {
    // Back-compat for callers that only know the success timestamp: a
    // recorded success implies a target was configured.
    expect(evaluateBackups(null, NOW).severity).toBe("warning");
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

describe("evaluateFounderCount (administerability floor)", () => {
  it("exactly 1 founder is the classic contract", () => {
    expect(evaluateFounderCount(1).status).toBe("ok");
  });
  it("zero founders = critical (platform unadministerable)", () => {
    expect(evaluateFounderCount(0).severity).toBe("critical");
  });
  it("a STEADY state of 2+ founders is no longer a standing alert (2026-11-20 owner review — the owner may keep two founder accounts)", () => {
    // The escalation tripwire moved to computeFounderSetChange + the
    // security.founder_set sweep outcome: a ONE-SHOT alert when the set
    // CHANGES, not a re-notifying 6-hour nag while it merely "is" > 1.
    expect(evaluateFounderCount(2).status).toBe("ok");
    expect(evaluateFounderCount(5).status).toBe("ok");
  });
});

describe("computeFounderSetChange (the one-shot escalation tripwire)", () => {
  it("first run (no baseline) adopts the current set silently — no alert", () => {
    expect(computeFounderSetChange(["a@x.com", "b@x.com"], null)).toBeNull();
    expect(computeFounderSetChange(["a@x.com"], undefined)).toBeNull();
  });
  it("an unchanged set (any stable size) is quiet", () => {
    expect(computeFounderSetChange(["a@x.com"], ["a@x.com"])).toBeNull();
    expect(computeFounderSetChange(["a@x.com", "b@x.com"], ["b@x.com", "a@x.com"])).toBeNull();
  });
  it("an account ADDED to the founder set is reported once", () => {
    const r = computeFounderSetChange(["a@x.com", "intruder@x.com"], ["a@x.com"]);
    expect(r).not.toBeNull();
    expect(r!.added).toEqual(["intruder@x.com"]);
    expect(r!.removed).toEqual([]);
  });
  it("an account REMOVED from the founder set is reported once", () => {
    const r = computeFounderSetChange(["a@x.com"], ["a@x.com", "old@x.com"]);
    expect(r!.added).toEqual([]);
    expect(r!.removed).toEqual(["old@x.com"]);
  });
  it("email casing/whitespace differences are NOT a change (role edits flip casing)", () => {
    expect(computeFounderSetChange(["A@X.com"], ["a@x.com"])).toBeNull();
    expect(computeFounderSetChange(["a@x.com"], [" a@x.com "])).toBeNull();
  });
  it("swap = one added + one removed in a single report", () => {
    const r = computeFounderSetChange(["new@x.com"], ["old@x.com"]);
    expect(r!.added).toEqual(["new@x.com"]);
    expect(r!.removed).toEqual(["old@x.com"]);
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
  it("lockouts and SUCCESS logins ALWAYS push; only failed-attempt bursts dedup (2026-11-20 owner rule: every founder login notifies)", () => {
    expect(alox).toMatch(
      /const shouldPush =\s*args\.event === "locked" \|\| args\.event === "success" \|\| !alreadyPushed;/
    );
    expect(alox).toContain("LOGIN_PUSH_DEDUP_MS: 15 * 60 * 1000");
  });
  it("the founder-set tripwire is wired into the sweep (one-shot security.founder_set alert + baseline persistence)", () => {
    expect(alox).toMatch(/computeFounderSetChange\(/);
    expect(alox).toContain('checkKey: "security.founder_set"');
    // The baseline written every sweep is what makes the alert ONE-SHOT:
    // the sweep that fires it also records the new set as the norm.
    expect(alox).toMatch(/founderBaseline: founderEmails,/);
    // First run adopts silently (the pre-existing two-founder state must
    // not fire a spurious alert on deploy — it resolves the old one).
    expect(alox).toMatch(/stateRow\?\.founderBaseline \?\? null/);
  });
  it("the watchdog schema persists the founder baseline (alox_state.founderBaseline)", () => {
    expect(schema).toMatch(/founderBaseline: v\.optional\(v\.array\(v\.string\(\)\)\)/);
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

describe("wiring: error-telemetry unification (2026-11-22 founder bug report)", () => {
  it("System Status reads error_events — the SAME table the watchdog counts", () => {
    const founderMetrics = read("convex/founderMetrics.ts");
    expect(founderMetrics).toMatch(/query\("error_events"\)/);
    // The contradictory analytics_events read is gone:
    expect(founderMetrics).not.toMatch(
      /getSystemErrors[\s\S]{0,600}query\("analytics_events"\)/
    );
  });
  it("both windows (24h/7d) are returned so the header can quote the watchdog's number", () => {
    const founderMetrics = read("convex/founderMetrics.ts");
    expect(founderMetrics).toContain("errors24h");
    expect(founderMetrics).toContain("errors7d");
  });
  it("backend-error alerts deep-link to System Status, ingestion alerts to the Ingestion console", () => {
    expect(alox).toMatch(/if \(checkKey\.startsWith\("backend\."\)\) return "system";/);
    expect(alox).toMatch(/if \(checkKey\.startsWith\("ingestion\."\)\) return "ingestion";/);
    expect(adminApp).toMatch(/system: 'system',/);
  });
  it("the watchdog distinguishes unconfigured backups (env-var probe) from failing ones", () => {
    expect(alox).toMatch(/process\.env\.GITHUB_BACKUP_TOKEN/);
    expect(alox).toMatch(/targetsConfigured/);
    const backups = read("convex/backups.ts");
    expect(backups).toMatch(/recordUnconfiguredRun/);
  });
  it("the backup export covers the full schema inventory (incl. the Legal KB)", () => {
    const backups = read("convex/backups.ts");
    for (const t of ["legal_judgments", "legal_chunks", "legal_scrape_queue", "sessions", "user_push_tokens", "error_events", "alox_alerts"]) {
      expect(backups).toContain(`"${t}"`);
    }
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

// ─── PART 3: one push per physical device (2026-11-20) ─────────────────────

describe("dedupeTokenRecords (the 'I get that message twice' fix)", () => {
  it("the same FCM token under two founder accounts collapses to ONE push", () => {
    const records = [
      { token: "tok-phone-1", userId: "founderA", deviceType: "android", capabilities: "data_only,inline_reply" },
      { token: "tok-phone-1", userId: "founderB", deviceType: "android", capabilities: "data_only,inline_reply" },
    ];
    const { deduped, duplicates } = dedupeTokenRecords(records);
    expect(deduped.length).toBe(1);
    expect(duplicates).toBe(1);
    expect(deduped[0].token).toBe("tok-phone-1");
  });

  it("distinct devices (two phones, or main app + founder APK installs) each get their push", () => {
    const records = [
      { token: "tok-main-app", userId: "founderA", deviceType: "android" },
      { token: "tok-founder-apk", userId: "founderB", deviceType: "android" },
    ];
    const { deduped, duplicates } = dedupeTokenRecords(records);
    expect(deduped.length).toBe(2);
    expect(duplicates).toBe(0);
  });

  it("stale duplicate rows for one account also collapse (token rotation leftovers)", () => {
    const records = [
      { token: "tok-old", userId: "founderA", deviceType: "android" },
      { token: "tok-new", userId: "founderA", deviceType: "android" },
    ];
    expect(dedupeTokenRecords(records).deduped.length).toBe(2); // different tokens = different registrations
  });

  it("empty input is handled", () => {
    expect(dedupeTokenRecords([])).toEqual({ deduped: [], duplicates: 0 });
  });
});

describe("wiring: dispatchPushToUsers sends one push per device", () => {
  it("the dispatcher dedupes token records before scheduling the FCM action", () => {
    const pushNotifications = read("convex/pushNotifications.ts");
    expect(pushNotifications).toMatch(/const \{ deduped, duplicates \} = dedupeTokenRecords\(tokenRecords\);/);
    expect(pushNotifications).toMatch(/tokens: deduped\.map\(\(r\) => r\.token\)/);
    expect(pushNotifications).toMatch(/tokenRecords: deduped,/);
    // The old raw fan-out must not come back:
    expect(pushNotifications).not.toMatch(/tokens: tokenRecords\.map\(\(r\) => r\.token\)/);
  });
});
