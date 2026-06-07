
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Property, Contact, ModalType, MatterStatus, InvoiceStatus, BillingModel } from '../../types';
import { OfficeBuildingIcon, EditIcon, DocumentIcon, CalendarIcon, CheckCircleIcon, PlusIcon, MinusIcon, GavelIconLarge, CalculatorIcon, ZapIcon, LockClosedIcon, SearchIcon, CurrencyDollarIcon, BanknotesIcon, MattersIcon, CogIcon, XIcon } from '../../constants';
import { formatNaira } from '../../utils/formatting';
import NairaSymbol from '../NairaSymbol';
import { ClipboardList, Home, Folder, Megaphone, FileText, Wrench, Scale, Eye, Radio, Receipt, Wallet, LogOut, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useUI } from '../../contexts/UIContext';
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DocumentsTab } from './DocumentsTab';
import { useMatterState } from '../../contexts/MatterContext';
import { useFinanceState } from '../../contexts/FinanceContext';
import { useDocumentState } from '../../contexts/DocumentContext';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import StatCard from '../StatCard';
import PropertyTrackingView from './PropertyTrackingView';
import { useAuth } from '../../contexts/AuthContext';
import { useProduct } from '../../contexts/ProductContext';
import ErrorBoundary from '../ErrorBoundary';
import { useAloa } from '../../contexts/AloaProvider';

