
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Property, Contact, ModalType, MatterStatus, InvoiceStatus, BillingModel } from '../../types';
import { OfficeBuildingIcon, EditIcon, DocumentIcon, CalendarIcon, CheckCircleIcon, PlusIcon, MinusIcon, GavelIconLarge, CalculatorIcon, ZapIcon, LockClosedIcon, SearchIcon, CurrencyDollarIcon, MattersIcon, CogIcon, XIcon, TrashIcon } from '../../constants';
import { formatNaira, formatNairaCompact, formatNairaFull, normalizeAddress } from '../../utils/formatting';
import NairaSymbol from '../NairaSymbol';
import { ClipboardList, Home, Folder, Megaphone, FileText, Wrench, Scale, Eye, Radio, Receipt, Wallet, LogOut, Plus, Trash2, MessageSquare, Mail, Phone, FileDown } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import { useAloa } from '../../contexts/AloaProvider';
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ComposeModal, ComposeModalPrefill } from '../atrium/ComposeModal';
import { useFeatures } from '../../hooks/useFeatures';
import { DocumentsTab } from './DocumentsTab';
import { useMatterState } from '../../contexts/MatterContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import StatCard from '../StatCard';
import Tooltip from '../Tooltip';
import PropertyTrackingView from './PropertyTrackingView';
import { useAuth } from '../../contexts/AuthContext';
import { useProduct } from '../../contexts/ProductContext';
import ErrorBoundary from '../ErrorBoundary';

import { getUnitDisplay } from '../../utils/propertyPayload';
import { draftSessionKey, loadDraftSession } from '../../utils/draftSession';
const DetailItem: React.FC<{ label: string; value: React.ReactNode; subText?: string }> = ({ label, value, subText }) => (
    <div className="w-full min-w-0 overflow-x-hidden" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
        <p className="text-3xs sm:text-2xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">{label}</p>
        <div className="text-sm font-semibold text-slate-900 dark:text-white leading-snug break-words">
            {value}
        </div>
        {subText && <p className="text-2xs sm:text-xs text-slate-500 mt-0.5 leading-tight break-words">{subText}</p>}
    </div>
);

type PropertyTab = 'summary' | 'units' | 'notices' | 'financials' | 'tracking';

// ─── Eviction Tracker Types & Helpers ───
interface EvictionTracker {
    // STATUTORY EVICTION STATE MACHINE (Nigerian Tenancy Law compliant)
    // Streamlined: "Mark as Delivered" removed — "Served" is the sole
    // statutory milestone. Countdown activates on serve.
    //   none → drafted → served → (countdown expires) → sevenDayDue
    //   superseded: when a fresh notice is generated while a served notice
    //   is active, the old notice transitions to 'superseded' and the
    //   countdown resets.
    quitNoticeStatus: 'none' | 'drafted' | 'served' | 'superseded';
    quitNoticeDraftedDate?: number;
    quitNoticeServedDate?: number;
    quitNoticeSupersededDate?: number;
    quitNoticeDocumentId?: string;
    quitNoticeServiceMethod?: string; // 'personal' | 'substituted' | 'registered_post'
    // Countdown — calculated when notice is marked served
    quitNoticeCountdownEndDate?: number; // when the statutory period expires
    sevenDayNoticeStatus: 'none' | 'due' | 'drafted' | 'served' | 'delivered';
    sevenDayNoticeDueDate?: number;
    sevenDayNoticeDraftedDate?: number;
    sevenDayNoticeDocumentId?: string;
    // Audit trail — immutable event log stored on the tracker
    eventLog?: EvictionEvent[];
}

interface EvictionEvent {
    type: 'drafted' | 'served' | 'superseded' | 'seven_day_issued' | 'seven_day_served' | 'retracted';
    timestamp: number;
    documentId?: string;
    notes?: string;
    actorId?: string;
}

/** Calculate statutory notice period in months based on tenancy frequency */
const getNoticePeriodMonths = (frequency?: string): number => {
    const f = (frequency || '').toLowerCase();
    if (f.includes('year')) return 6;
    if (f.includes('6-month')) return 3;
    if (f.includes('quarter')) return 1;
    if (f.includes('month')) return 1;
    return 6; // Default to 6 months for yearly tenancy (most common in Nigeria)
};

