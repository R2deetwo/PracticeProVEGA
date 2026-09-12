/**
 * emailDelivery — the email channel for what WhatsApp was supposed to do.
 *
 * CONTEXT (2026-09-12): Chakra's WhatsApp gateway is billing-gated (402 —
 * "Template Message sending is disabled") and the firm is NOT using
 * WhatsApp for now. Meanwhile the resident-facing duties — receipts,
 * service-charge reminders, rent reminders — keep running. This module
 * gives those flows ONE shared set of email helpers (Brevo, via the
 * existing convex/communications.sendEmail action) on top of the
 * firm-branded envelope (src/utils/emailTemplate.ts) — every surface
 * speaks the same email language instead of each rolling its own.
 *
 * DELIVERY RULE: email is BEST-EFFORT and SECONDARY to the resident's
 * portal for receipts — an email failure must never mark a receipt
 * "failed" that was already delivered to the portal.
 */

import { buildEmailHtml } from './emailTemplate';
import type { AutomationChannel } from '../types';

/**
 * While WhatsApp is paused, new outbound composes default to EMAIL when
 * the recipient has an address on file — WhatsApp only when email is
 * missing (or when the caller explicitly prefills a channel).
 */
export function resolvePreferredChannel(args: {
    tenantEmail?: string | null;
    tenantPhone?: string | null;
    /** Explicit prefill wins (user picked a channel upstream). */
    prefillChannel?: string | null;
}): AutomationChannel {
    if (args.prefillChannel) return args.prefillChannel as AutomationChannel;
    const email = (args.tenantEmail || '').trim();
    if (email) return 'email';
    return 'whatsapp';
}

/** Escape plain text for safe embedding inside an HTML email body. */
export function escapeHtml(text: string): string {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ─── Receipt email ──────────────────────────────────────────────────────────
export interface ReceiptEmailInput {
    firmName: string;
    receiptNumber: string;
    tenantName: string;
    unitName: string;
    chargeTypeLabel: string;
    billingPeriod: string;      // "September 2026" or the advance range label
    amountPaid: number;
    paymentDate: string;        // ISO yyyy-mm-dd
    settlementMethod: string;
    coverageNote?: string;      // "Sep 2026 – Feb 2027 (6 months)"
}

const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`;

/**
 * The receipt as a standalone HTML email — the printable receipt's detail
 * rows wrapped in the firm-branded envelope, so the resident sees one
 * document shape in the portal, in print and in their inbox.
 */
export function buildReceiptEmailHtml(input: ReceiptEmailInput): string {
    const rows: Array<[string, string]> = [
        ['Receipt No', escapeHtml(input.receiptNumber)],
        ['Resident', escapeHtml(input.tenantName)],
        ['Unit', escapeHtml(input.unitName)],
        ['Charge Type', escapeHtml(input.chargeTypeLabel)],
        ['Billing Period', escapeHtml(input.billingPeriod)],
    ];
    if (input.coverageNote) rows.push(['Covers', escapeHtml(input.coverageNote)]);
    rows.push(['Payment Date', escapeHtml(input.paymentDate)]);
    rows.push(['Settlement', escapeHtml(input.settlementMethod)]);

    const body = [
        '<div style="max-width:520px;">',
        '<p style="margin:0 0 16px 0;color:#1f2937;font-size:15px;line-height:1.7;">Your payment receipt is below — a copy is also available in your resident portal.</p>',
        '<div style="margin-bottom:20px;">',
        rows.map(([label, value]) =>
            `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;">` +
            `<span style="font-size:13px;color:#64748b;font-weight:600;">${label}</span>` +
            `<span style="font-size:13px;color:#1e293b;font-weight:700;">${value}</span></div>`).join(''),
        '</div>',
        '<div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0;text-align:center;">',
        '<div style="font-size:12px;color:#10b981;font-weight:700;text-transform:uppercase;">Amount Paid</div>',
        `<div style="font-size:24px;font-weight:800;color:#10b981;">${naira(input.amountPaid)}</div>`,
        '</div>',
        '</div>',
    ].join('\n');

    return buildEmailHtml({
        firmName: input.firmName,
        body,
        footerNote: 'This is an official receipt issued by your property manager.',
    });
}

/** Email subject for a receipt — matches the portal message subject. */
export function buildReceiptEmailSubject(input: {
    receiptNumber: string;
    chargeTypeLabel: string;
    billingPeriod: string;
}): string {
    return `Receipt ${input.receiptNumber} — ${input.chargeTypeLabel} (${input.billingPeriod})`;
}
