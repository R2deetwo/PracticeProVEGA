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
import { jsPDF } from 'jspdf';
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

// ─── Portal link — "bring people to the portal" ─────────────────────────────
/**
 * The resident's OWN portal entry point, for emails (user feedback
 * 2026-09-12: "now could we have the person be able to see a link that
 * takes them to their portal.... THEIR portal. this way we can bring
 * people to the portal to look at other things that may concern them").
 *
 * Routes through the resident login with the email PREFILLED — after
 * sign-in the app lands them on their own token-keyed portal dashboard
 * (/portal/tenant/<their-token>). The login page is a public path (no
 * auth-gate bounce), so the link works from any inbox on any device even
 * when no session exists yet.
 */
export function buildTenantPortalLoginUrl(email: string, origin?: string): string {
    const base = (origin ?? (typeof window !== 'undefined' ? window.location.origin : ''))
        .replace(/\/+$/, '');
    const enc = encodeURIComponent((email || '').trim().toLowerCase());
    return `${base}/portal/tenant/login${enc ? `?email=${enc}` : ''}`;
}

/** A prominent, email-client-safe portal button block. */
export function buildPortalButtonHtml(url: string, label = 'Open your resident portal'): string {
    const safe = escapeHtml(url);
    return [
        `<a href="${safe}" style="display:block;margin:20px 0 8px 0;padding:14px 18px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:800;font-size:14px;text-align:center;letter-spacing:0.2px;">`,
        `${escapeHtml(label)}`,
        `</a>`,
        `<p style="margin:0 0 8px 0;font-size:12px;color:#64748b;line-height:1.6;">Your payment history, receipts, notices and service requests — everything about your tenancy in one place.</p>`,
    ].join('');
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
    /** True when the email carries the receipt as a PDF attachment. */
    pdfAttached?: boolean;
    /** The resident's portal entry link (button under the amount). */
    portalUrl?: string;
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

    const intro = input.pdfAttached
        ? 'Your official receipt is attached as a PDF — the same document you will find in your resident portal. Keep it for your records.'
        : 'Your payment receipt is below — a copy is also available in your resident portal.';

    const body = [
        '<div style="max-width:520px;">',
        `<p style="margin:0 0 16px 0;color:#1f2937;font-size:15px;line-height:1.7;">${intro}</p>`,
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
        input.portalUrl ? buildPortalButtonHtml(input.portalUrl) : '',
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

// ─── Receipt PDF attachment ──────────────────────────────────────────────────
/**
 * The receipt as a real PDF document (user feedback 2026-09-12: "should we
 * not make it a pdf as well so that what they see in the email attachment
 * is what they get from their portal so that there is no confusion as to
 * whether the email itself is the receipt or an actual document").
 *
 * Same field set and order as the email body / portal receipt preview, so
 * the PDF, the email and the portal are ONE document shape. Currency is
 * rendered "NGN" because the PDF core fonts carry no naira glyph — the
 * meaning is identical, and the glyph lives in every HTML surface.
 *
 * Returns RAW base64 (no data: prefix) — exactly what Brevo's
 * `attachment.content` expects and what communications.sendEmail accepts.
 */
export function buildReceiptPdfBase64(input: ReceiptEmailInput): string {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    // Header — firm name + document kind, centred, emerald accent.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105);
    doc.text(input.firmName || 'PracticePro', 105, 28, { align: 'center' });

    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text('OFFICIAL PAYMENT RECEIPT', 105, 35, { align: 'center' });
    doc.text(`Receipt No: ${input.receiptNumber}`, 105, 40, { align: 'center' });
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.7);
    doc.line(62, 44, 148, 44);

    // Detail rows — identical order to the email + portal preview.
    const rows: Array<[string, string]> = [
        ['Resident', input.tenantName],
        ['Unit', input.unitName],
        ['Charge Type', input.chargeTypeLabel],
        ['Billing Period', input.billingPeriod],
    ];
    if (input.coverageNote) rows.push(['Covers', input.coverageNote]);
    rows.push(['Payment Date', input.paymentDate]);
    rows.push(['Settlement', input.settlementMethod]);

    let y = 56;
    for (const [label, value] of rows) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(100, 116, 139);
        doc.text(label, 25, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(String(value), 185, y, { align: 'right' });
        doc.setDrawColor(241, 245, 249);
        doc.setLineWidth(0.2);
        doc.line(25, y + 2, 185, y + 2);
        y += 10;
    }

    // Amount block — the one number that must be unmissable.
    y += 5;
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(55, y, 100, 22, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(16, 185, 129);
    doc.text('AMOUNT PAID', 105, y + 7.5, { align: 'center' });
    doc.setFontSize(15);
    doc.setTextColor(5, 150, 105);
    doc.text(nairaPdf(input.amountPaid), 105, y + 16.5, { align: 'center' });

    // Footer — issuer + issue date.
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`This is an official receipt issued by ${input.firmName || 'PracticePro'} via PracticePro.`, 105, 282, { align: 'center' });
    doc.text(`Issued on ${new Date().toISOString().split('T')[0]}`, 105, 287, { align: 'center' });

    return arrayBufferToBase64(doc.output('arraybuffer'));
}

/** Naira in PDF-safe text — core fonts carry no naira glyph. */
function nairaPdf(n: number): string {
    return `NGN ${Math.round(n).toLocaleString('en-NG')}`;
}

/** Chunked ArrayBuffer → raw base64 (works in browser and Node). */
function arrayBufferToBase64(buf: ArrayBuffer): string {
    const bytes = new Uint8Array(buf);
    const CHUNK = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    if (typeof btoa === 'function') return btoa(binary);
    // Node fallback (vitest / non-DOM runtimes)
    return Buffer.from(binary, 'binary').toString('base64');
}

/** File name for the receipt attachment — stable + receipt-numbered. */
export function receiptPdfFileName(receiptNumber: string): string {
    const safe = String(receiptNumber || 'receipt').replace(/[^A-Za-z0-9_-]+/g, '-');
    return `Receipt-${safe}.pdf`;
}
