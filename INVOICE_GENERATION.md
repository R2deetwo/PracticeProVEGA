# Invoice Generation & Billing — How It Works

This document explains how invoices, receipts, and payments flow through PracticePro, across both Vega (legal) and Atrium (property) products.

---

## 1. Manual Invoice Creation (Billing view)

**Entry point:** Billing → **New Invoice**.

1. Pick a client (Vega) or property/tenant (Atrium) — the party fields auto-fill from the contact/tenancy record.
2. Add line items — each has a description, quantity, and unit price. Line items are stored as an array on the invoice row (`invoices` table, `lineItems`).
3. Optionally link the invoice to a **matter** (Vega) or a **ledger entry / unit** (Atrium) so payment status reflects on the matter dashboard or Revenue Monitor.
4. The invoice number is **issued server-side at creation** (V2): an atomic, per-firm sequential number (`financial_counters`, the same pattern as receipts) in the firm-branded `INV-XX-0001` format — concurrent creations can never collide, and the sequence continues each firm's legacy numbers. Manual edits that collide with an existing number are rejected.
5. **Every money figure is computed server-side** (V2): `subTotal`, `taxAmount` (VAT — percentage semantics, the firm's rate, zero-rating distinguished from non-taxable), `withholdingAmount`, `netReceivable` and `total_amount` are recomputed from the line items inside the creating/editing transaction. Client-side figures are display hints only. Payments land through the audited `recordInvoicePayment` lifecycle (full or partial — a partial payment shows 'Partially Paid' with the true remainder everywhere).

**Statuses:** `draft` → `sent` → `paid` / `partially_paid` / `overdue` / `cancelled`.

---

## 2. Retainer Billing Engine (Vega)

Automated retainer billing cycles for firms on retainer arrangements.

- **Schedules:** each matter can carry a retainer schedule (`convex/retainerBilling.ts` — `upsertMatterRetainerSchedule`): billing interval, next run date, line-item template. Enabling auto-billing on an old matter starts one full cycle from enable — no retroactive catch-up flood (V2).
- **Outbox (V2 truth):** when a cycle is due, the engine stages an outbox entry as **Pending Review** (`Staged`). The cron **never** issues it — only a lawyer's explicit approval (`approveAndSendNow`) does. The 48-hour `reviewDueBy` is an advisory review deadline, not a send trigger. At most ONE catch-up invoice is staged per overdue matter; the schedule then clamps forward past the present.
- **States:** `Staged` (pending review) → `Queued` (approved) → `Issued` (invoice created, email NOT confirmed) / `Sent` (**only** when the email gateway confirms delivery — messageId recorded) / `Failed` / `Paused` / `Skipped`. `deliveryStatus` tells you exactly what happened.
- **Approval flow:** `approveAndSendNow` records who approved and attempts real email delivery; `pauseForEdit` / `skipCycle` manage the queue; `retryFailed` re-attempts failed sends and un-delivered emails (the invoice itself is never duplicated).

The outbox exists so automated billing is **reviewable** — a core trust feature. Every automated invoice passes through a human before reaching a client. (V2: this promise is now enforced in code — previously the review window was zero and "Sent" was stamped on entries no email had ever carried.)

---

## 3. Payments

**Bank transfer (primary, honest workflow):**
Invoices display the firm's Nigerian bank account details. There is no pretend card form — clients transfer directly and upload payment proof. This is deliberate: for the Nigerian market, bank transfer is the dominant reliable rail.

- Residents/clients upload payment proof via the portal (`portals:submitPaymentProof`).
- Admin reviews proofs in Financials → Inbox → Payment Proofs (`getPaymentProofsByFirm`) and approves/rejects via `updatePaymentProofStatus`.
- **Approving a proof BOOKS the money (Round B, 2026-11):** the status change, the `ledger_entries` row (idempotency key `proof-approved-{proofId}`), the proof↔ledger link and the optional linked service-charge settlement all commit in ONE Convex transaction. The approver confirms the amount (required when the tenant stated none) and may link an open service charge. Paystack-verified proofs settle the same way from the webhook — with the Paystack-verified amount, correcting a tenant's mis-typed figure.

**Payment processors (Paystack):**
Processor integrations exist in `convex/paystack.ts` and `convex/payments.ts` for card/USSD rails (activating). Recorded payments carry `processor`, `reference`, and an **idempotency key** — double-submits and webhook redeliveries cannot double-credit a ledger (see the `by_idempotency` index on `ledger_entries` and the `by_paystack_reference` index on `wallet_transactions`). Wallet top-ups credit exactly once per Paystack reference (Round A), and wallet auto-deductions each write their own ledger row (`wallet-deduct-{chargeId}-{cycle}`, Round B) — wallet-collected revenue is no longer invisible to the books.

**Ledger writes:** every confirmed payment writes a real `ledger_entries` row atomically with the invoice/payment/tenancy updates — single-transaction integrity (no "payment recorded but ledger empty" states). Rent collections (`sentry.collectRentPayment`, Round B) book the receipt number, the property's rent history and the rent + management-fee ledger entries in one transaction, deduped by the caller's idempotency key.

---

## 4. Receipts

Every confirmed payment can generate a receipt (`receiptDetail` view):
- Sequential receipt ID per firm — **issued server-side since Round B** (`financial_counters`, format `REC-00001…`): two same-second collections get distinct consecutive numbers by construction, and a retried collection returns the ORIGINAL number instead of double-booking. (Legacy receipts keep their historical formats.)
- Payment date, amount, payer, method, and the invoice(s) it settles
- Downloadable / printable from the Billing view and from the **Resident Portal** (residents can download their own rent receipts)

---

## 5. Scale of Charges Compliance (Vega)

Legal invoices for court-scale work can apply **Scale of Charges** rates (Remuneration Order 2023). The `ScaleOfChargesAgent` (src/agents/) computes compliant fee lines from matter metadata (court, claim value). Drafts produced this way cite the applicable scale — see `PRACTICE_PRO_AND_DRAFTPRO_GUIDE.md` for the drafting side.

---

## 6. Revenue Monitor (Atrium)

The Revenue Monitor (`src/components/atrium/RevenueMonitor.tsx`) aggregates ledger entries per property/unit/tenant:

- **Defaulter dashboard:** outstanding SC/MV/rent with aging buckets
- **Collection tracking:** paid vs. expected by period
- **Portfolio analytics:** property-level yield comparisons

Data comes from the same `ledger_entries` the billing flows write — one source of truth, no separate spreadsheet state.

---

## 7. Guarantees

| Guarantee | Mechanism |
|-----------|-----------|
| No double-crediting | Payment idempotency keys + `by_idempotency` index |
| No half-written payments | Atomic multi-table writes (invoice + payment + ledger in one transaction) |
| No unreviewed automated billing | Retainer outbox requires explicit lawyer approval (enforced — the cron never issues) |
| No fabricated delivery claims | 'Sent' only when the email gateway confirms; 'Issued (no email)' says the truth |
| One outstanding number everywhere | `invoiceFinancials` contract (server + drift-tested client mirror), server-computed for the portal |
| Trust exactly-once | Idempotency keys on every trust write (direct + offline queue) |
| Auditability | Soft-delete + `deletedAt`/`deletedBy` on invoices and payments |
