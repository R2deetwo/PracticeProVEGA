import React, { useState, useEffect } from 'react';
import { Contact, ContactCategory, ContactType, Property } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { UserCircleIcon, PhoneIcon, MailIcon, MapPinIcon, BriefcaseIcon, GlobeIcon, SaveIcon, XIcon, PlusIcon, InfoIcon, TagIcon, TrashIcon } from '../../constants';
import { Building as BuildingIcon, ShieldCheck as ShieldCheckIcon, Building2 as OfficeBuildingIcon, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { inputModern } from '../../utils/formStyles';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../toolkit/Accordion';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useDataActions } from '../../contexts/DataContext';
import { useProduct } from '../../contexts/ProductContext';

interface ContactFormProps {
    onAddContact: (contact: Omit<Contact, 'id'>, createPortalAccount: boolean) => void;
    onUpdateContact: (contact: Contact, createPortalAccount: boolean) => void;
    onClose: () => void;
    contactToEdit?: Contact;
    contactCategories: ContactCategory[];
    initialContext?: any;
    isCompact?: boolean;
}

const ContactForm: React.FC<ContactFormProps> = ({ onAddContact, onUpdateContact, onClose, contactToEdit, contactCategories, initialContext, isCompact }) => {
    const { coreState, isDataLoaded } = useCoreState();
    const { addToast, openModal, navigateTo } = useUI();
    const dataHandlers = useDataActions();
    // Product-aware flags. Previously this form hardcoded
    // `product === 'legal' || product === 'vega'` which MISSED 'unified' (Komplete).
    // Komplete firms need BOTH legal and property contact categories.
    const { isLegal, isProperty: isPropertyFirm, isUnified, hasPropertyFeatures, hasLegalFeatures } = useProduct();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [contactType, setContactType] = useState<ContactType>(ContactType.Individual);
    const [category, setCategory] = useState<string>(contactCategories.find(c => c.name === 'Client')?.id || contactCategories[0]?.id || '');
    const [jobTitle, setJobTitle] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [website, setWebsite] = useState('');
    const [notes, setNotes] = useState('');

    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isSavingCategory, setIsSavingCategory] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [identificationNumber, setIdentificationNumber] = useState('');
    const [taxId, setTaxId] = useState('');
    const [nextOfKin, setNextOfKin] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [rcNumber, setRcNumber] = useState('');
    const [dateOfIncorporation, setDateOfIncorporation] = useState('');

    const [pickerSupport, setPickerSupport] = useState<{ isSupported: boolean; availableProperties: string[] }>({
        isSupported: false,
        availableProperties: []
    });

    const isEditing = !!contactToEdit;

    // --- EFFECT: ALOA Form Update Listener ---
    useEffect(() => {
        const handleAloaUpdate = (e: any) => {
            const data = e.detail;
            if (!data) return;

            if (data.name !== undefined) setName(data.name);
            if (data.email !== undefined) setEmail(data.email);
            if (data.phone !== undefined) setPhone(data.phone);
            if (data.contactType !== undefined) setContactType(data.contactType);
            if (data.category !== undefined) setCategory(data.category);
            if (data.companyName !== undefined) setCompanyName(data.companyName);
            if (data.jobTitle !== undefined) setJobTitle(data.jobTitle);
            
            addToast("ALOA updated the contact details.", { type: 'info' });
        };

        window.addEventListener('aloa_update_form', handleAloaUpdate);
        return () => window.removeEventListener('aloa_update_form', handleAloaUpdate);
    }, [addToast]);

    useEffect(() => {
        if ('contacts' in navigator && 'ContactsManager' in window) {
            (navigator as any).contacts.getProperties().then((props: string[]) => {
                setPickerSupport({
                    isSupported: true,
                    availableProperties: props
                });
            });
        }
    }, []);

    const handlePickContact = async () => {
        try {
            const props = ['name', 'email', 'tel', 'address'].filter(
                p => pickerSupport.availableProperties.includes(p)
            );

            const contacts = await (navigator as any).contacts.select(props, { multiple: false });

            if (contacts && contacts.length > 0) {
                const contact = contacts[0];
                if (contact.name && contact.name.length > 0) setName(contact.name[0]);
                if (contact.email && contact.email.length > 0) setEmail(contact.email[0]);
                if (contact.tel && contact.tel.length > 0) setPhone(contact.tel[0]);
                if (contact.address && contact.address.length > 0) {
                    const addr = contact.address[0];
                    setAddress([addr.addressLine, addr.city, addr.country].filter(Boolean).join(', '));
                }
                addToast("Contact details imported from device.", { type: 'success' });
            }
        } catch (error) {
            console.error('Contact picker error:', error);
        }
    };

    useEffect(() => {
        if (isEditing && contactToEdit) {
            setName(contactToEdit.name || '');
            setEmail(contactToEdit.email || '');
            setPhone(contactToEdit.phone || '');
            setAddress(contactToEdit.address || '');
            setContactType(contactToEdit.contactType || ContactType.Individual);
            setJobTitle(contactToEdit.jobTitle || '');
            setCompanyName(contactToEdit.companyName || '');
            setWebsite(contactToEdit.website || '');
            setNotes(contactToEdit.notes || '');
            
            const matchingCat = contactCategories.find(c => c.name.toLowerCase() === contactToEdit.category?.toLowerCase());
            if (matchingCat) setCategory(matchingCat.id);
            else if (contactToEdit.category) setCategory(contactToEdit.category);

            if (contactToEdit.contactType === ContactType.Company) {
                setRcNumber(contactToEdit.identificationNumber || '');
                setDateOfIncorporation(contactToEdit.dateOfBirth || '');
            } else {
                setIdentificationNumber(contactToEdit.identificationNumber || '');
                setDateOfBirth(contactToEdit.dateOfBirth || '');
                setNextOfKin(contactToEdit.nextOfKin || '');
            }
            setTaxId(contactToEdit.taxId || '');
        } else {
            // Apply initial context (e.g. preset category from lead)
            const context = initialContext;
            if (context?.category) {
                const matchingCat = contactCategories.find(c => c.name.toLowerCase() === context.category.toLowerCase());
                if (matchingCat) setCategory(matchingCat.id);
            }
        }
    }, [isEditing, contactToEdit, initialContext, contactCategories]);

    const handleAddProperty = () => {
        if (!isEditing) {
            addToast("Please save the contact first before registering properties.", { type: 'info' });
            return;
        }
        openModal('newProperty', contactToEdit.id);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // SIMPLIFY FIX: only the Name is required. Many Nigerian client records
        // are WhatsApp-first (phone only, no email) — blocking contact creation
        // on email forced dummy emails into the DB. Portal invites already gate
        // on email separately (the channel falls back to WhatsApp/SMS).
        if (!name) {
            addToast('Please enter a name.', { type: 'info' });
            return;
        }
        
        setIsSaving(true);
        try {
            let categoryName = contactCategories.find(c => c.id === category)?.name;
            
            // Handle fallback categories if they weren't in the DB
            if (!categoryName) {
                categoryName = category; // If it's a string from the fallback options
            }
            
            const finalIdNumber = contactType === ContactType.Company ? rcNumber : identificationNumber;

            const contactData: Omit<Contact, 'id'> = {
                firmId: coreState.firmDetails.id,
                name,
                email,
                phone,
                address,
                contactType,
                category: categoryName,
                jobTitle: contactType === ContactType.Individual ? jobTitle : undefined,
                companyName: contactType === ContactType.Individual ? companyName : undefined,
                website,
                notes,
                properties: isEditing ? (contactToEdit.properties || []) : [],
                identificationNumber: finalIdNumber,
                taxId,
                nextOfKin: contactType === ContactType.Individual ? nextOfKin : undefined,
                dateOfBirth: contactType === ContactType.Individual ? dateOfBirth : dateOfIncorporation
            };

            if (isEditing && contactToEdit) {
                await onUpdateContact({ ...contactToEdit, ...contactData }, false);
                onClose();
            } else {
                await onAddContact(contactData, false);
                // Note: onAddContact in ModalManager already transitions or closes the modal, so we do not call onClose() here.
            }
        } catch (error) {
            console.error("Failed to save contact:", error);
            addToast("Failed to save contact.", { type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateNewCategory = async () => {
        if (!newCategoryName.trim()) return;
        setIsSavingCategory(true);
        try {
            const newCat = {
                firmId: coreState.firmDetails.id,
                name: newCategoryName.trim()
            };
            // addItem returns the ID or the object with ID
            const result = await dataHandlers.addItem('contactCategories', newCat, newCat.name);
            const newId = (result as any)?.id || result;
            if (newId) {
                setCategory(newId as string);
                setIsAddingCategory(false);
                setNewCategoryName('');
                addToast(`Category "${newCategoryName}" added successfully.`, { type: 'success' });
            }
        } catch (e) {
            addToast("Failed to add category.", { type: 'error' });
        } finally {
            setIsSavingCategory(false);
        }
    };

    // inputModern is now imported at top level
    const commonInputClass = inputModern + " group-hover:ring-primary-300 dark:group-hover:ring-primary-800";
    const labelClass = "block text-xs font-semibold text-slate-500 dark:text-zinc-400 mb-1.5 ml-0.5";
    const gridClass = isCompact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2";

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:gap-4 -m-2">
            <div className="space-y-2 sm:space-y-3 pb-20">
                {/* Entity definition header */}
                <div className="p-3 sm:p-4 bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-sm space-y-3">
                    <div className="flex items-center gap-3 sm:gap-4 mb-2 px-1">
                        <div className="p-1.5 bg-primary-600 text-white rounded-lg shadow-sm ring-2 ring-primary-500/10">
                            <UserCircleIcon className="w-3.5 h-3.5" />
                        </div>
                        <h3 className="text-base font-black text-slate-800 dark:text-white tracking-tight">General info</h3>
                        {pickerSupport.isSupported && !isEditing && (
                            <button 
                                type="button"
                                onClick={handlePickContact}
                                className="ml-auto px-5 py-2.5 bg-gradient-to-r from-emerald-600 via-primary-600 to-indigo-600 text-white text-3xs font-black uppercase tracking-wide-label rounded-lg shadow-xl shadow-primary-500/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-white/10 group overflow-hidden relative"
                            >
                                <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out skew-x-12" />
                                <PhoneIcon className="w-3.5 h-3.5 relative z-10" /> 
                                <span className="relative z-10">Import from Device</span>
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div className="space-y-2 group">
                            <label className={labelClass}>Type</label>
                            <div className="inline-flex gap-1 bg-slate-50 dark:bg-zinc-900/50 p-0.5 rounded-lg ring-1 ring-slate-200 dark:ring-zinc-700">
                                <button type="button" onClick={() => setContactType(ContactType.Individual)} className={`px-2.5 py-1 text-3xs font-black uppercase tracking-widest rounded-md transition-all ${contactType === ContactType.Individual ? 'bg-white dark:bg-zinc-800 text-primary-600 dark:text-primary-300 shadow-sm ring-1 ring-slate-100 dark:ring-zinc-700' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 dark:hover:text-zinc-400'}`}>Individual</button>
                                <button type="button" onClick={() => setContactType(ContactType.Company)} className={`px-2.5 py-1 text-3xs font-black uppercase tracking-widest rounded-md transition-all ${contactType === ContactType.Company ? 'bg-white dark:bg-zinc-800 text-primary-600 dark:text-primary-300 shadow-sm ring-1 ring-slate-100 dark:ring-zinc-700' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 dark:hover:text-zinc-400'}`}>Corporate</button>
                            </div>
                        </div>
                        <div className="space-y-2 group">
                            <div className="flex justify-between items-center px-1">
                                <label htmlFor="contactCategory" className={labelClass}>Category</label>
                                {!isAddingCategory && (
                                    <button 
                                        type="button" 
                                        onClick={() => setIsAddingCategory(true)}
                                        className="text-2xs font-black text-primary-600 dark:text-primary-300 uppercase tracking-widest hover:underline mb-1.5"
                                    >
                                        + Add New
                                    </button>
                                )}
                            </div>
                            
                            {isAddingCategory ? (
                                <div className="flex gap-2">
                                    <input autoComplete="off" data-lpignore="true" 
                                        type="text" 
                                        value={newCategoryName}
                                        onChange={e => setNewCategoryName(e.target.value)}
                                        placeholder="Category Name"
                                        className={`${commonInputClass} flex-grow`}
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleCreateNewCategory();
                                            }
                                            if (e.key === 'Escape') setIsAddingCategory(false);
                                        }}
                                    />
                                    <button 
                                        type="button"
                                        onClick={handleCreateNewCategory}
                                        disabled={isSavingCategory || !newCategoryName.trim()}
                                        className="px-4 py-2 bg-primary-600 text-white rounded-lg text-xs font-bold hover:bg-primary-700 disabled:opacity-50"
                                    >
                                        {isSavingCategory ? '...' : 'Save'}
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setIsAddingCategory(false)}
                                        className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                                    >
                                        <XIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <select id="contactCategory" value={category} onChange={e => setCategory(e.target.value)} className={commonInputClass}>
                                    {contactCategories.length === 0 ? (
                                        <>
                                            <option value="">Select Category</option>
                                            {/* SIMPLIFY FIX: deduped the fallback list — Client and
                                                Vendor appeared twice for legal and property firms. */}
                                            {hasLegalFeatures && (
                                                <>
                                                    <option value="Client">Client</option>
                                                    <option value="Registrar">Registrar</option>
                                                    <option value="Bailiff">Bailiff</option>
                                                    <option value="Lawyer">Lawyer</option>
                                                    <option value="Witness">Witness</option>
                                                    <option value="Court Staff">Court Staff</option>
                                                    <option value="Opposing Counsel">Opposing Counsel</option>
                                                    <option value="Advocate">Advocate</option>
                                                </>
                                            )}
                                            {/* Property categories — shown for Atrium AND Komplete (hasPropertyFeatures). */}
                                            {hasPropertyFeatures && (
                                                <>
                                                    <option value="Resident">Resident</option>
                                                    <option value="Landlord">Landlord</option>
                                                    <option value="Tenant">Tenant</option>
                                                    <option value="Vendor">Vendor</option>
                                                    <option value="Facility Manager">Facility Manager</option>
                                                    <option value="Estate Agent">Estate Agent</option>
                                                    <option value="Contractor">Contractor</option>
                                                </>
                                            )}
                                            {/* Fallback when a firm has neither feature flag
                                                (pure trial default) — Client covers the common case. */}
                                            {!hasLegalFeatures && !hasPropertyFeatures && (
                                                <option value="Client">Client</option>
                                            )}
                                        </>
                                    ) : (
                                        contactCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)
                                    )}
                                </select>
                            )}
                        </div>
                    </div>

                    <div className={`grid ${gridClass} gap-3 sm:gap-4`}>
                        <div className="space-y-2 group">
                            <label htmlFor="contactName" className={labelClass}>{contactType === ContactType.Company ? 'Company Name' : 'Full Name'}</label>
                            <input autoComplete="off" data-lpignore="true"  type="text" id="contactName" value={name} onChange={e => setName(e.target.value)} className={commonInputClass} placeholder={contactType === ContactType.Individual ? "e.g. Adewale Olanrewaju" : "e.g. Zenith Legal Holdings"} required autoFocus />
                        </div>
                        <div className="space-y-2 group">
                            <label htmlFor="contactEmail" className={labelClass}>Email Address</label>
                            <div className="relative">
                                <MailIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input autoComplete="off" data-lpignore="true"  type="email" id="contactEmail" value={email} onChange={e => setEmail(e.target.value)} className={`${commonInputClass} pl-11`} placeholder="name@domain.com (optional)" />
                            </div>
                        </div>
                    </div>

                    <div className={`grid ${gridClass} gap-3 sm:gap-4`}>
                        <div className="space-y-2 group">
                            <label htmlFor="contactPhone" className={labelClass}>Phone</label>
                            <div className="relative">
                                <PhoneIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input autoComplete="off" data-lpignore="true"  type="tel" id="contactPhone" value={phone} onChange={e => setPhone(e.target.value)} className={`${commonInputClass} pl-11`} placeholder="+234..." />
                            </div>
                        </div>
                        <div className="space-y-2 group">
                            <label htmlFor="contactWebsite" className={labelClass}>Website</label>
                            <div className="relative">
                                <GlobeIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input autoComplete="off" data-lpignore="true"  type="url" id="contactWebsite" value={website} onChange={e => setWebsite(e.target.value)} className={`${commonInputClass} pl-11`} placeholder="https://..." />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 group">
                        <label htmlFor="contactAddress" className={labelClass}>Address</label>
                        <div className="relative">
                            <MapPinIcon className="absolute left-4 top-4 w-3.5 h-3.5 text-slate-400" />
                            <textarea id="contactAddress" value={address} onChange={e => setAddress(e.target.value)} rows={2} className={`${commonInputClass} pl-11 resize-none`} placeholder="Full physical or registered address..." />
                        </div>
                    </div>
                </div>

                {/* Additional Detail Sections */}
                <div className="px-0 sm:px-1">
                    <Accordion type="single" className="space-y-2 sm:space-y-3">
                        <AccordionItem value="kyc_details" className="bg-slate-50/50 dark:bg-zinc-800/30 border border-slate-100 dark:border-zinc-700/50 rounded-lg overflow-hidden transition-all duration-300">
                            <AccordionTrigger className="px-4 sm:px-8 py-3 sm:py-5 hover:no-underline hover:bg-slate-100/50 dark:hover:bg-zinc-800/50 transition-colors">
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-sm ring-2 ring-emerald-500/10">
                                        <ShieldCheckIcon className="w-4 h-4" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-sm sm:text-base font-black text-slate-800 dark:text-white tracking-tight">Compliance & KYC</h3>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 sm:px-8 pb-4 sm:pb-8 pt-2">
                                <div className={`grid ${gridClass} gap-3 sm:gap-4`}>
                                    {contactType === ContactType.Individual ? (
                                        <>
                                            <div className="space-y-2 group">
                                                <label className={labelClass}>Identification Number</label>
                                                <input autoComplete="off" data-lpignore="true"  type="text" value={identificationNumber} onChange={e => setIdentificationNumber(e.target.value)} className={commonInputClass} placeholder="NIN / Passport" />
                                            </div>
                                            <div className="space-y-2 group">
                                                <label className={labelClass}>Date of Birth</label>
                                                <input autoComplete="off" data-lpignore="true"  type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} className={commonInputClass} />
                                            </div>
                                            <div className="space-y-2 group">
                                                <label className={labelClass}>Taxpayer ID (TIN)</label>
                                                <input autoComplete="off" data-lpignore="true"  type="text" value={taxId} onChange={e => setTaxId(e.target.value)} className={commonInputClass} placeholder="TIN-XXXXX" />
                                            </div>
                                            <div className="space-y-2 group">
                                                <label className={labelClass}>Next of Kin</label>
                                                <input autoComplete="off" data-lpignore="true"  type="text" value={nextOfKin} onChange={e => setNextOfKin(e.target.value)} className={commonInputClass} placeholder="Name & Relationship" />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="space-y-2 group">
                                                <label className={labelClass}>RC Registration Number</label>
                                                <input autoComplete="off" data-lpignore="true"  type="text" value={rcNumber} onChange={e => setRcNumber(e.target.value)} className={commonInputClass} placeholder="RC123456" />
                                            </div>
                                            <div className="space-y-2 group">
                                                <label className={labelClass}>Corporate Tax ID</label>
                                                <input autoComplete="off" data-lpignore="true"  type="text" value={taxId} onChange={e => setTaxId(e.target.value)} className={commonInputClass} placeholder="Company TIN" />
                                            </div>
                                            <div className="space-y-2 md:col-span-2 group">
                                                <label className={labelClass}>Date of Incorporation</label>
                                                <input autoComplete="off" data-lpignore="true"  type="date" value={dateOfIncorporation} onChange={e => setDateOfIncorporation(e.target.value)} className={commonInputClass} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </AccordionContent>
                        </AccordionItem>

                        {/* Property Portfolio — only shown for firms with property features
                            (Atrium + Komplete). Previously this was shown to ALL firms including
                            Vega-only law firms, where it was meaningless. */}
                        {hasPropertyFeatures && (
                        <AccordionItem value="properties" className="bg-slate-50/50 dark:bg-zinc-800/30 border border-slate-100 dark:border-zinc-700/50 rounded-lg overflow-hidden transition-all duration-300">
                            <AccordionTrigger className="px-4 sm:px-8 py-3 sm:py-5 hover:no-underline hover:bg-slate-100/50 dark:hover:bg-zinc-800/50 transition-colors">
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <div className="p-2 sm:p-2.5 bg-amber-600 text-white rounded-lg sm:rounded-2xl shadow-sm ring-2 sm:ring-4 ring-amber-500/10">
                                        <OfficeBuildingIcon className="w-4 h-4" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-sm font-black text-slate-800 dark:text-white tracking-tight">Property portfolio</h3>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-4 sm:px-8 pb-4 sm:pb-8 pt-2">
                                {!isEditing ? (
                                    <div className="text-center py-8 sm:py-12 bg-white/50 dark:bg-zinc-900/50 rounded-lg sm:rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-700">
                                        <OfficeBuildingIcon className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-3 sm:mb-4 opacity-50" />
                                        <p className="text-2xs text-slate-400 font-extrabold uppercase tracking-wide-label mb-2 px-4 sm:px-6">Portfolio management requires a saved contact</p>
                                        <p className="text-2xs text-slate-500 mb-4 sm:mb-6 px-4 sm:px-8">Save this contact first to enable property registration.</p>
                                        <button type="button" disabled className="inline-flex items-center gap-2 sm:gap-3 text-xs font-semibold bg-slate-200 dark:bg-zinc-700 text-slate-400 px-6 sm:px-8 py-2.5 sm:py-3 rounded-lg sm:rounded-2xl cursor-not-allowed">
                                            <PlusIcon className="w-4 h-4" /> Register New Property
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4 sm:space-y-6">
                                        <div className="flex justify-between items-center px-2">
                                            <span className="text-2xs font-black text-slate-400 uppercase tracking-widest">Property Portfolio</span>
                                            <button type="button" onClick={handleAddProperty} className="text-2xs font-black text-primary-600 dark:text-primary-300 uppercase tracking-widest hover:underline">+ Register New Property</button>
                                        </div>

                                        {(contactToEdit.properties || []).length > 0 ? (
                                            <div className="grid grid-cols-1 gap-3">
                                                {(contactToEdit.properties || []).map((prop) => (
                                                    <div key={prop.id} onClick={() => { onClose(); navigateTo('propertyDetail', prop.id); }} className="group p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-primary-300 dark:hover:border-primary-800 transition-all cursor-pointer flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className="p-2 bg-slate-50 dark:bg-zinc-800 rounded-lg text-slate-400 group-hover:text-primary-500 group-hover:bg-primary-50 dark:hover:bg-primary-900/30 dark:group-hover:bg-primary-900/20 transition-colors">
                                                                <OfficeBuildingIcon className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-700 dark:text-zinc-200 line-clamp-1">{prop.address}</p>
                                                                <p className="text-2xs font-medium text-slate-500 dark:text-zinc-500 uppercase tracking-wider">{prop.category} • {prop.status}</p>
                                                            </div>
                                                        </div>
                                                        <ChevronRightIcon className="w-4 h-4 text-slate-300 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-6 sm:py-10 bg-slate-50/50 dark:bg-zinc-900/50 rounded-lg sm:rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-700">
                                                <p className="text-xs text-slate-400 font-bold mb-3 sm:mb-4">No properties registered yet</p>
                                                <button type="button" onClick={handleAddProperty} className="text-2xs font-black text-primary-600 dark:text-primary-300 uppercase tracking-widest hover:underline">+ Map First Property</button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </AccordionContent>
                        </AccordionItem>
                        )}
                    </Accordion>
                </div>
            </div>

            <div className="sticky bottom-0 left-0 right-0 pt-4 sm:pt-8 pb-safe-extra bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap-reverse sm:justify-end gap-2 sm:gap-3 z-20">
                <button type="button" onClick={onClose} disabled={isSaving} className="flex-1 sm:flex-none px-6 sm:px-10 py-2.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 text-xs font-semibold rounded-lg sm:rounded-2xl hover:bg-slate-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-2 disabled:opacity-55">
                    <XIcon className="w-4 h-4" /> Cancel
                </button>
                <button type="submit" disabled={isSaving} className="flex-1 sm:flex-none px-8 sm:px-12 py-2.5 bg-primary-600 text-white text-xs font-semibold rounded-lg sm:rounded-2xl shadow-2xl shadow-primary-500/30 hover:bg-primary-700 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-55">
                    <SaveIcon className="w-4 h-4" /> {isSaving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Contact')}
                </button>
            </div>
        </form>
    );
};

export default ContactForm;
