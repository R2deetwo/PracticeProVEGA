/**
 * ngPhone — canonical Nigerian phone normalisation (client twin).
 *
 * Same rules as convex/ngPhone.ts (the server module cannot be imported
 * from the browser bundle — the twins are pinned to agree by
 * tests/unit/ngPhone.test.ts). Every Sentry Pass / WhatsApp surface on
 * the client normalises through here BEFORE building a wa.me link or
 * showing the live "0801… → +234 801 234 5678" hint.
 */

export function digitsOnly(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\D/g, '');
}

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

export function isValidNgPhone(raw: string | null | undefined): boolean {
  return normaliseNgPhone(raw).length > 0;
}

export function formatNgPhoneE164(e164: string): string {
  if (/^234\d{10}$/.test(e164)) {
    const n = e164.slice(3);
    return `+234 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }
  return e164 ? `+${e164}` : '';
}
