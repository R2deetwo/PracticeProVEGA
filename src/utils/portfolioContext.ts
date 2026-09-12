/**
 * Portfolio context — the AI's structured knowledge of what is on record
 * for the firm's property portfolio.
 *
 * WHY THIS EXISTS (2026-09-12): the AI's portfolio knowledge was three
 * aggregate numbers (Total / Occupied / Vacant) plus the five most recent
 * property titles, and query_firm_data had no 'properties' category. The
 * model literally could not resolve "which property is the user referring
 * to?" — no addresses, units, tenants, or IDs ever reached it. This module
 * is the single source of that knowledge: the system-prompt roster
 * (AgencyHub + PropertyManagementAgent) and the query_firm_data property
 * search both read from here, so the AI can only ever see one consistent
 * view of the portfolio.
 */

import { Property, RealEstateUnit } from '../types';

// ── Small helpers ───────────────────────────────────────────────────────────

/** Units are stored in two shapes: bare RealEstateUnit fields OR a nested
 *  rentalDetails record (the billing engine reads both — mirror that). */
type AnyUnit = RealEstateUnit & { rentalDetails?: Record<string, any>; serviceCharge?: number; [k: string]: any };

const naira = (n: unknown): string => {
    const v = Number(n);
    if (!Number.isFinite(v) || v === 0) return '';
    return `₦${v.toLocaleString('en-NG')}`;
};

const ymd = (iso?: string): string => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
};

export const unitTenantName = (u: AnyUnit | Record<string, any>): string => {
    const r: any = (u as any).rentalDetails ?? u;
    if (r.tenantName) return r.tenantName;
    const titled = `${r.occupantTitle || ''} ${r.occupantFirstName || ''} ${r.occupantLastName || ''}`.trim();
    const plain = `${r.occupantFirstName || ''} ${r.occupantLastName || ''}`.trim();
    return titled || plain || '';
};

const unitRentalSummary = (u: AnyUnit): string => {
    const r = (u as any).rentalDetails ?? u;
    const rent = naira(r.rentAmount);
    const freq = r.rentFrequency || '';
    const sc = naira(r.serviceCharge ?? (u as any).serviceCharge);
    const scFreq = r.serviceChargeFrequency ? `/cycle (${r.serviceChargeFrequency})` : '';
    const leaseStart = ymd(r.leaseStart);
    const leaseEnd = ymd(r.leaseEnd);
    const bits: string[] = [];
    if (rent) bits.push(`${rent} ${freq}`.trim());
    if (sc) bits.push(`SC ${sc}${scFreq}`);
    if (leaseStart) bits.push(`lease ${leaseStart}${leaseEnd ? ` → ${leaseEnd}` : ''}`);
    return bits.join(' · ');
};

// ── Roster (system prompt) ──────────────────────────────────────────────────

export interface RosterOptions {
    maxProperties?: number;
    maxUnitsPerProperty?: number;
}

const formatPropertyLine = (p: Property, maxUnits: number): string => {
    const units = ((p as any).units || []) as AnyUnit[];
    const head =
        `- [ID: ${p.id}] ${p.address || 'Unnamed property'} — ` +
        `${p.propertyType || p.category || 'Property'}, ${p.status || 'Unknown status'}` +
        `${p.ownershipType ? ` (${p.ownershipType})` : ''}`;

    if (!units.length) {
        // Legacy single-unit property: rental details live on the property.
        const tenant = unitTenantName(p as any);
        const summary = unitRentalSummary(p as any);
        const body = [tenant, summary].filter(Boolean).join(' — ');
        return body ? `${head} · ${body}` : head;
    }

    const unitLines = units.slice(0, maxUnits).map(u => {
        const name = u.unitName || 'Unit';
        const tenant = unitTenantName(u);
        const summary = unitRentalSummary(u);
        const body = [tenant || 'no tenant', summary].filter(Boolean).join(' — ');
        return `    • ${name}: ${body}`;
    });
    const moreUnits = units.length > maxUnits ? `\n    • … + ${units.length - maxUnits} more unit(s)` : '';
    return `${head}, ${units.length} unit(s):\n${unitLines.join('\n')}${moreUnits}`;
};

