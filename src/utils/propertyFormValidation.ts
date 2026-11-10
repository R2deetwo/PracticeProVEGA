/**
 * propertyFormValidation — ROUND E (Wave E3): the intelligent-forms brain
 * for PropertyForm, extracted as PURE functions so every rule is unit-
 * testable without mounting the 2,300-line form.
 * ─────────────────────────────────────────────────────────────────────────
 * The owner brief (§3 — intelligent forms) asks for: required-field
 * validation with clear errors, sensible defaults, conditional fields,
 * duplicate detection, and never re-entering information the system
 * already has. Until E3 the form's only guards were two toasts (address
 * non-empty + Unit-1 rent) — Unit 2+ could save rentless, an invalid
 * email or an inverted lease window sailed through, and NOTHING anywhere
 * detected a duplicate unit at the same address.
 *
 * Rules implemented here (each pinned by tests/unit/roundEWave3.test.ts):
 *   • address required (trimmed non-empty)
 *   • rent required on EVERY rent-collecting unit (the old guard only
 *     checked Unit 1 — a multi-unit save silently created rentless rows)
 *   • lease window: when both dates set, end ≥ start
 *   • resident email: optional, but when present must be a valid address
 *     (it drives portal invites + the E1/E2 resident identity merge)
 *   • resident phone: optional, but when present must carry ≥ 7 digits
 *     (the same threshold matchResidentContact uses to match a contact)
 *   • money fields non-negative; management fee 0–100;
 *     service-charge months-in-advance 0–24
 *   • duplicate detection: same normalized address + same normalized unit
 *     name on a row OUTSIDE this edit session = a duplicate hit (the
 *     same-address sibling rows INSIDE the session are the legitimate
 *     multi-unit model, never a hit); a same-address row under a
 *     DIFFERENT owner contact is reported separately as an owner clash
 *
 * Everything here is read-only over its arguments — no React, no context.
 */

import { normalizeAddress } from './formatting';

// ── Field error shapes ───────────────────────────────────────────────────────

/** Errors keyed by form-level field name (address, managementFee, …). */
export type FormErrors = Record<string, string>;
/** Per-unit errors: unitIndex → field → message. */
export type UnitErrors = Record<number, Record<string, string>>;

export interface UnitLike {
    unitName?: string | null;
    rentAmount?: number | string | null;
    leaseStart?: string | null;
    leaseEnd?: string | null;
    tenantEmail?: string | null;
    tenantPhone?: string | null;
    serviceChargeAmount?: number | string | null;
    serviceChargeMonthsInAdvance?: number | null;
    legalFee?: number | null;
    agencyFee?: number | null;
    cautionDeposit?: number | null;
}

