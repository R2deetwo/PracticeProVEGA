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

/** The platform's WhatsApp Business line (+234 816 312 2497) — the same
 * number the server-side automation sends from. Support chats and
 * "message us" handoffs deep-link here. */
export const PRACTICEPRO_SUPPORT_PHONE = '2348163122497';

/**
 * Normalise a stored phone number to wa.me's expected E.164-ish digits.
 * Handles the shapes actually stored in the DB:
 *   "+2348012345678" → "2348012345678"
 *   "2348012345678"  → "2348012345678"
 *   "08012345678"    → "2348012345678"   (Nigerian local format, leading 0)
 *   "8012345678"     → "2348012345678"   (Nigerian local without leading 0)
 * Non-NG locals keep their digits as-is (wa.me resolves them relative to
 * nothing — the user can fix the prefix in WhatsApp before sending).
 */
export function normalizePhoneForWa(rawPhone: string | null | undefined): string {
  const digits = String(rawPhone || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('234')) return digits;
  // Nigerian local formats: 080… (11 digits) or 80… (10 digits)
  if (/^0\d{10}$/.test(digits)) return '234' + digits.slice(1);
  if (/^[789]\d{9}$/.test(digits)) return '234' + digits;
  return digits;
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
