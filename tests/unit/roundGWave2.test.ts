/**
 * roundGWave2.test.ts — ROUND G (Wave G2) regression tests.
 *
 * G2 made MAJOR AI actions require an EXPLICIT human confirmation:
 * delete_item on ANY target and update_status/archive on properties now
 * render a Confirm/Cancel card, and the mutation runs ONLY on the
 * Confirm click. Contracts pinned in BOTH directions:
 *   • the BROKEN behaviour is impossible (the policy is deterministic —
 *     a delete never slips through as "immediate"; the confirm path
 *     performs NO mutation and tells the model the action was NOT
 *     executed; an unsupported verb throws an honest error instead of
 *     the old phantom success),
 *   • the legitimate flows stay immediate (task status/priority,
 *     matter status, assignment) and the card's copy describes the
 *     REAL action the user is confirming.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  requiresQuickActionConfirmation,
  describeQuickAction,
  confirmButtonLabel,
} from '../../src/utils/quickActionPolicy';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = existsSync(resolvePath(here, '../../convex/myFunctions.ts'))
    ? resolvePath(here, '../..')
    : process.cwd();
const read = (p: string) => readFileSync(resolvePath(repoRoot, p), 'utf-8');

// ── The policy ──────────────────────────────────────────────────────────────
describe('roundG wave2 — requiresQuickActionConfirmation (the deterministic gate)', () => {
  it('delete_item requires confirmation on EVERY target type', () => {
    for (const targetType of ['matters', 'tasks', 'documents', 'contacts', 'properties']) {
      expect(requiresQuickActionConfirmation('delete_item', targetType)).toBe(true);
    }
    // …even with no target type at all.
    expect(requiresQuickActionConfirmation('delete_item')).toBe(true);
  });

  it('property status/archive changes require confirmation (portfolio state)', () => {
    expect(requiresQuickActionConfirmation('update_status', 'properties')).toBe(true);
    expect(requiresQuickActionConfirmation('archive', 'properties')).toBe(true);
  });

  it('day-to-day tweaks stay immediate — no confirmation fatigue', () => {
    expect(requiresQuickActionConfirmation('update_status', 'matters')).toBe(false);
    expect(requiresQuickActionConfirmation('update_status', 'tasks')).toBe(false);
    expect(requiresQuickActionConfirmation('set_priority', 'tasks')).toBe(false);
    expect(requiresQuickActionConfirmation('assign_user', 'matters')).toBe(false);
    expect(requiresQuickActionConfirmation('assign_user', 'tasks')).toBe(false);
  });
});

describe('roundG wave2 — card copy', () => {
  it('a delete says permanently delete and cannot be undone', () => {
    const d = describeQuickAction('delete_item', 'properties', undefined, 'k57x9p2mZ');
    expect(d).toContain('Permanently delete');
    expect(d).toContain('cannot be undone');
    expect(d).toContain('propert'); // the target, singularised
  });

  it('a status change names the value being applied', () => {
    const d = describeQuickAction('update_status', 'properties', 'Vacant', 'k57');
    expect(d).toContain('Vacant');
    expect(d).toContain('status');
  });

  it('confirm button labels are specific to the verb', () => {
    expect(confirmButtonLabel('delete_item')).toBe('Yes, delete it');
    expect(confirmButtonLabel('update_status')).toBe('Yes, apply it');
    expect(confirmButtonLabel('assign_user')).toBe('Confirm');
  });
});

// ── The wiring (source contracts — the guarantee is structural) ─────────────
describe('roundG wave2 — AloaChat + card wiring contracts', () => {
  const chat = read('src/components/aloa/AloaChat.tsx');

  it('execute_quick_action gates on the policy BEFORE any mutation runs', () => {
    const branch = chat.slice(chat.indexOf("name === 'execute_quick_action'"));
    const gatePos = branch.indexOf('requiresQuickActionConfirmation(action, targetType)');
    const mutatePos = branch.indexOf('await runQuickActionMutation(');
    expect(gatePos).toBeGreaterThan(-1);
    expect(mutatePos).toBeGreaterThan(-1);
    // The gate comes FIRST — the immediate path lives in the else.
    expect(gatePos).toBeLessThan(mutatePos);
  });

  it('the confirm path performs NO mutation — it only describes and defers', () => {
    const branch = chat.slice(
      chat.indexOf('requiresQuickActionConfirmation(action, targetType)'),
      chat.indexOf("name === 'update_open_form'"),
    );
    expect(branch).toContain("type: 'confirmQuickAction'");
    expect(branch).toContain('awaitingConfirmation: true');
    expect(branch).toContain('The action was NOT executed');
    // No mutation call inside the gated branch itself.
    expect(branch).not.toContain('convex.mutation');
    expect(branch).not.toContain('deleteItem(');
  });

  it('ONE shared mutation runner serves both paths (no divergent execution)', () => {
    expect(chat).toContain('const runQuickActionMutation = async');
    // The immediate path and the confirm handler both route through it.
    const immediatePath = chat.slice(
      chat.indexOf("name === 'execute_quick_action'"),
      chat.indexOf("name === 'update_open_form'"),
    );
    expect(immediatePath).toContain('await runQuickActionMutation(');
    const confirmHandler = chat.slice(
      chat.indexOf('const executeConfirmedQuickAction'),
      chat.indexOf('const declineQuickAction'),
    );
    expect(confirmHandler).toContain('await runQuickActionMutation(');
  });

  it('the confirm card executes ONLY on the user click — cancel runs nothing', () => {
    const confirmHandler = chat.slice(
      chat.indexOf('const executeConfirmedQuickAction'),
      chat.indexOf('const declineQuickAction'),
    );
    // The mutation sits inside the handler invoked by onConfirm.
    expect(confirmHandler).toContain('runQuickActionMutation(proposal)');
    const declineHandler = chat.slice(chat.indexOf('const declineQuickAction'));
    expect(declineHandler.slice(0, 400)).not.toContain('convex.mutation');
    expect(declineHandler.slice(0, 400)).not.toContain('deleteItem(');
  });

  it('an unsupported quick-action verb throws an HONEST error (the old code reported phantom success)', () => {
    const runner = chat.slice(
      chat.indexOf('const runQuickActionMutation'),
      chat.indexOf('const executeConfirmedQuickAction'),
    );
    expect(runner).toContain('Unsupported quick action');
  });

  it('the render tree has a dedicated confirmQuickAction branch, excluded from the generic ActionCard', () => {
    expect(chat).toContain("msg.toolAction?.type === 'confirmQuickAction'");
    expect(chat).toContain("<QuickActionConfirmCard");
    expect(chat).toContain("msg.toolAction.type !== 'confirmQuickAction'");
  });

  it('the card component renders Confirm AND Cancel and never fires on render', () => {
    const card = read('src/components/aloa/QuickActionConfirmCard.tsx');
    expect(card).toContain('onConfirm');
    expect(card).toContain('onCancel');
    expect(card).toContain('Cancel');
    // Statuses cover the full lifecycle.
    expect(card).toContain("'pending' | 'done' | 'declined'");
    // No side effects at module scope or in effect hooks.
    expect(card).not.toContain('useEffect');
  });

  it('the ARIA prompt tells the model major actions await user confirmation', () => {
    const prompt = read('ai/prompts/02-aria-property-identity.md');
    expect(prompt).toContain('confirmation card');
    expect(prompt).toContain('never claim the change is done');
  });
});
