/**
 * P3 refund guarantee backend — behavior + adoption suite.
 *
 * Decision (a): minimal backend support for the "30-day money-back
 * guarantee on annual plans" promise. This suite locks in:
 *
 *   1. computeRefundEligibility — the pure eligibility rules (annual +
 *      within 30 days = guarantee as-of-right; outside/monthly =
 *      discretionary; no payment = unverified).
 *   2. isValidTransition — the status machine (pending → approved/denied/
 *      cancelled; approved → processed; terminal states immutable).
 *   3. Security contracts (source-scanned, same pattern as
 *      backendErrorLogging.test.ts): customer mutations go through
 *      requireFirmUser, founder mutations through requireFounder.
 *   4. Pipeline contracts: submission notifies founders; denying a
 *      guarantee-window request requires a note; processing requires the
 *      pasted Paystack refund reference; the paystack webhook links
 *      refund.processed into the refundRequests trail.
 *   5. Wording consistency: TermsOfService §12.3 carries the guarantee
 *      carve-out (the pre-P3 contradiction said "non-refundable" with no
 *      carve-out); UsagePolicy no longer dangles "our refund policy" and
 *      cross-references ToS §12.3; the firm-side panel and founder view
 *      are wired.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeRefundEligibility,
  isValidTransition,
  GUARANTEE_WINDOW_DAYS,
} from "../../convex/refunds";

const here = fileURLToPath(import.meta.url);
const repoRoot = here.includes("/tests/unit/")
  ? resolve(dirname(here), "../..")
  : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), "utf8");

const DAY = 24 * 60 * 60 * 1000;

describe("computeRefundEligibility", () => {
  const now = Date.now();

  it("annual plan paid within the window → guarantee (as-of-right)", () => {
    expect(computeRefundEligibility(new Date(now - 5 * DAY).toISOString(), "annual", now)).toBe("guarantee");
    expect(computeRefundEligibility(new Date(now - 1 * DAY).toISOString(), "annual", now)).toBe("guarantee");
  });

  it("annual plan paid exactly 30 days ago is still inside the window (inclusive)", () => {
    expect(GUARANTEE_WINDOW_DAYS).toBe(30);
    expect(computeRefundEligibility(new Date(now - 30 * DAY).toISOString(), "annual", now)).toBe("guarantee");
  });

  it("annual plan paid 31 days ago → discretionary", () => {
    expect(computeRefundEligibility(new Date(now - 31 * DAY).toISOString(), "annual", now)).toBe("discretionary");
  });

  it("monthly plan → discretionary even when fresh", () => {
    expect(computeRefundEligibility(new Date(now - 2 * DAY).toISOString(), "monthly", now)).toBe("discretionary");
  });

  it("unknown/missing interval treated as discretionary when a payment date exists", () => {
    expect(computeRefundEligibility(new Date(now - 2 * DAY).toISOString(), "", now)).toBe("discretionary");
    expect(computeRefundEligibility(new Date(now - 2 * DAY).toISOString(), null, now)).toBe("discretionary");
  });

  it("no payment date → unverified", () => {
    expect(computeRefundEligibility(null, "annual", now)).toBe("unverified");
    expect(computeRefundEligibility(undefined, undefined, now)).toBe("unverified");
  });

  it("unparseable payment date → unverified (never crashes)", () => {
    expect(computeRefundEligibility("not-a-date", "annual", now)).toBe("unverified");
  });

  it("future-dated payment (clock skew / bad data) is not treated as within-window", () => {
    expect(computeRefundEligibility(new Date(now + 5 * DAY).toISOString(), "annual", now)).toBe("discretionary");
  });
});

describe("isValidTransition — status machine", () => {
  it("pending can be approved, denied, or cancelled", () => {
    expect(isValidTransition("pending", "approved")).toBe(true);
    expect(isValidTransition("pending", "denied")).toBe(true);
    expect(isValidTransition("pending", "cancelled")).toBe(true);
  });

  it("approved can only be processed (the money-movement step)", () => {
    expect(isValidTransition("approved", "processed")).toBe(true);
    expect(isValidTransition("approved", "denied")).toBe(false);
    expect(isValidTransition("approved", "cancelled")).toBe(false);
  });

  it("terminal states are immutable (incl. webhook double-delivery)", () => {
    for (const terminal of ["denied", "processed", "cancelled"]) {
      expect(isValidTransition(terminal, "approved")).toBe(false);
      expect(isValidTransition(terminal, "processed")).toBe(false);
      expect(isValidTransition(terminal, "denied")).toBe(false);
      expect(isValidTransition(terminal, "cancelled")).toBe(false);
    }
  });

  it("no self-transitions or unknown statuses", () => {
    expect(isValidTransition("pending", "pending")).toBe(false);
    expect(isValidTransition("processed", "processed")).toBe(false);
    expect(isValidTransition("mystery", "approved")).toBe(false);
  });
});

describe("security contracts (source-scanned)", () => {
  const refundsSrc = read("convex/refunds.ts");

  it("customer mutations authenticate via requireFirmUser (bearer session)", () => {
    for (const fn of ["submitRefundRequest", "cancelMyRefundRequest", "getMyRefundRequests"]) {
      const start = refundsSrc.indexOf(`export const ${fn}`);
      expect(start, `${fn} not found`).toBeGreaterThan(-1);
      const body = refundsSrc.slice(start, refundsSrc.indexOf("\nexport const", start + 1) > -1
        ? refundsSrc.indexOf("\nexport const", start + 1)
        : undefined);
      expect(body, `${fn} must call requireFirmUser`).toContain("requireFirmUser(ctx");
    }
  });

  it("founder functions authenticate via requireFounder (session-verified, role check)", () => {
    for (const fn of [
      "getRefundRequests",
      "getRefundRequestStats",
      "createRefundRequestOnBehalf",
      "decideRefundRequest",
      "markRefundProcessed",
    ]) {
      const start = refundsSrc.indexOf(`export const ${fn}`);
      expect(start, `${fn} not found`).toBeGreaterThan(-1);
      const body = refundsSrc.slice(start, refundsSrc.indexOf("\nexport const", start + 1) > -1
        ? refundsSrc.indexOf("\nexport const", start + 1)
        : undefined);
      expect(body, `${fn} must call requireFounder`).toContain("requireFounder(ctx");
    }
  });

  it("cancelMyRefundRequest enforces same-firm ownership", () => {
    expect(refundsSrc).toContain("belongs to a different firm");
  });

  it("submit blocks a second open request per firm", () => {
    expect(refundsSrc).toContain("already has an open refund request");
  });

  it("submission notifies the founders (in-app + push)", () => {
    expect(refundsSrc).toContain("notifyFounders(ctx");
    expect(refundsSrc).toContain('"New Refund Request"');
  });

  it("denying a guarantee-window request requires an explanatory note", () => {
    expect(refundsSrc).toContain("Denying it requires a note");
  });

  it("markRefundProcessed requires the pasted Paystack refund reference", () => {
    expect(refundsSrc).toContain("Paste the Paystack refund reference");
  });

  it("money movement is manual — the app never calls the Paystack refund API", () => {
    expect(refundsSrc).not.toMatch(/api\.paystack\.co\/refund/);
    const paystackSrc = read("convex/paystack.ts");
    expect(paystackSrc).not.toMatch(/api\.paystack\.co\/refund/);
  });
});

describe("schema contract", () => {
  const schemaSrc = read("convex/schema.ts");

  it("refundRequests table exists with the status trail and audit fields", () => {
    const start = schemaSrc.indexOf("refundRequests: defineTable");
    expect(start).toBeGreaterThan(-1);
    const end = schemaSrc.indexOf(".index(\"by_reference\"", start);
    const block = schemaSrc.slice(start, end + 200);
    for (const field of [
      "firmId",
      "subscriptionRequestId",
      "transactionReference",
      "requestedByUserId",
      "submittedBy",
      "amount",
      "reason",
      "eligibility",
      "status",
      "statusTrail",
      "decidedBy",
      "processedBy",
      "paystackRefundReference",
    ]) {
      expect(block, `field ${field} missing`).toContain(field);
    }
  });

  it("indexes cover firm, status, subscription request, and payment reference", () => {
    const start = schemaSrc.indexOf("refundRequests: defineTable");
    const block = schemaSrc.slice(start, start + 3000);
    expect(block).toContain('.index("by_firm", ["firmId"])');
    expect(block).toContain('.index("by_status", ["status"])');
    expect(block).toContain('.index("by_subscription_request", ["subscriptionRequestId"])');
    expect(block).toContain('.index("by_reference", ["transactionReference"])');
  });
});

describe("webhook integration (source-scanned)", () => {
  const paystackSrc = read("convex/paystack.ts");

  it("refund.processed links into refundRequests", () => {
    expect(paystackSrc).toContain('query("refundRequests")');
    expect(paystackSrc).toContain("paystack:webhook:refundRequestLinkage");
  });

  it("an approved request is auto-completed by the webhook (money-moved signal)", () => {
    expect(paystackSrc).toMatch(/status: 'processed',\s*\n\s*processedBy: 'paystack_webhook'/);
  });

  it("a still-pending request keeps its status but gains a trail entry", () => {
    expect(paystackSrc).toMatch(/else if \(rr\.status === 'pending'\)/);
  });

  it("webhook linkage failure never breaks the webhook (logError, warning)", () => {
    expect(paystackSrc).toContain("paystack:webhook:refundRequestLinkage");
    expect(paystackSrc).toContain('severity: "warning"');
  });
});

describe("wording consistency (the four promise surfaces)", () => {
  const tos = read("src/components/TermsOfService.tsx");
  const usage = read("src/components/UsagePolicy.tsx");
  const landing = read("src/components/LandingPage.tsx");
  const settings = read("src/components/settings/SubscriptionSettings.tsx");

  it("TermsOfService §12.3 carries the 30-day guarantee carve-out (contradiction fixed)", () => {
    expect(tos).toContain("12.3 Refunds");
    expect(tos).toContain("30-day money-back guarantee");
    expect(tos).toContain("Federal Competition and Consumer Protection Act 2018");
    // The old flat contradiction is gone:
    expect(tos).not.toContain("<h3 className=\"text-xl font-bold\">12.3 Non-refundable</h3>");
  });

  it("UsagePolicy §7.1 no longer dangles a non-existent refund policy", () => {
    expect(usage).not.toContain("as expressly provided in our refund policy");
    expect(usage).toContain("Terms of Service, Section 12.3");
    expect(usage).toContain("30-day money-back guarantee");
  });

  it("UsagePolicy §10.1 cross-references the guarantee", () => {
    expect(usage).toContain("30-day money-back guarantee for annual plans (Section 7.1)");
  });

  it("LandingPage guarantee badge unchanged (the promise surface this round protects)", () => {
    expect(landing).toContain("30-day money-back guarantee on annual plans");
  });

  it("firm-side panel wires the customer submission mutation", () => {
    expect(settings).toContain("api.refunds.submitRefundRequest");
    expect(settings).toContain("api.refunds.getMyRefundRequests");
    expect(settings).toContain("api.refunds.cancelMyRefundRequest");
    expect(settings).toContain("Request a Refund");
  });
});

describe("founder app wiring (source-scanned)", () => {
  it("the founder app registers the Refunds view + deep-link mapping", () => {
    const adminApp = read("src/admin/AdminApp.tsx");
    expect(adminApp).toContain("RefundRequestsCenter");
    expect(adminApp).toMatch(/refunds: 'refunds'/);
    expect(adminApp).toMatch(/case 'refunds'/);
  });

  it("the More menu exposes Refunds with a pending badge", () => {
    const nav = read("src/admin/FounderBottomNav.tsx");
    expect(nav).toContain("view: 'refunds'");
    expect(nav).toContain("api.refunds.getRefundRequestStats");
    expect(nav).toContain("refundPendingCount");
  });

  it("the approval view drives every founder mutation", () => {
    const view = read("src/admin/views/RefundRequestsCenter.tsx");
    expect(view).toContain("api.refunds.getRefundRequests");
    expect(view).toContain("api.refunds.getRefundRequestStats");
    expect(view).toContain("api.refunds.decideRefundRequest");
    expect(view).toContain("api.refunds.markRefundProcessed");
    expect(view).toContain("api.refunds.createRefundRequestOnBehalf");
  });
});
