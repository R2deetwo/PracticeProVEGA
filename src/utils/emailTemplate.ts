/**
 * Branded email HTML wrapper (shared by every outbound email the app
 * composes: Atrium ComposeModal, the legal ComposeEmailModal, and
 * useCommunications.handleSendEmail).
 *
 * Before this, the ComposeModal sent `<p style="font-family:sans-serif">…</p>`
 * — a bare paragraph with no firm identity. The recipient saw a message
 * from "PracticePro Systems" with no letterhead, no separator, nothing
 * that looked like it came from the firm they know. This wrapper gives
 * every email a consistent, professional shell.
 */

export interface EmailTemplateOptions {
  /** The sending firm's display name (email "From" name). */
  firmName?: string;
  /** Message body — plain text (newlines → <br/>) or existing HTML. */
  body: string;
  /** Optional one-line note under the signature (e.g. portal link). */
  footerNote?: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const bodyToHtml = (body: string) => {
  const trimmed = body.trim();
  if (trimmed.startsWith('<')) return trimmed; // caller passed HTML
  return `<p style="margin:0 0 16px 0;color:#1f2937;font-size:15px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(trimmed)}</p>`;
};

export function buildEmailHtml({ firmName, body, footerNote }: EmailTemplateOptions): string {
  const firm = (firmName || '').trim();
  return [
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px 16px;">',
    '  <div style="border-bottom:2px solid #0f766e;padding-bottom:12px;margin-bottom:20px;">',
    `    <span style="font-size:16px;font-weight:700;color:#0f766e;letter-spacing:0.2px;">${escapeHtml(firm || 'PracticePro')}</span>`,
    '  </div>',
    `  <div style="padding:0 2px;">${bodyToHtml(body)}</div>`,
    footerNote
      ? `  <p style="margin:20px 0 0 0;padding:12px 14px;background:#f0fdfa;border:1px solid #ccfbf1;border-radius:8px;font-size:13px;color:#134e4a;line-height:1.6;">${escapeHtml(footerNote)}</p>`
      : '',
    '  <p style="margin:24px 0 0 0;border-top:1px solid #e5e7eb;padding-top:12px;font-size:11px;color:#9ca3af;">',
    `    Sent via PracticePro${firm ? ` on behalf of ${escapeHtml(firm)}` : ''}.`,
    '  </p>',
    '</div>',
  ].filter(Boolean).join('\n');
}
