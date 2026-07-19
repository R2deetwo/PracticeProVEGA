/**
 * FieldLabel — standardized form field label.
 *
 * Phase 6.6: Replaces the 20+ label className variants across all forms
 * with a single consistent component.
 *
 * Standard:
 *   - text-xs font-semibold
 *   - text-slate-700 dark:text-zinc-300
 *   - mb-1.5 block
 *   - Required field shows rose-500 asterisk
 *
 * Usage:
 *   <FieldLabel>Client Name</FieldLabel>
 *   <FieldLabel required>Email Address</FieldLabel>
 *   <FieldLabel htmlFor="phone">Phone Number</FieldLabel>
 */
import React from 'react';

export interface FieldLabelProps {
    children: React.ReactNode;
    /** Shows a red asterisk after the label text */
    required?: boolean;
    /** HTML for attribute — connects to input id */
    htmlFor?: string;
    /** Additional className for custom spacing */
    className?: string;
}

export const FieldLabel: React.FC<FieldLabelProps> = ({
    children,
    required = false,
    htmlFor,
    className = '',
}) => {
    return (
        <label
            htmlFor={htmlFor}
            className={`block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5 ${className}`}
        >
            {children}
            {required && (
                <span className="text-rose-500 ml-0.5" aria-hidden="true">*</span>
            )}
        </label>
    );
};

export default FieldLabel;
