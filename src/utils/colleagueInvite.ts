/**
 * colleagueInvite — the understated colleague-invitation layer
 * (owner directive 2026-11-24: "Add tasteful, peer-appropriate sharing and
 * colleague-invitation hooks inside Vega so early users can easily bring
 * chambers colleagues or co-counsel onto the platform without any cheesy
 * or spammy marketing popups").
 *
 * The mechanism is the firm's existing Secret Access Code (INV-XXXX) —
 * the same code FirmSettings shows and the OnboardingWizard's "Join
 * Existing" step consumes. What was missing is the dignified HANDOFF:
 * a clean join link and a pre-written, professional WhatsApp message the
 * inviter reviews before sending. No banners, no popups — one quiet
 * "Invite Colleague" row in the workspace sidebar and a Share button on
 * the Team settings card.
 *
 * Pure builders — safe for tests and SSR.
 */
import { allowedPortalOrigin } from './portalOrigins';

/** sessionStorage key for a join code parked at signup and consumed by
 * the OnboardingWizard (mirrors the pp_migration_email parking pattern).
 * sessionStorage (not localStorage) so a stale code never survives a
 * fresh browser session. */
export const PENDING_INVITE_STORAGE_KEY = 'pp_pending_workspace_invite';

/** Accept the shapes a ?invite= param can carry (INV-1234, inv-1234,
 * 1234) and normalise to the canonical INV-XXXX the firms table stores.
 * The code component is digits-only (the firms table generates
 * "INV-" + 4 digits — alphanumerics let free-text garbage through). */
export function parseInviteCodeParam(param: string | null | undefined): string | null {
  const raw = String(param || '').trim().toUpperCase().replace(/^-/, '');
  if (!raw) return null;
  const digits = raw.replace(/^INV[-_\s]?/, '');
  if (!/^\d{3,8}$/.test(digits)) return null;
  return `INV-${digits}`;
}

/** The join link a colleague can click straight from a WhatsApp message:
 * the signup page with the invite code in the query string. Signup parks
 * it; the OnboardingWizard then opens on the "Join Existing" step with
 * the code prefilled. Origin flows through the portal allowlist so a
 * preview deployment hands out preview-correct links. */
export function colleagueInviteUrl(inviteCode: string, origin?: string | null): string {
  const code = parseInviteCodeParam(inviteCode);
  if (!code) return '';
  return `${allowedPortalOrigin(origin)}/signup?invite=${encodeURIComponent(code)}`;
}

/**
 * The pre-written WhatsApp message — dignified and peer-appropriate for
 * Nigerian legal practice: no exclamation marks, no discounts, no
 * marketing copy. The inviter's name signs it, so it reads as a note
 * from a colleague, not a campaign. The user reviews it in WhatsApp
 * before sending (the wa.me handoff never sends on its own).
 */
export function buildColleagueInviteText(opts: {
  firmName: string;
  inviterName: string;
  inviteCode: string;
  isLegal: boolean;
  origin?: string | null;
}): string {
  const url = colleagueInviteUrl(opts.inviteCode, opts.origin);
  const platform = opts.isLegal ? 'PracticePro Vega' : 'PracticePro Atrium';
  const capability = opts.isLegal
    ? 'matters, deadlines, court dates and drafting in one workspace'
    : 'rent, service charges, maintenance and residents in one place';
  const lines = [
    'Hello,',
    '',
    `We now run ${opts.firmName} on ${platform} — ${capability}. I would like you working in it with me.`,
    '',
    `Join the workspace here: ${url}`,
  ];
  if (opts.inviterName) {
    lines.push('', `— ${opts.inviterName}, ${opts.firmName}`);
  }
  return lines.join('\n');
}

/** Read the parked join code (OnboardingWizard / JoinFirmModal consume it). */
export function readPendingInviteCode(): string | null {
  try {
    return parseInviteCodeParam(sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Consume the parked code — clears it so it never leaks into a later,
 * unrelated onboarding. */
export function takePendingInviteCode(): string | null {
  const code = readPendingInviteCode();
  if (code) {
    try { sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY); } catch { /* storage unavailable */ }
  }
  return code;
}
