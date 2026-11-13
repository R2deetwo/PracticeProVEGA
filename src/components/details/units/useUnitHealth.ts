/**
 * useUnitHealth.ts — the Unit Health engine (UNITS_PAGE_REDESIGN.md §3.2).
 * ─────────────────────────────────────────────────────────────────────────
 * ONE pure derivation per unit that answers the two questions the old card
 * answered with fifteen overlapping signals:
 *
 *   Occupancy  — what the unit IS   (unit.status: Occupied/Vacant/Listed/Maintenance)
 *   Health     — how it's GOING     (● OK · ◐ Watch · ● Action · — none)
 *
 * Everything it consumes is ALREADY computed per card today — getUnitDisplay,
 * the serviceChargeTimeline engine, the shared tenancy-status feed, tickets
 * and the eviction tracker. This file adds no query, no mutation, no schema
 * change: it summarizes client-side, once, centrally.
 *
 * Level rubric (Action > Watch > OK; vacant/listed = 'none'):
 *   ACTION  — lease ended with resident in place · any stream (RENT/SC/MV)
 *             overdue · eviction in flight (quit served / 7-day due) ·
 *             occupied without tier-1 records (tenant name or lease end) ·
 *             stale maintenance ticket (>24h)
 *   WATCH   — current cycle due on any stream · lease ≥75% elapsed (≥50%
 *             softer) · tier-2 records missing (phone or rent amount) ·
 *             occupied without a tenancy-ledger row · open (non-stale) ticket
 *   OK      — occupied, streams clear, records complete, no flags
 */
import { Property } from '../../../types';
import { getUnitDisplay } from '../../../utils/propertyPayload';
import {
    serviceChargeTimeline,
    buildRentTimeline,
    buildTimeline,
    summarizeTimeline,
    type TimelineSummary,
} from '../../../utils/leaseTimeline';
import { getEvictionTracker, type EvictionTracker } from './evictionTracker';
import type { TenancyStatusEntry } from '../TenancyLifecyclePanel';

export type UnitHealthLevel = 'action' | 'watch' | 'ok' | 'none';

export interface StreamHealth {
    rent: TimelineSummary;
    sc: TimelineSummary;
    mv: TimelineSummary;
}

export interface UnitHealth {
    level: UnitHealthLevel;
    /** Human-readable reasons, most severe first — feeds the dot tooltip,
     *  the attention bar and the Watch/Grid views. Empty when 'none'. */
    reasons: string[];
    /** Days past lease end with the resident still in place (0 otherwise). */
    daysOverstayed: number;
    /** Term progress 0..1 (null when dates are missing). */
    termProgress: number | null;
    streams: StreamHealth;
    eviction: EvictionTracker;
}