export interface ValidateArgs {
    address: string;
    units: UnitLike[];
    /** 'Tenanted Property' + Full collection → rent required per unit. */
    rentCollecting: boolean;
    isTenanted: boolean;
    managementFee?: number;
    minimumVendAmount?: number | string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const digits = (s: unknown): string => String(s ?? '').replace(/\D/g, '');

export const isValidEmail = (s: unknown): boolean => {
    const v = String(s ?? '').trim();
    return !v || EMAIL_RE.test(v);
};

export const isValidPhone = (s: unknown): boolean => {
    const v = String(s ?? '').trim();
    return !v || digits(v).length >= 7;
};

/**
 * Validate the whole form. Returns { errors, unitErrors } — both EMPTY
 * objects when everything passes. Pure: same inputs → same outputs.
 */
export function validatePropertyForm(args: ValidateArgs): { errors: FormErrors; unitErrors: UnitErrors } {
    const errors: FormErrors = {};
    const unitErrors: UnitErrors = {};

    if (!String(args.address ?? '').trim()) {
        errors.address = 'Property address is required.';
    }

    const rentRequired = args.rentCollecting && args.isTenanted;
    for (let i = 0; i < (args.units?.length ?? 0); i++) {
        const u = args.units[i];
        const e: Record<string, string> = {};

        // Rent required for EVERY rent-collecting unit — the E3 fix for the
        // Unit-1-only guard (a 6-unit save used to validate just Unit 1).
        if (rentRequired && !(Number(u.rentAmount) > 0)) {
            e.rentAmount = `Rent amount is required for ${u.unitName || `Unit ${i + 1}`}.`;
        }

        // Lease window (only when both ends are known).
        const ls = String(u.leaseStart ?? '').slice(0, 10);
        const le = String(u.leaseEnd ?? '').slice(0, 10);
        if (ls && le && le < ls) {
            e.leaseEnd = 'Lease end cannot be before lease start.';
        }

        // Resident contactability — optional but valid when present.
        if (!isValidEmail(u.tenantEmail)) {
            e.tenantEmail = 'Enter a valid email address (or leave it blank).';
        }
        if (!isValidPhone(u.tenantPhone)) {
            e.tenantPhone = 'Phone number needs at least 7 digits (or leave it blank).';
        }

        // Money sanity.
        if (Number(u.serviceChargeAmount) < 0) e.serviceChargeAmount = 'Service charge cannot be negative.';
        const adv = Number(u.serviceChargeMonthsInAdvance);
        if (!Number.isNaN(adv) && (adv < 0 || adv > 24)) e.serviceChargeMonthsInAdvance = 'Months in advance must be between 0 and 24.';
        if (Number(u.legalFee) < 0) e.legalFee = 'Legal fee cannot be negative.';
        if (Number(u.agencyFee) < 0) e.agencyFee = 'Agency fee cannot be negative.';
        if (Number(u.cautionDeposit) < 0) e.cautionDeposit = 'Caution deposit cannot be negative.';

        if (Object.keys(e).length) unitErrors[i] = e;
    }

    const mf = Number(args.managementFee);
    if (!Number.isNaN(mf) && (mf < 0 || mf > 100)) {
        errors.managementFee = 'Management fee must be between 0 and 100%.';
    }
    if (Number(args.minimumVendAmount) < 0) {
        errors.minimumVendAmount = 'Minimum vend amount cannot be negative.';
    }

    return { errors, unitErrors };
}

// ── Duplicate detection (live, over the firm's property rows) ────────────────

export interface PropertyRowLike {
    id?: string | null;
    _id?: string | null;
    address?: string | null;
    status?: string | null;
    contactId?: string | null;
    rentalDetails?: { unitName?: string | null } | null;
}

export interface DuplicateUnitHit {
    /** The form unit index whose name is already taken at this address. */
    formUnitIndex: number;
    formUnitName: string;
    /** The existing row's unit/property id (custom id preferred). */
    existingId: string;
    existingUnitName: string;
}

export interface DuplicateScanResult {
    /** Same address + same unit name on a row outside this edit session. */
    duplicateUnits: DuplicateUnitHit[];
    /** Same address under a DIFFERENT owner contact (a data-integrity smell). */
    otherOwnerRows: number;
}

const normUnit = (s: unknown): string => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Scan the firm's property rows for duplicates of the form's address +
 * unit names. Rows belonging to THIS edit session (matched by id/_id, or
 * by being the propertyToEdit itself) are the legitimate sibling model —
 * never duplicates. Pure; called on every keystroke via useMemo.
 */
export function scanForDuplicateUnits(args: {
    properties: PropertyRowLike[];
    address: string;
    units: Array<{ unitName?: string | null; id?: string | null; _id?: string | null }>;
    /** The edit session's own row ids (custom ids + Convex _ids). */
    editingIds?: Array<string | null | undefined>;
    /** The owner contact this form is saving under. */
    ownerContactId?: string | null;
}): DuplicateScanResult {
    const addrKey = normalizeAddress(args.address || '');
    if (!addrKey) return { duplicateUnits: [], otherOwnerRows: 0 };

    const ownIds = new Set(
        (args.editingIds ?? []).concat(args.units.map((u) => u.id), args.units.map((u) => u._id))
            .filter((x): x is string => !!x)
            .map(String)
    );

    const formUnitNames = new Map<string, number>();
    (args.units ?? []).forEach((u, i) => {
        const n = normUnit(u.unitName);
        if (n) formUnitNames.set(n, i);
    });

    const duplicateUnits: DuplicateUnitHit[] = [];
    let otherOwnerRows = 0;
    const seenExisting = new Set<string>();

    for (const p of args.properties ?? []) {
        if (String(p.status ?? '') === 'Deleted') continue;
        const pAddr = normalizeAddress(p.address ?? '');
        if (pAddr !== addrKey) continue;

        const pid = String(p.id ?? p._id ?? '');
        const inSession = ownIds.has(String(p.id ?? '')) || ownIds.has(String(p._id ?? ''));
        if (!inSession && args.ownerContactId && p.contactId && String(p.contactId) !== String(args.ownerContactId)) {
            otherOwnerRows++;
        }
        if (inSession) continue;

        // The existing row's unit identity: standalone rows carry the unit
        // name in rentalDetails.unitName (missing → the address itself is
        // the unit — treat as "Unit" collisions only when the form also
        // has an unnamed unit).
        const exName = normUnit(p.rentalDetails?.unitName ?? '') || normUnit(String(p.address ?? '').split(',')[0]);
        const hitIndex = formUnitNames.get(exName);
        if (hitIndex !== undefined && !seenExisting.has(pid)) {
            seenExisting.add(pid);
            duplicateUnits.push({
                formUnitIndex: hitIndex,
                formUnitName: String(args.units[hitIndex]?.unitName ?? ''),
                existingId: pid,
                existingUnitName: p.rentalDetails?.unitName || String(p.address ?? '').split(',')[0],
            });
        }
    }

    return { duplicateUnits, otherOwnerRows };
}
