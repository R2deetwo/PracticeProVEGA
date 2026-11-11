# VEGA FINANCIAL TRUTH AND INTEGRITY — Reconciliation Report (V2, 2026-11-11)

The V0 audit found fifteen financial-correctness defects (V-FIN-1…V-FIN-15).
This report reconciles **every calculation that changed** — the formula the
system used before V2, the formula it uses now, and a worked example on real
figures. No historical money record was modified: every change is either a
read-side recomputation, a fence on NEW writes, or an additive, audited
lifecycle. The FINANCIAL_TABLES hard-delete protection, the Paystack webhook
infrastructure and every Atrium financial workflow are untouched.

Worked-example constants: fee **₦125,000.50** (line items ₦100,000 +
₦25,000.50), firm VAT setting stored as the legacy fraction **0.075** (= 7.5%),
WHT 10%, an invoice with ₦30,000 already recorded against an ₦80,000 total.

---

## 1. The tax contract (V-FIN-2, V-FIN-15)

| Path | BEFORE V2 | AFTER V2 |
|---|---|---|
| Rate semantics | **Three conventions at once**: forms multiplied the raw firm setting as a fraction (`vatRate \|\| 0.075`); `useFinance` divided a percentage by 100 (`vatRate \|\| 7.5`); the retainer engine hardcoded `7.5` | **One contract** (`convex/invoiceFinancials.normalizeTaxRate`): rates are percentages at the boundary; `0 < r < 1` is recognised as legacy fraction storage (×100); `0` is explicit zero-rating; negative is rejected |
| Manual invoice (InvoiceForm) | `vatAmount = subTotal × 0.075` → a firm that saved **7.5** was billed **750% VAT** (₦937,503.75 on the example fee) | `vatAmount = round_kobo(subTotal × 7.5%)` → **₦9,375.04** |
| Generate-from-matter (V-FIN-2) | `taxAmount = tax?.applicable ? … : 0` — the generating form never sent `applicable`, so **VAT was silently ₦0 on every generated invoice** while the form displayed “Apply VAT (7.5%) ₦9,375.04” | The form sends `{ applicable, ratePct }`; the server recomputes: **₦9,375.04** |
| Retainer staging | `Math.round(amount × 7.5) / 100` (hardcoded, float) | The firm’s own rate through the contract, kobo-exact: ₦100,000 → **₦7,500** |
| Where computed | **Client-side**; whatever the client sent was persisted verbatim | **Server-side fence** (`convex/invoiceFence`) on createItem, updateItem, the outbox review edit and the outbox issue step; client figures are intent hints, never authoritative |
| Zero-rated vs non-taxable | Indistinguishable (both “taxAmount 0”) | Distinguished and persisted: `taxApplicable:false` (non-taxable supply) vs `taxApplicable:true, taxRate:0` (explicit zero-rating) |
| Withholding (V-FIN-15) | Computed for display (`subTotal × 0.10`) but **never persisted**; `netReceivable` display-only | `withholdingApplicable / withholdingRate / withholdingAmount / netReceivable` all persisted: example fee → WHT **₦12,500.05**, net receivable **₦112,500.45**, invoice total unchanged at ₦125,000.50 |
| Edited invoices | Totals = whatever the edit form sent | The same server recompute fires on any patch touching line items or a tax flag — manual, generated and edited invoices use ONE calculation |
| Arithmetic | Float (`0.1 + 0.2 → 0.30000000000000004`) | Integer kobo internally, naira @2dp stored (once, at the boundary) |

## 2. Invoice numbering (V-FIN-6)

| | BEFORE | AFTER |
|---|---|---|
| Generator | Client-side `existingInvoiceCount + 1` (`src/utils/invoiceHelpers`); retainer used `INV-RET-` + last 6 digits of `Date.now()` | Server-side `financial_counters` (scope `invoices`) read-modify-written **inside the creating transaction** — the established receipts pattern (M8) |
| Concurrency | Two staff creating at the same moment read the same count → **the same number twice** | Concurrent creations conflict on the counter row and retry — **sequential and unique by construction** (proven by handler test: three same-instant creations → INV-AJAA-0001/0002/0003) |
| Format | `INV-AJ-0001` | **Preserved** (firm initials + lead initials + 4-digit sequence, computed server-side); the sequence continues each firm’s legacy numbers (max ≤4-digit suffix + 1) and ignores the 6-digit retainer junk |
| Manual edits | Any string accepted, duplicates possible | A manual edit colliding with another firm invoice is **rejected** |

## 3. Retainer auto-billing (V-FIN-3, V-FIN-4, V-FIN-5)