/** Get eviction tracker from a unit's rentalDetails */
const getEvictionTracker = (unit: any): EvictionTracker => {
    const rd = unit?.rentalDetails || unit;
    return rd?.evictionTracker || { quitNoticeStatus: 'none', sevenDayNoticeStatus: 'none' };
};

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
    const { updateItem, onAddMatter, handleDeleteProperty, addUnit, removeUnit } = useDataActions() as any;
    const { currentUser } = useAuth();
    const convex = useConvex();
    const { isGrowthOrAbove, isKompleteFirm } = useFeatures();
    const { openWithContext } = useAloa();
    const [activeTab, setActiveTab] = useState<PropertyTab>('summary');
    const [openUnitMenuId, setOpenUnitMenuId] = useState<string | null>(null);
    const [openUnitMenuPos, setOpenUnitMenuPos] = useState<{ top: number; right: number } | null>(null);
    const unitMenuRef = useRef<HTMLDivElement>(null);
    const [selectedUnit, setSelectedUnit] = useState<Property | null>(null);

    const [showAddUnitForm, setShowAddUnitForm] = useState(false);
    const [newUnitName, setNewUnitName] = useState('');
    const [newUnitType, setNewUnitType] = useState<'Residential' | 'Commercial'>('Residential');
    const [showUnitMessaging, setShowUnitMessaging] = useState(false);
    const [showCompose, setShowCompose] = useState(false);
    const [composePrefill, setComposePrefill] = useState<ComposeModalPrefill | undefined>(undefined);
    const [showFullUnitDetail, setShowFullUnitDetail] = useState(false);
    const unitMenuInnerRef = useRef<HTMLDivElement>(null);

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
    useEffect(() => {
        const ctx = currentHistoryEntry?.context as any;
        if (ctx?.tab) {
            const tab = ctx.tab as PropertyTab;
            if (['summary', 'units', 'notices', 'financials', 'tracking'].includes(tab)) {
                setActiveTab(tab);
            }
        }
        // Read targetUnit — handle empty string (from deep-link when
        // ledger entry has no unitId). Empty string is falsy, so we
        // check for undefined/null instead.
        if (ctx?.targetUnit != null) {
            setTargetUnitId(ctx.targetUnit || null);
        }
        if (ctx?.highlight) {
            setHighlightTarget(ctx.highlight);
            // Extended to 15 seconds — allUnits might take time to load
            // from Convex, and the highlight should persist until the
            // target unit is found and expanded.
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

    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (unitMenuRef.current && !unitMenuRef.current.contains(e.target as Node)) {
                setOpenUnitMenuId(null);
                setOpenUnitMenuPos(null);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    // Smart menu repositioning — measure actual rendered menu height and flip if overflowing
    useEffect(() => {
        if (!openUnitMenuId || !openUnitMenuPos || !unitMenuInnerRef.current) return;
        const menuEl = unitMenuInnerRef.current;
        const menuHeight = menuEl.offsetHeight;
        const menuWidth = menuEl.offsetWidth;
        const pos = openUnitMenuPos;

        // Check if menu overflows bottom of viewport
        const menuBottom = pos.top + menuHeight;
        if (menuBottom > window.innerHeight - 8) {
            // Flip upward: position above the anchor instead
            const newTop = Math.max(8, pos.top - menuHeight - 8);
            setOpenUnitMenuPos({ ...pos, top: newTop });
        }

        // Check if menu overflows left edge (positioned from right)
        const menuLeft = window.innerWidth - pos.right - menuWidth;
        if (menuLeft < 8) {
            setOpenUnitMenuPos({ ...pos, right: Math.max(8, window.innerWidth - menuWidth - 8) });
        }
    }, [openUnitMenuId, openUnitMenuPos]);

    // On-demand fetch for deep-linking
    const onDemandProperty = useQuery(
        api.myFunctions.getPropertyDetails,
        (propertyId && currentUser?.firmId && !coreState.properties?.find(p => p.id === propertyId))
            ? { propertyId, firmId: currentUser.firmId }
            : 'skip'
    );

    const { property, owner, allUnits } = useMemo(() => {
        let selectedProperty: Property | null = null;
        let propertyOwner: Contact | null = null;
        let units: Property[] = [];

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
                units = units.filter(u => u.status !== 'Deleted' && u.status !== 'Muted');

                // SORT by unitName for stable ordering
                units.sort((a, b) => {
                    const nameA = (a.rentalDetails as any)?.unitName || a.name || '';
                    const nameB = (b.rentalDetails as any)?.unitName || b.name || '';
                    return nameA.localeCompare(nameB, undefined, { numeric: true });
                });
            }
        }
        return { property: selectedProperty, owner: propertyOwner, allUnits: units };
    }, [matterState.contacts, coreState.properties, propertyId, onDemandProperty]);

    // Feature Checks — computed unconditionally so hooks always run in same order
    const isLeased = property?.category === 'Tenanted Property';
    const isSale = property?.category === 'Property For Sale';
    const hasMultipleUnits = allUnits.length > 1 || ((property as any)?.units?.length > 0);
    const isDisputed = property?.category === 'Disputed Property';

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

        // Try to find the specific target unit first
        let targetUnit: Property | undefined;
        if (targetUnitId) {
            targetUnit = allUnits.find((u: Property) =>
                u.id === targetUnitId || String(u.id) === String(targetUnitId)
            );
        }

        // Fallback: if no specific unit found, find the first unit with
        // unpaid/partial rent (overdue indicator)
        if (!targetUnit && (highlightTarget === 'overdue' || !targetUnitId)) {
            targetUnit = allUnits.find((u: Property) => {
                const rd = (u.rentalDetails || u) as any;
                const scStatus = rd.serviceChargeStatus || rd.serviceChargeStatus;
                return scStatus === 'UNPAID' || scStatus === 'unpaid' || scStatus === 'PARTIALLY_PAID';
            });
        }

        if (targetUnit) {
            setSelectedUnit(targetUnit);
            // Scroll into view after a short delay (let the drawer expand)
            setTimeout(() => {
                const el = document.querySelector(`[data-unit-id="${targetUnit!.id}"]`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);
            // Clear after expansion so it doesn't re-trigger
            setTargetUnitId(null);
        }
    }, [targetUnitId, activeTab, allUnits, highlightTarget]);

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
        parentPropertyId ? { propertyId: String(parentPropertyId) } : 'skip'
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
            .filter(e => e.propertyId === property?.id || e.unitId === property?.id);
    }, [coreState.ledgerEntries, property?.id]);

    const propertyLedgerEntries = useMemo(() => {
        return [...allPropertyLedgerEntries]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 3);
    }, [allPropertyLedgerEntries]);

    const propertyDocuments = useMemo(() => {
        // Use hasPropertyFeatures (not isProperty) so Komplete firms also
        // see property documents when viewing a property. Previously this
        // used isProperty, which is only true for pure Atrium — so Komplete
        // users fell into the else branch and saw matter documents instead.
        if (hasPropertyFeatures && property) {
            const propPrefix = `prop_${property.id}_`;
            const addressPart = (property.address || '').split(',')[0].toLowerCase();
            return documentState.documents.filter(d => {
                if (!d) return false;
                if (d.categoryId?.startsWith(propPrefix)) return true;
                if (d.title?.toLowerCase().includes(addressPart)) return true;
                return false;
            });
        } else {
            if (linkedMatters.length === 0) return [];
            const matterIds = linkedMatters.map(m => m.id);
            return documentState.documents.filter(d => d && matterIds.includes(d.matterId!));
        }
    }, [documentState.documents, linkedMatters, hasPropertyFeatures, property, property?.id, property?.address]);

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
            prompt += `\n**SPECIFIC INSTRUCTION:** This is a Notice to Quit. Ensure it complies with the Tenancy Law of Lagos State (or applicable State Law). Cite the expiration of the current term as the reason. Give the statutory notice period required for a ${rentFreq || 'yearly'} tenant.`;
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
    // milestone under Lagos State Tenancy Law. The countdown activates
    // immediately on serve.

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
                    const supersededTracker = logEvictionTracker(tracker, {
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
        const newTracker = logEvictionTracker(tracker, {
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
        const updatedTracker = logEvictionTracker(tracker, {
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
        prompt += `\n**SPECIFIC INSTRUCTION:** This is a 7-Day Notice of Owner's Intention to Recover Premises under the the applicable state Recovery of Premises Law (e.g., Lagos Tenancy Law 2011). The tenant has failed to yield possession after the quit notice period expired. Give 7 days from service of this notice for the tenant to vacate, failing which legal proceedings for recovery of premises will be commenced.\n`;
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
                <div className="max-w-7xl mx-auto p-3 sm:p-8 pb-24 md:pb-8 min-w-0">

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
                                <div className="flex justify-between items-start border-b border-slate-100 dark:border-zinc-700 pb-2 mb-4">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Property Information</h3>
                                        {allUnits.length > 1 && (
                                            <button 
                                                onClick={() => setActiveTab('units')}
                                                className="px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-2xs font-black text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800 hover:bg-primary-100 transition-all flex items-center gap-1"
                                            >
                                                {allUnits.length} Units Found <span className="opacity-50">&rarr;</span>
                                            </button>
                                        )}
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${property.status === 'Occupied' ? 'bg-green-100 text-green-800' : 'bg-slate-100 dark:bg-zinc-800 text-slate-800'}`}>
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
                                            <DetailItem label="Tenant" value={property.rentalDetails.tenantName || 'Unknown'} subText={property.rentalDetails.tenantPhone} />
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
                                            {(property.rentalDetails.serviceCharge || 0) > 0 && (
                                                <DetailItem label="Service Charge" value={<><NairaSymbol />{formatNaira(property.rentalDetails.serviceCharge || 0)}</>} />
                                            )}
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
                                                <ActionButton onClick={() => openModal('composeEmail', null, { to: property.rentalDetails?.tenantEmail || owner?.email || '', subject: `Property Update: ${property.address}` })} label="Email Tenant" />
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
                                                {isProperty ? 'Initialize File' : 'Initialize Matter'} <span className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">&rarr;</span>
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
                                    {isLeased && (
                                        <div className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-100 dark:border-zinc-700">
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${property.automationSettings?.autoRentDemand ? 'bg-green-500' : 'bg-slate-300'}`} />
                                            <div>
                                                <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">Auto Rent Demands</p>
                                                <p className="text-2xs text-slate-400">{property.automationSettings?.autoRentDemand ? 'Active — demands sent on arrears' : 'Not enabled'}</p>
                                            </div>
                                        </div>
                                    )}
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
                        </div>
                    </div>
                )}

                {activeTab === 'units' && (() => {
                    const legacyUnits = ((property as any)?.units || [])
                        .map((u: any, idx: number) => ({ ...u, id: u.id || `temp-unit-${idx}` }))
                        .filter((u: any) => u);
                    
                    const units = [...(allUnits || [])]
                        .map(u => u && u.id ? u : null)
                        .filter((u): u is Property => u !== null);

                    legacyUnits.forEach((lu: any) => {
                        if (!units.some(u => u.id === lu.id || (u as any).name === lu.name)) {
                            units.push(lu);
                        }
                    });
                    const isEmbeddedUnit = (unit: any) => legacyUnits.some((lu: any) => lu.id === unit.id);
                    const statusColors: Record<string, string> = {
                        'Occupied': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
                        'Vacant': 'bg-slate-50 dark:bg-zinc-800/50 text-slate-600 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-600',
                        'Maintenance': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
                        'Listed': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
                    };
                    const occupiedCount = units.filter(u => u?.status === 'Occupied').length;
                    const vacantCount = units.filter(u => u?.status === 'Vacant').length;
                    const maintenanceCount = units.filter(u => u?.status === 'Maintenance').length;
                    const minimumVendEnabled = (property as any).minimumVendEnabled || false;
                    const vendLabel = (property as any).minimumVendLabel || 'Min Vend';

                    const handleAddUnitSubmit = async () => {
                        if (!newUnitName.trim()) { addToast('Unit name is required', { type: 'error' }); return; }
                        // FIX: include a rentalDetails object so the unit is
                        // immediately recognized by getUnitDisplay() and
                        // financial aggregations. Previously, new units had
                        // only a bare rentAmount field, which meant they
                        // contributed ₦0 to "Total Annual Rent" until the
                        // user opened the Edit modal and saved.
                        const newUnit = {
                            id: `unit-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                            unitName: newUnitName.trim(),
                            name: newUnitName.trim(),
                            propertyType: newUnitType,
                            status: 'Vacant',
                            rentAmount: 0,
                            rentalDetails: {
                                unitName: newUnitName.trim(),
                                rentAmount: 0,
                                rentFrequency: 'Annually',
                                leaseStart: '',
                                leaseEnd: '',
                                tenantName: '',
                                tenantPhone: '',
                                tenantEmail: '',
                                serviceCharge: 0,
                                serviceChargeAmount: 0,
                                serviceChargeStatus: 'UNPAID',
                                legalFee: 0,
                                agencyFee: 0,
                                cautionDeposit: 0,
                            },
                        };
                        try {
                            await addUnit(property.id, newUnit);
                            setNewUnitName('');
                            setNewUnitType('Residential');
                            setShowAddUnitForm(false);
                        } catch (e) { addToast('Failed to add unit.', { type: 'error' }); }
                    };

                    const handleRemoveUnit = (unit: any, d: ReturnType<typeof getUnitDisplay>) => {
                        openModal('deleteConfirmation', unit.id, {
                            title: 'Remove Unit',
                            message: `Remove "${d.name}" from this property? The unit will be archived — ledger entries, receipts, and historical records will be preserved.`,
                            onConfirm: async () => {
                                try {
                                    // SOFT-DELETE FIX — instead of hard-deleting the property
                                    // record (which destroys rentPaymentHistory) or splicing
                                    // the units array (which orphans ledger entries), we mark
                                    // the unit as 'Deleted' with a timestamp. The unit is
                                    // filtered out of the display layer but all financial
                                    // and legal history is preserved in the database.
                                    const full = allUnits.find((u: Property) => u.id === unit.id) || unit;
                                    const updatePayload: any = { ...full, status: 'Deleted', deletedAt: new Date().toISOString() };
                                    if ((full as any)._id) updatePayload._id = (full as any)._id;
                                    await updateItem('properties', updatePayload, 'Property');
                                    addToast(`Unit "${d.name}" archived. Historical records preserved.`, { type: 'success' });
                                    setSelectedUnit(null);
                                } catch (e) { addToast('Failed to archive unit.', { type: 'error' }); }
                            },
                            confirmText: 'Archive Unit',
                        });
                    };

                    return (
                        <div className="space-y-6 animate-fade-in">
                            {/* Header: status pills + Add Unit button */}
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex gap-2 flex-1 overflow-x-auto pb-1 no-scrollbar">
                                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg px-4 py-2 border border-green-100 dark:border-green-800 flex items-center gap-2 flex-shrink-0">
                                        <span className="text-xl font-black text-green-700 dark:text-green-300">{occupiedCount}</span>
                                        <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">Occupied</span>
                                    </div>
                                    <div className="bg-slate-100 dark:bg-zinc-800 rounded-lg px-4 py-2 border border-slate-200 dark:border-zinc-700 flex items-center gap-2 flex-shrink-0">
                                        <span className="text-xl font-black text-slate-700 dark:text-white">{vacantCount}</span>
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Vacant</span>
                                    </div>
                                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg px-4 py-2 border border-amber-100 dark:border-amber-800 flex items-center gap-2 flex-shrink-0">
                                        <span className="text-xl font-black text-amber-700 dark:text-amber-300">{maintenanceCount}</span>
                                        <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Maintenance</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        // ROUTE TO EDIT MODAL — opens EditPropertyModal
                                        // with auto-expand of Lease & Rent Configuration
                                        // and auto-trigger of the [+ Add Unit] tab.
                                        // This replaces the inline form approach.
                                        openModal('editProperty', property.id, {
                                            contactId: owner?.id,
                                            autoExpandRental: true,
                                            autoAddUnit: true,
                                        });
                                    }}
                                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> Add Unit
                                </button>
                            </div>

                            {/* Add Unit inline form */}
                            {showAddUnitForm && (
                                <div className="bg-white dark:bg-zinc-800 rounded-lg border border-primary-200 dark:border-primary-700 shadow-sm p-5">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                        <Plus className="w-4 h-4 text-primary-500" /> Add New Unit
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1">Unit Name / Number <span className="text-rose-500">*</span></label>
                                            <input
                                                type="text"
                                                value={newUnitName}
                                                onChange={e => setNewUnitName(e.target.value)}
                                                placeholder="e.g. Unit 1A, Flat 3, Shop 2"
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                onKeyDown={e => { if (e.key === 'Enter') handleAddUnitSubmit(); if (e.key === 'Escape') setShowAddUnitForm(false); }}
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-2xs font-bold text-slate-400 uppercase tracking-wider mb-1">Unit Type</label>
                                            <select
                                                value={newUnitType}
                                                onChange={e => setNewUnitType(e.target.value as 'Residential' | 'Commercial')}
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                            >
                                                <option value="Residential">Residential</option>
                                                <option value="Commercial">Commercial</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 mt-4">
                                        <button onClick={handleAddUnitSubmit} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-lg transition-colors">Add Unit</button>
                                        <button onClick={() => { setShowAddUnitForm(false); setNewUnitName(''); }} className="px-4 py-2 bg-slate-100 dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 text-slate-600 dark:text-zinc-300 text-sm font-bold rounded-lg transition-colors">Cancel</button>
                                    </div>
                                </div>
                            )}

                            {/* ── HIGH-DENSITY UNIT CARDS ── Inline expansion layout */}
                            {(() => {
                                return (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                        {units.map((unit: Property) => {
                                                const d = getUnitDisplay(unit);
                                                const isFloor = d.name.toLowerCase().includes('floor');
                                                const menuOpen = openUnitMenuId === unit.id;
                                                const isSelected = selectedUnit?.id === unit.id;
                                                const rental = (unit as any).rentalDetails || {};
                                                const uStatus = String(unit.status || 'Vacant');
                                                const uType = (unit as any).propertyType || (unit as any).unitType || '';

                                                // ── Visual status — contextual tooltips replace static labels ──
                                                let statusBorder = '#94A3B8';
                                                let statusBadge: { label: string; cls: string; tooltip: string } | null = null;
                                                if (uStatus === 'Occupied') {
                                                    const hasTier1 = !!(d.tenantName && d.leaseEnd);
                                                    const hasTier2 = !!((rental.tenantPhone || (unit as any).tenantPhone) && d.rentAmount > 0);
                                                    if (hasTier1 && hasTier2) {
                                                        statusBorder = '#22C55E';
                                                        statusBadge = { label: 'Info Complete', cls: 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400', tooltip: d.statusTooltip };
                                                    } else if (!hasTier1) {
                                                        statusBorder = '#EF4444';
                                                        statusBadge = { label: 'Action Required', cls: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400', tooltip: d.statusTooltip };
                                                    } else {
                                                        statusBorder = '#F59E0B';
                                                        statusBadge = { label: 'Needs Info', cls: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400', tooltip: d.statusTooltip };
                                                    }
                                                }

                                                const typeBg = uType === 'Commercial'
                                                    ? 'bg-amber-50/60 dark:bg-amber-950/20'
                                                    : 'bg-blue-50/40 dark:bg-blue-950/10';

                                                // ── SC status badge renderer ──
                                                const scStatus = d.serviceChargeStatus || (rental as any).serviceChargeStatus || (unit as any).serviceChargeStatus;
                                                const scOutstanding = d.outstandingServiceChargeBalance || (rental as any).outstandingServiceChargeBalance || 0;
                                                const scAmount = d.serviceChargeAmount || Number((unit as any).serviceCharge || (rental as any).serviceCharge || 0);

                                                const renderScBadge = () => {
                                                    if (d.remindersPaused) {
                                                        return <span className="inline-flex items-center gap-0.5 text-3xs font-black px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" title="Reminders auto-paused — max effort reached. Manual intervention required.">Reminders Paused</span>;
                                                    }
                                                    if (scStatus === 'PAID_FULLY' || scStatus === 'PAID' || scStatus === 'paid') {
                                                        return <span className="inline-flex items-center gap-0.5 text-3xs font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircleIcon className="w-3 h-3" /> Paid</span>;
                                                    }
                                                    if (scStatus === 'PARTIALLY_PAID') {
                                                        return <>
                                                            <span className="inline-flex items-center gap-0.5 text-3xs font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Partial</span>
                                                            {scOutstanding > 0 && <span className="text-3xs text-red-500 dark:text-red-400 font-bold">Bal: ₦{scOutstanding.toLocaleString()}</span>}
                                                        </>;
                                                    }
                                                    if (scStatus === 'UNPAID') {
                                                        return <span className="inline-flex items-center gap-0.5 text-3xs font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Outstanding</span>;
                                                    }
                                                    return null;
                                                };

                                                // ── Statutory timeline milestone ──
                                                const renderTermMilestone = () => {
                                                    if (!d.isPastHalfway || uStatus !== 'Occupied') return null;
                                                    const pct = Math.round((d.termProgress ?? 0) * 100);
                                                    // REFINED ADVISORY — no longer recommends serving Notice to Quit.
                                                    // Before compression: "Statutory notice window is active."
                                                    // During/after compression: "Statutory notice window compressed—review lease terms or engage tenant for waiver."
                                                    const isCompressed = pct >= 75;
                                                    const tooltipText = isCompressed
                                                        ? `Tenancy ${pct}% elapsed. Statutory notice window compressed—review lease terms or engage tenant for waiver.`
                                                        : `Tenancy ${pct}% elapsed. Statutory notice window is active.`;
                                                    return (
                                                        <div className="flex items-center gap-1 mt-1" title={tooltipText}>
                                                            <CalendarIcon className="w-3 h-3 text-orange-500" />
                                                            <span className="text-3xs font-black text-orange-600 dark:text-orange-400 uppercase">{pct}% Elapsed</span>
                                                        </div>
                                                    );
                                                };

                                                // Expanded view data
                                                const tenantPhone: string = (unit as any).rentalDetails?.tenantPhone || (unit as any).tenantPhone || '';
                                                const tenantEmail: string = (unit as any).rentalDetails?.tenantEmail || (unit as any).tenantEmail || '';
                                                const hasContactInfo = !!(tenantPhone || tenantEmail);

                                                // ── Eviction Tracker State ──
                                                const eviction = getEvictionTracker(unit);
                                                const isEvictionActive = eviction.quitNoticeStatus !== 'none' || eviction.sevenDayNoticeStatus !== 'none';
                                                const isSevenDayDue = eviction.sevenDayNoticeStatus === 'due' && eviction.sevenDayNoticeDueDate && Date.now() >= eviction.sevenDayNoticeDueDate;
                                                const isSevenDayUpcoming = eviction.sevenDayNoticeStatus === 'due' && eviction.sevenDayNoticeDueDate && Date.now() < eviction.sevenDayNoticeDueDate;
                                                const canUseEviction = isGrowthOrAbove || isKompleteFirm;

                                                const handleWhatsApp = () => {
                                                    if (!tenantPhone) return;
                                                    const clean = tenantPhone.replace(/\D/g, '').replace(/^0+/, '');
                                                    const num = clean.startsWith('234') ? clean : `234${clean}`;
                                                    // GRAMMAR FIX: If d.name already starts with "Unit" (e.g., "Unit 2"),
                                                    // don't prepend another "Unit" — that would create "regarding Unit Unit 2".
                                                    const unitName = d.name || '';
                                                    const unitRef = unitName.toLowerCase().startsWith('unit') ? unitName : `Unit ${unitName}`;
                                                    const msg = encodeURIComponent(`Hello ${d.tenantName || 'Tenant'}, this is a message from ${owner?.name || 'your landlord/manager'} regarding ${unitRef} at ${property.address}.`);
                                                    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
                                                };

                                                const handleEmailTenant = () => {
                                                    openModal('composeEmail', null, {
                                                        to: tenantEmail,
                                                        subject: `Re: ${d.name} — ${property.address}`,
                                                    });
                                                };

                                                const handleOpenInbox = () => {
                                                    try {
                                                        sessionStorage.setItem('atrium_compose_prefill', JSON.stringify({
                                                            unitId: unit.id,
                                                            unitName: d.name,
                                                            tenantName: d.tenantName,
                                                            tenantPhone,
                                                            tenantEmail,
                                                            rentAmount: d.rentAmount,
                                                            propertyAddress: property.address,
                                                        }));
                                                        sessionStorage.setItem('atrium_open_tab', 'inbox');
                                                    } catch (e) {}
                                                    navigateTo('atriumEngine');
                                                };

                                                const handleSendPortalMessage = async () => {
                                                    try {
                                                        await convex.mutation(api.portals.sendPortalMessage, {
                                                            firmId: coreState.firmDetails?.id || '',
                                                            senderId: currentUser?.id || '',
                                                            senderName: currentUser?.name || 'Property Manager',
                                                            senderRole: 'admin',
                                                            subject: `Message for ${d.tenantName || 'Tenant'}`,
                                                            content: `Hello ${d.tenantName || 'Tenant'}, this is a message from ${coreState.firmDetails?.name || 'Management'} regarding ${(d.name || '').toLowerCase().startsWith('unit') ? d.name : `Unit ${d.name}`} at ${property.address}.`,
                                                            unitId: unit.id,
                                                        });
                                                        addToast('Portal message sent!', { type: 'success' });
                                                    } catch (err: any) {
                                                        addToast(err.message || 'Failed to send portal message', { type: 'error' });
                                                    }
                                                };

                                                const handleOpenCompose = () => {
                                                    setComposePrefill({
                                                        unitId: unit.id,
                                                        unitName: d.name,
                                                        tenantName: d.tenantName,
                                                        tenantPhone,
                                                        tenantEmail,
                                                        rentAmount: d.rentAmount,
                                                        propertyAddress: property.address,
                                                    });
                                                    setShowCompose(true);
                                                };

                                                return (
                                                    <div
                                                        key={unit.id}
                                                        data-unit-id={unit.id}
                                                        ref={isSelected ? (el: HTMLDivElement | null) => { /* removed scrollIntoView — caused scroll bounce when expanding unit details */ } : undefined}
                                                        onClick={(e) => { e.stopPropagation(); setSelectedUnit(isSelected ? null : unit); setShowAddUnitForm(false); setShowUnitMessaging(false); setShowFullUnitDetail(false); }}
                                                        style={{ borderLeftColor: isSelected ? undefined : statusBorder, borderLeftWidth: 4 }}
                                                        className={`${typeBg} rounded-lg border shadow-sm hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer overflow-hidden ${
                                                            isSelected ? 'col-span-1 sm:col-span-2 lg:col-span-3 xl:col-span-4 border-primary-400 dark:border-primary-600 ring-2 ring-primary-100 dark:ring-primary-900/50 p-4 sm:p-5' : 'border-slate-200 dark:border-zinc-700 hover:border-primary-300 dark:hover:border-primary-700 p-3'
                                                        } ${
                                                            // HIGHLIGHT GLOW — when this unit is the target of an overdue
                                                            // rent notification deep-link, apply a rose pulse ring for 5s.
                                                            highlightTarget && (highlightTarget === unit.id || highlightTarget === String(unit.id) || highlightTarget === 'overdue')
                                                                ? 'ring-2 ring-rose-500/60 animate-pulse shadow-lg shadow-rose-500/20'
                                                                : ''
                                                        }`}
                                                    >
                                                        {/* ── Card Header ── */}
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="min-w-0 flex-1 pr-2">
                                                                <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{d.name}</p>
                                                                {d.floor && <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-0.5">Floor {d.floor}</p>}
                                                            </div>
                                                            {/* DIRECT STATUS BADGE — clickable to open a quick status
                                                                selector without expanding the card or opening edit modal. */}
                                                            <div className="relative">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const el = e.currentTarget.nextElementSibling as HTMLElement;
                                                                        if (el) el.classList.toggle('hidden');
                                                                    }}
                                                                    className={`px-2 py-0.5 rounded-md text-2xs font-bold uppercase tracking-wide flex-shrink-0 border cursor-pointer hover:ring-2 hover:ring-primary-500/30 transition-all ${statusColors[uStatus] || 'bg-slate-50 dark:bg-zinc-800/50 text-slate-600 border-slate-200 dark:border-zinc-600'}`}
                                                                    title="Click to change status"
                                                                >
                                                                    {uStatus}
                                                                </button>
                                                                <div className="hidden absolute right-0 top-full mt-1 z-50 w-36 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-lg">
                                                                    {(['Occupied', 'Vacant', 'Maintenance', 'Listed'] as const).map(s => (
                                                                        <button
                                                                            key={s}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                const full = allUnits.find((u: Property) => u.id === unit.id) || unit;
                                                                                const updatePayload: any = { ...full, status: s };
                                                                                if ((full as any)._id) updatePayload._id = (full as any)._id;
                                                                                updateItem('properties', updatePayload, 'Property');
                                                                                addToast(`${d.name} marked as ${s}`, { type: 'success' });
                                                                                const el = e.currentTarget.parentElement as HTMLElement;
                                                                                if (el) el.classList.add('hidden');
                                                                            }}
                                                                            className={`block w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-zinc-700 ${uStatus === s ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-slate-600 dark:text-zinc-300'}`}
                                                                        >
                                                                            {s}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* ── Micro-Profile: Operational dynamics only ── */}
                                                        <div className="space-y-1 text-xs min-w-0 overflow-hidden">
                                                            {d.tenantName && (
                                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-zinc-600 flex items-center justify-center flex-shrink-0">
                                                                        <span className="text-3xs font-black text-slate-500 dark:text-zinc-300">{d.tenantName.charAt(0).toUpperCase()}</span>
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-slate-800 dark:text-zinc-100 text-xs font-semibold truncate min-w-0">
                                                                            {d.tenantName}
                                                                        </p>
                                                                        {/* Tenancy Ends date — directly beneath tenant name,
                                                                            aligned with the avatar's left margin (pl-5 to match
                                                                            the w-5 avatar width + gap-1.5). Previously this was
                                                                            a separate row lower down with just "Ends" label. */}
                                                                        {d.leaseEnd && (
                                                                            <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                                                                <span className="font-bold text-slate-400 uppercase tracking-wider mr-1">Tenancy Ends:</span>
                                                                                {(() => { try { return new Date(d.leaseEnd).toLocaleDateString('en-GB'); } catch { return '—'; } })()}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Service Charge — always show if amount > 0 */}
                                                            {scAmount > 0 && (
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="font-bold text-slate-400 uppercase tracking-wider text-3xs">SC</span>
                                                                    <span className="text-slate-700 dark:text-zinc-200">₦{scAmount.toLocaleString()}</span>
                                                                    {renderScBadge()}
                                                                </div>
                                                            )}

                                                            {/* Minimum Vend — if property has MV enabled */}
                                                            {minimumVendEnabled && uStatus === 'Occupied' && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="font-bold text-slate-400 uppercase tracking-wider text-3xs">MV</span>
                                                                    <span className="text-3xs font-bold text-slate-600 dark:text-zinc-300">{vendLabel}</span>
                                                                    {(d.serviceChargeStatus as string) === 'PAID_FULLY' || (d.serviceChargeStatus as string) === 'PAID'
                                                                        ? <span className="text-3xs font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Compliant</span>
                                                                        : <span className="text-3xs font-black px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Outstanding</span>
                                                                    }
                                                                </div>
                                                            )}

                                                            {/* Statutory Timeline Milestone */}
                                                            {renderTermMilestone()}

                                                            {/* ── Maintenance Ticket Indicator ──────────────────────────
                                                                Shows a badge if this unit has open maintenance tickets.
                                                                Turns amber/red if any ticket is stale (>24h in same status). */}
                                                            {(() => {
                                                                const unitTickets = ticketsByUnit[String(unit.id)] || [];
                                                                const openTickets = unitTickets.filter((t: any) => t.status === 'open' || t.status === 'in_progress');
                                                                if (openTickets.length === 0) return null;
                                                                const hasStale = openTickets.some((t: any) => t.isStale);
                                                                return (
                                                                    <div
                                                                        className={`flex items-center gap-1.5 mt-1 px-2 py-1 rounded-lg cursor-pointer ${
                                                                            hasStale
                                                                                ? 'bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/40'
                                                                                : 'bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/30'
                                                                        }`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            navigateTo('messaging' as any);
                                                                        }}
                                                                        title={hasStale
                                                                            ? `${openTickets.length} open ticket(s) — one or more has been pending for >24 hours. Tap to view in Conversations.`
                                                                            : `${openTickets.length} open ticket(s). Tap to view in Conversations.`
                                                                        }
                                                                    >
                                                                        <Wrench className={`w-3 h-3 ${hasStale ? 'text-rose-500' : 'text-amber-500'}`} />
                                                                        <span className={`text-3xs font-black uppercase tracking-wide ${hasStale ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                                            {openTickets.length} Open Ticket{openTickets.length > 1 ? 's' : ''}
                                                                        </span>
                                                                        {hasStale && (
                                                                            <span className="text-3xs font-bold text-rose-500 dark:text-rose-400 ml-1">
                                                                                ⚠ Stale
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}

                                                            {/* Lease end — moved to beneath tenant name above.
                                                                This duplicate display removed per user request. */}

                                                            {/* Eviction Status Badge — on collapsed card */}
                                                            {isEvictionActive && (
                                                                <div className="flex items-center gap-1 mt-0.5">
                                                                    <Scale className="w-3 h-3 text-rose-500" />
                                                                    {eviction.quitNoticeStatus === 'drafted' && (
                                                                        <span className="text-3xs font-black text-amber-600 dark:text-amber-400 uppercase">Quit: Drafted</span>
                                                                    )}
                                                                    {eviction.quitNoticeStatus === 'served' && (
                                                                        <span className="text-3xs font-black text-amber-600 dark:text-amber-400 uppercase">Quit: Served</span>
                                                                    )}
                                                                    {eviction.quitNoticeStatus === 'superseded' && (
                                                                        <span className="text-3xs font-black text-slate-400 dark:text-zinc-500 uppercase line-through">Quit: Superseded</span>
                                                                    )}
                                                                    {/* "Quit: Delivered" badge removed — "Served" is the sole
                                                                        statutory milestone. Countdown shows in the tracking tab. */}
                                                                    {isSevenDayDue && (
                                                                        <span className="text-3xs font-black text-rose-600 dark:text-rose-400 uppercase animate-pulse">7-Day Notice Due!</span>
                                                                    )}
                                                                    {isSevenDayUpcoming && (
                                                                        <span className="text-3xs font-black text-orange-600 dark:text-orange-400 uppercase">7-Day Due {eviction.sevenDayNoticeDueDate ? new Date(eviction.sevenDayNoticeDueDate).toLocaleDateString('en-GB') : ''}</span>
                                                                    )}
                                                                    {eviction.sevenDayNoticeStatus === 'drafted' && (
                                                                        <span className="text-3xs font-black text-blue-600 dark:text-blue-400 uppercase">7-Day: Drafted</span>
                                                                    )}
                                                                    {eviction.sevenDayNoticeStatus === 'served' && (
                                                                        <span className="text-3xs font-black text-blue-600 dark:text-blue-400 uppercase">7-Day: Served</span>
                                                                    )}
                                                                    {eviction.sevenDayNoticeStatus === 'delivered' && (
                                                                        <span className="text-3xs font-black text-emerald-600 dark:text-emerald-400 uppercase">7-Day: Delivered</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* ── Card Footer: contextual badge + actions ── */}
                                                        <div className="mt-2.5 flex items-center justify-between border-t border-slate-100/80 dark:border-zinc-700/50 pt-2 min-w-0 gap-1">
                                                            {statusBadge ? (
                                                                <Tooltip text={statusBadge.tooltip} allowWrap>
                                                                    <span className={`text-3xs font-black px-2 py-0.5 rounded-full uppercase tracking-wide cursor-help ${statusBadge.cls}`}>
                                                                        {statusBadge.label}
                                                                    </span>
                                                                </Tooltip>
                                                            ) : (
                                                                // DEDUP FIX: when uStatus is 'Vacant', the top-right badge
                                                                // already shows 'VACANT'. Don't show a duplicate here.
                                                                // Only show the fallback badge for non-vacant units that
                                                                // don't have a statusBadge (e.g. occupied but missing data).
                                                                uStatus !== 'Vacant' ? (
                                                                    <span className="text-3xs font-black px-2 py-0.5 rounded-full uppercase tracking-wide text-slate-400 bg-slate-50 dark:bg-zinc-700/40">
                                                                        {uStatus}
                                                                    </span>
                                                                ) : null
                                                            )}
                                                            {/* THREE-DOT MENU REMOVED — all actions available in expanded view. Status badge is directly clickable. */}
                                                        </div>

                                                        {/* ── Inline Expanded View: Two-tier design ── 
                                                            Tier 1 (always shown when selected): Compact quick-action bar
                                                            Tier 2 (shown on "More"): Full detail card with metadata + all actions
                                                        */}
                                                        {isSelected && (
                                                            <div className="mt-3 pt-3 border-t border-primary-200/60 dark:border-primary-700/50 animate-fade-in">
                                                                {/* ── Tier 1: Compact Quick-Action Bar ── */}
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    {/* Close (X) button removed per user request.
                                                                        Toggling/clicking the unit card itself handles
                                                                        collapse and accordion state switching. */}

                                                                    {unit.status === 'Occupied' && property.rentCollectionMode !== 'Management Only (No Rent)' && (
                                                                        <button onClick={(e) => { e.stopPropagation(); openModal('collectRent', property.id, { unitName: d.name, tenantName: d.tenantName, rentAmount: d.rentAmount, unitId: unit.id }); }} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-2xs font-bold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm" aria-label="Record Payment & Issue Receipt" title="Record Payment & Issue Receipt">
                                                                            <Receipt className="w-3 h-3" /> Receipt
                                                                        </button>
                                                                    )}
                                                                    {unit.status === 'Occupied' && property.rentCollectionMode !== 'Management Only (No Rent)' && (
                                                                        <button onClick={(e) => { e.stopPropagation(); handleDraftAction('Rent Demand Notice', 'Demand', unit); }} className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-2xs font-bold rounded-lg flex items-center gap-1.5 transition-colors border border-amber-200 dark:border-amber-800" aria-label="Rent Demand Notice" title="Rent Demand Notice">
                                                                            <Megaphone className="w-3 h-3" /> Demand
                                                                        </button>
                                                                    )}
                                                                    <button onClick={(e) => { e.stopPropagation(); setShowUnitMessaging(v => !v); setShowFullUnitDetail(false); }} className={`px-3 py-1.5 text-2xs font-bold rounded-lg flex items-center gap-1.5 transition-colors ${showUnitMessaging ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-50 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-600 border border-slate-200 dark:border-zinc-600'}`} aria-label="Message Tenant" title="Message Tenant">
                                                                        <MessageSquare className="w-3 h-3" /> Message
                                                                    </button>
                                                                    <button onClick={(e) => { e.stopPropagation(); openModal('editProperty', isEmbeddedUnit(unit) ? property.id : unit.id, { contactId: owner?.id, activeUnitId: unit.id }); }} className="px-3 py-1.5 bg-slate-50 dark:bg-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-600 text-slate-600 dark:text-zinc-300 text-2xs font-bold rounded-lg flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-zinc-600" aria-label="Edit Unit" title="Edit Unit">
                                                                        <EditIcon className="w-3 h-3" /> Edit
                                                                    </button>
                                                                    {/* More button — reveals full detail card.
                                                                        Gear icon removed per user request — just text now. */}
                                                                    <button onClick={(e) => { e.stopPropagation(); setShowFullUnitDetail(v => !v); setShowUnitMessaging(false); }} className={`px-3 py-1.5 text-2xs font-bold rounded-lg flex items-center gap-1.5 transition-colors ml-auto ${showFullUnitDetail ? 'bg-primary-600 text-white shadow-sm' : 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 border border-primary-200 dark:border-primary-800'}`} aria-label="Full unit details & more actions" title="Full unit details & more actions">
                                                                        {showFullUnitDetail ? 'Less' : 'More'}
                                                                    </button>
                                                                </div>

                                                                {/* ── Quick Messaging Strip (inline, compact) ── */}
                                                                {showUnitMessaging && (
                                                                    <div className="mt-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/10 p-3 animate-fade-in">
                                                                        <p className="text-3xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2">
                                                                            Contact {d.tenantName || 'Tenant'}
                                                                        </p>
                                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                                            {tenantPhone && (isGrowthOrAbove || isKompleteFirm) && (
                                                                                <button onClick={handleWhatsApp} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-2xs font-bold rounded-lg transition-colors">
                                                                                    <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                                                                                </button>
                                                                            )}
                                                                            {tenantPhone && !isGrowthOrAbove && !isKompleteFirm && (
                                                                                <button disabled aria-label="WhatsApp requires Growth plan or above" title="WhatsApp requires Growth plan or above" className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/40 text-white/50 text-2xs font-bold rounded-lg cursor-not-allowed relative">
                                                                                    <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                                                                                    <LockClosedIcon className="w-2.5 h-2.5 absolute top-0.5 right-0.5" />
                                                                                </button>
                                                                            )}
                                                                            {tenantEmail && (
                                                                                <button onClick={handleEmailTenant} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-2xs font-bold rounded-lg transition-colors">
                                                                                    <Mail className="w-3.5 h-3.5" /> Email
                                                                                </button>
                                                                            )}
                                                                            {tenantPhone && (
                                                                                <a href={`tel:${tenantPhone}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-2xs font-bold rounded-lg transition-colors">
                                                                                    <Phone className="w-3.5 h-3.5" /> Call
                                                                                </a>
                                                                            )}
                                                                            <button onClick={handleSendPortalMessage} className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-2xs font-bold rounded-lg transition-colors">
                                                                                <Eye className="w-3.5 h-3.5" /> Portal
                                                                            </button>
                                                                            <button onClick={handleOpenCompose} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-600 text-2xs font-bold rounded-lg transition-colors">
                                                                                <MessageSquare className="w-3.5 h-3.5 text-emerald-500" /> Compose
                                                                            </button>
                                                                        </div>
                                                                        {!hasContactInfo && (
                                                                            <p className="text-2xs text-slate-400 mt-2">No contact info saved — edit the unit to add phone or email.</p>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* ── Tier 2: Full Detail Card (shown on "More") ── */}
                                                                {showFullUnitDetail && (
                                                                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-zinc-700 animate-fade-in">
                                                                        {/* Detail header */}
                                                                        <div className="flex items-start justify-between mb-3">
                                                                            <div>
                                                                                <p className="text-3xs font-bold text-primary-500 uppercase tracking-widest mb-0.5">Unit Detail</p>
                                                                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{d.name}</h4>
                                                                                {d.floor && <p className="text-2xs text-slate-400">Floor {d.floor}</p>}
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5">
                                                                                {d.remindersPaused && (
                                                                                    <span className="px-1.5 py-0.5 rounded-full text-3xs font-black uppercase tracking-wide bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" title="Reminders auto-paused after max consecutive attempts. Manual intervention required.">
                                                                                        Paused
                                                                                    </span>
                                                                                )}
                                                                                {/* INTERACTIVE STATUS BADGE — clicking opens a quick
                                                                                    status dropdown for direct occupancy editing.
                                                                                    No need to open the full Edit Property modal. */}
                                                                                <div className="relative">
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            // Toggle a simple status dropdown
                                                                                            const el = e.currentTarget.nextElementSibling as HTMLElement;
                                                                                            if (el) el.classList.toggle('hidden');
                                                                                        }}
                                                                                        className={`px-1.5 py-0.5 rounded-full text-3xs font-black uppercase tracking-wide cursor-pointer hover:ring-2 hover:ring-primary-500/30 transition-all ${statusColors[String(unit.status || 'Vacant')] || 'bg-slate-100 dark:bg-zinc-800 text-slate-600'}`}
                                                                                        title="Click to change status"
                                                                                    >
                                                                                        {String(unit.status || 'Vacant')} ▾
                                                                                    </button>
                                                                                    <div className="hidden absolute right-0 top-full mt-1 z-50 w-40 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-lg">
                                                                                        {(['Occupied', 'Vacant', 'Maintenance', 'Listed'] as const).map(s => (
                                                                                            <button
                                                                                                key={s}
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    const full = allUnits.find((u: Property) => u.id === unit.id) || unit;
                                                                                                    // FIX: pass _id (Convex internal ID) as well as id (client UUID).
                                                                                                    // The updateItem mutation tries ctx.db.get(id) first, then falls
                                                                                                    // back to by_custom_id index. If the unit only has a _id and no
                                                                                                    // custom 'id' field, the update fails with 'Record not found'.
                                                                                                    // Including _id ensures the mutation can always find the record.
                                                                                                    const updatePayload: any = { ...full, status: s };
                                                                                                    if ((full as any)._id) {
                                                                                                        updatePayload._id = (full as any)._id;
                                                                                                    }
                                                                                                    updateItem('properties', updatePayload, 'Property');
                                                                                                    addToast(`${d.name} marked as ${s}`, { type: 'success' });
                                                                                                    // Hide dropdown
                                                                                                    const el = e.currentTarget.parentElement as HTMLElement;
                                                                                                    if (el) el.classList.add('hidden');
                                                                                                }}
                                                                                                className={`block w-full text-left px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-zinc-700 ${String(unit.status || 'Vacant') === s ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-slate-600 dark:text-zinc-300'}`}
                                                                                            >
                                                                                                {s}
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {/* Details grid — compact 3-col metadata */}
                                                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 mb-3">
                                                                            {d.tenantName && <DetailItem label="Tenant" value={d.tenantName} />}
                                                                            {property.rentCollectionMode !== 'Management Only (No Rent)' && d.rentAmount > 0 && (
                                                                                <DetailItem label="Rent" value={<>₦{d.rentAmount.toLocaleString()} <span className="text-2xs text-slate-400 font-normal">/{d.rentFrequency === 'Monthly' ? 'mo' : 'yr'}</span></>} />
                                                                            )}
                                                                            {d.leaseEnd && <DetailItem label="Lease End" value={(() => { try { return new Date(d.leaseEnd).toLocaleDateString('en-GB'); } catch { return d.leaseEnd; } })()} />}
                                                                            {tenantPhone && <DetailItem label="Phone" value={tenantPhone} />}
                                                                            {tenantEmail && <DetailItem label="Email" value={<span className="truncate block">{tenantEmail}</span>} />}
                                                                            {((unit as any).serviceCharge || (unit as any).rentalDetails?.serviceCharge || 0) > 0 && (
                                                                                <DetailItem label="Service Charge" value={
                                                                                    <>
                                                                                        ₦{Number((unit as any).serviceCharge || (unit as any).rentalDetails?.serviceCharge || 0).toLocaleString()}
                                                                                        {(() => {
                                                                                            const scSt = d.serviceChargeStatus || (unit as any).rentalDetails?.serviceChargeStatus || (unit as any).serviceChargeStatus;
                                                                                            if (scSt === 'PAID_FULLY' || scSt === 'PAID') return <span className="ml-1 inline-flex items-center gap-0.5 text-3xs font-black px-1 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Clear</span>;
                                                                                            if (scSt === 'PARTIALLY_PAID') return <span className="ml-1 inline-flex items-center gap-0.5 text-3xs font-black px-1 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Partial</span>;
                                                                                            if (scSt === 'UNPAID') return <span className="ml-1 inline-flex items-center gap-0.5 text-3xs font-black px-1 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Outstanding</span>;
                                                                                            return null;
                                                                                        })()}
                                                                                    </>
                                                                                } />
                                                                            )}
                                                                            {(() => {
                                                                                const scSt = d.serviceChargeStatus || (unit as any).rentalDetails?.serviceChargeStatus || (unit as any).serviceChargeStatus;
                                                                                const outstanding = d.outstandingServiceChargeBalance || (unit as any).rentalDetails?.outstandingServiceChargeBalance || 0;
                                                                                return scSt === 'PARTIALLY_PAID' && outstanding > 0 ? <DetailItem label="Outstanding" value={<span className="text-red-600 dark:text-red-400 font-bold">₦{outstanding.toLocaleString()}</span>} /> : null;
                                                                            })()}
                                                                            {((unit as any).legalFee || (unit as any).rentalDetails?.legalFee || 0) > 0 && <DetailItem label="Legal Fee" value={<>₦{Number((unit as any).legalFee || (unit as any).rentalDetails?.legalFee || 0).toLocaleString()}</>} />}
                                                                            {((unit as any).agencyFee || (unit as any).rentalDetails?.agencyFee || 0) > 0 && <DetailItem label="Agency Fee" value={<>₦{Number((unit as any).agencyFee || (unit as any).rentalDetails?.agencyFee || 0).toLocaleString()}</>} />}
                                                                            {((unit as any).cautionDeposit || (unit as any).rentalDetails?.cautionDeposit || 0) > 0 && <DetailItem label="Caution Deposit" value={<>₦{Number((unit as any).cautionDeposit || (unit as any).rentalDetails?.cautionDeposit || 0).toLocaleString()}</>} />}
                                                                            {d.termProgress !== null && (
                                                                                <DetailItem label="Term Progress" value={
                                                                                    <div className="flex items-center gap-1.5">
                                                                                        <div className="flex-1 h-1.5 bg-slate-200 dark:bg-zinc-700 rounded-full overflow-hidden max-w-[80px]">
                                                                                            <div className={`h-full rounded-full transition-all ${d.isPastHalfway ? 'bg-orange-500' : 'bg-emerald-500'}`} style={{ width: `${Math.round(d.termProgress * 100)}%` }} />
                                                                                        </div>
                                                                                        <span className="text-3xs font-bold text-slate-600 dark:text-zinc-300">{Math.round(d.termProgress * 100)}%</span>
                                                                                    </div>
                                                                                } />
                                                                            )}
                                                                        </div>

                                                                        {/* Secondary actions — single-row uniform chips.
                                                                            CRO AUDIT FIX — all buttons share identical height (h-8),
                                                                            padding (px-3 py-1.5), font size (text-xs font-medium),
                                                                            rounded corners (rounded-md), icon sizes (w-3.5 h-3.5).
                                                                            Styled as subtle outline chips with gentle hover fills.
                                                                            Single horizontal flex row with flex-wrap for small screens. */}
                                                                        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 mt-3">
                                                                            {unit.status === 'Occupied' && property.rentCollectionMode !== 'Management Only (No Rent)' && (
                                                                                <button onClick={(e) => { e.stopPropagation(); openModal('recordRentPayment', null, { unitId: unit.id, unitName: d.name, tenantName: d.tenantName, rentAmount: d.rentAmount, firmId: coreState.firmDetails?.id }); }} className="h-8 px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-400 whitespace-nowrap" aria-label="Ledger-only entry (no receipt)" title="Ledger-only entry (no receipt)">
                                                                                    <Wallet className="w-3.5 h-3.5" /> Ledger
                                                                                </button>
                                                                            )}
                                                                            {/* STATE GATING — when a notice is served, the "Quit Notice"
                                                                                button transitions to a muted/secondary state (opacity-60).
                                                                                Clicking it triggers the supersede confirmation modal
                                                                                (handled in handleQuitNoticeDrafted). */}
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); if (canUseEviction) { handleQuitNoticeDrafted(unit); } else { handleDraftAction('Notice to Quit', 'Quit', unit); } }}
                                                                                className={`h-8 px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors border whitespace-nowrap ${
                                                                                    eviction.quitNoticeStatus === 'served'
                                                                                        ? 'opacity-60 border-slate-300 dark:border-zinc-600 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:opacity-100'
                                                                                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-rose-600 dark:text-rose-400'
                                                                                }`}
                                                                                aria-label={eviction.quitNoticeStatus === 'served' ? "Active notice exists — click to supersede with fresh notice" : "Draft Notice to Quit"}
                                                                                title={eviction.quitNoticeStatus === 'served' ? "Active notice exists — click to supersede with fresh notice" : "Draft Notice to Quit"}
                                                                            >
                                                                                <LogOut className="w-3.5 h-3.5" /> {eviction.quitNoticeStatus === 'served' ? 'Supersede' : 'Quit Notice'}
                                                                            </button>

                                                                            {/* ── Eviction Workflow Actions (Growth+/KOMPLETE only) ──
                                                                                STATUTORY EVICTION STATE MACHINE:
                                                                                  drafted → served (activates countdown)
                                                                                  served → 7-Day Notice (when countdown expires)
                                                                                "Mark as Delivered" removed — "Served" is the sole statutory
                                                                                milestone under Nigerian tenancy law.
                                                                                State gating: when a notice is served, the "Draft Notice"
                                                                                button transitions to a muted/secondary state. Clicking it
                                                                                triggers the supersede confirmation modal. */}
                                                                            {canUseEviction && isEvictionActive && (
                                                                                <>
                                                                                    {eviction.quitNoticeStatus === 'drafted' && (
                                                                                        <button onClick={(e) => { e.stopPropagation(); handleMarkQuitNoticeServed(unit); }} className="h-8 px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-700 dark:text-amber-400 whitespace-nowrap" aria-label="Mark Quit Notice as Served — activates statutory countdown" title="Mark Quit Notice as Served — activates statutory countdown">
                                                                                            <CheckCircleIcon className="w-3.5 h-3.5" /> Mark Served
                                                                                        </button>
                                                                                    )}
                                                                                    {/* "Mark Delivered" button REMOVED — "Served" is the sole
                        statutory milestone. Countdown activates on serve. */}
                                                                                    {(isSevenDayDue || eviction.sevenDayNoticeStatus === 'due') && (
                                                                                        <button onClick={(e) => { e.stopPropagation(); handleDraftSevenDayNotice(unit); }} className={`h-8 px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors border whitespace-nowrap ${isSevenDayDue ? 'bg-rose-600 text-white hover:bg-rose-700 animate-pulse shadow-md border-rose-600' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-rose-600 dark:text-rose-400'}`} aria-label={isSevenDayDue ? "7-Day Notice is now due — draft it now" : "Draft 7-Day Notice of Owner's Intention to Recover Premises"} title={isSevenDayDue ? "7-Day Notice is now due — draft it now" : "Draft 7-Day Notice of Owner's Intention to Recover Premises"}>
                                                                                            <Scale className="w-3.5 h-3.5" /> {isSevenDayDue ? '7-Day Due!' : '7-Day'}
                                                                                        </button>
                                                                                    )}
                                                                                    {eviction.sevenDayNoticeStatus === 'drafted' && (
                                                                                        <button onClick={(e) => { e.stopPropagation(); updateEvictionTracker(unit, { sevenDayNoticeStatus: 'served' }); addToast('7-Day Notice marked as served.', { type: 'success' }); }} className="h-8 px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-700 dark:text-amber-400 whitespace-nowrap" aria-label="Mark 7-Day Notice as Served" title="Mark 7-Day Notice as Served">
                                                                                            <CheckCircleIcon className="w-3.5 h-3.5" /> 7-Day Served
                                                                                        </button>
                                                                                    )}
                                                                                    {eviction.sevenDayNoticeStatus === 'served' && (
                                                                                        <button onClick={(e) => { e.stopPropagation(); updateEvictionTracker(unit, { sevenDayNoticeStatus: 'delivered' }); addToast('7-Day Notice delivery confirmed. Ready for court filing.', { type: 'success' }); }} className="h-8 px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-400 whitespace-nowrap" aria-label="Confirm delivery of 7-Day Notice" title="Confirm delivery of 7-Day Notice">
                                                                                            <CheckCircleIcon className="w-3.5 h-3.5" /> 7-Day Delivered
                                                                                        </button>
                                                                                    )}
                                                                                </>
                                                                            )}
                                                                            {canUseEviction && !isEvictionActive && uStatus === 'Occupied' && (
                                                                                <span className="text-3xs text-slate-400 italic">Eviction workflow available via Quit Notice</span>
                                                                            )}
                                                                            <button onClick={(e) => { e.stopPropagation(); handleInitializeMatter(unit); }} className="h-8 px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-700 dark:text-indigo-400 whitespace-nowrap" aria-label="Initialize Legal/Management File" title="Initialize Legal/Management File">
                                                                                <Scale className="w-3.5 h-3.5" /> Legal File
                                                                            </button>
                                                                            <button onClick={(e) => { e.stopPropagation(); const full = units.find((u: Property) => u.id === unit.id) || unit; updateItem('properties', { ...full, status: 'Maintenance' }, 'Property'); addToast('Unit marked for maintenance: ' + d.name, { type: 'success' }); }} className="h-8 px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-700 dark:text-amber-400 whitespace-nowrap" aria-label="Log Maintenance" title="Log Maintenance">
                                                                                <Wrench className="w-3.5 h-3.5" /> Maintenance
                                                                            </button>
                                                                            {uStatus !== 'Vacant' && (
                                                                                <button onClick={(e) => { e.stopPropagation(); const full = units.find((u: Property) => u.id === unit.id) || unit; updateItem('properties', { ...full, status: 'Vacant', rentalDetails: { ...(full as any).rentalDetails } }, 'Property'); addToast(`${d.name} marked as Vacant`, { type: 'success' }); }} className="h-8 px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-400 whitespace-nowrap" aria-label="Mark as Vacant" title="Mark as Vacant">
                                                                                    <Eye className="w-3.5 h-3.5" /> Vacant
                                                                                </button>
                                                                            )}
                                                                            {uStatus === 'Vacant' && (
                                                                                <button onClick={(e) => { e.stopPropagation(); const full = units.find((u: Property) => u.id === unit.id) || unit; updateItem('properties', { ...full, status: 'Occupied' }, 'Property'); addToast(`${d.name} marked as Occupied`, { type: 'success' }); }} className="h-8 px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-green-700 dark:text-green-400 whitespace-nowrap" aria-label="Mark as Occupied" title="Mark as Occupied">
                                                                                    <CheckCircleIcon className="w-3.5 h-3.5" /> Occupied
                                                                                </button>
                                                                            )}
                                                                            <button onClick={(e) => { e.stopPropagation(); handleRemoveUnit(unit, d); }} className="h-8 px-3 py-1.5 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-rose-600 dark:text-rose-400 whitespace-nowrap" aria-label="Remove Unit" title="Remove Unit">
                                                                                <Trash2 className="w-3.5 h-3.5" /> Remove
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                );
                            })()}
                        </div>
                    );
                })()}

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
                                const allRent = units.reduce((sum: number, u: Property) => {
                                    const rd = u.rentalDetails || {};
                                    const rent = Number((rd as any).rentAmount || 0);
                                    return sum + rent;
                                }, 0);
                                const allServiceCharge = units.reduce((sum: number, u: Property) => {
                                    const rd = u.rentalDetails || {};
                                    const sc = Number((rd as any).serviceChargeAmount || (rd as any).serviceCharge || 0);
                                    return sum + sc;
                                }, 0);
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
                                return (
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
                                        <StatCard
                                            title="SERVICE CHARGES"
                                            value={formatNairaCompact(allServiceCharge)}
                                            tooltipText={formatNairaFull(allServiceCharge)}
                                            icon={<Receipt />}
                                            colorClass="bg-amber-600"
                                        />
                                        <StatCard
                                            title="COLLECTION STATUS"
                                            value={collectionStatusText}
                                            tooltipText={collectionStatusText}
                                            scrollOnOverflow={true}
                                            icon={<CheckCircleIcon />}
                                            colorClass={unpaidCount > 0 ? 'bg-orange-600' : partialCount > 0 ? 'bg-amber-600' : 'bg-green-600'}
                                        />
                                    </>
                                );
                            })()}
                        </div>

                        {/* Revenue Breakdown by Unit */}
                        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-slate-200 dark:border-zinc-700 overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 dark:border-zinc-700 flex items-center justify-between">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white">Revenue Breakdown by Unit</h3>
                                <button onClick={() => navigateTo('atriumEngine')} className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                                    Full Revenue Monitor <span>&rarr;</span>
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-zinc-900/50">
                                        <tr>
                                            <th className="text-left px-4 py-2.5 text-2xs font-black text-slate-400 uppercase tracking-widest">Unit</th>
                                            <th className="text-left px-4 py-2.5 text-2xs font-black text-slate-400 uppercase tracking-widest">Tenant</th>
                                            <th className="text-right px-4 py-2.5 text-2xs font-black text-slate-400 uppercase tracking-widest">Rent</th>
                                            <th className="text-right px-4 py-2.5 text-2xs font-black text-slate-400 uppercase tracking-widest">Service Charge</th>
                                            <th className="text-center px-4 py-2.5 text-2xs font-black text-slate-400 uppercase tracking-widest">SC Status</th>
                                            <th className="text-right px-4 py-2.5 text-2xs font-black text-slate-400 uppercase tracking-widest">Outstanding</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-700/50">
                                        {units.map((unit: Property) => {
                                            const d = getUnitDisplay(unit);
                                            const rd = (unit.rentalDetails || {}) as any;
                                            const scAmount = d.serviceChargeAmount || Number(rd.serviceCharge || 0);
                                            const scStatus = d.serviceChargeStatus || rd.serviceChargeStatus || '';
                                            const outstanding = d.outstandingServiceChargeBalance || rd.outstandingServiceChargeBalance || 0;
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
                                                    <td className="px-4 py-2.5 font-semibold text-slate-800 dark:text-white">{d.name}</td>
                                                    <td className="px-4 py-2.5 text-slate-600 dark:text-zinc-300">{d.tenantName || '—'}</td>
                                                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800 dark:text-white">₦{d.rentAmount.toLocaleString()}</td>
                                                    <td className="px-4 py-2.5 text-right font-semibold text-slate-800 dark:text-white">{scAmount > 0 ? `₦${scAmount.toLocaleString()}` : '—'}</td>
                                                    <td className="px-4 py-2.5 text-center">
                                                        {isPaidFully && <span className="inline-flex items-center gap-0.5 text-3xs font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"><CheckCircleIcon className="w-3 h-3" /> Paid</span>}
                                                        {isPartial && <span className="inline-flex items-center gap-0.5 text-3xs font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Partial</span>}
                                                        {isOutstanding && <span className="inline-flex items-center gap-0.5 text-3xs font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Outstanding</span>}
                                                        {!isPaidFully && !isPartial && !isOutstanding && <span className="text-2xs text-slate-400">—</span>}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right">
                                                        {isPartial && outstanding > 0 ? <span className="text-xs font-bold text-red-600 dark:text-red-400">₦{outstanding.toLocaleString()}</span> : <span className="text-2xs text-slate-400">—</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Link to Full Revenue Monitor — compact */}
                        <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-lg px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <span className="text-sm font-bold text-slate-700 dark:text-zinc-200">Firm-wide Revenue Monitor</span>
                            </div>
                            <button onClick={() => navigateTo('atriumEngine')} className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors">
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
                                value={<><NairaSymbol />{formatNaira(isSale ? (property.saleDetails?.targetPrice || property.value || 0) : (allPropertyLedgerEntries.filter(r => r && r.status === 'cleared').reduce((sum, r) => sum + (r.amount || 0), 0) || 0))}</>}
                                icon={<Receipt />}
                                colorClass="bg-green-600"
                            />
                            {property.ownershipType !== 'owned' && !isSale && (
                                <StatCard
                                    title="Management Fees Earned"
                                    value={<><NairaSymbol />{formatNaira((allPropertyLedgerEntries.filter(r => r && r.status === 'cleared').reduce((sum, r) => sum + (r.amount || 0), 0) || 0) * (property.managementFeePercentage || 0) / 100)}</>}
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
                                        <button onClick={() => navigateTo('atriumEngine')} className="font-bold text-emerald-600 hover:underline">Revenue Monitor</button>.
                                    </p>

                                    {propertyLedgerEntries.length > 0 && (
                                        <div className="bg-white/60 dark:bg-black/20 rounded-lg border border-emerald-200 dark:border-emerald-900/50 overflow-hidden">
                                            <div className="px-4 py-2 bg-emerald-100/50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-900/50 flex justify-between items-center">
                                                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Recent Ledger</span>
                                                <button onClick={() => navigateTo('atriumEngine')} className="text-2xs font-bold text-emerald-600 hover:text-emerald-700">View All &rarr;</button>
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
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 font-bold uppercase text-xs">
                                            <tr>
                                                <th className="px-4 py-3">Invoice #</th>
                                                <th className="px-4 py-3">Date</th>
                                                <th className="px-4 py-3">Status</th>
                                                <th className="px-4 py-3">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-700">
                                            {propertyInvoices.map(inv => (
                                                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer" onClick={() => navigateTo('invoiceDetail', inv.id)}>
                                                    <td className="px-4 py-3 font-mono font-medium text-primary-600">{inv.invoiceNumber}</td>
                                                    <td className="px-4 py-3 text-slate-600 dark:text-zinc-300">{inv.issueDate}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${inv.status === InvoiceStatus.Paid ? 'bg-green-100 text-green-700' : inv.status === InvoiceStatus.Overdue ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                                            {inv.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white"><NairaSymbol />{formatNaira(inv.total_amount || inv.subTotal)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
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

            {/* Compose Modal */}
            {showCompose && coreState.firmDetails?.id && (
                <ComposeModal
                    firmId={coreState.firmDetails.id}
                    prefill={composePrefill}
                    onClose={() => { setShowCompose(false); setComposePrefill(undefined); }}
                    onToast={(msg) => addToast(msg, { type: msg.includes('Error') || msg.includes('Failed') || msg.includes('requires') ? 'error' : 'success' })}
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
        <span className="text-primary-500 opacity-0 group-hover:opacity-100 transition-opacity">&rarr;</span>
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
    const [showForm, setShowForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newBody, setNewBody] = useState('');
    const [newPriority, setNewPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
    const [newPinned, setNewPinned] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Fetch notices scoped to this property
    const notices = useQuery(
        api.portals.getAllNotices,
        firmId ? { firmId, propertyId } : 'skip'
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
                        <div key={i} className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-5 animate-pulse">
                            <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-3/4 mb-3" />
                            <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-full mb-2" />
                            <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-2/3" />
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
                                                        await archiveNotice({ noticeId: notice._id });
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
                                            await restoreNotice({ noticeId: notice._id });
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