export const buildPortfolioRoster = (
    properties: Property[] | undefined | null,
    opts: RosterOptions = {},
): string => {
    if (!properties || properties.length === 0) return '';
    const maxProperties = opts.maxProperties ?? 40;
    const maxUnits = opts.maxUnitsPerProperty ?? 8;

    const occupied = properties.filter(p => p.status === 'Occupied').length;
    const vacant = properties.filter(p => p.status === 'Vacant').length;
    const totalUnits = properties.reduce((n, p) => n + (((p as any).units || []).length), 0);

    const lines = properties.slice(0, maxProperties).map(p => formatPropertyLine(p, maxUnits));
    const truncated =
        properties.length > maxProperties
            ? `\n… + ${properties.length - maxProperties} more properties — use query_firm_data with category='properties' to search them.`
            : '';

    return `CURRENT PORTFOLIO — WHAT IS ON RECORD (${properties.length} properties, ${totalUnits} units):
- Total: ${properties.length} (Occupied ${occupied}, Vacant ${vacant}, other ${properties.length - occupied - vacant})
${lines.join('\n')}${truncated}

HOW TO USE THIS ROSTER: whenever the user mentions a property — by address, area, unit name, tenant, or phrases like "the Lekki one" — resolve it against this list before answering. If a property detail page is open, "this property" / "that unit" means the ACTIVE PROPERTY block. If you cannot resolve the reference, say what you looked at and ask ONE short clarifying question with the closest matches. NEVER invent properties, tenants, or amounts: if it is not in this roster or in tool results, it is not on record.`;
};

// ── Active property (detail view open) ─────────────────────────────────────

export const buildActivePropertyContext = (
    properties: Property[] | undefined | null,
    historyEntry: { view?: string; selectedId?: string | null } | null | undefined,
): string => {
    if (!historyEntry || historyEntry.view !== 'propertyDetail' || !historyEntry.selectedId) return '';
    const p = (properties || []).find(x => x.id === historyEntry.selectedId);
    if (!p) return '';
    const line = formatPropertyLine(p, 8);
    return `ACTIVE PROPERTY — THE USER IS CURRENTLY VIEWING THIS PROPERTY'S DETAIL PAGE:
${line}
When the user says "this property", "that unit", or "it" while this page is open, they mean THIS property unless they clearly name another one.`;
};

// ── query_firm_data property search ────────────────────────────────────────

const propertyHaystack = (p: Property): string => {
    const units = ((p as any).units || []) as AnyUnit[];
    const parts = [
        p.address,
        p.description,
        p.category,
        p.propertyType,
        p.status,
        p.ownershipType,
        ...units.map(u => [u.unitName, unitTenantName(u)].filter(Boolean).join(' ')),
    ];
    return parts.filter(Boolean).join(' \n ').toLowerCase();
};

/** Token-scored search: every query word matched counts; more matched words
 *  rank higher. Substring match keeps it forgiving ("lekki" matches
 *  "12 Admiralty Way, Lekki Phase 1"). */
export const searchPortfolio = (
    properties: Property[] | undefined | null,
    query: string,
    opts: { limit?: number } = {},
): Property[] => {
    if (!properties || !query.trim()) return [];
    const limit = opts.limit ?? 6;
    const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);
    if (!tokens.length) return [];

    const scored = properties
        .map(p => {
            const hay = propertyHaystack(p);
            const score = tokens.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
            return { p, score };
        })
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(s => s.p);
};

/** The object returned to the AI from query_firm_data(category='properties') —
 *  includes the ID (for navigate_to 'propertyDetail') and per-unit detail. */
export const toPropertyToolResult = (p: Property): Record<string, any> => {
    const units = ((p as any).units || []) as AnyUnit[];
    return {
        id: p.id,
        address: p.address,
        status: p.status,
        category: p.category,
        propertyType: p.propertyType,
        ownershipType: p.ownershipType,
        description: p.description,
        value: p.value,
        units: units.map(u => {
            const r = (u as any).rentalDetails ?? u;
            return {
                id: u.id,
                unitName: u.unitName,
                tenantName: unitTenantName(u),
                tenantPhone: r.tenantPhone,
                tenantEmail: r.tenantEmail,
                rentAmount: r.rentAmount,
                rentFrequency: r.rentFrequency,
                serviceCharge: r.serviceCharge ?? (u as any).serviceCharge,
                leaseStart: r.leaseStart,
                leaseEnd: r.leaseEnd,
            };
        }),
        // Legacy single-unit shape: surface the property-level rental details.
        rentalDetails: units.length ? undefined : (p as any).rentalDetails,
    };
};
