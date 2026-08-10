import React, { useState, useEffect, useRef } from 'react';
import { Contact, Property, FileDetails, PropertyStatus, PropertyCategory, ContactType } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataState } from '../../contexts/DataContext';
import { MapPinIcon, CurrencyDollarIcon, UserIcon, CalendarIcon, InfoIcon, XIcon, SaveIcon, SparklesIcon, ZapIcon, PlusIcon, TrashIcon, OfficeBuildingIcon, KeyIcon, GavelIconLarge, CalculatorIcon, CheckCircleIcon } from '../../constants';
import { Home as HomeIcon, Briefcase as BriefcaseIcon, ExternalLink as ExternalLinkIcon, Upload as UploadIcon } from 'lucide-react';
import { inputModern } from '../../utils/formStyles';
import NairaSymbol from '../NairaSymbol';
import { formatNumberWithCommas, parseFormattedNumber, normalizeAddress } from '../../utils/formatting';
import { useUI } from '../../contexts/UIContext';
import { useDataActions } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
    buildPropertyRecord,
    propertyExistsInDb,
    composeTenantName,
    type UnitRentalInput,
} from '../../utils/propertyPayload';
import { useConfirm } from '../ui/ConfirmDialog';
import { OnboardUnitLedgerModal } from '../modals/OnboardUnitLedgerModal';
import { ServiceChargePeriod } from '../../types';

// ─── AccordionSection (MODULE-LEVEL — outside PropertyForm) ──────────
// CRITICAL: This component MUST be defined outside the PropertyForm render
// function. When defined inside (as a closure), React treats it as a new
// component type on every render, causing all children to unmount/remount
// on every keystroke — which causes input focus loss.
// By defining it at module level with React.memo, the component identity
// is stable across re-renders, preserving DOM focus.
interface AccordionSectionProps {
    id: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    iconBg: string;
    children: React.ReactNode;
    isOpen: boolean;
    onToggle: (id: string) => void;
}
const AccordionSectionInner: React.FC<AccordionSectionProps> = ({ id, title, subtitle, icon, iconBg, children, isOpen, onToggle }) => {
    const headerRef = useRef<HTMLButtonElement>(null);
    return (
        <div
            className={`rounded-lg border shadow-sm overflow-hidden ${isOpen ? 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700' : 'bg-slate-50/50 dark:bg-zinc-800/30 border-slate-100 dark:border-zinc-700/50'}`}
            style={{ willChange: 'height', contain: 'layout style' }}
        >
            <button
                ref={headerRef}
                type="button"
                tabIndex={0}
                onClick={() => {
                    onToggle(id);
                    if (!isOpen) {
                        setTimeout(() => {
                            headerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }, 50);
                    }
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onToggle(id);
                    }
                }}
                className="w-full flex items-center gap-4 p-3 sm:p-4 hover:bg-slate-100/50 dark:hover:bg-zinc-700/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            >
                <div className={`p-1.5 ${iconBg} text-white rounded-lg shadow-sm flex-shrink-0`}>
                    {icon}
                </div>
                <div className="text-left flex-1 min-w-0">
                    <p className="text-2xs font-bold text-slate-600/70 dark:text-zinc-400 uppercase tracking-widest leading-none mb-0.5">{subtitle}</p>
                    <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">{title}</h3>
                </div>
                <svg className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {isOpen && (
                <div className="p-3 sm:p-4 pt-0 space-y-2 sm:space-y-3">
                    {children}
                </div>
            )}
        </div>
    );
};
const AccordionSection = React.memo(AccordionSectionInner);

interface PropertyFormProps {
    contact: Contact;
    propertyToEdit?: Property;
    activeUnitId?: string;
    autoExpandRental?: boolean;
    autoAddUnit?: boolean;
    onSave?: (contactId: string, properties: Property[]) => void;
    onClose: () => void;
}

