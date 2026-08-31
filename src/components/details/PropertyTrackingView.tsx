
import React, { useState, useMemo } from 'react';
import { Property, PropertyEvent, MaintenanceRecord, RentPayment, TaskStatus, TaskPriority } from '../../types';
import {
    CurrencyDollarIcon,
    ToolkitIcon as WrenchIcon,
    CalendarIcon,
    CheckCircleIcon,
    InfoIcon as ExclamationCircleIcon,
    PlusIcon,
    ClockIcon,
    XMarkIcon,
    PencilSquareIcon,
    DownloadIcon
} from '../../constants';
import { formatNaira, formatNumberWithCommas, parseFormattedNumber, formatDateWithOrdinal, formatDateShort } from '../../utils/formatting';
import NairaSymbol from '../NairaSymbol';
import { v4 as uuidv4 } from 'uuid';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useDataState } from '../../contexts/DataContext';
import { useMatterState } from '../../contexts/MatterContext';
import { useExecutionState } from '../../contexts/ExecutionContext';
import { generateReceiptPdf } from '../../services/reportGenerator';
import { InvoiceStatus, Contact } from '../../types';
import ErrorBoundary from '../ErrorBoundary';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import { useAuth } from '../../contexts/AuthContext';
import { LeaseProgressBars } from './LeaseProgressBars';

interface PropertyTrackingViewProps {
    property: Property;
    onUpdate: (updatedProperty: Property) => void;
}

