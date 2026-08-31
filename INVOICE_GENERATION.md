# Invoice Generation & Billing — How It Works

This document explains how invoices, receipts, and payments flow through PracticePro, across both Vega (legal) and Atrium (property) products.

---

## 1. Manual Invoice Creation (Billing view)

**Entry point:** Billing → **New Invoice**.

1. Pick a client (Vega) or property/tenant (Atrium) — the party fields auto-fill from the contact/tenancy record.
2. Add line items — each has a description, quantity, and unit price. Line items are stored as an array on the invoice row (`invoices` table, `lineItems`).
3. Optionally link the invoice to a **matter** (Vega) or a **ledger entry / unit** (Atrium) so payment status reflects on the matter dashboard or Revenue Monitor.
4. The invoice number is generated per-firm with a collision check (`invoiceNumber`).

**Statuses:** `draft` → `sent` → `paid` / `partially_paid` / `overdue` / `cancelled`.

---

## 2. Retainer Billing Engine (Vega)

Automated retainer billing cycles for firms on retainer arrangements.

- **Schedules:** each matter can carry a retainer schedule (`convex/retainerBilling.ts` — `upsertMatterRetainerSchedule`): billing interval, next run date, line-item template.
- **Outbox:** when a cycle is due, the engine *stages* an outbox entry rather than sending immediately. Nothing goes to a client without admin approval.
- **Approval flow:** `approveAndSendNow` sends it; `pauseForEdit` / `skipCycle` manage the queue; `retryFailed` re-attempts failed sends.
- **Staging manually:** `stageRetainerInvoiceManually` lets an admin queue a one-off retainer invoice.

The outbox exists so automated billing is **reviewable** — a core trust feature. Every automated invoice passes through a human before reaching a client.

---

## 3. Payments

**Bank transfer (primary, honest workflow):**
Invoices display the firm's Nigerian bank account details. There is no pretend card form — clients transfer directly and upload payment proof. This is deliberate: for the Nigerian market, bank transfer is the dominant reliable rail.

- Residents/clients upload payment proof via the portal (`portals:submitPaymentProof`).
- Admin reviews proofs in Billing (`getPaymentProofsByFirm`) and marks them `updatePaymentProofStatus` → confirmed/rejected.
- Confirming a proof records the payment against the ledger/invoice.

**Payment processors (Paystack + Flutterwave):**
Processor integrations exist in `convex/paystack.ts` and `convex/payments.ts` for card/USSD rails (activating). Recorded payments carry `processor`, `reference`, and an **idempotency key** — double-submits and webhook replays cannot double-credit a ledger (see the `by_idempotency` index on `ledger_entries`).

**Ledger writes:** every confirmed payment writes a real `ledger_entries` row atomically with the invoice/payment/tenancy updates — single-transaction integrity (no "payment recorded but ledger empty" states).

---

## 4. Receipts

Every confirmed payment can generate a receipt (`receiptDetail` view):
- Sequential receipt ID per firm
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
| No unreviewed automated billing | Retainer outbox requires explicit admin approval |
| Auditability | Soft-delete + `deletedAt`/`deletedBy` on invoices and payments |