const PropertyForm: React.FC<PropertyFormProps> = ({ contact, propertyToEdit, activeUnitId, autoExpandRental, autoAddUnit, onSave, onClose }) => {
    const { coreState, isDataLoaded } = useCoreState();
    const { appState } = useDataState();
    const { addItem, updateItem, deleteItem, onAddMatter } = useDataActions();
    const { addToast, openModal, navigateTo } = useUI();
    const { currentUser } = useAuth();
    const addLedgerEntry = useMutation(api.sentry.addLedgerEntry);
    const { confirm, ConfirmDialog } = useConfirm();

    // Core Fields
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [address, setAddress] = useState(propertyToEdit?.address || '');
    const [category, setCategory] = useState<Property['category']>(propertyToEdit?.category || PropertyCategory.Tenanted);
    const [propertyType, setPropertyType] = useState<Property['propertyType']>(propertyToEdit?.propertyType || 'Residential');
    const [description, setDescription] = useState(propertyToEdit?.description || '');
    const [status, setStatus] = useState<Property['status']>(propertyToEdit?.status || PropertyStatus.Occupied);
    const [ownershipType, setOwnershipType] = useState<Property['ownershipType']>(propertyToEdit?.ownershipType || 'managed');
    const [rentCollectionMode, setRentCollectionMode] = useState<Property['rentCollectionMode']>(propertyToEdit?.rentCollectionMode || 'Full (Collect Rent)');
    const [value, setValue] = useState<number>(propertyToEdit?.value || 0);
    const [managementFee, setManagementFee] = useState<number>(propertyToEdit?.managementFeePercentage || 10);
    const [numberOfUnits, setNumberOfUnits] = useState<number>(() => {
        if (propertyToEdit) {
            const count = (coreState.properties || []).filter(p => normalizeAddress(p.address) === normalizeAddress(propertyToEdit.address)).length;
            return Math.max(1, count);
        }
        return 1;
    });
    const [unitsInputStr, setUnitsInputStr] = useState(() => {
        if (propertyToEdit) {
            const count = (coreState.properties || []).filter(p => normalizeAddress(p.address) === normalizeAddress(propertyToEdit.address)).length;
            return String(Math.max(1, count));
        }
        return '1';
    });

    // Automation
    const [remindLeaseExpiry, setRemindLeaseExpiry] = useState(propertyToEdit?.automationSettings?.remindLeaseExpiry || false);
    const [remindRentDue, setRemindRentDue] = useState(propertyToEdit?.automationSettings?.remindRentDue || false);
    const [autoCreateMaintenanceTask, setAutoCreateMaintenanceTask] = useState(propertyToEdit?.automationSettings?.autoCreateMaintenanceTask || false);
    const [activeUnitIndex, setActiveUnitIndex] = useState(0);
    const [autoSyncUnits, setAutoSyncUnits] = useState(true);
    const [images, setImages] = useState<FileDetails[]>(propertyToEdit?.images || []);
    const formTouched = React.useRef(false);

    // Minimum Vend / Estate Fees
    const [minimumVendEnabled, setMinimumVendEnabled] = useState(propertyToEdit?.minimumVendEnabled || false);
    const [minimumVendAmount, setMinimumVendAmount] = useState<string>(String(propertyToEdit?.minimumVendAmount || 0));
    const [minimumVendLabel, setMinimumVendLabel] = useState(propertyToEdit?.minimumVendLabel || 'Minimum Vend');

    const [unitsData, setUnitsData] = useState<UnitRentalInput[]>(() => {
        if (propertyToEdit) {
            const allUnits = (coreState.properties || [])
                .filter(p => normalizeAddress(p.address) === normalizeAddress(propertyToEdit.address))
                .map(p => {
                    const rd = p.rentalDetails || {};
                    const rent = Number(rd.rentAmount) || 0;
                    const lf = Number(rd.legalFee) || 0;
                    const af = Number(rd.agencyFee) || 0;
                    const legalPct = rd.legalFeePercentage !== undefined ? Number(rd.legalFeePercentage) : (rent > 0 && lf ? Math.round((lf / rent) * 100) : 10);
                    const agencyPct = rd.agencyFeePercentage !== undefined ? Number(rd.agencyFeePercentage) : (rent > 0 && af ? Math.round((af / rent) * 100) : 10);
                    return {
                        ...rd,
                        id: p.id,
                        status: p.status || 'Occupied',
                        _id: (p as any)._id,
                        unitName: rd.unitName || p.description?.match(/\((.*?)\)/)?.[1] || "Unit",
                        unitDescription: (rd as any).unitDescription || p.description?.replace(/\s*\(.*?\)\s*$/, '') || '',
                        legalFee: lf,
                        legalFeePercentage: legalPct,
                        agencyFee: af,
                        agencyFeePercentage: agencyPct
                    };
                }) as any[];
            
            if (allUnits.length > 0) return allUnits;
            if (propertyToEdit.rentalDetails) {
                const rd = propertyToEdit.rentalDetails;
                const rent = Number(rd.rentAmount) || 0;
                const lf = Number(rd.legalFee) || 0;
                const af = Number(rd.agencyFee) || 0;
                const legalPct = rd.legalFeePercentage !== undefined ? Number(rd.legalFeePercentage) : (rent > 0 && lf ? Math.round((lf / rent) * 100) : 10);
                const agencyPct = rd.agencyFeePercentage !== undefined ? Number(rd.agencyFeePercentage) : (rent > 0 && af ? Math.round((af / rent) * 100) : 10);
                return [{ 
                    ...rd, 
                    id: propertyToEdit.id, 
                    status: propertyToEdit.status, 
                    _id: (propertyToEdit as any)._id,
                    legalFee: lf,
                    legalFeePercentage: legalPct,
                    agencyFee: af,
                    agencyFeePercentage: agencyPct
                }];
            }
        }
        return [{
            id: uuidv4(),
            unitName: 'Unit 1',
            unitDescription: '',
            rentAmount: 0,
            rentFrequency: 'Monthly',
            leaseStart: '',
            leaseEnd: '',
            tenantName: '',
            occupantTitle: '',
            occupantFirstName: '',
            occupantLastName: '',
            tenantPhone: '',
            nextRentReview: '',
            isPeriodicReviewEnabled: false,
            tenancyPeriod: '',
            serviceCharge: 0,
            serviceChargeAmount: 0,
            serviceChargeStatus: 'UNPAID' as const,
            outstandingServiceChargeBalance: 0,
            legalFee: 0,
            legalFeePercentage: 10,
            isLegalNA: false,
            agencyFee: 0,
            agencyFeePercentage: 10,
            isAgencyNA: false,
            cautionDeposit: 0,
            isCautionNA: false,
            status: 'Occupied' as PropertyStatus
        }];
    });

    // Local string buffers for % inputs so decimal typing (e.g. "2.") isn't snapped to "2"
    const [agencyPctStr, setAgencyPctStr] = useState<string>(() => String(unitsData[0]?.agencyFeePercentage ?? 10));
    const [legalPctStr, setLegalPctStr] = useState<string>(() => String(unitsData[0]?.legalFeePercentage ?? 10));

    // Sync % string buffers when switching active unit
    useEffect(() => {
        setAgencyPctStr(String(unitsData[activeUnitIndex]?.agencyFeePercentage ?? 10));
        setLegalPctStr(String(unitsData[activeUnitIndex]?.legalFeePercentage ?? 10));
    }, [activeUnitIndex]); // eslint-disable-line react-hooks/exhaustive-deps

    // Jump to the specific unit (when opened from a unit card)
    useEffect(() => {
        if (activeUnitId && unitsData.length > 0) {
            const idx = unitsData.findIndex(u => u.id === activeUnitId || u._id === activeUnitId);
            if (idx >= 0) setActiveUnitIndex(idx);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // AUTO-ADD UNIT — when triggered from the "+ Add Unit" button on the
    // workspace page, automatically append a new unit tab and select it.
    // Runs once on mount after unitsData is initialized.
    useEffect(() => {
        if (!autoAddUnit) return;
        const newUnitNum = unitsData.length + 1;
        const newUnit: UnitRentalInput = {
            id: `unit-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            unitName: `Unit ${newUnitNum}`,
            unitDescription: '',
            rentAmount: 0,
            rentFrequency: 'Annually',
            leaseStart: '',
            leaseEnd: '',
            tenantName: '',
            occupantTitle: '',
            occupantFirstName: '',
            occupantLastName: '',
            tenantPhone: '',
            nextRentReview: '',
            isPeriodicReviewEnabled: false,
            tenancyPeriod: '',
            serviceCharge: 0,
            serviceChargeAmount: 0,
            serviceChargeStatus: 'UNPAID' as const,
            outstandingServiceChargeBalance: 0,
            legalFee: 0,
            legalFeePercentage: 10,
            isLegalNA: false,
            agencyFee: 0,
            agencyFeePercentage: 10,
            isAgencyNA: false,
            cautionDeposit: 0,
            isCautionNA: false,
            status: 'Vacant' as PropertyStatus,
        };
        setUnitsData(prev => [...prev, newUnit]);
        setNumberOfUnits(prev => prev + 1);
        setUnitsInputStr(String(unitsData.length + 1));
        setActiveUnitIndex(unitsData.length);
        formTouched.current = true;
    }, [autoAddUnit]); // eslint-disable-line react-hooks/exhaustive-deps

    // DYNAMIC ARRAY HYDRATION — re-sync unitsData when coreState.properties
    // changes (e.g., a new unit was added in the background). Previously the
    // modal used a stale useState initializer that only ran once on mount,
    // so newly created units didn't appear in the Lease & Rent Configuration
    // tab until the modal was closed and reopened.
    // GATED behind formTouched: don't clobber unsaved user edits.
    useEffect(() => {
        if (!propertyToEdit) return;
        // GATE: don't clobber unsaved user edits
        if (formTouched.current) return;
        // Only re-sync if the number of units at this address has changed
        const currentUnits = (coreState.properties || [])
            .filter(p => normalizeAddress(p.address) === normalizeAddress(propertyToEdit.address)
                && p.status !== 'Deleted');
        if (currentUnits.length !== unitsData.length) {
            // Rebuild unitsData from the latest coreState
            const refreshedUnits = currentUnits.map(p => {
                const rd = p.rentalDetails || {};
                const rent = Number(rd.rentAmount) || 0;
                const lf = Number(rd.legalFee) || 0;
                const af = Number(rd.agencyFee) || 0;
                const legalPct = rd.legalFeePercentage !== undefined ? Number(rd.legalFeePercentage) : (rent > 0 && lf ? Math.round((lf / rent) * 100) : 10);
                const agencyPct = rd.agencyFeePercentage !== undefined ? Number(rd.agencyFeePercentage) : (rent > 0 && af ? Math.round((af / rent) * 100) : 10);
                return {
                    ...rd,
                    id: p.id,
                    status: p.status || 'Occupied',
                    _id: (p as any)._id,
                    unitName: rd.unitName || p.description?.match(/\((.*?)\)/)?.[1] || "Unit",
                    unitDescription: (rd as any).unitDescription || p.description?.replace(/\s*\(.*?\)\s*$/, '') || '',
                    legalFee: lf,
                    legalFeePercentage: legalPct,
                    agencyFee: af,
                    agencyFeePercentage: agencyPct
                };
            }) as any[];
            if (refreshedUnits.length > 0) {
                setUnitsData(refreshedUnits);
                // Update numberOfUnits to match
                setNumberOfUnits(refreshedUnits.length);
                setUnitsInputStr(String(refreshedUnits.length));
            }
        }
    }, [coreState.properties, propertyToEdit]); // eslint-disable-line react-hooks/exhaustive-deps

    // Keep units array in sync with numberOfUnits
    useEffect(() => {
        setUnitsData(prev => {
            if (prev.length === numberOfUnits) return prev;
            if (numberOfUnits > prev.length) {
                const added = [];
                for (let i = prev.length; i < numberOfUnits; i++) {
                    added.push({
                        id: uuidv4(),
                        unitName: `Unit ${i + 1}`,
                        unitDescription: '',
                        rentAmount: 0,
                        rentFrequency: 'Monthly' as const,
                        leaseStart: '',
                        leaseEnd: '',
                        tenantName: '',
                        occupantTitle: '',
                        occupantFirstName: '',
                        occupantLastName: '',
                        tenantPhone: '',
                        nextRentReview: '',
                        isPeriodicReviewEnabled: false,
                        tenancyPeriod: '',
                        serviceCharge: 0,
                        serviceChargeAmount: 0,
                        serviceChargeStatus: 'UNPAID' as const,
                        outstandingServiceChargeBalance: 0,
                        legalFee: 0,
                        legalFeePercentage: 10,
                        isLegalNA: false,
                        agencyFee: 0,
                        agencyFeePercentage: 10,
                        isAgencyNA: false,
                        cautionDeposit: 0,
                        isCautionNA: false,
                        status: 'Occupied' as PropertyStatus
                    });
                }
                return [...prev, ...added];
            } else {
                return prev.slice(0, numberOfUnits);
            }
        });
    }, [numberOfUnits]);

    // Dispute Specifics
    const [caseNumber, setCaseNumber] = useState(propertyToEdit?.disputeDetails?.caseNumber || '');
    const [court, setCourt] = useState(propertyToEdit?.disputeDetails?.court || '');
    const [opposingParty, setOpposingParty] = useState(propertyToEdit?.disputeDetails?.opposingParty || '');
    const [disputeStatus, setDisputeStatus] = useState(propertyToEdit?.disputeDetails?.status || '');
    const [linkedMatterId, setLinkedMatterId] = useState(propertyToEdit?.matterId || '');

    // Sale Specifics
    const [listingAgent, setListingAgent] = useState(propertyToEdit?.saleDetails?.listingAgent || '');
    const [targetPrice, setTargetPrice] = useState<number>(propertyToEdit?.saleDetails?.targetPrice || 0);
    const [listingDate, setListingDate] = useState(propertyToEdit?.saleDetails?.listingDate || '');

    // Images
    const [amenities, setAmenities] = useState<string[]>(propertyToEdit?.amenities || []);
    const [newAmenity, setNewAmenity] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isEditing = !!propertyToEdit;

    // Generic unit update helper with auto lease-end calculation and percentage calculation
    const updateUnit = (index: number, field: keyof UnitRentalInput, value: any) => {
        setUnitsData(prev => {
            const oldValue = prev[index][field];
            const newUnits = [...prev];
            newUnits[index] = { ...newUnits[index], [field]: value };
            
            // Recalculate legalFee / agencyFee if rentAmount, percentage, or N/A changes
            if (field === 'rentAmount') {
                const rent = Number(value) || 0;
                const legalPct = newUnits[index].legalFeePercentage ?? 10;
                const agencyPct = newUnits[index].agencyFeePercentage ?? 10;
                newUnits[index].legalFee = newUnits[index].isLegalNA ? 0 : Math.round(rent * (legalPct / 100));
                newUnits[index].agencyFee = newUnits[index].isAgencyNA ? 0 : Math.round(rent * (agencyPct / 100));
            }
            if (field === 'legalFeePercentage') {
                const pct = Number(value) || 0;
                const rent = newUnits[index].rentAmount || 0;
                newUnits[index].legalFee = newUnits[index].isLegalNA ? 0 : Math.round(rent * (pct / 100));
            }
            if (field === 'agencyFeePercentage') {
                const pct = Number(value) || 0;
                const rent = newUnits[index].rentAmount || 0;
                newUnits[index].agencyFee = newUnits[index].isAgencyNA ? 0 : Math.round(rent * (pct / 100));
            }
            if (field === 'isLegalNA') {
                const isNA = !!value;
                const pct = newUnits[index].legalFeePercentage ?? 10;
                const rent = newUnits[index].rentAmount || 0;
                newUnits[index].legalFee = isNA ? 0 : Math.round(rent * (pct / 100));
            }
            if (field === 'isAgencyNA') {
                const isNA = !!value;
                const pct = newUnits[index].agencyFeePercentage ?? 10;
                const rent = newUnits[index].rentAmount || 0;
                newUnits[index].agencyFee = isNA ? 0 : Math.round(rent * (pct / 100));
            }
            
            // Auto-calculate Lease End Date
            if (field === 'leaseStart' || field === 'rentFrequency' || field === 'tenancyPeriod') {
                const ls = field === 'leaseStart' ? value : newUnits[index].leaseStart;
                const rf = field === 'rentFrequency' ? value : newUnits[index].rentFrequency;
                const tp = field === 'tenancyPeriod' ? value : newUnits[index].tenancyPeriod;

                if (ls && (tp || rf)) {
                    const startDate = new Date(ls);
                    if (!isNaN(startDate.getTime())) {
                        const endDate = new Date(startDate);
                        if (tp) {
                            if (tp === '1 Year') endDate.setFullYear(endDate.getFullYear() + 1);
                            else if (tp === '2 Years') endDate.setFullYear(endDate.getFullYear() + 2);
                            else if (tp === '3 Years') endDate.setFullYear(endDate.getFullYear() + 3);
                            else if (tp === '6 Months') endDate.setMonth(endDate.getMonth() + 6);
                            else if (tp === 'Monthly') endDate.setMonth(endDate.getMonth() + 1);
                        } else {
                            switch (rf) {
                                case 'Annually': endDate.setFullYear(endDate.getFullYear() + 1); break;
                                case 'Bi-Annually': endDate.setMonth(endDate.getMonth() + 6); break;
                                case 'Quarterly': endDate.setMonth(endDate.getMonth() + 3); break;
                                case 'Monthly': endDate.setMonth(endDate.getMonth() + 1); break;
                            }
                        }
                        endDate.setDate(endDate.getDate() - 1);
                        newUnits[index].leaseEnd = endDate.toISOString().split('T')[0];
                    }
                }
            }

            // Smart ripple: If editing Unit 1, copy general fields to other untouched units
            if (index === 0 && autoSyncUnits) {
                const generalFields = [
                    'rentAmount', 'rentFrequency', 'leaseStart', 'leaseEnd', 'nextRentReview', 'isPeriodicReviewEnabled',
                    'legalFeePercentage', 'agencyFeePercentage', 'legalFee', 'agencyFee', 'serviceCharge', 'serviceChargeAmount', 'serviceChargeStatus', 'outstandingServiceChargeBalance', 'cautionDeposit',
                    'isLegalNA', 'isAgencyNA', 'isCautionNA',
                    'unitDescription'
                ];
                if (generalFields.includes(field)) {
                    for (let i = 1; i < newUnits.length; i++) {
                        const targetValue = prev[i][field];
                        // If the other unit had the exact same old value as Unit 1, or was empty/default, it inherits the new value
                        if (targetValue === oldValue || !targetValue || targetValue === 'Annually' || targetValue === (false as any) || targetValue === 0) {
                            newUnits[i] = { 
                                ...newUnits[i], 
                                [field]: newUnits[index][field],
                                // Also sync computed absolute fees if they are dependent
                                ...(field === 'rentAmount' || field === 'legalFeePercentage' || field === 'isLegalNA' ? {
                                    legalFee: newUnits[index].legalFee,
                                    legalFeePercentage: newUnits[index].legalFeePercentage,
                                    isLegalNA: newUnits[index].isLegalNA
                                } : {}),
                                ...(field === 'rentAmount' || field === 'agencyFeePercentage' || field === 'isAgencyNA' ? {
                                    agencyFee: newUnits[index].agencyFee,
                                    agencyFeePercentage: newUnits[index].agencyFeePercentage,
                                    isAgencyNA: newUnits[index].isAgencyNA
                                } : {})
                            };
                        }
                    }
                }
            }

            return newUnits;
        });
    };

    const activeUnit = unitsData[activeUnitIndex];
    const totalPayable = activeUnit ? (
        (Number(activeUnit.rentAmount) || 0) +
        (Number(activeUnit.serviceCharge) || 0) +
        (activeUnit.isCautionNA ? 0 : (Number(activeUnit.cautionDeposit) || 0)) +
        (activeUnit.isLegalNA ? 0 : (Number(activeUnit.legalFee) || 0)) +
        (activeUnit.isAgencyNA ? 0 : (Number(activeUnit.agencyFee) || 0))
    ) : 0;



    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                const newImage: FileDetails = {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    filePath: `property/${uuidv4()}/${file.name}`,
                    dataUrl: reader.result as string
                };
                setImages(prev => [...prev, newImage]);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddAmenity = () => {
        if (newAmenity.trim() && !amenities.includes(newAmenity.trim())) {
            setAmenities(prev => [...prev, newAmenity.trim()]);
            setNewAmenity('');
        }
    };

    const handleRemoveAmenity = (amenity: string) => {
        setAmenities(prev => prev.filter(a => a !== amenity));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!address.trim()) {
            addToast('Address is required.', { type: 'info' });
            return;
        }

        const firmId = coreState?.firmDetails?.id || currentUser?.firmId;
        if (!firmId) {
            addToast('Error: Firm identity not established. Please ensure you have completed onboarding.', { type: 'error' });
            return;
        }

        if (!contact?.id) {
            addToast('Error: Owner ID missing.', { type: 'error' });
            return;
        }

        // Base Object
        const propertyData: Partial<Property> = {
            firmId,
            contactId: contact.id,
            matterId: linkedMatterId,
            address,
            category,
            propertyType,
            ownershipType,
            description,
            // status: status, // Moved to unit level
            rentCollectionMode,
            value,
            managementFeePercentage: managementFee,
            images,
            amenities,
            automationSettings: {
                remindLeaseExpiry,
                remindRentDue,
                autoCreateMaintenanceTask
            },
            minimumVendEnabled,
            minimumVendAmount: Number(minimumVendAmount) || 0,
            minimumVendLabel: minimumVendLabel || 'Minimum Vend',
        };

        // Rental Check
        const hasRentalData = (unit: UnitRentalInput) => 
            unit.rentAmount > 0 || 
            unit.leaseStart || 
            unit.leaseEnd || 
            unit.tenantName || 
            (unit.serviceCharge && unit.serviceCharge > 0) ||
            (unit.legalFee && unit.legalFee > 0) ||
            (unit.agencyFee && unit.agencyFee > 0) ||
            (unit.cautionDeposit && unit.cautionDeposit > 0);

        // Dispute Logic
        if (category === 'Disputed Property') {
            propertyData.disputeDetails = {
                caseNumber,
                court,
                opposingParty,
                status: disputeStatus
            };
        }

        // Sale Logic
        if (category === 'Property For Sale') {
            propertyData.saleDetails = {
                listingAgent,
                listingDate,
                targetPrice: targetPrice || value // Fallback to main value if target not set
            };
        }

        setIsSubmitting(true);
        try {
            const isEditing = !!propertyToEdit;
            const currentUnits = unitsData.slice(0, numberOfUnits);
            
            // 1. Process all units in the current form state
            // FIX: Parallelize unit saves with Promise.all instead of sequential
            // awaits. Previously, a 20-unit property took 6-12 seconds because each
            // unit waited for the previous to finish. Now all units save concurrently.
            await Promise.all(currentUnits.map(async (unit) => {
                const unitId = unit.id || `prop_${uuidv4()}`;
                const pd = buildPropertyRecord(unit, propertyData, unitId);

                const existsInDb = propertyExistsInDb(
                    coreState.properties || [],
                    unitId,
                    unit._id
                );
                if (isEditing && existsInDb) {
                    await updateItem('properties', pd, 'Property');
                } else {
                    await addItem('properties', pd, 'Property');
                }

                // Route Caution Deposit to Ledger if applicable
                // FIX: Only add deposit on NEW property creation, not on edits.
                // Previously, editing a property re-created the deposit entry
                // every time, producing duplicate ledger entries.
                const isExistingUnit = isEditing && existsInDb;
                if (!isExistingUnit && !unit.isCautionNA && unit.cautionDeposit && unit.cautionDeposit > 0) {
                    try {
                        await addLedgerEntry({
                            firmId,
                            unitId,
                            amount: unit.cautionDeposit || 0,
                            type: 'deposit',
                            status: 'cleared',
                            description: `Initial Caution Deposit - ${unit.unitName || 'Unit'}`,
                            channel: 'Internal Transfer'
                        });
                    } catch (e) {
                        console.warn('Failed to route caution deposit to ledger:', e);
                    }
                }
            }));

            // 2. Handle unit deletions (if numberOfUnits was decreased)
            // FIX: Also parallelize deletions
            if (isEditing && propertyToEdit) {
                const keptIds = new Set([
                    ...currentUnits.map(u => u.id).filter(Boolean),
                    ...currentUnits.map(u => u._id).filter(Boolean)
                ]);
                const siblingsToRemove = (coreState.properties || [])
                    .filter(p => {
                        const convexId = (p as any)._id;
                        return normalizeAddress(p.address) === normalizeAddress(propertyToEdit.address) &&
                            !keptIds.has(p.id) &&
                            !keptIds.has(convexId);
                    });

                await Promise.all(siblingsToRemove.map(p =>
                    deleteItem('properties', p.id, 'Property')
                ));
            }

            // 3. Auto-Sync Residents to Central Contacts Database
            // For each unit that has a tenant (tenantName or tenantPhone or tenantEmail),
            // check if a Contact with the same phone or email already exists.
            // If exists: link contactId to the unit's rentalDetails.tenantContactId.
            // If not exists: create a new Contact with category='Tenant' and link it.
            // This ensures every resident appears in /contacts for unified profiling.
            await Promise.all(currentUnits.map(async (unit) => {
                const tenantName = composeTenantName(unit).trim();
                const tenantPhone = (unit.tenantPhone || '').trim();
                const tenantEmail = ''; // UnitRentalInput doesn't have tenantEmail; would come from rentalDetails
                if (!tenantName && !tenantPhone) return; // No tenant data to sync

                const unitId = unit.id || '';
                if (!unitId) return;

                try {
                    // Search existing contacts by phone (primary matcher)
                    const existingByPhone = tenantPhone
                        ? (appState.contacts || []).find(c =>
                            c.phone?.replace(/\D/g, '') === tenantPhone.replace(/\D/g, ''))
                        : null;

                    if (existingByPhone) {
                        // Link existing contact to this unit
                        const existing = (coreState.properties || []).find(p => p.id === unitId);
                        if (existing) {
                            await updateItem('properties', {
                                ...existing,
                                rentalDetails: {
                                    ...existing.rentalDetails,
                                    tenantContactId: existingByPhone.id,
                                } as any,
                            }, 'Property');
                        }
                        return;
                    }

                    // No existing contact found — create a new one
                    const newContactData = {
                        firmId,
                        name: tenantName || 'Unknown Tenant',
                        phone: tenantPhone,
                        email: tenantEmail,
                        contactType: ContactType.Individual,
                        category: 'Tenant',
                        // Link back to the property/unit for traceability
                        properties: [{
                            id: unitId,
                            address: address,
                            unitName: unit.unitName,
                        } as any],
                    };

                    const created = await addItem('contacts', newContactData, 'Contact');
                    if (created) {
                        // Link the new contactId back to the unit
                        const existing = (coreState.properties || []).find(p => p.id === unitId);
                        if (existing) {
                            await updateItem('properties', {
                                ...existing,
                                rentalDetails: {
                                    ...existing.rentalDetails,
                                    tenantContactId: created.id,
                                } as any,
                            }, 'Property');
                        }
                    }
                } catch (syncErr) {
                    // Auto-sync is best-effort — don't fail the property save
                    console.warn(`Tenant auto-sync failed for unit ${unit.unitName}:`, syncErr);
                }
            }));

            // Note: We no longer pass empty [] to onSave — that wipes the contact's property references.
            // Instead, just close the modal. The individual updateItem calls above already persisted each unit.
            // The contact's properties array is a derived/legacy view; wiping it breaks the PropertyDetailView.
            // if (onSave) onSave(contact.id, []);
            onClose();
        } catch (error) {
            console.error("Failed to save property", error);
            addToast("Failed to save property. Please try again.", { type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConvertToMatter = async () => {
        if (!address) {
            addToast("Please enter an address first.", { type: 'info' });
            return;
        }

        try {
            const matterData = {
                title: `Property Dispute: ${address.split('\n')[0]}`,
                type: 'Real Estate',
                subCategory: 'Property Dispute',
                status: 'Active',
                stage: 'Intake',
                description: `Matter created from property portfolio: ${address}\n\nNotes: ${description}`,
                firmId: coreState?.firmDetails?.id || currentUser?.firmId,
                clientId: contact.id,
                specialtyData: {
                    realEstate: {
                        propertyAddress: address,
                        propertyType: propertyType,
                        currentStatus: status,
                        disputeDetails: {
                            caseNumber,
                            court,
                            opposingParty,
                            status: disputeStatus
                        }
                    }
                }
            };

            const newMatter = await onAddMatter(matterData, { data: contact, createPortal: false });
            if (newMatter) {
                setLinkedMatterId(newMatter.id);
                addToast("Matter created successfully.", { type: 'success' });
                // Optional: navigate to matter detail
                // navigateTo('matterDetail', newMatter.id);
            }
        } catch (e) {
            console.error("Conversion failed:", e);
            addToast("Failed to convert property to matter.", { type: 'error' });
        }
    };

    const commonInputClass = inputModern;
    const labelClass = "block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 ml-0.5";

    const isRental = category === 'Tenanted Property';
    const isSale = category === 'Property For Sale';
    const isDisputed = category === 'Disputed Property';


    // ─── Accordion State ──────────────────────────────────────────────
    // Contextual auto-expansion: if opened from a unit card (activeUnitId
    // is set), expand Rental Details. Otherwise, expand Primary Details.
    const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
        if (activeUnitId || autoExpandRental) {
            return { 'rental': true, 'primary': false, 'amenities': false, 'fees': false, 'media': false };
        }
        return { 'rental': false, 'primary': true, 'amenities': false, 'fees': false, 'media': false };
    });
    const toggleSection = React.useCallback((id: string) => {
        setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
    }, []);

    // ─── Auto-scroll to Rental section when editing from a unit card ──────
    // When the modal opens with activeUnitId or autoExpandRental, the rental
    // accordion auto-expands (above). This ref + effect scrolls the expanded
    // section into view so the user doesn't have to manually scroll down.
    const rentalSectionRef = useRef<HTMLDivElement>(null);

    // OnboardUnitLedgerModal state — opens when user clicks "Settle Historical Ledger"
    const [ledgerModalOpen, setLedgerModalOpen] = useState(false);
    const [ledgerChargeType, setLedgerChargeType] = useState<'SC' | 'MV'>('SC');
    useEffect(() => {
        if (!(activeUnitId || autoExpandRental)) return;
        // Delay to allow the accordion expand animation to start before scrolling.
        const timer = setTimeout(() => {
            rentalSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
        return () => clearTimeout(timer);
    }, [activeUnitId, autoExpandRental]);

    return (
        <form onSubmit={handleSubmit} onChange={() => { formTouched.current = true; }} className="flex flex-col gap-4 relative">
            <div className="space-y-2 sm:space-y-3 pb-6">
                <AccordionSection id="primary" isOpen={openSections.primary} onToggle={toggleSection} title="Address & Category" subtitle="Primary Details" icon={<OfficeBuildingIcon className="w-3.5 h-3.5" />} iconBg="bg-primary-600">
                    <div className="space-y-2 sm:space-y-3">
                        <div className={`grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3 sm:gap-4`}>
                            <div className="space-y-2 group">
                                <label className={labelClass}>Address</label>
                                <textarea
                                    rows={2}
                                    value={address}
                                    onChange={e => setAddress(e.target.value)}
                                    className={`${commonInputClass} resize-none`}
                                    placeholder="Enter the full property address..."
                                    required
                                />
                            </div>
                            {!activeUnitId && (
                            <div className="space-y-2 group">
                                <label className={labelClass}>{isEditing ? 'Add Units' : 'Total Units'}</label>
                                <input autoComplete="off" data-lpignore="true" 
                                    type="text"
                                    inputMode="numeric"
                                    value={unitsInputStr}
                                    onChange={e => {
                                        const raw = e.target.value.replace(/[^0-9]/g, '');
                                        setUnitsInputStr(raw);
                                        const parsed = parseInt(raw, 10);
                                        if (!isNaN(parsed) && parsed >= 1) {
                                            setNumberOfUnits(parsed);
                                        }
                                    }}
                                    onBlur={() => {
                                        // Enforce minimum of 1 when field loses focus
                                        const parsed = parseInt(unitsInputStr, 10);
                                        const safeVal = isNaN(parsed) || parsed < 1 ? 1 : parsed;
                                        setUnitsInputStr(String(safeVal));
                                        setNumberOfUnits(safeVal);
                                    }}
                                    className={commonInputClass}
                                    placeholder="1"
                                />
                            </div>
                            )}
                        </div>

                        {!activeUnitId && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                            <div className="space-y-2 group">
                                <label className={labelClass}>Category</label>
                                <select value={category} onChange={e => setCategory(e.target.value as Property['category'])} className={commonInputClass}>
                                    <option value="Tenanted Property">Tenanted / Rental</option>
                                    <option value="Property For Sale">For Sale</option>
                                    <option value="Personal Residence">Personal Residence</option>
                                    <option value="Disputed Property">Disputed Land</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div className="space-y-2 group">
                                <label className={labelClass}>Portfolio Type</label>
                                <select value={ownershipType} onChange={e => setOwnershipType(e.target.value as Property['ownershipType'])} className={commonInputClass}>
                                    <option value="managed">Managed for Client</option>
                                    <option value="owned">Personal Portfolio</option>
                                </select>
                            </div>
                            <div className="space-y-2 group">
                                <label className={labelClass}>Collection Mode</label>
                                <select value={rentCollectionMode} onChange={e => setRentCollectionMode(e.target.value as any)} className={commonInputClass}>
                                    <option value="Full (Collect Rent)">Full (Collect Rent)</option>
                                    <option value="Management Only (No Rent)">Management Only (No Rent)</option>
                                </select>
                            </div>
                            <div className="space-y-2 group">
                                <label className={labelClass}>Property Type</label>
                                <select value={propertyType} onChange={e => setPropertyType(e.target.value as any)} className={commonInputClass}>
                                    <option value="Residential">Residential</option>
                                    <option value="Commercial">Commercial</option>
                                    <option value="Industrial">Industrial</option>
                                    <option value="Land">Land</option>
                                    <option value="Mixed Use">Mixed Use</option>
                                </select>
                            </div>
                        </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                        {/* Status moved to unit level */}
                        {!isRental && (
                            <div className="space-y-2 group animate-fade-in">
                                <label className={labelClass}>Valuation (<NairaSymbol />)</label>
                                <input autoComplete="off" data-lpignore="true" 
                                    type="text"
                                    value={formatNumberWithCommas(value)}
                                    onChange={e => setValue(parseFormattedNumber(e.target.value))}
                                    className={commonInputClass}
                                    placeholder="0.00"
                                />
                            </div>
                        )}
                        </div>

                        <div className="space-y-2 group">
                            <label className={labelClass}>Property Description <span className="text-slate-300 dark:text-zinc-600 normal-case tracking-normal font-normal">(shared fallback)</span></label>
                            <input autoComplete="off" data-lpignore="true" 
                                type="text"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className={commonInputClass}
                                placeholder="e.g. 8-Unit Luxury Apartment Complex or 3-Bedroom Terrace Duplex"
                            />
                            <p className="text-3xs text-slate-400 dark:text-zinc-500 px-1">Building-level description (e.g. "8-Unit Luxury Apartment Complex"). Do not enter individual unit names here.</p>
                        </div>
                    </div>
                </AccordionSection>

                {/* --- Amenities Section --- */}
                <AccordionSection id="amenities" isOpen={openSections.amenities} onToggle={toggleSection} title="Amenities" subtitle="Features" icon={<HomeIcon className="w-3.5 h-3.5" />} iconBg="bg-emerald-600">
                    <div className="space-y-3 sm:space-y-4">
                        <div className="flex gap-2">
                            <input autoComplete="off" data-lpignore="true" 
                                type="text"
                                value={newAmenity}
                                onChange={e => setNewAmenity(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddAmenity())}
                                className={commonInputClass}
                                placeholder="Add amenity (e.g. Swimming Pool, 24/7 Power)..."
                            />
                            <button
                                type="button"
                                onClick={handleAddAmenity}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors"
                            >
                                <PlusIcon className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {amenities.map(amenity => (
                                <div key={amenity} className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-100 dark:border-emerald-900/40 text-xs font-bold">
                                    {amenity}
                                    <button type="button" onClick={() => handleRemoveAmenity(amenity)} className="hover:text-rose-500 transition-colors">
                                        <XIcon className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                            {amenities.length === 0 && (
                                <p className="text-2xs text-slate-400 font-bold uppercase tracking-widest px-2 italic">No amenities listed yet.</p>
                            )}
                        </div>
                    </div>
                </AccordionSection>

                {/* --- Automation Settings --- */}
                <AccordionSection id="automation" isOpen={openSections.automation} onToggle={toggleSection} title="Automation" subtitle="Alerts" icon={<ZapIcon className="w-3.5 h-3.5" />} iconBg="bg-amber-500">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                        <label className="flex items-start gap-3 p-3 sm:p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs cursor-pointer group hover:ring-2 hover:ring-amber-500/20 transition-all">
                            <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={remindLeaseExpiry} onChange={e => setRemindLeaseExpiry(e.target.checked)} className="mt-1 rounded border-slate-200 text-amber-500 dark:text-amber-400 focus:ring-amber-500" />
                            <span className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-tight">Lease Expiry Alerts</span>
                        </label>
                        {rentCollectionMode === 'Full (Collect Rent)' && (
                            <label className="flex items-start gap-3 p-3 sm:p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs cursor-pointer group hover:ring-2 hover:ring-amber-500/20 transition-all">
                                <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={remindRentDue} onChange={e => setRemindRentDue(e.target.checked)} className="mt-1 rounded border-slate-200 text-amber-500 dark:text-amber-400 focus:ring-amber-500" />
                                <span className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-tight">Rent Due Alerts</span>
                            </label>
                        )}
                        <label className="flex items-start gap-3 p-3 sm:p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs cursor-pointer group hover:ring-2 hover:ring-amber-500/20 transition-all">
                            <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={autoCreateMaintenanceTask} onChange={e => setAutoCreateMaintenanceTask(e.target.checked)} className="mt-1 rounded border-slate-200 text-amber-500 dark:text-amber-400 focus:ring-amber-500" />
                            <span className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-tight">Maintenance Tasks</span>
                        </label>
                    </div>
                </AccordionSection>

                {/* --- Minimum Vend / Estate Fees --- */}
                <AccordionSection id="fees" isOpen={openSections.fees} onToggle={toggleSection} title="Minimum Vend / Estate Fees" subtitle="Fees" icon={<CalculatorIcon className="w-3.5 h-3.5" />} iconBg="bg-teal-500">
                    <label className="flex items-start gap-3 p-3 sm:p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs cursor-pointer group hover:ring-2 hover:ring-teal-500/20 transition-all">
                        <input autoComplete="off" data-lpignore="true" type="checkbox" checked={minimumVendEnabled} onChange={e => setMinimumVendEnabled(e.target.checked)} className="mt-1 rounded border-slate-200 text-teal-500 focus:ring-teal-500" />
                        <span className="text-xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-tight">Enable Minimum Vend Tracking</span>
                    </label>
                    {minimumVendEnabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 animate-fade-in">
                            <div className="space-y-2 group">
                                <label className={labelClass}>Minimum Vend Amount</label>
                                <div className="relative rounded-lg shadow-xs">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₦</span>
                                    <input autoComplete="off" data-lpignore="true"
                                        type="text"
                                        value={formatNumberWithCommas(parseFormattedNumber(minimumVendAmount))}
                                        onChange={e => setMinimumVendAmount(String(parseFormattedNumber(e.target.value)))}
                                        className={`${commonInputClass} pl-8`}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2 group">
                                <label className={labelClass}>Label</label>
                                <input autoComplete="off" data-lpignore="true"
                                    type="text"
                                    value={minimumVendLabel}
                                    onChange={e => setMinimumVendLabel(e.target.value)}
                                    className={commonInputClass}
                                    placeholder="e.g. Diesel Surcharge, Estate Levy"
                                />
                            </div>
                        </div>
                    )}
                </AccordionSection>

                {/* --- Conditional Sections --- */}

                {/* 1. Dispute Details */}
                {isDisputed && (
                    <div className="p-3 sm:p-4 bg-rose-50/50 dark:bg-rose-900/10 rounded-lg border border-rose-100 dark:border-rose-900 shadow-sm space-y-2 sm:space-y-3 animate-fade-in">
                        <div className="flex items-center gap-4 px-1">
                            <div className="p-1.5 bg-rose-600 text-white rounded-lg shadow-sm ring-2 ring-rose-500/10">
                                <GavelIconLarge className="w-3.5 h-3.5" />
                            </div>
                            <div>
                                <p className="text-2xs font-bold text-rose-600/70 uppercase tracking-widest leading-none mb-0.5">Legal</p>
                                <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Dispute Details</h3>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                            <div className="space-y-2 group">
                                <label className={labelClass}>Court</label>
                                <input autoComplete="off" data-lpignore="true"  type="text" value={court} onChange={e => setCourt(e.target.value)} className={commonInputClass} placeholder="e.g. Lagos High Court" />
                            </div>
                            <div className="space-y-2 group">
                                <label className={labelClass}>Suit Number</label>
                                <input autoComplete="off" data-lpignore="true"  type="text" value={caseNumber} onChange={e => setCaseNumber(e.target.value)} className={commonInputClass} placeholder="LD/..." />
                            </div>
                        </div>
                        <div className="space-y-2 group">
                            <label className={labelClass}>Adverse Party</label>
                            <input autoComplete="off" data-lpignore="true"  type="text" value={opposingParty} onChange={e => setOpposingParty(e.target.value)} className={commonInputClass} placeholder="Full Name / Legal Entity" />
                        </div>

                        {/* Matter Link Section */}
                        <div className="pt-4 border-t border-rose-200 dark:border-rose-800 mt-2 space-y-2 sm:space-y-3">
                            <label className={labelClass}>Linked Matter (Dispute)</label>
                            {linkedMatterId ? (
                                <div className="flex items-center justify-between p-3 bg-white dark:bg-zinc-800 rounded-lg border border-rose-200 dark:border-zinc-700 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-rose-100 text-rose-600 rounded-lg">
                                            <BriefcaseIcon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-slate-700 dark:text-zinc-200">
                                                {(appState.matters || []).find(m => m.id === linkedMatterId)?.title || 'Matter Not Found'}
                                            </p>
                                            <p className="text-2xs text-slate-500 uppercase tracking-tight">Connected for Legal Management</p>
                                        </div>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => navigateTo('matterDetail', linkedMatterId)}
                                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                    >
                                        <ExternalLinkIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <select 
                                        value={linkedMatterId} 
                                        onChange={e => setLinkedMatterId(e.target.value)}
                                        className={`${commonInputClass} flex-1`}
                                    >
                                        <option value="">-- Link to Existing Matter --</option>
                                        {(appState.matters || []).filter((m: any) => m.clientId === contact.id).map((m: any) => (
                                            <option key={m.id} value={m.id}>{m.title}</option>
                                        ))}
                                    </select>
                                    <button 
                                        type="button"
                                        onClick={handleConvertToMatter}
                                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 transition-all whitespace-nowrap shadow-sm shadow-rose-500/20"
                                    >
                                        <BriefcaseIcon className="w-3.5 h-3.5" />
                                        Convert to Matter
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 2. Sale Details */}
                {isSale && (
                    <div className="p-3 sm:p-4 bg-blue-50 dark:bg-blue-950/40/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900 shadow-sm space-y-2 sm:space-y-3 animate-fade-in">
                        <div className="flex items-center gap-4 px-1">
                            <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-sm ring-2 ring-blue-500/10">
                                <CalculatorIcon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                                <p className="text-2xs font-bold text-blue-600 dark:text-blue-400/70 uppercase tracking-widest leading-none mb-0.5">Sale Details</p>
                                <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">Listing Info</h3>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                            <div className="space-y-2 group">
                                <label className={labelClass}>Target Price (<NairaSymbol />)</label>
                                <input autoComplete="off" data-lpignore="true" 
                                    type="text"
                                    value={formatNumberWithCommas(targetPrice)}
                                    onChange={e => setTargetPrice(parseFormattedNumber(e.target.value))}
                                    className={commonInputClass}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2 group">
                                <label className={labelClass}>Listing Date</label>
                                <input autoComplete="off" data-lpignore="true"  type="date" value={listingDate} onChange={e => setListingDate(e.target.value)} className={commonInputClass} />
                            </div>
                        </div>
                        <div className="space-y-2 group">
                            <label className={labelClass}>Listing Agent</label>
                            <input autoComplete="off" data-lpignore="true"  type="text" value={listingAgent} onChange={e => setListingAgent(e.target.value)} className={commonInputClass} placeholder="Agent Name / Firm" />
                        </div>
                    </div>
                )}

                {/* 3. Rental Details — wrapped in a ref div for auto-scroll
                    when the modal opens from a unit card Edit button. */}
                {(isRental || category === 'Personal Residence' || category === 'Other') && (
                    <div ref={rentalSectionRef}>
                    <AccordionSection id="rental" isOpen={openSections.rental} onToggle={toggleSection} title="Lease & Rent Configuration" subtitle="Rental Details" icon={<CalendarIcon className="w-3.5 h-3.5" />} iconBg="bg-primary-600">

                        {/* UNIT TABS — always show (even for single unit) + inline Add Unit button */}
                        <div className="flex flex-wrap gap-2 px-1 mb-2 items-center">
                            {unitsData.map((unit, index) => (
                                <button
                                    key={unit.id}
                                    type="button"
                                    onClick={() => setActiveUnitIndex(index)}
                                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm border flex items-center gap-1.5 ${
                                        activeUnitIndex === index
                                        ? 'bg-primary-600 text-white border-primary-600 shadow-primary-500/20'
                                        : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400 hover:border-primary-300 dark:hover:border-primary-700/50 hover:bg-primary-50 dark:hover:bg-primary-900/10'
                                    }`}
                                >
                                    {unit.unitName}
                                    {/* MUTED badge for deactivated units */}
                                    {(unit as any).status === 'Muted' && (
                                        <span className="text-3xs font-black uppercase bg-slate-400 text-white px-1 py-0.5 rounded">MUTED</span>
                                    )}
                                </button>
                            ))}
                            {/* INLINE ADD UNIT button — appends a new unit tab immediately */}
                            <button
                                type="button"
                                onClick={() => {
                                    const newUnitNum = unitsData.length + 1;
                                    const newUnit: UnitRentalInput = {
                                        id: `unit-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                                        unitName: `Unit ${newUnitNum}`,
                                        unitDescription: '',
                                        rentAmount: 0,
                                        rentFrequency: 'Annually',
                                        leaseStart: '',
                                        leaseEnd: '',
                                        tenantName: '',
                                        occupantTitle: '',
                                        occupantFirstName: '',
                                        occupantLastName: '',
                                        tenantPhone: '',
                                        nextRentReview: '',
                                        isPeriodicReviewEnabled: false,
                                        tenancyPeriod: '',
                                        serviceCharge: 0,
                                        serviceChargeAmount: 0,
                                        serviceChargeStatus: 'UNPAID' as const,
                                        outstandingServiceChargeBalance: 0,
                                        legalFee: 0,
                                        legalFeePercentage: 10,
                                        isLegalNA: false,
                                        agencyFee: 0,
                                        agencyFeePercentage: 10,
                                        isAgencyNA: false,
                                        cautionDeposit: 0,
                                        isCautionNA: false,
                                        status: 'Vacant' as PropertyStatus,
                                    };
                                    setUnitsData(prev => [...prev, newUnit]);
                                    setNumberOfUnits(prev => prev + 1);
                                    setUnitsInputStr(String(unitsData.length + 1));
                                    setActiveUnitIndex(unitsData.length);
                                    formTouched.current = true;
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm border border-dashed border-primary-300 dark:border-primary-700/50 text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-500 flex items-center gap-1"
                                title="Add a new unit"
                            >
                                <PlusIcon className="w-3 h-3" /> Add Unit
                            </button>
                        </div>

                        {unitsData.length > 1 && (
                            <div className="flex items-center gap-3 px-1 mb-4 mt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={autoSyncUnits} 
                                        onChange={e => setAutoSyncUnits(e.target.checked)} 
                                        className="rounded border-slate-200 text-primary-600 dark:text-primary-300 focus:ring-primary-500 w-4 h-4" 
                                    />
                                    <span className="text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                                        Copy Unit 1 fields to other units automatically
                                    </span>
                                </label>
                            </div>
                        )}

                        <div className="space-y-3 sm:space-y-4 pt-1 animate-fade-in" key={unitsData[activeUnitIndex]?.id || activeUnitIndex}>
                            <div className="space-y-2 group">
                                <label className={labelClass}>Unit Description <span className="text-slate-300 dark:text-zinc-600 normal-case tracking-normal font-normal">(structural notes — not the unit number)</span></label>
                                <input autoComplete="off" data-lpignore="true"
                                    type="text"
                                    value={unitsData[activeUnitIndex].unitDescription || ''}
                                    onChange={e => updateUnit(activeUnitIndex, 'unitDescription', e.target.value)}
                                    className={commonInputClass}
                                    placeholder="e.g. Ground Floor Corner Unit with Terrace"
                                />
                                <p className="text-3xs text-slate-400 dark:text-zinc-500 px-1">Structural features or notes (e.g. "Penthouse Suite", "3-Bedroom with BQ"). The unit tab label ({unitsData[activeUnitIndex].unitName}) is separate and won't change.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                <div className="space-y-2 group">
                                    <label className={labelClass}>Rent Amount (<NairaSymbol />)</label>
                                    <input autoComplete="off" data-lpignore="true" 
                                        type="text"
                                        value={formatNumberWithCommas(unitsData[activeUnitIndex].rentAmount)}
                                        onChange={e => updateUnit(activeUnitIndex, 'rentAmount', parseFormattedNumber(e.target.value))}
                                        className={commonInputClass}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="space-y-2 group">
                                    <label className={labelClass}>Rent Frequency</label>
                                    <select value={unitsData[activeUnitIndex].rentFrequency} onChange={e => updateUnit(activeUnitIndex, 'rentFrequency', e.target.value)} className={commonInputClass}>
                                        <option value="Monthly">Monthly</option>
                                        <option value="Annually">Per Annum</option>
                                        <option value="Bi-Annually">Bi-Annually</option>
                                        <option value="Quarterly">Quarterly</option>
                                    </select>
                                </div>
                                <div className="space-y-2 group">
                                    <label className={labelClass}>Unit Status</label>
                                    <select value={unitsData[activeUnitIndex].status} onChange={e => updateUnit(activeUnitIndex, 'status', e.target.value)} className={commonInputClass}>
                                        <option value="Occupied">Occupied</option>
                                        <option value="Vacant">Vacant</option>
                                        <option value="Listed">Listed on Market</option>
                                        <option value="Maintenance">Under Maintenance</option>
                                        <option value="Sold">Sold</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                <div className="space-y-2 group">
                                    <label className={labelClass}>Monthly Service Charge</label>
                                    <div className="relative rounded-lg shadow-xs">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₦</span>
                                        <input autoComplete="off" data-lpignore="true" 
                                            type="text"
                                            value={formatNumberWithCommas(unitsData[activeUnitIndex].serviceCharge || 0)}
                                            onChange={e => updateUnit(activeUnitIndex, 'serviceCharge', parseFormattedNumber(e.target.value))}
                                            className={`${commonInputClass} pl-8`}
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2 group">
                                    <label className={labelClass}>Total Service Charge Due</label>
                                    <div className="relative rounded-lg shadow-xs">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₦</span>
                                        <input
                                            autoComplete="off"
                                            data-lpignore="true"
                                            type="text"
                                            value={formatNumberWithCommas(activeUnit.serviceChargeAmount || 0)}
                                            onChange={e => updateUnit(activeUnitIndex, 'serviceChargeAmount', parseFormattedNumber(e.target.value))}
                                            className={`${commonInputClass} pl-8`}
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <p className="text-3xs text-slate-400 pl-1">For the current billing period</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                <div className="space-y-2 group">
                                    <label className={labelClass}>Service Charge Status</label>
                                    <select
                                        value={activeUnit.serviceChargeStatus || 'UNPAID'}
                                        onChange={e => updateUnit(activeUnitIndex, 'serviceChargeStatus', e.target.value as 'PAID_FULLY' | 'PARTIALLY_PAID' | 'UNPAID')}
                                        className={commonInputClass}
                                    >
                                        <option value="UNPAID">Unpaid</option>
                                        <option value="PARTIALLY_PAID">Partially Paid</option>
                                        <option value="PAID_FULLY">Paid Fully</option>
                                    </select>
                                </div>
                                {activeUnit.serviceChargeStatus === 'PARTIALLY_PAID' && (
                                    <div className="space-y-2 group animate-fade-in">
                                        <label className={labelClass}>Outstanding Balance</label>
                                        <div className="relative rounded-lg shadow-xs">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₦</span>
                                            <input autoComplete="off" data-lpignore="true"
                                                type="text"
                                                value={formatNumberWithCommas(activeUnit.outstandingServiceChargeBalance || 0)}
                                                onChange={e => updateUnit(activeUnitIndex, 'outstandingServiceChargeBalance', parseFormattedNumber(e.target.value))}
                                                className={`${commonInputClass} pl-8`}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-2 group">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className={labelClass}>Legal Fee (%)</label>
                                        <label className="flex items-center gap-1.5 cursor-pointer group/na">
                                            <input type="checkbox" checked={unitsData[activeUnitIndex].isLegalNA} onChange={e => updateUnit(activeUnitIndex, 'isLegalNA', e.target.checked)} className="rounded border-slate-200 text-primary-600 dark:text-primary-300 focus:ring-primary-500 w-3 h-3" />
                                            <span className="text-2xs font-bold text-slate-400 group-hover/na:text-slate-600 uppercase tracking-tight">N/A</span>
                                        </label>
                                    </div>
                                    <div className="relative rounded-lg shadow-xs">
                                        <input autoComplete="off" data-lpignore="true" 
                                            type="text"
                                            disabled={unitsData[activeUnitIndex].isLegalNA}
                                            value={unitsData[activeUnitIndex].isLegalNA ? 'N/A' : legalPctStr}
                                            onChange={e => {
                                                const raw = e.target.value;
                                                setLegalPctStr(raw);
                                                if (raw !== '' && !raw.endsWith('.')) {
                                                    updateUnit(activeUnitIndex, 'legalFeePercentage', parseFormattedNumber(raw));
                                                }
                                            }}
                                            onBlur={() => {
                                                const parsed = parseFormattedNumber(legalPctStr);
                                                setLegalPctStr(String(parsed));
                                                updateUnit(activeUnitIndex, 'legalFeePercentage', parsed);
                                            }}
                                            className={`${commonInputClass} ${unitsData[activeUnitIndex].isLegalNA ? 'bg-slate-50 dark:bg-zinc-800/50 text-slate-400 border-dashed opacity-70' : ''} pr-24`}
                                            placeholder="10"
                                        />
                                        {!unitsData[activeUnitIndex].isLegalNA && (
                                            <div className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 dark:text-zinc-500 pointer-events-none">
                                                ₦{(unitsData[activeUnitIndex].legalFee || 0).toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                <div className="space-y-2 group">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className={labelClass}>Agency Fee (%)</label>
                                        <label className="flex items-center gap-1.5 cursor-pointer group/na">
                                            <input type="checkbox" checked={unitsData[activeUnitIndex].isAgencyNA} onChange={e => updateUnit(activeUnitIndex, 'isAgencyNA', e.target.checked)} className="rounded border-slate-200 text-primary-600 dark:text-primary-300 focus:ring-primary-500 w-3 h-3" />
                                            <span className="text-2xs font-bold text-slate-400 group-hover/na:text-slate-600 uppercase tracking-tight">N/A</span>
                                        </label>
                                    </div>
                                    <div className="relative rounded-lg shadow-xs">
                                        <input autoComplete="off" data-lpignore="true" 
                                            type="text"
                                            disabled={unitsData[activeUnitIndex].isAgencyNA}
                                            value={unitsData[activeUnitIndex].isAgencyNA ? 'N/A' : agencyPctStr}
                                            onChange={e => {
                                                const raw = e.target.value;
                                                setAgencyPctStr(raw);
                                                if (raw !== '' && !raw.endsWith('.')) {
                                                    updateUnit(activeUnitIndex, 'agencyFeePercentage', parseFormattedNumber(raw));
                                                }
                                            }}
                                            onBlur={() => {
                                                const parsed = parseFormattedNumber(agencyPctStr);
                                                setAgencyPctStr(String(parsed));
                                                updateUnit(activeUnitIndex, 'agencyFeePercentage', parsed);
                                            }}
                                            className={`${commonInputClass} ${unitsData[activeUnitIndex].isAgencyNA ? 'bg-slate-50 dark:bg-zinc-800/50 text-slate-400 border-dashed opacity-70' : ''} pr-24`}
                                            placeholder="10"
                                        />
                                        {!unitsData[activeUnitIndex].isAgencyNA && (
                                            <div className="absolute right-3 top-2.5 text-xs font-bold text-slate-400 dark:text-zinc-500 pointer-events-none">
                                                ₦{(unitsData[activeUnitIndex].agencyFee || 0).toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2 group">
                                    <div className="flex items-center justify-between mb-1">
                                        <label className={labelClass}>Caution Deposit (<NairaSymbol />)</label>
                                        <label className="flex items-center gap-1.5 cursor-pointer group/na">
                                            <input type="checkbox" checked={unitsData[activeUnitIndex].isCautionNA} onChange={e => updateUnit(activeUnitIndex, 'isCautionNA', e.target.checked)} className="rounded border-slate-200 text-primary-600 dark:text-primary-300 focus:ring-primary-500 w-3 h-3" />
                                            <span className="text-2xs font-bold text-slate-400 group-hover/na:text-slate-600 uppercase tracking-tight">N/A</span>
                                        </label>
                                    </div>
                                    <input autoComplete="off" data-lpignore="true" 
                                        type="text"
                                        disabled={unitsData[activeUnitIndex].isCautionNA}
                                        value={unitsData[activeUnitIndex].isCautionNA ? 'N/A' : formatNumberWithCommas(unitsData[activeUnitIndex].cautionDeposit || 0)}
                                        onChange={e => updateUnit(activeUnitIndex, 'cautionDeposit', parseFormattedNumber(e.target.value))}
                                        className={`${commonInputClass} ${unitsData[activeUnitIndex].isCautionNA ? 'bg-slate-50 dark:bg-zinc-800/50 text-slate-400 border-dashed opacity-70' : ''}`}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            {/* ── Settle Historical Ledger ──────────────────────────────
                                Quick-settle button for onboarding existing tenants. Opens
                                the OnboardUnitLedgerModal where the user can bulk-mark all
                                historical billing periods as Paid On Time / Paid Late /
                                Outstanding, plus add advance pre-paid periods. */}
                            {activeUnit.leaseStart && (Number(activeUnit.serviceChargeAmount) > 0 || Number(activeUnit.serviceCharge) > 0) && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => { setLedgerChargeType('SC'); setLedgerModalOpen(true); }}
                                        className="px-3 py-1.5 text-2xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors flex items-center gap-1.5"
                                    >
                                        <CheckCircleIcon className="w-3 h-3" />
                                        Settle SC Historical Ledger
                                    </button>
                                    {minimumVendEnabled && Number(minimumVendAmount) > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => { setLedgerChargeType('MV'); setLedgerModalOpen(true); }}
                                            className="px-3 py-1.5 text-2xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800/40 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center gap-1.5"
                                        >
                                            <CheckCircleIcon className="w-3 h-3" />
                                            Settle MV Historical Ledger
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Total Tenancy Package Summary Card */}
                            <div className="p-3 sm:p-4 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200 dark:border-emerald-900/40 mt-4 shadow-sm">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-2xs font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest leading-none mb-1">
                                            Total Tenancy Package
                                        </p>
                                        <p className="text-2xs text-slate-500 dark:text-zinc-500">
                                            Total payable by the tenant (Rent + Fees + Caution + Service)
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-base font-black text-emerald-700 dark:text-emerald-300">
                                            ₦{totalPayable.toLocaleString('en-NG')}
                                        </p>
                                        <p className="text-3xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-tight">
                                            {unitsData[activeUnitIndex]?.rentFrequency === 'Monthly' ? 'Per Month' : 'Per Annum'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                <div className="space-y-2 group col-span-1 md:col-span-2">
                                    <label className={labelClass}>Tenant Name</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-[minmax(5.5rem,auto)_1fr_1fr] gap-2">
                                        <select 
                                            value={unitsData[activeUnitIndex].occupantTitle || ''} 
                                            onChange={e => {
                                                const title = e.target.value;
                                                updateUnit(activeUnitIndex, 'occupantTitle', title);
                                                const u = unitsData[activeUnitIndex];
                                                updateUnit(activeUnitIndex, 'tenantName', [title, u.occupantFirstName, u.occupantLastName].filter(Boolean).join(' '));
                                            }} 
                                            className={`${commonInputClass} w-full sm:w-auto`}
                                        >
                                            <option value="">Title</option>
                                            <option value="Mr.">Mr.</option>
                                            <option value="Mrs.">Mrs.</option>
                                            <option value="Miss">Miss</option>
                                            <option value="Ms.">Ms.</option>
                                            <option value="Dr.">Dr.</option>
                                            <option value="Chief">Chief</option>
                                            <option value="Barr.">Barr.</option>
                                            <option value="Engr.">Engr.</option>
                                            <option value="Pastor">Pastor</option>
                                            <option value="Rev.">Rev.</option>
                                            <option value="Alhaji">Alhaji</option>
                                            <option value="Alhaja">Alhaja</option>
                                        </select>
                                        <input autoComplete="off" data-lpignore="true"  
                                            type="text" 
                                            value={unitsData[activeUnitIndex].occupantFirstName || ''} 
                                            onChange={e => {
                                                const firstName = e.target.value;
                                                updateUnit(activeUnitIndex, 'occupantFirstName', firstName);
                                                const u = unitsData[activeUnitIndex];
                                                updateUnit(activeUnitIndex, 'tenantName', [u.occupantTitle, firstName, u.occupantLastName].filter(Boolean).join(' '));
                                            }} 
                                            className={`${commonInputClass} min-w-0 w-full`} 
                                            placeholder="First Name" 
                                        />
                                        <input autoComplete="off" data-lpignore="true"  
                                            type="text" 
                                            value={unitsData[activeUnitIndex].occupantLastName || ''} 
                                            onChange={e => {
                                                const lastName = e.target.value;
                                                updateUnit(activeUnitIndex, 'occupantLastName', lastName);
                                                const u = unitsData[activeUnitIndex];
                                                updateUnit(activeUnitIndex, 'tenantName', [u.occupantTitle, u.occupantFirstName, lastName].filter(Boolean).join(' '));
                                            }} 
                                            className={`${commonInputClass} min-w-0 w-full`} 
                                            placeholder="Last Name" 
                                        />
                                    </div>
                                    {!unitsData[activeUnitIndex].occupantFirstName && !unitsData[activeUnitIndex].occupantLastName && unitsData[activeUnitIndex].tenantName && (
                                        <p className="text-2xs text-amber-600 dark:text-amber-400 mt-1">Current legacy name: {unitsData[activeUnitIndex].tenantName} (Please fill first/last name to update)</p>
                                    )}
                                </div>
                                <div className="space-y-2 group">
                                    <label className={labelClass}>Tenant Phone</label>
                                    <input autoComplete="off" data-lpignore="true"  type="tel" value={unitsData[activeUnitIndex].tenantPhone} onChange={e => updateUnit(activeUnitIndex, 'tenantPhone', e.target.value)} className={commonInputClass} placeholder="+234..." />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                                <div className="space-y-2 group">
                                    <label className={labelClass}>Lease Start</label>
                                    <input autoComplete="off" data-lpignore="true"  type="date" value={unitsData[activeUnitIndex].leaseStart} onChange={e => updateUnit(activeUnitIndex, 'leaseStart', e.target.value)} className={commonInputClass} />
                                </div>
                                <div className="space-y-2 group">
                                    <label className={labelClass}>Tenancy Period</label>
                                    <select 
                                        className={commonInputClass} 
                                        value={unitsData[activeUnitIndex].tenancyPeriod || ''} 
                                        onChange={e => updateUnit(activeUnitIndex, 'tenancyPeriod', e.target.value)}
                                    >
                                        <option value="">Manual Entry</option>
                                        <option value="1 Year">1 Year</option>
                                        <option value="2 Years">2 Years</option>
                                        <option value="3 Years">3 Years</option>
                                        <option value="6 Months">6 Months</option>
                                        <option value="Monthly">Monthly / Rolling</option>
                                    </select>
                                </div>
                                <div className="space-y-2 group">
                                    <label className={labelClass}>Lease End</label>
                                    <input autoComplete="off" data-lpignore="true"  type="date" value={unitsData[activeUnitIndex].leaseEnd} onChange={e => updateUnit(activeUnitIndex, 'leaseEnd', e.target.value)} className={commonInputClass} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 items-end">
                                {activeUnitIndex === 0 && ownershipType !== 'owned' && ( // Management fee is property-level, only show it once
                                    <div className="space-y-2 group">
                                        <label className={labelClass}>Management Fee (%)</label>
                                        <div className="flex bg-white dark:bg-zinc-800 p-1.5 rounded-lg ring-1 ring-slate-200 dark:ring-zinc-700 shadow-sm">
                                            <input autoComplete="off" data-lpignore="true" 
                                                type="number"
                                                value={managementFee}
                                                onChange={e => setManagementFee(parseFloat(e.target.value) || 0)}
                                                className="flex-grow bg-transparent border-none text-sm font-bold text-primary-600 dark:text-primary-300 focus:ring-0 placeholder:text-slate-300"
                                                max={100}
                                                placeholder="0"
                                            />
                                            <span className="px-3 text-2xs font-black text-slate-400 uppercase tracking-widest border-l border-slate-100 dark:border-zinc-700 flex items-center">%</span>
                                        </div>
                                    </div>
                                )}

                                <label className={`flex items-center gap-3 p-3 sm:p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs cursor-pointer group hover:ring-2 hover:ring-primary-500/20 transition-all ${activeUnitIndex !== 0 ? 'md:col-start-2' : ''}`}>
                                    <input autoComplete="off" data-lpignore="true" 
                                        type="checkbox"
                                        checked={unitsData[activeUnitIndex].isPeriodicReviewEnabled}
                                        onChange={e => updateUnit(activeUnitIndex, 'isPeriodicReviewEnabled', e.target.checked)}
                                        className="rounded border-slate-200 text-primary-600 dark:text-primary-300 focus:ring-primary-500"
                                    />
                                    <span className="text-2xs font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-widest">Enable Periodic Review</span>
                                </label>
                            </div>

                            {unitsData[activeUnitIndex].isPeriodicReviewEnabled && (
                                <div className="p-3 sm:p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm animate-fade-in space-y-2 group">
                                    <label className={labelClass}>Next Rent Review</label>
                                    <input autoComplete="off" data-lpignore="true"  type="date" value={unitsData[activeUnitIndex].nextRentReview} onChange={e => updateUnit(activeUnitIndex, 'nextRentReview', e.target.value)} className={commonInputClass} />
                                </div>
                            )}

                            {/* MUTE / DEACTIVATE UNIT toggle — replaces hard delete.
                                Muted units are hidden from the workspace grid but
                                remain in the Edit Modal with a MUTED badge.
                                Preserves sequential integrity and ledger history. */}
                            <div className="flex items-center justify-between p-3 sm:p-4 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800 mt-3">
                                <div>
                                    <p className="text-xs font-bold text-slate-600 dark:text-zinc-300">
                                        {(unitsData[activeUnitIndex] as any).status === 'Muted' ? 'Unit Muted' : 'Mute Unit'}
                                    </p>
                                    <p className="text-3xs text-slate-400 dark:text-zinc-500 mt-0.5">
                                        {(unitsData[activeUnitIndex] as any).status === 'Muted'
                                            ? 'Hidden from workspace. Ledger history preserved.'
                                            : 'Hide from daily workspace without deleting. History preserved.'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const currentStatus = (unitsData[activeUnitIndex] as any).status;
                                        updateUnit(activeUnitIndex, 'status' as any,
                                            currentStatus === 'Muted' ? 'Vacant' : 'Muted'
                                        );
                                        formTouched.current = true;
                                    }}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                                        (unitsData[activeUnitIndex] as any).status === 'Muted'
                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50'
                                            : 'bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-300 dark:hover:bg-zinc-600'
                                    }`}
                                >
                                    {(unitsData[activeUnitIndex] as any).status === 'Muted' ? 'Unmute / Reactivate' : 'Mute / Pause'}
                                </button>
                            </div>
                        </div>
                    </AccordionSection>
                    </div>
                )}

                {/* Image Upload Section */}
                <AccordionSection id="media" isOpen={openSections.media} onToggle={toggleSection} title="Photos & Documents" subtitle="Media" icon={<UploadIcon className="w-3.5 h-3.5" />} iconBg="bg-slate-600">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-2xs font-black text-primary-600 dark:text-primary-300 uppercase tracking-widest hover:underline flex items-center gap-2"
                        >
                            Upload Files
                        </button>
                        <input autoComplete="off" data-lpignore="true" 
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            className="hidden"
                            accept="image/*,application/pdf"
                        />

                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4">
                        {images.length > 0 ? images.map((img, idx) => (
                            <div key={idx} className="relative group aspect-square rounded-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden bg-slate-50 dark:bg-zinc-900 shadow-sm">
                                {img.type.startsWith('image/') ? (
                                    <img src={img.dataUrl} alt="Prop" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-2xs font-black text-slate-400 uppercase tracking-widest">
                                        <OfficeBuildingIcon className="w-6 h-6 mb-1 opacity-20" />
                                        PDF DOC
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => handleRemoveImage(idx)}
                                    className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                >
                                    <TrashIcon className="w-3 h-3" />
                                </button>
                            </div>
                        )) : (
                            <div className="col-span-full py-8 sm:py-12 border-2 border-dashed border-slate-100 dark:border-zinc-800 rounded-3xl text-center">
                                <OfficeBuildingIcon className="w-8 h-8 mx-auto text-slate-200 dark:text-zinc-800 mb-2" />
                                <p className="text-2xs font-black text-slate-400 uppercase tracking-widest">No photos yet</p>
                            </div>
                        )}
                    </div>
                </AccordionSection>
            </div>

            <div className="sticky -bottom-4 sm:-bottom-5 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-4 pb-4 sm:pb-5 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap-reverse sm:justify-end gap-2 sm:gap-3 z-50 mt-4 rounded-b-2xl">
                <button type="button" onClick={async () => {
                    if (formTouched.current) {
                        const ok = await confirm({
                            title: 'Discard changes?',
                            message: 'You have unsaved changes. Discard them?',
                            confirmLabel: 'Discard',
                            cancelLabel: 'Keep Editing',
                            danger: true,
                        });
                        if (!ok) return;
                    }
                    onClose();
                }} className="flex-1 sm:flex-none px-6 sm:px-10 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-semibold rounded-lg sm:rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2">
                    <XIcon className="w-4 h-4" /> Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="flex-1 sm:flex-none px-8 sm:px-12 py-2.5 bg-primary-600 text-white text-xs font-semibold rounded-lg sm:rounded-2xl shadow-2xl shadow-primary-500/30 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    <SaveIcon className="w-4 h-4" /> Save Property
                </button>
            </div>
            {ConfirmDialog}

            {/* OnboardUnitLedgerModal — opened by "Settle Historical Ledger" buttons.
                Lets the user bulk-settle past billing periods during onboarding. */}
            {ledgerModalOpen && (
                <OnboardUnitLedgerModal
                    unit={{
                        ...(propertyToEdit || {}),
                        rentalDetails: {
                            leaseStart: activeUnit.leaseStart,
                            leaseEnd: activeUnit.leaseEnd,
                            rentFrequency: activeUnit.rentFrequency,
                            serviceChargeAmount: Number(activeUnit.serviceChargeAmount) || Number(activeUnit.serviceCharge) || 0,
                            serviceCharge: Number(activeUnit.serviceCharge) || 0,
                            scPeriods: activeUnit.scPeriods,
                            mvPeriods: activeUnit.mvPeriods,
                        } as any,
                        minimumVendEnabled,
                        minimumVendAmount: Number(minimumVendAmount) || 0,
                    } as Property}
                    chargeType={ledgerChargeType}
                    onClose={() => setLedgerModalOpen(false)}
                    onApply={(updatedPeriods: ServiceChargePeriod[]) => {
                        const periodsKey = ledgerChargeType === 'SC' ? 'scPeriods' : 'mvPeriods';
                        updateUnit(activeUnitIndex, periodsKey as any, updatedPeriods);
                        // Auto-update aggregate SC status
                        if (ledgerChargeType === 'SC') {
                            const allSettled = updatedPeriods.every(p => p.status === 'paid' || p.status === 'advance_paid');
                            const anyUnsettled = updatedPeriods.some(p =>
                                p.status === 'outstanding' || (p.status === 'late' && !p.paidDate)
                            );
                            let aggregate: 'PAID_FULLY' | 'PARTIALLY_PAID' | 'UNPAID' = 'UNPAID';
                            if (allSettled) aggregate = 'PAID_FULLY';
                            else if (anyUnsettled && updatedPeriods.some(p => p.status === 'paid' || p.status === 'advance_paid')) aggregate = 'PARTIALLY_PAID';
                            else if (anyUnsettled) aggregate = 'UNPAID';
                            else aggregate = 'PARTIALLY_PAID';
                            updateUnit(activeUnitIndex, 'serviceChargeStatus', aggregate);
                        }
                    }}
                />
            )}
        </form>
    );
};

export default PropertyForm;
