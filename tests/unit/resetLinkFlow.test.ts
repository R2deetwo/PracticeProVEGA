/**
 * resetLinkFlow.test.ts — ONE-CLICK password reset contract (2026-09-14).
 *
 * USER CONTEXT: "can we just do it without the reset code? send me where I
 * can reset the password without the difficulty please." Recovery emails
 * now lead with a "Set a new password now" button that opens
 * /reset-password?token=<48-hex> — the user types ONLY the new password.
 *
 * WHY SOURCE-SCAN: the mint sites and the completion action need the Convex
 * runtime (db + scheduler + ctx.runAction), so we pin the CONTRACT on the
 * source (house pattern from vmsEntitlement.test.ts): if someone deletes a
 * mint site, drops the hashed-storage, clears the single-use wipe, or
 * removes the primary CTA from the emails, this file fails CI.
 *
 * PINS (one per user-visible promise):
 *   1. ALL THREE mint sites (app, founder, portal) stamp BOTH the recovery
 *      code fields AND resetTokenHash + resetTokenIssuedAt.
 *   2. Only sha256(token) is stored (a DB leak yields no usable links) and
 *      resolution goes through the by_reset_token INDEX (no table scan).
 *   3. completePasswordResetWithToken: single-use (hash cleared), 60-minute
 *      TTL, 8-char minimum, full security-field wipe on success, and
 *      GENERIC wrong-token errors (no account probing).
 *   4. Both recovery emails render the one-click "Set a new password now"
 *      button as the PRIMARY CTA and keep the code as fallback.
 *   5. /reset-password is a public route that renders ResetPasswordView —
 *      including for logged-in portal users (the email opens in any tab).
 *   6. resetTokenHash/resetTokenIssuedAt are STRIPPED from public getUser
 *      responses (same class of leak the recovery code had — Task 48).
 *   7. The page calls the action via useAction (actions can't run under
 *      useMutation — this exact bug shipped once already).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolve(here, '../../convex/myFunctions.ts'))
    ? resolve(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf8');

const MYFNS = 'convex/myFunctions.ts';
const SCHEMA = 'convex/schema.ts';
const STRIP = 'convex/userResolution.ts';
const APP = 'src/components/App.tsx';
const VIEW = 'src/components/auth/ResetPasswordView.tsx';

describe('one-click password reset (source-scanned contract)', () => {
    const fns = read(MYFNS);

    it('1. all three mint sites stamp the reset token (hash + issuance)', () => {
        for (const name of ['requestPasswordReset', 'sendFounderRecoveryCode', 'requestPortalPasswordReset']) {
            const idx = fns.indexOf(`export const ${name}`);
            expect(idx, `${name} exists`).toBeGreaterThan(-1);
            const body = fns.slice(idx, idx + 3000);
            expect(body, `${name} mints a random token`).toContain('randomHex(48)');
            expect(body, `${name} stores only the hash`).toContain('resetTokenHash: sha256Hex(resetToken)');
            expect(body, `${name} stamps issuance for the TTL`).toContain('resetTokenIssuedAt: Date.now()');
            expect(body, `${name} emails the one-click link`).toContain('reset-link round');
        }
    });

    it('2. resolution is an index seek on the hashed token (never a scan, never raw)', () => {
        const qIdx = fns.indexOf('export const getUserByResetTokenHash');
        expect(qIdx).toBeGreaterThan(-1);
        const qBody = fns.slice(qIdx, qIdx + 800);
        expect(qBody).toContain('withIndex("by_reset_token"');
        // The lookup value must be the HASH, and it is INTERNAL-only (never
        // exposed publicly to probe which tokens exist).
        expect(qBody).toContain('tokenHash');

        const schema = read(SCHEMA);
        expect(schema).toContain('resetTokenHash: nullableString');
        expect(schema).toContain('resetTokenIssuedAt: nullableNumber');
        expect(schema).toContain('.index("by_reset_token", ["resetTokenHash"])');
    });

    it('3. completion action: single-use, TTL, minimum, wipe, generic errors', () => {
        const aIdx = fns.indexOf('export const completePasswordResetWithToken');
        expect(aIdx).toBeGreaterThan(-1);
        const body = fns.slice(aIdx, aIdx + 4000);

        // Single-use: the hash is cleared on success so replayed links die.
        expect(body).toContain('resetTokenHash: null');
        // TTL mirrors the email promise (60 minutes).
        expect(body).toContain('60 * 60 * 1000');
        // Password floor matches the page's 8-char hint.
        expect(body).toContain('length < 8');
        // A reset proves account control — retire every pending code/lockout.
        expect(body).toContain('recoveryCode: null');
        expect(body).toContain('mfaCode: null');
        expect(body).toContain('lockedUntil: null');
        // Wrong-token responses are deliberately generic (no probing).
        expect(body).toContain('invalid or has already been used');
    });

    it('4. both recovery emails lead with the one-click button (code = fallback)', () => {
        for (const name of ['sendRecoveryEmail', 'sendPortalRecoveryEmail']) {
            const idx = fns.indexOf(`export const ${name}`);
            expect(idx, `${name} exists`).toBeGreaterThan(-1);
            const body = fns.slice(idx, idx + 6000);
            expect(body, `${name} accepts a resetLink`).toContain('resetLink: v.optional(v.string())');
            expect(body, `${name} primary CTA`).toContain('Set a new password now');
            expect(body, `${name} promises no code needed`).toContain('No code needed');
            expect(body, `${name} states the 60-minute window`).toContain('60 minutes');
        }
    });

    it('5. /reset-password is public and renders the reset view', () => {
        const app = read(APP);
        expect(app).toContain("'/reset-password'");
        expect(app).toContain('ResetPasswordView');
        // The logged-in-portal-user redirect exception: the email link opens
        // in whatever browser/tab the resident has — bouncing them to the
        // portal before the page renders would make the link a no-op.
        const landingIdx = app.indexOf('landingPaths = [');
        const landingSlice = app.slice(landingIdx, landingIdx + 400);
        expect(landingSlice).toContain("'/reset-password'");
    });

    it('6. public getUser strips the token fields (no reset-link leak)', () => {
        const strip = read(STRIP);
        const arrIdx = strip.indexOf('export const AUTH_STRIP_FIELDS');
        const arr = strip.slice(arrIdx, arrIdx + 700);
        expect(arr).toContain('"resetTokenHash"');
        expect(arr).toContain('"resetTokenIssuedAt"');
    });

    it('7. the page calls the ACTION via useAction (not useMutation)', () => {
        const view = read(VIEW);
        expect(view).toContain("import { useAction } from 'convex/react'");
        expect(view).toContain('useAction(api.myFunctions.completePasswordResetWithToken)');
        expect(view).not.toContain('useMutation(api.myFunctions.completePasswordResetWithToken)');
        // The page asks for exactly ONE thing: the new password.
        expect(view).toContain('Set a new password — no code needed');
        expect(view).toContain('You will not need to enter any code.');
    });
});
