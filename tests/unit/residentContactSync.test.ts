import { describe, it, expect } from 'vitest';
import {
    matchResidentContact,
    planContactSync,
    RESIDENT_MATCH_CATEGORIES,
} from '../../src/utils/residentContactSync';

const contacts = [
    { id: 'c1', name: 'Ada Obi', phone: '+234 803 111 2233', email: 'ada@old.example', category: 'Tenant' },
    { id: 'c2', name: 'Bulk Vendor', phone: '+234 803 999 8877', email: 'vendor@example', category: 'Vendor' },
    { id: 'c3', name: 'Legal Client', phone: '+234 700 000 0000', email: 'client@law.example', category: 'Client' },
];

describe('matchResidentContact', () => {
    it('matches by phone across formatting differences', () => {
        const m = matchResidentContact({ contacts, tenantPhone: '+2348031112233' });
        expect(m?.id).toBe('c1');
    });

    it('matches by email case-insensitively', () => {
        const m = matchResidentContact({ contacts, tenantEmail: 'ADA@OLD.EXAMPLE' });
        expect(m?.id).toBe('c1');
    });

    it('phone match wins over email match', () => {
        const m = matchResidentContact({
            contacts: [
                ...contacts,
                { id: 'c4', phone: '', email: 'ada@old.example', category: 'Tenant' },
            ],
            tenantPhone: '+2348031112233',
            tenantEmail: 'ada@old.example',
        });
        expect(m?.id).toBe('c1');
    });

    it('never matches a non-property category (legal clients etc.)', () => {
        const m = matchResidentContact({ contacts, tenantEmail: 'client@law.example' });
        expect(m).toBeNull();
    });

    it('ignores too-short digit collisions', () => {
        const short = [{ id: 'x', phone: '123', category: 'Tenant' }];
        expect(matchResidentContact({ contacts: short, tenantPhone: '12345' })).toBeNull();
    });

    it('returns null when nothing matches', () => {
        expect(matchResidentContact({ contacts, tenantEmail: 'nobody@example' })).toBeNull();
    });

    it('category allowlist contains the property-side categories', () => {
        expect(RESIDENT_MATCH_CATEGORIES).toContain('Tenant');
        expect(RESIDENT_MATCH_CATEGORIES).not.toContain('Client');
    });
});

describe('planContactSync', () => {
    const linked = { id: 'c1', name: 'Ada Obi', phone: '+234 803 111 2233', email: 'ada@old.example', category: 'Tenant' };

    it('flags a changed email on an already-linked contact', () => {
        const { needsUpdate, patch } = planContactSync({
            contact: linked, alreadyLinked: true,
            tenantName: 'Ada Obi', tenantPhone: '+234 803 111 2233', tenantEmail: 'ada@new.example',
        });
        expect(needsUpdate).toBe(true);
        expect(patch).toEqual({ email: 'ada@new.example' });
    });

    it('does not patch a fresh link (unknown history)', () => {
        const { needsUpdate } = planContactSync({
            contact: linked, alreadyLinked: false,
            tenantEmail: 'whatever@example',
        });
        expect(needsUpdate).toBe(false);
    });

    it('no update when the contact is already current', () => {
        const { needsUpdate, patch } = planContactSync({
            contact: linked, alreadyLinked: true,
            tenantName: 'Ada Obi', tenantPhone: '+2348031112233', tenantEmail: 'ada@old.example',
        });
        expect(needsUpdate).toBe(false);
        expect(patch).toEqual({});
    });

    it('a different number (not just formatting) is patched', () => {
        const { needsUpdate, patch } = planContactSync({
            contact: linked, alreadyLinked: true, tenantPhone: '08039998877',
        });
        expect(needsUpdate).toBe(true);
        expect(patch).toEqual({ phone: '08039998877' });
    });

    it('fills a blank contact name but never renames an existing one', () => {
        const blank = { ...linked, name: '' };
        const fill = planContactSync({
            contact: blank, alreadyLinked: true, tenantName: 'Ada Obi',
        });
        expect(fill.patch.name).toBe('Ada Obi');

        const named = planContactSync({
            contact: linked, alreadyLinked: true, tenantName: 'Someone Else',
        });
        expect(named.patch.name).toBeUndefined();
    });
});
