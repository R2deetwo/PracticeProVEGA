import React from 'react';
import {
  BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, BTN_DANGER, BTN_DANGER_SOFT, BTN_OUTLINE,
  BTN_SUCCESS, BTN_DARK, BTN_TAB, BTN_TAB_ACTIVE, BTN_SEGMENTED, BTN_SEGMENTED_ACTIVE,
} from '../../utils/designTokens';

/**
 * Button — the shared button primitive (design-system Chunk A).
 *
 * WHY THIS EXISTS (docs/adr/ADR-0004-ui-primitives.md):
 * 1,818 <button> elements were styled ad hoc across ~350 components; only
 * 137 declared `type=`, so untyped buttons inside forms silently submitted.
 * This component makes `type="button"` the DEFAULT — accidental form
 * submission is impossible unless `type="submit"` is passed explicitly.
 *
 * Variant/size classes mirror the DOMINANT existing patterns verbatim
 * (measured by frequency across the codebase, see ADR-0004), so adopting
 * this component is a zero-visual-change refactor:
 *   primary   = "px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold
 *                hover:bg-primary-700 transition-colors shadow-sm"  (11× exact)
 *   secondary = "px-4 py-2 bg-slate-100 dark:bg-zinc-800 ... "       (6× exact)
 *
 * a11y built in: focus-visible ring, aria-busy on loading, disabled
 * semantics, and icon-only buttons require an accessible name (aria-label
 * is enforced at dev time by console warning).
 *
 * `touch-target` (44px minimum) is OPT-IN via the `minTouchTarget` prop —
 * the measured dominant patterns are 36px tall, so defaulting it on would
 * change layout; screens targeting the Android APK should opt in.
 */

export type ButtonVariant =
  | 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-soft' | 'outline'
  // Chunk B (Task 61) — measured multi-file patterns, see designTokens.ts:
  | 'success' | 'dark' | 'tab' | 'tab-active' | 'segmented' | 'segmented-active'
  // Escape hatch for one-off legacy looks (same contract as Input/Select
  // 'bare'): no token styling; the caller supplies the complete class string
  // via className and keeps Button's semantics (type default, focus ring,
  // loading/disabled/aria). New code should NOT use 'bare'.
  | 'bare';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'tab';

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /** Defaults to 'button' — the single most common bug this file fixes. */
  type?: 'button' | 'submit' | 'reset';
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables the button, sets aria-busy. */
  loading?: boolean;
  /** Icon component rendered before the label (or alone with iconOnly). */
  icon?: React.ComponentType<{ className?: string }>;
  /** Square icon button — pair with aria-label. */
  iconOnly?: boolean;
  /** Enforce the 44x44 minimum touch target (Apple HIG / Material). */
  minTouchTarget?: boolean;
  /** Subtle scale-down on tap. */
  activePress?: boolean;
  fullWidth?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: BTN_PRIMARY,
  secondary: BTN_SECONDARY,
  ghost: BTN_GHOST,
  danger: BTN_DANGER,
  'danger-soft': BTN_DANGER_SOFT,
  outline: BTN_OUTLINE,
  // Chunk B (Task 61):
  success: BTN_SUCCESS,
  dark: BTN_DARK,
  tab: BTN_TAB,
  'tab-active': BTN_TAB_ACTIVE,
  segmented: BTN_SEGMENTED,
  'segmented-active': BTN_SEGMENTED_ACTIVE,
  bare: '',
};

// NOTE (Task 61): `transition-colors` moved OUT of BASE and INTO each variant
// token (every Chunk A token already carried it). Reason: Chunk B needs exact
// control — BTN_DARK and BTN_SEGMENTED* are `transition-all` in the measured
// codebase, and BASE forcing transition-colors would silently change their
// hover animation (colors-only vs all-properties). Removing it from BASE is
// a no-op for every existing variant.
const BASE =
  'inline-flex items-center justify-center gap-2 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ' +
  'dark:focus-visible:ring-offset-zinc-900 disabled:opacity-50 disabled:pointer-events-none';

