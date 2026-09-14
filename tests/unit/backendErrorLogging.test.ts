/**
 * P6 backend error visibility — adoption + behavior suite.
 *
 * The observability module (error_events table + capture paths + Sentry
 * relay) existed since Round 17; P6 (2026-09-14) added the ergonomic
 * logError() helper and migrated the error paths in the payment, messaging,
 * and automation files to it. This suite locks in:
 *
 *   1. logError writes the full row shape to error_events from a mutation
 *      context (scope, name, message, stack, severity, context JSON with
 *      firmId/userId, timestamp).
 *   2. From an action context it relays through the internal capture
 *      mutation instead of touching ctx.db.
 *   3. It NEVER throws (a reporting problem must never break the caller)
 *      and still emits a console.error line for dashboard readability.
 *   4. The nine priority files (payment/messaging/automation) actually
 *      import and call logError — the adoption contract (source-scanned,
 *      same pattern as chatSenderIdentity.test.ts).
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { logError } from "../../convex/observability";

const here = fileURLToPath(import.meta.url);
const repoRoot = here.includes("/tests/unit/")
  ? resolve(dirname(here), "../..")
  : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), "utf8");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logError — mutation context (direct table write)", () => {
  it("writes the full row shape with firmId/userId folded into context JSON", async () => {
    const inserted: any[] = [];
    const ctx = {
      db: { insert: async (_table: string, row: any) => { inserted.push(row); } },
    };
    const err = new Error("paystack webhook signature mismatch");

    await logError(ctx, {
      scope: "payment",
      name: "paystack:webhook:signature",
      error: err,
      severity: "warning",
      firmId: "firm-123",
      userId: "user-456",
      context: { reference: "PS-REF-789" },
    });

    expect(inserted).toHaveLength(1);
    const row = inserted[0];
    expect(row.scope).toBe("payment");
    expect(row.name).toBe("paystack:webhook:signature");
    expect(row.message).toBe("paystack webhook signature mismatch");
    expect(row.stack).toBeTypeOf("string");
    expect(row.severity).toBe("warning");
    expect(row.timestamp).toBeTypeOf("number");
    const context = JSON.parse(row.context);
    expect(context.firmId).toBe("firm-123");
    expect(context.userId).toBe("user-456");
    expect(context.reference).toBe("PS-REF-789");
  });

  it("defaults severity to error and omits absent firm/user ids", async () => {
    const inserted: any[] = [];
    const ctx = { db: { insert: async (_t: string, row: any) => { inserted.push(row); } } };

    await logError(ctx, { scope: "automation", name: "proactive:briefing", error: "plain string failure" });

    const row = inserted[0];
    expect(row.severity).toBe("error");
    expect(row.message).toBe("plain string failure");
    expect(row.stack).toBeUndefined();
    const context = JSON.parse(row.context);
    expect(context.firmId).toBeUndefined();
    expect(context.userId).toBeUndefined();
  });
});

describe("logError — action context (relay through capture mutation)", () => {
  it("relays via ctx.runMutation with the same payload", async () => {
    const calls: any[] = [];
    const ctx = { runMutation: async (fn: any, args: any) => { calls.push({ fn, args }); } };

    await logError(ctx, {
      scope: "messaging",
      name: "communications:brevo:apiError",
      error: new Error("Brevo 401"),
      context: { status: 401 },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBeTruthy(); // internal.observability.captureErrorEvent reference
    expect(calls[0].args.scope).toBe("messaging");
    expect(calls[0].args.message).toBe("Brevo 401");
    expect(JSON.parse(calls[0].args.context).status).toBe(401);
  });
});

describe("logError — robustness", () => {
  it("never throws, even with a broken context object", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const circular: any = { self: null };
    circular.self = circular;
    await expect(
      logError({ db: { insert: async () => { throw new Error("table down"); } } }, {
        scope: "x", name: "y", error: new Error("z"), context: { circular },
      })
    ).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("still emits one console.error line for dashboard logs", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await logError({ db: { insert: async () => {} } }, {
      scope: "payment", name: "payments:completePaystackPayment:noInvoice",
      error: new Error("No invoice found"),
    });
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(String(consoleSpy.mock.calls[0][0])).toContain("payments:completePaystackPayment");
  });
});

describe("adoption contract — the nine priority files call logError", () => {
  const FILES = [
    "convex/payments.ts",
    "convex/paystack.ts",
    "convex/retainerBilling.ts",
    "convex/automationEngine.ts",
    "convex/proactive.ts",
    "convex/feedback.ts",
    "convex/communications.ts",
    "convex/myFunctions.ts",
    "convex/portals.ts",
  ];

  it.each(FILES)("%s imports logError from ./observability and calls it", (f) => {
    const src = read(f);
    expect(src).toContain('import { logError } from "./observability"');
    const calls = src.match(/logError\(/g)?.length ?? 0;
    expect(calls).toBeGreaterThanOrEqual(1);
  });

  it("payment/messaging/automation scopes are actually used (not just imported)", () => {
    const scopes = FILES.flatMap((f) =>
      [...read(f).matchAll(/scope: "(payment|messaging|automation)"/g)].map((m) => m[1])
    );
    expect(scopes.filter((s) => s === "payment").length).toBeGreaterThanOrEqual(5);
    expect(scopes.filter((s) => s === "messaging").length).toBeGreaterThanOrEqual(15);
    expect(scopes.filter((s) => s === "automation").length).toBeGreaterThanOrEqual(6);
  });
});
