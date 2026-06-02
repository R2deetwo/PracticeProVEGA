import * as React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    const classes = `flex h-9 w-full rounded-md border border-slate-300 bg-white dark:bg-zinc-700 px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 dark:placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50
      ${className || ''}
    `;
    return <input autoComplete="off" data-lpignore="true"  type={type} className={classes} ref={ref} {...props} />;
  }
);
Input.displayName = "Input";

export { Input };