const TEXT_SIZES: Record<ButtonSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  // Underline tab-bar buttons (settings sub-tabs) — measured pattern:
  // pb-3 px-1 text-sm font-bold, border-b-2 carried by the tab variants.
  tab: 'text-sm font-bold',
};

const PAD_SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2',
  lg: 'px-5 py-2.5',
  tab: 'pb-3 px-1',
};

const ICON_ONLY_SIZES: Record<ButtonSize, string> = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-11 h-11',
  tab: 'w-9 h-9',
};

const SPINNER_SIZES: Record<ButtonSize, string> = {
  sm: 'w-3 h-3 border-[1.5px]',
  md: 'w-4 h-4 border-2',
  lg: 'w-5 h-5 border-2',
  tab: 'w-4 h-4 border-2',
};

export interface ButtonClassOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  fullWidth?: boolean;
  minTouchTarget?: boolean;
  activePress?: boolean;
  className?: string;
}

/**
 * Pure class composition for <Button> — exported so tests
 * (tests/unit/uiPrimitives.test.ts) can assert that an adopted button's
 * class set is a SUPERSET of the original hand-rolled string, which is the
 * mechanical guarantee behind the zero-visual-change migration discipline
 * (ADR-0004).
 *
 * CONFLICT RESOLUTION (verified against the built CSS): Tailwind v3 emits
 * utilities in LEXICOGRAPHIC class-name order, and the LAST emitted rule
 * wins for same-specificity classes. Therefore an override passed via
 * className only works if it sorts AFTER the class it replaces:
 *   WINS:  py-2.5 > py-2, mb-3 > mb-1, dark:bg-zinc-800 > dark:bg-zinc-700
 *   LOSES: text-base < text-sm, bg-slate-100 < bg-slate-50,
 *          shadow-md < shadow-sm, rounded-lg < rounded-md
 * When an override would lose, use variant='bare' with the verbatim
 * original class string instead of fighting the order.
 */
export function buildButtonClasses({
  variant = 'primary',
  size = 'md',
  iconOnly = false,
  fullWidth = false,
  minTouchTarget = false,
  activePress = false,
  className = '',
}: ButtonClassOptions): string {
  return [
    BASE,
    VARIANTS[variant],
    iconOnly ? ICON_ONLY_SIZES[size] : `${PAD_SIZES[size]} ${TEXT_SIZES[size]}`,
    fullWidth ? 'w-full' : '',
    minTouchTarget ? 'touch-target' : '',
    activePress ? 'active-press' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      type = 'button',
      variant = 'primary',
      size = 'md',
      loading = false,
      icon: Icon,
      iconOnly = false,
      minTouchTarget = false,
      activePress = false,
      fullWidth = false,
      className = '',
      children,
      disabled,
      'aria-label': ariaLabel,
      ...rest
    },
    ref
  ) => {
    if (process.env.NODE_ENV !== 'production' && iconOnly && !ariaLabel && !rest['aria-labelledby']) {
      // Accessible-name guard: an icon-only button with no name is invisible
      // to screen readers and unlocatable by voice control.
      console.warn(
        '[Button] iconOnly requires aria-label (or aria-labelledby) for accessibility.'
      );
    }

    const classes = buildButtonClasses({
      variant, size, iconOnly, fullWidth, minTouchTarget, activePress, className,
    });

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-label={ariaLabel}
        {...rest}
      >
        {loading ? (
          <span
            className={`animate-spin rounded-full border-current border-t-transparent ${SPINNER_SIZES[size]}`}
            aria-hidden="true"
          />
        ) : (
          Icon && <Icon className={iconOnly ? 'w-4 h-4' : 'w-4 h-4 shrink-0'} aria-hidden="true" />
        )}
        {iconOnly ? null : children}
      </button>
    );
  }
);

Button.displayName = 'Button';
