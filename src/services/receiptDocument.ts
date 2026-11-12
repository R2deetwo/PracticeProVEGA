/**
 * receiptDocument.ts — the ONE receipt document contract (UX-37).
 *
 * Three issuers used to produce three visually different receipts for the
 * same money event: the rent-collection PDF (reportGenerator), the Service
 * Charge drawer's email/PDF (emailDelivery), and the ledger print window
 * (document.write in LedgerManager — a monospace outlier that looked like a
 * different product). This module is the shared contract they all render
 * from: one heading, one "Receipt No" presentation, one row grammar
 * (label left / value right, hairline separators), one amount block, one
 * issuer footer. The visual family follows the SC drawer's emerald grammar;
 * per-product flavor stays where it already exists (ADR-0005) — what is
 * unified is the CONTRACT, so a recipient can reconcile any receipt from
 * any path.
 */

/** The one heading every receipt carries. */
export const RECEIPT_HEADING = 'OFFICIAL PAYMENT RECEIPT';

/** The one issuer footer line every receipt carries. */
export function receiptFooterLine(firmLegalName: string, signerBlock?: string): string {
    return signerBlock
        ? `This is an official receipt issued by ${firmLegalName} via PracticePro — ${signerBlock}.`
        : `This is an official receipt issued by ${firmLegalName} via PracticePro.`;
}

/** Escape user-originated values for HTML rendering (print windows). */
export function escapeReceiptText(v: unknown): string {
    return String(v ?? '').replace(/[&<>"']/g, ch =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string));
}

/** Naira in text form safe for every renderer. */
export function receiptAmountText(n: number): string {
    return `NGN ${Math.round(Number(n) || 0).toLocaleString('en-NG')}`;
}

export interface ReceiptDocumentInput {
    /** Firm legal name (falls back to display name). */
    firmLegalName: string;
    /** The receipt's number in its issuing regime (server receipt number, or the ledger tx hash). */
    receiptNumber: string;
    /** What kind of receipt this is, e.g. "Rent Receipt" / "Service Charge Receipt". */
    kindLabel?: string;
    /** Ordered label/value rows — same grammar as the email + portal preview. */
    rows: Array<[string, string]>;
    /** The one number that must be unmissable. */
    amount: number;
    amountLabel?: string;
    /** Optional immutability/audit anchor shown under the amount. */
    immutabilityNote?: string;
    signerBlock?: string;
    issuedOn?: string;
}

/**
 * Canonical receipt layout as standalone HTML (for print windows and email
 * preheader usage). Mirrors the SC drawer PDF row-for-row.
 */
export function buildReceiptDocumentHtml(input: ReceiptDocumentInput): string {
    const esc = escapeReceiptText;
    const legal = esc(input.firmLegalName || 'PracticePro');
    const amountLabel = esc(input.amountLabel || 'Amount Paid');
    const rowsHtml = input.rows
        .map(([label, value]) => {
            const v = value === '' || value == null ? '—' : esc(value);
            return `<tr><td class="lbl">${esc(label)}</td><td class="val">${v}</td></tr>`;
        })
        .join('');
    const issuedOn = input.issuedOn || new Date().toISOString().split('T')[0];
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Receipt ${esc(input.receiptNumber)}</title>
<style>
body{font-family:'Segoe UI',Helvetica,Arial,sans-serif;background:#fff;margin:0;padding:48px 24px;}
.sheet{max-width:520px;margin:0 auto;}
.firm{font-size:20px;font-weight:800;color:#059669;text-align:center;margin-bottom:4px;}
.kind{font-size:10px;letter-spacing:.12em;color:#64748b;text-align:center;text-transform:uppercase;font-weight:700;}
.rno{font-size:10px;color:#64748b;text-align:center;margin-top:2px;}
.rule{width:86px;height:3px;background:#10b981;border-radius:2px;margin:12px auto 20px auto;}
table{width:100%;border-collapse:collapse}
td{padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px}
.lbl{color:#64748b;font-weight:600;width:44%}
.val{color:#1e293b;font-weight:700;text-align:right}
.amount{background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;margin:20px 0 12px 0}
.amount .cap{font-size:11px;color:#10b981;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
.amount .num{font-size:24px;font-weight:800;color:#059669;margin-top:2px}
.immut{font-size:11px;color:#94a3b8;text-align:center;margin-top:8px}
.foot{font-size:10px;color:#94a3b8;text-align:center;margin-top:28px;line-height:1.6}
</style></head>
<body><div class="sheet">
<div class="firm">${legal}</div>
<div class="kind">${esc(input.kindLabel ? `${input.kindLabel} — ` : '')}${RECEIPT_HEADING}</div>
<div class="rno">Receipt No: ${esc(input.receiptNumber)}</div>
<div class="rule"></div>
<table>${rowsHtml}</table>
<div class="amount"><div class="cap">${amountLabel}</div><div class="num">${esc(receiptAmountText(input.amount))}</div></div>
${input.immutabilityNote ? `<div class="immut">${esc(input.immutabilityNote)}</div>` : ''}
<div class="foot">${esc(receiptFooterLine(input.firmLegalName, input.signerBlock))}<br/>Issued on ${esc(issuedOn)}</div>
</div></body></html>`;
}
