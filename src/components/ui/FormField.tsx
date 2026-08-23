/**
 * Form Primitives — Single source of truth for form inputs in PracticePro.
 *
 * Replaces ad-hoc input styling across 30+ form components with consistent
 * tokens for border, focus ring, error state, and dark mode.
 *
 * Usage:
 *   <FormField label="Matter Title" required error={errors.title}>
 *     <Input
 *       value={title}
 *       onChange={e => setTitle(e.target.value)}
 *       placeholder="Enter matter title..."
 *       error={!!errors.title}
 *     />
 *   </FormField>
 *
 *   <FormField label="Priority" helperText="High = needs attention this week">
 *     <Select value={priority} onChange={e => setPriority(e.target.value)}>
 *       <option value="low">Low</option>
 *       <option value="medium">Medium</option>
 *       <option value="high">High</option>
 *     </Select>
 *   </FormField>
 */

import React from 'react';

// ─── Shared input base styles ──────────────────────────────────────────────
const BASE_INPUT = `
  w-full px-3 py-2
  text-sm text-slate-900 dark:text-zinc-100
  bg-white dark:bg-zinc-900
  border rounded-lg
  transition-all duration-150
  placeholder:text-slate-400 dark:placeholder:text-zinc-500
  focus:outline-none
  focus:ring-2 focus:ring-primary-500/30
  focus:border-primary-500
  disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-zinc-800
`;

const NORMAL_BORDER = 'border-slate-200 dark:border-zinc-700';
const ERROR_BORDER = 'border-rose-400 dark:border-rose-700 focus:ring-rose-500/30 focus:border-rose-500';

// ─── Input ──────────────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input: React.FC<InputProps> = ({ error, className = '', ...rest }) => (
  <input
    className={`${BASE_INPUT} ${error ? ERROR_BORDER : NORMAL_BORDER} ${className}`}
    {...rest}
  />
);

// ─── Select ─────────────────────────────────────────────────────────────────
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select: React.FC<SelectProps> = ({ error, className = '', children, ...rest }) => (
  <select
    className={`${BASE_INPUT} ${error ? ERROR_BORDER : NORMAL_BORDER} ${className} cursor-pointer`}
    {...rest}
  >
    {children}
  </select>
);

// ─── Textarea ───────────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea: React.FC<TextareaProps> = ({ error, className = '', ...rest }) => (
  <textarea
    className={`${BASE_INPUT} ${error ? ERROR_BORDER : NORMAL_BORDER} ${className} resize-y min-h-[80px]`}
    {...rest}
  />
);

// ─── FormField ──────────────────────────────────────────────────────────────
interface FormFieldProps {
  label: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  helperText,
  error,
  required,
  children,
  className = '',
}) => (
  <div className={`space-y-1.5 ${className}`}>
    <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
      {label}
      {required && <span className="text-rose-500 ml-0.5">*</span>}
    </label>
    {children}
    {helperText && !error && (
      <p className="text-2xs text-slate-400 dark:text-zinc-500 leading-relaxed">{helperText}</p>
    )}
    {error && (
      <p className="text-2xs text-rose-500 dark:text-rose-400 font-medium flex items-center gap-1">
        <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        {error}
      </p>
    )}
  </div>
);

export default Input;
