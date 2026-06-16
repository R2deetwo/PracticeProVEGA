import { v } from "convex/values";

/**
 * Input Validation Helpers for Convex Mutations
 *
 * Provides reusable validation patterns that go beyond Convex's basic type checking.
 * These enforce length limits, format patterns, and business rules.
 *
 * Usage in mutations:
 *   validateEmail(args.email);
 *   validateStringLength(args.title, 'title', 1, 200);
 *   validatePhone(args.phone); // optional
 */

/**
 * Validates an email address format.
 * Throws on invalid format.
 */
export function validateEmail(email: string): void {
  if (!email || email.trim().length === 0) {
    throw new Error("Email is required.");
  }
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email.trim())) {
    throw new Error(`Invalid email format: "${email}"`);
  }
  if (email.length > 254) {
    throw new Error("Email address is too long (max 254 characters).");
  }
}

/**
 * Validates a phone number (Nigerian or international format).
 * Does NOT throw if the field is empty (phone is often optional).
 */
export function validatePhone(phone: string | undefined | null): void {
  if (!phone || phone.trim().length === 0) return; // optional

  // Strip common formatting characters
  const stripped = phone.replace(/[\s\-\(\)\.]/g, '');

  // Nigerian: +234XXXXXXXXXX, 0XXXXXXXXXX (11 digits starting with 0, or 13 starting with +234)
  // International: +XXXXXXXXXXX (7-15 digits with optional +)
  const phoneRegex = /^(\+?[\d]{7,15})$/;
  if (!phoneRegex.test(stripped)) {
    throw new Error(`Invalid phone number format: "${phone}"`);
  }
}

/**
 * Validates a string field's length.
 * Throws if the string is outside the min/max range.
 */
export function validateStringLength(
  value: string | undefined | null,
  fieldName: string,
  min: number = 0,
  max: number = 1000
): void {
  if (value === undefined || value === null) {
    if (min > 0) throw new Error(`${fieldName} is required.`);
    return;
  }
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }
  if (value.trim().length < min) {
    throw new Error(`${fieldName} must be at least ${min} character(s).`);
  }
  if (value.length > max) {
    throw new Error(`${fieldName} must be at most ${max} characters (currently ${value.length}).`);
  }
}

/**
 * Validates a monetary amount (must be non-negative number).
 */
export function validateAmount(amount: number | undefined | null, fieldName: string = "Amount"): void {
  if (amount === undefined || amount === null) return; // optional
  if (typeof amount !== 'number' || isNaN(amount)) {
    throw new Error(`${fieldName} must be a valid number.`);
  }
  if (amount < 0) {
    throw new Error(`${fieldName} cannot be negative.`);
  }
  if (amount > 999_999_999_999) {
    throw new Error(`${fieldName} exceeds maximum allowed value.`);
  }
}

/**
 * Validates a URL format.
 */
export function validateUrl(url: string | undefined | null, fieldName: string = "URL"): void {
  if (!url || url.trim().length === 0) return; // optional
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid ${fieldName}: "${url}"`);
  }
}

/**
 * Validates an enum value against allowed values.
 */
export function validateEnum<T extends string>(
  value: string,
  allowedValues: T[],
  fieldName: string = "Value"
): void {
  if (!allowedValues.includes(value as T)) {
    throw new Error(`Invalid ${fieldName}: "${value}". Allowed: ${allowedValues.join(', ')}`);
  }
}

/**
 * Sanitizes a string by removing HTML tags and trimming whitespace.
 * Returns the cleaned string. Useful before storing user input.
 */
export function sanitizeString(value: string | undefined | null): string {
  if (!value) return '';
  // Remove script tags and their content
  let cleaned = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove HTML tags (but keep content)
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  // Trim whitespace
  return cleaned.trim();
}

/**
 * Validates a date string (ISO format).
 */
export function validateDateString(
  value: string | undefined | null,
  fieldName: string = "Date"
): void {
  if (!value || value.trim().length === 0) return; // optional
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${fieldName}: "${value}". Expected ISO date format.`);
  }
}

/**
 * Validates a firm ID is present and non-empty.
 * Critical for multi-tenant isolation.
 */
export function validateFirmId(firmId: string | undefined | null): void {
  if (!firmId || firmId.trim().length === 0) {
    throw new Error("Firm ID is required for this operation.");
  }
}

/**
 * Rate limits a mutation by checking a simple counter.
 * Throws if the rate limit is exceeded.
 */
export function validateRateLimit(
  currentCount: number,
  limit: number,
  windowDescription: string = "per hour"
): void {
  if (currentCount >= limit) {
    throw new Error(`Rate limit exceeded (${limit} requests ${windowDescription}). Please try again later.`);
  }
}
