# ATRIUM OS — ROUND F: FINANCIAL OPERATIONS & RECONCILIATION (2026-11-11)

**Companion to:** ATRIUM_ROUND_B_MONEY_TRUTH_REMEDIATION.md (Round B, `5b9a78ed`,
R76) and the Round E waves (R82–R85). **Round B/E commits are untouched**; each
wave here is a separate commit on top.

**Mandate (owner):** the financial operations & reconciliation specification —
seven sections: §1 financial overview, §2 the rent ledger's per-resident bill
view, §3 payment processing, §4 the reconciliation workflow, §5 the report
suite, §6 safeguards, §7 acceptance. Round B had already covered most of §3
and the guarantee layer of §6; this round closed the remaining gaps.

---

## 1. Wave map (what shipped, per gap)

| Wave | Owner section | Gap closed | Commit |
|---|---|---|---|
| F1 (R86) | §1 + §2 | the unified overview console read + the per-resident rent bill statement | `feat(roundF): WAVE F1` |
| F2 (R87) | §4 | the interactive reconciliation workflow — unallocated queue, audited match, faithful reversal, status tracking, checker queue extension | `feat(roundF): WAVE F2` |
| F3 (R88) | §5 | the report suite (six reports) + CSV export + the four remaining §7 acceptance pins + the totals-vs-transactions proof | `feat(roundF): WAVE F3` |
| F4 (R89) | §3 + §6 | the payment-rails audit below + constant-time webhook signature verification + the kobo-native arithmetic helpers (server + client mirror) | `feat(roundF): WAVE F4` |

---

## 2. §3 payment processing audit (verified, per rail)

Every collection rail was traced end-to-end and verified against the §3
requirements. Findings — **all green except the two items marked FIXED in F4**:

1. **Paystack webhook (`convex/paystack.ts` `handlePaystackWebhookImpl`)**
   - HMAC-SHA512 signature verification with Web Crypto; 503 when the secret
     is unconfigured, 400 on a missing signature, 401 on a bad one. ✓
   - **FIXED (F4):** the signature comparison was a straight string `!==` —
     now `timingSafeEqualHex` (constant-time char-wise XOR accumulation,
     length check up front).
   - R12 event audit trail: EVERY signature-verified event recorded (full raw
     payload) and deduped by `eventId`; redeliveries short-circuit as
     `duplicate`. ✓
   - Amounts are always taken from the **event** (`tx.amount / 100`, kobo→NGN
     at the boundary) — never a tenant-claimed figure; the Round B M7 fix
     routes settlement through the shared `settleProofInternal` core with the
     verified amount, correcting the proof's claim when they differ. ✓
   - Only `charge.success` activates payments; `charge.failed` and
     `refund.processed` are recorded + notify (never auto-revert a live plan). ✓
   - The ADDON- reference self-heal path settles add-on purchases the client
     callback dropped, idempotently. ✓
2. **Bank-transfer proofs (`convex/portals.ts`)** — staff approval and webhook
   verification settle through the SAME atomic core; an amount-less proof
   cannot be approved without a confirmed amount (loud error, never a silent
   ₦0 booking). **FIXED (F2):** the settlement-time charge linkage is now
   PERSISTED on the proof row (`payment_proofs.linkedChargeId`) so the
   reconciliation queue can tell "tied to an obligation" from "money with no
   obligation attached".
3. **Rent collection (`convex/sentry.ts` `collectRentPayment`)** — one
   transaction: server-side sequential receipt numbers from the per-firm
   counter, rent + optional management-fee ledger rows, idempotency-keyed;
   a replay returns the original receipt and writes nothing. ✓ (Round B M6/M8.)
4. **Wallet auto-deduct (`convex/wallets.ts` `processAutoDeductions`)** — the
   deduction, wallet transaction and ledger row commit atomically with a
   shared idempotency key; credit is applied before deduction. ✓ (Round B H2.)
5. **Direct ledger writes (`addLedgerEntry`)** — amount validated positive,
   type registry-checked, idempotency-keyed; the void/reinstate/test
   lifecycle is the only exit and is always reason-gated + audited. ✓

## 3. §6 safeguard inventory (state after Round F)

- **Integer-kobo convention (NEW, F4):** all Round F money code computes in
  kobo internally (`kb()`/`addKobo`/`subKobo`/`compareKobo`) and converts back
  to naira @2dp once at the end. Server (`convex/moneyUtils.ts`) and client
  (`src/utils/money.ts`) mirrors are kept in lockstep. **Storage stays naira
  @2dp** — the kobo storage migration is a deliberately deferred separate wave
  (re-stating history is a data decision, not a code decision).
- **Immovable ledger:** booked rows are never deleted or silently edited —
  corrections are annotations (void-with-reason / test-quarantine), every one
  audited in `financial_audit_log` with the full before-state.
- **Reversibility:** `reinstateLedgerEntry`/`reinstateInvoice` restore
  faithfully from the audit snapshot; `reverseMatch` (F2) restores the charge
  from the match's stored before-snapshot. The money itself is never rewritten
  by a reversal.
- **Checker:** the daily reconciliation run proves the money-integrity
  contract (wallet debits ↔ ledger, approved proofs ↔ ledger, well-formed
  amounts, exactly-once keys, unique receipts) and — since F2 — reports the
  unallocated work queues as INFORMATIONAL (`ok` semantics unchanged).
- **Auth on every new public function:** `requireStaffCaller` (strict bearer
  session, portal roles blocked) + same-firm check; the F-wave tests pin the
  auth quartet on every read and write.
- **Paystack remains OFF until the owner's go-live decision** (`isPaystackActive`
  → false in production); the M7 prerequisite fix has landed.

## 4. §7 acceptance status

All ten pins are now green: full payment, partial payment, overpayment
(Round B) + failed payment, unmatched payment end-to-end, payment reversal,
period report (Round F Wave 3) + duplicate webhook redelivery, server-side
receipts, outstanding balances (Round B).

## 5. Deliberately out of scope (owner decision)

- **Kobo storage migration** — deferred as its own future wave; this round's
  convention (kobo-internal computation, naira @2dp storage) makes it a
  mechanical follow-up when wanted.
- **Historical backfill of pre-Round-B wallet debits/approved proofs** —
  still available on request; they remain in the checker's `legacy*` buckets.

## 6. Quality gates (per wave, all four waves)

| Gate | Result |
|---|---|
| vitest (full suite) | **1,968 / 1,968** (1,906 R85 baseline + 62 across four wave files; zero regressions) |
| Convex `tsc -p convex --noEmit` | 0 errors |
| Root `tsc --noEmit` | 126 = the documented baseline, zero new |
| eslint (changed files) | 0 errors / 0 warnings |
| ui-primitives ratchet (ADR-0004) | HELD at 2297 (the F-wave UIs add zero raw elements) |
| design-token gate | gray=0 |
| `vite build` | green |

## 7. Owner actions (unchanged standing items)

1. **Promote to production** — every wave ships only when the
   "Deploy to Production (promote)" workflow runs (blank sha = latest main).
2. `CLOUDFLARE_API_TOKEN` re-paste (stale since `04d798b3`) — the mirror
   deploy stays red until then (non-fatal; Vercel + Convex still deploy).
3. Rotate the GitHub PAT when convenient (it has transited chat; the current
   one lives only in one-time push URLs).
