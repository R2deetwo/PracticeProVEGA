import React from 'react';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, BTN_DANGER, BTN_DANGER_SOFT, BTN_OUTLINE } from '../../utils/designTokens';

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

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-soft' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

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
};

const BASE =
  'inline-flex items-center justify-center gap-2 transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ' +
  'dark:focus-visible:ring-offset-zinc-900 disabled:opacity-50 disabled:pointer-events-none';

const TEXT_SIZES: Record<ButtonSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

const PAD_SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2',
  lg: 'px-5 py-2.5',
};

const ICON_ONLY_SIZES: Record<ButtonSize, string> = {
  sm: 'w-7 h-7',
  md: 'w-9 h-9',
  lg: 'w-11 h-11',
};

const SPINNER_SIZES: Record<ButtonSize, string> = {
  sm: 'w-3 h-3 border-[1.5px]',
  md: 'w-4 h-4 border-2',
  lg: 'w-5 h-5 border-2',
};

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

    const classes = [
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
