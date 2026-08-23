/**
 * Button — Single source of truth for ALL buttons in PracticePro.
 *
 * Replaces 4+ different button styling systems (CSS classes, inline Tailwind,
 * ad-hoc per-component buttons) with one enforced component.
 *
 * Variants:
 *   primary   — Brand green, solid. Main actions (Save, Create, Submit).
 *   secondary — White/transparent with border. Cancel, secondary actions.
 *   ghost     — No background, no border. Tertiary actions, icon buttons.
 *   danger    — Rose/red. Delete, remove, cancel subscription.
 *   premium   — Gradient. Landing page CTAs, upgrade prompts.
 *
 * Sizes:
 *   sm  — Badges, compact UI, inline actions. text-2xs.
 *   md  — Default. Forms, modals, standard actions. text-xs.
 *   lg  — Hero CTAs, landing page, important actions. text-sm.
 *
 * Usage:
 *   <Button variant="primary" size="md" onClick={...}>Save Matter</Button>
 *   <Button variant="danger" size="sm" leftIcon={<TrashIcon />} isLoading={isDeleting}>Delete</Button>
 *   <Button variant="ghost" size="md" className="w-full">Cancel</Button>
 */

import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'premium';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 active:bg-primary-800 shadow-sm',
  secondary:
    'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border border-slate-300 dark:border-zinc-600 hover:bg-slate-50 dark:hover:bg-zinc-700 shadow-sm',
  ghost:
    'bg-transparent text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 shadow-sm',
  premium:
    'bg-gradient-to-r from-primary-600 to-emerald-500 text-white hover:from-primary-700 hover:to-emerald-600 shadow-md',
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-2xs font-bold rounded-md gap-1',
  md: 'px-4 py-2 text-xs font-bold rounded-lg gap-1.5',
  lg: 'px-6 py-3 text-sm font-bold rounded-lg gap-2',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = '',
  children,
  disabled,
  ...rest
}) => {
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];

  return (
    <button
      className={`
        inline-flex items-center justify-center
        transition-all duration-150
        active:scale-[0.98]
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1
        disabled:opacity-50 disabled:pointer-events-none
        ${variantStyle} ${sizeStyle}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `.trim()}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading && (
        <svg className="animate-spin h-4 w-4 -ml-1 mr-1.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {!isLoading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
      {children}
      {!isLoading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
    </button>
  );
};

export default Button;
