/**
 * Email action deep links — the machinery behind the welcome email's
 * "Get Started" step buttons.
 *
 * 2026-09-17 (round 3 of the welcome-email link saga):
 *   - Round 1: links pointed at https://practicepro.ng/... (never registered,
 *     NXDOMAIN) — every button was dead.
 *   - Round 2: links pointed at live Help Center sections
 *     (/help/<sectionId>) — real pages, but "Add your first Property"
 *     promised an ACTION and delivered a help article.
 *   - Round 3 (this file): buttons that promise an action now deep-link
 *     INTO the app with that flow open, e.g. /properties?action=new_property
 *     opens the Properties view with the New Property modal ready.
 *
 * The URL contract:
 *   /properties?action=new_property  → Properties view + New Property modal
 *   /matters?action=new_matter      → Matters view + New Matter modal
 *
 * Authenticated + onboarded users land straight in the flow (App.tsx's
 * MainContent effect consumes the param). Unauthenticated clickers get the
 * URL parked in sessionStorage by the redirect effect and delivered after
 * login (see practicepro_pending_redirect in App.tsx) — the parking
 * allowlist below is deliberately EXACT-MATCH so nothing but these two
 * blessed URLs can plant a post-login redirect.
 */

export interface EmailActionTarget {
  /** The app view (UIContext View id) to navigate to. */
  view: string;
  /** The modal (ModalType) to open once the view is mounted. */
  modal: string;
}

/** Action param values → view + modal. Anything not listed is ignored. */
export const EMAIL_ACTION_TARGETS: Record<string, EmailActionTarget> = {
  new_property: { view: 'properties', modal: 'newProperty' },
  new_matter: { view: 'matters', modal: 'newMatter' },
};

/**
 * Resolve an ?action= param to its target. Returns null for unknown,
 * empty, or hostile values — the caller must treat null as "do nothing".
 */
export function resolveEmailAction(action: string | null | undefined): EmailActionTarget | null {
  if (!action) return null;
  return EMAIL_ACTION_TARGETS[action] ?? null;
}

/**
 * The ONLY non-help URLs allowed to be parked as a pending redirect for
 * unauthenticated clickers. Exact strings — no prefixes, no wildcards, so
 * a crafted link can never inject an arbitrary post-login destination.
 */
export const SAFE_ACTION_REDIRECTS: readonly string[] = [
  '/properties?action=new_property',
  '/matters?action=new_matter',
];

/**
 * Is this path a safe pending-redirect target?
 *   - /help and /help/<section> (the round-2 contract)
 *   - the exact action URLs above
 * Anything else must be rejected. Traversal segments (`..`) and duplicate
 * slashes are rejected outright — they can smuggle a non-help destination
 * past the /help prefix check (e.g. "/help/../properties?action=...").
 */
export function isSafePendingRedirectPath(path: string): boolean {
  if (!path || path.includes('..') || path.includes('//')) return false;
  if (path === '/help' || path.startsWith('/help/')) return true;
  return SAFE_ACTION_REDIRECTS.includes(path);
}
