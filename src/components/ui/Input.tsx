import React, { useId } from 'react';

/**
 * Input — the shared text-input primitive (design-system Chunk A).
 *
 * Fixes the label-association bug class wholesale for adopters: 523 <label>
 * elements existed with only 109 wired via htmlFor. This component
 * generates a stable id (useId) and connects label -> input ->
 * hint/error through htmlFor / aria-describedby / aria-invalid, so screen
 * readers announce the field correctly and tapping the label focuses it.
 *
 * Visual styles are the three established formStyles variants — importing
 * them here (rather than re-declaring) keeps a single source of truth;
 * formStyles.ts is the only other place these strings live.
 */

import { inputModern, inputClassic, inputLarge } from '../../utils/formStyles';

export type InputStyle = 'modern' | 'classic' | 'large';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** Human label — always rendered; pass aria-label instead only for
   *  visually-hidden edge cases. */
  label?: React.ReactNode;
  /** Optional helper text below the field. */
  hint?: React.ReactNode;
  /** Error message — wires aria-invalid + aria-describedby. */
  error?: React.ReactNode;
  /** Required marker (visual only; pass `required` for native semantics). */
  required?: boolean;
  /** Explicit id — omit to auto-generate. */
  id?: string;
  styleVariant?: InputStyle;
  /** Classes for the wrapper (label + input + messages). */
  containerClassName?: string;
  /** Extra classes on the <input> itself. */
  inputClassName?: string;
}

const VARIANT_CLASSES: Record<InputStyle, string> = {
  modern: inputModern,
  classic: inputClassic,
  large: inputLarge,
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      hint,
      error,
      required,
      id: explicitId,
      styleVariant = 'modern',
      containerClassName = '',
      inputClassName = '',
      className,
      ...rest
    },
    ref
  ) => {
    const autoId = useId();
    const id = explicitId || autoId;
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <div className={`w-full ${containerClassName}`}>
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
            {label}
            {required && <span className="text-rose-500 ml-0.5" aria-hidden="true">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${VARIANT_CLASSES[styleVariant]} ${error ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500' : ''} ${inputClassName} ${className || ''}`}
          {...rest}
        />
        {hint && !error && (
          <p id={hintId} className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="mt-1 text-xs text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
