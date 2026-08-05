import { LitigationParty } from '../types';

/**
 * Normalize a property address for grouping/comparison.
 * Strips non-alphanumeric characters and lowercases.
 */
export const normalizeAddress = (address: string): string => {
  return (address || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
};

/**
 * Formats a number as a Naira currency string, without the symbol.
 * Use this with the <NairaSymbol /> component for display.
 * @param amount The number to format (also accepts string representations).
 * @returns A string representing the formatted amount, e.g., "1,000,000.00".
 */
export const formatNaira = (amount: number | string): string => {
  // Handle string inputs by converting to number
  const num = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]/g, '')) : amount;
  if (typeof num !== 'number' || isNaN(num)) {
    return '0.00';
  }
  return num.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Formats naira amounts in arbitrary text (e.g., AI chat responses).
 * Finds patterns like "₦1000000" or "N1000000" or "1000000 naira" and
 * adds commas for readability: "₦1,000,000.00".
 *
 * This is used to post-process ALOA chat responses so that monetary
 * amounts always have proper comma formatting.
 */
export const formatNairaInText = (text: string): string => {
  if (!text) return text;
  // Match ₦ or N or NGN followed by digits (with optional decimal)
  // Also match bare large numbers (5+ digits) that are likely naira amounts
  return text
    // Format ₦1000000 → ₦1,000,000.00
    .replace(/₦\s?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d+))?/g, (match, intPart, decPart) => {
      const num = parseInt(String(intPart).replace(/,/g, ''), 10);
      if (isNaN(num)) return match;
      const formatted = num.toLocaleString('en-NG');
      return `₦${formatted}${decPart ? '.' + decPart : '.00'}`;
    })
    // Format N1000000 (but not "N" in words like "Not") → ₦1,000,000.00
    .replace(/\bN(\d{4,})(?:\.(\d+))?/g, (match, intPart, decPart) => {
      const num = parseInt(String(intPart), 10);
      if (isNaN(num)) return match;
      const formatted = num.toLocaleString('en-NG');
      return `₦${formatted}${decPart ? '.' + decPart : '.00'}`;
    });
};

/**
 * Formats a large number into a more readable abbreviated format (K, M, B).
 * @param num The number to format.
 * @returns A formatted string like "1.2K", "3.45M", etc.
 */
export const formatLargeNumber = (num: number): string => {
    if (num >= 1_000_000_000) {
        return (num / 1_000_000_000).toFixed(2).replace(/\.00$/, '') + 'B';
    }
    if (num >= 1_000_000) {
        return (num / 1_000_000).toFixed(2).replace(/\.00$/, '') + 'M';
    }
    if (num >= 1_000) {
        return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return num.toString();
};

/**
 * Formats a number into a string with commas for thousands separation.
 * Suitable for displaying in input fields.
 * @param value The number or string to format.
 * @returns A comma-separated string, or an empty string for invalid input.
 */
export const formatNumberWithCommas = (value: number | string | undefined | null): string => {
  if (value === null || value === undefined || value === '') return '';
  const numString = String(value);
  const [integerPart, decimalPart] = numString.split('.');
  const sanitizedInteger = integerPart.replace(/[^0-9-]/g, '');
  const formattedInteger = Number(sanitizedInteger).toLocaleString('en-US');
  
  if (decimalPart !== undefined) {
    return `${formattedInteger}.${decimalPart}`;
  }
  return formattedInteger;
};

/**
 * Parses a comma-formatted string back into a number.
 * @param value The string to parse.
 * @returns The parsed number, or 0 if invalid.
 */
export const parseFormattedNumber = (value: string): number => {
    if (!value || typeof value !== 'string') return 0;
    // Remove all characters except digits, decimal point, and negative sign
    const sanitized = value.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(sanitized);
    return isNaN(parsed) ? 0 : parsed;
};

/**
 * Formats bytes into a human-readable string (KB, MB, GB).
 * @param bytes The size in bytes.
 * @param decimals Number of decimal places (default 2).
 * @returns Formatted string.
 */
export const formatBytes = (bytes: number, decimals = 2): string => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

/**
 * Auto-formats a suit title perfectly according to common law litigation rules.
 * E.g., "John Doe & 3 Ors v. Jane Smith & Anor"
 */
export function autoFormatSuitTitle(claimants: LitigationParty[], defendants: LitigationParty[]): string {
    if (claimants.length === 0 && defendants.length === 0) return '';
    const getPartyLabel = (parties: LitigationParty[]) => {
        const active = parties.filter(p => typeof p.name === 'string' && p.name.trim().length > 0);
        if (active.length === 0) return '';
        if (active.length === 1) return active[0].name;
        if (active.length === 2) return `${active[0].name} & Anor`;
        return `${active[0].name} & ${active.length - 1} Ors`;
    };
    const cLabel = getPartyLabel(claimants);
    const dLabel = getPartyLabel(defendants);
    
    if (cLabel && dLabel) return `${cLabel} v. ${dLabel}`;
    if (cLabel) return cLabel;
    if (dLabel) return dLabel;
    return '';
}

/**
 * Formats a date with an ordinal suffix for the day, and long month name.
 * E.g., "26th April 2024"
 */
export const formatDateWithOrdinal = (dateInput: string | Date | undefined): string => {
    if (!dateInput) return '';
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(date.getTime())) return '';

    const day = date.getDate();
    const month = date.toLocaleString('en-GB', { month: 'long' });
    const year = date.getFullYear();

    const getOrdinal = (n: number) => {
        const s = ["th", "st", "nd", "rd"];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };

    return `${getOrdinal(day)} ${month} ${year}`;
};

/**
 * Formats a date into a relative time string (e.g. "2 hours ago").
 */
export const formatRelativeTime = (dateInput: string | Date | number | undefined): string => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    
    const diffInSeconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays}d ago`;
    
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths}mo ago`;
    
    return `${Math.floor(diffInMonths / 12)}y ago`;
};
