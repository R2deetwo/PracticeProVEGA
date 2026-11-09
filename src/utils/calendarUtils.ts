import { CalendarEvent } from '../types';

const MAX_OCCURRENCES = 366; // Safeguard against infinite loops, roughly one year of daily events
export const timelineStartHour = 0; // The timeline starts at 00:00 (midnight) for a full 24-hour view


/**
 * Parses a date value that can be a Date object or a string.
 * This is a timezone-safe parser.
 * - For 'YYYY-MM-DD' strings, it creates a local date to avoid UTC midnight issues.
 * - For full ISO strings (containing 'T'), it lets the native JS Date constructor handle timezone offsets correctly.
 * @param dateValue The date string or object to parse.
 * @returns A valid Date object representing the correct local time.
 */
export const parseDateString = (dateValue: string | Date): Date => {
    if (dateValue instanceof Date) {
        return dateValue;
    }
    // It's a string.
    // This regex specifically checks for 'YYYY-MM-DD' format and nothing more.
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        // It's a 'YYYY-MM-DD' string. Parse as local date to avoid UTC midnight interpretation.
        const parts = dateValue.split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    } else {
        // For all other strings (including '...T...Z'), let the native Date constructor handle it.
        // It correctly interprets the UTC offset.
        const d = new Date(dateValue);
        // Check for invalid date
        if (isNaN(d.getTime())) {
            console.warn(`Invalid date string provided to parseDateString: ${dateValue}`);
            // Fallback to now to prevent crashes
            return new Date();
        }
        return d;
    }
};

const toLocalISOString = (date: Date): string => {
  if (!date || isNaN(date.getTime())) {
      return 'invalid-date';
  }
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};


/** Month-based stepping with day-of-month clamping — the SAME convention
 * as the billing engine's computeNextBillingDate (Monthly +1mo clamped to
 * month-end). An event on Jan 31 recurs Jan 31 → Feb 28 → Mar 31 → Apr 30…
 * instead of JS setMonth() rolling Feb 31 into Mar 3 and drifting forever.
 * Yearly steps clamp too (Feb 29 → Feb 28 on non-leap years). */
const addMonthsClamped = (d: Date, months: number, anchorDay: number): Date => {
    const target = new Date(d.getFullYear(), d.getMonth() + months, 1, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
    const lastDayOfMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(anchorDay, lastDayOfMonth));
    return target;
};

/** Advance one recurrence step. `anchorDay` is the original event's
 * day-of-month, kept stable across month-based frequencies. */
const stepOccurrence = (current: Date, frequency: NonNullable<CalendarEvent['recurrence']>['frequency'], anchorDay: number): Date => {
    switch (frequency) {
        case 'daily': { const d = new Date(current.getTime()); d.setDate(d.getDate() + 1); return d; }
        case 'weekly': { const d = new Date(current.getTime()); d.setDate(d.getDate() + 7); return d; }
        case 'monthly': return addMonthsClamped(current, 1, anchorDay);
        case 'quarterly': return addMonthsClamped(current, 3, anchorDay);
        case 'biannually': return addMonthsClamped(current, 6, anchorDay);
        case 'yearly': return addMonthsClamped(current, 12, anchorDay);
    }
};

