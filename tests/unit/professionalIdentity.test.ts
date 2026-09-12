import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    formatFirmLegalName,
    formatProfessionalTitle,
    formatSignerBlock,
    savePendingIdentity,
    readPendingIdentity,
    clearPendingIdentity,
    PROFESSIONAL_TITLES,
    LEGAL_ENTITY_TYPES,
} from '../../src/utils/professionalIdentity';

describe('formatFirmLegalName — the name at the top of the page and on correspondence', () => {
    it('bare name when no legal form is set', () => {
        expect(formatFirmLegalName({ name: 'Atrium Estates' })).toBe('Atrium Estates');
        expect(formatFirmLegalName({ name: 'Atrium Estates', legalEntityType: '' })).toBe('Atrium Estates');
    });

    it('appends the short suffix for the common forms', () => {
        expect(formatFirmLegalName({ name: 'Atrium Estates', legalEntityType: 'Limited Liability Company (Ltd)' })).toBe('Atrium Estates Ltd');
        expect(formatFirmLegalName({ name: 'Atrium Holdings', legalEntityType: 'Public Limited Company (PLC)' })).toBe('Atrium Holdings PLC');
        expect(formatFirmLegalName({ name: 'Atrium Partners', legalEntityType: 'Limited Liability Partnership (LLP)' })).toBe('Atrium Partners LLP');
        expect(formatFirmLegalName({ name: 'Atrium Union', legalEntityType: 'Cooperative Society' })).toBe('Atrium Union Cooperative');
    });

    it('never double-suffixes a name that already carries its form', () => {
        expect(formatFirmLegalName({ name: 'Atrium Estates Ltd', legalEntityType: 'Limited Liability Company (Ltd)' })).toBe('Atrium Estates Ltd');
        expect(formatFirmLegalName({ name: 'The Estate of A. N. Other', legalEntityType: 'Trust / Estate Administration' })).toBe('The Estate of A. N. Other');
    });

    it('forms with no natural suffix (sole prop, trust) keep the bare name', () => {
        expect(formatFirmLegalName({ name: 'Ada Obi & Co', legalEntityType: 'Sole Proprietorship' })).toBe('Ada Obi & Co');
        expect(formatFirmLegalName({ name: 'The Estate of X', legalEntityType: 'Trust / Estate Administration' })).toBe('The Estate of X');
    });

    it("'Other' renders the custom form — appended or joined without duplication", () => {
        expect(formatFirmLegalName({ name: 'Atrium Group', legalEntityType: 'Other', legalEntityCustom: 'Family Investment Vehicle' }))
            .toBe('Atrium Group (Family Investment Vehicle)');
        expect(formatFirmLegalName({ name: 'Atrium Group', legalEntityType: 'Other', legalEntityCustom: 'The Estate of Chief A. N. Other' }))
            .toBe('Atrium Group — The Estate of Chief A. N. Other');
        expect(formatFirmLegalName({ name: 'The Estate of Chief A. N. Other', legalEntityType: 'Other', legalEntityCustom: 'Estate Administration' }))
            .toBe('The Estate of Chief A. N. Other');
    });

    it('empty name → empty string', () => {
        expect(formatFirmLegalName({ name: '', legalEntityType: 'Limited Liability Company (Ltd)' })).toBe('');
    });
});

describe('formatProfessionalTitle — the person', () => {
    it('returns the preset title directly', () => {
        expect(formatProfessionalTitle({ professionalTitle: 'Property Manager' })).toBe('Property Manager');
        expect(formatProfessionalTitle({ professionalTitle: 'Facilities Manager' })).toBe('Facilities Manager');
    });

    it("'Other' resolves to the custom text", () => {
        expect(formatProfessionalTitle({ professionalTitle: 'Other', titleCustom: 'Head of Estate Operations' })).toBe('Head of Estate Operations');
    });

    it('empty → empty string', () => {
        expect(formatProfessionalTitle({})).toBe('');
    });
});

describe('formatSignerBlock — correspondence signature line', () => {
    it('person + title + firm', () => {
        expect(formatSignerBlock({
            userName: 'Ada Obi',
            professionalTitle: 'Property Administrator',
            firmLegalName: 'Atrium Estates Ltd',
        })).toBe('Ada Obi — Property Administrator, Atrium Estates Ltd');
    });

    it('degrades gracefully when pieces are missing', () => {
        expect(formatSignerBlock({ userName: 'Ada Obi' })).toBe('Ada Obi');
        expect(formatSignerBlock({ firmLegalName: 'Atrium Estates Ltd' })).toBe('Atrium Estates Ltd');
        expect(formatSignerBlock({})).toBe('');
    });
});

describe('preset lists', () => {
    it('include the legally-recognised ways to describe oneself + Other', () => {
        expect(PROFESSIONAL_TITLES).toContain('Property Manager');
        expect(PROFESSIONAL_TITLES).toContain('Facilities Manager');
        expect(PROFESSIONAL_TITLES).toContain('Property Administrator');
        expect(PROFESSIONAL_TITLES).toContain('Other');
    });

    it('include the common Nigerian entity forms + Other', () => {
        expect(LEGAL_ENTITY_TYPES).toContain('Limited Liability Company (Ltd)');
        expect(LEGAL_ENTITY_TYPES).toContain('Cooperative Society');
        expect(LEGAL_ENTITY_TYPES).toContain('Incorporated Trustees');
        expect(LEGAL_ENTITY_TYPES).toContain('Trust / Estate Administration');
        expect(LEGAL_ENTITY_TYPES).toContain('Other');
    });
});

describe('pending identity (signup → first app load)', () => {
    beforeEach(() => {
        vi.stubGlobal('window', { localStorage: undefined });
        // Provide a real in-memory localStorage for each test.
        const store = new Map<string, string>();
        vi.stubGlobal('localStorage', {
            getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
            setItem: (k: string, v: string) => { store.set(k, v); },
            removeItem: (k: string) => { store.delete(k); },
        });
    });

    it('round-trips saved values and skips empties', () => {
        savePendingIdentity({ professionalTitle: 'Property Manager', legalEntityType: '', titleCustom: '' });
        const read = readPendingIdentity();
        expect(read).toEqual({ professionalTitle: 'Property Manager' });
        clearPendingIdentity();
        expect(readPendingIdentity()).toBeNull();
    });

    it('a wholly-empty submission writes nothing', () => {
        savePendingIdentity({ legalEntityType: '', titleCustom: '', professionalTitle: '' });
        expect(readPendingIdentity()).toBeNull();
    });
});
