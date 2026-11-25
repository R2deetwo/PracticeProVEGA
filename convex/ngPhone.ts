/**
 * ngPhone — canonical Nigerian phone normalisation (server twin).
 * ═══════════════════════════════════════════════════════════════════════
 *
 * TASK 94 (2026-11-25): one canonical normaliser for every place a
 * Nigerian phone number moves through the Sentry Pass / WhatsApp chain:
 *
 *   raw input (resident form, gate, admin panel)
 *     → normaliseNgPhone() → E.164 DIGITS ("2348012345678")
 *     → Meta Cloud API (Chakra) sends exactly this form
 *     → wa.me deep links use exactly this form
 *
 * Handles every shape seen in real Nigerian data:
 *   "08012345678"  "07012345678"  "0812345678"  "0901234567"  "09123456789"
 *   "02012345678"  (Lagos-style 02x local)  "+2348012345678"  "2348012345678"
 *   "02348012345678" / "23408012345678"     (the double-prefix mistakes —
 *   a local number already carrying a country code) — repaired, never
 *   re-prefixed, so "234" is never appended twice.
 *
 * The client twin lives at src/utils/ngPhone.ts (same rules, importable
 * from the browser bundle; the Convex server module must not be imported
 * client-side). Both are pinned by tests/unit/ngPhone.test.ts.
 */

/** Strip everything that is not a digit. */
export function digitsOnly(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/\D/g, "");
}

/**
 * Normalise a Nigerian (or already-international) phone number to E.164
 * digits WITHOUT the leading "+" — the exact form Meta's Cloud API and
 * wa.me links both want. Returns "" when the input cannot be a phone.
 *
 * Rules, in order (all operate on digit-only input):
 *   1. strip leading zeros → local national number ("0801…" → "801…")
 *   2. double-prefix repair: "234" + local-with-leading-0 ("2340801…" →
 *      "234801…") — the classic paste-back mistake
 *   3. already E.164 with 234 and a 10-digit national part → as-is
 *   4. bare 10-digit national number (80x/70x/81x/90x/91x/20x…) → 234 +
 *   5. other ≥12-digit international forms (44…, 1…) → as-is
 *   6. anything else → "" (invalid — surfaced to the UI, never a silent
 *      wrong number)
 */
export function normaliseNgPhone(raw: string | null | undefined): string {
  let d = digitsOnly(raw);
  if (!d) return '';

  // Double-prefix repairs FIRST (before the startsWith checks below can
  // pass a "2340…" shape through untouched): someone typed +234 in front
  // of a local 0xx number, or the international dial-out prefix.
  //   "23408012345678"  (234 + 0 + 10-digit national)  -> "2348012345678"
  //   "02348012345678"  (0 + 234 + 10-digit national)  -> "2348012345678"
  //   "002348012345678" (00 + 234 + 10-digit national) -> "2348012345678"
  if (/^2340\d{10}$/.test(d)) {
    d = '234' + d.slice(4);
  } else if (/^0?234\d{10}$/.test(d)) {
    d = '234' + d.replace(/^0?234/, '');
  } else if (/^00234\d{10}$/.test(d)) {
    d = '234' + d.slice(5);
  }

  // Local Nigerian formats: ONE leading zero then the national number.
  // Strip only the FIRST zero — "02012345678" must keep its area digits.
  if (/^0\d{9,10}$/.test(d)) {
    d = d.slice(1);
  }

  // Nigerian E.164: 234 + 10 national digits.
  if (/^234\d{10}$/.test(d)) return d;

  // Bare national number (80x/70x/81x/90x/91x/20x… — 10 digits) -> prefix.
  if (/^[2-9]\d{9}$/.test(d)) return '234' + d;

  // Already another country's E.164 (11-15 digits, never leading 0) -> pass.
  if (/^[1-9]\d{10,14}$/.test(d)) return d;

  // Anything else (including 0-prefixed shapes that didn't repair) is not
  // a number Meta or wa.me will accept — surface as invalid, never a
  // silently wrong passthrough.
  return '';
}

/** True when normaliseNgPhone would produce a usable number. */
export function isValidNgPhone(raw: string | null | undefined): boolean {
  return normaliseNgPhone(raw).length > 0;
}

/**
 * Pretty display form of the E.164 digits for the live UI hint:
 *   "2348012345678" → "+234 801 234 5678"
 */
export function formatNgPhoneE164(e164: string): string {
  if (/^234\d{10}$/.test(e164)) {
    const n = e164.slice(3);
    return `+234 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }
  return e164 ? `+${e164}` : "";
}