export interface UnitHealthArgs {
    unit: Property;
    /** Parent property — the service-charge resolution fallback. */
    property: Property;
    /** "Management Only (No Rent)" properties hide the RENT stream. */
    includeRent: boolean;
    tenancyStatus?: TenancyStatusEntry;
    /** Maintenance tickets linked to this unit. */
    tickets?: any[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The per-unit derivation. Pure — safe to memoize on inputs. */
export function deriveUnitHealth(args: UnitHealthArgs): UnitHealth {
    const { unit, property, includeRent, tenancyStatus, tickets = [] } = args;
    const d = getUnitDisplay(unit);
    const rental = (unit.rentalDetails || {}) as Record<string, any>;
    const uStatus = String(unit.status || 'Vacant');
    const eviction = getEvictionTracker(unit);

    // ── The three live billing timelines (same engine as the card strips) ──
    const sc = serviceChargeTimeline({ unit, rental: unit.rentalDetails, defaultProperty: property });
    const mvEnabled = !!(unit as any).minimumVendEnabled;
    const mvAmount = Number((unit as any).minimumVendAmount || 0);
    const mvPeriods = buildTimeline({
        leaseStart: rental.leaseStart || '',
        leaseEnd: rental.leaseEnd,
        cadence: { months: 1, perPeriodAmount: mvAmount, frequency: 'Monthly', explicit: false },
        stored: rental.mvPeriods,
    });
    const rentPeriods = includeRent
        ? buildRentTimeline({
              leaseStart: rental.leaseStart || '',
              leaseEnd: rental.leaseEnd,
              rentFrequency: rental.rentFrequency,
              rentAmount: Number(rental.rentAmount) || 0,
              payments: (unit as any).rentPaymentHistory || [],
          })
        : [];
    const streams: StreamHealth = {
        rent: summarizeTimeline(rentPeriods),
        sc: sc.summary,
        mv: summarizeTimeline(mvPeriods),
    };

    const reasons: string[] = [];
    let level: UnitHealthLevel = 'ok';

    // Vacant / Listed units carry NO health — occupancy axis only.
    if (uStatus === 'Vacant' || uStatus === 'Listed') {
        return { level: 'none', reasons: [], daysOverstayed: 0, termProgress: d.termProgress, streams, eviction };
    }

    const bump = (to: UnitHealthLevel, reason: string) => {
        if (to === 'action') level = 'action';
        else if (to === 'watch' && level !== 'action') level = 'watch';
        reasons.push(reason);
    };

    // ── ACTION triggers ──
    const leaseEndMs = d.leaseEnd ? new Date(d.leaseEnd).getTime() : NaN;
    const tenancyExpired = uStatus === 'Occupied' && !isNaN(leaseEndMs) && leaseEndMs < Date.now();
    const daysOverstayed = tenancyExpired ? Math.max(0, Math.floor((Date.now() - leaseEndMs) / DAY_MS)) : 0;
    if (tenancyExpired) {
        bump('action', `Lease ended ${new Date(d.leaseEnd!).toLocaleDateString('en-GB')} — ${daysOverstayed === 0 ? 'today' : `${daysOverstayed}d overstayed`}`);
    }

    for (const [key, label] of [['rent', 'Rent'], ['sc', 'Service charge'], ['mv', 'Minimum vend']] as const) {
        const s = streams[key];
        if (s.state === 'overdue' && s.overdueCount > 0) {
            bump('action', `${label} ${s.overdueCount} cycle${s.overdueCount > 1 ? 's' : ''} overdue`);
        }
    }

    const sevenDayDue = eviction.sevenDayNoticeStatus === 'due' && eviction.sevenDayNoticeDueDate != null && Date.now() >= eviction.sevenDayNoticeDueDate;
    if (eviction.quitNoticeStatus === 'served' || sevenDayDue) {
        bump('action', sevenDayDue ? '7-Day Notice due — recovery of premises' : 'Quit notice served — statutory countdown active');
    }

    const hasTier1 = !!(d.tenantName && d.leaseEnd);
    if (uStatus === 'Occupied' && !hasTier1) {
        bump('action', `Missing ${!d.tenantName ? 'resident name' : 'lease end date'} — records incomplete`);
    }

    const openTickets = tickets.filter((t: any) => t.status === 'open' || t.status === 'in_progress');
    const staleTicket = openTickets.some((t: any) => t.isStale);
    if (staleTicket) bump('action', 'Maintenance ticket pending >24h');
    else if (openTickets.length > 0) bump('watch', `${openTickets.length} open maintenance ticket${openTickets.length > 1 ? 's' : ''}`);

    // ── WATCH triggers ──
    for (const [key, label] of [['rent', 'Rent'], ['sc', 'Service charge'], ['mv', 'Minimum vend']] as const) {
        const s = streams[key];
        if (s.state === 'due') bump('watch', `${label} due this cycle`);
    }

    if (d.termProgress !== null) {
        const pct = Math.round(d.termProgress * 100);
        if (pct >= 75) bump('watch', `Tenancy ${pct}% elapsed — statutory notice window compressed`);
        else if (pct >= 50) bump('watch', `Tenancy ${pct}% elapsed — statutory notice window active`);
    }

    const hasTier2 = !!((rental.tenantPhone || (unit as any).tenantPhone) && d.rentAmount > 0);
    if (uStatus === 'Occupied' && hasTier1 && !hasTier2) {
        bump('watch', 'Missing phone or rent amount — needs info');
    }

    const informalOccupancy = uStatus === 'Occupied' || !!d.tenantName;
    if (informalOccupancy && tenancyStatus && !tenancyStatus.active) {
        bump('watch', 'Occupied without a tenancy ledger row — record the resident');
    }

    if (level === 'ok' && uStatus === 'Occupied') reasons.push('Records complete · billing clear');

    return { level, reasons, daysOverstayed, termProgress: d.termProgress, streams, eviction };
}

// ── Arrears tokens (the row's compact billing vocabulary, §3.2) ─────────────

export interface ArrearsToken {
    /** e.g. "SC 13" · "SC due" · "SC clear" */
    label: string;
    tone: 'overdue' | 'due' | 'clear';
}

/** Compact per-stream tokens: `SC 13 · MV 3` (overdue), `SC due` (amber), `clear` (green). */
export function arrearsTokens(streams: StreamHealth): ArrearsToken[] {
    const tokens: ArrearsToken[] = [];
    for (const [key, label] of [['rent', 'RENT'], ['sc', 'SC'], ['mv', 'MV']] as const) {
        const s = streams[key];
        if (s.state === 'overdue' && s.overdueCount > 0) {
            tokens.push({ label: `${label} ${s.overdueCount}`, tone: 'overdue' });
        } else if (s.state === 'due') {
            tokens.push({ label: `${label} due`, tone: 'due' });
        }
    }
    return tokens;
}

/** True when any stream carries money owed right now. */
export function hasArrears(streams: StreamHealth): boolean {
    return (streams.rent.outstandingTotal + streams.sc.outstandingTotal + streams.mv.outstandingTotal) > 0;
}

// ── Sorting (attention-first default, §3.3) ─────────────────────────────────

const LEVEL_RANK: Record<UnitHealthLevel, number> = { action: 0, watch: 1, ok: 2, none: 3 };

export function compareUnitsByAttention(
    a: { health: UnitHealth; name: string },
    b: { health: UnitHealth; name: string }
): number {
    const byLevel = LEVEL_RANK[a.health.level] - LEVEL_RANK[b.health.level];
    if (byLevel !== 0) return byLevel;
    // Most overstayed / most cycles owed first.
    const aDebt = a.health.daysOverstayed * 100 + a.health.streams.rent.overdueCount + a.health.streams.sc.overdueCount + a.health.streams.mv.overdueCount;
    const bDebt = b.health.daysOverstayed * 100 + b.health.streams.rent.overdueCount + b.health.streams.sc.overdueCount + b.health.streams.mv.overdueCount;
    if (aDebt !== bDebt) return bDebt - aDebt;
    // Natural unit-name order (numeric-aware: Unit 2 < Unit 10).
    return a.name.localeCompare(b.name, undefined, { numeric: true });
}

// ── Grouping (§3.5 — earns its place past a dozen units) ────────────────────

export type UnitGroupKey = 'none' | 'floor' | 'type' | 'occupancy' | 'health';

export function unitGroupLabel(group: UnitGroupKey, unit: Property, health: UnitHealth): string {
    const d = getUnitDisplay(unit);
    switch (group) {
        case 'floor': return d.floor ? `Floor ${d.floor}` : 'Unassigned floor';
        case 'type': {
            const t = (unit as any).propertyType || (unit as any).unitType || 'Residential';
            return String(t);
        }
        case 'occupancy': return String(unit.status || 'Vacant');
        case 'health': return health.level === 'action' ? 'Needs action' : health.level === 'watch' ? 'Watch' : health.level === 'ok' ? 'OK' : 'No tenancy';
        default: return '';
    }
}
