
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Property, Contact, ModalType, MatterStatus, InvoiceStatus, BillingModel } from '../../types';
import { OfficeBuildingIcon, EditIcon, DocumentIcon, CalendarIcon, CheckCircleIcon, PlusIcon, MinusIcon, GavelIconLarge, CalculatorIcon, ZapIcon, LockClosedIcon, SearchIcon, CurrencyDollarIcon, MattersIcon, CogIcon, XIcon, TrashIcon } from '../../constants';
import { formatNaira, formatNairaCompact, formatNairaFull, normalizeAddress } from '../../utils/formatting';
import NairaSymbol from '../NairaSymbol';
import { ClipboardList, Home, Megaphone, FileText, Eye, Radio, Receipt, Wallet, Mail, Phone, FileDown, Link2 } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import { useAloa } from '../../contexts/AloaProvider';
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useFeatures } from '../../hooks/useFeatures';
import { DocumentsTab } from './DocumentsTab';
import { useMatterState } from '../../contexts/MatterContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import StatCard from '../StatCard';
import Tooltip from '../Tooltip';
import { Button, Card, EmptyState } from '../ui';
import PropertyTrackingView from './PropertyTrackingView';
import { PropertyRelationshipsTab } from './PropertyRelationshipsTab';
// ROUND E (Wave E1): the tenancy lifecycle console — allocate / record /
// renew / end / transfer + per-unit tenancy history, backed by the
// tenancies ledger (convex/tenancyLifecycle.ts).
import { TenancyLifecyclePanel, useUnitsTenancyStatus } from './TenancyLifecyclePanel';
import { PropertyFinancialSummaryPanel } from './PropertyFinancialSummaryPanel';
import { useAuth } from '../../contexts/AuthContext';
import { useProduct } from '../../contexts/ProductContext';
import ErrorBoundary from '../ErrorBoundary';
// MESSAGES OVERHAUL: the property-side compose entry points now use the
// ONE unified composer (atrium/ComposeModal) — templates, resident
// financials auto-fill, honest per-recipient delivery results, retry. The
// weaker duplicate ComposeMessageModal (no templates, no logging, no
// results) was removed with this change.
import { ComposeModal, ComposeModalPrefill } from '../atrium/ComposeModal';

import { getUnitDisplay } from '../../utils/propertyPayload';
import { resolveServiceCharge, serviceChargeDebugTitle } from '../../utils/serviceCharge';
import { draftSessionKey, loadDraftSession } from '../../utils/draftSession';
import { Skeleton } from '../ui/Skeleton';
import { Table, TableHeader, TableBody, TableHead, TableCell } from '../ui/Table';
// UNITS CONSOLE REFACTOR (UNITS_PAGE_REDESIGN.md): the ~1,000-line inline
// Units-tab IIFE below is replaced by the focused UnitsConsole family in
// ./units/ — same queries, same hardened mutations, same guardrails; every
// signal and action is re-homed, none is lost. The statutory eviction
// state machine moved verbatim to ./units/evictionTracker.ts (shared,
// import-cycle-free).
import UnitsConsole from './units/UnitsConsole';
import { getEvictionTracker, getNoticePeriodMonths, type EvictionTracker, type EvictionEvent } from './units/evictionTracker';
const DetailItem: React.FC<{ label: string; value: React.ReactNode; subText?: string }> = ({ label, value, subText }) => (
    <div className="w-full min-w-0 overflow-x-hidden break-words whitespace-normal text-left max-w-full" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
        <p className="text-3xs sm:text-2xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5 whitespace-normal">{label}</p>
        <div className="text-sm font-semibold text-slate-900 dark:text-white leading-snug break-words whitespace-normal">
            {value}
        </div>
        {subText && <p className="text-2xs sm:text-xs text-slate-500 mt-0.5 leading-tight break-words whitespace-normal">{subText}</p>}
    </div>
);

type PropertyTab = 'summary' | 'units' | 'notices' | 'financials' | 'relationships' | 'tracking';

// ─── Eviction Tracker — see ./units/evictionTracker.ts (moved verbatim;
//     shared with the Units Console) ───

const calculateRentReviewDate = (leaseEnd?: string, frequency?: string) => {
    if (!leaseEnd) return null;
    const endDate = new Date(leaseEnd);
    let noticeMonths = 1;
    const f = frequency?.toLowerCase() || '';
    if (f.includes('year')) noticeMonths = 6;
    else if (f.includes('6-month')) noticeMonths = 3;
    else if (f.includes('quarter')) noticeMonths = 1;
    else if (f.includes('month')) noticeMonths = 1;

    const noticeDate = new Date(endDate);
    noticeDate.setMonth(noticeDate.getMonth() - noticeMonths);

    const reviewDate = new Date(noticeDate);
    reviewDate.setDate(reviewDate.getDate() - 14);
    
    return reviewDate;
};


