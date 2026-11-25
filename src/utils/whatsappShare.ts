/**
 * whatsappShare — the client-side WhatsApp handoff layer.
 *
 * CONTEXT (updated 2026-11-24): the platform's server-side WhatsApp
 * integration is LIVE again (Chakra/Meta Business API — template sends,
 * automated reminders, the whole Task 81/81.5 pipeline). This module is
 * the COMPLEMENT, not a replacement: every surface where the USER
 * initiates the send (invite links, status re-shares, colleague invites,
 * support chats) opens WhatsApp with the message prefilled via wa.me —
 * the user reviews it and hits send. No API quota, no template, no
 * 24h-window constraints, works on every device.
 *
 * These are pure URL builders — safe for tests, SSR, and webviews.
 */

import { normaliseNgPhone } from './ngPhone';

/** The platform's WhatsApp Business line (+234 816 312 2497) — the same
 * number the server-side automation sends from. Support chats and
 * "message us" handoffs deep-link here. */
export const PRACTICEPRO_SUPPORT_PHONE = '2348163122497';

/**
 * Normalise a stored phone number to wa.me's expected E.164-ish digits.
 * TASK 94 (2026-11-25): delegates to the canonical Nigerian normaliser
 * (src/utils/ngPhone — the client twin of convex/ngPhone). Handles every
 * real-world shape:
 *   "+2348012345678" → "2348012345678"
 *   "2348012345678"  → "2348012345678"
 *   "08012345678"    → "2348012345678"   (Nigerian local, leading 0)
 *   "8012345678"     → "2348012345678"   (local without leading 0)
 *   "02012345678"    → "2342012345678"   (02x local)
 *   "0234801234567" / "2340801234567" → repaired to "2348012345678"
 *   (the double-prefix mistakes — never prefixed twice)
 * Non-NG internationals keep their digits as-is.
 */
export function normalizePhoneForWa(rawPhone: string | null | undefined): string {
  return normaliseNgPhone(rawPhone);
}

/**
 * Does a stored recipient value look like a phone number (vs an email or
 * portal id)? Guards the wa.me handoff surfaces: opening wa.me/<digits>
 * for an EMAIL recipient builds a broken deep link (the email's digits
 * become a garbage phone). 10–15 digits and no '@' reads as a phone.
 */
export function looksLikePhone(raw: string | null | undefined): boolean {
  const s = String(raw || '').trim();
  if (!s || s.includes('@')) return false;
  const digits = s.replace(/[^\d]/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Build a wa.me deep link that opens a WhatsApp conversation with `phone`
 * and `text` prefilled. Without a phone it opens WhatsApp's share-picker
 * with just the text (the user picks the chat). Empty/absent text omits
 * the `?text=` parameter entirely (a trailing empty param renders a
 * broken-looking "empty message" prefilled chat on some WhatsApp builds).
 */
export function whatsappShareUrl(
  phone: string | null | undefined,
  text: string
): string {
  const normalized = normalizePhoneForWa(phone);
  const trimmed = (text || '').trim();
  if (!normalized) {
    return trimmed
      ? `https://wa.me/?text=${encodeURIComponent(trimmed)}`
      : 'https://wa.me/';
  }
  return trimmed
    ? `https://wa.me/${normalized}?text=${encodeURIComponent(trimmed)}`
    : `https://wa.me/${normalized}`;
}

/**
 * Direct chat deep link to the PracticePro support WhatsApp line — used
 * by "message us" / "chat with us" surfaces so a question lands in the
 * business inbox in one tap, with the question prefilled for review.
 */
export function whatsappSupportUrl(question?: string): string {
  const text = question
    ? `Hello PracticePro team — ${question}`
    : 'Hello PracticePro team — I have a question about my account.';
  return `https://wa.me/${PRACTICEPRO_SUPPORT_PHONE}?text=${encodeURIComponent(text)}`;
}

// Re-export the canonical normaliser for callers that already import from
// this module — one rule set, two import paths, zero drift.
export { normaliseNgPhone, isValidNgPhone, formatNgPhoneE164 } from './ngPhone';
