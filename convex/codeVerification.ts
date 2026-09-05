/**
 * Task 20 — shared login-code verification rules.
 *
 * WHY THIS MODULE EXISTS (the 2026-09-05 "both codes failed" incident):
 *
 *   1. The login code email and the SIGNUP verification email used the
 *      exact same template ("Your Verification Code"). Users with several
 *      such emails in their inbox could not tell which code was current,
 *      and typed stale ones → "Incorrect verification code".
 *   2. Every password attempt regenerated the code, silently invalidating
 *      all earlier emails — with delivery latency, the newest email often
 *      arrived AFTER the user had already typed the previous code.
 *   3. The email claimed "valid for 10 minutes" but no expiry was
 *      enforced anywhere.
 *   4. Wrong codes did not count toward the lockout (unthrottled
 *      brute-force, flagged in R16 and never closed).
 *   5. resetPassword left stale mfaCode on the record (observed live:
 *      a stored code on a record with a password and MFA disabled).
 *
 * The rules below are pure so they can be unit-tested in the node suite.
 */
import { v } from "convex/values";

/** How long an emailed login code stays valid. The email copy promises
 *  10 minutes; this makes it true. */
export const CODE_TTL_MS = 10 * 60 * 1000;

/** Normalizes user-typed code input before comparison: trims surrounding
 *  whitespace and strips anything that is not a digit (paste artifacts,
 *  zero-width chars, separator hyphens). Returns "" for nullish input. */
export function normalizeCode(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input).replace(/\D+/g, "").trim();
}

/** A code is expired when it has no issuance timestamp (pre-fix records —
 *  their age is unknowable, so treat as expired to force a fresh code) or
 *  when it is older than CODE_TTL_MS. */
export function isCodeExpired(
  issuedAt: number | null | undefined,
  now: number
): boolean {
  if (issuedAt === null || issuedAt === undefined) return true;
  // At exactly TTL the code is at its limit — treat as expired (strict).
  return now - issuedAt >= CODE_TTL_MS;
}

/** Two leading digits returned to the client alongside the "enter your
 *  code" prompt, so the user can match the prompt to the correct email.
 *  Only ever returned AFTER the password check has passed, and it leaks
 *  2 of 6 digits (1/100 of the space) — brute-forcing the remainder is
 *  capped by the 5-attempt lockout. */
export function codeHint(code: string | null | undefined): string | null {
  const normalized = normalizeCode(code);
  return normalized.length >= 4 ? normalized.slice(0, 2) : null;
}

/** Convex validator fragment for the optional issuance timestamp. */
export const mfaCodeIssuedAtField = v.optional(
  v.union(v.number(), v.null())
);

/** Error copy that tells the user WHICH failure happened and what to do
 *  next — the old copy ("Incorrect verification code") gave no direction. */
export function wrongCodeMessage(expired: boolean): string {
  return expired
    ? "That code has expired. Use “Resend code” to get a fresh one — it arrives in a new email, and older codes stop working."
    : "Incorrect code. Make sure you are using the code from the NEWEST email — codes from earlier attempts no longer work.";
}
