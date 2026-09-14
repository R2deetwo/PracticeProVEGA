/**
 * AUTOMATED MESSAGE TRACKING (2026-09-14) — the accountability system.
 *
 * USER CONTEXT: an automated rent reminder went to a resident and the
 * founder, seeing the thread for the FIRST time, found it tagged
 * "Replied" (nothing human had replied), it never showed as a
 * queued/upcoming message before sending, and there was no push or
 * record telling the team what the automation had done. The directive:
 * "a robust system that keeps everyone accountable and everything well
 * tracked… they may actually get these as push notifications as well in
 * the APK."
 *
 * This suite locks in the three layers that answer it (the pure-function
 * tag behaviour itself lives in unifiedMessaging.test.ts):
 *
 *   1. PROVENANCE — createConversationFromScheduled stamps the thread
 *      message (isAutomation / scheduledMessageId / workflowKey / stepKey)
 *      and the conversation (lastMessageIsAutomation), and every HUMAN
 *      send path clears that flag.
 *   2. RESIDENT PUSH — automated sends dispatch the same FCM push a
 *      manual admin reply does (Messages channel, per-conversation tag,
 *      badge = unread count).
 *   3. ADMIN DIGEST — the dispatch processor aggregates per-firm
 *      sent/failed counts and fires ONE notifyAutomationDigest per firm
 *      (never per message), routed to the Messages channel and
 *      deep-linking to the Scheduled tab.
 *   4. UPCOMING PROJECTION — getUpcomingAutomation lets the team see
 *      planned sends for the next 14 days without enqueuing anything.
 *
 * Source-scan style (same as messagePushWiring / chatSenderIdentity):
 * these are cross-file wiring contracts, not unit-testable pure logic.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(import.meta.url);
const repoRoot = here.includes("/tests/unit/")
  ? resolve(dirname(here), "../..")
  : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), "utf8");

const portals = read("convex/portals.ts");
const engine = read("convex/automationEngine.ts");
const schema = read("convex/schema.ts");
const pushNode = read("convex/pushNotificationsNode.ts");
const clientNotifications = read("src/utils/notifications.ts");
const scheduledTab = read("src/components/messaging/ScheduledTab.tsx");

describe("1. Provenance — automated sends are stamped end-to-end", () => {
  it("schema: portal_conversations carries lastMessageIsAutomation", () => {
    expect(schema).toMatch(/lastMessageIsAutomation:\s*v\.optional\(v\.boolean\(\)\)/);
  });

  it("schema: portal_messages carries the automation audit fields", () => {
    expect(schema).toMatch(/isAutomation:\s*v\.optional\(v\.boolean\(\)\)/);
    expect(schema).toMatch(/scheduledMessageId:\s*v\.optional\(v\.id\("scheduled_messages"\)\)/);
    expect(schema).toMatch(/workflowKey:\s*v\.optional\(v\.string\(\)\),\s*\/\/ e\.g\. "rent_collection"/);
    expect(schema).toMatch(/stepKey:\s*v\.optional\(v\.string\(\)\),\s*\/\/ e\.g\. "pre_7", "late_14"/);
  });

  it("createConversationFromScheduled stamps the thread message with provenance", () => {
    const fn = portals.slice(
      portals.indexOf("export const createConversationFromScheduled"),
      portals.indexOf("Tenant Ledger for Portal"),
    );
    expect(fn).toContain("isAutomation: args.isAutomation === true ? true : undefined");
    expect(fn).toContain("scheduledMessageId: args.scheduledMessageId");
    expect(fn).toContain("workflowKey: args.workflowKey");
    expect(fn).toContain("stepKey: args.stepKey");
  });

  it("createConversationFromScheduled tags the conversation, never a false 'Replied'", () => {
    const fn = portals.slice(
      portals.indexOf("export const createConversationFromScheduled"),
      portals.indexOf("Tenant Ledger for Portal"),
    );
    expect(fn).toContain("lastMessageBy: \"admin\"");
    expect(fn).toContain("lastMessageIsAutomation: args.isAutomation === true ? true : false");
  });

  it("the dispatch processor passes provenance through to the conversation wiring", () => {
    const fn = portals.slice(
      portals.indexOf("export const processScheduledMessages"),
      portals.indexOf("export const getDueScheduledMessages"),
    );
    expect(fn).toContain("isAutomation: msg.isAutomation === true");
    expect(fn).toContain("scheduledMessageId: msg._id");
  });

  it("every HUMAN admin send path clears the automation flag", () => {
    // sendAdminReply, replyToPortalMessage, and the portal submit path
    // all set lastMessageBy 'admin' — each must reset the flag to false
    // so a human reply shows "Replied" again.
    const clears = portals.match(/lastMessageIsAutomation: false/g) || [];
    expect(clears.length).toBeGreaterThanOrEqual(3);
  });
});

describe("2. Resident push — automated messages push like manual replies", () => {
  it("createConversationFromScheduled dispatches an FCM push to the resident", () => {
    const fn = portals.slice(
      portals.indexOf("export const createConversationFromScheduled"),
      portals.indexOf("Tenant Ledger for Portal"),
    );
    expect(fn).toContain("internal.pushNotifications.dispatchPushToUsers");
    // Messages channel (MAX importance), per-conversation collapse tag,
    // badge = the resident's unread count, real preview body.
    expect(fn).toContain('channelId: "practicepro-messages"');
    expect(fn).toMatch(/tag:\s*`conversation:\$\{conversationId\}`/);
    expect(fn).toContain("notificationCount: nextUnread");
  });

  it("the push failure is contained — a push error never fails the send", () => {
    const fn = portals.slice(
      portals.indexOf("export const createConversationFromScheduled"),
      portals.indexOf("Tenant Ledger for Portal"),
    );
    expect(fn).toMatch(/catch\s*\(pushErr[^)]*\)/);
  });
});

describe("3. Admin digest — one accountability notification per firm per run", () => {
  it("notifyAutomationDigest exists as an internal mutation", () => {
    expect(portals).toMatch(
      /export const notifyAutomationDigest = internalMutation\(\{/,
    );
  });

  it("the digest reports BOTH outcomes (sent and failed) with distinct wording", () => {
    const fn = portals.slice(
      portals.indexOf("export const notifyAutomationDigest"),
      portals.indexOf("async function notifyFirmAdmins"),
    );
    expect(fn).toContain("args.failed > 0");
    expect(fn).toMatch(/failed.*check the Scheduled tab|check the Scheduled tab.*failed/s);
  });

  it("the digest deep-links to the Scheduled tab of Messages", () => {
    const fn = portals.slice(
      portals.indexOf("export const notifyAutomationDigest"),
      portals.indexOf("async function notifyFirmAdmins"),
    );
    expect(fn).toContain('link: { view: "messaging", context: { initialTab: "scheduled" } }');
  });

  it("the dispatcher aggregates per-firm counts BEFORE notifying (no per-message spam)", () => {
    const fn = portals.slice(
      portals.indexOf("export const processScheduledMessages"),
      portals.indexOf("export const getDueScheduledMessages"),
    );
    expect(fn).toContain("const automationDigest = new Map<string, { sent: number; failed: number }>()");
    expect(fn).toContain("if (msg.isAutomation === true)");
    expect(fn).toContain("internal.portals.notifyAutomationDigest");
  });

  it("an exception during a message send still counts toward the digest", () => {
    const fn = portals.slice(
      portals.indexOf("export const processScheduledMessages"),
      portals.indexOf("export const getDueScheduledMessages"),
    );
    // The per-message catch block must also bump the failed tally.
    const catchIdx = fn.indexOf("} catch (e: any) {");
    expect(catchIdx).toBeGreaterThan(-1);
    expect(fn.slice(catchIdx)).toContain("agg.failed += 1");
  });

  it("the digest routes to the Messages push channel (server + client lists in sync)", () => {
    expect(pushNode).toMatch(/type === "automation_digest"/);
    expect(clientNotifications).toMatch(/type === 'automation_digest'/);
  });

  it("the digest is a registered notification type (preferences UI-safe)", () => {
    expect(portals).toMatch(
      /automation_digest:\s*\{\s*label: "Automation Digest"/,
    );
  });
});

describe("4. Upcoming projection — planned sends are visible before they run", () => {
  it("getUpcomingAutomation is a staff-gated query with a bounded horizon", () => {
    const fn = engine.slice(
      engine.indexOf("export const getUpcomingAutomation"),
    );
    expect(fn).toContain("requireStaffCaller");
    expect(fn).toContain("Math.min(Math.max(args.days ?? 14, 1), 31)");
  });

  it("the projection does NOT enqueue — it only reads (no db.insert in the query)", () => {
    const fn = engine.slice(
      engine.indexOf("export const getUpcomingAutomation"),
    );
    expect(fn).not.toContain("ctx.db.insert");
    expect(fn).not.toContain("enqueueMessage");
  });

  it("the projection honours the same opt-out gates as the engine", () => {
    const fn = engine.slice(
      engine.indexOf("export const getUpcomingAutomation"),
    );
    expect(fn).toContain("unitOptOuts.has");
    expect(fn).toContain("isOptedOut");
  });

  it("the Scheduled tab renders the Upcoming section from the projection query", () => {
    expect(scheduledTab).toContain("api.automationEngine.getUpcomingAutomation");
    expect(scheduledTab).toMatch(/Upcoming \(next 14 days\)/);
    // Honesty contract: the UI labels rows as plans, not promises.
    expect(scheduledTab).toMatch(/plans, not promises/);
  });
});

describe("5. Thread provenance surfaces in the admin UI", () => {
  it("the thread renders an Automated badge with workflow + step from the raw row", () => {
    const view = read("src/components/MessagesView.tsx");
    expect(view).toContain("raw?.isAutomation");
    expect(view).toContain("AUTOMATION_WORKFLOW_LABELS");
  });

  it("the inbox has an 'Automated' filter chip (distinct from 'Replied')", () => {
    const view = read("src/components/MessagesView.tsx");
    expect(view).toMatch(/key: 'automated' as const, label: 'Automated'/);
    expect(view).toMatch(/convTag === 'automated' && !typeFilters\.automated/);
  });
});
