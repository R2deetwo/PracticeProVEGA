/**
 * emailBranding — the shared footer for every automated tenant/client email.
 *
 * USER DIRECTIVE (2026-09-14):
 *   1. Automated emails must say they are automated.
 *   2. Recipients must be able to UNSUBSCRIBE from the bottom of the email.
 *   3. "Powered by PracticePro Systems" must sit at the bottom — neat and
 *      non-obtrusive, so the firm's own branding stays the hero.
 *
 * This module is server-side (used by the dispatch processor and the
 * automation engine) and mirrors the client-side buildEmailHtml letterhead
 * so manual and automated sends look like one family.
 *
 * Unsubscribe links point at the Convex HTTP route `/unsubscribe?t=<token>`
 * (see convex/http.ts) — a tokenized, authenticated-by-possession opt-out
 * that works without a portal login. The token is derived deterministically
 * from (firmId + contactKey) so the SAME link can be regenerated for every
 * email without storing one row per send.
 */

export const CONVEX_HTTP_BASE = process.env.CONVEX_SITE_URL || "https://gregarious-malamute-537.convex.cloud";

// Code-level pepper: unsubscribe is a low-risk capability (worst case an
// attacker unsubscribes someone from reminders), so a deterministic keyed
// signature is proportionate — no stored state, verifiable on click.
const TOKEN_PEPPER = "pp-unsub-v1-537malamute";

function fnvHex(input: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h1 = (h1 ^ input.charCodeAt(i)) * 0x01000193;
    h1 >>>= 0;
    h2 = (h2 + input.charCodeAt(i) * (i + 7)) >>> 0;
    h1 = (h1 ^ ((h2 >>> 8) & 0xff)) * 0x01000193;
    h1 >>>= 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

function b64urlEncode(s: string): string {
  // UTF--safe base64url without Buffer (default Convex runtime safe).
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.codePointAt(i)!;
    if (c > 0xffff) i++;
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/**
 * Self-resolving unsubscribe token: `base64url(firmId|contactKey).sig`.
 * The HTTP handler decodes the payload, re-verifies the signature, and
 * records the opt-out — no row needs to exist before the click.
 */
export function unsubscribeToken(firmId: string, contactKey: string): string {
  const payload = b64urlEncode(`${firmId}|${contactKey.toLowerCase()}`);
  return `${payload}.${fnvHex(TOKEN_PEPPER + payload).slice(0, 12)}`;
}

/** Reverse + verify a token. null when tampered. */
export function decodeUnsubscribeToken(token: string): { firmId: string; contactKey: string } | null {
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (fnvHex(TOKEN_PEPPER + payload).slice(0, 12) !== sig) return null;
  try {
    const raw = b64urlDecode(payload);
    const sep = raw.indexOf("|");
    if (sep <= 0) return null;
    return { firmId: raw.slice(0, sep), contactKey: raw.slice(sep + 1).toLowerCase() };
  } catch {
    return null;
  }
}

export function unsubscribeUrl(firmId: string, contactKey: string): string {
  return `${CONVEX_HTTP_BASE}/unsubscribe?t=${encodeURIComponent(unsubscribeToken(firmId, contactKey))}`;
}

/** Escape raw text for safe HTML interpolation. */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const GRAY = "#94a3b8";
const TEAL = "#0d9488";

export interface AutomatedEmailArgs {
  firmId: string;
  firmName: string;
  /** Plain-text body (pre-line whitespace preserved) — or pre-built HTML. */
  body: string;
  /** Contact key for the unsubscribe link (tenant email/phone). */
  contactKey?: string | null;
  /** Set false only for transactional one-offs (receipts) — footer still shows branding + automated notice, but no unsubscribe link. */
  includeUnsubscribe?: boolean;
}

/**
 * Wrap an automated message body in the branded shell with the footer:
 *   — automated notice ("This message was sent automatically…")
 *   — unsubscribe link (when the recipient can opt out)
 *   — "Powered by PracticePro Systems" in small grey type
 */
export function buildAutomatedEmailHtml(args: AutomatedEmailArgs): string {
  const firm = esc(args.firmName || "your property manager");
  const isHtml = /<\/?(div|p|br|span|table|h\d)\b/i.test(args.body);
  const bodyHtml = isHtml ? args.body : `<p style="white-space:pre-line;">${esc(args.body)}</p>`;
  const unsub = args.includeUnsubscribe !== false && args.contactKey
    ? `<a href="${unsubscribeUrl(args.firmId, args.contactKey)}" style="color:${GRAY};text-decoration:underline;">Unsubscribe from these notices</a>`
    : `<span style="color:${GRAY};">You are receiving this because it concerns your tenancy or account.</span>`;

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px 20px;">
  <div style="border-bottom:3px solid ${TEAL};padding-bottom:12px;margin-bottom:20px;">
    <span style="font-size:18px;font-weight:700;color:#0f172a;">${firm}</span>
  </div>
  ${bodyHtml}
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;line-height:1.7;color:${GRAY};">
    <div>This is an automated message sent by ${firm} via PracticePro. If it reached you in error, or you are not the intended recipient, please disregard it${args.contactKey ? " or unsubscribe below" : ""}.</div>
    <div style="margin-top:4px;">${unsub}</div>
    <div style="margin-top:8px;">Powered by <span style="font-weight:600;color:#64748b;">PracticePro Systems</span></div>
  </div>
</div>`.trim();
}

/** WhatsApp footer — the non-email twin (no link, same disclosure). */
export function buildAutomatedWhatsAppSuffix(firmName: string): string {
  return `\n\n— Automated notice from ${firmName} via PracticePro`;
}
