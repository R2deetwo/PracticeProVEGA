import React, { useState, useMemo } from 'react';
import {
    Matter, User, Contact, MatterType, BillingModel, MatterStatus,
    ContactType, CourtType, LitigationParty, ModalType
} from '../../types';
import { useUI } from '../../contexts/UIContext';
import { XIcon, ChevronRightIcon } from '../../constants';
import {
    MATTER_PROCESS_CONFIGS,
    LITIGATION_PROCESS_OPTIONS,
    getProcessConfigByLabel,
    MatterProcessConfig,
} from '../../config/matterProcessConfig';
import { v4 as uuidv4 } from 'uuid';
import { 
    autoFormatSuitTitle, 
    formatNumberWithCommas, 
    parseFormattedNumber 
} from '../../utils/formatting';
import { RealEstateUnit } from '../../types';
import { recordActionUsed } from './MatterIntakeWizard';

// ── Icons ────────────────────────────────────────────────────────────────────
const Icon: React.FC<{ d: string; className?: string }> = ({ d, className = 'w-5 h-5' }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
);
const ICONS: Record<string, string> = {
    litigation:  'M12 3v17.25m0 0c1.414 0 2.813-.198 4.15-.572M12 20.25c-1.414 0-2.813-.198-4.15-.572M3 13.5h18',
    realestate:  'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21',
    corporate:   'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175',
    family:      'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0',
    employment:  'M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18M3.75 14.15v4.25c0 1.094.787 2.036 1.872 2.18M12 12.75h.008v.008H12v-.008z',
    other:       'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5M13.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25',
};

const MATTER_TYPES = [
    { type: MatterType.CivilLitigation,     label: 'Litigation',       icon: ICONS.litigation,  color: 'from-red-500 to-rose-600',      desc: 'Writs, motions, court filings' },
    { type: MatterType.RealEstate,          label: 'Real Estate',      icon: ICONS.realestate,  color: 'from-emerald-500 to-teal-600',  desc: 'Property transactions & titles' },
    { type: MatterType.CorporateCommercial, label: 'Corporate',        icon: ICONS.corporate,   color: 'from-blue-500 to-indigo-600',   desc: 'CAC filings, M&A, contracts' },
    { type: MatterType.FamilyLaw,           label: 'Family Law',       icon: ICONS.family,      color: 'from-pink-500 to-rose-500',     desc: 'Divorce, custody, probate' },
    { type: MatterType.EmploymentLabor,     label: 'Employment',       icon: ICONS.employment,  color: 'from-amber-500 to-orange-600',  desc: 'Wrongful dismissal, NICN' },
    { type: MatterType.Tax,                 label: 'Tax',              icon: ICONS.litigation,  color: 'from-violet-500 to-purple-600', desc: 'FIRS objections, TAT appeals' },
    { type: MatterType.OilGas,              label: 'Oil & Gas',        icon: ICONS.corporate,   color: 'from-slate-600 to-zinc-700',    desc: 'NUPRC licensing, PIA matters' },
    { type: MatterType.Other,              label: 'Other / Advisory', icon: ICONS.other,       color: 'from-slate-400 to-slate-500',   desc: 'Custom or bespoke matters' },
];

// Legacy constant kept for recordActionUsed compatibility — display now comes from config
const LITIGATION_ACTIONS = LITIGATION_PROCESS_OPTIONS.map(o => o.label);
const COURTS = [
    { value: CourtType.StateHighCourt,          label: 'State High Court' },
    { value: CourtType.FederalHighCourt,        label: 'Federal High Court' },
    { value: CourtType.NationalIndustrialCourt, label: 'National Industrial Court' },
    { value: CourtType.MagistrateCourt,         label: 'Magistrate Court' },
    { value: CourtType.CourtOfAppeal,           label: 'Court of Appeal' },
    { value: CourtType.SupremeCourt,            label: 'Supreme Court' },
];

const inp = 'w-full px-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all text-slate-900 dark:text-white placeholder-slate-400';
const lbl = 'block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1';

interface SmartMatterModalProps {
    contacts: Contact[];
    users: User[];
    currentUser: User;
    onClose: () => void;
    onAddMatter: (matter: Omit<Matter, 'id' | 'referenceNumber'>, client: { data: Omit<Contact, 'id'>; createPortal: boolean } | null) => Promise<any>;
    onNavigate?: (view: any, id?: string | null, context?: any) => void;
    openModal?: (type: ModalType, id?: string | null, ctx?: any) => void;
    initialContext?: any;
}