const PropertyTrackingViewContent: React.FC<PropertyTrackingViewProps> = ({ property, onUpdate }) => {
    const { coreState } = useCoreState();
    const { matterState } = useMatterState();
    const { appState } = useDataState();
    const { executionActions } = useExecutionState();
    const { addToast, openModal, navigateTo } = useUI();
    const addLedgerEntry = useMutation(api.sentry.addLedgerEntry);
    const { queueMutation, isOnline } = useOfflineQueue();
    const { currentUser } = useAuth();
    const isLeased = property.category === 'Tenanted Property';
    const isSale = property.category === 'Property For Sale';
    // Management Only properties don't collect rent via the system — hide all
    // rent collection modules (Quick Stats cards, rent tab, rent history table,
    // rent collection progress bar). Only show lease timeline + service charge.
    const isManagementOnly = property.rentCollectionMode === 'Management Only (No Rent)';
    const [activeSection, setActiveSection] = useState<'timeline' | 'rent' | 'maintenance'>(isLeased ? 'timeline' : 'timeline');
    const [showAddModal, setShowAddModal] = useState(false);
    const [addType, setAddType] = useState<'rent' | 'maintenance' | 'event' | 'lease_setup'>('event');
    
    // Local state for formatted inputs in the modal
    const [localRentAmount, setLocalRentAmount] = useState<string>('');
    const [localPaymentAmount, setLocalPaymentAmount] = useState<string>('');

    // Controlled Lease State
    const [leaseStart, setLeaseStart] = useState<string>('');
    const [leaseEnd, setLeaseEnd] = useState<string>('');
    const [leaseFrequency, setLeaseFrequency] = useState<string>('Annually');

    // Default empty arrays if undefined
    const timeline = property.trackingTimeline || [];
    const maintenance = property.maintenanceHistory || [];
    const rentHistory = property.rentPaymentHistory || [];

    // Sorting
    // For Management Only properties, filter out rent_collected events from
    // the timeline — they don't apply when rent collection is disabled.
    const filteredTimeline = isManagementOnly
        ? timeline.filter(e => e.type !== 'rent_collected')
        : timeline;
    const sortedTimeline = [...filteredTimeline].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const sortedRent = [...rentHistory].sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
    const sortedMaintenance = [...maintenance].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const today = new Date().toISOString().split('T')[0];

    // --- CALCULATIONS ---

    const daysLeft = useMemo(() => {
        if (!property.rentalDetails?.leaseEnd) return null;
        const end = new Date(property.rentalDetails.leaseEnd);
        const now = new Date();
        const diffTime = end.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }, [property.rentalDetails?.leaseEnd]);

    const nextRentDueDate = useMemo(() => {
        // Simple logic: If we have history, take last due date + frequency.
        // If no history, take lease start + frequency... or just return "Not Set"
        // Better: Project forward from lease start.
        if (!property.rentalDetails?.leaseStart || !property.rentalDetails.rentFrequency) return null;

        const start = new Date(property.rentalDetails.leaseStart);
        const freq = property.rentalDetails.rentFrequency;
        const now = new Date();

        // Check if there's a paid history to base off
        const lastPaid = sortedRent.find(r => r.status === 'paid');
        let baseDate = lastPaid ? new Date(lastPaid.dueDate) : start;

        // Add 1 period to baseDate
        const nextDate = new Date(baseDate);
        if (freq === 'Annually') nextDate.setFullYear(nextDate.getFullYear() + 1);
        else if (freq === 'Bi-Annually') nextDate.setMonth(nextDate.getMonth() + 6);
        else if (freq === 'Quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
        else if (freq === 'Monthly') nextDate.setMonth(nextDate.getMonth() + 1);

        // If nextDate is in the past (and unpaid), it's overdue.
        // If we want the *upcoming* due date regardless of arrears, we iterate.
        // For simplicity, let's just show the calculated next one.
        return nextDate.toISOString().split('T')[0];
    }, [property.rentalDetails, sortedRent]);

    const rentReviewDate = useMemo(() => {
        if (!property.rentalDetails?.leaseEnd || !property.rentalDetails.rentFrequency) return null;
        const endDate = new Date(property.rentalDetails.leaseEnd);
        let noticeMonths = 1;
        const f = property.rentalDetails.rentFrequency.toLowerCase();
        if (f.includes('year')) noticeMonths = 6;
        else if (f.includes('6-month')) noticeMonths = 3;
        else if (f.includes('quarter')) noticeMonths = 1;
        else if (f.includes('month')) noticeMonths = 1;

        const noticeDate = new Date(endDate);
        noticeDate.setMonth(noticeDate.getMonth() - noticeMonths);

        const reviewDate = new Date(noticeDate);
        reviewDate.setDate(reviewDate.getDate() - 14);
        
        return reviewDate.toISOString().split('T')[0];
    }, [property.rentalDetails?.leaseEnd, property.rentalDetails?.rentFrequency]);

    // --- AUTO CALCULATIONS FOR FORMS ---
    const calculateTerminationDate = (start: string, freq: string) => {
        if (!start) return '';
        const d = new Date(start);
        if (isNaN(d.getTime())) return '';

        const end = new Date(d);
        if (freq === 'Annually') end.setFullYear(end.getFullYear() + 1);
        else if (freq === 'Bi-Annually') end.setMonth(end.getMonth() + 6);
        else if (freq === 'Quarterly') end.setMonth(end.getMonth() + 3);
        else if (freq === 'Monthly') end.setMonth(end.getMonth() + 1);

        // Usually lease ends day before (e.g. Sept 1 2024 to Aug 31 2025)
        end.setDate(end.getDate() - 1);
        return end.toISOString().split('T')[0];
    };

    const handleLeaseStartChange = (val: string) => {
        setLeaseStart(val);
        const autoEnd = calculateTerminationDate(val, leaseFrequency);
        if (autoEnd) setLeaseEnd(autoEnd);
    };

    const handleLeaseFrequencyChange = (val: string) => {
        setLeaseFrequency(val);
        const autoEnd = calculateTerminationDate(leaseStart, val);
        if (autoEnd) setLeaseEnd(autoEnd);
    };

    const isReviewUpcoming = useMemo(() => {
        if (!rentReviewDate) return false;
        const review = new Date(rentReviewDate);
        const now = new Date();
        const diff = (review.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff > 0 && diff <= 30;
    }, [rentReviewDate]);

    const activeMaintenanceCount = maintenance.filter(m => m.status !== 'fulfilled' && m.status !== 'cancelled').length;

    // --- HANDLERS ---

    const updateMaintenanceStatus = (recordId: string, newStatus: MaintenanceRecord['status'], additionalData?: Partial<MaintenanceRecord>) => {
        const updated = { ...property };
        if (!updated.maintenanceHistory) return;

        updated.maintenanceHistory = updated.maintenanceHistory.map(m => {
            if (m.id === recordId) {
                const updatedRecord = { ...m, status: newStatus, ...additionalData };
                if (newStatus === 'fulfilled') updatedRecord.resolvedDate = new Date().toISOString().split('T')[0];
                return updatedRecord;
            }
            return m;
        });

        onUpdate(updated);
        addToast(`Maintenance moved to ${newStatus.replace('_', ' ')}`, { type: 'success' });
    };

    const handleConvertToTask = async (record: MaintenanceRecord) => {
        const currentUser = coreState.users.find(u => u.email === appState.firmDetails?.created_by); // Fallback to creator if no auth context
        // In real app, we'd use the actual current user.
        
        try {
            const taskId = uuidv4();
            executionActions.handleAddTask({
                id: taskId,
                firmId: coreState.firmDetails?.id || '',
                title: `Maintenance: ${record.issue}`,
                description: `Linked to maintenance request for ${property.address}.\n\nNotes: ${record.notes || 'None'}`,
                status: 'In Progress' as TaskStatus,
                priority: (record.priority === 'emergency' || record.priority === 'high') ? 'High' : record.priority === 'medium' ? 'Medium' : 'Low' as TaskPriority,
                creatorId: currentUser?.id || 'system',
                assignedUsers: currentUser ? [currentUser.id] : [],
                createdAt: new Date().toISOString(),
                matterId: property.id
            });

            // Update maintenance record with taskId
            const updated = { ...property };
            updated.maintenanceHistory = updated.maintenanceHistory?.map(m => {
                if (m.id === record.id) {
                    return { ...m, taskId, status: 'in_progress' };
                }
                return m;
            });
            onUpdate(updated);
            addToast("Converted to Task and assigned to you.", { type: 'success' });
        } catch (error) {
            console.error("Failed to create task:", error);
            addToast("Failed to create task.", { type: 'error' });
        }
    };

    const handleSave = async (data: any) => {
        const updated = { ...property };
        const now = new Date().toISOString();
        const today = now.split('T')[0];

        if (addType === 'rent') {
            const amount = parseFormattedNumber(data.amount as string);
            const newPayment: RentPayment = {
                id: uuidv4(),
                dueDate: data.dueDate as string,
                paidDate: data.paidDate as string,
                amount,
                status: 'paid', // Assuming recorded means paid
                paymentMethod: data.method as string,
                receiptNumber: `REC-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`,
                periodStart: data.periodStart as string,
                periodEnd: data.periodEnd as string
            };

            updated.rentPaymentHistory = [newPayment, ...(updated.rentPaymentHistory || [])];

            const firmId = property.firmId || coreState.firmDetails?.id || '';
            if (firmId && amount > 0) {
                try {
                    const tenantContact = matterState.contacts.find(c =>
                        (c.email && c.email === property.rentalDetails?.tenantEmail) ||
                        (c.phone && c.phone === property.rentalDetails?.tenantPhone) ||
                        (c.name && c.name === property.rentalDetails?.tenantName)
                    );
                    // OFFLINE PATH — queue the ledger entry, the critical
                    // financial record. The property's rentPaymentHistory
                    // update (below) will also be queued via the onUpdate
                    // handler if we add offline support there in the future;
                    // for now, at least the ledger record survives.
                    if (!isOnline) {
                        queueMutation({
                            mutationName: 'addLedgerEntry',
                            args: {
                                firmId,
                                propertyId: property.id,
                                unitId: property.id,
                                tenantId: tenantContact?.id,
                                amount,
                                type: 'rent',
                                status: 'cleared',
                                channel: (data.method as string) || 'Manual',
                                description: `Rent payment for ${property.address}`,
                                period: data.periodStart && data.periodEnd ? `${data.periodStart} to ${data.periodEnd}` : undefined,
                                userEmail: currentUser?.email,
                            },
                            label: `Rent ledger — ${property.address}`,
                        });
                        // Don't return — let the property update flow through
                        // (it goes through onUpdate which is a separate path).
                    } else {
                        await addLedgerEntry({
                            firmId,
                            propertyId: property.id,
                            unitId: property.id,
                            tenantId: tenantContact?.id,
                            amount,
                            type: 'rent',
                            status: 'cleared',
                            channel: (data.method as string) || 'Manual',
                            description: `Rent payment for ${property.address}`,
                            period: data.periodStart && data.periodEnd ? `${data.periodStart} to ${data.periodEnd}` : undefined,
                            userEmail: currentUser?.email,
                        });
                    }
                } catch (e) {
                    console.warn('Ledger sync failed for rent payment:', e);
                    addToast('Payment saved on property, but revenue ledger sync failed.', { type: 'info' });
                }
            }

            // Add to timeline
            const newEvent: PropertyEvent = {
                id: uuidv4(),
                type: 'rent_collected',
                date: data.paidDate || today,
                description: `Rent payment received via ${data.method}`,
                amount
            };
            updated.trackingTimeline = [newEvent, ...(updated.trackingTimeline || [])];
        } else if (addType === 'maintenance') {
            const newRecord: MaintenanceRecord = {
                id: uuidv4(),
                date: data.date || today,
                issue: data.issue,
                status: 'reported',
                notes: data.notes,
                priority: data.priority as any || 'low',
                vendorId: data.vendorId as string,
                vendorName: data.vendorName as string,
                vendorPhone: data.vendorPhone as string
            };
            updated.maintenanceHistory = [newRecord, ...(updated.maintenanceHistory || [])];

            const newEvent: PropertyEvent = {
                id: uuidv4(),
                type: 'maintenance',
                date: data.date || today,
                description: `New [${(newRecord.priority || 'low').toUpperCase()}] maintenance request: ${data.issue}`,
            };
            updated.trackingTimeline = [newEvent, ...(updated.trackingTimeline || [])];

        } else if (addType === 'event') {
            const newEvent: PropertyEvent = {
                id: uuidv4(),
                type: data.type as any || 'other',
                date: data.date || today,
                description: data.description,
            };
            updated.trackingTimeline = [newEvent, ...(updated.trackingTimeline || [])];
        } else if (addType === 'lease_setup') {
            updated.rentalDetails = {
                ...updated.rentalDetails,
                leaseStart: data.commencementDate as string,
                leaseEnd: data.terminationDate as string,
                rentAmount: parseFormattedNumber(data.rentAmount as string),
                rentFrequency: data.rentFrequency as "Annually" | "Bi-Annually" | "Quarterly" | "Monthly",
                tenantName: (data.tenantName as string) || updated.rentalDetails?.tenantName,
                isPeriodicReviewEnabled: true
            };
            // Add generic timeline event for lease update
            const newEvent: PropertyEvent = {
                id: uuidv4(),
                type: 'lease_signed',
                date: today,
                description: `Lease terms updated. Term: ${data.commencementDate} to ${data.terminationDate}`,
            };
            updated.trackingTimeline = [newEvent, ...(updated.trackingTimeline || [])];
        }

        onUpdate(updated);
        setShowAddModal(false);
    };

    const handleDownloadReceipt = (payment: RentPayment) => {
        try {
            const tenantContact = matterState.contacts.find(c => 
                (c.email && c.email === property.rentalDetails?.tenantEmail) || 
                (c.phone && c.phone === property.rentalDetails?.tenantPhone) ||
                (c.name && c.name === property.rentalDetails?.tenantName)
            );

            const mockInvoice: any = {
                id: uuidv4(),
                invoiceNumber: payment.receiptNumber || `REC-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`,
                client: tenantContact || { id: 'tenant-legacy', name: property.rentalDetails?.tenantName || 'The Tenant' },
                matter: { id: property.id, title: `Rent Payment: ${property.address}` },
                lineItems: [{
                    id: uuidv4(),
                    description: `Rent for ${property.address}`,
                    hours: 1,
                    rate: payment.amount,
                    total: payment.amount
                }],
                status: InvoiceStatus.Paid,
                issueDate: payment.paidDate || payment.dueDate,
                dueDate: payment.dueDate,
                paidDate: payment.paidDate || payment.dueDate,
                paymentDetails: coreState.firmDetails?.bankAccounts?.[0] || { 
                    bankName: 'PracticePro Default', 
                    accountNumber: '0000000000',
                    accountName: coreState.firmDetails?.name || 'Firm'
                },
                subTotal: payment.amount,
                taxAmount: 0,
                total_amount: payment.amount
            };

            const tenancyPeriod = (payment.periodStart && payment.periodEnd)
                ? `${formatDateWithOrdinal(payment.periodStart)} to ${formatDateWithOrdinal(payment.periodEnd)}`
                : property.rentalDetails?.leaseStart && property.rentalDetails?.leaseEnd 
                    ? `${formatDateWithOrdinal(property.rentalDetails.leaseStart)} to ${formatDateWithOrdinal(property.rentalDetails.leaseEnd)}`
                    : undefined;

            generateReceiptPdf(
                mockInvoice, 
                coreState.firmDetails, 
                (tenantContact || { name: property.rentalDetails?.tenantName || 'The Tenant' }) as any,
                { tenancyPeriod }
            );
            addToast("Tenant receipt generated.", { type: 'success' });
        } catch (error: any) {
            console.error("Receipt generation failed:", error);
            addToast("Failed to generate receipt PDF.", { type: 'error' });
        }
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Quick Stats Row — Platinum UI: uniform heights, anchored icons, fluid text */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {isLeased && !isManagementOnly && (
                    <>
                        {/* ─── Next Rent Due ───────────────────────────────────────
                          SPEC COMPLIANCE — Activity & Tracking refactor:
                            • Container: overflow-hidden p-4 relative h-28 flex flex-col justify-between
                            • Icon: top-right watermark (absolute top-3 right-3 opacity-20 w-5 h-5),
                              NOT a left-side solid colored block
                            • Date format: "15 Sep 2027" (NOT "15/0..." en-GB)
                            • Primary date sits on the shared baseline of all 4 cards
                            • h-28 (112px) gives enough room for title + date + status pill
                              without truncation; previous min-h-[88px] was too tight */}
                        <div className="bg-white dark:bg-zinc-800 p-4 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-sm overflow-hidden relative h-28 flex flex-col justify-between group">
                            {!property.rentalDetails?.leaseStart && (
                                <button
                                    onClick={() => {
                                        setAddType('lease_setup');
                                        setLocalRentAmount(formatNumberWithCommas(property.rentalDetails?.rentAmount || 0));
                                        setLeaseStart(property.rentalDetails?.leaseStart || '');
                                        setLeaseEnd(property.rentalDetails?.leaseEnd || '');
                                        setLeaseFrequency(property.rentalDetails?.rentFrequency || 'Annually');
                                        setShowAddModal(true);
                                    }}
                                    className="absolute inset-0 bg-slate-100/90 dark:bg-zinc-900/90 hover:bg-slate-100/70 flex items-center justify-center font-bold text-primary-600 transition-all z-20"
                                >
                                    Setup Lease Terms
                                </button>
                            )}
                            {/* Watermark icon — top-right, subtle */}
                            <div className="absolute top-3 right-3 opacity-20 pointer-events-none text-green-600">
                                <CurrencyDollarIcon className="w-5 h-5" />
                            </div>
                            {/* Content — title at top, date+status at bottom (shared baseline) */}
                            <p className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-zinc-400 uppercase relative z-10">
                                Next Rent Due
                            </p>
                            <div className="relative z-10">
                                <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                                    {nextRentDueDate ? formatDateShort(nextRentDueDate) : 'Not Set'}
                                </p>
                                {nextRentDueDate && daysLeft !== null && daysLeft <= 30 && (
                                    <p className="text-2xs text-orange-500 font-bold mt-0.5">Due Soon</p>
                                )}
                            </div>
                        </div>

                        {/* ─── Days Left ──────────────────────────────────────────
                          LAYOUT FIX per user request:
                            • "Ends: [date]" moved ABOVE the number (was below)
                            • Number ("401 Days") moved to the BOTTOM of the card
                              so it aligns on the same baseline as the primary
                              values in the other 3 cards (Next Rent Due date,
                              Rent Review date, Maintenance count).
                            All 4 cards use flex-col justify-between, so the
                            top element (label) and bottom element (primary
                            value) sit on identical baselines across the row. */}
                        <div
                            className="bg-white dark:bg-zinc-800 p-4 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-sm overflow-hidden relative h-28 flex flex-col justify-between cursor-pointer hover:border-blue-300 transition-colors group"
                            onClick={() => {
                                setAddType('lease_setup');
                                setLocalRentAmount(formatNumberWithCommas(property.rentalDetails?.rentAmount || 0));
                                setLeaseStart(property.rentalDetails?.leaseStart || '');
                                setLeaseEnd(property.rentalDetails?.leaseEnd || '');
                                setLeaseFrequency(property.rentalDetails?.rentFrequency || 'Annually');
                                setShowAddModal(true);
                            }}
                        >
                            <div className="absolute top-3 right-3 opacity-20 pointer-events-none text-blue-600">
                                <CalendarIcon className="w-5 h-5" />
                            </div>
                            {/* Top: label */}
                            <p className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-zinc-400 uppercase flex items-center gap-1 relative z-10">
                                Days Left <PencilSquareIcon className="w-3 h-3" />
                            </p>
                            {/* Middle: "Ends: [date]" — moved above the number */}
                            {property.rentalDetails?.leaseEnd && (
                                <p className="text-2xs text-slate-500 dark:text-zinc-400 whitespace-nowrap overflow-hidden text-ellipsis relative z-10">
                                    Ends: {formatDateShort(property.rentalDetails.leaseEnd)}
                                </p>
                            )}
                            {/* Bottom: primary number — aligns with other cards' values */}
                            <p className={`text-base sm:text-lg font-bold leading-tight whitespace-nowrap overflow-hidden text-ellipsis relative z-10 ${daysLeft !== null && daysLeft < 0 ? 'text-red-500' : daysLeft !== null && daysLeft < 90 ? 'text-orange-500' : 'text-slate-900 dark:text-white'}`}>
                                {daysLeft !== null ? (daysLeft < 0 ? `${Math.abs(daysLeft)} Overdue` : `${daysLeft} Days`) : 'N/A'}
                            </p>
                        </div>

                        {/* ─── Rent Review ──────────────────────────────────────── */}
                        <div className="bg-white dark:bg-zinc-800 p-4 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-sm overflow-hidden relative h-28 flex flex-col justify-between group">
                            <div className="absolute top-3 right-3 opacity-20 pointer-events-none text-amber-600">
                                <ClockIcon className="w-5 h-5" />
                            </div>
                            <p className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-zinc-400 uppercase relative z-10">
                                Rent Review
                            </p>
                            <div className="relative z-10">
                                <p className={`text-base sm:text-lg font-bold leading-tight whitespace-nowrap overflow-hidden text-ellipsis ${isReviewUpcoming ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`}>
                                    {rentReviewDate ? formatDateShort(rentReviewDate) : 'Not Set'}
                                </p>
                                {isReviewUpcoming && <p className="text-2xs text-amber-500 font-black animate-pulse uppercase mt-0.5">Review Due</p>}
                            </div>
                        </div>
                    </>
                )}

                {isSale && (
                    <>
                        <div className="bg-white dark:bg-zinc-800 p-4 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-sm overflow-hidden relative h-28 flex flex-col justify-between group">
                            <div className="absolute top-3 right-3 opacity-20 pointer-events-none text-green-600">
                                <CurrencyDollarIcon className="w-5 h-5" />
                            </div>
                            <p className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-zinc-400 uppercase relative z-10">
                                Target Price
                            </p>
                            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight whitespace-nowrap overflow-hidden text-ellipsis relative z-10">
                                <NairaSymbol />{formatNaira(property.saleDetails?.targetPrice || property.value || 0)}
                            </p>
                        </div>
                        <div className="bg-white dark:bg-zinc-800 p-4 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-sm overflow-hidden relative h-28 flex flex-col justify-between group">
                            <div className="absolute top-3 right-3 opacity-20 pointer-events-none text-blue-600">
                                <CalendarIcon className="w-5 h-5" />
                            </div>
                            <p className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-zinc-400 uppercase relative z-10">
                                Listing Age
                            </p>
                            <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight whitespace-nowrap overflow-hidden text-ellipsis relative z-10">
                                {property.saleDetails?.listingDate ? `${Math.ceil((new Date().getTime() - new Date(property.saleDetails.listingDate).getTime()) / (1000 * 3600 * 24))} Days` : 'N/A'}
                            </p>
                        </div>
                    </>
                )}

                {/* ─── Maintenance — always shown ───────────────────────────── */}
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-sm overflow-hidden relative h-28 flex flex-col justify-between group">
                    <div className="absolute top-3 right-3 opacity-20 pointer-events-none text-orange-600">
                        <WrenchIcon className="w-5 h-5" />
                    </div>
                    <p className="text-[11px] font-semibold tracking-wider text-slate-500 dark:text-zinc-400 uppercase relative z-10">
                        Maintenance
                    </p>
                    <p className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight whitespace-nowrap overflow-hidden text-ellipsis relative z-10">
                        {activeMaintenanceCount} {activeMaintenanceCount === 1 ? 'Task' : 'Tasks'}
                    </p>
                </div>
            </div>

            {/* Visual Progress Bars — lease timeline + rent collection.
                For Management Only properties, the LeaseProgressBars component
                internally hides the rent collection bar (it checks
                rentCollectionMode). So we can always mount it for leased
                properties — only the lease timeline + service charge bars
                will show for management-only properties. */}
            {isLeased && (
                <LeaseProgressBars property={property} />
            )}

            {/* Navigation Tabs — hide 'rent' tab for Management Only properties */}
            <div className="flex space-x-2 bg-slate-100 dark:bg-zinc-800/50 p-1 rounded-lg w-fit">
                {(['timeline', 'rent', 'maintenance'] as const)
                    .filter(tab => (isLeased && !isManagementOnly) || tab !== 'rent')
                    .map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveSection(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${activeSection === tab
                            ? 'bg-white dark:bg-zinc-800 text-primary-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:text-zinc-400'
                            }`}
                    >
                        {tab === 'timeline' ? 'Activity Timeline' : tab === 'rent' ? 'Rent History' : 'Maintenance'}
                    </button>
                ))}
            </div>

            {/* Content Sections */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm min-h-[400px]">
                {/* Header Actions */}
                <div className="p-4 border-b border-slate-100 dark:border-zinc-700 flex justify-end">
                    <button
                        onClick={() => { 
                            const type = activeSection === 'rent' ? 'rent' : activeSection === 'maintenance' ? 'maintenance' : 'event';
                            setAddType(type); 
                            if (type === 'rent') setLocalPaymentAmount(formatNumberWithCommas(property.rentalDetails?.rentAmount));
                            setShowAddModal(true); 
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-bold shadow-lg shadow-primary-500/20 transition-all"
                    >
                        <PlusIcon className="w-4 h-4" />
                        Add {activeSection === 'rent' ? 'Payment' : activeSection === 'maintenance' ? 'Request' : 'Event'}
                    </button>
                </div>

                {/* Timeline View */}
                {activeSection === 'timeline' && (
                    <div className="p-6">
                        {sortedTimeline.length === 0 ? (
                            <EmptyState icon={<ClockIcon className="w-12 h-12" />} message="No activity recorded yet." />
                        ) : (
                            <div className="space-y-4 pl-4 relative before:absolute before:inset-y-0 before:left-[23px] before:w-px before:bg-slate-200 dark:before:bg-zinc-700/50">
                                {sortedTimeline.map((event, idx) => (
                                    <div key={event.id} className="relative flex items-start gap-4">
                                        <div className="flex items-center justify-center w-6 h-6 rounded-full border-4 border-white dark:border-zinc-800 bg-slate-50 dark:bg-zinc-700 z-10 shrink-0 mt-2 shadow-sm">
                                            {event.type === 'rent_collected' ? <CurrencyDollarIcon className="w-3 h-3 text-green-600" /> :
                                                event.type === 'maintenance' ? <WrenchIcon className="w-3 h-3 text-orange-600" /> :
                                                    <CalendarIcon className="w-3 h-3 text-blue-600" />}
                                        </div>
                                        <div className="flex-1 bg-slate-50 dark:bg-zinc-900/40 p-3 rounded-lg border border-slate-100 dark:border-zinc-800 shadow-sm transition-all hover:border-slate-300 dark:hover:border-zinc-600">
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <span className="font-bold text-xs text-slate-800 dark:text-zinc-100 capitalize">{event.type.replace('_', ' ')}</span>
                                                <time className="font-mono text-2xs uppercase font-bold text-slate-400">{event.date}</time>
                                            </div>
                                            <p className="text-xs text-slate-500 dark:text-zinc-400 leading-tight">{event.description}</p>
                                            {event.amount && <p className="mt-1.5 text-xs font-black text-slate-900 dark:text-white"><NairaSymbol />{formatNaira(event.amount)}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Rent History View */}
                {activeSection === 'rent' && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 font-bold uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-4 rounded-tl-xl">Due Date</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Amount</th>
                                    <th className="px-6 py-4">Paid Date</th>
                                    <th className="px-6 py-4">Method</th>
                                    <th className="px-6 py-4 rounded-tr-xl">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-700">
                                {sortedRent.length === 0 ? (
                                    <tr><td colSpan={6} className="p-12"><EmptyState icon={<CurrencyDollarIcon className="w-12 h-12" />} message="No rent history available." /></td></tr>
                                ) : (
                                    sortedRent.map(payment => (
                                        <tr key={payment.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="px-6 py-4 font-mono text-slate-600 dark:text-zinc-300">{payment.dueDate}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${payment.status === 'paid' ? 'bg-green-100 text-green-700' :
                                                    payment.status === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                                                    }`}>
                                                    {payment.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-900 dark:text-white"><NairaSymbol />{formatNaira(payment.amount)}</td>
                                            <td className="px-6 py-4 text-slate-500">{payment.paidDate || '-'}</td>
                                            <td className="px-6 py-4 text-slate-500">{payment.paymentMethod || '-'}</td>
                                            <td className="px-6 py-4 text-slate-500">
                                                {payment.status === 'paid' && (
                                                    <button 
                                                        onClick={() => handleDownloadReceipt(payment)}
                                                        className="p-1.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-600 transition-colors"
                                                        title="Download Receipt"
                                                    >
                                                        <DownloadIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Maintenance View */}
                {activeSection === 'maintenance' && (
                    <div className="p-6">
                        {maintenance.length === 0 ? (
                            <EmptyState icon={<WrenchIcon className="w-12 h-12" />} message="No maintenance records." />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {[
                                    { id: 'reported', label: 'Reported', color: 'bg-slate-100 dark:bg-zinc-900 border-slate-200 text-slate-500' },
                                    { id: 'in_progress', label: 'In Progress', color: 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 text-blue-600' },
                                    { id: 'escalated', label: 'Escalated', color: 'bg-rose-50 dark:bg-rose-900/10 border-rose-100 text-rose-600' },
                                    { id: 'fulfilled', label: 'Fulfilled', color: 'bg-green-50 dark:bg-green-900/10 border-green-100 text-green-600' }
                                ].map(stage => {
                                    const items = maintenance.filter(m => {
                                        const status = m.status;
                                        if (stage.id === 'reported') return status === 'reported' || !status;
                                        if (stage.id === 'fulfilled') return status === 'fulfilled';
                                        return status === stage.id;
                                    });
                                    return (
                                        <div key={stage.id} className="space-y-3">
                                            <div className={`px-3 py-2 rounded-lg border ${stage.color} flex items-center justify-between`}>
                                                <span className="text-2xs font-black uppercase tracking-widest">{stage.label}</span>
                                                <span className="text-2xs font-bold px-1.5 py-0.5 rounded-md bg-white/50 dark:bg-black/20">{items.length}</span>
                                            </div>

                                            <div className="space-y-3">
                                                {items.map(record => (
                                                    <div key={record.id} className="group p-3 bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-sm hover:border-primary-500 transition-all">
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className={`px-1.5 py-0.5 rounded text-3xs font-black uppercase tracking-tight ${
                                                                record.priority === 'emergency' ? 'bg-red-500 text-white' :
                                                                record.priority === 'high' ? 'bg-orange-500 text-white' :
                                                                record.priority === 'medium' ? 'bg-blue-500 text-white' :
                                                                'bg-slate-500 text-white'
                                                            }`}>
                                                                {record.priority || 'low'}
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                {record.taskId && (
                                                                    <div className="w-2 h-2 rounded-full bg-blue-500" title="Task Linked" />
                                                                )}
                                                                <span className="text-2xs font-bold text-slate-400">{record.date}</span>
                                                            </div>
                                                        </div>
                                                        
                                                        <h4 className="font-bold text-xs text-slate-900 dark:text-white leading-tight mb-1">{record.issue}</h4>
                                                        
                                                        {(record.vendorName || record.vendorPhone) && (
                                                            <div className="flex items-center gap-2 mb-2 p-1.5 bg-slate-50 dark:bg-zinc-900 rounded-lg border border-slate-100 dark:border-zinc-800">
                                                                <div className="p-1 bg-white dark:bg-zinc-800 rounded shadow-sm">
                                                                    <WrenchIcon className="w-3 h-3 text-slate-400" />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-2xs font-bold text-slate-700 dark:text-zinc-300 truncate">{record.vendorName || 'No Vendor'}</p>
                                                                    <p className="text-3xs text-slate-400 truncate">{record.vendorPhone || 'No contact info'}</p>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between gap-1 mt-3 pt-3 border-t border-slate-100 dark:border-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {!record.taskId && stage.id !== 'fulfilled' && (
                                                                <button 
                                                                    onClick={() => handleConvertToTask(record)}
                                                                    className="text-3xs font-bold text-blue-600 hover:underline"
                                                                >
                                                                    Convert to Task
                                                                </button>
                                                            )}
                                                            <div className="flex items-center gap-1 ml-auto">
                                                                {stage.id === 'reported' && (
                                                                    <button onClick={() => updateMaintenanceStatus(record.id, 'in_progress')} className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><CheckCircleIcon className="w-3 h-3" /></button>
                                                                )}
                                                                {stage.id === 'in_progress' && (
                                                                    <>
                                                                        <button onClick={() => updateMaintenanceStatus(record.id, 'escalated')} className="p-1 bg-rose-50 text-rose-600 rounded hover:bg-rose-100"><ExclamationCircleIcon className="w-3 h-3" /></button>
                                                                        <button onClick={() => updateMaintenanceStatus(record.id, 'fulfilled')} className="p-1 bg-green-50 text-green-600 rounded hover:bg-green-100"><CheckCircleIcon className="w-3 h-3" /></button>
                                                                    </>
                                                                )}
                                                                {stage.id === 'escalated' && (
                                                                    <button onClick={() => updateMaintenanceStatus(record.id, 'fulfilled')} className="p-1 bg-green-50 text-green-600 rounded hover:bg-green-100"><CheckCircleIcon className="w-3 h-3" /></button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Configurable Form Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold">
                                {addType === 'rent' ? 'Record Rent Payment' :
                                    addType === 'maintenance' ? 'Log Maintenance Request' :
                                        addType === 'lease_setup' ? 'Edit Lease Terms' : 'Add Event'}
                            </h3>
                            <button onClick={() => setShowAddModal(false)}><XMarkIcon className="w-6 h-6 text-slate-400" /></button>
                        </div>

                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const data = Object.fromEntries(formData.entries());
                            await handleSave(data);
                        }} className="space-y-4">

                            {addType === 'rent' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Amount Paid</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₦</span>
                                            <input autoComplete="off" data-lpignore="true"  
                                                type="text" 
                                                name="amount" 
                                                value={localPaymentAmount}
                                                onChange={e => setLocalPaymentAmount(formatNumberWithCommas(e.target.value))}
                                                className="w-full pl-8 pr-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800" 
                                                required 
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Due Date</label>
                                            <input autoComplete="off" data-lpignore="true"  type="date" name="dueDate" defaultValue={nextRentDueDate || new Date().toISOString().split('T')[0]} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800" required />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Paid Date</label>
                                            <input autoComplete="off" data-lpignore="true"  type="date" name="paidDate" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800" required />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-2xs font-black text-primary-600 uppercase tracking-widest mb-1">Period Start</label>
                                            <input autoComplete="off" data-lpignore="true"  type="date" name="periodStart" defaultValue={nextRentDueDate || new Date().toISOString().split('T')[0]} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800" required />
                                        </div>
                                        <div>
                                            <label className="block text-2xs font-black text-primary-600 uppercase tracking-widest mb-1">Period End</label>
                                            <input autoComplete="off" data-lpignore="true"  type="date" name="periodEnd" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800" required />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
                                        <select name="method" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800">
                                            <option value="Transfer">Bank Transfer</option>
                                            <option value="Cash">Cash</option>
                                            <option value="Cheque">Cheque</option>
                                            <option value="POS">POS</option>
                                        </select>
                                    </div>
                                </>
                            )}

                            {addType === 'event' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Event Type</label>
                                        <select
                                            name="type"
                                            defaultValue="inspection"
                                            className="w-full px-4 py-2 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 transition-all outline-none text-slate-900 dark:text-white font-bold"
                                        >
                                            <option value="inspection">Inspection</option>
                                            <option value="renewal">Lease Renewal</option>
                                            <option value="tenant_change">Tenant Change</option>
                                            <option value="maintenance">Maintenance Log</option>
                                            <option value="other">Other Activity</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Date</label>
                                        <input autoComplete="off" data-lpignore="true" 
                                            type="date"
                                            name="date"
                                            defaultValue={today}
                                            className="w-full px-4 py-2 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 transition-all outline-none text-slate-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Description</label>
                                        <textarea
                                            name="description"
                                            className="w-full px-4 py-2 bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 transition-all outline-none text-slate-900 dark:text-white min-h-[100px]"
                                            placeholder="Details about this event..."
                                            required
                                        />
                                    </div>
                                </div>
                            )}

                            {addType === 'maintenance' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Issue Description</label>
                                        <input autoComplete="off" data-lpignore="true"  type="text" name="issue" placeholder="e.g. Leaking roof" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800" required />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Date Reported</label>
                                            <input autoComplete="off" data-lpignore="true"  type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800" required />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                                            <select name="priority" className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800">
                                                <option value="low">Low</option>
                                                <option value="medium">Medium</option>
                                                <option value="high">High</option>
                                                <option value="emergency">Emergency</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Assign Vendor (Optional)</label>
                                        <select 
                                            name="vendorId" 
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800"
                                            onChange={(e) => {
                                                const contact = matterState.contacts.find(c => c.id === e.target.value);
                                                if (contact) {
                                                    // Hidden inputs for vendor name/phone to be captured by formData
                                                    const nameInput = document.getElementById('vendorNameInput') as HTMLInputElement;
                                                    const phoneInput = document.getElementById('vendorPhoneInput') as HTMLInputElement;
                                                    if (nameInput) nameInput.value = contact.name;
                                                    if (phoneInput) phoneInput.value = contact.phone || '';
                                                }
                                            }}
                                        >
                                            <option value="">Select a Vendor</option>
                                            {matterState.contacts.filter(c => c.category?.toLowerCase().includes('vendor') || c.contactType?.toLowerCase().includes('vendor')).map(vendor => (
                                                <option key={vendor.id} value={vendor.id}>{vendor.name} ({vendor.category})</option>
                                            ))}
                                        </select>
                                        <input type="hidden" name="vendorName" id="vendorNameInput" />
                                        <input type="hidden" name="vendorPhone" id="vendorPhoneInput" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                                        <textarea name="notes" placeholder="Additional details..." className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 h-24"></textarea>
                                    </div>
                                </>
                            )}

                            {addType === 'lease_setup' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Tenant Name</label>
                                        <input autoComplete="off" data-lpignore="true"  type="text" name="tenantName" defaultValue={property.rentalDetails?.tenantName} className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Rent Amount (₦)</label>
                                            <input autoComplete="off" data-lpignore="true"  
                                                type="text" 
                                                name="rentAmount" 
                                                value={localRentAmount}
                                                onChange={e => setLocalRentAmount(formatNumberWithCommas(e.target.value))}
                                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800" 
                                                required 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Frequency</label>
                                            <select 
                                                name="rentFrequency" 
                                                value={leaseFrequency}
                                                onChange={e => handleLeaseFrequencyChange(e.target.value)}
                                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800"
                                            >
                                                <option value="Annually">Annually</option>
                                                <option value="Bi-Annually">Bi-Annually</option>
                                                <option value="Quarterly">Quarterly</option>
                                                <option value="Monthly">Monthly</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Commencement Date</label>
                                            <input 
                                                autoComplete="off" data-lpignore="true" 
                                                type="date" 
                                                name="commencementDate" 
                                                value={leaseStart}
                                                onChange={e => handleLeaseStartChange(e.target.value)}
                                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800" 
                                                required 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Termination Date</label>
                                            <input 
                                                autoComplete="off" data-lpignore="true" 
                                                type="date" 
                                                name="terminationDate" 
                                                value={leaseEnd}
                                                onChange={e => setLeaseEnd(e.target.value)}
                                                className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800" 
                                                required 
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            <button type="submit" className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-bold transition-colors shadow-lg shadow-primary-500/20">
                                Save Records
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

const EmptyState: React.FC<{ icon: React.ReactNode, message: string }> = ({ icon, message }) => (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
        <div className="mb-4 opacity-50">{icon}</div>
        <p className="text-sm font-medium">{message}</p>
    </div>
);

export default function PropertyTrackingViewWrapper(props: PropertyTrackingViewProps) {
    return (
        <ErrorBoundary>
            <PropertyTrackingViewContent {...props} />
        </ErrorBoundary>
    );
}
