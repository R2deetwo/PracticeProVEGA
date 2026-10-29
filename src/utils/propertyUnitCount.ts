/**
 * propertyUnitCount — R41: how many units a property card counts.
 *
 * Owner direction (R41): the Properties list (the middle panel of the
 * workspace split view) is supposed to say HOW MANY UNITS each property
 * has — "it mentions how many units are within that property… we are
 * supposed to have that showing there." It never showed: the old list
 * computed the count by grouping property ROWS that share an address,
 * but a multi-unit property is ONE row with an embedded units array
 * (and a numberOfUnits field the forms write), so Parkview Gardens
 * counted 1 and the chip (rendered only when count > 1) never appeared.
 *
 * Resolution order for a property's OWN inventory:
 *   1. numberOfUnits — the field PropertyForm / SmartMatterModal write
 *      (the manager's declaration of the estate's size);
 *   2. units.length — the embedded unit records actually on the row;
 *   3. 0 — no declared and no embedded units.
 *
 * A property with zero of both is still one leteable/sellable occupancy
 * (its own single lease, or itself) — the list treats it as 1. Extra
 * rows grouped at the same address each add their own base, so the
 * legacy multi-row shape keeps counting the same way it always did.
 */

/** The property's own unit inventory: declared, else embedded, else 0. */
export function resolveOwnUnitCount(
    property: { numberOfUnits?: number; units?: unknown[] }
): number {
    const declared = Number(property.numberOfUnits) || 0;
    if (declared > 0) return declared;
    const embedded = Array.isArray(property.units) ? property.units.length : 0;
    if (embedded > 0) return embedded;
    return 0;
}

/** The base a property row contributes to its address group:
 *  its own inventory, or 1 when it declares none (a single-occupancy
 *  record — the property is its own one unit). Never 0, so a group of
 *  N bare rows counts N like it always did. */
export function unitCountBase(
    property: { numberOfUnits?: number; units?: unknown[] }
): number {
    return Math.max(resolveOwnUnitCount(property), 1);
}

/** The chip label: "1 Unit" / "8 Units". Null when there is nothing to
 *  show (should not happen for real rows — kept defensive). */
export function unitCountLabel(count: number): string | null {
    if (!Number.isFinite(count) || count < 1) return null;
    return `${count} ${count === 1 ? 'Unit' : 'Units'}`;
}