export const SmartMatterModal: React.FC<SmartMatterModalProps> = ({
    contacts, users, currentUser, onClose, onAddMatter, onNavigate, initialContext,
}) => {
    const { addToast } = useUI();

    // Step 0 = pick type, Step 1 = fill details
    const [step, setStep] = useState<0 | 1>(0);
    const [matterType, setMatterType] = useState<MatterType | null>(null);

    // Shared fields
    const [title, setTitle]           = useState('');
    const [clientId, setClientId]     = useState('');
    const [newClientName, setNewClientName] = useState('');
    const [isNewClient, setIsNewClient]     = useState(false);
    const [billingModel, setBillingModel]   = useState<BillingModel>(BillingModel.Hourly);
    const [hourlyRate, setHourlyRate]       = useState(100000);
    const [fixedFeeAmount, setFixedFeeAmount]     = useState(0);
    const [billingPercentage, setBillingPercentage] = useState(0);
    const [billingBase, setBillingBase]           = useState<'Rent' | 'Value' | 'Outcome' | 'Custom'>('Rent');
    const [startDrafting, setStartDrafting] = useState(false);
    const [isSubmitting, setIsSubmitting]   = useState(false);

    // Litigation fields
    const [legalAction, setLegalAction]           = useState(MATTER_PROCESS_CONFIGS[0].processCategoryName);
    const [court, setCourt]                       = useState<string>(CourtType.FederalHighCourt);
    const [judicialDivision, setJudicialDivision] = useState('');
    const [claimant, setClaimant]                 = useState('');
    const [defendant, setDefendant]               = useState('');
    const [suitNumber, setSuitNumber]             = useState('');
    // Dynamic process-specific intake field values keyed by fieldId
    const [processFields, setProcessFields]       = useState<Record<string, string>>({});
    const setProcessField = (id: string, val: string) =>
        setProcessFields(prev => ({ ...prev, [id]: val }));

    // Derive active process config from selected legalAction
    const activeProcessConfig: MatterProcessConfig =
        getProcessConfigByLabel(legalAction) ?? MATTER_PROCESS_CONFIGS[0];

    // Real Estate fields
    const [propertyValue, setPropertyValue]       = useState(0);
    const [titleDoc, setTitleDoc]                 = useState('');
    const [linkedPropertyId, setLinkedPropertyId] = useState('');
    const [propertyAddress, setPropertyAddress]   = useState('');
    const [propertyCategory, setPropertyCategory] = useState('Tenanted Property');
    const [propertyType, setPropertyType]         = useState('Residential');
    const [propertyStatus, setPropertyStatus]     = useState('Occupied');
    const [targetPrice, setTargetPrice]           = useState(0);
    const [listingAgent, setListingAgent]         = useState('');
    const [disputeCourt, setDisputeCourt]         = useState('');
    const [disputeSuitNo, setDisputeSuitNo]       = useState('');
    const [adverseParty, setAdverseParty]         = useState('');
    
    // Multi-unit support
    const [numberOfUnits, setNumberOfUnits]       = useState(1);
    const [activeUnitIndex, setActiveUnitIndex]   = useState(0);
    const [unitsData, setUnitsData] = useState<RealEstateUnit[]>([{
        id: uuidv4(),
        unitName: 'Unit 1',
        rentAmount: 0,
        rentFrequency: 'Annually',
        leaseStart: '',
        leaseEnd: '',
        tenantName: '',
    }]);

    // Keep unitsData in sync with numberOfUnits
    React.useEffect(() => {
        setUnitsData(prev => {
            if (prev.length === numberOfUnits) return prev;
            if (numberOfUnits > prev.length) {
                const added: RealEstateUnit[] = [];
                for (let i = prev.length; i < numberOfUnits; i++) {
                    added.push({
                        id: uuidv4(),
                        unitName: `Unit ${i + 1}`,
                        rentAmount: 0,
                        rentFrequency: 'Annually',
                        leaseStart: '',
                        leaseEnd: '',
                        tenantName: '',
                    });
                }
                return [...prev, ...added];
            } else {
                return prev.slice(0, numberOfUnits);
            }
        });
    }, [numberOfUnits]);
    
    // Auto-calculate Percentage Fee
    React.useEffect(() => {
        if (billingModel === BillingModel.Percentage) {
            if (billingBase === 'Rent') {
                const totalRent = unitsData.reduce((sum, u) => sum + (u.rentAmount || 0), 0);
                setFixedFeeAmount(Math.round((billingPercentage / 100) * totalRent));
            } else if (billingBase === 'Value') {
                setFixedFeeAmount(Math.round((billingPercentage / 100) * propertyValue));
            }
        }
    }, [billingModel, billingPercentage, billingBase, unitsData, propertyValue]);

    const updateUnit = (index: number, field: keyof RealEstateUnit, value: any) => {
        setUnitsData(prev => {
            const newUnits = [...prev];
            const updatedUnit = { ...newUnits[index], [field]: value };
            
            // Auto-calculate lease end if start or period changed
            if (field === 'leaseStart' || field === 'tenancyPeriod') {
                const start = field === 'leaseStart' ? value : updatedUnit.leaseStart;
                const period = field === 'tenancyPeriod' ? value : updatedUnit.tenancyPeriod;
                
                if (start && period) {
                    const date = new Date(start);
                    if (period === '1 Year') date.setFullYear(date.getFullYear() + 1);
                    else if (period === '2 Years') date.setFullYear(date.getFullYear() + 2);
                    else if (period === '3 Years') date.setFullYear(date.getFullYear() + 3);
                    else if (period === '6 Months') date.setMonth(date.getMonth() + 6);
                    else if (period === 'Monthly') date.setMonth(date.getMonth() + 1);
                    
                    date.setDate(date.getDate() - 1);
                    updatedUnit.leaseEnd = date.toISOString().split('T')[0];
                }
            }
            
            newUnits[index] = updatedUnit;
            return newUnits;
        });
    };

    // Litigation toggle for RE matters
    const [reHasLitigation, setReHasLitigation]  = useState(false);

    // Corporate fields
    const [rcNumber, setRcNumber]   = useState('');
    const [shareCapital, setShareCapital] = useState(0);

    const isLitigation = matterType === MatterType.CivilLitigation ||
        matterType === MatterType.Tax || matterType === MatterType.OilGas ||
        matterType === MatterType.EmploymentLabor;

    // All properties across all contacts for the property picker
    const allProperties = useMemo(() =>
        contacts.flatMap(c => (c.properties || []).map(p => ({ ...p, ownerName: c.name, ownerId: c.id })))
    , [contacts]);

    const handleTypeSelect = (t: MatterType) => {
        setMatterType(t);
        setStep(1);
    };

    const autoTitle = useMemo(() => {
        if (matterType === MatterType.RealEstate) {
            const address = propertyAddress.split(',')[0].trim();
            const clientName = isNewClient ? newClientName : contacts.find(c => c.id === clientId)?.name;
            if (address && clientName) return `${address} (${clientName})`;
            if (address) return address;
            return '';
        }
        if (!isLitigation || !claimant) return '';
        if (activeProcessConfig.opposingPartyLabel === null) return claimant;
        if (!defendant) return '';
        try {
            const c: LitigationParty[] = [{ id: 'tmp-c', name: claimant, role: activeProcessConfig.primaryPartyLabel, isRepresented: false }];
            const d: LitigationParty[] = [{ id: 'tmp-d', name: defendant, role: activeProcessConfig.opposingPartyLabel ?? 'Respondent', isRepresented: false }];
            return autoFormatSuitTitle(c, d);
        } catch { return defendant ? `${claimant} v ${defendant}` : claimant; }
    }, [matterType, propertyAddress, isNewClient, newClientName, clientId, contacts, isLitigation, claimant, defendant, activeProcessConfig]);

    const handleSubmit = async () => {
        if (!title && !autoTitle) { addToast('Please enter a matter title.', { type: 'error' }); return; }
        if (!isNewClient && !clientId) { addToast('Please select or create a client.', { type: 'error' }); return; }

        setIsSubmitting(true);
        try {
            const finalTitle = title || autoTitle;
            const parties: LitigationParty[] = [];
            if (isLitigation) {
                if (claimant) parties.push({ id: `p-${Date.now()}-1`, name: claimant, role: activeProcessConfig.primaryPartyLabel, isRepresented: false });
                if (defendant && activeProcessConfig.opposingPartyLabel) parties.push({ id: `p-${Date.now()}-2`, name: defendant, role: activeProcessConfig.opposingPartyLabel, isRepresented: false });
            }

            const matterData: Omit<Matter, 'id' | 'referenceNumber'> = {
                firmId: currentUser.firmId || '',
                title: finalTitle,
                type: matterType!,
                clientId: clientId || '',
                billingModel,
                hourlyRate: billingModel === BillingModel.Hourly ? hourlyRate : 0,
                fixedFeeAmount: (billingModel === BillingModel.FixedFee || billingModel === BillingModel.Retainer || billingModel === BillingModel.Percentage) ? fixedFeeAmount : 0,
                billingPercentage: billingModel === BillingModel.Percentage ? billingPercentage : undefined,
                billingBase: billingModel === BillingModel.Percentage ? billingBase : undefined,
                assignedUsers: [currentUser.id],
                status: MatterStatus.Active,
                createdAt: new Date().toISOString(),
                stageLastUpdated: new Date().toISOString(),
                stage: 'Intake',
                court: court,
                judicialDivision,
                suitNumber,
                originatingProcess: isLitigation ? legalAction : '',
                parties,
                propertyValue: matterType === MatterType.RealEstate ? propertyValue : 0,
                titleRegistrationDetails: matterType === MatterType.RealEstate ? titleDoc : '',
                rcNumber: matterType === MatterType.CorporateCommercial ? rcNumber : '',
                shareCapital: matterType === MatterType.CorporateCommercial ? shareCapital : 0,
                specialtyData: {
                    realEstate: matterType === MatterType.RealEstate ? { 
                        purchasePrice: propertyValue, 
                        titleDocument: titleDoc as any, 
                        propertyId: linkedPropertyId,
                        units: unitsData 
                    } : undefined,
                    firmRepresentingRole: activeProcessConfig.primaryPartyLabel,
                    processIntakeFields: processFields,
                    draftingExpectations: activeProcessConfig.draftingExpectations,
                } as any,
            };

            const clientPayload = isNewClient && newClientName ? {
                data: { name: newClientName, contactType: ContactType.Individual, email: '', phone: '', address: '', firmId: currentUser.firmId || '', category: 'Client' },
                createPortal: false,
            } : null;

            if (isLitigation && legalAction) recordActionUsed(legalAction);

            const res = await onAddMatter(matterData, clientPayload);

            if (res?.id) {
                addToast(`Matter "${finalTitle}" created.`, { type: 'success' });
                onClose();
                if (startDrafting && onNavigate) {
                    onNavigate('editor', null, { matterId: res.id, autoStartDrafting: true });
                } else if (onNavigate) {
                    onNavigate('matterDetail', res.id);
                }
            }
        } catch (err: any) {
            addToast(`Failed: ${err.message || 'Unknown error'}`, { type: 'error' });
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="smart-matter-title">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-white dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-700/60">

                {/* Accent */}
                <div className="h-1 w-full flex-shrink-0 bg-gradient-to-r from-primary-600 via-primary-500 to-indigo-500" />

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        {step === 1 && (
                            <button onClick={() => setStep(0)} className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
                                <ChevronRightIcon className="w-4 h-4 rotate-180" />
                            </button>
                        )}
                        <div>
                            <p className="text-[10px] font-black text-primary-600 dark:text-primary-400 uppercase tracking-[0.2em]">New Matter</p>
                            <h1 id="smart-matter-title" className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                                {step === 0 ? 'What type of matter is this?' : MATTER_TYPES.find(m => m.type === matterType)?.label + ' Matter'}
                            </h1>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

                    {/* Step 0 — Type picker */}
                    {step === 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {MATTER_TYPES.map(mt => (
                                <button
                                    key={mt.type}
                                    onClick={() => handleTypeSelect(mt.type)}
                                    className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-slate-100 dark:border-zinc-800 hover:border-primary-400 hover:shadow-md dark:hover:border-primary-600 bg-white dark:bg-zinc-800/50 transition-all group text-center"
                                >
                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${mt.color} flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform`}>
                                        <Icon d={mt.icon} className="w-5 h-5" />
                                    </div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-white">{mt.label}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 leading-tight">{mt.desc}</p>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Step 1 — Detail form */}
                    {step === 1 && (
                        <div className="space-y-5">
                            {/* ── Litigation: Dynamic Process-Driven Fields ── */}
                            {isLitigation && (
                                <>
                                    {/* Process selector */}
                                    <div>
                                        <label className={lbl}>Originating Process / Action</label>
                                        <select
                                            value={legalAction}
                                            onChange={e => { setLegalAction(e.target.value); setProcessFields({}); }}
                                            className={inp}
                                        >
                                            {MATTER_PROCESS_CONFIGS.map(cfg => (
                                                <option key={cfg.processId} value={cfg.processCategoryName}>
                                                    {cfg.processCategoryName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Primary party */}
                                    <div className={activeProcessConfig.opposingPartyLabel ? 'grid grid-cols-2 gap-3' : ''}>
                                        <div>
                                            <label className={lbl}>{activeProcessConfig.primaryPartyLabel}</label>
                                            <input autoComplete="off" data-lpignore="true"  className={inp} value={claimant} onChange={e => setClaimant(e.target.value)} placeholder={`${activeProcessConfig.primaryPartyLabel} name...`} />
                                        </div>
                                        {/* Opposing party — hidden for ex parte / regulatory */}
                                        {activeProcessConfig.opposingPartyLabel && (
                                            <div>
                                                <label className={lbl}>{activeProcessConfig.opposingPartyLabel}</label>
                                                <input autoComplete="off" data-lpignore="true"  className={inp} value={defendant} onChange={e => setDefendant(e.target.value)} placeholder={`${activeProcessConfig.opposingPartyLabel} name...`} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Secondary / additional parties */}
                                    {activeProcessConfig.secondaryParties.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider self-center mr-1">Also may include:</span>
                                            {activeProcessConfig.secondaryParties.map(p => (
                                                <span key={p} className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 rounded-full border border-slate-200 dark:border-zinc-700">
                                                    {p}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Court + Division */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className={lbl}>Court</label>
                                            <select value={court} onChange={e => setCourt(e.target.value)} className={inp}>
                                                {COURTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={lbl}>Judicial Division / State</label>
                                            <input autoComplete="off" data-lpignore="true"  className={inp} value={judicialDivision} onChange={e => setJudicialDivision(e.target.value)} placeholder="e.g. Lagos (Ikeja)" />
                                        </div>
                                    </div>

                                    {/* Suit number */}
                                    <div>
                                        <label className={lbl}>Suit Number (if known)</label>
                                        <input autoComplete="off" data-lpignore="true"  className={inp} value={suitNumber} onChange={e => setSuitNumber(e.target.value)} placeholder="e.g. FHC/L/CS/000/2026" />
                                    </div>

                                    {/* ── Process-specific dynamic intake fields ── */}
                                    {activeProcessConfig.keyIntakeFields.length > 0 && (
                                        <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-zinc-800">
                                            <p className="text-[10px] font-black text-primary-500 uppercase tracking-[0.15em]">Process-Specific Details</p>
                                            {activeProcessConfig.keyIntakeFields.map(field => (
                                                <div key={field.fieldId}>
                                                    <label className={lbl}>
                                                        {field.label}
                                                        {field.required && <span className="text-red-500 ml-0.5">*</span>}
                                                    </label>
                                                    {field.type === 'textarea' ? (
                                                        <textarea
                                                            rows={3}
                                                            className={inp + ' resize-none'}
                                                            value={processFields[field.fieldId] ?? ''}
                                                            onChange={e => setProcessField(field.fieldId, e.target.value)}
                                                            placeholder={field.placeholder ?? ''}
                                                        />
                                                    ) : field.type === 'date' ? (
                                                        <input autoComplete="off" data-lpignore="true" 
                                                            type="date"
                                                            className={inp}
                                                            value={processFields[field.fieldId] ?? ''}
                                                            onChange={e => setProcessField(field.fieldId, e.target.value)}
                                                        />
                                                    ) : field.type === 'number' ? (
                                                        <div className="relative">
                                                            {field.isCurrency && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₦</span>}
                                                            <input autoComplete="off" data-lpignore="true" 
                                                                type={field.isCurrency ? 'text' : 'number'}
                                                                className={inp + (field.isCurrency ? ' pl-7' : '')}
                                                                value={field.isCurrency ? formatNumberWithCommas(processFields[field.fieldId]) : (processFields[field.fieldId] ?? '')}
                                                                onChange={e => setProcessField(field.fieldId, field.isCurrency ? e.target.value.replace(/[^0-9.-]/g, '') : e.target.value)}
                                                                placeholder={field.placeholder ?? '0'}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <input autoComplete="off" data-lpignore="true" 
                                                            type="text"
                                                            className={inp}
                                                            value={processFields[field.fieldId] ?? ''}
                                                            onChange={e => setProcessField(field.fieldId, e.target.value)}
                                                            placeholder={field.placeholder ?? ''}
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* ALOA hint */}
                                    <div className="flex items-start gap-2 p-3 bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/30 rounded-xl">
                                        <svg className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.347.347a3.75 3.75 0 01-5.3 0l-.347-.347z" /></svg>
                                        <p className="text-[11px] text-primary-700 dark:text-primary-300 leading-snug">
                                            <span className="font-bold">ALOA will draft: </span>
                                            {activeProcessConfig.draftingExpectations}
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* Matter title */}
                            <div>
                                <label className={lbl}>Matter Title</label>
                                {autoTitle ? (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 px-3 py-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg text-sm font-medium text-primary-800 dark:text-primary-200">
                                            <span className="text-[10px] font-bold text-primary-500 uppercase tracking-wide flex-shrink-0">Auto</span>
                                            {autoTitle}
                                        </div>
                                        <input autoComplete="off" data-lpignore="true"  className={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="Override auto-title (optional)" />
                                    </div>
                                ) : (
                                    <input autoComplete="off" data-lpignore="true"  className={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Adeyemi v Okafor — Breach of Contract" />
                                )}
                            </div>

                            {/* ── Real Estate: Full Property Intake ── */}
                            {matterType === MatterType.RealEstate && (
                                <>
                                    {/* Link to existing property */}
                                    {allProperties.length > 0 && (
                                        <div>
                                            <label className={lbl}>Link to Existing Property</label>
                                            <select value={linkedPropertyId} onChange={e => setLinkedPropertyId(e.target.value)} className={inp}>
                                                <option value="">— Start Fresh —</option>
                                                {allProperties.map(p => (
                                                    <option key={p.id} value={p.id}>{p.address} ({p.ownerName})</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Property Address */}
                                    <div>
                                        <label className={lbl}>Property Address <span className="text-red-500">*</span></label>
                                        <textarea rows={2} className={inp + ' resize-none'} value={propertyAddress} onChange={e => setPropertyAddress(e.target.value)} placeholder="Full property address..." />
                                    </div>

                                    {/* Category + Type + Status */}
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className={lbl}>Category</label>
                                            <select value={propertyCategory} onChange={e => setPropertyCategory(e.target.value)} className={inp}>
                                                <option value="Tenanted Property">Tenanted / Rental</option>
                                                <option value="Property For Sale">For Sale</option>
                                                <option value="Personal Residence">Personal Residence</option>
                                                <option value="Disputed Property">Disputed Land</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={lbl}>Property Type</label>
                                            <select value={propertyType} onChange={e => setPropertyType(e.target.value)} className={inp}>
                                                <option>Residential</option>
                                                <option>Commercial</option>
                                                <option>Industrial</option>
                                                <option>Land</option>
                                                <option>Mixed Use</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className={lbl}>Status</label>
                                            <select value={propertyStatus} onChange={e => setPropertyStatus(e.target.value)} className={inp}>
                                                <option>Occupied</option>
                                                <option>Vacant</option>
                                                <option>Listed</option>
                                                <option>Maintenance</option>
                                                <option>Sold</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Valuation + Title Doc + Units */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className={lbl}>Valuation (₦)</label>
                                            <input autoComplete="off" data-lpignore="true"  
                                                type="text" 
                                                className={inp} 
                                                value={formatNumberWithCommas(propertyValue)} 
                                                onChange={e => setPropertyValue(parseFormattedNumber(e.target.value))} 
                                                placeholder="0.00" 
                                            />
                                        </div>
                                        <div>
                                            <label className={lbl}>Title Document</label>
                                            <select value={titleDoc} onChange={e => setTitleDoc(e.target.value)} className={inp}>
                                                <option value="">Select...</option>
                                                {['Certificate of Occupancy (C of O)', "Governor's Consent", 'Deed of Assignment', 'Right of Occupancy (R of O)', 'Deed of Conveyance', 'Survey Plan', 'Gazette', 'Other'].map(t => <option key={t}>{t}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={lbl}>Total Units</label>
                                            <input autoComplete="off" data-lpignore="true"  
                                                type="number" 
                                                min={1} 
                                                className={inp} 
                                                value={numberOfUnits} 
                                                onChange={e => setNumberOfUnits(Math.max(1, parseInt(e.target.value) || 1))} 
                                                placeholder="1" 
                                            />
                                        </div>
                                    </div>

                                    {/* Unit Selection Tabs (only if multiple units) */}
                                    {numberOfUnits > 1 && (
                                        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
                                            {unitsData.map((unit, idx) => (
                                                <button
                                                    key={unit.id}
                                                    type="button"
                                                    onClick={() => setActiveUnitIndex(idx)}
                                                    className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                                        activeUnitIndex === idx
                                                        ? 'bg-primary-600 text-white'
                                                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
                                                    }`}
                                                >
                                                    {unit.unitName}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Tenanted / Rental sub-section */}
                                    {(propertyCategory === 'Tenanted Property' || propertyCategory === 'Personal Residence' || propertyCategory === 'Other') && (
                                        <div className="space-y-3 p-4 bg-emerald-50/50 dark:bg-emerald-900/5 border border-emerald-100 dark:border-emerald-900/20 rounded-xl animate-fade-in">
                                            <div className="flex justify-between items-center">
                                                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.15em]">
                                                    {numberOfUnits > 1 ? `${unitsData[activeUnitIndex].unitName} Details` : 'Rental / Lease Details'}
                                                </p>
                                                {numberOfUnits > 1 && (
                                                    <input autoComplete="off" data-lpignore="true"  
                                                        className="text-[10px] font-bold bg-transparent border-none text-emerald-600 focus:ring-0 p-0 text-right w-24"
                                                        value={unitsData[activeUnitIndex].unitName}
                                                        onChange={e => updateUnit(activeUnitIndex, 'unitName', e.target.value)}
                                                        placeholder="Unit Name"
                                                    />
                                                )}
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className={lbl}>Tenant Name</label>
                                                    <input autoComplete="off" data-lpignore="true"  
                                                        className={inp} 
                                                        value={unitsData[activeUnitIndex].tenantName || ''} 
                                                        onChange={e => updateUnit(activeUnitIndex, 'tenantName', e.target.value)} 
                                                        placeholder="Full name / entity" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className={lbl}>Rent Amount (₦)</label>
                                                    <input autoComplete="off" data-lpignore="true"  
                                                        type="text" 
                                                        className={inp} 
                                                        value={formatNumberWithCommas(unitsData[activeUnitIndex].rentAmount)} 
                                                        onChange={e => updateUnit(activeUnitIndex, 'rentAmount', parseFormattedNumber(e.target.value))} 
                                                        placeholder="0.00" 
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <label className={lbl}>Lease Start</label>
                                                    <input autoComplete="off" data-lpignore="true"  
                                                        type="date" 
                                                        className={inp} 
                                                        value={unitsData[activeUnitIndex].leaseStart || ''} 
                                                        onChange={e => updateUnit(activeUnitIndex, 'leaseStart', e.target.value)} 
                                                     />
                                                 </div>
                                                 <div>
                                                     <label className={lbl}>Period</label>
                                                     <select 
                                                         className={inp} 
                                                         value={unitsData[activeUnitIndex].tenancyPeriod || ''} 
                                                         onChange={e => updateUnit(activeUnitIndex, 'tenancyPeriod', e.target.value)}
                                                     >
                                                         <option value="">Manual</option>
                                                        <option value="1 Year">1 Year</option>
                                                        <option value="2 Years">2 Years</option>
                                                        <option value="3 Years">3 Years</option>
                                                        <option value="6 Months">6 Months</option>
                                                        <option value="Monthly">Monthly</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className={lbl}>Lease End</label>
                                                    <input autoComplete="off" data-lpignore="true"  
                                                        type="date" 
                                                        className={inp} 
                                                        value={unitsData[activeUnitIndex].leaseEnd || ''} 
                                                        onChange={e => updateUnit(activeUnitIndex, 'leaseEnd', e.target.value)} 
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* For Sale sub-section */}
                                    {propertyCategory === 'Property For Sale' && (
                                        <div className="space-y-3 p-4 bg-blue-50/50 dark:bg-blue-900/5 border border-blue-100 dark:border-blue-900/20 rounded-xl animate-fade-in">
                                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.15em]">Listing Details</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className={lbl}>Target Price (₦)</label>
                                                    <input autoComplete="off" data-lpignore="true"  
                                                        type="text" 
                                                        className={inp} 
                                                        value={formatNumberWithCommas(targetPrice)} 
                                                        onChange={e => setTargetPrice(parseFormattedNumber(e.target.value))} 
                                                        placeholder="0.00" 
                                                    />
                                                </div>
                                                <div>
                                                    <label className={lbl}>Listing Agent</label>
                                                    <input autoComplete="off" data-lpignore="true"  className={inp} value={listingAgent} onChange={e => setListingAgent(e.target.value)} placeholder="Agent / firm name" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Disputed sub-section */}
                                    {propertyCategory === 'Disputed Property' && (
                                        <div className="space-y-3 p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl">
                                            <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.15em]">Dispute / Litigation Details</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className={lbl}>Court</label>
                                                    <input autoComplete="off" data-lpignore="true"  className={inp} value={disputeCourt} onChange={e => setDisputeCourt(e.target.value)} placeholder="e.g. Lagos High Court" />
                                                </div>
                                                <div>
                                                    <label className={lbl}>Suit Number</label>
                                                    <input autoComplete="off" data-lpignore="true"  className={inp} value={disputeSuitNo} onChange={e => setDisputeSuitNo(e.target.value)} placeholder="e.g. LD/.../2024" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className={lbl}>Adverse Party</label>
                                                <input autoComplete="off" data-lpignore="true"  className={inp} value={adverseParty} onChange={e => setAdverseParty(e.target.value)} placeholder="Full name / legal entity" />
                                            </div>
                                        </div>
                                    )}

                                    {/* Add litigation toggle for non-disputed categories */}
                                    {propertyCategory !== 'Disputed Property' && (
                                        <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-100 dark:border-zinc-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
                                            <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={reHasLitigation} onChange={e => setReHasLitigation(e.target.checked)} className="w-4 h-4 rounded text-primary-600 accent-primary-600" />
                                            <div>
                                                <p className="text-sm font-bold text-slate-800 dark:text-white">This property is also in litigation</p>
                                                <p className="text-xs text-slate-500 dark:text-zinc-400">Check to add court & dispute details</p>
                                            </div>
                                        </label>
                                    )}
                                    {reHasLitigation && propertyCategory !== 'Disputed Property' && (
                                        <div className="space-y-3 p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl">
                                            <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.15em]">Litigation Details</p>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className={lbl}>Court</label>
                                                    <input autoComplete="off" data-lpignore="true"  className={inp} value={disputeCourt} onChange={e => setDisputeCourt(e.target.value)} placeholder="e.g. Lagos High Court" />
                                                </div>
                                                <div>
                                                    <label className={lbl}>Suit Number</label>
                                                    <input autoComplete="off" data-lpignore="true"  className={inp} value={disputeSuitNo} onChange={e => setDisputeSuitNo(e.target.value)} placeholder="e.g. LD/.../2024" />
                                                </div>
                                            </div>
                                            <div>
                                                <label className={lbl}>Adverse Party</label>
                                                <input autoComplete="off" data-lpignore="true"  className={inp} value={adverseParty} onChange={e => setAdverseParty(e.target.value)} placeholder="Full name / legal entity" />
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                             {/* Corporate fields */}
                             {matterType === MatterType.CorporateCommercial && (
                                 <div className="grid grid-cols-2 gap-3">
                                     <div>
                                         <label className={lbl}>RC Number</label>
                                         <input autoComplete="off" data-lpignore="true"  className={inp} value={rcNumber} onChange={e => setRcNumber(e.target.value)} placeholder="e.g. RC 1234567" />
                                     </div>
                                     <div>
                                         <label className={lbl}>Share Capital (₦)</label>
                                         <input autoComplete="off" data-lpignore="true"  
                                             type="text" 
                                             className={inp} 
                                             value={formatNumberWithCommas(shareCapital)} 
                                             onChange={e => setShareCapital(parseFormattedNumber(e.target.value))} 
                                             placeholder="0.00" 
                                         />
                                     </div>
                                 </div>
                             )}

                            {/* Client */}
                            <div>
                                <label className={lbl}>Client</label>
                                {!isNewClient ? (
                                    <div className="flex gap-2">
                                        <select value={clientId} onChange={e => setClientId(e.target.value)} className={`${inp} flex-1`}>
                                            <option value="">Select existing client...</option>
                                            {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <button onClick={() => setIsNewClient(true)} className="px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors whitespace-nowrap">
                                            + New
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <input autoComplete="off" data-lpignore="true"  className={`${inp} flex-1`} value={newClientName} onChange={e => setNewClientName(e.target.value)} placeholder="New client name..." autoFocus />
                                        <button onClick={() => setIsNewClient(false)} className="px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors">
                                            Pick
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Billing */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className={lbl}>Billing Model</label>
                                    <select value={billingModel} onChange={e => setBillingModel(e.target.value as BillingModel)} className={inp}>
                                        {Object.values(BillingModel).map(b => <option key={b}>{b}</option>)}
                                    </select>
                                </div>
                                {(billingModel === BillingModel.FixedFee || billingModel === BillingModel.Retainer) && (
                                    <div>
                                        <label className={lbl}>{billingModel} Amount (₦)</label>
                                        <input autoComplete="off" data-lpignore="true"  
                                            type="text" 
                                            className={inp} 
                                            value={formatNumberWithCommas(fixedFeeAmount)} 
                                            onChange={e => setFixedFeeAmount(parseFormattedNumber(e.target.value))} 
                                            placeholder="0.00"
                                        />
                                    </div>
                                )}
                                {billingModel === BillingModel.Percentage && (
                                    <div className="space-y-3 col-span-2">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className={lbl}>Percentage (%)</label>
                                                <input autoComplete="off" data-lpignore="true"  
                                                    type="number" 
                                                    className={inp} 
                                                    value={billingPercentage || ''} 
                                                    onChange={e => setBillingPercentage(parseFloat(e.target.value) || 0)} 
                                                    placeholder="2.5"
                                                    step="0.1"
                                                />
                                            </div>
                                            <div>
                                                <label className={lbl}>Based On</label>
                                                <select 
                                                    className={inp} 
                                                    value={billingBase} 
                                                    onChange={e => setBillingBase(e.target.value as any)}
                                                >
                                                    <option value="Rent">Total Rent</option>
                                                    <option value="Value">Property Value</option>
                                                    <option value="Outcome">Dispute Outcome</option>
                                                    <option value="Custom">Custom Amount</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className={lbl}>Calculated Fee (₦)</label>
                                                <input autoComplete="off" data-lpignore="true"  
                                                    type="text" 
                                                    className={inp + " font-bold text-primary-600 bg-primary-50/30"} 
                                                    value={formatNumberWithCommas(fixedFeeAmount)} 
                                                    onChange={e => setFixedFeeAmount(parseFormattedNumber(e.target.value))} 
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                 {billingModel === BillingModel.Hourly && (
                                     <div>
                                         <label className={lbl}>Hourly Rate (₦)</label>
                                         <input autoComplete="off" data-lpignore="true"  
                                             type="text" 
                                             className={inp} 
                                             value={formatNumberWithCommas(hourlyRate)} 
                                             onChange={e => setHourlyRate(parseFormattedNumber(e.target.value))} 
                                         />
                                     </div>
                                 )}
                            </div>

                            {/* Start drafting toggle (only for litigation) */}
                            {isLitigation && (
                                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-100 dark:border-zinc-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
                                    <input autoComplete="off" data-lpignore="true"  type="checkbox" checked={startDrafting} onChange={e => setStartDrafting(e.target.checked)} className="w-4 h-4 rounded text-primary-600 accent-primary-600" />
                                    <div>
                                        <p className="text-sm font-bold text-slate-800 dark:text-white">Open in DraftPro after creating</p>
                                        <p className="text-xs text-slate-500 dark:text-zinc-400">Jump straight to AI-assisted document drafting</p>
                                    </div>
                                </label>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 1 && (
                    <div className="flex-shrink-0 px-6 py-4 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3 bg-white dark:bg-zinc-900">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="px-6 py-2 text-sm font-bold bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
                        >
                            {isSubmitting ? 'Creating…' : startDrafting ? 'Create & Open DraftPro' : 'Create Matter'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SmartMatterModal;