| Behaviour | BEFORE | AFTER |
|---|---|---|
| Review window | Comment in the code: *“review window = 0 for now”* — `scheduledFor = now`, the 15-minute cron auto-issued everything | A staged entry is **Pending Review**; the cron only re-drives entries a lawyer explicitly approved. `reviewDueBy = stagedAt + 48h` is an advisory display deadline, never a send trigger |
| “Sent” claims | The send step’s own comment: *“For now we simulate a successful send”* — the entry was marked **Sent with a sentAt timestamp while no email existed** | State **Sent** is set ONLY when the email gateway confirms delivery (Brevo messageId stored). No gateway configured → state **Issued**, `deliveryStatus: 'not_emailed'`, failure reason states plainly that no email left the building |
| States | Staged → Queued → Sent/Failed/Paused/Skipped (with the Sent lie) | **Staged (pending review) → Queued (approved) → Issued (no confirmed email) / Sent (email confirmed) / Failed / Paused / Skipped** — each carrying its truthful delivery record |
| Catch-up (V-FIN-4) | A matter with `nextBillingDate` months in the past staged **one invoice per 30-minute cron tick, forever** — enabling a schedule on an old matter flooded the firm | The scan stages **at most one** catch-up entry (the most recent due cycle) then clamps `nextBillingDate` forward past now. Enabling auto-billing on an old matter now starts **one full cycle from enable** (a future `nextBillingDate` is preserved on re-save) |
| Invoice creation | `INV-RET-<Date.now()>`, status **“Sent”** (nothing was sent), totals copied from the (client-editable) outbox row | Server-issued sequential number, status **“Unpaid”** (issued, not claimed delivered), totals recomputed from the line items with the tax contract, **idempotent** — a retried send reuses the existing invoice, never books a second one |
| Trust draw-down | — | **Not implemented, as required** — no new trust-funded accounting model was introduced |

## 4. Trust accounting (V-FIN-8, V-FIN-13)

| | BEFORE | AFTER |
|---|---|---|
| Duplicate submissions | None — a double-tap booked twice | `idempotencyKey` (client-supplied stable key) + `by_idempotency` index; a replay **returns the original transaction** (`duplicate: true`), never a second row |
| Offline replay | The offline queue replayed `recordTrustTransaction` with no key — a retry after a mid-replay reload **double-booked the trust ledger** | The queue injects its stable item id as the key (`offline:<itemId>`); replays are no-ops |
| Balance arithmetic | Float accumulation (`balance += amount`) | Integer kobo sums; `getTrustBalance` **recomputes from the records** instead of trusting the last row’s cached `balanceAfter` |
| Concurrency | The balance check and the running balance could race past each other (two withdrawals of the same matter balance could both pass) | Every trust write patches the firm’s `financial_counters` row (scope `trust`) inside the transaction — Convex’s serializable isolation serialises concurrent trust writes; the insufficient-balance check is race-free |
| Corrections | `deleteTrustTransaction` (admin, reason-gated, rewrites every later running balance) | **`reverseTrustTransaction`**: an explicit, audited contra entry — the original keeps every field (gains only `reversedAt/By`), the reversal references it, both net to zero in every balance, and the full before/after lands in `financial_audit_log`. Double-reversal is refused; the delete path remains (its protections unchanged) but now also refuses to delete a reversed original (it would break the reversal’s audit link) |
| History | Deletions rewrote history rows | **Immutable**: reversals append; nothing is edited or deleted silently |

## 5. Payment and action truth (V-FIN-7, V-FIN-9, V-FIN-12)

| Surface | BEFORE | AFTER |
|---|---|---|
| Mark-as-paid | A raw status flip; the detail view promised it would “create a permanent financial record **(including a receipt)**” — **no receipt existed** | `financialIntegrity.recordInvoicePayment` — amount, method, reference, full audit-trail entry. No receipt is claimed or fabricated |
| Revert | A raw flip to ‘Reversed’ whose dialog promised a **Credit Note** and unbilling of time/expenses — **neither existed** | `financialIntegrity.revertInvoicePayment` — reason required, invoice returns to Unpaid, `amountPaid`/`paidDate` cleared together, before/after audited. The UI states exactly what happens (and what does not) |
| Partial payments (V-FIN-9) | **Impossible** — no field, no status; a half-paid invoice was indistinguishable from unpaid, and every outstanding total ignored the money received | `amountPaid` accumulates (kobo-exact); status transitions truthfully to **‘Partially Paid’** until the total is reached; overpayment beyond the total is rejected with guidance; `outstanding = total − amountPaid` everywhere |
| Overdue | Nothing ever set an invoice Overdue (the status only existed in demo data) | Derived truthfully on read: past-due open invoices count as overdue in the authoritative summary (`overdueBalance`), without rewriting any stored status |
| Portal “Pay Now” (V-FIN-12) | A button implying a payment operation; instructions said “contact them directly if you need their bank details”; the gateway modal spun 800ms and showed **“Payment Reported” while submitting NOTHING**; the notification message claimed “I have made payment of **₦0**” (ghost fields) | Renamed **“Payment Details”** showing the firm’s real bank details (3-field server projection); the confirm step performs a **real portal-message notification** or is not offered; copy states plainly: *“No payment is taken by this app — you transfer directly to your legal team’s account.”* Notification carries the true total and remaining balance |
| Simulated payments | “Paying…” pulse on the billing tab; fake confirmation toasts | Removed. The client never marks an invoice paid; the firm confirms after verifying |
| Paystack | Dormant infrastructure | **Preserved untouched** (webhook, provider abstraction, subscription path) |

