/**
 * ui/ — shared UI primitives (design-system Chunk A, ADR-0004).
 *
 * The adoption rule: NEW code uses these primitives instead of hand-rolled
 * <button>/<input>/<select> class strings. EXISTING code migrates screen by
 * screen (the same discipline as the token batches) — each migration must
 * be a zero-visual-change refactor, which is why the class constants here
 * mirror the dominant measured patterns in the codebase.
 *
 * Old files that predate this layer:
 *   - ConfirmDialog.tsx      (in-app confirm replacement — stable, adopted)
 *   - FinancialStatusBadge.tsx (status-string → tone mapping — stable)
 * Both are re-exported here so there is ONE import path for UI primitives.
 */

export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';

export { Input } from './Input';
export type { InputProps, InputStyle } from './Input';

export { Select } from './Select';
export type { SelectProps, SelectStyle, SelectOption } from './Select';

export { Card } from './Card';
export type { CardProps } from './Card';

export { Badge } from './Badge';
export type { BadgeProps, BadgeTone } from './Badge';

export { useToastFeedback } from './useToastFeedback';
export type { ToastFeedback, ToastFeedbackOptions } from './useToastFeedback';

// Pre-existing primitives, re-exported for one import path.
export { default as ConfirmDialog } from './ConfirmDialog';
export { default as FinancialStatusBadge } from './FinancialStatusBadge';

// EmptyState already exists one level up with 11 adopters — re-export
// rather than duplicate (single source of truth).
export { default as EmptyState } from '../EmptyState';
export { SectionErrorBoundary } from './SectionErrorBoundary';
