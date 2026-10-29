/**
 * scaleOfCharges — the Legal Practitioners Remuneration (For Business,
 * Legal Service and Representation) Order 2023, Scale 4 (property
 * transactions), as deterministic arithmetic.
 *
 * R40 (owner direction: "look at every word said on the Vega site — if the
 * app doesn't do it yet, make sure it can"): the site's Scale-of-Charges
 * band claims "every line item is computed on the Scale of Charges under
 * the Remuneration Order 2023." This util is that computation, wired into
 * the invoice form for land-documentation matters.
 *
 * THE SCHEDULE (Scale 4 — preparation of agreements and land documents;
 * NBA enforcement protocol, Remuneration Committee):
 *
 *   · Property value below ₦50,000,000 ............ 10% (not negotiable)
 *   · ₦50m – ₦100m ......... ₦5,000,000 for the first ₦50m
 *                            + 5% of the amount above ₦50m
 *   · Above ₦100m ........... ₦7,500,000 for the first ₦100m
 *                            + 3% of the amount above ₦100m
 *
 * The bands are progressive and continuous (₦5m + 5%·₦50m = ₦7.5m at the
 * ₦100m boundary). Deviation below the scale for land documentation may
 * constitute professional misconduct — the compliance note says so.
 *
 * For matters that are NOT land documentation the Order prescribes no
 * statutory scale (fees are discretionary, subject to agreement and
 * reasonableness) — `scaleAppliesToMatter` encodes that boundary so the
 * app never implies a scale where none exists.
 */

import { Matter, MatterType } from '../types';

/** One computed band of the progressive schedule. */
export interface ScaleBand {
    /** What this band covers, e.g. "First ₦50,000,000". */
    label: string;
    /** The rate applied in this band, e.g. "10%". */
    rateLabel: string;
    /** The naira amount charged by this band. */
    amount: number;
}

/** A fee note computed on the Scale. */
export interface ScaleFeeNote {
    /** The property/transaction value the note is computed on. */
    propertyValue: number;
    /** The progressive bands, in order. */
    bands: ScaleBand[];
    /** Total professional fee. */
    total: number;
    /** The statutory reference printed on the fee note. */
    statutoryRef: string;
    /** Professional-practice note. */
    complianceNote: string;
}

const FIFTY_M = 50_000_000;
const HUNDRED_M = 100_000_000;

export const SCALE_4_REFERENCE =
    'Legal Practitioners Remuneration (For Business, Legal Service and Representation) Order 2023 — Scale 4 (property transactions)';

export const SCALE_4_COMPLIANCE_NOTE =
    'Fees for the preparation of agreements and land documents are prescribed by Scale 4 of the Remuneration Order 2023. Charging below the scale may constitute professional misconduct.';

/** Matter types whose documentation the land scale covers. */
export const LAND_DOCUMENTATION_MATTER_TYPES: MatterType[] = [
    MatterType.RealEstate,
];

/** Does the statutory land scale apply to this matter? */
export function scaleAppliesToMatter(matter?: Matter | null): boolean {
    if (!matter) return false;
    return LAND_DOCUMENTATION_MATTER_TYPES.includes(matter.type);
}

const fmtM = (n: number) => `₦${(n / 1_000_000).toFixed(0)}m`;

/** Compute the Scale 4 professional fee for a property value, band by band. */
export function computeScaleFeeNote(propertyValue: number): ScaleFeeNote {
    const value = Math.max(0, Math.round(propertyValue));
    const bands: ScaleBand[] = [];

    if (value <= 0) {
        return {
            propertyValue: value,
            bands: [],
            total: 0,
            statutoryRef: SCALE_4_REFERENCE,
            complianceNote: SCALE_4_COMPLIANCE_NOTE,
        };
    }

    if (value <= FIFTY_M) {
        // Band I — 10%, not negotiable
        bands.push({
            label: `Property value below ${fmtM(FIFTY_M)}`,
            rateLabel: '10%',
            amount: Math.round(value * 0.1),
        });
    } else if (value <= HUNDRED_M) {
        // Band II — ₦5m for the first ₦50m + 5% of the excess
        bands.push({ label: `First ${fmtM(FIFTY_M)}`, rateLabel: '10%', amount: FIFTY_M * 0.1 });
        const excess = value - FIFTY_M;
        bands.push({
            label: `Next ${fmtM(excess)} (above ${fmtM(FIFTY_M)}, up to ${fmtM(HUNDRED_M)})`,
            rateLabel: '5%',
            amount: Math.round(excess * 0.05),
        });
    } else {
        // Band III — ₦7.5m for the first ₦100m + 3% of the excess
        bands.push({ label: `First ${fmtM(FIFTY_M)}`, rateLabel: '10%', amount: FIFTY_M * 0.1 });
        bands.push({
            label: `Next ${fmtM(FIFTY_M)} (to ${fmtM(HUNDRED_M)})`,
            rateLabel: '5%',
            amount: Math.round((HUNDRED_M - FIFTY_M) * 0.05),
        });
        const excess = value - HUNDRED_M;
        bands.push({
            label: `Next ${fmtM(excess)} (above ${fmtM(HUNDRED_M)})`,
            rateLabel: '3%',
            amount: Math.round(excess * 0.03),
        });
    }

    const total = bands.reduce((s, b) => s + b.amount, 0);
    return { propertyValue: value, bands, total, statutoryRef: SCALE_4_REFERENCE, complianceNote: SCALE_4_COMPLIANCE_NOTE };
}
