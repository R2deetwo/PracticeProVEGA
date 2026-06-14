/**
 * Invoice Helpers — Dynamic Custom Invoice Numbering Engine
 *
 * Generates firm-branded invoice numbers with the format:
 *   INV-[FirmInitials][ManagerInitials]-[SequentialNumber]
 *
 * Examples:
 *   Solo firm "Avery & Jarvis Legal Practitioner" → INV-AJ-0001
 *   Multi-user with Lead "Mark Anthony"           → INV-AJMA-0001
 *   No firm name set (fallback)                   → INV-ORG-0001
 *
 * CRITICAL: The "Negative Rule"
 * The invoice number string is computed exactly ONCE at creation time and persisted
 * as a plain string field. It is NEVER re-derived from current profile data on read.
 * If the firm name or lead professional changes later, existing invoices remain unchanged.
 */

import { User, UserRole } from '../types';

// ─── Segment 1: Firm/Organization Initials ─────────────────────────────────

/**
 * Extracts the first letter of each primary capitalized word from a firm name,
 * stripping special characters like &, ,, ., -, etc.
 *
 * "Avery & Jarvis Legal Practitioner" → "AJ"
 * "Okafor, Obi & Associates"          → "OOA"
 * "B.H. Chambers"                     → "BHC"
 * "Smith Partners"                    → "SP"
 */
export function extractFirmInitials(firmName: string | undefined | null): string {
    if (!firmName || !firmName.trim()) return 'ORG'; // Profile-incomplete fallback

    // Split on whitespace, then extract leading alpha character from each token
    const tokens = firmName.trim().split(/\s+/);

    const initials: string[] = [];
    for (const token of tokens) {
        // Strip leading non-alpha chars (e.g., "&", ",", ".", "(", "-")
        const cleanToken = token.replace(/^[^A-Za-z]+/, '');
        if (!cleanToken) continue;

        // Skip common connector words that aren't meaningful initials
        const lower = cleanToken.toLowerCase();
        if (['and', '&', 'the', 'of', 'for', 'in', 'at', 'by', 'co', 'lp', 'llp', 'llc', 'ltd', 'plc', 'inc'].includes(lower)) {
            continue;
        }

        initials.push(cleanToken[0].toUpperCase());
    }

    // Cap at 4 initials to keep the prefix readable
    return initials.slice(0, 4).join('') || 'ORG';
}

// ─── Segment 2: Lead Professional Initials (Conditional Multi-User) ───────

/**
 * Determines whether the firm is a multi-user setup.
 * A firm with more than one non-client, non-pending user is considered multi-user.
 */
export function isMultiUserFirm(users: User[]): boolean {
    const activeMembers = users.filter(u =>
        u.role !== UserRole.Client && u.role !== UserRole.Tenant && u.role !== UserRole.Pending && u.role !== UserRole.ExternalCounsel
    );
    return activeMembers.length > 1;
}

/**
 * Finds the lead professional in a multi-user firm.
 * Priority: Admin role (Head of Chambers / Firm Owner / Portfolio Manager).
 * Falls back to the first non-client, non-pending user if no Admin exists.
 *
 * Returns the User object or null if solo/not found.
 */
export function findLeadProfessional(users: User[]): User | null {
    const activeMembers = users.filter(u =>
        u.role !== UserRole.Client && u.role !== UserRole.Tenant && u.role !== UserRole.Pending && u.role !== UserRole.ExternalCounsel
    );

    if (activeMembers.length <= 1) return null; // Solo — omit this segment

    // Priority 1: Admin role (Lead Attorney / Portfolio Manager)
    const admin = activeMembers.find(u => u.role === UserRole.Admin);
    if (admin) return admin;

    // Priority 2: First active member
    return activeMembers[0] || null;
}

/**
 * Extracts initials from a person's name.
 * Takes the first letter of the first name and the first letter of the last name.
 * "Mark Anthony" → "MA"
 * "Chukwuemeka Okafor" → "CO"
 * "Amina" → "A"  (single name)
 */
export function extractPersonInitials(name: string | undefined | null): string {
    if (!name || !name.trim()) return '';

    const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 0) return '';

    if (parts.length === 1) return parts[0][0].toUpperCase();

    // First letter of first name + first letter of last name
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ─── Full Invoice Number Assembly ──────────────────────────────────────────

export interface InvoiceNumberContext {
    firmName: string | undefined | null;
    users: User[];
    existingInvoiceCount: number;
}

/**
 * Generates a complete, firm-branded invoice number.
 *
 * Format: INV-[FirmInitials][ManagerInitials]-[SequentialNumber]
 *
 * - Solo firms: INV-AJ-0001 (no manager segment)
 * - Multi-user: INV-AJMA-0001 (includes lead professional initials)
 * - No firm name: INV-ORG-0001 (fallback to encourage profile completion)
 *
 * The sequential number is zero-padded to 4 digits and increments based on
 * the count of existing invoices. This ensures uniqueness across the firm.
 *
 * IMPORTANT: Call this exactly once at invoice creation time.
 * Persist the result as a string — never recompute on read.
 */
export function generateInvoiceNumber(context: InvoiceNumberContext): string {
    const { firmName, users, existingInvoiceCount } = context;

    // Segment 1: Firm initials
    const firmSegment = extractFirmInitials(firmName);

    // Segment 2: Lead professional initials (only for multi-user)
    let leadSegment = '';
    if (isMultiUserFirm(users)) {
        const lead = findLeadProfessional(users);
        if (lead) {
            leadSegment = extractPersonInitials(lead.name);
        }
    }

    // Segment 3: Sequential number (4-digit zero-padded)
    const sequence = String(existingInvoiceCount + 1).padStart(4, '0');

    return `INV-${firmSegment}${leadSegment}-${sequence}`;
}

/**
 * Generates a receipt number following the same firm-branded convention.
 * Format: REC-[FirmInitials][ManagerInitials]-[SequentialNumber]
 */
export function generateReceiptNumber(context: InvoiceNumberContext): string {
    const { firmName, users, existingInvoiceCount } = context;

    const firmSegment = extractFirmInitials(firmName);

    let leadSegment = '';
    if (isMultiUserFirm(users)) {
        const lead = findLeadProfessional(users);
        if (lead) {
            leadSegment = extractPersonInitials(lead.name);
        }
    }

    const sequence = String(existingInvoiceCount + 1).padStart(4, '0');

    return `REC-${firmSegment}${leadSegment}-${sequence}`;
}
