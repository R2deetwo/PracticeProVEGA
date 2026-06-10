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
        let currentDate = new Date(eventDate.getTime());
        let occurrences = 0;
        
        // Fast-forward to the first occurrence that might be in the window to avoid unnecessary iterations
        while (currentDate < startDate && occurrences < MAX_OCCURRENCES) {
             if (recurrenceEndDate && currentDate > recurrenceEndDate) {
                break; // Stop if we've passed the recurrence end date
            }
            // Move to the next date without adding it
            switch (event.recurrence.frequency) {
                case 'daily': currentDate.setDate(currentDate.getDate() + 1); break;
                case 'weekly': currentDate.setDate(currentDate.getDate() + 7); break;
                case 'monthly': currentDate.setMonth(currentDate.getMonth() + 1); break;
                case 'yearly': currentDate.setFullYear(currentDate.getFullYear() + 1); break;
            }
            occurrences++;
        }
        
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
                 }
            }

            if (recurrenceEndDate && currentDate > recurrenceEndDate) {
                break;
            }
            
            // Move to the next date
            switch (event.recurrence.frequency) {
                case 'daily':
                    currentDate.setDate(currentDate.getDate() + 1);
                    break;
                case 'weekly':
                    currentDate.setDate(currentDate.getDate() + 7);
                    break;
                case 'monthly':
                    currentDate.setMonth(currentDate.getMonth() + 1);
                    break;
                case 'yearly':
                    currentDate.setFullYear(currentDate.getFullYear() + 1);
                    break;
            }
            occurrences++;
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
export const computeAtriumVirtualEvents = (properties: any[]): CalendarEvent[] => {
    const virtualEvents: CalendarEvent[] = [];

    properties.forEach(p => {
        const leaseEnd = p.rentalDetails?.leaseEnd;
        if (leaseEnd) {
            const endDateObj = parseDateString(leaseEnd);
            
            // 1. Lease Expiry (T-0)
            virtualEvents.push({
                id: `virtual_expiry_${p.id}`,
                firmId: p.firmId,
                title: `Lease Expiry — ${p.address}`,
                date: endDateObj.toISOString(),
                type: 'Atrium Automation',
                status: 'pending',
                source: 'atrium_auto'
            } as any);

            // 2. T-30 Warning
            const warningDate = new Date(endDateObj.getTime());
            warningDate.setDate(warningDate.getDate() - 30);
            virtualEvents.push({
                id: `virtual_warning_${p.id}`,
                firmId: p.firmId,
                title: `Lease Expiry Warning (30 Days) — ${p.address}`,
                date: warningDate.toISOString(),
                type: 'Atrium Automation',
                status: 'pending',
                source: 'atrium_auto'
            } as any);

            // 3. T-Halfway (6 months in, assuming 1 year lease for simplicity, or calc midpoint if leaseStart is present)
            const leaseStart = p.rentalDetails?.leaseStart;
            if (leaseStart) {
                const startDateObj = parseDateString(leaseStart);
                const midpointTime = startDateObj.getTime() + (endDateObj.getTime() - startDateObj.getTime()) / 2;
                virtualEvents.push({
                    id: `virtual_midpoint_${p.id}`,
                    firmId: p.firmId,
                    title: `Lease Mid-Point Review — ${p.address}`,
                    date: new Date(midpointTime).toISOString(),
                    type: 'Atrium Automation',
                    status: 'pending',
                    source: 'atrium_auto'
                } as any);
            }
        }
        
        // 4. Maintenance Cycle (if automationSettings.autoCreateMaintenanceTask is on, schedule 6 months from createdAt)
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