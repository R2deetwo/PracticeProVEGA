/**
 * quickActionPolicy — Round G (§3+§6): major AI actions require an
 * EXPLICIT human confirmation before anything mutates.
 *
 * WHY THIS EXISTS: execute_quick_action used to fire the moment the
 * model called it — including `delete_item`. A hallucinated or
 * misunderstood "delete the old record" executed instantly, with no
 * human in the loop. The owner brief is explicit: major actions need
 * explicit confirmation, and the LLM must never directly execute
 * arbitrary database operations.
 *
 * This module is the deterministic policy layer: given the quick action
 * the model proposed, does it need a Confirm click first, or may it run
 * immediately? The decision is made HERE, in code — never by the prompt.
 *
 * Policy (deliberately simple and total):
 *  - delete_item on ANY target type is ALWAYS destructive → confirm.
 *  - update_status on properties touches the portfolio's visible state
 *    (and occupancy semantics feed the E1 tenancy ledger) → confirm.
 *  - update_status on matters/tasks, set_priority, assign_user are
 *    low-risk, reversible day-to-day tweaks → immediate (unchanged).
 */

/** The quick-action verbs execute_quick_action supports. */
export type QuickActionVerb =
  | 'update_status'
  | 'assign_user'
  | 'archive'
  | 'set_priority'
  | 'delete_item';

/** The target types execute_quick_action supports. */
export type QuickActionTarget =
  | 'matters'
  | 'tasks'
  | 'documents'
  | 'contacts'
  | 'properties';

/** True when the action is MAJOR and must render a Confirm card first. */
export function requiresQuickActionConfirmation(
  action: string,
  targetType?: string,
): boolean {
  if (action === 'delete_item') return true; // destructive, always
  if (action === 'update_status' && targetType === 'properties') return true; // portfolio state
  if (action === 'archive' && targetType === 'properties') return true; // portfolio state
  return false;
}

/** Human sentence describing what the proposed action will do — shown
 *  on the confirmation card so the user confirms THE REAL THING, not a
 *  vague "proceed?". */
export function describeQuickAction(
  action: string,
  targetType?: string,
  value?: string,
  targetId?: string,
): string {
  const target = (targetType || 'item').replace(/s$/, '');
  const ref = targetId ? ` (${String(targetId).slice(0, 12)}…)` : '';
  switch (action) {
    case 'delete_item':
      return `Permanently delete this ${target}${ref}. This cannot be undone from chat.`;
    case 'update_status':
      return `Change this ${target}'s status to "${value ?? '?'}"${ref}.`;
    case 'archive':
      return `Archive this ${target}${ref}.`;
    case 'set_priority':
      return `Set this ${target}'s priority to "${value ?? '?'}"${ref}.`;
    case 'assign_user':
      return `Reassign this ${target}${ref}.`;
    default:
      return `Run "${action}" on this ${target}${ref}.`;
  }
}

/** Button label for the confirm card. */
export function confirmButtonLabel(action: string): string {
  if (action === 'delete_item') return 'Yes, delete it';
  if (action === 'update_status' || action === 'archive') return 'Yes, apply it';
  return 'Confirm';
}
