import React, { useId } from 'react';

/**
 * Select — the shared native-select primitive (design-system Chunk A).
 *
 * Same label-association contract as Input: auto id, htmlFor label,
 * aria-describedby hint/error wiring. Uses the established formStyles
 * variants so adopting is a zero-visual-change refactor.
 *
 * The app's dark-mode <select> rendering (option backgrounds, autofill,
 * data-placeholder) is handled globally in index.css (.dark select rules)
 * — this component intentionally does not fight that layer.
 */

import { inputModern, inputClassic, inputLarge } from '../../utils/formStyles';

export type SelectStyle = 'modern' | 'classic' | 'large';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  id?: string;
  /** Options may also be passed as children <option> for full control. */
  options?: SelectOption[];
  /** Shown as the first disabled option (e.g. "Choose…"). */
  placeholder?: string;
  styleVariant?: SelectStyle;
  containerClassName?: string;
  selectClassName?: string;
}

const VARIANT_CLASSES: Record<SelectStyle, string> = {
  modern: inputModern,
  classic: inputClassic,
  large: inputLarge,
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      hint,
      error,
      required,
      id: explicitId,
      options,
      placeholder,
      styleVariant = 'classic',
      containerClassName = '',
      selectClassName = '',
      className,
      children,
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
        <select
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${VARIANT_CLASSES[styleVariant]} ${error ? 'border-rose-400 dark:border-rose-600' : ''} ${selectClassName} ${className || ''}`}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options
            ? options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))
            : children}
        </select>
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

Select.displayName = 'Select';
