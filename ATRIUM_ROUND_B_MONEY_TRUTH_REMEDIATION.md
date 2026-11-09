# ATRIUM OS — ROUND B: MONEY TRUTH REMEDIATION REPORT (2026-11-09)

**Companion to:** ATRIUM_AUDIT_R75.md (the R75 audit register, Wave S2 — "Money
truth"), Round A (`3992a360`) and Round A2 (`0c1bf2fa`). **Round A/A2 commits are
untouched**; this work is a separate commit on top.

**Mandate (owner):** audit and remediate the financial workflows — rent
payments, receipts and payment verification; wallet balances, credits, debits
and transaction history; service charges and collections; revenue recognition
and reconciliation; duplicate payments, replay protection and inconsistent
ledger entries; financial reports and outstanding balances. Trace each workflow
from the UI through the Convex mutations and queries to the data model, and
ensure every displayed financial figure reconciles to actual transactions. Add
regression tests for each fix, preserve legitimate workflows, report changes,
unresolved risks, test results and the commit hash. Nothing outside the money
paths (no ARIA, no dashboards redesign, no unrelated modules).

---

## 1. Scope and method

Every money path was traced end-to-end (UI → Convex mutation/query → schema):

| Workflow | UI | Backend | Stores |
|---|---|---|---|
| Rent collection + receipts | `CollectRentModal` | `sentry.addLedgerEntry` (was: 4 separate client writes) | `properties.rentPaymentHistory`, `ledger_entries`, `documents` |
| Payment proofs (transfer) | tenant `PaymentsTab` → staff `PaymentProofsTab` | `portals.submitPaymentProof` / `updatePaymentProofStatus` | `payment_proofs`, `ledger_entries` |
| Payment proofs (Paystack) | tenant `PaymentsTab` inline SDK | `paystack.recordPaystackEvent` (webhook) | `payment_proofs`, `paystackEvents`, `ledger_entries` |
| Wallet top-up | resident `DashboardTab` | `wallets.initiateWalletFunding` / `verifyWalletFunding` / `fundWallet` | `resident_wallets`, `wallet_transactions` |
| Wallet auto-deduct | (cron 06:15 UTC) | `wallets.processAutoDeductions` | `resident_wallets`, `wallet_transactions`, `service_charges`, **`ledger_entries` (new)** |
| Service charges & collections | `ServiceChargeMonitor` | `sentry.upsertServiceCharge` / `markChargeAsPaid` / `applyLatePenalty`, crons `flagOverdueCharges` / `resetMonthlyServiceCharges` | `service_charges`, `ledger_entries` |
| Revenue views | `LedgerManager`, RevenueMonitor | `sentry.getCashFlowSummary` / `getLedgerByFirm` | `ledger_entries` |
| Outstanding balance | resident `DashboardTab` | `portals.getTenantInfo` | `service_charges` |

Fixed in this round: **H1, H2, H10, H13 (money paths), M5, M6, M7, M8, M18**
plus a new **reconciliation checker** (the Wave S2 capstone). Every fix is
server-side enforced and pinned by both-direction regression tests
(`tests/unit/roundBMoneyTruth.test.ts`, 44 new tests).

---

## 2. Per-vulnerability remediation (6-element format)

### 2.1 H1 — Proof approval was a financial no-op

1. **Vulnerability.** Approving a tenant payment proof flipped its status and
   cancelled reminder ladders — nothing else. No ledger entry, no charge
   settlement, no invoice payment. Money received through the *primary*
   collection rail (bank-transfer proofs; Paystack verifications via the
   webhook's sibling bug, §2.5) was invisible in every ledger, cash-flow and
   reconciliation view unless staff manually double-entered it.
   `INVOICE_GENERATION.md` §3 claimed otherwise (doc was wrong — now corrected).
2. **Root cause.** `updatePaymentProofStatus` treated approval as a state
   change, not a booking: `portals.ts` patched status + fired the automation
   hook and stopped there. The webhook branch had the identical hole.
3. **Files / functions.** `convex/portals.ts` — new `settleProofInternal()`
   core + `settleApprovedProof` internalMutation; `updatePaymentProofStatus`
   (new args `confirmedAmount`, `chargeType`, `serviceChargeId`); proof schema
   field `ledgerEntryId` (`convex/schema.ts`). UI: `PaymentProofsTab.tsx`
   (confirmed-amount input — required when the tenant stated none; optional
   open-charge link select, fed by `getServiceChargesByFirm`).
4. **Fix.** Approval now books the money **in the same Convex transaction**:
   registry-validated ledger entry (type `rent` by default; `service_charge`
   when linked), status `cleared`, idempotency key `proof-approved-{proofId}`
   (exactly-once: re-approval, webhook redelivery and staff/webhook races all
   no-op), proof↔ledger link, optional linked service-charge settlement
   (status/outstanding/credit/reminder ladder), an append-only
   `financial_audit_log` row (M24 for the money path), and
   `reviewedAt`/`reviewedBy` stamped from the session. An amount-less proof
   cannot be approved without a confirmed amount — a loud error instead of a
   silent ₦0 booking. Retiring a booked proof remains the audited VOID
   lifecycle (never a second settlement).
5. **Regression tests.** 7 behavioural tests: approval books (amount/type/
   status/key/audit + proof patch); re-approve → `duplicate:true`, zero new
   rows; amount-less without `confirmedAmount` → throws, nothing booked;
   amount-less with `confirmedAmount` → books it; unauthenticated → throws;
   charge linkage settles + cross-firm link rejected. All green (44/44 file,
   1,644/1,644 suite).
6. **Residual exposure.** Approving-then-rejecting a proof leaves the ledger
   entry booked (correct accounting — reversal is the void lifecycle, and the
   staff flow surfaces it); the tenant gets no out-of-band notification of the
   approval (H9/M10 — Round C, interaction truth).

### 2.2 H2 — Wallet auto-deduct revenue never reached the ledger

1. **Vulnerability.** `processAutoDeductions` debited the wallet, wrote a
   `wallet_transactions` row and flipped the charge to `PAID_FULLY` — but wrote
   no `ledger_entries` row. All wallet-collected revenue was missing from every
   financial view (systematic understatement; the cash-flow summary and
   reconciliation could never balance).
2. **Root cause.** The cron (internal, no session) could not call the
   session-guarded `addLedgerEntry`, so the wallet module simply never wrote
   to the ledger.
3. **Files / functions.** `convex/wallets.ts` `processAutoDeductions`;
   `convex/schema.ts` — `wallet_transactions.ledgerIdempotencyKey`;
   `convex/sentry.ts` — `makeTxHash` exported for provenance stamps.
4. **Fix.** Every deduction now writes its ledger row **inside the same
   transaction** as the wallet debit + charge settlement (type
   `service_charge`, `cleared`, channel `Wallet Auto-Deduct`, idempotency key
   `wallet-deduct-{chargeId}-{cycleDueDate}`), and the wallet transaction row
   carries the same key as the reconciliation join key. A pre-booked cycle key
   short-circuits the whole deduction (retry edge). Carried-forward credit
   (§2.4) is applied before deduction: only the wallet-funded part moves money
   and gets a row; a fully credit-covered cycle settles the charge with no
   wallet debit and no new row (the credit was booked when it was overpaid).
5. **Regression tests.** 6 tests: deduction books all three stores atomically
   (wallet, wtx with key, ledger with key, charge PAID_FULLY); second run → no
   double-deduct/double-book; insufficient funds → no ledger row; full-credit
   cycle → settled with no debit/no row; partial credit → only the remainder
   booked; pre-booked key → skipped. All green.
6. **Residual exposure.** Pre-Round-B debit rows have no ledger rows — counted
   in the reconciliation's `legacyWalletDebits` bucket (informational, never
   reds a healthy deployment); a backfill could be scheduled if the owner
   wants history restated.

### 2.3 H10 — Resident "Outstanding Balance" always ₦0

1. **Vulnerability.** The resident dashboard's Outstanding Balance card read
   `tenantInfo.outstandingBalance` — a field `getTenantInfo` never returned.
   Every defaulting resident saw "All Caught Up" regardless of arrears: a
   displayed financial figure that could never reconcile to actual
   transactions.
2. **Root cause.** The field was consumed client-side (`DashboardTab.tsx:50`)
   but never computed server-side (audit H10; the audit sequenced the *UI
   wiring* into Round C — the owner's Round B brief explicitly includes
   "outstanding balances", so the server-side truth lands here).
3. **Files / functions.** `convex/portals.ts` `getTenantInfo` (new
   `outstandingBalance` return field).
4. **Fix.** Computed from the same obligations store the dues tab, reminder
   engine and wallet auto-deduct use (`service_charges`): for every charge of
   the tenant (alias-matched, same resolution as the ledger/dues queries) that
   is not `PAID_FULLY`, the outstanding is `(outstandingBalance ?? amount)`
   minus carried credit — so the dashboard card, the Dues tab and the
   collections engine cannot disagree by construction. Failure of the sum
   never blocks the portal shell.
5. **Regression tests.** 2 tests: mixed fixture (partial 30k + unpaid 50k +
   credit-netted 6k + paid/foreign excluded) → exactly 86,000; all-paid → 0.
   Green.
6. **Residual exposure.** Rent arrears themselves are not tracked as
   obligations anywhere in the data model (rent is recorded as paid history,
   not billed obligations) — the figure is *service-charge* outstanding, the
   only arrears the system tracks. A rent-arrears model is Round E
   (data-model wave) territory.

### 2.4 M5 — No server-side amount validation; floats unrounded; overpayments discarded

1. **Vulnerability.** (a) Money mutations accepted 0, negative and NaN
   amounts (a negative auto-deduct amount would have *credited* a wallet; NaN
   poisoned every aggregate it entered). (b) Floats were stored unrounded on
   the dedicated money paths. (c) Overpayments were silently discarded:
   paying ₦150k on a ₦100k charge booked ₦150k revenue, clamped the
   outstanding to 0 and reset the cycle tracker — the tenant's extra ₦50k
   simply vanished from the books.
2. **Root cause.** `moneyUtils.ts` existed (roundMoney et al., a prior audit
   fix) but was not wired into the dedicated money mutations; no overpayment
   concept existed in the charge lifecycle.
3. **Files / functions.** `convex/moneyUtils.ts` — new `assertPositiveAmount`
   / `assertNonNegativeAmount`; `convex/sentry.ts` — `addLedgerEntry`,
   `markChargeAsPaid`, `applyLatePenalty`, `upsertServiceCharge`,
   `settleUnitPeriods` (skip ≤ 0 already), `collectRentPayment`;
   `convex/wallets.ts` — `fundWallet`, `processAutoDeductions`;
   `convex/portals.ts` — `submitPaymentProof`; `convex/schema.ts` —
   `service_charges.creditCarriedForward`; `src/types.ts` (type mirror) +
   `ServiceChargeMonitor.tsx` (credit chip "₦X credit → next cycle").
4. **Fix.** Every dedicated money mutation validates + rounds server-side
   (positive for payments/charges/credits, non-negative for optional fees).
   Overpayment credit is carried forward: the excess lands in
   `creditCarriedForward`, the ledger description records it, and the three
   consumers apply it — the monthly reset (`outstanding = max(0, amount −
   credit)`, credit decremented by what it covered), the overdue flagger
   (never chase money the tenant already paid) and wallet auto-deduct (§2.2).
5. **Regression tests.** 5 tests: 0/−/NaN rejected across 6 mutations
   (incl. portal proof submit); ₦150k-on-₦100k → credit 50k + ledger books
   150k; reset consumes credit (100k−30k → 70k outstanding, credit 0);
   flagger nets credit; rounding to 2dp on write. Green.
6. **Residual exposure.** Legacy rows with unrounded floats remain as stored
   (restating history is not this round's mandate); the reconciliation
   checker flags any *new* ≤ 0 / non-finite amounts.

### 2.5 M7 — Paystack webhook auto-verify: status mismatch, no booking, unverifiable amounts, and the webhook/proof race

1. **Vulnerability.** The webhook's proof branch only matched
   `pending_verification` proofs, while the tenant UI submitted
   `pending_review` — for the unified pipeline the branch was dead code and
   Paystack rent payments waited for manual review forever (the audit's M7;
   Round A's H19 already made the server derive `pending_verification` for
   Paystack submissions, reviving the branch). Three residual holes: (a) the
   branch still booked **no money** (the H1 sibling); (b) the *tenant-claimed*
   amount was trusted — a tenant could type ₦500, pay ₦5,000 (or vice versa)
   and the books would record the claim; (c) if the webhook landed **before**
   the proof row existed (the popup callback races the webhook), the proof
   stranded in `pending_verification` forever — even Paystack's redelivery
   short-circuited as a duplicate event.
2. **Root cause.** Status vocabulary drift between writers; no settlement
   core; no reference→event back-check on submission.
3. **Files / functions.** `convex/paystack.ts` `recordPaystackEvent`
   (charge.success branch); `convex/portals.ts` `submitPaymentProof`
   (self-heal) + `settleApprovedProof`; `convex/schema.ts` —
   `paystackEvents.by_reference` index.
4. **Fix.** The webhook now settles through the shared `settleProofInternal`
   core (§2.1): books the **Paystack-verified amount** (`event.amount`), links
   proof↔ledger, corrects the proof's claimed figure when it differs (the
   ledger description records both figures), releases the suppression ladder,
   and also picks up legacy `pending_review` rows that carry a reference
   (pre-H19 data). The race is closed from both sides: the webhook settles any
   findable proof; and `submitPaymentProof` self-heals — after insert it
   checks `paystackEvents.by_reference` for an already-recorded
   `charge.success` and settles in the same transaction. Exactly-once either
   way (shared idempotency key).
5. **Regression tests.** 5 tests: webhook settles pending_verification and
   books the verified 5,000 (claim 500 corrected); legacy pending_review+ref
   settles; webhook redelivery no-ops (event dedup, zero new rows);
   submission self-heals off a pre-recorded event (status `verified`, ledger
   booked, amount from the event); a normal submission (no event yet) stays
   pending_verification and unbooked. Green.
6. **Residual exposure.** None identified on this path. (Paystack itself is
   still dormant platform-wide — `isPaystackActive` → false on the live
   deployment; the go-live decision is the owner's standing action, and the
   M7 fix is the prerequisite the audit named for it.)

### 2.6 M6 + M8 — CollectRent: four non-atomic client writes, client-minted receipt numbers, no idempotency

1. **Vulnerability.** The online rent-collection flow was four separate writes
   — `updateItem('properties')`, a legacy `updateItem('contacts')` mirror,
   `addLedgerEntry(rent)`, `addLedgerEntry(management_fee)` — with the receipt
   number minted on the CLIENT (`REC-{timestamp}-{random}`: collisions
   possible, no sequence) and **no idempotency key** on either ledger write. A
   network retry mid-sequence left the books in either broken state: rent
   history says paid but the ledger never heard of it, or the ledger booked
   the rent twice while the property row advanced once. The offline queue
   replayed the same four writes with the same gaps.
2. **Root cause.** The flow predated the idempotency/atomicity architecture;
   the receipt number lived client-side because the receipt PDF is generated
   client-side.
3. **Files / functions.** NEW `convex/sentry.ts` `collectRentPayment`
   (mutation); `convex/schema.ts` — new `financial_counters` table
   (`by_firm_scope`); `src/components/modals/CollectRentModal.tsx` (both
   paths); `src/hooks/useOfflineQueue.ts` (replay registry).
4. **Fix.** ONE server transaction: sequential receipt number issued from a
   per-firm `financial_counters` row (read-modify-written inside the
   transaction — Convex's serializable isolation makes two same-second
   collections conflict on the counter row, so one retries and takes the next
   number: sequential AND unique by construction, `REC-00001`…), property
   `rentPaymentHistory` append + `status: 'Occupied'`, rent ledger entry
   (`cleared`, `paymentRef` = receipt number) and the optional
   management-fee entry (`pending`, key `{idempotencyKey}:fee`) — all deduped
   by the caller's key: a replay returns the ORIGINAL receipt number and
   writes nothing. The client keeps only the non-bookkeeping steps
   (management-fee *invoice* generation, receipt PDF with the server number,
   document record, best-effort legacy contact mirror). Offline: the queue
   replays the same single mutation; the offline PDF carries the sync
   reference and the toast explains the official number arrives on sync.
5. **Regression tests.** 6 behavioural tests: atomic booking (counter=1,
   history entry, 2 ledger rows with receipt `paymentRef`); two same-second
   collections → `REC-00001`/`REC-00002` (the M8 gate); key replay →
   `duplicate:true` + original receipt + zero writes; 0/negative rent and
   negative fee rejected pre-write; unauthenticated rejected; cross-firm
   property rejected. Plus source-contract tests (modal uses
   `collectRentPayment`, no `REC-${Date.now()}` mints, offline queue
   replays it). All green.
6. **Residual exposure.** The receipt *document record* and the
   management-fee *invoice* remain client-side post-transaction steps
   (best-effort, non-blocking — the money is already booked; a failed PDF
   shows an accurate warning toast per BRIEF #3). Legacy receipts keep their
   historical formats; the reconciliation checker enforces uniqueness only
   among new `REC-` prefixed rent entries.

### 2.7 H13 (money paths) — Silent money-mutation failures

1. **Vulnerability.** `LedgerManager` AddEntry had `try/finally` with **no
   catch** (a rejected save left no visible trace — staff believed a failed
   booking had landed); `ServiceChargeMonitor` mark-paid/partial had bare
   awaits with the same silence.
2. **Root cause.** Error surfacing was never wired on these three money
   actions (the audit's H13; this round covers the money-path subset — the
   remaining H13 surface, property bulk deletes, is Round C/D).
3. **Files / functions.** `src/components/atrium/LedgerManager.tsx`,
   `src/components/atrium/ServiceChargeMonitor.tsx`.
4. **Fix.** try/catch + explicit error toasts stating that **nothing was
   booked** ("Failed to save the ledger entry — … Nothing was booked." /
   "Failed to record the payment — … The charge is still unpaid.").
5. **Regression tests.** Source-contract tests pin the ROUND B (H13) markers
   and messages. Green.
6. **Residual exposure.** The remaining H13 items (PropertyManagerView
   allSettled swallowing, bulk deletes) — untouched this round per scope.

### 2.8 M18 — Hardcoded `pk_test_…` fallback silently diverted the payment rail

1. **Vulnerability.** The tenant Pay with Card path keyed off a client env
   var with a hardcoded `pk_test_xxx…` fallback: whenever it was missing, the
   flow silently switched the resident to bank transfer — the resident never
   learned online payment existed, and the displayed payment options did not
   reflect server truth.
2. **Root cause.** Client-side configuration for a server-configured rail.
3. **Files / functions.** `src/components/tenant/TenantPortal/PaymentsTab.tsx`
   (uses `api.paystack.isPaystackActive` — the server query that checks
   `PAYSTACK_ENABLED` + the public key in Convex env, and hands back the live
   public key).
4. **Fix.** Availability and the key now come from the server: the method
   toggle disables Paystack with a clear "Not activated yet" label when the
   server says inactive, the pay attempt re-checks and explains plainly, and
   the popup uses the server-provided key (client/server key drift is now
   impossible).
5. **Regression tests.** Source-contract: `isPaystackActive` wired; the
   `VITE_PAYSTACK_PUBLIC_KEY` / `PAYSTACK_PUBLIC_KEY` lookups are gone. Green.
6. **Residual exposure.** None on this path. Paystack go-live remains the
   owner's standing decision.

### 2.9 NEW — The reconciliation checker (Wave S2 capstone)

1. **Why.** The audit's Wave S2 gate: "reconciliation cron green on demo
   firm". Money truth needs a *proof mechanism*, not just fixed writers.
2. **Implementation.** `convex/financialIntegrity.ts` —
   `runFinancialReconciliation` (internalMutation, cron-registered daily
   07:15 UTC after auto-deduct/engine/rule-sweep have settled;
   `withCronReporting` error capture) + founder-gated
   `runFinancialReconciliationNow` / `getLatestFinancialReconciliation`. New
   `financial_reconciliation_reports` table (`by_ran_at`). Checks, per run
   (bounded takes, pre-Round-B rows bucketed as legacy so history never reds
   a healthy deployment): wallet debits ↔ ledger rows (H2); approved/verified
   proofs ↔ ledger entries (H1); ≤ 0 / non-finite amounts (M5); duplicate
   idempotency keys; duplicate `REC-` receipt numbers on rent entries (M8);
   wallet balance drift (stored balance vs the latest transaction row's
   `newBalance` — informational). `ok` = zero structural gaps; every run
   writes a report row with counts + bounded offender samples.
3. **Tests.** 6 tests: consistent books → `ok:true` (the demo-firm gate);
   post-cutoff debit without ledger → red; approved proof without ledger →
   red; duplicate receipt numbers → red; legacy rows → legacy buckets, still
   green; balance drift reported without redding. All green.
4. **Live verification (dev deployment).** Executed against the deployment's
   real data: **`ok: true` — walletDebitsWithoutLedger=0,
   approvedProofsUnbooked=0, invalidAmounts=0, dupReceipts=0, drift=0,
   legacy=0/0.**

---

## 3. Deliberately out of scope (per the approved R75–R92 sequence)

| Item | Why deferred | Target |
|---|---|---|
| M9 wallet refund path + staff wallet view | Wave S4 gate ("wallet refund audited") | Round D |
| M23 bounded auto-retry for failed scheduled sends | Comms reliability, not money truth (owner's Round B brief is strictly financial) | Round C/D |
| M15 frozen cron date (`aggregateDailyMetrics`) | Usage metrics, Wave S5 | Round E |
| M1 full service-charge store unification | Data-model wave; this round made the *ledger* the revenue truth and reconciles across both stores | Round E |
| M3 rent roll / arrears-aging / SC-collection reports | New reporting surfaces, Wave S5 (existing figures now reconcile) | Round E |
| H11 ARIA money context ("who owes rent?") | Wave S6 | Round F |
| H13 remainder (property bulk-delete error surfacing) | Non-money surfaces | Round C/D |
| H14 `schemaValidation:false` insert-audit | R90 program | Round E |

---

## 4. Schema changes (all additive; push validated by Convex)

- `payment_proofs.ledgerEntryId` (proof↔ledger link) ·
  `service_charges.creditCarriedForward` ·
  `wallet_transactions.ledgerIdempotencyKey` ·
  `paystackEvents` index `by_reference`.
- NEW `financial_counters` (`by_firm_scope`) — sequential receipt numbering.
- NEW `financial_reconciliation_reports` (`by_ran_at`) — checker output.

## 5. Quality gates

| Gate | Result |
|---|---|
| vitest (full suite) | **1,644 / 1,644 passed** (1,600 baseline + 44 new `roundBMoneyTruth.test.ts`; one Round A fixture updated for the strengthened H1 contract — noted in-file) |
| Convex `tsc -p convex --noEmit` | **0 errors** |
| Root `tsc --noEmit` | **126 errors = under the 131 CI baseline, zero new** (the single PaymentsTab error pre-exists on main) |
| `vite build` | green |
| eslint | 0 errors / 77 warnings (baseline) |
| UI-primitives ratchet (ADR-0004) | **held at 2312** (new review inputs built on the `ui/` Input/Select primitives, bare variant) |
| Live dev-deploy verification | Round B code deployed to `dev:gregarious-malamute-537`; `isPaystackActive` → `{active:false}` (expected); `collectRentPayment` + `runFinancialReconciliationNow` surfaces live (founder gate rejects unauthenticated calls as designed); **reconciliation run → `ok: true`** |

## 6. Unresolved risks / owner actions

1. **Production promote pending** (same flow as every round) — the production
   Convex deployment still serves the pre-Round-A surface until the owner runs
   the promote workflow; Round A, A2 and B all ship together when promoted.
2. **Legacy data is not restated** — pre-Round-B wallet debits/approved
   proofs have no ledger rows (reconciliation buckets them as `legacy*`,
   informational); a historical backfill is available on request.
3. Standing actions unchanged: `CHAKRA_WEBHOOK_SECRET` (Round A),
   `CLOUDFLARE_API_TOKEN` rotation, Paystack go-live decision (M7 fix — its
   prerequisite — has now landed).

## 7. Commit

Separate commit on top of Round A/A2 (both intact):
`fix(r76): ROUND B money truth — H1 proof→ledger atomicity, H2 wallet-deduct
ledger rows, M5 validation+overpayment credit, M6/M8 atomic collectRent with
server receipt numbers, M7 webhook settlement+race self-heal, H10 outstanding,
reconciliation cron`
(commit hash recorded in the worklog entry and the push record.)