## 6. Portal financial correctness (V-FIN-1)

| | BEFORE | AFTER |
|---|---|---|
| Client↔matter relationship | Matters were matched on the contact’s **Convex `_id` only** — but matters created through the app store the contact’s **custom id**. Verified with representative fixtures: those clients saw an **empty financials tab** | The match set contains **both shapes** (`_id` and custom `id`) of the caller’s contact — every convention resolves (proven by handler test across all four combinations) |
| Invoice↔matter join | Invoices matched against matter **Convex ids only**, while invoice `matter.id` snapshots hold the matter’s **custom id** | Both shapes of every client matter are in the match set; the invoice list delivers across conventions |
| Outstanding balance | **Five formulas, all wrong somewhere**: the portal hero + financials tab summed `inv.totalAmount \|\| inv.amount` — **fields that do not exist on invoices → ₦0 forever**; the billing tab summed raw line items (ignored VAT); the staff KPI used `total_amount \|\| subTotal` (a true ₦0 total fell back to subTotal); the reports view summed line items again; the invoice detail recomputed a third way | **One server-computed number** (`portals.getClientFinancialSummary` → `invoiceFinancials.computeClientFinancialSummary`): Σ(total − amountPaid) over open, active invoices, kobo-exact, overdue split out. The portal surfaces render it directly; staff surfaces use the drift-tested client mirror of the same contract |
| Exclusions | Inconsistent | Voided/test records excluded everywhere (the shared `recordStatus` predicate), legacy ‘Void’ status belt-and-braces |
| Worked example | Portal showed **₦0** while the client owed ₦207,500 (₦107,500 sent + ₦50,000 unpaid + ₦50,000 remainder of a partially-paid ₦80,000 invoice) | Portal shows **₦207,500** — same figure on the hero card, the financials tab, the billing tab, and matches the staff KPI and reports (equivalence-tested) |

## 7. Reporting and auditability (V-FIN-10, V-FIN-14)

| | BEFORE | AFTER |
|---|---|---|
| Formula drift | Five surfaces, five formulas (see §6) — they “regularly disagreed with each other” (the code’s own comment) | Every total derives from the ONE contract (`convex/invoiceFinancials` + drift-tested `src/utils/invoiceFinancials` mirror). Each displayed figure is traceable to the persisted, server-computed `total_amount` / `amountPaid` on the invoice rows |
| Report correctness | The A/R aging and “Total Outstanding” summed raw line items — ignoring VAT, partial payments and the voided/test quarantine | Outstanding = true remainders; voided/test rows never enter a total; past-due buckets use the same remainders |
| Vega audit history (V-FIN-14) | The append-only `financial_audit_log` existed server-side with **no Vega surface to read it** | **Financial Audit History** section in the reports view: every recorded payment, revert, void/reinstate, trust reversal and audited edit — firm-scoped, session-verified, newest first. Atrium’s reconciliation console and controls are untouched |

---

## Guarantee map (unchanged protections)

| Guarantee | Mechanism |
|---|---|
| No double-crediting (trust) | Idempotency keys + `by_idempotency` index + offline-queue key injection |
| No double-crediting (payments) | A single audited writer for `amountPaid` (generic-path patches stripped) |
| No half-written money rows | All multi-table writes stay inside single Convex transactions |
| No unreviewed automated billing | Retainer entries issue ONLY on explicit lawyer approval — now actually true |
| No silent history edits | Reversals are contra entries; the original is never modified; everything lands in `financial_audit_log` |
| Paystack / Atrium / FINANCIAL_TABLES | Untouched, per the round’s non-negotiables |

## Verification

- **Real-handler tests**: `tests/unit/roundV2FinancialTruth.test.ts` — 36 tests covering every acceptance scenario: VAT-inclusive / VAT-exclusive / zero-rated / non-taxable / withholding, concurrent numbering, retainer scheduling + catch-up + honest delivery states, duplicate trust submissions, offline replay, trust kobo arithmetic + reversals, invoice payment reversal, partial payments, client outstanding balances across both id-convention fixtures, and cross-surface reconciliation (server canon ≡ client mirror + source contracts for all five surfaces).
- **Pre-fix proof**: a 5-probe suite importing only pre-existing modules fails **5/5 against the pre-V2 tree** (VAT recompute, server numbering, trust idempotency, dual-id resolution, catch-up clamp) and passes 5/5 after.
- **Regression suite**: vitest **2236/2236** (113 files, +36), convex tsc **0**, root tsc **94 = baseline**, eslint **0 errors**, ui-primitives ratchet **2296 (improved from 2297, baseline tightened)**, gray tokens **0**, identity audit **PASSED**, main + admin builds **green**.

## Deliberately NOT done (per the brief)

- No new trust-funded draw-down accounting model (owner approval required first).
- No modification of Paystack webhook infrastructure, Atrium financial workflows, historical money records, or the FINANCIAL_TABLES hard-delete protection.
- No speculative accounting behaviour — every state and figure above maps to a real recorded action.
