
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

export const generateInvoiceNumber = (): string => {
    return `INV-${Math.floor(1000 + Math.random() * 9000)}`;
};
