/**
 * whatsappShare — the "next best thing" after the WhatsApp API integration
 * was retired (2026-09-14).
 *
 * CONTEXT: PracticePro no longer connects to the Chakra/Meta WhatsApp
 * Business API. Automated flows (Sentry receipts, service-charge reminders,
 * late notices) now go email-first. But WhatsApp remains how Nigerian
 * landlords and tenants actually talk — so every place that USED to
 * auto-send a WhatsApp message now offers a one-tap HANDOFF instead:
 * the message (with any codes / links / references embedded) is composed
 * by the app, and wa.me opens WhatsApp with it prefilled to the right
 * number. The user reviews and hits send. No API, no quota, no templates.
 *
 * These are pure URL builders — safe for tests, SSR, and webviews.
 */

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
 * with just the text (the user picks the chat).
 */
export function whatsappShareUrl(
  phone: string | null | undefined,
  text: string
): string {
  const encoded = encodeURIComponent(text || '');
  const normalized = normalizePhoneForWa(phone);
  return normalized
    ? `https://wa.me/${normalized}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

/**
 * Same link, but for the PRACTICEPRO SUPPORT chat (founder-facing FABs,
 * "message us" buttons). Uses the published support number; falls back to
 * a text-only share so the user can still send the question anywhere.
 */
export const PRACTICEPRO_SUPPORT_PHONE = '2340000000000'; // placeholder — set the real support line
export function whatsappSupportUrl(question?: string): string {
  const text = question
    ? `Hello PracticePro team — ${question}`
    : 'Hello PracticePro team — I have a question about my account.';
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
