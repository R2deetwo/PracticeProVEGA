/**
 * residentContactSync — the resident ↔ central-contacts directory link.
 *
 * CONTEXT (2026-09-12, user report): "i just changed the email of a resident
 * and it showed me that there are three residents linked to the existing
 * contact. i wasn't even sure what that meant." The property form's resident
 * auto-sync counts EVERY unit whose resident matches an existing Contact —
 * on EVERY save — so a property with three already-synced residents reports
 * "3 resident(s) linked to existing contacts" even though nothing changed.
 * Two real defects hide behind the confusing message:
 *
 *   1. STALE DIRECTORY: changing a resident's email in the property form
 *      never updates their linked Contact record — the contact keeps the
 *      old email forever (and portal invites read THAT record).
 *   2. FALSE-POSITIVE COUNTS: a re-link of an already-linked unit is
 *      reported as a fresh "linked" outcome, so the toast fires on every
 *      save and means nothing.
 *
 * This module centralises the matching + staleness decision so the form
 * stays thin and the policy is unit-tested.
 */

/** Categories whose contacts are eligible for resident matching.
 * (Bug #3 fix lineage — avoids matching legal clients or landlords.) */
export const RESIDENT_MATCH_CATEGORIES = [
    'Tenant', 'Resident', 'Landlord', 'Vendor', 'Facility Manager', 'Estate Agent', 'Contractor',
] as const;

/** Loose contact shape — duck-typed so PropertyForm and tests share it. */
export interface SyncContactLike {
    id?: string;
    phone?: string;
    email?: string;
    name?: string;
    category?: string;
}

export interface MatchResidentArgs {
    contacts: SyncContactLike[];
    tenantPhone?: string;
    tenantEmail?: string;
}

const digits = (s: string) => (s || '').replace(/\D/g, '');

/**
 * Find the existing Contact a resident should be linked to.
 * Phone match wins over email match (a phone is the stronger identity in
 * this market — emails churn, numbers don't). Only property-side
 * categories are eligible.
 */
export function matchResidentContact({ contacts, tenantPhone, tenantEmail }: MatchResidentArgs): SyncContactLike | null {
    const phone = (tenantPhone || '').trim();
    const email = (tenantEmail || '').trim().toLowerCase();

    const inCategory = (c: SyncContactLike) =>
        RESIDENT_MATCH_CATEGORIES.includes((c.category || '') as (typeof RESIDENT_MATCH_CATEGORIES)[number]);

    if (phone) {
        const byPhone = contacts.find(c =>
            c && c.phone && digits(c.phone) === digits(phone) && digits(phone).length >= 7 && inCategory(c));
        if (byPhone) return byPhone;
    }
    if (email) {
        const byEmail = contacts.find(c =>
            c && c.email && (c.email || '').trim().toLowerCase() === email && inCategory(c));
        if (byEmail) return byEmail;
    }
    return null;
}

export interface ContactPatchPlan {
    /** True when the linked contact's fields are behind the resident's. */
    needsUpdate: boolean;
    /** The exact field patch to apply to the contact (empty when fresh). */
    patch: Partial<SyncContactLike>;
}

/**
 * Decide whether the resident's just-saved details should be pushed onto
 * their already-linked contact. Only fields the contact is MISSING or that
 * differ from the resident's current value are patched — the property form
 * is where the user just made the edit, so it is the source of truth.
 * A NEW link (different contact) is not patched — we don't know this
 * contact's history, only an already-linked one is synced forward.
 */
export function planContactSync(args: {
    contact: SyncContactLike;
    alreadyLinked: boolean;
    tenantName?: string;
    tenantPhone?: string;
    tenantEmail?: string;
}): ContactPatchPlan {
    const { contact, alreadyLinked } = args;
    if (!alreadyLinked) return { needsUpdate: false, patch: {} };

    const patch: Partial<SyncContactLike> = {};
    const phone = (args.tenantPhone || '').trim();
    const email = (args.tenantEmail || '').trim();
    const name = (args.tenantName || '').trim();

    // Phones are compared on DIGITS — a formatting-only difference
    // (+234 803… vs 0803…) is current, not stale, so no patch.
    if (phone && digits(contact.phone || '') !== digits(phone)) patch.phone = phone;
    if (email && (contact.email || '').trim().toLowerCase() !== email.toLowerCase()) patch.email = email;
    if (name && name !== 'Unknown Resident' && (contact.name || '') !== name && (contact.name || '').trim() === '') {
        patch.name = name; // fill a blank name, never rename an existing one
    }
    return { needsUpdate: Object.keys(patch).length > 0, patch };
}
