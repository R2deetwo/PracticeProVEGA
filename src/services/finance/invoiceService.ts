
import { InvoiceLineItem } from '../../types';

/**
 * Pure functions for invoice calculations.
 */

export const calculateSubTotal = (items: InvoiceLineItem[]): number => {
    return (items || []).reduce((sum, item) => sum + (item.total || 0), 0);
};

export const calculateTaxAmount = (subTotal: number, taxRate: number, isApplicable: boolean): number => {
    return isApplicable ? (subTotal * taxRate / 100) : 0;
};

// NOTE: generateInvoiceNumber() has been replaced by src/utils/invoiceHelpers.ts
// The new generator produces dynamic, firm-branded invoice numbers.
// Import from '../../utils/invoiceHelpers' instead.
