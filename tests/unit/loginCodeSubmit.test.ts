/**
 * R17 hotfix regression suite — the "dead-end code entry" incident
 * (2026-09-05).
 *
 * Round 16 closed the trust-on-first-use hole: accounts with no stored
 * password must CLAIM one via an emailed 6-digit code (the
 * `requiresInitialPassword` TOFU flow, convex/myFunctions.ts ~L1594).
 * The Login component followed for the code INPUT (gated on
 * `requiresMfa || requiresInitialPassword`) but NOT for the submit BUTTON
 * (gated on `requiresMfa` only). In that state the form rendered email +
 * code inputs with NO submit button — and per the HTML spec, implicit
 * submission (the Enter key) does nothing in a form with no submit button
 * and more than one submission-blocking field. A user could receive the
 * code, type the code, and be stranded with no way to submit it.
 *
 * The component suite runs in a node environment (no DOM rendering), so
 * these tests pin the structural invariants on the component source
 * instead: whatever renders a code-entry input MUST also render an
 * explicit submit affordance, for BOTH code states, and the escape hatch
 * must reset BOTH flags.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const LOGIN_SOURCE = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../src/components/auth/Login.tsx"
  ),
  "utf8"
);

describe("Login code-entry states always expose a submit affordance", () => {
  it("renders the code input for BOTH code states (MFA + initial-password)", () => {
    // The ternary gating the code-entry block (input side of the incident).
    expect(LOGIN_SOURCE).toMatch(/\(requiresMfa \|\| requiresInitialPassword\) \?/);
  });

  it("renders the submit button for BOTH code states — the incident fix", () => {
    // The incident: input gated on (requiresMfa || requiresInitialPassword)
    // but the button only on `requiresMfa` — a dead end with no button and
    // no implicit Enter submission.
    expect(LOGIN_SOURCE).toMatch(
      /\(requiresMfa \|\| requiresInitialPassword\) && \(\s*<button\s+type="submit"/
    );
  });

  it("submit button labels the password-claim flow honestly", () => {
    // TOFU state sets a password on first claim; MFA state signs in.
    expect(LOGIN_SOURCE).toMatch(/'Verify & Set Password'/);
    expect(LOGIN_SOURCE).toMatch(/'Verify & Sign In'/);
  });

  it("the code input advertises one-time-code autofill + numeric keypad", () => {
    const inputBlock = LOGIN_SOURCE.match(/id="mfaCode"[\s\S]{0,500}?maxLength=\{6\}/);
    expect(inputBlock).not.toBeNull();
    expect(inputBlock![0]).toContain('autoComplete="one-time-code"');
    expect(inputBlock![0]).toContain('inputMode="numeric"');
  });

  it("'Use a different account' resets BOTH code states", () => {
    expect(LOGIN_SOURCE).toMatch(
      /setRequiresMfa\(false\);\s*setRequiresInitialPassword\(false\);\s*setMCode\(''\)/
    );
  });

  it("sign-up link is hidden in BOTH code-entry states", () => {
    expect(LOGIN_SOURCE).toMatch(
      /!requiresMfa && !requiresInitialPassword && !isRecovering/
    );
  });

  it("biometric blocks are hidden in BOTH code-entry states (every occurrence)", () => {
    const total = (LOGIN_SOURCE.match(/\{showBiometric &&/g) ?? []).length;
    const gated =
      (LOGIN_SOURCE.match(
        /\{showBiometric && !requiresMfa && !requiresInitialPassword/g
      ) ?? []).length;
    expect(total).toBeGreaterThan(0);
    expect(gated).toBe(total);
  });
});

describe("Login code entry — task 20 (the 'both codes failed' incident)", () => {
  it("the code input strips non-digits before they reach state", () => {
    // Paste artifacts ("640-209", " 640209 ") must never reach the server.
    expect(LOGIN_SOURCE).toMatch(
      /setMCode\(e\.target\.value\.replace\(\/\\D\/g, ''\)\.slice\(0, 6\)\)/
    );
  });

  it("renders a Resend code button in BOTH code-entry states", () => {
    expect(LOGIN_SOURCE).toMatch(/handleResendCode/);
    expect(LOGIN_SOURCE).toMatch(
      /\(requiresMfa \|\| requiresInitialPassword\) && \(\s*<button[\s\S]{0,400}?Resend code/
    );
  });

  it("resend re-submits the password WITHOUT a code (fresh mint, old codes die)", () => {
    const resendFn = LOGIN_SOURCE.match(
      /const handleResendCode = async \(\) => \{[\s\S]{0,1200}?\};/
    );
    expect(resendFn).not.toBeNull();
    expect(resendFn![0]).toMatch(/await login\(email, password, undefined, rememberMe\)/);
    // And it surfaces the new codeHint so the user can match the newest email.
    expect(resendFn![0]).toMatch(/setCodeHint/);
  });

  it("shows the backend's codeHint under the code input", () => {
    expect(LOGIN_SOURCE).toMatch(/Your new code starts with/);
    expect(LOGIN_SOURCE).toMatch(/setCodeHint\(\(result as any\)\.codeHint/);
  });
});
