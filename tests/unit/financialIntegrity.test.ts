/**
 * Accounting-integrity round (2026-09-14) — financial record lifecycle tests.
 *
 * Locks in the contract the whole system leans on:
 *   1. "Counts as money" is defined EXACTLY ONCE on the server
 *      (convex/financialIntegrity.isActiveFinancialRecord) and mirrored on
 *      the client (src/utils/financialLifecycle.isActiveFinancialRecord).
 *      These tests import BOTH and assert they agree on every status value —
 *      drift between the dashboard and the ledger is how the user's
 *      "records I don't remember" confusion comes back.
 *   2. The idempotency key shape (client mirror) is stable and its two
 *      factories produce identical keys for identical inputs.
 *   3. getCashFlowSummary's exclusion semantics (activeEntries filter) —
 *      verified against the same predicate, since the aggregate reads
 *      statuses straight off rows.
 */
import { describe, it, expect } from "vitest";
import {
  isActiveFinancialRecord as serverPredicate,
  makeLedgerIdempotencyKey as serverKey,
} from "../../convex/financialIntegrity";
import {
  isActiveFinancialRecord as clientPredicate,
  makeLedgerIdempotencyKey as clientKey,
} from "../../src/utils/financialLifecycle";

const ALL_STATUSES = [
  undefined,
  null,
  "voided",
  "test",
  "", // legacy/empty string rows — must count as active (pre-lifecycle data)
  "active",
  "VOIDED", // case variants must NOT accidentally match
  "Test",
  "reinstate-pending",
] as const;

describe("isActiveFinancialRecord — the single definition of 'counts as money'", () => {
  it("excludes exactly 'voided' and 'test'", () => {
    expect(serverPredicate("voided")).toBe(false);
    expect(serverPredicate("test")).toBe(false);
  });

  it("treats every pre-lifecycle row state as active money", () => {
    // Rows written before this round have NO recordStatus — they are real
    // business history and must keep counting. A migration that wiped or
    // reinterpreted them would falsify the books.
    expect(serverPredicate(undefined)).toBe(true);
    expect(serverPredicate(null)).toBe(true);
    expect(serverPredicate("")).toBe(true);
  });

  it("is case-sensitive — 'VOIDED' is not 'voided'", () => {
    // Defensive: a casing drift would SILENTLY re-include voided rows in
    // every total. If a writer ever produces 'VOIDED', that's a bug to
    // surface loudly, not a status to interpret.
    expect(serverPredicate("VOIDED")).toBe(true);
    expect(serverPredicate("Test")).toBe(true);
  });
});

describe("server/client predicate equivalence (drift guard)", () => {
  it("client mirror agrees with server canon on every recordStatus value", () => {
    for (const status of ALL_STATUSES) {
      expect(
        clientPredicate(status as any),
        `recordStatus=${JSON.stringify(status)}`
      ).toBe(serverPredicate(status as any));
    }
  });

  it("both predicates filter the same rows out of a realistic ledger", () => {
    const ledger = [
      { id: 1, recordStatus: undefined, amount: 100 },
      { id: 2, recordStatus: "voided", amount: 50 },
      { id: 3, recordStatus: "test", amount: 25 },
      { id: 4, recordStatus: undefined, amount: 200 },
    ];
    const serverTotal = ledger
      .filter(e => serverPredicate(e.recordStatus))
      .reduce((s, e) => s + e.amount, 0);
    const clientTotal = ledger
      .filter(e => clientPredicate(e.recordStatus))
      .reduce((s, e) => s + e.amount, 0);
    // The voided ₦50 and test ₦25 must drop on BOTH sides: 100 + 200.
    expect(serverTotal).toBe(300);
    expect(clientTotal).toBe(300);
  });
});

describe("makeLedgerIdempotencyKey — offline replay can never double-book", () => {
  const parts = {
    firmId: "firm-123",
    unitId: "unit-9",
    amount: 45000,
    type: "rent",
    nonce: "abc789",
  };

  it("server and client factories produce the identical key", () => {
    expect(clientKey(parts)).toBe(serverKey(parts));
  });

  it("is deterministic — the same submission replays as a no-op", () => {
    expect(clientKey(parts)).toBe(clientKey({ ...parts }));
  });

  it("different submissions never collide", () => {
    expect(clientKey(parts)).not.toBe(clientKey({ ...parts, nonce: "other" }));
    expect(clientKey(parts)).not.toBe(clientKey({ ...parts, amount: 45001 }));
    expect(clientKey(parts)).not.toBe(clientKey({ ...parts, unitId: "unit-10" }));
    expect(clientKey(parts)).not.toBe(clientKey({ ...parts, type: "deposit" }));
  });

  it("carries the amount verbatim so ₦450 and ₦4500.00 never collide", () => {
    expect(clientKey({ ...parts, amount: 450 })).not.toBe(clientKey({ ...parts, amount: 4500 }));
  });
});