const PropertyDetailViewContent: React.FC = () => {
    const { openEditor, navigateTo, addToast, openModal, selectedId: propertyId, currentHistoryEntry } = useUI();
    const { isProperty, hasPropertyFeatures } = useProduct();
    const { matterState } = useMatterState();
    const { financeState } = useFinanceState();
    const { documentState } = useDocumentState();
    const { coreState, isDataLoaded } = useCoreState();
    const { updateItem, onAddMatter, handleDeleteProperty } = useDataActions() as any;
    const { currentUser, bearerToken } = useAuth();
    const convex = useConvex();
    const { isGrowthOrAbove, isKompleteFirm } = useFeatures();
    const { openWithContext } = useAloa();
    const [activeTab, setActiveTab] = useState<PropertyTab>('summary');
    // UNITS CONSOLE REFACTOR: the unit-menu / add-unit-form / full-detail
    // states moved into UnitsConsole; only the deep-link selection
    // (selectedUnit — shared with the notification auto-expander) remains.
    const [selectedUnit, setSelectedUnit] = useState<Property | null>(null);

    // Unified compose prefill — when set, the ONE ComposeModal opens with the
    // resident (and their contact info + financials) pre-selected. Set by
    // clicking [Message] on any unit row.
    const [composePrefill, setComposePrefill] = useState<ComposeModalPrefill | undefined>(undefined);

    // ─── Deep-link context handling ───────────────────────────────────
    // When navigated from a notification banner (e.g. "OVERDUE RENT"),
    // the context carries `tab` (which property tab to open),
    // `targetUnit` (the unit ID to auto-expand), and `highlight` (the
    // ID of the specific row/item to pulse-highlight).
    // This effect reads those params and:
    //   1. Activates the right tab
    //   2. Sets highlightTarget for the pulse animation
    //   3. Auto-expands the target unit's drawer + scrolls to it
    const [highlightTarget, setHighlightTarget] = useState<string | null>(null);
    const [targetUnitId, setTargetUnitId] = useState<string | null>(null);
    const [deepLinkReason, setDeepLinkReason] = useState<string | null>(null);
    useEffect(() => {
        const ctx = currentHistoryEntry?.context as any;
        if (ctx?.tab) {
            const tab = ctx.tab as PropertyTab;
            if (['summary', 'units', 'notices', 'financials', 'relationships', 'tracking'].includes(tab)) {
                setActiveTab(tab);
            }
        }
        // Read targetUnit — handle empty string (from deep-link when
        // ledger entry has no unitId). Empty string is falsy, so we
        // check for undefined/null instead.
        if (ctx?.targetUnit != null) {
            setTargetUnitId(ctx.targetUnit || null);
        }
        // R28: the deep link's reason ('lease_expired' | 'lease_expiry' |
        // 'overdue') tells the auto-expander which fallback unit is the
        // RIGHT one when the id match fails — a lease_expired banner must
        // never land the user on the first unit with an unpaid service
        // charge (owner report: "it didn't open the exact one that I was
        // supposed to open").
        if (ctx?.reason) {
            setDeepLinkReason(String(ctx.reason));
        }
        if (ctx?.highlight) {
            setHighlightTarget(ctx.highlight);
            // Keep the highlight active for 3 seconds after the target unit
            // is found and expanded — the emerald glow pulses for 2.5s via
            // the CSS animation, then fades out. The 15s fallback timeout
            // covers the case where allUnits takes time to load from Convex.
            const timer = setTimeout(() => setHighlightTarget(null), 15000);
            return () => clearTimeout(timer);
        }
    }, [currentHistoryEntry?.context]);

    // AUTO-EXPAND target unit — MOVED to after the useMemo that defines
    // allUnits (see below). Previously this useEffect was BEFORE the
    // useMemo, causing a Temporal Dead Zone (TDZ) error:
    //   ReferenceError: Cannot access 'm' before initialization
    // because `allUnits` is a const that's accessed before its
    // declaration is evaluated.

    // On-demand fetch for deep-linking
    const onDemandProperty = useQuery(
        api.myFunctions.getPropertyDetails,
        (propertyId && currentUser?.firmId && !coreState.properties?.find(p => p.id === propertyId))
            ? { propertyId, firmId: currentUser.firmId, sessionToken: (bearerToken ?? undefined) }
            : 'skip'
    );

    const { property, owner, allUnits, archivedUnits } = useMemo(() => {
        let selectedProperty: Property | null = null;
        let propertyOwner: Contact | null = null;
        let units: Property[] = [];
        // (see ARCHIVED UNITS FIX note below — captured before the filter)
        let archivedUnitsList: Property[] = [];

        if (propertyId) {
            // 1. Check standalone properties
            const standalone = (coreState.properties || []).find(p => p.id === propertyId || (p as any)._id === propertyId);
            if (standalone) {
                selectedProperty = standalone;
                propertyOwner = (matterState.contacts || []).find(c => c.id === standalone.contactId || (c as any)._id === standalone.contactId) || null;
            } else {
                // 1b. Check if it's a unit ID within a multi-unit property
                for (const p of (coreState.properties || [])) {
                    if (p.units && Array.isArray(p.units)) {
                        const unit = p.units.find(u => u.id === propertyId || (u as any)._id === propertyId);
                        if (unit) {
                            selectedProperty = { 
                                ...p, 
                                id: unit.id, 
                                address: `${p.address} (${unit.unitName || unit.name || 'Unit'})`,
                                rentalDetails: { ...(p.rentalDetails || {}), ...unit },
                                numberOfUnits: 1,
                                units: []
                            };
                            propertyOwner = (matterState.contacts || []).find(c => c.id === p.contactId || (c as any)._id === p.contactId) || null;
                            break;
                        }
                    }
                }

                if (!selectedProperty) {
                    // 2. Check legacy properties
                    for (const c of matterState.contacts) {
                        const p = (c.properties || []).find(prop => prop.id === propertyId || (prop as any)._id === propertyId);
                        if (p) {
                            selectedProperty = p;
                            propertyOwner = c;
                            break;
                        }
                    }
                }

                // 2b. Check on-demand result
                if (!selectedProperty && onDemandProperty) {
                    selectedProperty = onDemandProperty as any;
                    propertyOwner = (matterState.contacts || []).find(c => c.id === (onDemandProperty as any).contactId) || null;
                }
            }

            // 3. Find sibling units (all units at this address)
            if (selectedProperty && selectedProperty.address) {
                const addr = normalizeAddress(selectedProperty.address);
                const standaloneUnits = (coreState.properties || []).filter(p => normalizeAddress(p.address) === addr);
                const legacyUnits: Property[] = [];
                (matterState.contacts || []).forEach(c => {
                    (c.properties || []).forEach(p => {
                        if (normalizeAddress(p.address) === addr && !standaloneUnits.some(su => su.id === p.id)) {
                            legacyUnits.push(p);
                        }
                    });
                });
                
                // Add units from on-demand property if it has any
                const onDemandUnits = (onDemandProperty as any)?.units || [];
                
                units = [...standaloneUnits, ...legacyUnits, ...onDemandUnits];
                
                // Remove duplicates by ID
                const seen = new Set();
                units = units.filter(u => {
                    const id = u.id || (u as any)._id;
                    if (seen.has(id)) return false;
                    seen.add(id);
                    return true;
                });

                // SOFT-DELETE + MUTE FILTER — hide units with status 'Deleted'
                // or 'Muted' from the workspace display layer. Muted units
                // (e.g. private owner use, self-management) don't need to
                // clutter daily operations but remain in the Edit Modal
                // for future reactivation. Deleted units are archived.
                // Both preserve ledger entries, receipts, and legal history.
                // ARCHIVED UNITS FIX (2026-09-14): the pre-filter list is
                // kept so the Units tab can LIST archived units with a
                // Restore action — previously "Remove Unit" promised
                // archiving but the units vanished with no way back.
                // (status 'Deleted'/'Muted' are written dynamically — the
                // static PropertyStatus union doesn't include them.)
                archivedUnitsList = units.filter(u => (u as any).status === 'Deleted');
                units = units.filter(u => (u as any).status !== 'Deleted' && (u as any).status !== 'Muted');

                // SORT by unitName for stable ordering
                units.sort((a, b) => {
                    const nameA = (a.rentalDetails as any)?.unitName || a.name || '';
                    const nameB = (b.rentalDetails as any)?.unitName || b.name || '';
                    return nameA.localeCompare(nameB, undefined, { numeric: true });
                });
            }
        }
        return { property: selectedProperty, owner: propertyOwner, allUnits: units, archivedUnits: archivedUnitsList };
    }, [matterState.contacts, coreState.properties, propertyId, onDemandProperty]);

    // Feature Checks — computed unconditionally so hooks always run in same order
    const isLeased = property?.category === 'Tenanted Property';
    const isSale = property?.category === 'Property For Sale';
    const hasMultipleUnits = allUnits.length > 1 || ((property as any)?.units?.length > 0);
    const isDisputed = property?.category === 'Disputed Property';

    // ─── ROUND R101: TENANCY LEDGER STATE (subsumed into the unit cards) ───
    // The tenancy lifecycle is no longer a separate console below the grid —
    // every unit card carries its own UnitTenancySection. This is the ONE
    // shared feed (the unit list mirrors the Units tab grid construction,
    // temp-ids included) so the whole grid costs a single reactive query.
    const tenancyUnits = useMemo(() => {
        const merged = [...(allUnits || [])]
            .map(u => u && u.id ? u : null)
            .filter((u): u is Property => u !== null);
        const legacyUnits = ((property as any)?.units || [])
            .map((u: any, idx: number) => ({ ...u, id: u.id || `temp-unit-${idx}` }))
            .filter((u: any) => u);
        legacyUnits.forEach((lu: any) => {
            if (!merged.some(u => u.id === lu.id || (u as any).name === lu.name)) {
                merged.push(lu);
            }
        });
        return merged.map((u: any) => {
            const d = getUnitDisplay(u);
            const rd = (u.rentalDetails || {}) as any;
            return {
                id: String(u.id),
                label: d?.name || rd.unitName || u.unitName || u.name || 'Unit',
                unitName: String(rd.unitName || u.unitName || u.name || ''),
                status: u.status || undefined,
                tenantName: rd.tenantName || u.tenantName,
                tenantPhone: rd.tenantPhone || u.tenantPhone,
                tenantEmail: rd.tenantEmail || u.tenantEmail,
                rentAmount: Number(rd.rentAmount ?? u.rentAmount ?? 0) || 0,
                rentFrequency: rd.rentFrequency || u.rentFrequency,
                leaseStart: rd.leaseStart || u.leaseStart,
                leaseEnd: rd.leaseEnd || u.leaseEnd,
            };
        });
    }, [allUnits, property]);
    const tenancyUnitById = useMemo(() => new Map(tenancyUnits.map((u) => [u.id, u])), [tenancyUnits]);
    const tenancyStatus = useUnitsTenancyStatus(
        coreState.firmDetails?.id || currentUser?.firmId || (property as any)?.firmId || '',
        activeTab === 'units' ? tenancyUnits : []
    );

    // AUTO-EXPAND target unit — when targetUnitId is set and we're on the
    // Units tab, find the matching unit and expand its drawer. Scroll it
    // into view smoothly. If targetUnitId is 'overdue' or empty, expand
    // the first unit with unpaid/partial rent status.
    //
    // This MUST be placed AFTER the useMemo that defines `allUnits` (above).
    // Previously it was placed BEFORE the useMemo, causing a TDZ error:
    //   ReferenceError: Cannot access 'm' before initialization
    // because `allUnits` is a const accessed before its declaration.
    useEffect(() => {
        if (activeTab !== 'units' || !highlightTarget) return;
        if (!allUnits || !Array.isArray(allUnits)) return;

        // Try to find the specific target unit first.
        // ID-SHAPE FIX (2026-09-14): lease-expiry / overdue notifications carry
        // the Convex `_id` of the unit row (units ARE properties-table rows
        // sharing an address), while the Units tab matches on the custom
        // `u.id` UUID — the target never matched, so the banner's deep link
        // opened the Units tab but never highlighted/expanded anything.
        // Compare BOTH id forms now.
        let targetUnit: Property | undefined;
        if (targetUnitId) {
            targetUnit = allUnits.find((u: Property) =>
                u.id === targetUnitId ||
                String(u.id) === String(targetUnitId) ||
                String((u as any)._id) === String(targetUnitId)
            );
        }

        // Fallback: if no specific unit found, pick the unit the banner is
        // actually ABOUT. R28: reason-aware — a lease_expired / lease_expiry
        // deep link expands the unit with the LEAST lease time remaining
        // (the most elapsed tenancy — exactly the unit the banner names);
        // overdue / no-reason links keep the legacy unpaid-service-charge
        // fallback. This closes the mismatch where an expired-tenancy
        // banner opened an unrelated unit that merely owed service charge.
        const leaseEndOf = (u: Property): number => {
            const rd = (u.rentalDetails || u) as any;
            const raw = rd?.leaseEnd ?? (u as any).leaseEnd;
            if (!raw) return NaN;
            const t = new Date(raw).getTime();
            return isNaN(t) ? NaN : t;
        };
        if (!targetUnit && (deepLinkReason === 'lease_expired' || deepLinkReason === 'lease_expiry')) {
            targetUnit = [...allUnits]
                .filter((u: Property) => !isNaN(leaseEndOf(u)))
                .sort((a: Property, b: Property) => leaseEndOf(a) - leaseEndOf(b))[0];
        }
        if (!targetUnit && (highlightTarget === 'overdue' || !targetUnitId)) {
            targetUnit = allUnits.find((u: Property) => {
                const rd = (u.rentalDetails || u) as any;
                const scStatus = rd.serviceChargeStatus || rd.serviceChargeStatus;
                return scStatus === 'UNPAID' || scStatus === 'unpaid' || scStatus === 'PARTIALLY_PAID';
            });
        }

        if (targetUnit) {
            setSelectedUnit(targetUnit);
            // Scroll into view after a short delay (let the row expand).
            // UNITS CONSOLE: rows carry BOTH id forms — data-unit-id (custom
            // id) and data-unit-convex-id (Convex _id) — so the deep-link
            // target lands on the right row whichever shape it carries.
            setTimeout(() => {
                const byCustomId = document.querySelector(`[data-unit-id="${targetUnit!.id}"]`);
                const byConvexId = (targetUnit as any)._id && String((targetUnit as any)._id) !== String(targetUnit!.id)
                    ? document.querySelector(`[data-unit-convex-id="${String((targetUnit as any)._id)}"]`)
                    : null;
                const el = byCustomId || byConvexId;
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
            // Clear after expansion so it doesn't re-trigger
            setTargetUnitId(null);
            setDeepLinkReason(null);
        }
    }, [targetUnitId, activeTab, allUnits, highlightTarget, deepLinkReason]);

    // Reset active tab if the current tab's render condition becomes false
    // (e.g., user was on 'units' tab but property lost its leased status)
    useEffect(() => {
        if ((activeTab === 'units' || activeTab === 'financials') && !(isLeased || hasMultipleUnits)) {
            setActiveTab('summary');
        }
    }, [activeTab, isLeased, hasMultipleUnits]);

    // ── Maintenance tickets for this property ──────────────────────────
    // Fetches all maintenance tickets linked to this property (or its
    // parent property if viewing a unit). Used to show visual indicators
    // on units that have open tickets, and to flag tickets that have been
    // sitting in the same status for >24 hours (stale).
    const parentPropertyId = (property as any)?.id || (property as any)?._id || propertyId || '';
    const ticketsForProperty = useQuery(
        api.portals.getMaintenanceTicketsByProperty,
        parentPropertyId ? { propertyId: String(parentPropertyId), sessionToken: bearerToken ?? undefined } : 'skip'
    );
    // Group tickets by unitId for quick lookup
    const ticketsByUnit = React.useMemo(() => {
        const map: Record<string, any[]> = {};
        for (const t of (ticketsForProperty || [])) {
            const key = String((t as any).unitId || t.unitId || '_property_level');
            if (!map[key]) map[key] = [];
            map[key].push(t);
        }
        return map;
    }, [ticketsForProperty]);

    // STRICT LINKING LOGIC:
    // 1. Must match the unit-specific property ID in specialtyData.
    // 2. Matter must not be Archived.
    const linkedMatters = useMemo(() => {
        if (!property?.id || !owner?.id) return [];

        return matterState.matters.filter(m =>
            m.clientId === owner!.id &&
            m.status !== MatterStatus.Archived &&
            m.specialtyData?.realEstate?.propertyId === property.id
        );
    }, [matterState.matters, owner?.id, property?.id]);

    const primaryMatter = linkedMatters[0];

    // Financials Calculation
    const propertyInvoices = useMemo(() => {
        if (!owner || !property) return [];
        return financeState.invoices.filter(inv => {
            if (!inv || !inv.client) return false;
            if (inv.client.id !== owner?.id) return false;
            const addressPart = (property.address || '').split(',')[0];
            if (!addressPart) return linkedMatters.some(m => inv.matter && inv.matter.id === m.id);
            const hasAddressMatch = inv.lineItems && inv.lineItems.some(li => li?.description && li.description.includes(addressPart));
            const hasMatterMatch = linkedMatters.some(m => inv.matter && inv.matter.id === m.id);
            return hasAddressMatch || hasMatterMatch;
        });
    }, [financeState.invoices, owner?.id, property?.address, linkedMatters]);

    const allPropertyLedgerEntries = useMemo(() => {
        return (coreState.ledgerEntries || [])
            .filter(e => (e.propertyId === property?.id || e.unitId === property?.id));
    }, [coreState.ledgerEntries, property?.id]);

    // FINANCIAL LIFECYCLE (accounting-integrity round): the property's
    // money figures (total collected, management fee, recent activity)
    // exclude voided/test records — they are annotations, not money. The
    // raw list above stays unfiltered so nothing else silently changes.
    const activePropertyLedgerEntries = useMemo(() => {
        return allPropertyLedgerEntries.filter(e => e.recordStatus !== 'voided' && e.recordStatus !== 'test');
    }, [allPropertyLedgerEntries]);

    const propertyLedgerEntries = useMemo(() => {
        return [...activePropertyLedgerEntries]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 3);
    }, [allPropertyLedgerEntries]);

    const propertyDocuments = useMemo(() => {
        // ROUND E (WAVE E3) REVIVAL: match on documents.propertyId — the
        // REAL link — accepting both id forms (custom id + Convex _id) of
        // every address-sibling row, plus the legacy `prop_<id>` fake
        // matterId bridge for rows uploaded from this surface before the
        // revival (that fake id was the only thing those uploads stamped).
        // The old heuristic (categoryId `prop_<id>_` prefix — nothing ever
        // wrote it — or title containing the street name — over-matching)
        // never looked at propertyId, which is why the section read dead.
        // Use hasPropertyFeatures (not isProperty) so Komplete firms also
        // see property documents when viewing a property.
        if (hasPropertyFeatures && property) {
            const addrKey = normalizeAddress(property.address || '');
            const groupIds = new Set<string>();
            const legacyMatterIds = new Set<string>();
            const addRow = (p: any) => {
                if (!p) return;
                if (p.id != null) { groupIds.add(String(p.id)); legacyMatterIds.add(`prop_${p.id}`); }
                if (p._id != null) { groupIds.add(String(p._id)); legacyMatterIds.add(`prop_${p._id}`); }
            };
            addRow(property);
            (coreState.properties || []).forEach(p => {
                if (normalizeAddress(p.address || '') === addrKey) addRow(p);
            });
            return documentState.documents.filter(d => {
                if (!d) return false;
                if (d.propertyId && groupIds.has(String(d.propertyId))) return true;
                if (d.matterId && legacyMatterIds.has(String(d.matterId))) return true;
                return false;
            });
        } else {
            if (linkedMatters.length === 0) return [];
            const matterIds = linkedMatters.map(m => m.id);
            return documentState.documents.filter(d => d && matterIds.includes(d.matterId!));
        }
    }, [documentState.documents, coreState.properties, linkedMatters, hasPropertyFeatures, property, property?.id, property?.address]);

    // --- Now safe to early-return after all hooks have been called ---
    if (!property) return (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
            <div className="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                <OfficeBuildingIcon className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-lg font-medium">Property not found</p>
            <p className="text-sm mt-1">ID: {propertyId || 'None'}</p>
        </div>
    );

    const onGoBack = () => navigateTo('properties');


    const handleDraftAction = (actionTitle: string, type: string, unit?: Property) => {
        const display = unit ? getUnitDisplay(unit) : null;
        const draftTitle = `${actionTitle} - ${display?.name || property.address.split(',')[0]}`;
        const firmId = coreState.firmDetails?.id || '';
        const sessionKey = draftSessionKey({ matterId: primaryMatter?.id, title: draftTitle });
        const existing = firmId ? loadDraftSession(firmId, sessionKey) : null;

        if (existing?.content?.trim()) {
            // DRAFTPRO-NEW-TAB — secondary entry point (TODO: route through openDraftProNewTab)

            openEditor(existing.documentId || null, {
                draftTitle: existing.title || draftTitle,
                draftContent: existing.content,
                matterId: primaryMatter?.id,
                disableAutoDraft: true,
            });
            return;
        }

        addToast(`Preparing ${actionTitle}...`, { type: 'info' });

        let prompt = `Write a formal legal document: **${actionTitle}**.\n\n`;
        prompt += `**PROPERTY DETAILS:**\n`;
        prompt += `- Address: ${property.address}\n`;
        if (display) {
            prompt += `- Unit: ${display.name} (Floor ${display.floor})\n`;
        }
        prompt += `- Description: ${property.description || 'N/A'}\n\n`;

        prompt += `**PARTIES:**\n`;
        prompt += `- Landlord/Owner: ${owner?.name} (${owner?.address || 'Address on file'})\n`;

        const tenantName = display?.tenantName || property.rentalDetails?.tenantName;
        const rentAmount = display?.rentAmount ?? 0;
        const rentFreq = display?.rentFrequency || property.rentalDetails?.rentFrequency;
        const leaseEnd = display?.leaseEnd || property.rentalDetails?.leaseEnd;

        if (isLeased && (property.rentalDetails || unit)) {
            prompt += `- Tenant: ${tenantName || '[TENANT NAME]'}\n`;
            prompt += `\n**TENANCY TERMS:**\n`;
            prompt += `- Rent: N${formatNaira(rentAmount || 0)} per ${rentFreq || 'annum'}\n`;
            prompt += `- Current Term Ends: ${leaseEnd || '[DATE]'}\n`;
        }

        if (isSale && property.saleDetails) {
            prompt += `\n**SALE TERMS:**\n`;
            prompt += `- Consideration: N${formatNaira(property.saleDetails.targetPrice || property.value || 0)}\n`;
        }

        if (type === 'Quit') {
            prompt += `\n**SPECIFIC INSTRUCTION:** This is a Notice to Quit. Ensure it complies with the Tenancy Law / Recovery of Premises Law of the state where the property is located (e.g., Lagos Tenancy Law 2011, Abuja Tenancy Law 2013, Rivers State Tenancy Law, etc.). Cite the expiration of the current term as the reason. Give the statutory notice period required for a ${rentFreq || 'yearly'} tenant under that state's law.`;
        } else if (type === 'Demand') {
            prompt += `\n**SPECIFIC INSTRUCTION:** This is a Demand Notice for overdue rent. State clearly the arrears and the consequence of failure to pay (legal action for recovery of premises).`;
        }

        prompt += `\n\n**FORMAT:** Use standard Nigerian legal formatting. Start with the Title centered.`;

        setTimeout(() => {
            // DRAFTPRO-NEW-TAB — secondary entry point (TODO: route through openDraftProNewTab)
            // DRAFTPRO-NEW-TAB — secondary entry point (TODO: route through openDraftProNewTab)

            openEditor(null, {
                draftTitle,
                draftPrompt: prompt,
                matterId: primaryMatter?.id,
                openedByAloa: true,
            });
        }, 300);
    };

    const handleApplyTemplate = (template: any, unit?: Property) => {
        addToast(`Applying template: ${template.name}...`, { type: 'info' });
        
        const addressPart = (property.address || '').split(',')[0] || 'Property';
        const display = unit ? getUnitDisplay(unit) : null;
        const tenantName = display?.tenantName || property.rentalDetails?.tenantName;
        const rentAmount = display?.rentAmount ?? 0;
        const leaseEnd = display?.leaseEnd || property.rentalDetails?.leaseEnd;

        const meta: Record<string, string> = {
            'TENANT NAME': tenantName || '[TENANT NAME]',
            'PROPERTY ADDRESS': property.address,
            'UNIT NAME': display?.name || (property.rentalDetails?.unitName || 'N/A'),
            'RENT AMOUNT': `₦${formatNaira(rentAmount || 0)}`,
            'LEASE END DATE': leaseEnd || '[LEASE END DATE]',
            'LANDLORD NAME': owner?.name || 'N/A',
            'DATE': new Date().toLocaleDateString('en-GB')
        };

        // Fill placeholders in the content
        let content = template.content;
        Object.entries(meta).forEach(([key, val]) => {
            // Replace both [KEY] text and placeholder tags
            const textRegex = new RegExp(`\\[${key}\\]`, 'gi');
            content = content.replace(textRegex, val);
            
            const tagRegex = new RegExp(`<span[^>]*data-label="${key}"[^>]*><\\/span>`, 'gi');
            content = content.replace(tagRegex, `<span>${val}</span>`);
        });

        setTimeout(() => {
            // DRAFTPRO-NEW-TAB — secondary entry point (TODO: route through openDraftProNewTab)
            // DRAFTPRO-NEW-TAB — secondary entry point (TODO: route through openDraftProNewTab)

            openEditor(content, {
                draftTitle: `${template.name} - ${display?.name || addressPart}`,
                matterId: primaryMatter?.id,
                openedByAloa: false,
                disableAutoDraft: true,
            });
        }, 300);
    };

    const handleInitializeMatter = async (unit?: any, force = false) => {
        // DEDUP SAFEGUARD — check for existing active matters matching
        // this unit or property before creating a duplicate.
        const existingMatters = unit
            ? matterState.matters.filter(m =>
                m.specialtyData?.realEstate?.propertyId === property.id &&
                (m.title.includes(unit.name) || m.specialtyData?.realEstate?.unitId === unit.id)
              )
            : linkedMatters;
        const existingCount = existingMatters.length;

        if (existingCount > 0 && !force) {
            const existingMatter = existingMatters[0];
            const matterTitle = existingMatter?.title || 'Untitled';
            const unitOrPropertyName = unit ? unit.name : property.address.split(',')[0];
            openModal('deleteConfirmation', property.id, {
                title: "Active Legal Matter Exists",
                message: `An active legal file (${matterTitle}) is already open for ${unitOrPropertyName}.`,
                onConfirm: () => handleInitializeMatter(unit, true),
                confirmText: "Create Additional Matter",
                cancelText: "Open Existing Matter",
                onCancel: () => {
                    if (existingMatter) {
                        navigateTo('matterDetail', existingMatter.id);
                    }
                },
            });
            return;
        }

        // Prepare strict context for the new matter
        const addressPart = property.address.split(',')[0];

        const unitRental = unit ? (unit.rentalDetails || unit) : null;
        const unitName = unit
            ? (unit.name || unit.address || unitRental?.unitName || '')
            : (property.rentalDetails?.unitName || property.description || '');
        const unitTenantName = unitRental?.tenantName || '';
        const unitTenantPhone = unitRental?.tenantPhone || '';
        const unitTenantEmail = unitRental?.tenantEmail || '';
        const unitLeaseEnd = unitRental?.leaseEndDate || unitRental?.leaseEnd || '';

        // NAMING CONVENTION FIX — clean title without duplicate address.
        // Format: Tenancy: [Address Short] — [Unit Name] ([Tenant Name])
        // Example: Tenancy: No.20 Westsyde Drive — Unit 2 (Samuel Oluwasegun)
        // Was: Tenancy: No.20 Westsyde Drive — No.20 Westsyde Drive [Samuel Oluwasegun]
        // (duplicate address + square brackets for tenant name)
        const matterTitle = isSale
            ? `Sale: ${addressPart}${unitName ? ` — ${unitName}` : ''}${unitTenantName ? ` (${unitTenantName})` : ''}`
            : `Tenancy: ${addressPart}${unitName ? ` — ${unitName}` : ''}${unitTenantName ? ` (${unitTenantName})` : ''}`;

        const matterType = 'Real Estate';
        const subCategory = isSale ? 'Acquisition' : 'Lease/Tenancy';

        const propValue = unit
            ? (unitRental?.value || unit.value || 0)
            : (property.value || property.saleDetails?.targetPrice || 0);
        const rentAmount = unit
            ? (unitRental?.rentAmount || unit.rentAmount || 0)
            : (property.rentalDetails?.rentAmount || 0);
        const defaultFee = isSale ? propValue * 0.1 : rentAmount * 0.1;

        // Build a rich description with all available unit context
        const descParts = [`Property: ${property.address}`];
        if (unitName) descParts.push(`Unit: ${unitName}`);
        if (unitTenantName) descParts.push(`Tenant: ${unitTenantName}`);
        if (unitTenantPhone) descParts.push(`Phone: ${unitTenantPhone}`);
        if (unitTenantEmail) descParts.push(`Email: ${unitTenantEmail}`);
        if (rentAmount > 0) descParts.push(`Rent: ₦${rentAmount.toLocaleString()}`);
        if (unitLeaseEnd) descParts.push(`Lease Ends: ${unitLeaseEnd}`);

        const newMatterData: any = {
            title: matterTitle,
            clientId: owner?.id,
            type: matterType,
            subCategory,
            description: descParts.join(' | '),
            status: MatterStatus.Active,
            stage: 'Intake',
            stageLastUpdated: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            assignedUsers: currentUser ? [currentUser.id] : [],
            referenceNumber: `PROP-${Date.now().toString().slice(-6)}`,
            billingModel: BillingModel.FixedFee,
            fixedFeeAmount: defaultFee,
            hourlyRate: 100000,
            billingBase: isSale ? 'Value' : 'Rent',
            billingCurrency: 'NGN',
            suitNumber: '',
            court: '',
            judicialDivision: '',
            specialtyData: {
                realEstate: {
                    purchasePrice: isSale ? propValue : 0,
                    propertyId: property.id,
                    unitId: unit?.id || undefined,
                    unitName: unitName || undefined,
                    tenantName: unitTenantName || undefined,
                    tenantPhone: unitTenantPhone || undefined,
                    tenantEmail: unitTenantEmail || undefined,
                    rentAmount: rentAmount || undefined,
                    leaseEndDate: unitLeaseEnd || undefined,
                    transactionType: isSale ? 'Sale' : 'Lease'
                }
            }
        };

        try {
            addToast('Initializing property matter...', { type: 'info' });
            const result = await onAddMatter(newMatterData, null);
            if (result && result.id) {
                addToast('Matter initialized successfully', { type: 'success' });
                // PIPELINE FIX — Await backend mutation response BEFORE
                // triggering client navigation. Previously, navigateTo
                // fired immediately after the mutation returned, but the
                // Convex subscription hadn't updated matterState.matters
                // yet. The MatterDetailView then tried to find the matter
                // in state → "Matter not found" error toast.
                // Fix: wait 500ms for the subscription to sync before
                // navigating. This gives the client time to receive the
                // new matter record from Convex.
                setTimeout(() => {
                    navigateTo('matterDetail', result.id);
                }, 500);
            }
        } catch (error) {
            console.error("Failed to initialize matter", error);
            addToast('Failed to initialize matter', { type: 'error' });
        }
    };

    const handleListForSale = () => {
        openModal('deleteConfirmation', property.id, {
            title: "List for Sale?",
            message: "Are you sure you want to change this property status to 'For Sale'?",
            onConfirm: () => {
                updateItem('properties', { id: property.id, category: 'Property For Sale', status: 'Listed' }, 'Property Listed');
                addToast("Property listed for sale.", { type: 'success' });
            },
            confirmText: "List for Sale"
        });
    };

    // ─── Eviction Workflow Handlers ───
    // STATUTORY EVICTION STATE MACHINE (Nigerian Tenancy Law compliant)
    // Streamlined per user request:
    //   1. Draft / Generate Statutory Notice
    //   2. Mark as Served (records timestamp + activates countdown)
    //   3. Statutory Countdown Timer (6mo/1mo/7days based on tenancy frequency)
    //   4. Auto-qualify for 7-Day Notice of Owner's Intention on expiry
    //
    // "Mark as Delivered" has been removed — "Served" is the sole statutory
    // milestone under state tenancy / recovery of premises laws. The countdown
    // activates immediately on serve. The specific notice period is determined
    // by the law of the state where the property is located.

    const logEvictionEvent = (tracker: EvictionTracker, event: EvictionEvent): EvictionTracker => {
        const eventLog = tracker.eventLog || [];
        return { ...tracker, eventLog: [...eventLog, { ...event, actorId: currentUser?.id }] };
    };

    const updateEvictionTracker = (unit: any, updates: Partial<EvictionTracker>) => {
        const tracker = getEvictionTracker(unit);
        const updatedTracker = { ...tracker, ...updates };
        const rentalDetails = { ...((unit as any).rentalDetails || {}), evictionTracker: updatedTracker };
        const full = (coreState.properties || []).find((u: Property) => u.id === unit.id) || unit;
        updateItem('properties', { ...full, rentalDetails }, 'Property');
    };

    const handleQuitNoticeDrafted = (unit: any) => {
        const tracker = getEvictionTracker(unit);

        // SUPERSEDE SAFEGUARD — if a notice is already served, generating a
        // fresh notice requires confirmation. The old notice transitions to
        // 'superseded' and the countdown resets.
        if (tracker.quitNoticeStatus === 'served' || tracker.quitNoticeStatus === 'drafted') {
            const servedDate = tracker.quitNoticeServedDate
                ? new Date(tracker.quitNoticeServedDate).toLocaleDateString('en-GB')
                : null;
            openModal('deleteConfirmation', unit.id, {
                title: 'Active Statutory Notice Detected',
                message: `An active Quit Notice was marked as served on ${servedDate}. Generating a fresh notice will nullify the active statutory countdown and restart legal service.`,
                confirmText: 'Generate Fresh Notice',
                cancelText: 'Cancel',
                onConfirm: () => {
                    // Supersede the old notice — transition to 'superseded',
                    // reset countdown, log the event immutably
                    const supersededTracker = logEvictionEvent(tracker, {
                        type: 'superseded',
                        timestamp: Date.now(),
                        notes: `Previous notice (served ${servedDate}) superseded by fresh draft.`,
                    });
                    updateEvictionTracker(unit, {
                        ...supersededTracker,
                        quitNoticeStatus: 'superseded',
                        quitNoticeSupersededDate: Date.now(),
                        quitNoticeCountdownEndDate: undefined,
                        sevenDayNoticeStatus: 'none',
                        sevenDayNoticeDueDate: undefined,
                    });
                    addToast('Previous notice superseded. Opening fresh notice editor.', { type: 'info' });
                    handleDraftAction('Notice to Quit', 'Quit', unit);
                },
            });
            return;
        }

        // Normal flow — no active notice, just open the editor
        handleDraftAction('Notice to Quit', 'Quit', unit);
        // Mark as drafted + log event
        const newTracker = logEvictionEvent(tracker, {
            type: 'drafted',
            timestamp: Date.now(),
        });
        updateEvictionTracker(unit, {
            quitNoticeStatus: 'drafted',
            quitNoticeDraftedDate: Date.now(),
            eventLog: newTracker.eventLog,
        });
        addToast('Notice editor opened. After saving, use "Mark as Served" to activate the statutory countdown.', { type: 'info' });
    };

    const handleMarkQuitNoticeServed = (unit: any, serviceMethod: string = 'personal') => {
        const tracker = getEvictionTracker(unit);
        if (tracker.quitNoticeStatus !== 'drafted') return;

        const servedDate = Date.now();
        const rental = (unit as any).rentalDetails || {};
        const rentFrequency = rental.rentFrequency || 'yearly';
        const noticeMonths = getNoticePeriodMonths(rentFrequency);
        const countdownEnd = new Date(servedDate);
        countdownEnd.setMonth(countdownEnd.getMonth() + noticeMonths);

        // Log the served event immutably
        const updatedTracker = logEvictionEvent(tracker, {
            type: 'served',
            timestamp: servedDate,
            notes: `Service method: ${serviceMethod}. Statutory period: ${noticeMonths} months. Countdown expires ${countdownEnd.toLocaleDateString('en-GB')}.`,
        });

        updateEvictionTracker(unit, {
            ...updatedTracker,
            quitNoticeStatus: 'served',
            quitNoticeServedDate: servedDate,
            quitNoticeServiceMethod: serviceMethod,
            quitNoticeCountdownEndDate: countdownEnd.getTime(),
            // Pre-qualify the 7-Day Notice as 'due' once countdown expires.
            // The countdown is checked client-side; when it expires, the
            // 7-Day Notice button becomes active.
            sevenDayNoticeStatus: 'due',
            sevenDayNoticeDueDate: countdownEnd.getTime(),
        });

        addToast(`Quit Notice marked as served. Statutory countdown active — 7-Day Notice qualifies on ${countdownEnd.toLocaleDateString('en-GB')}.`, { type: 'success' });
    };

    // handleMarkQuitNoticeDelivered REMOVED — "Served" is the sole statutory
    // milestone under Nigerian tenancy law. The countdown activates on serve.

    const handleDraftSevenDayNotice = (unit: any) => {
        const d = getUnitDisplay(unit);
        const tracker = getEvictionTracker(unit);

        let prompt = `Write a formal legal document: **7-Day Notice of Owner's Intention to Recover Premises**.\n\n`;
        prompt += `**PROPERTY DETAILS:**\n`;
        prompt += `- Address: ${property.address}\n`;
        if (d.name) prompt += `- Unit: ${d.name}\n`;
        prompt += `\n**PARTIES:**\n`;
        prompt += `- Landlord/Owner: ${owner?.name || '[LANDLORD NAME]'}\n`;
        prompt += `- Tenant: ${d.tenantName || '[TENANT NAME]'}\n`;
        prompt += `\n**CONTEXT:**\n`;
        prompt += `- Notice to Quit was served on ${tracker.quitNoticeServedDate ? new Date(tracker.quitNoticeServedDate).toLocaleDateString('en-GB') : '[DATE]'}\n`;
        prompt += `- The statutory notice period has expired and the tenant remains in possession\n`;
        prompt += `\n**SPECIFIC INSTRUCTION:** This is a 7-Day Notice of Owner's Intention to Recover Premises under the Recovery of Premises Law of the state where the property is located (e.g., Lagos Tenancy Law 2011, Abuja Tenancy Law 2013, Rivers State Tenancy Law, etc.). The tenant has failed to yield possession after the quit notice period expired. Give 7 days from service of this notice for the tenant to vacate, failing which legal proceedings for recovery of premises will be commenced.\n`;
        prompt += `\n**FORMAT:** Use standard Nigerian legal formatting. Start with the Title centered.`;

        const draftTitle = `7-Day Notice - ${d.name || property.address.split(',')[0]}`;
        setTimeout(() => {
            openEditor(null, {
                draftTitle,
                draftPrompt: prompt,
                matterId: primaryMatter?.id,
                openedByAloa: true,
            });
        }, 300);

        // Log the 7-Day issued event
        const updatedTracker = logEvictionEvent(tracker, {
            type: 'seven_day_issued',
            timestamp: Date.now(),
            notes: `7-Day Notice of Owner's Intention to Recover Premises drafted.`,
        });
        updateEvictionTracker(unit, {
            ...updatedTracker,
            sevenDayNoticeStatus: 'drafted',
            sevenDayNoticeDraftedDate: Date.now(),
        });
    };


    return (
        <div className="flex flex-col bg-slate-50 dark:bg-zinc-900 h-full overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 z-20 shadow-sm">
                <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                    <button onClick={onGoBack} className="text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors text-xs font-bold uppercase flex items-center gap-1 flex-shrink-0">
                        &larr;
                    </button>
                    <div className="h-6 w-px bg-slate-200 dark:bg-zinc-700 flex-shrink-0"></div>
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className={`p-1.5 rounded-lg flex-shrink-0 ${isLeased ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            <OfficeBuildingIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-white truncate leading-none max-w-[160px] sm:max-w-md">{property.address}</h2>
                            </div>
                            <p className="text-2xs sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5 flex gap-1 sm:gap-2 truncate">
                                {property.propertyType || 'Property'} • {owner?.name || 'Owner'}
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <button
                        onClick={() => openModal('editProperty', property.id, { contactId: owner?.id })}
                        className="px-2 sm:px-3 py-1.5 bg-slate-100 dark:bg-zinc-700 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors text-slate-600 dark:text-zinc-300 text-xs font-bold flex items-center gap-1 sm:gap-2"
                    >
                        <EditIcon className="w-4 h-4" /><span className="hidden sm:inline">Edit</span>
                    </button>
                </div>
            </div>
            </div>


            {/* Tabs — horizontally scrollable on mobile */}
            <div className="flex-shrink-0 border-b border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
                <div className="max-w-7xl mx-auto px-3 sm:px-6">
                    <nav className="-mb-px flex space-x-3 sm:space-x-6 overflow-x-auto no-scrollbar whitespace-nowrap scrollbar-none touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
                        {([
                            { id: 'summary', label: <><ClipboardList className="w-4 h-4 inline mr-1" /> Summary</> },
                            ...((isLeased || hasMultipleUnits) ? [{ id: 'units', label: <><Home className="w-4 h-4 inline mr-1" /> Units</> }] : []),
                            { id: 'notices' as PropertyTab, label: <><Megaphone className="w-4 h-4 inline mr-1" /> <span className="hidden sm:inline">Notice </span>Board</> },
                            ...((isLeased || hasMultipleUnits) ? [{ id: 'financials' as PropertyTab, label: <><Wallet className="w-4 h-4 inline mr-1" /> Finance</> }] : []),
                            { id: 'relationships' as PropertyTab, label: <><Link2 className="w-4 h-4 inline mr-1" /> <span className="hidden sm:inline">Use&nbsp;</span>Relationships</> },
                            { id: 'tracking', label: <><Radio className="w-4 h-4 inline mr-1" /> <span className="hidden sm:inline">Activity &amp; </span>Tracking</> },
                        ] as { id: PropertyTab; label: React.ReactNode }[]).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors flex-shrink-0 ${
                                    activeTab === tab.id
                                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar overscroll-contain" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}>
                <div className="max-w-7xl mx-auto p-3 sm:p-8 pb-24 md:pb-8 min-w-0" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 6rem)' }}>

                {/* CRO AUDIT FIX — REMOVED the static Komplete Bridge banner.
                    Per user request: "Strip Komplete Bridge Static Banner —
                    completely remove the permanent static KOMPLETE BRIDGE
                    purple-gradient callout card."
                    The property summary now opens directly into clean
                    Property Information cards without top-heavy promotional
                    banners. Legal matter linking is now available via
                    event-driven contextual triggers (notice generation,
                    lease breach) and the Property Actions menu. */}

                {activeTab === 'summary' && (
                    <div className="space-y-8 animate-fade-in overflow-x-hidden w-full">

                        {/* 1. Core Information & Quick Actions Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
                            {/* Identity Card */}
                            <div className={`${(isLeased || hasMultipleUnits) ? 'lg:col-span-3' : 'lg:col-span-2'} bg-white dark:bg-zinc-800 rounded-lg shadow-sm p-4 sm:p-6 border border-slate-200 dark:border-zinc-700 overflow-x-hidden w-full`}>
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-700 pb-2 mb-4">
                                    <div className="flex flex-wrap items-center gap-3 min-w-0">
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-white whitespace-normal">Property Information</h3>
                                        {allUnits.length > 1 && (
                                            <button
                                                onClick={() => setActiveTab('units')}
                                                className="px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-2xs font-black text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800 hover:bg-primary-100 transition-all flex items-center gap-1 whitespace-nowrap flex-shrink-0"
                                            >
                                                {allUnits.length} Units Found <span className="opacity-50">&rarr;</span>
                                            </button>
                                        )}
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase whitespace-nowrap flex-shrink-0 ${property.status === 'Occupied' ? 'bg-green-100 text-green-800' : 'bg-slate-100 dark:bg-zinc-800 text-slate-800'}`}>
                                        {property.status}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4 sm:gap-x-8">
                                    <DetailItem label="Address" value={property.address} />
                                    <DetailItem label="Type" value={`${property.propertyType || 'General'} (${property.category})`} />

                                    {property.description && (
                                        <div className="col-span-2">
                                            <DetailItem label="Description" value={property.description} />
                                        </div>
                                    )}

                                    {(isLeased || isSale || (property.value && property.value > 0)) && (
                                        <DetailItem
                                            label={isLeased ? (hasMultipleUnits ? "Total Annual Rent" : "Rent Amount") : (isSale ? "Target Price" : "Valuation")}
                                            value={<><NairaSymbol />{formatNaira(
                                                isLeased
                                                    ? (hasMultipleUnits
                                                        ? allUnits.reduce((sum: number, u: Property) => sum + Number((u.rentalDetails as any)?.rentAmount || 0), 0)
                                                        : (property.rentalDetails?.rentAmount || 0))
                                                    : (isSale ? property.saleDetails?.targetPrice : property.value) || 0
                                            )} <span className="text-xs text-slate-400 font-normal">{isLeased ? '/year' : ''}</span></>}
                                        />
                                    )}

                                    <DetailItem 
                                        label="Portfolio Type" 
                                        value={property.ownershipType === 'owned' ? 'Personal Portfolio' : 'Managed for Client'} 
                                    />
                                    {property.ownershipType !== 'owned' && (
                                        <DetailItem 
                                            label={isSale ? "Professional Fee" : "Management Fee"} 
                                            value={`${property.managementFeePercentage || 0}%`} 
                                            subText={isSale ? "of sale price" : "of collected rent"} 
                                        />
                                    )}

                                    {/* Consolidated Rental Info */}
                                    {isLeased && property.rentalDetails && (
                                        <>
                                            <DetailItem label="Resident" value={property.rentalDetails.tenantName || 'Unknown'} subText={property.rentalDetails.tenantPhone} />
                                            <DetailItem
                                                label="Lease Expiry"
                                                value={property.rentalDetails.leaseEnd ? new Date(property.rentalDetails.leaseEnd).toLocaleDateString('en-GB') : 'N/A'}
                                            />
                                            {property.rentalDetails.leaseEnd && (
                                                <DetailItem 
                                                    label="Next Rent Review" 
                                                    value={calculateRentReviewDate(property.rentalDetails.leaseEnd, property.rentalDetails.rentFrequency)?.toLocaleDateString('en-GB') || 'N/A'} 
                                                    subText="Auto-calculated (2 weeks before statutory notice)"
                                                />
                                            )}
                                            {(() => {
                                                // Unified resolution — property's own SC uses the same chain
                                                // (amount-first, 0-valid) as the units grid / SC table.
                                                const scRes = resolveServiceCharge({ unit: property, rental: property.rentalDetails });
                                                return scRes.amount > 0 ? (
                                                    <DetailItem label="Service Charge" value={
                                                        <span data-sc-source={import.meta.env.DEV ? scRes.source : undefined} title={serviceChargeDebugTitle(scRes.source)}>
                                                            <NairaSymbol />{formatNaira(scRes.amount)}
                                                        </span>
                                                    } />
                                                ) : null;
                                            })()}
                                            {property.minimumVendEnabled && (
                                                <DetailItem 
                                                    label={property.minimumVendLabel || 'Minimum Vend'} 
                                                    value={<><NairaSymbol />{formatNaira(property.minimumVendAmount || 0)}</>} 
                                                    subText="Estate minimum utility vend" 
                                                />
                                            )}
                                            {(property.rentalDetails.legalFee || 0) > 0 && (
                                                <DetailItem label="Legal Fee" value={<><NairaSymbol />{formatNaira(property.rentalDetails.legalFee || 0)}</>} />
                                            )}
                                            {(property.rentalDetails.agencyFee || 0) > 0 && (
                                                <DetailItem label="Agency Fee" value={<><NairaSymbol />{formatNaira(property.rentalDetails.agencyFee || 0)}</>} />
                                            )}
                                            {(property.rentalDetails.cautionDeposit || 0) > 0 && (
                                                <DetailItem label="Caution Deposit" value={<><NairaSymbol />{formatNaira(property.rentalDetails.cautionDeposit || 0)}</>} />
                                            )}
                                        </>
                                    )}
                                </div>


                            </div>

                            {/* Quick Actions (Right Side) - ONLY for properties WITHOUT a Units tab */}
                            {!(isLeased || hasMultipleUnits) && (
                                <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm p-5 border border-slate-200 dark:border-zinc-700 flex flex-col">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Quick Actions</h3>
                                    <div className="space-y-2 flex-grow">
                                        {isLeased ? (
                                            <>
                                                <ActionButton onClick={() => openModal('collectRent', property.id)} label="Record payment & receipt" />
                                                <ActionButton onClick={() => handleDraftAction('Rent Demand Notice', 'Demand')} label="Rent Demand" />
                                                <ActionButton onClick={() => handleDraftAction('Notice to Quit', 'Quit')} label="Notice to Quit" />
                                                <ActionButton onClick={() => handleDraftAction('Tenancy Agreement', 'Agreement')} label="Tenancy Agreement" />
                                                <ActionButton onClick={() => openModal('composeEmail', null, { to: property.rentalDetails?.tenantEmail || owner?.email || '', subject: `Property Update: ${property.address}` })} label="Email Resident" />
                                            </>
                                        ) : isSale ? (
                                            <>
                                                <ActionButton onClick={() => handleDraftAction('Contract of Sale', 'Sale')} label="Contract of Sale" />
                                                <ActionButton onClick={() => handleDraftAction('Deed of Assignment', 'Deed')} label="Deed of Assignment" />
                                            </>
                                        ) : (
                                            <ActionButton onClick={() => handleDraftAction('Letter of Intent', 'Letter')} label="Draft Letter" />
                                        )}
                                        <ActionButton onClick={handleListForSale} label="List for Sale" />

                                        {linkedMatters.length === 0 ? (
                                            <button
                                                onClick={() => handleInitializeMatter()}
                                                className="w-full text-left px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 hover:border-blue-400 transition-all text-xs font-bold text-blue-700 dark:text-blue-300 flex justify-between items-center group mt-2"
                                            >
                                                {isProperty ? 'Initialize File' : 'Initialize Matter'} <span className="text-blue-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">&rarr;</span>
                                            </button>
                                        ) : (
                                            <div className="mt-2 space-y-2">
                                                <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-100 dark:border-green-900">
                                                    <p className="text-2xs text-green-700 dark:text-green-300 font-bold mb-1">{isProperty ? 'Management File Active' : 'Matter Active'} ({linkedMatters.length})</p>
                                                    {linkedMatters.map(m => (
                                                        <p key={m.id} onClick={() => navigateTo('matterDetail', m.id)} className="text-xs text-slate-600 dark:text-zinc-400 truncate hover:text-primary-600 cursor-pointer mb-1 last:mb-0">
                                                            • {m.title}
                                                        </p>
                                                    ))}
                                                </div>
                                                <button 
                                                    onClick={() => handleInitializeMatter()}
                                                    className="w-full py-1 text-3xs font-black uppercase text-slate-400 hover:text-primary-600 transition-colors tracking-tight"
                                                >
                                                    + New {isProperty ? 'File' : 'Matter'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 2. Linked Matters & Automation Status */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Automation Status — compact summary */}
                            <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm p-5 border border-slate-200 dark:border-zinc-700">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                                    <ZapIcon className="w-4 h-4 text-amber-500" /> Automation Status
                                </h3>
                                <div className="space-y-2">
                                    {isLeased && (
                                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-100 dark:border-zinc-700">
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${property.automationSettings?.remindLeaseExpiry ? 'bg-green-500' : 'bg-slate-300'}`} />
                                            <div>
                                                <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">Lease Expiry Reminders</p>
                                                <p className="text-2xs text-slate-400">{property.automationSettings?.remindLeaseExpiry ? 'Active — alerts 90 days before expiry' : 'Not enabled'}</p>
                                            </div>
                                        </div>
                                    )}
                                    {/* SIMPLIFY FIX: "Auto Rent Demands" status card removed —
                                        automationSettings.autoRentDemand is never written by any
                                        form or flow, so this permanently displayed "Not enabled"
                                        (a lie). Real arrears automation lives in Financials →
                                        Reminder Rules. */}
                                    {!isLeased && !isSale && (
                                        <p className="text-xs text-slate-400 italic">No automations configured for this property type.</p>
                                    )}
                                </div>
                            </div>

                            {linkedMatters.length > 0 && (
                                <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm p-5 border border-slate-200 dark:border-zinc-700">
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-3">{isProperty ? 'Linked Files' : 'Linked Matters'}</h3>
                                    <div className="space-y-2">
                                        {linkedMatters.map(m => (
                                            <div key={m.id} className="p-2.5 bg-slate-50 dark:bg-zinc-700/30 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors flex items-center justify-between" onClick={() => navigateTo('matterDetail', m.id)}>
                                                <div>
                                                    <p className="text-xs font-bold text-primary-600">{m.title}</p>
                                                    <p className="text-2xs text-slate-500">{m.stage} • {m.type}</p>
                                                </div>
                                                <span className="text-2xs text-slate-400">&rarr;</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* ROUND E (Wave E1): single-unit properties without
                                a Units tab still get the lifecycle console on the
                                Summary tab — the property row IS the unit. */}
                            {!(isLeased || hasMultipleUnits) && (() => {
                                const rd = (property.rentalDetails || {}) as any;
                                const d = getUnitDisplay(property);
                                return (
                                    <TenancyLifecyclePanel
                                        firmId={coreState.firmDetails?.id || currentUser?.firmId || property.firmId || ''}
                                        propertyAddress={property.address || ''}
                                        propertyId={property.id}
                                        units={[{
                                            id: property.id,
                                            label: d?.name || rd.unitName || property.address || 'Unit',
                                            unitName: String(rd.unitName || ''),
                                            status: property.status || undefined,
                                            tenantName: rd.tenantName || (property as any).tenantName,
                                            tenantPhone: rd.tenantPhone,
                                            tenantEmail: rd.tenantEmail,
                                            rentAmount: Number(rd.rentAmount) || 0,
                                            rentFrequency: rd.rentFrequency,
                                            leaseStart: rd.leaseStart,
                                            leaseEnd: rd.leaseEnd,
                                        }]}
                                        contacts={matterState.contacts || []}
                                    />
                                );
                            })()}
                        </div>
                    </div>
                )}

                {activeTab === 'units' && (
                    <UnitsConsole
                        property={property}
                        owner={owner}
                        allUnits={allUnits}
                        archivedUnits={archivedUnits}
                        tenancyUnits={tenancyUnits}
                        tenancyStatus={tenancyStatus}
                        ticketsByUnit={ticketsByUnit}
                        contacts={matterState.contacts || []}
                        firmId={coreState.firmDetails?.id || currentUser?.firmId || property.firmId || ''}
                        highlightTarget={highlightTarget}
                        selectedUnit={selectedUnit}
                        onSelectUnit={setSelectedUnit}
                        onCollectRent={(unit, d) => openModal('collectRent', property.id, { unitName: d.name, tenantName: d.tenantName, rentAmount: d.rentAmount, unitId: unit.id })}
                        onCompose={(unit, d) => {
                            const tenantPhone = (unit as any).rentalDetails?.tenantPhone || (unit as any).tenantPhone || '';
                            const tenantEmail = (unit as any).rentalDetails?.tenantEmail || (unit as any).tenantEmail || '';
                            setComposePrefill({
                                unitId: unit.id,
                                unitName: d.name,
                                tenantName: d.tenantName || 'Resident',
                                tenantPhone: tenantPhone || undefined,
                                tenantEmail: tenantEmail || undefined,
                                rentAmount: d.rentAmount || undefined,
                                propertyAddress: property.address,
                            });
                        }}
                        onEditUnit={(unit) => openModal('editProperty', ((property as any)?.units || []).some((lu: any) => lu.id === unit.id) ? property.id : unit.id, { contactId: owner?.id, activeUnitId: unit.id, autoExpandRental: true })}
                        onDraftAction={handleDraftAction}
                        onQuitNoticeDrafted={handleQuitNoticeDrafted}
                        onMarkQuitNoticeServed={handleMarkQuitNoticeServed}
                        onDraftSevenDayNotice={handleDraftSevenDayNotice}
                        onInitializeMatter={handleInitializeMatter}
                        onUpdateEvictionTracker={updateEvictionTracker}
                        canUseEviction={isGrowthOrAbove || isKompleteFirm}
                    />
                )}

                {/* ═══ NOTICE BOARD TAB ═══ */}
                {activeTab === 'notices' && (
                    <PropertyNoticeBoard propertyId={property.id} firmId={coreState.firmDetails?.id || currentUser?.firmId || ''} authorId={currentUser?.id || ''} authorName={currentUser?.name || ''} />
                )}

                {activeTab === 'financials' && (() => {
                    const units = [...(allUnits || [])]
                        .map(u => u && u.id ? u : null)
                        .filter((u): u is Property => u !== null);
                    const legacyUnits = ((property as any)?.units || [])
                        .map((u: any, idx: number) => ({ ...u, id: u.id || `temp-unit-${idx}` }))
                        .filter((u: any) => u);
                    legacyUnits.forEach((lu: any) => {
                        if (!units.some(u => u.id === lu.id || (u as any).name === lu.name)) {
                            units.push(lu);
                        }
                    });

                    return (
                    <div className="space-y-6 animate-fade-in">
                        {/* Revenue Summary Cards — fluid flex-grid for dark-mode containment */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            {(() => {
                                // Dev-mode histogram of which resolution level each unit's SC came from.
                                const scSourceCounts = new Map<string, number>();
                                const allRent = units.reduce((sum: number, u: Property) => {
                                    const rd = u.rentalDetails || {};
                                    const rent = Number((rd as any).rentAmount || 0);
                                    return sum + rent;
                                }, 0);
                                const allServiceCharge = units.reduce((sum: number, u: Property) => {
                                    const sc = resolveServiceCharge({ unit: u, rental: (u as any).rentalDetails, defaultProperty: property });
                                    scSourceCounts.set(sc.source, (scSourceCounts.get(sc.source) || 0) + 1);
                                    return sum + sc.amount;
                                }, 0);
                                // Minimum Vend aggregator — sums MV across all units
                                const allMinVend = property.minimumVendEnabled
                                    ? units.reduce((sum: number) => sum + Number(property.minimumVendAmount || 0), 0)
                                    : 0;
                                const paidCount = units.filter(u => {
                                    const rd = u.rentalDetails || {};
                                    const st = (rd as any).serviceChargeStatus || (u as any).serviceChargeStatus;
                                    return st === 'PAID_FULLY' || st === 'PAID' || st === 'paid';
                                }).length;
                                const partialCount = units.filter(u => {
                                    const rd = u.rentalDetails || {};
                                    const st = (rd as any).serviceChargeStatus || (u as any).serviceChargeStatus;
                                    return st === 'PARTIALLY_PAID';
                                }).length;
                                const unpaidCount = units.filter(u => {
                                    const rd = u.rentalDetails || {};
                                    const st = (rd as any).serviceChargeStatus || (u as any).serviceChargeStatus;
                                    return st === 'UNPAID' || st === 'unpaid';
                                }).length;
                                const totalAnnual = allRent + allServiceCharge;
                                // SPEC COMPLIANCE — Financials refactor spec:
                                //  • Card titles use the exact spec labels:
                                //      TOTAL ANNUAL RENT, RECURRING REVENUE,
                                //      SERVICE CHARGES, COLLECTION STATUS
                                //    (Previously: "SERVICE CHARGE COLLECTED" — too long,
                                //     caused truncation. Now matches spec.)
                                //  • Monetary values use COMPACT display (₦17.4M) so
                                //    they never overflow the card width.
                                //  • Full-figure tooltip (₦17,400,000.00) shows on hover/tap
                                //    via <Tooltip> wrapping the value.
                                //  • COLLECTION STATUS uses scrollOnOverflow so the long
                                //    status string auto-marquees when it doesn't fit.
                                //    The card-level `title` attribute also carries the full
                                //    text as a fallback for non-marquee users.
                                const collectionStatusText = `${paidCount} Paid / ${partialCount} Partial / ${unpaidCount} Outstanding`;
                                // Dev-mode only: where each unit's service charge came from,
                                // appended to the SERVICE CHARGES card tooltip.
                                const scSourcesDebug = import.meta.env.DEV
                                    ? `\n${[...scSourceCounts.entries()].map(([s, n]) => `${n}×${s}`).join(', ')}`
                                    : '';
                                return (
                                    <>
                                        {/* TOTAL ANNUAL RENT + RECURRING REVENUE — hidden for
                                            Management Only properties (no rent collection). */}
                                        {property.rentCollectionMode !== 'Management Only (No Rent)' && (
                                            <>
                                                <StatCard
                                                    title="TOTAL ANNUAL RENT"
                                                    value={formatNairaCompact(totalAnnual)}
                                                    tooltipText={formatNairaFull(totalAnnual)}
                                                    icon={<Receipt />}
                                                    colorClass="bg-emerald-600"
                                                />
                                                <StatCard
                                                    title="RECURRING REVENUE"
                                                    value={formatNairaCompact(allRent)}
                                                    tooltipText={formatNairaFull(allRent)}
                                                    icon={<Receipt />}
                                                    colorClass="bg-blue-600"
                                                />
                                            </>
                                        )}
                                        <StatCard
                                            title="SERVICE CHARGES"
                                            value={formatNairaCompact(allServiceCharge)}
                                            tooltipText={`${formatNairaFull(allServiceCharge)}${scSourcesDebug}`}
                                            icon={<Receipt />}
                                            colorClass="bg-amber-600"
                                        />
                                        {/* MINIMUM VEND — shown when property has MV enabled.
                                            Mirrors the Service Charge card but for Minimum Vend / estate fees. */}
                                        {property.minimumVendEnabled && (
                                            <StatCard
                                                title="MINIMUM VEND"
                                                value={formatNairaCompact(allMinVend)}
                                                tooltipText={formatNairaFull(allMinVend)}
                                                icon={<Wallet />}
                                                colorClass="bg-teal-600"
                                            />
                                        )}
                                        {/* COLLECTION STATUS — hidden when property is
                                            Management Only (no rent collection tracking). */}
                                        {property.rentCollectionMode !== 'Management Only (No Rent)' && (
                                            <StatCard
                                                title="COLLECTION STATUS"
                                                value={collectionStatusText}
                                                tooltipText={collectionStatusText}
                                                scrollOnOverflow={true}
                                                icon={<CheckCircleIcon />}
                                                colorClass={unpaidCount > 0 ? 'bg-orange-600' : partialCount > 0 ? 'bg-amber-600' : 'bg-green-600'}
                                            />
                                        )}
                                    </>
                                );
                            })()}
                        </div>

                        {/* Revenue Breakdown by Unit */}
                        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-slate-200 dark:border-zinc-700 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-700 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Revenue Breakdown by Unit</h3>
                                <button onClick={() => navigateTo('billing', null, { billingTab: 'revenue' })} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                    Full Service Charges <span>&rarr;</span>
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <Table density="compact">
                                    <TableHeader>
                                        <tr>
                                            <TableHead>Unit</TableHead>
                                            <TableHead>Resident</TableHead>
                                            {/* RENT column — hidden for Management Only properties */}
                                            {property.rentCollectionMode !== 'Management Only (No Rent)' && (
                                                <TableHead align="right">Rent</TableHead>
                                            )}
                                            <TableHead align="right">Service Charge</TableHead>
                                            {/* MINIMUM VEND column — shown when property has MV enabled */}
                                            {property.minimumVendEnabled && (
                                                <TableHead align="right">Min Vend</TableHead>
                                            )}
                                            <TableHead align="center">SC Status</TableHead>
                                            <TableHead align="right">Outstanding</TableHead>
                                        </tr>
                                    </TableHeader>
                                    <TableBody>
                                        {units.map((unit: Property) => {
                                            const d = getUnitDisplay(unit);
                                            const rd = (unit.rentalDetails || {}) as any;
                                            // Unified resolution — identical chain to the units grid and
                                            // the revenue summary above, so all three agree per unit.
                                            const scResolution = resolveServiceCharge({ unit, rental: rd, defaultProperty: property });
                                            const scAmount = scResolution.amount;
                                            const scStatus = d.serviceChargeStatus || rd.serviceChargeStatus || '';
                                            const outstanding = d.outstandingServiceChargeBalance || rd.outstandingServiceChargeBalance || 0;
                                            const mvAmount = property.minimumVendEnabled ? Number(property.minimumVendAmount || 0) : 0;
                                            const isPaidFully = scStatus === 'PAID_FULLY' || scStatus === 'PAID' || scStatus === 'paid';
                                            const isPartial = scStatus === 'PARTIALLY_PAID';
                                            const isOutstanding = scStatus === 'UNPAID' || scStatus === 'unpaid';
                                            // HIGHLIGHT — if this row is the target of a notification
                                            // deep-link (highlightTarget matches unit.id, or is 'overdue'
                                            // and this row has an unpaid/partial status), apply a
                                            // temporary amber pulse ring for 5 seconds.
                                            const isHighlighted = highlightTarget && (
                                                highlightTarget === unit.id ||
                                                highlightTarget === String(unit.id) ||
                                                (highlightTarget === 'overdue' && (isOutstanding || isPartial))
                                            );
                                            return (
                                                <tr
                                                    key={unit.id}
                                                    data-entry-id={unit.id}
                                                    className={`hover:bg-slate-50 dark:hover:bg-zinc-700/30 transition-all ${isHighlighted ? 'ring-2 ring-amber-500/50 animate-pulse bg-amber-50 dark:bg-amber-900/20' : ''}`}
                                                >
                                                    <TableCell className="font-semibold text-slate-800 dark:text-white">{d.name}</TableCell>
                                                    <TableCell className="text-slate-600 dark:text-zinc-300">{d.tenantName || '—'}</TableCell>
                                                    {/* RENT cell — hidden for Management Only */}
                                                    {property.rentCollectionMode !== 'Management Only (No Rent)' && (
                                                        <TableCell align="right" className="font-semibold text-slate-800 dark:text-white">₦{d.rentAmount.toLocaleString()}</TableCell>
                                                    )}
                                                    <TableCell align="right" className="font-semibold text-slate-800 dark:text-white" data-sc-source={import.meta.env.DEV ? scResolution.source : undefined} title={serviceChargeDebugTitle(scResolution.source)}>{scAmount > 0 ? `₦${scAmount.toLocaleString()}` : '—'}</TableCell>
                                                    {/* MINIMUM VEND cell — shown when MV enabled */}
                                                    {property.minimumVendEnabled && (
                                                        <TableCell align="right" className="font-semibold text-slate-800 dark:text-white">{mvAmount > 0 ? `₦${mvAmount.toLocaleString()}` : '—'}</TableCell>
                                                    )}
                                                    <TableCell align="center">
                                                        {isPaidFully && <span className="inline-flex items-center gap-0.5 text-3xs font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircleIcon className="w-3 h-3" /> Paid</span>}
                                                        {isPartial && <span className="inline-flex items-center gap-0.5 text-3xs font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Partial</span>}
                                                        {isOutstanding && <span className="inline-flex items-center gap-0.5 text-3xs font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Outstanding</span>}
                                                        {!isPaidFully && !isPartial && !isOutstanding && <span className="text-2xs text-slate-400">—</span>}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {isPartial && outstanding > 0 ? <span className="text-xs font-bold text-red-600 dark:text-red-400">₦{outstanding.toLocaleString()}</span> : <span className="text-2xs text-slate-400">—</span>}
                                                    </TableCell>
                                                </tr>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Link to Full Revenue Monitor — compact */}
                        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-lg px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-sm font-bold text-slate-700 dark:text-zinc-200">Firm-wide Revenue Monitor</span>
                            </div>
                            <button onClick={() => navigateTo('billing', null, { billingTab: 'revenue' })} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors">
                                Open &rarr;
                            </button>
                        </div>
                    </div>
                    );
                })()}

                {/* ─── FINANCIALS TAB: merged Revenue + Docs & Financials ───
                    CRO AUDIT FIX — consolidated the old 'revenue' and 'docs'
                    tabs into a single 'financials' tab. This is the "One True
                    Source" for all financial data related to this property:
                      1. Top: Revenue Summary stat cards
                      2. Middle: Unit Revenue & Collection Status table
                      3. Bottom: Financial Overview (invoices, ledger, documents)
                    The user said: "DO NOT CONSOLIDATE UNRELATED THINGS" — these
                    are all financial, so the consolidation is appropriate. */}

                {/* TASK 52 — property use-relationship ontology: tenancies,
                    subleases, licenses, easements, mortgages, customary
                    interests, co-ownership, assignments (Governor's consent
                    tracking) + firm-defined custom types. Keys on the root
                    property's Convex _id (resolved server-side; the tab
                    accepts either id form). */}
                {activeTab === 'relationships' && (
                    <PropertyRelationshipsTab
                        propertyConvexId={String((property as any)?._id ?? property?.id ?? propertyId ?? '')}
                        units={(allUnits || []) as any}
                    />
                )}

                {activeTab === 'tracking' && (
                    <PropertyTrackingView 
                        property={property} 
                        onUpdate={(updated) =>
                            updateItem(
                                'properties',
                                { ...updated, _id: (updated as any)._id ?? (property as any)._id, id: updated.id ?? property.id },
                                'Property Updated'
                            )
                        } 
                    />
                )}

                {/* CRO AUDIT FIX — the old 'docs' tab content is now rendered
                    inside the 'financials' tab (below the revenue section).
                    We use a separate conditional that checks if financials tab
                    is active AND we're in the second render pass. Since the
                    financials IIFE above already closed, we render the docs
                    content as a sibling that also checks activeTab === 'financials'. */}
                {activeTab === 'financials' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Financial Overview Section */}
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Financial Overview</h3>
                            <div className="flex items-center gap-3">
                                {primaryMatter && (
                                    <button
                                        onClick={() => openModal('newInvoice', null, { matterId: primaryMatter.id, clientId: owner?.id })}
                                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-lg flex items-center gap-2"
                                    >
                                        <PlusIcon className="w-4 h-4" /> Create Invoice
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                            <StatCard
                                title={isSale ? "Target Sale Value" : "Collected YTD"}
                                value={<><NairaSymbol />{formatNaira(isSale ? (property.saleDetails?.targetPrice || property.value || 0) : (activePropertyLedgerEntries.filter(r => r && r.status === 'cleared').reduce((sum, r) => sum + (r.amount || 0), 0) || 0))}</>}
                                icon={<Receipt />}
                                colorClass="bg-green-600"
                            />
                            {property.ownershipType !== 'owned' && !isSale && (
                                <StatCard
                                    title="Management Fees Earned"
                                    value={<><NairaSymbol />{formatNaira((activePropertyLedgerEntries.filter(r => r && r.status === 'cleared').reduce((sum, r) => sum + (r.amount || 0), 0) || 0) * (property.managementFeePercentage || 0) / 100)}</>}
                                    icon={<Receipt />}
                                    colorClass="bg-blue-600"
                                />
                            )}
                            <StatCard
                                title={isSale ? "Offers Received" : "Pending Invoices"}
                                value={isSale ? (property.trackingTimeline?.filter(t => t.type === 'offer').length.toString() || '0') : propertyInvoices.filter(i => i && i.status !== InvoiceStatus.Paid).length.toString()}
                                icon={isSale ? <CurrencyDollarIcon /> : <DocumentIcon />}
                                colorClass="bg-orange-600"
                            />
                        </div>

                        {/* ROUND E (WAVE E3) — the server-computed ledger-truth
                            rollup (per-property financial summary). The
                            StatCards above read the denormalized
                            rentalDetails snapshot; this panel aggregates
                            ledger entries, service charges (shape-proof
                            across all four unit-id shapes), receipts and
                            the E1 tenancy ledger. */}
                        <PropertyFinancialSummaryPanel propertyId={property.id} />

                        {/* Mini Ledger + Invoices */}
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-5 shadow-sm">
                            <div className="flex items-start gap-4">
                                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg flex-shrink-0">
                                    <Receipt className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-slate-900 dark:text-white mb-1">Financial Reconciliation</h4>
                                    <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-3">
                                        All invoices and receipts are synchronized with the{' '}
                                        <button onClick={() => navigateTo('billing', null, { billingTab: 'payments' })} className="font-bold text-emerald-600 hover:underline">Payments & Receipts</button>.
                                    </p>

                                    {propertyLedgerEntries.length > 0 && (
                                        <div className="bg-white/60 dark:bg-black/20 rounded-lg border border-emerald-200 dark:border-emerald-900/50 overflow-hidden">
                                            <div className="px-4 py-2 bg-emerald-100/50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-900/50 flex justify-between items-center">
                                                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Recent Ledger</span>
                                                <button onClick={() => navigateTo('billing', null, { billingTab: 'payments' })} className="text-2xs font-bold text-emerald-600 hover:text-emerald-700">View All &rarr;</button>
                                            </div>
                                            <div className="divide-y divide-emerald-100 dark:divide-emerald-900/30">
                                                {propertyLedgerEntries.map(entry => (
                                                    <div key={entry._id} className="px-4 py-2.5 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${entry.status === 'cleared' ? 'bg-emerald-500' : entry.status === 'defaulted' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                                                            <div>
                                                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{entry.description || entry.type}</p>
                                                                <p className="text-3xs text-slate-500">{new Date(entry.timestamp).toLocaleDateString("en-GB")}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className={`text-sm font-bold ${entry.status === 'cleared' ? 'text-emerald-600 dark:text-emerald-400' : entry.status === 'defaulted' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                                ₦{entry.amount.toLocaleString('en-NG')}
                                                            </p>
                                                            <p className="text-3xs uppercase font-bold text-slate-400">{entry.status}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Invoices */}
                        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden">
                            <div className="p-4 border-b border-slate-200 dark:border-zinc-700">
                                <h4 className="font-bold text-sm text-slate-800 dark:text-white">Related Invoices</h4>
                            </div>
                            {propertyInvoices.length === 0 ? (
                                <div className="p-8 text-center text-slate-400">
                                    <DocumentIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No invoices linked to this property.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table density="compact">
                                        <TableHeader>
                                            <tr>
                                                <TableHead>Invoice #</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Amount</TableHead>
                                            </tr>
                                        </TableHeader>
                                        <TableBody>
                                            {propertyInvoices.map(inv => (
                                                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer" onClick={() => navigateTo('invoiceDetail', inv.id)}>
                                                    <TableCell className="font-mono font-medium text-primary-600">{inv.invoiceNumber}</TableCell>
                                                    <TableCell className="text-slate-600 dark:text-zinc-300">{inv.issueDate}</TableCell>
                                                    <TableCell>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${inv.status === InvoiceStatus.Paid ? 'bg-green-100 text-green-700' : inv.status === InvoiceStatus.Overdue ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                                            {inv.status}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="font-bold text-slate-900 dark:text-white"><NairaSymbol />{formatNaira(inv.total_amount || inv.subTotal)}</TableCell>
                                                </tr>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </div>

                        {/* Documents Section */}
                        <div className="border-t border-slate-200 dark:border-zinc-700 pt-6">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4">Documents</h3>
                            {isProperty ? (
                                <DocumentsTab
                                    documents={propertyDocuments}
                                    matterId={`prop_${property.id}`}
                                    uploadContext={{ propertyId: property.id }}
                                    openModal={openModal}
                                    onViewDocumentDetails={(id) => navigateTo('documentDetail', id)}
                                    users={coreState.users}
                                    variant="embedded"
                                />
                            ) : linkedMatters.length > 0 ? (
                                <DocumentsTab
                                    documents={propertyDocuments}
                                    matterId={primaryMatter.id}
                                    openModal={openModal}
                                    onViewDocumentDetails={(id) => navigateTo('documentDetail', id)}
                                    users={coreState.users}
                                    variant="embedded"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 bg-white dark:bg-zinc-800 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700">
                                    <div className="p-3 bg-slate-100 dark:bg-zinc-900 rounded-full mb-3">
                                        <MattersIcon className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">No Linked Matter</h3>
                                    <p className="text-slate-500 text-xs max-w-sm text-center mb-4">
                                        Initialize a matter to manage legal documents for this property.
                                    </p>
                                    <button
                                        onClick={() => handleInitializeMatter()}
                                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold text-sm transition-all flex items-center gap-2"
                                    >
                                        <PlusIcon className="w-4 h-4" /> Initialize Matter
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                </div>
            </div>

            {/* MESSAGES OVERHAUL: the ONE unified composer — same modal as
                Messages → New Message. Templates, resident financials
                auto-fill, per-recipient delivery results with retry. */}
            {composePrefill && (
                <ComposeModal
                    firmId={coreState.firmDetails?.id || currentUser?.firmId || ''}
                    prefill={composePrefill}
                    onClose={() => setComposePrefill(undefined)}
                    onToast={(msg) => addToast(msg, { type: /error|failed/i.test(msg) ? 'error' : 'success' })}
                />
            )}
        </div>
    );
};

const ActionButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
    <button
        onClick={onClick}
        className="w-full text-left px-3 py-2 bg-slate-50 dark:bg-zinc-700/50 rounded-lg border border-slate-100 dark:border-zinc-600 hover:border-primary-400 dark:hover:border-primary-500 transition-all text-xs font-bold text-slate-700 dark:text-slate-200 flex justify-between items-center group hover:bg-white dark:hover:bg-zinc-700 hover:text-primary-600"
    >
        {label}
        <span className="text-primary-500 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">&rarr;</span>
    </button>
);

// ══════════════════════════════════════════════════════════════════════════
// PropertyNoticeBoard — Notice board tab for property managers to post
// notices visible to tenants on their portal. Each property has its own
// notice board, scoped to that property and its units.
// ══════════════════════════════════════════════════════════════════════════
const PropertyNoticeBoard: React.FC<{
    propertyId: string;
    firmId: string;
    authorId: string;
    authorName: string;
}> = ({ propertyId, firmId, authorId, authorName }) => {
    const { addToast } = useUI();
    // ROUND A2: getAllNotices/archiveNotice/restoreNotice require the staff
    // session server-side.
    const { bearerToken } = useAuth();
    const [showForm, setShowForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newBody, setNewBody] = useState('');
    const [newPriority, setNewPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
    const [newPinned, setNewPinned] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Fetch notices scoped to this property
    const notices = useQuery(
        api.portals.getAllNotices,
        firmId ? { firmId, propertyId, sessionToken: bearerToken ?? undefined } : 'skip'
    );

    const createNotice = useMutation(api.portals.createNotice);
    const archiveNotice = useMutation(api.portals.archiveNotice);
    const restoreNotice = useMutation(api.portals.restoreNotice);

    const activeNotices = useMemo(() => (notices || []).filter((n: any) => n.status === 'active'), [notices]);
    const archivedNotices = useMemo(() => (notices || []).filter((n: any) => n.status === 'archived'), [notices]);

    const handleCreate = async () => {
        if (!newTitle.trim() || !newBody.trim()) {
            addToast('Please enter a title and message for the notice.', { type: 'error' });
            return;
        }
        setIsCreating(true);
        try {
            // TASK 20: Add a 15-second timeout so the form doesn't spin forever
            // if the mutation hangs. The notice IS created server-side even if
            // the client times out — the user will see it on refresh.
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Request timed out. Your notice may still have been posted — refresh to check.')), 15000)
            );
            await Promise.race([
                createNotice({
                    firmId,
                    authorId,
                    authorName,
                    title: newTitle.trim(),
                    body: newBody.trim(),
                    priority: newPriority,
                    isPinned: newPinned,
                    propertyId,
                }),
                timeoutPromise,
            ]);
            setNewTitle('');
            setNewBody('');
            setNewPriority('normal');
            setNewPinned(false);
            setShowForm(false);
            addToast('Notice posted! It will appear on your residents\' portal immediately.', { type: 'success' });
        } catch (err: any) {
            addToast(err.message || 'Failed to create notice.', { type: 'error' });
            // TASK 20: Close the form even on error so the user isn't stuck.
            // The notice may have been created server-side — the query will
            // refetch and show it if so.
            setShowForm(false);
        } finally {
            setIsCreating(false);
        }
    };

    const priorityConfig: Record<string, { bg: string; text: string; label: string; dot: string; border: string }> = {
        urgent: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-300', label: 'Urgent Rent/Payment Notice', dot: 'bg-rose-500', border: 'border-rose-200 dark:border-rose-800/50' },
        important: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', label: 'Maintenance Notice', dot: 'bg-amber-500', border: 'border-amber-200 dark:border-amber-800/50' },
        normal: { bg: 'bg-slate-50 dark:bg-zinc-800', text: 'text-slate-600 dark:text-zinc-400', label: 'General Announcement', dot: 'bg-slate-400', border: 'border-slate-200 dark:border-zinc-700' },
    };

    const isLoading = notices === undefined;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Notice Board</h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">Post updates visible to all residents on their portal</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Post Notice
                </button>
            </div>

            {/* Create Form */}
            {showForm && (
                <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-5 space-y-4">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">New Notice</h4>
                    <div className="space-y-3">
                        <input
                            type="text"
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            placeholder="Notice title (e.g., Water maintenance scheduled)"
                            className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-600 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                        />
                        <textarea
                            value={newBody}
                            onChange={e => setNewBody(e.target.value)}
                            placeholder="Notice details... This will be visible to all residents on their portal."
                            rows={4}
                            className="w-full px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-600 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 resize-none"
                        />
                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-slate-600 dark:text-zinc-400">Priority:</label>
                                {(['normal', 'important', 'urgent'] as const).map(p => {
                                    const cfg = priorityConfig[p];
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setNewPriority(p)}
                                            className={`px-2.5 py-1 rounded-lg text-2xs font-bold transition-all ${
                                                newPriority === p
                                                    ? `${cfg.bg} ${cfg.text} ring-2 ring-offset-1 ring-current`
                                                    : 'bg-slate-100 dark:bg-zinc-700 text-slate-400 dark:text-zinc-500 hover:bg-slate-200 dark:hover:bg-zinc-600'
                                            }`}
                                        >
                                            {cfg.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <label className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={newPinned}
                                    onChange={e => setNewPinned(e.target.checked)}
                                    className="rounded border-slate-300 dark:border-zinc-600 text-amber-500 focus:ring-amber-500/30"
                                />
                                <span className="text-xs font-medium text-slate-600 dark:text-zinc-400">Pin to top</span>
                            </label>
                        </div>
                        <div className="flex items-center gap-2 justify-end pt-1">
                            <button
                                onClick={() => setShowForm(false)}
                                className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={isCreating || !newTitle.trim() || !newBody.trim()}
                                className="px-4 py-2 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                            >
                                {isCreating ? (
                                    <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Posting...</>
                                ) : (
                                    <><Megaphone className="w-3.5 h-3.5" /> Post Notice</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Active Notices */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-5">
                            <Skeleton variant="text" className="h-4 w-3/4 mb-3" />
                            <Skeleton variant="text" className="h-3 w-full mb-2" />
                            <Skeleton variant="text" className="h-3 w-2/3" />
                        </div>
                    ))}
                </div>
            ) : activeNotices.length > 0 ? (
                <div className="space-y-3">
                    <p className="text-2xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">Active Notices ({activeNotices.length})</p>
                    {activeNotices.map((notice: any) => {
                        const pri = priorityConfig[notice.priority] || priorityConfig.normal;
                        return (
                            <div
                                key={notice._id}
                                className={`bg-white dark:bg-zinc-800 rounded-lg border overflow-hidden transition-colors ${pri.border}`}
                            >
                                {notice.isPinned && (
                                    <div className="px-5 pt-3 flex items-center gap-1.5">
                                        <svg className="w-3 h-3 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                                        </svg>
                                        <span className="text-2xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pinned</span>
                                    </div>
                                )}
                                <div className="px-5 py-4">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-snug">{notice.title}</h4>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold ${pri.bg} ${pri.text}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${pri.dot}`} />
                                                {pri.label}
                                            </span>
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await archiveNotice({ noticeId: notice._id, sessionToken: bearerToken ?? undefined });
                                                        addToast('Notice archived.', { type: 'success' });
                                                    } catch (err: any) {
                                                        addToast(err.message || 'Failed to archive.', { type: 'error' });
                                                    }
                                                }}
                                                className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                                                title="Archive notice"
                                            >
                                                <TrashIcon className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">{notice.body}</p>
                                    <div className="mt-3 flex items-center gap-3 text-2xs text-slate-400 dark:text-zinc-500">
                                        {notice.authorName && <span>Posted by {notice.authorName}</span>}
                                        <span>{new Date(notice.createdAt).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                        {notice.expiresAt && (
                                            <span className={notice.expiresAt < Date.now() ? 'text-rose-500 font-medium' : ''}>
                                                {notice.expiresAt < Date.now() ? 'Expired' : `Expires ${new Date(notice.expiresAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}`}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                        <Megaphone className="w-7 h-7 text-slate-400 dark:text-zinc-500" />
                    </div>
                    <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400 mb-1">No Announcements Posted</p>
                    <p className="text-xs text-slate-400 dark:text-zinc-500 max-w-sm">Broadcast notices, maintenance schedules, or building updates directly to all residents in this property.</p>
                    <button
                        onClick={() => setShowForm(true)}
                        className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                        Post New Notice
                    </button>
                </div>
            )}

            {/* Archived Notices */}
            {archivedNotices.length > 0 && (
                <details className="group">
                    <summary className="text-2xs font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 cursor-pointer hover:text-slate-600 dark:hover:text-zinc-300 transition-colors">
                        Archived ({archivedNotices.length})
                    </summary>
                    <div className="mt-2 space-y-2">
                        {archivedNotices.map((notice: any) => (
                            <div key={notice._id} className="flex items-center justify-between gap-3 p-3 bg-slate-50/50 dark:bg-zinc-800/50 rounded-lg opacity-60">
                                <div className="min-w-0 flex-1">
                                    <span className="text-xs text-slate-500 dark:text-zinc-400 truncate">{notice.title}</span>
                                    <span className="text-2xs text-slate-400 dark:text-zinc-500 ml-2">
                                        {new Date(notice.createdAt).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                                <button
                                    onClick={async () => {
                                        try {
                                            await restoreNotice({ noticeId: notice._id, sessionToken: bearerToken ?? undefined });
                                            addToast('Notice restored.', { type: 'success' });
                                        } catch (err: any) {
                                            addToast(err.message || 'Failed to restore.', { type: 'error' });
                                        }
                                    }}
                                    className="text-2xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                                >
                                    Restore
                                </button>
                            </div>
                        ))}
                    </div>
                </details>
            )}
        </div>
    );
};


export default function PropertyDetailViewWrapper() {
    return (
        <ErrorBoundary>
            <PropertyDetailViewContent />
        </ErrorBoundary>
    );
}