export const expandRecurringEvents = (events: CalendarEvent[], startDate: Date, endDate: Date): CalendarEvent[] => {
    const expanded: CalendarEvent[] = [];

    events.forEach(event => {
        const eventDate = parseDateString(event.date);

        // Add non-recurring events that fall within the range
        if (!event.recurrence) {
            if (eventDate >= startDate && eventDate <= endDate) {
                expanded.push(event);
            }
            return;
        }

        // Handle recurring events
        const recurrenceEndDate = event.recurrence.endDate ? parseDateString(event.recurrence.endDate) : null;
        const anchorDay = eventDate.getDate();
        let currentDate = new Date(eventDate.getTime());

        // Fast-forward to the first occurrence that might be in the window.
        // BUG FIX (calendar round): this loop previously shared the
        // MAX_OCCURRENCES budget with the output loop, so a daily event
        // created more than ~1 year before the window exhausted the budget
        // while skipping and NEVER rendered again. The fast-forward is now
        // bounded only by a generous infinite-loop guard, and MAX_OCCURRENCES
        // counts pushed instances only.
        let fastForwardSteps = 0;
        while (currentDate < startDate && fastForwardSteps < 10000) {
            if (recurrenceEndDate && currentDate > recurrenceEndDate) {
                break; // The series ended before the window begins
            }
            currentDate = stepOccurrence(currentDate, event.recurrence.frequency, anchorDay);
            fastForwardSteps++;
        }

        let occurrences = 0;
        while (currentDate <= endDate && occurrences < MAX_OCCURRENCES) {
            if (currentDate >= startDate) {
                 if (!recurrenceEndDate || currentDate <= recurrenceEndDate) {
                    const duration = event.endDate ? Math.max(0, parseDateString(event.endDate).getTime() - eventDate.getTime()) : 0;
                    const currentEndDate = event.endDate ? new Date(currentDate.getTime() + duration) : undefined;

                    expanded.push({
                        ...event,
                        id: `${event.id}_${toLocalISOString(currentDate)}`, // Create unique ID for this instance
                        originalId: event.id, // Keep track of the original event
                        date: new Date(currentDate.getTime()).toISOString(),
                        endDate: currentEndDate ? currentEndDate.toISOString() : undefined
                    });
                    occurrences++;
                 }
            }

            if (recurrenceEndDate && currentDate > recurrenceEndDate) {
                break;
            }

            currentDate = stepOccurrence(currentDate, event.recurrence.frequency, anchorDay);
        }
    });

    return expanded.sort((a, b) => parseDateString(a.date).getTime() - parseDateString(b.date).getTime());
};

export interface EventWithLayout extends CalendarEvent {
    layout: {
        top: number;
        height: number;
        left: number;
        width: number;
    };
    hasConflict: boolean;
    isDismissed: boolean;
}

// Intermediate type for processing, not exported
type ProcessableEventLayout = Omit<EventWithLayout, 'layout' | 'hasConflict' | 'isDismissed'> & {
    startDate: Date;
    endDate: Date;
    layout: {
        top: number;
        height: number;
        left: number;
        width: number;
        column: number;
        totalColumns: number;
    }
};


// Processes a list of events for a single day to calculate their visual layout, handling overlaps.
export const processDayEventsForLayout = (dayEvents: CalendarEvent[], hourHeight: number): Omit<EventWithLayout, 'hasConflict'|'isDismissed'>[] => {
    if (!dayEvents || dayEvents.length === 0) return [];
    
    // 1. Pre-process and sort events
    const sortedEvents = dayEvents
        .map(e => {
            const { endDate: originalEndDate, ...rest } = e;
            return {
                ...rest,
                startDate: parseDateString(e.date),
                endDate: e.endDate ? parseDateString(e.endDate) : new Date(parseDateString(e.date).getTime() + 60 * 60 * 1000) // Default 1 hour
            }
        })
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime() || (b.endDate.getTime() - a.endDate.getTime()));

    // 2. Group events that visually overlap
    const collisionGroups: typeof sortedEvents[] = [];
    for (const event of sortedEvents) {
        let placed = false;
        for (const group of collisionGroups) {
            // Does this event overlap with any event in the current group?
            if (group.some(e => event.startDate < e.endDate && event.endDate > e.startDate)) {
                group.push(event);
                placed = true;
                break;
            }
        }
        if (!placed) {
            collisionGroups.push([event]);
        }
    }

    const finalLayouts: Omit<EventWithLayout, 'hasConflict'|'isDismissed'>[] = [];

    // 3. Calculate layout for each group
    for (const group of collisionGroups) {
        const columns: (typeof sortedEvents)[] = [];
        group.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

        for (const event of group) {
            let placedInColumn = false;
            for (const col of columns) {
                const lastEventInCol = col[col.length - 1];
                if (event.startDate >= lastEventInCol.endDate) {
                    col.push(event);
                    placedInColumn = true;
                    break;
                }
            }
            if (!placedInColumn) {
                columns.push([event]);
            }
        }

        const totalColumns = columns.length;
        for (let i = 0; i < totalColumns; i++) {
            for (const event of columns[i]) {
                const top = (event.startDate.getHours() * hourHeight) + (event.startDate.getMinutes() / 60 * hourHeight);
                const durationMinutes = (event.endDate.getTime() - event.startDate.getTime()) / (1000 * 60);
                const height = Math.max(22, (durationMinutes / 60 * hourHeight) - 2); // Min height of 22px, with padding

                const columnWidth = 100 / totalColumns;
                const left = i * columnWidth;
                const width = columnWidth;

                const { startDate, endDate, ...eventRest } = event;
                finalLayouts.push({
                    ...eventRest,
                    endDate: endDate.toISOString(),
                    layout: {
                        top,
                        height,
                        left,
                        width,
                    }
                });
            }
        }
    }
    
    return finalLayouts;
};

