import * as React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => {
    const classes = `flex h-9 w-full items-center justify-between rounded-md border border-slate-300 bg-white dark:bg-zinc-700 px-3 py-1 text-sm shadow-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50
      ${className || ''}
    `;
    return (
        <select className={classes} ref={ref} {...props} />
    );
  }
);
Select.displayName = "Select";

export { Select };