import { getUnitDisplay } from '../../utils/propertyPayload';
import { draftSessionKey, loadDraftSession } from '../../utils/draftSession';
const DetailItem: React.FC<{ label: string; value: React.ReactNode; subText?: string }> = ({ label, value, subText }) => (
    <div className="w-full">
        <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">{label}</p>
        <div className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
            {value}
        </div>
        {subText && <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 leading-tight">{subText}</p>}
    </div>
);

type PropertyTab = 'summary' | 'units' | 'tracking' | 'docs';
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
    const { openEditor, navigateTo, addToast, openModal, selectedId: propertyId } = useUI();
    const { isProperty } = useProduct();
    const { matterState } = useMatterState();
    const { financeState } = useFinanceState();
    const { documentState } = useDocumentState();
    const { coreState, isDataLoaded } = useCoreState();
    const { updateItem, onAddMatter, handleDeleteProperty, addUnit, removeUnit } = useDataActions() as any;
    const { currentUser } = useAuth();
    const { togglePanel } = useAloa();
    const [activeTab, setActiveTab] = useState<PropertyTab>('summary');
    const [openUnitMenuId, setOpenUnitMenuId] = useState<string | null>(null);
    const [openUnitMenuPos, setOpenUnitMenuPos] = useState<{ top: number; right: number } | null>(null);
    const unitMenuRef = useRef<HTMLDivElement>(null);
    const [selectedUnit, setSelectedUnit] = useState<Property | null>(null);
    const [showAddUnitForm, setShowAddUnitForm] = useState(false);
    const [newUnitName, setNewUnitName] = useState('');
    const [newUnitType, setNewUnitType] = useState<'Residential' | 'Commercial'>('Residential');

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
                const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
                const addr = normalize(selectedProperty.address);
                const standaloneUnits = (coreState.properties || []).filter(p => normalize(p.address) === addr);
                const legacyUnits: Property[] = [];
                (matterState.contacts || []).forEach(c => {
                    (c.properties || []).forEach(p => {
                        if (normalize(p.address) === addr && !standaloneUnits.some(su => su.id === p.id)) {
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
            }
        }
        return { property: selectedProperty, owner: propertyOwner, allUnits: units };
    }, [matterState.contacts, coreState.properties, propertyId, onDemandProperty]);

    // Feature Checks — computed unconditionally so hooks always run in same order
    const isLeased = property?.category === 'Tenanted Property';
    const isSale = property?.category === 'Property For Sale';
    const hasMultipleUnits = allUnits.length > 1 || ((property as any)?.units?.length > 0);
    const isDisputed = property?.category === 'Disputed Property';

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
        if (isProperty && property) {
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
    }, [documentState.documents, linkedMatters, isProperty, property, property?.id, property?.address]);

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
        const rentAmount = display?.rentAmount ?? property.rentalDetails?.rentAmount;
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
        const rentAmount = display?.rentAmount ?? property.rentalDetails?.rentAmount;
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
            openEditor(content, {
                draftTitle: `${template.name} - ${display?.name || addressPart}`,
                matterId: primaryMatter?.id,
                openedByAloa: false,
                disableAutoDraft: true,
            });
        }, 300);
    };

    const handleInitializeMatter = async (unit?: any, force = false) => {
        // If matters already exist, ask for confirmation
        const existingCount = unit 
            ? matterState.matters.filter(m => m.specialtyData?.realEstate?.propertyId === property.id && m.title.includes(unit.name)).length
            : linkedMatters.length;

        if (existingCount > 0 && !force) {
            openModal('deleteConfirmation', property.id, {
                title: "Matter Already Exists",
                message: `There ${existingCount === 1 ? 'is' : 'are'} already ${existingCount} active matter(s) for this ${unit ? 'unit' : 'property'}. Do you want to initiate a new, separate matter?`,
                onConfirm: () => handleInitializeMatter(unit, true),
                confirmText: "Initialize New Matter",
                cancelText: "View Existing"
            });
            return;
        }

        // Prepare strict context for the new matter
        const addressPart = property.address.split(',')[0];
        const unitName = unit ? unit.name : (property.rentalDetails?.unitName || property.description || '');

        const matterTitle = isSale
            ? `Sale: ${addressPart} ${unitName ? `(${unitName})` : ''}`
            : `Tenancy: ${addressPart} ${unitName ? `(${unitName})` : ''}`;

        const matterType = 'Real Estate';
        const subCategory = isSale ? 'Acquisition' : 'Lease/Tenancy';

        const propValue = unit ? unit.value : (property.value || (property.saleDetails?.targetPrice) || 0);
        const rentAmount = unit ? unit.rentAmount : (property.rentalDetails?.rentAmount || 0);
        const defaultFee = isSale ? propValue * 0.1 : rentAmount * 0.1;

        const newMatterData: any = {
            title: matterTitle,
            clientId: owner?.id,
            type: matterType,
            subCategory,
            description: `Managed Property: ${property.address} ${unitName ? `[${unitName}]` : ''}`,
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
                    transactionType: isSale ? 'Sale' : 'Lease'
                }
            }
        };

        try {
            addToast('Initializing property matter...', { type: 'info' });
            const result = await onAddMatter(newMatterData, null);
            if (result && result.id) {
                addToast('Matter initialized successfully', { type: 'success' });
                navigateTo('matterDetail', result.id);
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

    

    return (
        <div className="flex flex-col bg-slate-50 dark:bg-zinc-900 h-full">
            {/* Header */}
            <div className="flex-shrink-0 border-b border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 z-20 shadow-sm">
                <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 flex justify-between items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                    <button onClick={onGoBack} className="text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors text-xs font-bold uppercase flex items-center gap-1 flex-shrink-0">
                        &larr; <span className="hidden xs:inline">Back</span>
                    </button>
                    <div className="h-6 w-px bg-slate-200 dark:bg-zinc-700 flex-shrink-0"></div>
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className={`p-1.5 rounded-lg flex-shrink-0 ${isLeased ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            <OfficeBuildingIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm sm:text-lg font-bold text-slate-900 dark:text-white truncate leading-none max-w-[160px] sm:max-w-md">{property.address}</h2>
                                {property.rentCollectionMode === 'Management Only (No Rent)' && (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[8px] font-black text-slate-400 uppercase tracking-widest border border-slate-200 dark:border-zinc-700 hidden sm:inline flex-shrink-0">
                                        Mgmt Only
                                    </span>
                                )}
                            </div>
                            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-zinc-400 mt-0.5 flex gap-1 sm:gap-2 truncate">
                                {property.propertyType || 'Property'} • {owner?.name}
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
                    <nav className="-mb-px flex space-x-4 sm:space-x-6 overflow-x-auto no-scrollbar whitespace-nowrap">
                        {([
                            { id: 'summary', label: <><ClipboardList className="w-4 h-4 inline mr-1" /> Summary</> },
                            ...((isLeased || hasMultipleUnits) ? [{ id: 'units', label: <><Home className="w-4 h-4 inline mr-1" /> Units</> }] : []),
                            { id: 'tracking', label: <><Radio className="w-4 h-4 inline mr-1" /> Activity & Tracking</> },
                            { id: 'docs', label: <><Folder className="w-4 h-4 inline mr-1" /> Docs & Financials</> },
                        ] as { id: PropertyTab; label: React.ReactNode }[]).map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${
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

            <div className="flex-grow overflow-y-auto scroll-smooth-ios custom-scrollbar">
                <div className="max-w-7xl mx-auto p-3 sm:p-8 pb-24 md:pb-8 min-w-0">

                {activeTab === 'summary' && (
                    <div className="space-y-8 animate-fade-in">
                        
                        <button
                            onClick={() => togglePanel()}
                            className="w-full flex items-center gap-3 px-4 py-3 mb-2 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors group"
                        >
                            <Sparkles className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex-1 text-left">
                                Ask ARIA a question about this property...
                            </span>
                            <span className="text-emerald-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity">&#8594;</span>
                        </button>

                        {/* 1. Core Information & Quick Actions Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Identity Card */}
                            <div className={`${(isLeased || hasMultipleUnits) ? 'lg:col-span-3' : 'lg:col-span-2'} bg-white dark:bg-zinc-800 rounded-xl shadow-sm p-4 sm:p-6 border border-slate-200 dark:border-zinc-700`}>
                                <div className="flex justify-between items-start border-b border-slate-100 dark:border-zinc-700 pb-2 mb-4">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-sm font-bold text-slate-800 dark:text-white">Property Information</h3>
                                        {allUnits.length > 1 && (
                                            <button 
                                                onClick={() => setActiveTab('units')}
                                                className="px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-[10px] font-black text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800 hover:bg-primary-100 transition-all flex items-center gap-1"
                                            >
                                                {allUnits.length} Units Found <span className="opacity-50">&rarr;</span>
                                            </button>
                                        )}
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${property.status === 'Occupied' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
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
                                            label={isLeased ? "Rent Amount" : (isSale ? "Target Price" : "Valuation")}
                                            value={<><NairaSymbol />{formatNaira((isLeased ? property.rentalDetails?.rentAmount : (isSale ? property.saleDetails?.targetPrice : property.value)) || 0)} <span className="text-xs text-slate-400 font-normal">{isLeased ? '/year' : ''}</span></>}
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
                                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm p-5 border border-slate-200 dark:border-zinc-700 flex flex-col">
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
                                                    <p className="text-[10px] text-green-700 dark:text-green-300 font-bold mb-1">{isProperty ? 'Management File Active' : 'Matter Active'} ({linkedMatters.length})</p>
                                                    {linkedMatters.map(m => (
                                                        <p key={m.id} onClick={() => navigateTo('matterDetail', m.id)} className="text-xs text-slate-600 dark:text-zinc-400 truncate hover:text-primary-600 cursor-pointer mb-1 last:mb-0">
                                                            • {m.title}
                                                        </p>
                                                    ))}
                                                </div>
                                                <button 
                                                    onClick={() => handleInitializeMatter()}
                                                    className="w-full py-1 text-[9px] font-black uppercase text-slate-400 hover:text-primary-600 transition-colors tracking-tighter"
                                                >
                                                    + New {isProperty ? 'File' : 'Matter'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 2. Automation & Reminders */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm p-5 border border-slate-200 dark:border-zinc-700">
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                    <ZapIcon className="w-4 h-4 text-amber-500" /> Active Automations
                                </h3>
                                <div className="space-y-3">
                                    {isLeased && property.automationSettings?.remindLeaseExpiry ? (
                                        <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800">
                                            <CheckCircleIcon className="w-4 h-4 text-green-600" />
                                            <div className="flex-grow">
                                                <p className="text-xs font-bold text-green-800 dark:text-green-200">Lease Expiry Reminder</p>
                                                <p className="text-[10px] text-green-700 dark:text-green-300">System will alert 90 days before lease end.</p>
                                            </div>
                                        </div>
                                    ) : isLeased ? (
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-700/30 rounded-lg border border-slate-100 dark:border-zinc-700 opacity-60">
                                            <div className="w-4 h-4 border-2 border-slate-300 rounded-full"></div>
                                            <p className="text-xs font-medium text-slate-500">Lease Expiry Reminder Disabled</p>
                                        </div>
                                    ) : isSale ? (
                                        <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                            <ZapIcon className="w-4 h-4 text-blue-600" />
                                            <div className="flex-grow">
                                                <p className="text-xs font-bold text-blue-800 dark:text-blue-200">Sales Lead Tracking</p>
                                                <p className="text-[10px] text-blue-700 dark:text-blue-300">Auto-tracking inquiries for this listing.</p>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                            {linkedMatters.length > 0 && (
                                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm p-5 border border-slate-200 dark:border-zinc-700">
                                    <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4">{isProperty ? 'Portfolio Context' : 'Legal Context'}</h3>
                                    <div className="space-y-3">
                                        {linkedMatters.map(m => (
                                            <div key={m.id} className="p-3 bg-slate-50 dark:bg-zinc-700/30 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors" onClick={() => navigateTo('matterDetail', m.id)}>
                                                <p className="text-xs font-bold text-primary-600 mb-1">Active {isProperty ? 'Management File' : 'Matter'}</p>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{m.title}</p>
                                                <p className="text-xs text-slate-500 mt-1">{m.stage}</p>
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

                    // Add legacy units if they aren't already in units (by ID or name)
                    legacyUnits.forEach((lu: any) => {
                        if (!units.some(u => u.id === lu.id || (u as any).name === lu.name)) {
                            units.push(lu);
                        }
                    });
                    const isEmbeddedUnit = (unit: any) => legacyUnits.some((lu: any) => lu.id === unit.id);
                    const statusColors: Record<string, string> = {
                        'Occupied': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                        'Vacant': 'bg-slate-100 text-slate-700 dark:bg-zinc-700 dark:text-zinc-300',
                        'Maintenance': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
                    };
                    const occupiedCount = units.filter(u => u?.status === 'Occupied').length;
                    const vacantCount = units.filter(u => u?.status === 'Vacant').length;
                    const maintenanceCount = units.filter(u => u?.status === 'Maintenance').length;

                    const handleAddUnitSubmit = async () => {
                        if (!newUnitName.trim()) { addToast('Unit name is required', { type: 'error' }); return; }
                        const newUnit = {
                            id: `unit-${Date.now()}`,
                            unitName: newUnitName.trim(),
                            name: newUnitName.trim(),
                            propertyType: newUnitType,
                            status: 'Vacant',
                            rentAmount: 0,
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
                            message: `Remove "${d.name}" from this property? This action cannot be undone.`,
                            onConfirm: async () => {
                                try {
                                    if (isEmbeddedUnit(unit)) {
                                        await removeUnit(property.id, unit.id);
                                        addToast(`Unit "${d.name}" removed.`, { type: 'success' });
                                    } else {
                                        await handleDeleteProperty(unit.id, d.name, true);
                                        addToast(`Unit "${d.name}" removed.`, { type: 'success' });
                                    }
                                    setSelectedUnit(null);
                                } catch (e) { addToast('Failed to remove unit.', { type: 'error' }); }
                            },
                            confirmText: 'Remove Unit',
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
                                    onClick={() => { setShowAddUnitForm(v => !v); setSelectedUnit(null); }}
                                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> Add Unit
                                </button>
                            </div>

                            {/* Add Unit inline form */}
                            {showAddUnitForm && (
                                <div className="bg-white dark:bg-zinc-800 rounded-xl border border-primary-200 dark:border-primary-700 shadow-sm p-5">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                                        <Plus className="w-4 h-4 text-primary-500" /> Add New Unit
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Unit Name / Number <span className="text-rose-500">*</span></label>
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
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Unit Type</label>
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

                            {/* Unit detail panel — shows unit-specific info only, replaces the old "open property form" behaviour */}
                            {selectedUnit && (() => {
                                const sd = getUnitDisplay(selectedUnit);
                                return (
                                    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-primary-200 dark:border-primary-700 shadow-md p-5">
                                        <div className="flex items-start justify-between mb-4">
                                            <div>
                                                <p className="text-[10px] font-bold text-primary-500 uppercase tracking-widest mb-0.5">Unit Detail</p>
                                                <h4 className="text-lg font-bold text-slate-900 dark:text-white">{sd.name}</h4>
                                                {sd.floor && <p className="text-xs text-slate-400">Floor {sd.floor}</p>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${statusColors[String(selectedUnit.status || 'Vacant')] || 'bg-slate-100 text-slate-600'}`}>
                                                    {String(selectedUnit.status || 'Vacant')}
                                                </span>
                                                <button onClick={() => setSelectedUnit(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
                                            {sd.tenantName && <DetailItem label="Tenant" value={sd.tenantName} />}
                                            {property.rentCollectionMode !== 'Management Only (No Rent)' && sd.rentAmount > 0 && (
                                                <DetailItem label="Rent" value={<>₦{sd.rentAmount.toLocaleString()} <span className="text-xs text-slate-400 font-normal">/{sd.rentFrequency === 'Monthly' ? 'mo' : 'yr'}</span></>} />
                                            )}
                                            {sd.leaseEnd && <DetailItem label="Lease End" value={(() => { try { return new Date(sd.leaseEnd).toLocaleDateString('en-GB'); } catch { return sd.leaseEnd; } })()} />}
                                            {(selectedUnit as any).rentalDetails?.tenantPhone && <DetailItem label="Tenant Phone" value={(selectedUnit as any).rentalDetails.tenantPhone} />}
                                            {(selectedUnit as any).rentalDetails?.tenantEmail && <DetailItem label="Tenant Email" value={(selectedUnit as any).rentalDetails.tenantEmail} />}
                                            {((selectedUnit as any).serviceCharge || (selectedUnit as any).rentalDetails?.serviceCharge || 0) > 0 && <DetailItem label="Service Charge" value={<>₦{Number((selectedUnit as any).serviceCharge || (selectedUnit as any).rentalDetails?.serviceCharge || 0).toLocaleString()}</>} />}
                                            {((selectedUnit as any).legalFee || (selectedUnit as any).rentalDetails?.legalFee || 0) > 0 && <DetailItem label="Legal Fee" value={<>₦{Number((selectedUnit as any).legalFee || (selectedUnit as any).rentalDetails?.legalFee || 0).toLocaleString()}</>} />}
                                            {((selectedUnit as any).agencyFee || (selectedUnit as any).rentalDetails?.agencyFee || 0) > 0 && <DetailItem label="Agency Fee" value={<>₦{Number((selectedUnit as any).agencyFee || (selectedUnit as any).rentalDetails?.agencyFee || 0).toLocaleString()}</>} />}
                                            {((selectedUnit as any).cautionDeposit || (selectedUnit as any).rentalDetails?.cautionDeposit || 0) > 0 && <DetailItem label="Caution Deposit" value={<>₦{Number((selectedUnit as any).cautionDeposit || (selectedUnit as any).rentalDetails?.cautionDeposit || 0).toLocaleString()}</>} />}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100 dark:border-zinc-700">
                                            <button
                                                onClick={() => openModal('editProperty', isEmbeddedUnit(selectedUnit) ? property.id : selectedUnit.id, { contactId: owner?.id, activeUnitId: selectedUnit.id })}
                                                className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors"
                                            >
                                                <EditIcon className="w-3.5 h-3.5" /> Edit Unit
                                            </button>
                                            {selectedUnit.status === 'Occupied' && property.rentCollectionMode !== 'Management Only (No Rent)' && (
                                                <button onClick={() => openModal('collectRent', property.id, { unitName: sd.name, tenantName: sd.tenantName, rentAmount: sd.rentAmount, unitId: selectedUnit.id })} className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors">
                                                    <Receipt className="w-3.5 h-3.5" /> Record Payment
                                                </button>
                                            )}
                                            <button onClick={() => handleInitializeMatter(selectedUnit)} className="px-3 py-1.5 bg-slate-100 dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-300 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors">
                                                <Scale className="w-3.5 h-3.5" /> {isProperty ? 'Mgmt File' : 'Legal File'}
                                            </button>
                                            <button onClick={() => handleRemoveUnit(selectedUnit, sd)} className="px-3 py-1.5 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors ml-auto">
                                                <Trash2 className="w-3.5 h-3.5" /> Remove Unit
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Unit Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {units.map((unit: Property) => {
                                    const d = getUnitDisplay(unit);
                                    const isFloor = d.name.toLowerCase().includes('floor');
                                    const menuOpen = openUnitMenuId === unit.id;
                                    const isSelected = selectedUnit?.id === unit.id;
                                    return (
                                    <div
                                        key={unit.id}
                                        onClick={() => { setSelectedUnit(isSelected ? null : unit); setShowAddUnitForm(false); }}
                                        className={`bg-white dark:bg-zinc-800 rounded-xl border shadow-sm p-4 hover:shadow-md transition-all cursor-pointer ${isSelected ? 'border-primary-400 dark:border-primary-600 ring-2 ring-primary-100 dark:ring-primary-900/50' : 'border-slate-200 dark:border-zinc-700 hover:border-primary-300 dark:hover:border-primary-700'}`}
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="min-w-0 flex-1 pr-2">
                                                <p className="font-bold text-slate-900 dark:text-white text-sm truncate">{d.name}</p>
                                                <p className="text-xs text-slate-400 dark:text-zinc-500">Floor {d.floor}</p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide flex-shrink-0 ${statusColors[String(unit.status || 'Vacant')] || 'bg-slate-100 text-slate-600'}`}>
                                                {String(unit.status || 'Vacant')}
                                            </span>
                                        </div>
                                        <div className="space-y-1.5 text-xs">
                                            {d.tenantName && (
                                                <p className="text-slate-700 dark:text-zinc-200">
                                                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] mr-1">Tenant</span>{d.tenantName}
                                                </p>
                                            )}
                                            {property.rentCollectionMode !== 'Management Only (No Rent)' && d.rentAmount > 0 && (
                                                <p className="text-slate-700 dark:text-zinc-200">
                                                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] mr-1">Rent</span>
                                                    ₦{d.rentAmount.toLocaleString()}<span className="text-slate-400">/{d.rentFrequency === 'Monthly' ? 'mo' : 'yr'}</span>
                                                </p>
                                            )}
                                            {(unit.serviceCharge || unit.rentalDetails?.serviceCharge) > 0 && (
                                                <p className="text-slate-700 dark:text-zinc-200">
                                                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] mr-1">Service</span>
                                                    ₦{Number(unit.serviceCharge || unit.rentalDetails?.serviceCharge || 0).toLocaleString()}
                                                </p>
                                            )}
                                            {(unit.legalFee || unit.rentalDetails?.legalFee) > 0 && (
                                                <p className="text-slate-700 dark:text-zinc-200">
                                                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] mr-1">Legal</span>
                                                    ₦{Number(unit.legalFee || unit.rentalDetails?.legalFee || 0).toLocaleString()}
                                                </p>
                                            )}
                                            {(unit.agencyFee || unit.rentalDetails?.agencyFee) > 0 && (
                                                <p className="text-slate-700 dark:text-zinc-200">
                                                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] mr-1">Agency</span>
                                                    ₦{Number(unit.agencyFee || unit.rentalDetails?.agencyFee || 0).toLocaleString()}
                                                </p>
                                            )}
                                            {(unit.cautionDeposit || unit.rentalDetails?.cautionDeposit) > 0 && (
                                                <p className="text-slate-700 dark:text-zinc-200">
                                                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] mr-1">Caution</span>
                                                    ₦{Number(unit.cautionDeposit || unit.rentalDetails?.cautionDeposit || 0).toLocaleString()}
                                                </p>
                                            )}
                                            {d.leaseEnd && (
                                                <p className="text-slate-500 dark:text-zinc-400">
                                                    <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] mr-1">Lease end</span>
                                                    {(() => {
                                                        try {
                                                            return new Date(d.leaseEnd).toLocaleDateString('en-GB');
                                                        } catch {
                                                            return '—';
                                                        }
                                                    })()}
                                                </p>
                                            )}
                                        </div>
                                        <div className="mt-4 flex items-center justify-end border-t border-slate-50 dark:border-zinc-700/50 pt-3" ref={menuOpen ? unitMenuRef : undefined}>
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (menuOpen) {
                                                            setOpenUnitMenuId(null);
                                                            setOpenUnitMenuPos(null);
                                                        } else {
                                                            const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                                            const estimatedMenuHeight = 340;
                                                            const top = Math.min(rect.bottom + 4, window.innerHeight - estimatedMenuHeight - 8);
                                                            setOpenUnitMenuPos({ top: Math.max(top, 8), right: window.innerWidth - rect.right });
                                                            setOpenUnitMenuId(unit.id);
                                                        }
                                                    }}
                                                    className="min-h-[44px] px-3 py-2 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition-all text-slate-600 dark:text-zinc-300 hover:text-primary-600 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
                                                    aria-expanded={menuOpen}
                                                >
                                                    Actions
                                                    <CogIcon className="w-4 h-4" />
                                                </button>
                                                
                                                {openUnitMenuPos && (
                                                <div
                                                    style={{ top: openUnitMenuPos.top, right: openUnitMenuPos.right }}
                                                    className="fixed w-52 sm:w-56 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-xl z-[250] flex flex-col overflow-hidden py-1 max-h-[70vh] overflow-y-auto max-w-[calc(100vw-2rem)]"
                                                >
                                                    <div className="px-3 py-1.5 border-b border-slate-100 dark:border-zinc-700/50 mb-1">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{d.name} — actions</p>
                                                    </div>
                                                    
                                                    {!isFloor ? (
                                                        <>
                                                            {unit.status === 'Occupied' ? (
                                                                <>
                                                                    {property.rentCollectionMode !== 'Management Only (No Rent)' && (
                                                                        <>
                                                                            <button onClick={() => { setOpenUnitMenuId(null); openModal('collectRent', property.id, { unitName: d.name, tenantName: d.tenantName, rentAmount: d.rentAmount, unitId: unit.id }); }} className="px-3 py-2.5 text-[10px] font-bold text-slate-700 dark:text-zinc-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 text-left flex items-center gap-2 w-full">
                                                                                <Receipt className="w-3.5 h-3.5 shrink-0" /> Record payment & receipt
                                                                            </button>
                                                                            <button onClick={() => { setOpenUnitMenuId(null); openModal('recordRentPayment', null, { unitId: unit.id, unitName: d.name, tenantName: d.tenantName, rentAmount: d.rentAmount, firmId: coreState.firmDetails?.id }); }} className="px-3 py-2.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-left flex items-center gap-2 w-full">
                                                                                <Wallet className="w-3.5 h-3.5 shrink-0" /> Ledger-only entry
                                                                            </button>
                                                                            <button onClick={() => { setOpenUnitMenuId(null); handleDraftAction('Rent Demand Notice', 'Demand', unit); }} className="px-3 py-2.5 text-[10px] font-bold text-slate-700 dark:text-zinc-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-left flex items-center gap-2 w-full">
                                                                                <Megaphone className="w-3.5 h-3.5 shrink-0" /> Rent Demand
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    <button onClick={() => { setOpenUnitMenuId(null); handleDraftAction('Notice to Quit', 'Quit', unit); }} className="px-3 py-2.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-left flex items-center gap-2 w-full">
                                                                        <LogOut className="w-3.5 h-3.5 shrink-0" /> Notice to Quit
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button onClick={() => { const full = units.find((u: Property) => u.id === unit.id) || unit; updateItem('properties', { ...full, status: 'Listed' }, 'Property'); addToast('Unit ' + d.name + ' listed to market', { type: 'success' }); setOpenUnitMenuId(null); }} className="px-3 py-2.5 text-[10px] font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 text-left flex items-center gap-2 w-full">
                                                                        <Megaphone className="w-3.5 h-3.5 shrink-0" /> List Unit
                                                                    </button>
                                                                    <button onClick={() => { addToast('Viewing recorded for ' + d.name, { type: 'success' }); setOpenUnitMenuId(null); }} className="px-3 py-2.5 text-[10px] font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 text-left flex items-center gap-2 w-full">
                                                                        <Eye className="w-3.5 h-3.5 shrink-0" /> Record Viewing
                                                                    </button>
                                                                </>
                                                            )}
                                                            
                                                            <button onClick={() => { const full = units.find((u: Property) => u.id === unit.id) || unit; updateItem('properties', { ...full, status: 'Maintenance' }, 'Property'); addToast('Unit marked for maintenance: ' + d.name, { type: 'success' }); setOpenUnitMenuId(null); }} className="px-3 py-2.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-left flex items-center gap-2 border-t border-slate-100 dark:border-zinc-700/50 w-full">
                                                                <Wrench className="w-3.5 h-3.5 shrink-0" /> Log Maintenance
                                                            </button>
                                                            
                                                            <button onClick={() => { setOpenUnitMenuId(null); handleInitializeMatter(unit); }} className="px-3 py-2.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left flex items-center gap-2 w-full">
                                                                <Scale className="w-3.5 h-3.5 shrink-0" /> Initialize {isProperty ? 'Management File' : 'Legal File'}
                                                            </button>

                                                            {property.rentCollectionMode !== 'Management Only (No Rent)' && coreState.documentTemplates && coreState.documentTemplates.length > 0 && (
                                                                <div className="mt-1 pt-1 border-t border-slate-100 dark:border-zinc-700/50">
                                                                    <p className="px-3 py-1 text-[8px] font-black text-slate-400 uppercase tracking-widest">Draft from Template</p>
                                                                    {coreState.documentTemplates.slice(0, 3).map((template: any) => (
                                                                        <button 
                                                                            key={template.id} 
                                                                            onClick={() => { setOpenUnitMenuId(null); handleApplyTemplate(template, unit); }} 
                                                                            className="px-3 py-2.5 text-[10px] font-bold text-slate-600 dark:text-zinc-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 text-left flex items-center gap-2 truncate w-full"
                                                                        >
                                                                            <FileText className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{template.name}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <button onClick={() => { addToast('Managing assets for ' + d.name, { type: 'info' }); setOpenUnitMenuId(null); }} className="px-3 py-2.5 text-[10px] font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-700 text-left flex items-center gap-2 w-full">
                                                                <Radio className="w-3.5 h-3.5 shrink-0" /> Manage Floor Assets
                                                            </button>
                                                            <button onClick={() => { setOpenUnitMenuId(null); handleInitializeMatter(unit); }} className="px-3 py-2.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left flex items-center gap-2 w-full">
                                                                <Scale className="w-3.5 h-3.5 shrink-0" /> Initialize Floor Legal File
                                                            </button>
                                                        </>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenUnitMenuId(null);
                                                            setOpenUnitMenuPos(null);
                                                            handleRemoveUnit(unit, d);
                                                        }}
                                                        className="px-3 py-2.5 text-[10px] font-bold text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 text-left flex items-center gap-2 border-t border-slate-100 dark:border-zinc-700/50 w-full"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5 shrink-0" /> Remove Unit
                                                    </button>
                                                </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );})}
                            </div>
                        </div>
                    );
                })()}

                {activeTab === 'tracking' && (
                    <PropertyTrackingView 
                        property={property} 
                        onUpdate={(updated) =>
                            updateItem(
                                'properties',
                                { ...updated, _id: (updated as { _id?: string })._id ?? property._id, id: updated.id ?? property.id },
                                'Property Updated'
                            )
                        } 
                    />
                )}

                {activeTab === 'docs' && (
                    <div className="space-y-6 animate-fade-in">
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                title={isSale ? "Target Sale Value" : "Collected YTD"}
                                value={<><NairaSymbol />{formatNaira(isSale ? (property.saleDetails?.targetPrice || property.value || 0) : (allPropertyLedgerEntries.filter(r => r && r.status === 'cleared').reduce((sum, r) => sum + (r.amount || 0), 0) || 0))}</>}
                                icon={<BanknotesIcon />}
                                colorClass="bg-green-600"
                            />
                            {property.ownershipType !== 'owned' && !isSale && (
                                <StatCard
                                    title="Management Fees Earned"
                                    value={<><NairaSymbol />{formatNaira((allPropertyLedgerEntries.filter(r => r && r.status === 'cleared').reduce((sum, r) => sum + (r.amount || 0), 0) || 0) * (property.managementFeePercentage || 0) / 100)}</>}
                                    icon={<BanknotesIcon />}
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

                        {/* Financial Reconciliation Explanation */}
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-6 flex items-start gap-4 shadow-sm">
                            <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                                <BanknotesIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-slate-900 dark:text-white mb-1">Financial Reconciliation</h4>
                                <p className="text-sm text-slate-600 dark:text-zinc-400 max-w-2xl leading-relaxed mb-4">
                                    All invoices and receipts issued for this property are automatically synchronized with the 
                                    <button onClick={() => navigateTo('atriumEngine')} className="font-bold text-emerald-600 hover:underline mx-1">Revenue Monitor</button>. 
                                    The monitor tracks payment discipline across your entire portfolio, ensuring that cleared income is reflected in your firm's aggregate cash flow.
                                </p>

                                {/* Mini Ledger Preview */}
                                {propertyLedgerEntries.length > 0 && (
                                    <div className="bg-white/60 dark:bg-black/20 rounded-xl border border-emerald-200 dark:border-emerald-900/50 overflow-hidden">
                                        <div className="px-4 py-2 bg-emerald-100/50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-900/50 flex justify-between items-center">
                                            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Recent Ledger Activity</span>
                                            <button onClick={() => navigateTo('atriumEngine')} className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700">View All &rarr;</button>
                                        </div>
                                        <div className="divide-y divide-emerald-100 dark:divide-emerald-900/30">
                                            {propertyLedgerEntries.map(entry => (
                                                <div key={entry._id} className="px-4 py-2.5 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${entry.status === 'cleared' ? 'bg-emerald-500' : entry.status === 'defaulted' ? 'bg-rose-500' : 'bg-amber-500'}`} />
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{entry.description || entry.type}</p>
                                                            <p className="text-[9px] text-slate-500">{new Date(entry.timestamp).toLocaleDateString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`text-sm font-bold ${entry.status === 'cleared' ? 'text-emerald-600 dark:text-emerald-400' : entry.status === 'defaulted' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                            ₦{entry.amount.toLocaleString('en-NG')}
                                                        </p>
                                                        <p className="text-[9px] uppercase font-bold text-slate-400">{entry.status}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Invoices List */}
                        <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 overflow-hidden">
                            <div className="p-4 border-b border-slate-200 dark:border-zinc-700">
                                <h4 className="font-bold text-sm text-slate-800 dark:text-white">Related Invoices</h4>
                            </div>
                            {propertyInvoices.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <DocumentIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p>No invoices found linked to this property or its matter.</p>
                                </div>
                            ) : (
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 font-bold uppercase text-xs">
                                        <tr>
                                            <th className="px-6 py-4">Invoice #</th>
                                            <th className="px-6 py-4">Date</th>
                                            <th className="px-6 py-4">Status</th>
                                            <th className="px-6 py-4">Amount</th>
                                            <th className="px-6 py-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-700">
                                        {propertyInvoices.map(inv => (
                                            <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer" onClick={() => navigateTo('invoiceDetail', inv.id)}>
                                                <td className="px-6 py-4 font-mono font-medium text-primary-600">{inv.invoiceNumber}</td>
                                                <td className="px-6 py-4 text-slate-600 dark:text-zinc-300">{inv.issueDate}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${inv.status === InvoiceStatus.Paid ? 'bg-green-100 text-green-700' :
                                                        inv.status === InvoiceStatus.Overdue ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                                        }`}>
                                                        {inv.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-slate-900 dark:text-white"><NairaSymbol />{formatNaira(inv.total_amount || inv.subTotal)}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <SearchIcon className="w-4 h-4 text-slate-400 hover:text-primary-600" />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'docs' && (
                    <div className="min-h-full animate-fade-in">
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
                            <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-zinc-800 rounded-2xl border border-dashed border-slate-300 dark:border-zinc-700">
                                <div className="p-4 bg-slate-100 dark:bg-zinc-900 rounded-full mb-4">
                                    <MattersIcon className="w-10 h-10 text-slate-400" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">No Linked Legal Matter</h3>
                                <p className="text-slate-500 max-w-md text-center mb-6">
                                    To manage legal documents for this property (Deeds, Tenancy Agreements, etc.), you must first initialize a Matter.
                                </p>
                                <button
                                    onClick={() => handleInitializeMatter()}
                                    className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold transition-all shadow-lg flex items-center gap-2"
                                >
                                    <PlusIcon className="w-5 h-5" /> Initialize Matter
                                </button>
                            </div>
                        )}
                    </div>
                )}
                </div>
            </div>
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


export default function PropertyDetailViewWrapper() {
    return (
        <ErrorBoundary>
            <PropertyDetailViewContent />
        </ErrorBoundary>
    );
}
