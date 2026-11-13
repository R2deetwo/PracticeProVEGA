/**
 * types.ts — shared shapes for the Units Console family (§4.1).
 */
import { Property, Contact } from '../../../types';
import { getUnitDisplay } from '../../../utils/propertyPayload';
import type { UnitHealth } from './useUnitHealth';
import type { TenancyStatusEntry, TenancyPanelUnit } from '../TenancyLifecyclePanel';

export type UnitDisplay = ReturnType<typeof getUnitDisplay>;

/** One unit, fully derived — the row/band/card input. */
export interface UnitEntry {
    unit: Property;
    display: UnitDisplay;
    health: UnitHealth;
    tickets: any[];
}

/** Every action re-homed from the old card — same handlers, same guardrails. */
export interface UnitsActions {
    onCollectRent: (unit: Property, d: UnitDisplay) => void;
    onCompose: (unit: Property, d: UnitDisplay) => void;
    onEditUnit: (unit: Property) => void;
    onDraftAction: (actionTitle: string, type: string, unit?: Property) => void;
    onQuitNoticeDrafted: (unit: any) => void;
    onMarkQuitNoticeServed: (unit: any) => void;
    onDraftSevenDayNotice: (unit: any) => void;
    onInitializeMatter: (unit?: any) => void;
    onRemoveUnit: (unit: any, d: UnitDisplay) => void;
    onUpdateEvictionTracker: (unit: any, updates: any) => void;
    onShareLink: (unit: Property, d: UnitDisplay) => void;
    onSetStatus: (unit: Property, status: string, d: UnitDisplay) => void;
    /** ServiceChargeBars persistence — rentalDetails updates (marks, receipts). */
    onUpdateRental: (unit: Property, updatedRental: any) => void;
    onOpenTickets: (unit: Property) => void;
    canUseEviction: boolean;
    rentCollecting: boolean;
}

export interface UnitsDataProps {
    property: Property;
    owner: Contact | null;
    units: UnitEntry[];
    archivedUnits: Property[];
    tenancyUnits: TenancyPanelUnit[];
    tenancyStatus: Record<string, TenancyStatusEntry> | undefined;
    contacts: any[];
    firmId: string;
}