// Atrium Virtual Events computation
//
// Two defect families fixed in the calendar round:
//  1. RENT DUE DATES were promised (CalendarView's comment + the Komplete
//     product-aware round) but never generated — only lease events existed.
//  2. UNITS were invisible: units embedded in `properties.units[]` (the
//     multi-unit building model — see usePropertyGroups) carry their own
//     leaseStart/leaseEnd/rent and never produced any calendar events.
//
// Rent-due events are emitted as RECURRING virtual events (frequency mapped
// from rentFrequency, recurrence.endDate = leaseEnd) so every consumer's own
// expandRecurringEvents window renders them — month grid, week columns, day
// diary and the dashboard mini-calendar — without any window plumbing.
const RENT_FREQUENCY_TO_RECURRENCE: Record<string, NonNullable<CalendarEvent['recurrence']>['frequency']> = {
    'Monthly': 'monthly',
    'Quarterly': 'quarterly',
    'Bi-Annually': 'biannually',
    'Annually': 'yearly',
};

const formatNairaShort = (amount?: number): string => {
    if (!amount || amount <= 0) return '';
    return `₦${amount.toLocaleString('en-NG')}`;
};

export const computeAtriumVirtualEvents = (properties: any[]): CalendarEvent[] => {
    const virtualEvents: CalendarEvent[] = [];

    /** Lease lifecycle events (expiry, T-30 warning, midpoint) for one
     * tenancy scope — a property record or an embedded unit. */
    const pushLeaseEvents = (key: string, firmId: string, label: string, leaseStart?: string, leaseEnd?: string) => {
        if (!leaseEnd) return;
        const endDateObj = parseDateString(leaseEnd);

        // 1. Lease Expiry (T-0)
        virtualEvents.push({
            id: `virtual_expiry_${key}`,
            firmId,
            title: `Lease Expiry — ${label}`,
            date: endDateObj.toISOString(),
            type: 'Atrium Automation',
            status: 'pending',
            source: 'atrium_auto'
        } as any);

        // 2. T-30 Warning
        const warningDate = new Date(endDateObj.getTime());
        warningDate.setDate(warningDate.getDate() - 30);
        virtualEvents.push({
            id: `virtual_warning_${key}`,
            firmId,
            title: `Lease Expiry Warning (30 Days) — ${label}`,
            date: warningDate.toISOString(),
            type: 'Atrium Automation',
            status: 'pending',
            source: 'atrium_auto'
        } as any);

        // 3. Mid-Point Review (needs both ends to compute the midpoint)
        if (leaseStart) {
            const startDateObj = parseDateString(leaseStart);
            const midpointTime = startDateObj.getTime() + (endDateObj.getTime() - startDateObj.getTime()) / 2;
            virtualEvents.push({
                id: `virtual_midpoint_${key}`,
                firmId,
                title: `Lease Mid-Point Review — ${label}`,
                date: new Date(midpointTime).toISOString(),
                type: 'Atrium Automation',
                status: 'pending',
                source: 'atrium_auto'
            } as any);
        }
    };

    /** Recurring rent-due series for one tenancy scope, anchored at
     * leaseStart, ending at leaseEnd. Only for tenanted scopes with a
     * rent amount (vacant units produce nothing). */
    const pushRentDueEvent = (key: string, firmId: string, label: string, leaseStart: string, leaseEnd: string | undefined, rentAmount: number | undefined, rentFrequency: string | undefined) => {
        const frequency = RENT_FREQUENCY_TO_RECURRENCE[rentFrequency || ''] || 'monthly';
        const amountStr = formatNairaShort(rentAmount);
        const title = `Rent Due${amountStr ? ` (${amountStr})` : ''} — ${label}`;
        virtualEvents.push({
            id: `virtual_rentdue_${key}`,
            firmId,
            title,
            date: parseDateString(leaseStart).toISOString(),
            type: 'Atrium Automation',
            status: 'pending',
            source: 'atrium_auto',
            recurrence: { frequency, ...(leaseEnd ? { endDate: leaseEnd } : {}) }
        } as any);
    };

    properties.forEach(p => {
        const propRental = p.rentalDetails || {};

        // ── Property-level tenancy (single-unit records) ─────────────
        pushLeaseEvents(p.id, p.firmId, p.address, propRental.leaseStart, propRental.leaseEnd);
        if (propRental.leaseStart && (propRental.tenantName || propRental.tenantEmail) && (propRental.rentAmount ?? 0) > 0) {
            pushRentDueEvent(p.id, p.firmId, p.address, propRental.leaseStart, propRental.leaseEnd, propRental.rentAmount, propRental.rentFrequency);
        }

        // ── Embedded units (multi-unit buildings) ────────────────────
        // Units carry lease fields FLAT on the unit object (see
        // usePropertyGroups) and may additionally nest a rentalDetails.
        (p.units || []).forEach((unit: any, idx: number) => {
            const unitRental = unit.rentalDetails || {};
            const unitName = unit.unitName || unitRental.unitName || `Unit ${idx + 1}`;
            const unitId = unit.id || unitName || String(idx);
            const label = unitName ? `${p.address} · ${unitName}` : p.address;
            const leaseStart = unitRental.leaseStart || unit.leaseStart;
            const leaseEnd = unitRental.leaseEnd || unit.leaseEnd;
            const rentAmount = unitRental.rentAmount ?? unit.rentAmount;
            const rentFrequency = unitRental.rentFrequency || unit.rentFrequency;
            const tenantName = unitRental.tenantName || unit.tenantName;
            const tenantEmail = unitRental.tenantEmail || unit.tenantEmail;

            pushLeaseEvents(`${p.id}_${unitId}`, p.firmId, label, leaseStart, leaseEnd);
            if (leaseStart && (tenantName || tenantEmail) && (rentAmount ?? 0) > 0) {
                pushRentDueEvent(`${p.id}_${unitId}`, p.firmId, label, leaseStart, leaseEnd, rentAmount, rentFrequency);
            }
        });

        // ── Maintenance Cycle (if automationSettings.autoCreateMaintenanceTask is on, schedule 6 months from createdAt)
        if (p.automationSettings?.autoCreateMaintenanceTask && p.createdAt) {
            const createdObj = parseDateString(p.createdAt);
            const maintDate = new Date(createdObj.getTime());
            maintDate.setMonth(maintDate.getMonth() + 6);
            virtualEvents.push({
                id: `virtual_maint_${p.id}`,
                firmId: p.firmId,
                title: `Scheduled Maintenance Review — ${p.address}`,
                date: maintDate.toISOString(),
                type: 'Atrium Automation',
                status: 'pending',
                source: 'atrium_auto'
            } as any);
        }
    });

    return virtualEvents;
};