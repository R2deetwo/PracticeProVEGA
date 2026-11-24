/**
 * virtualEventDismissals — hiding auto-generated lease/rent reminders
 * (owner brief 2026-11-24: "one of the lease expiry… I can't get rid of it.
 * How do you get rid of it?").
 *
 * THE LOGIC, MADE EXPLICIT (this is what the calendar now shows the user):
 *   • Lease-expiry / T-30 warning / mid-point / maintenance events are
 *     VIRTUAL — computed at render time from the property's lease fields
 *     (computeAtriumVirtualEvents). They are not rows in the events table;
 *     deleting them there is impossible by design.
 *   • Renew or edit the lease on the property → the reminder re-computes to
 *     the new dates. No dismissal survives that change: each dismissal
 *     remembers the DATE it hid, and a different date (a renewed lease, a
 *     moved rent series) re-surfaces automatically.
 *   • Dismissing hides THAT reminder (that exact id + date). Dismissing a
 *     recurring rent-due series hides the whole series for that tenancy.
 *
 * Storage: localStorage keyed by firm — `practicepro_virtual_event_dismissals_v1`
 *   = { [firmId]: { [dismissKey]: { dateISO, dismissedAt } } }
 * dateISO is the local-DATE anchor of the event at dismissal time; guards
 * every read/write (node test envs, private mode) so nothing ever crashes.
 */

const STORAGE_KEY = 'practicepro_virtual_event_dismissals_v1';

export interface VirtualDismissalRecord {
    /** The date (YYYY-MM-DD) the event pointed at when it was hidden. */
    dateISO: string;
    /** When the user hid it. */
    dismissedAt: number;
}

type Store = Record<string, Record<string, VirtualDismissalRecord>>;

const readStore = (): Store => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const writeStore = (store: Store): void => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch { /* storage unavailable — dismissal becomes session-only */ }
};

const toLocalDateISO = (iso: string): string => {
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        const p = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    } catch {
        return '';
    }
};

export interface DismissibleVirtualEvent {
    id: string;
    firmId?: string;
    /** Present on recurring rent-due instances (originalId = series id). */
    originalId?: string;
    /** Present on series + instances; endDate = the lease-end anchor. */
    recurrence?: { frequency: string; endDate?: string } | null;
    date: string;
}

/** The stable anchor a dismissal is keyed to:
 *  • recurring series → its endDate (the lease end) — the whole series
 *    stays hidden until the lease end MOVES (renewal re-surfaces it);
 *  • single events → their own date — a renewed lease produces a new date,
 *    which re-surfaces automatically.
 */
const anchorFor = (event: DismissibleVirtualEvent): string => {
    if (event.recurrence) {
        return event.recurrence.endDate ? toLocalDateISO(event.recurrence.endDate) : '';
    }
    return toLocalDateISO(event.date);
};

/**
 * Hide a virtual reminder.
 *  • Single events (expiry/warning/midpoint/maintenance): the event id.
 *  • Recurring rent-due series: pass the instance (id has the `_date`
 *    suffix, originalId carries the series) — the whole series is hidden
 *    under the SERIES id, which is what the confirm copy explains.
 */
export const dismissVirtualEvent = (event: DismissibleVirtualEvent): void => {
    const firmId = String(event.firmId || 'default');
    const dismissKey = event.recurrence
        ? String(event.originalId || event.id)
        : String(event.id);
    const store = readStore();
    const firm = store[firmId] || {};
    firm[dismissKey] = {
        dateISO: anchorFor(event),
        dismissedAt: Date.now(),
    };
    store[firmId] = firm;
    writeStore(store);
};

/** Should this virtual event be hidden? Anchor-aware: a dismissal only
 *  matches while the underlying lease data still points at the same anchor
 *  (series end for recurring, event day for singles) — renewals re-surface. */
export const isVirtualEventDismissed = (event: DismissibleVirtualEvent): boolean => {
    const firmId = String(event.firmId || 'default');
    const firm = readStore()[firmId];
    if (!firm) return false;
    const candidates = event.recurrence
        ? [String(event.originalId || event.id), String(event.id)]
        : [String(event.id)];
    const currentAnchor = anchorFor(event);
    for (const key of candidates) {
        const rec = firm[key];
        if (!rec) continue;
        // Strict anchor equality: an open-ended-series dismissal ('') only
        // matches while the series is STILL open-ended; a bounded one only
        // while its lease end holds. Any lease change re-surfaces.
        if (rec.dateISO === currentAnchor) return true;
    }
    return false;
};

/** Clear every dismissal for a firm (a "show me everything again" escape
 *  hatch — surfaced from the calendar when useful). */
export const clearVirtualEventDismissals = (firmId?: string): void => {
    if (firmId) {
        const store = readStore();
        delete store[String(firmId)];
        writeStore(store);
    } else {
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
};

/** Filter a computed virtual-events array down to the visible ones. Used
 *  inside computeAtriumVirtualEvents so EVERY consumer (calendar month/week/
 *  diary, dashboard mini-calendar, modal resolvers) honours dismissals via
 *  the single choke point. */
export const filterDismissedVirtualEvents = <T extends DismissibleVirtualEvent>(events: T[]): T[] => {
    try {
        return events.filter((e) => !isVirtualEventDismissed(e));
    } catch {
        return events;
    }
};
