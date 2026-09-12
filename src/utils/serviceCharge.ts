/**
 * Unified service-charge resolution — the single source of truth for
 * "what service charge does this unit carry?".
 *
 * WHY THIS EXISTS (the bug this locks out):
 *   PropertyDetailView carried three independent `||` fallback chains
 *   (~1364, ~2016, ~2142) plus two more inline reads. `||` treats 0 as
 *   falsy, so a unit that is GENUINELY exempt (service charge = 0)
 *   silently fell through to the rental record, the parent property's
 *   default, or a stale sibling field — and the three chains disagreed
 *   with each other, with the tenant portal, and with the billing
 *   ledger about what the unit actually pays. Seven other components
 *   already used the 0-safe `??` idiom, but each with a slightly
 *   different fallback order.
 *
 * RESOLUTION PRIORITY (first DEFINED value wins; 0 is a REAL value at
 * every level — undefined/null/NaN/blank are skipped):
 *
 *   1. unit.serviceChargeAmount      — top-level field (legacy embedded units)
 *   2. rental.serviceChargeAmount    — unit.rentalDetails.serviceChargeAmount
 *                                      (modern rows; the current-cycle total
 *                                      the form labels "Total Service Charge
 *                                      Due — for the current billing period")
 *   3. unit.serviceCharge            — top-level field (legacy embedded units;
 *                                      the form labels it "Monthly Service
 *                                      Charge" — the per-period rate)
 *   4. rental.serviceCharge          — unit.rentalDetails.serviceCharge
 *                                      (the contracted rate)
 *   5. property.serviceCharge        — parent property default, read from
 *                                      defaultProperty.rentalDetails.serviceCharge
 *                                      then defaultProperty.serviceCharge
 *   6. 0                             — ONLY when every level is undefined
 *
 * `rental` defaults to `unit.rentalDetails` when omitted, so a caller
 * holding only a unit record gets the full unit-level chain for free.
 *
 * The `source` field on the resolution is a dev-mode debug aid: views
 * surface it as a tooltip / data attribute when import.meta.env.DEV,
 * so "where did this number come from?" is answerable at a glance.
 */

export type ServiceChargeSource =
    | 'unit.serviceChargeAmount'
    | 'rental.serviceChargeAmount'
    | 'unit.serviceCharge'
    | 'rental.serviceCharge'
    | 'property.serviceCharge'
    | 'none';

export interface ResolveServiceChargeArgs {
    /** Unit record — modern Property rows carry rentalDetails; legacy embedded units carry top-level fields. */
    unit?: Record<string, any> | null;
    /** The unit's rentalDetails — defaults to unit.rentalDetails when omitted. */
    rental?: Record<string, any> | null;
    /** Parent property — last-resort fallback for units with no service charge of their own. */
    defaultProperty?: Record<string, any> | null;
}

export interface ServiceChargeResolution {
    /** Resolved amount. 0 means "resolved to zero" (exempt), not "unset". */
    amount: number;
    /** Which priority level won — dev-mode debug field. */
    source: ServiceChargeSource;
}

/**
 * Coerce a raw field into a finite number, skipping "unset" markers.
 * undefined / null / NaN / empty-or-blank string → undefined (keep walking
 * the chain). 0 → 0 (STOP — it is a real value). Numeric strings ("500")
 * are coerced. Booleans and objects are treated as unset.
 */
function toFiniteNumber(raw: unknown): number | undefined {
    if (raw == null) return undefined;
    if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return undefined;
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
}

/**
 * Resolve a unit's service charge through the unified priority chain.
 * See the module docblock for the level order and the 0-is-valid rule.
 */
export function resolveServiceCharge(args: ResolveServiceChargeArgs): ServiceChargeResolution {
    const a = (args ?? {}) as ResolveServiceChargeArgs;
    const unit = (a.unit ?? {}) as Record<string, any>;
    const rental = (a.rental ?? unit.rentalDetails ?? {}) as Record<string, any>;
    const property = (a.defaultProperty ?? {}) as Record<string, any>;
    const propertyRental = (property.rentalDetails ?? {}) as Record<string, any>;

    const levels: Array<[ServiceChargeSource, unknown]> = [
        ['unit.serviceChargeAmount', unit.serviceChargeAmount],
        ['rental.serviceChargeAmount', rental.serviceChargeAmount],
        ['unit.serviceCharge', unit.serviceCharge],
        ['rental.serviceCharge', rental.serviceCharge],
        ['property.serviceCharge', propertyRental.serviceCharge ?? property.serviceCharge],
    ];

    for (const [source, raw] of levels) {
        const value = toFiniteNumber(raw);
        if (value !== undefined) {
            return { amount: value, source };
        }
    }
    return { amount: 0, source: 'none' };
}

/** Convenience wrapper for call sites that only need the amount. */
export function resolveServiceChargeAmount(args: ResolveServiceChargeArgs): number {
    return resolveServiceCharge(args).amount;
}

/**
 * Dev-mode tooltip text for a resolution source. Returns undefined in
 * production builds so no debug string ships to users.
 */
export function serviceChargeDebugTitle(source: ServiceChargeSource | string | undefined): string | undefined {
    if (!(import.meta as any).env?.DEV) return undefined;
    return source ? `Service-charge resolution: ${source}` : undefined;
}
