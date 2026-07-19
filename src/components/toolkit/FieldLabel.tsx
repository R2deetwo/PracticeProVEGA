import React from 'react';
export interface FieldLabelProps { children: React.ReactNode; required?: boolean; htmlFor?: string; className?: string; }
export const FieldLabel: React.FC<FieldLabelProps> = ({ children, required, htmlFor, className = '' }) => (
    <label htmlFor={htmlFor} className={`block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5 ${className}`}>
        {children}{required && <span className="text-rose-500 ml-0.5" aria-hidden="true">*</span>}
    </label>
);
export default FieldLabel;
