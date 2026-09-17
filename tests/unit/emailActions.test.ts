/**
 * Welcome-email action deep-link regression tests (2026-09-17, round 3 of
 * the welcome-email link saga).
 *
 * History: round 1 linked to a never-registered domain (practicepro.ng —
 * NXDOMAIN, every button dead). Round 2 linked to live Help Center sections
 * but "Add your first Property" promised an action and delivered a help
 * article. Round 3 deep-links the action buttons into the app
 * (/properties?action=new_property) with the creation modal opening.
 *
 * These tests pin the contract:
 *   1. resolveEmailAction accepts ONLY the exact known action spellings —
 *      unknown/hostile/empty values return null (the caller must no-op).
 *   2. isSafePendingRedirectPath accepts /help paths and ONLY the exact
 *      action URLs — so a crafted email/link can never plant an arbitrary
 *      post-login redirect target in sessionStorage.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveEmailAction,
  isSafePendingRedirectPath,
  EMAIL_ACTION_TARGETS,
  SAFE_ACTION_REDIRECTS,
} from '../../src/utils/emailActions';

describe('resolveEmailAction', () => {
  // ── The blessed vocabulary ────────────────────────────────────────────
  it('resolves new_property to the properties view + newProperty modal', () => {
    expect(resolveEmailAction('new_property')).toEqual({
      view: 'properties',
      modal: 'newProperty',
    });
  });

  it('resolves new_matter to the matters view + newMatter modal', () => {
    expect(resolveEmailAction('new_matter')).toEqual({
      view: 'matters',
      modal: 'newMatter',
    });
  });

  // ── Everything else must be rejected ──────────────────────────────────
  it.each([
    ['unknown_action'],
    ['new-property'], // wrong spelling — hyphen, not underscore
    ['New_Property'], // case-sensitive on purpose: the email URLs are generated
    ['new_property '], // trailing whitespace
    [' new_property'], // leading whitespace
    ['new_property&x=1'], // param smuggling
    [''], // empty string
    ['[object Object]'], // the Task-54 click-event artifact string
  ])('rejects %j', (action) => {
    expect(resolveEmailAction(action)).toBeNull();
  });

  it.each([
    [null],
    [undefined],
  ])('rejects %p', (action) => {
    expect(resolveEmailAction(action as string | null | undefined)).toBeNull();
  });

  it('resolves nothing that is not a plain string', () => {
    // Event-like objects must never resolve (see Task 54's click-event leak).
    expect(resolveEmailAction({ type: 'click' } as unknown as string)).toBeNull();
    expect(resolveEmailAction(42 as unknown as string)).toBeNull();
  });

  it('keeps the target map and the redirect allowlist in sync', () => {
    // Every action target must have a matching EXACT redirect URL, or the
    // unauthenticated post-login handoff would silently drop the action.
    for (const [action, target] of Object.entries(EMAIL_ACTION_TARGETS)) {
      expect(SAFE_ACTION_REDIRECTS).toContain(`/${target.view}?action=${action}`);
    }
  });
});

describe('isSafePendingRedirectPath', () => {
  // ── Help Center paths (round-2 contract) ──────────────────────────────
  it.each([
    ['/help'],
    ['/help/getting-started'],
    ['/help/property-management'],
    ['/help/aloa-tips'],
  ])('accepts help path %j', (path) => {
    expect(isSafePendingRedirectPath(path)).toBe(true);
  });

  // ── The exact action URLs (round-3 contract) ──────────────────────────
  it.each(SAFE_ACTION_REDIRECTS)('accepts exact action URL %j', (path) => {
    expect(isSafePendingRedirectPath(path)).toBe(true);
  });

  // ── Everything else must be rejected ──────────────────────────────────
  it.each([
    ['/'], // dashboard — no reason to park
    ['/properties'], // right path, MISSING the action param
    ['/matters'], // right path, MISSING the action param
    ['/properties?action=new_matter'], // path/param mismatch
    ['/matters?action=new_property'], // path/param mismatch
    ['/properties?action=new_property&next=/portal/tenant/login'], // param smuggling
    ['/properties?action=delete_all_properties'], // hostile action value
    ['/properties?action=new_property/'], // trailing slash breaks exact match
    ['/PROPERTIES?action=new_property'], // case games
    ['/help/../properties?action=new_property'], // traversal
    ['/portal/tenant/login'], // portal paths were never parkable
    ['/admin'], ['/anything-else'], [''], ['https://evil.example.com/properties?action=new_property'],
  ])('rejects %j', (path) => {
    expect(isSafePendingRedirectPath(path)).toBe(false);
  });
});
