import React, { useId } from 'react';

/**
 * Textarea — the shared multi-line text primitive.
 *
 * ROUND D (Wave 2, D3): the ui/ layer had Button/Input/Select but NO
 * textarea — so every new multi-line field (the Estate bulletin body being
 * the first) would have had to add a raw <textarea>, which the
 * ui-primitives ratchet (ADR-0004) bans for new code. This component
 * mirrors Input.tsx exactly: auto id, htmlFor label wiring,
 * aria-describedby hint/error, and the same formStyles variants (they apply
 * to <textarea> unchanged — same box model, same focus system).
 */

import { inputModern, inputClassic, inputLarge, inputSettings } from '../../utils/formStyles';

export type TextareaStyle = 'modern' | 'classic' | 'large' | 'settings' | 'bare';

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
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
  styleVariant?: TextareaStyle;
  /** Classes for the wrapper (label + textarea + messages). */
  containerClassName?: string;
  /** Extra classes on the <textarea> itself. */
  textareaClassName?: string;
  /** Extra classes on the <label>. */
  labelClassName?: string;
}

const VARIANT_CLASSES: Record<TextareaStyle, string> = {
  modern: inputModern,
  classic: inputClassic,
  large: inputLarge,
  settings: inputSettings,
  bare: '',
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      hint,
      error,
      required,
      id: explicitId,
      styleVariant = 'modern',
      containerClassName = '',
      textareaClassName = '',
      labelClassName = '',
      className,
      rows,
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
          <label htmlFor={id} className={`block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1 ${labelClassName}`.trim()}>
            {label}
            {required && <span className="text-rose-500 ml-0.5" aria-hidden="true">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          required={required}
          rows={rows ?? 4}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${VARIANT_CLASSES[styleVariant]} ${error ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-500' : ''} ${textareaClassName} ${className || ''}`}
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

Textarea.displayName = 'Textarea';
