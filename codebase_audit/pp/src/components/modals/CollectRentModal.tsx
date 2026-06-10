
import React, { useState, useMemo } from 'react';
import { Property, Contact, InvoiceStatus, InvoiceLineItem, BankAccount, RentPayment } from '../../types';
import { useCoreState } from '../../contexts/CoreContext';
import { useDataActions } from '../../contexts/DataContext';
import { useUI } from '../../contexts/UIContext';
import { useMatterState } from '../../contexts/MatterContext';
import { 
    BanknotesIcon, 
    CalendarIcon, 
    CheckCircleIcon, 
    XIcon, 
    OfficeBuildingIcon, 
    UserIcon, 
    CalculatorIcon,
    DownloadIcon
} from '../../constants';
import NairaSymbol from '../NairaSymbol';
import { formatNaira, formatDateWithOrdinal } from '../../utils/formatting';
import { v4 as uuidv4 } from 'uuid';
import { generateReceiptPdf } from '../../services/reportGenerator';

interface CollectRentModalProps {
    property: Property;
    onClose: () => void;
}

const CollectRentModal: React.FC<CollectRentModalProps> = ({ property, onClose }) => {
    const { coreState } = useCoreState();
    const { matterState } = useMatterState();
    const { updateItem, handleGenerateInvoice, logActivity } = useDataActions();
    const { addToast } = useUI();

    // Find the owner/contact
    const owner = matterState.contacts.find(c => 
        c.id === property.contactId || (c.properties || []).some(p => p.id === property.id)
    );

    // Get last payment
    const sortedHistory = [...(property.rentPaymentHistory || [])].sort((a, b) => {
        const dateA = a.paidDate ? new Date(a.paidDate).getTime() : 0;
        const dateB = b.paidDate ? new Date(b.paidDate).getTime() : 0;
        return dateB - dateA;
    });
    const lastPayment = sortedHistory[0];

    const initialAmount = property.rentalDetails?.rentAmount || property.value || lastPayment?.amount || 0;
    const [amountValue, setAmountValue] = useState(initialAmount);
    const [displayAmount, setDisplayAmount] = useState(initialAmount.toLocaleString());
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
    const [periodStart, setPeriodStart] = useState(new Date().toISOString().split('T')[0]);
    const [periodEnd, setPeriodEnd] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleAmountChange = (val: string) => {
        // Remove commas and non-numeric chars except decimal
        const numeric = val.replace(/,/g, '').replace(/[^0-9.]/g, '');
        const num = parseFloat(numeric) || 0;
        setAmountValue(num);
        
        // Format with commas for display
        if (numeric === '') {
            setDisplayAmount('');
        } else {
            setDisplayAmount(num.toLocaleString());
        }
    };

    // Fee Calculation
    const feePercentage = property.managementFeePercentage || 2.5;
    const feeAmount = useMemo(() => (amountValue * feePercentage) / 100, [amountValue, feePercentage]);
    const netToClient = amountValue - feeAmount;
    const tenantName = property.rentalDetails?.tenantName;

    const handleCollect = async () => {
        if (!owner) {
            addToast("Owner not found for this property.", { type: 'error' });
            return;
        }

        setIsProcessing(true);
        try {
            // 1. Update Property Rent History (Update both standalone table and legacy nested array)
            const newPayment = {
                id: uuidv4(),
                dueDate: paymentDate,
                paidDate: paymentDate,
                amount: amountValue,
                status: 'paid' as const,
                paymentMethod,
                receiptNumber: `REC-${Math.floor(100000 + Math.random() * 900000)}`,
                periodStart,
                periodEnd
            };

            const updatedHistory = [...(property.rentPaymentHistory || []), newPayment];
            
            // Update standalone property record
            await updateItem('properties', { id: property.id, rentPaymentHistory: updatedHistory, status: 'Occupied' }, 'Property Payment');

            // Legacy support: also update contact if it has the nested property
            if (owner.properties?.some(p => p.id === property.id)) {
                const updatedProperties = owner.properties.map(p => 
                    p.id === property.id ? { ...p, rentPaymentHistory: updatedHistory, status: 'Occupied' as const } : p
                );
                await updateItem('contacts', { id: owner.id, properties: updatedProperties }, 'Property Payment');
            }

            // 2. Generate Invoice for the Management Fee (to show in analytics as income)
            // We need a dummy matter or a generic one if not linked
            const linkedMatterId = property.disputeDetails?.status; // Check if we have a linked matter
            // Actually, property has disputeDetails which sometimes stores matterId in status field (hacky but seen in code)
            // Let's look for a matter linked to this property
            const linkedMatter = matterState.matters.find(m => m.clientId === owner.id && m.title.includes(property.address));

            const feeItem: InvoiceLineItem = {
                id: uuidv4(),
                description: `Management Fee for ${property.address} (Period: ${new Date(paymentDate).toLocaleString('default', { month: 'long', year: 'numeric' })})`,
                hours: 1,
                rate: feeAmount,
                total: feeAmount
            };

            const defaultAccount: BankAccount = coreState.firmDetails?.bankAccounts?.[0] || {
                id: '1',
                bankName: 'PracticePro Default',
                accountName: coreState.firmDetails?.name || 'Firm',
                accountNumber: '0000000000'
            };

            // Generate the invoice and mark as paid immediately
            await handleGenerateInvoice(
                linkedMatter || { id: 'firm-general', title: 'General Management', clientId: owner.id } as any,
                [feeItem],
                { issueDate: paymentDate, dueDate: paymentDate },
                [], [],
                defaultAccount,
                { applicable: false }
            );

            logActivity(
                `Collected rent for ${property.address}. Fee: ${formatNaira(feeAmount)}`,
                'Contact',
                property.id,
                property.address
            );

            // 3. Automatically trigger receipt generation
            handleDownloadTenantReceipt(true); // pass true to indicate it's part of collection

            addToast(`Rent collected and management fee recorded.`, { type: 'success' });
            onClose();
        } catch (error: any) {
            console.error("Failed to collect rent:", error);
            addToast(`Failed to process rent collection: ${error.message || 'Unknown error'}`, { type: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDownloadTenantReceipt = (isSilentOrPayment: boolean | RentPayment = false) => {
        const isSilent = typeof isSilentOrPayment === 'boolean' ? isSilentOrPayment : false;
        const payment = typeof isSilentOrPayment === 'object' ? isSilentOrPayment : null;

        try {

            if (!isSilent) console.log("[CollectRentModal] Generating tenant receipt...");
            
            const receiptAmount = payment ? payment.amount : amountValue;
            const receiptDate = payment ? (payment.paidDate || payment.dueDate) : paymentDate;
            const receiptNumber = payment ? (payment.receiptNumber || `REC-${Math.floor(100000 + Math.random() * 900000)}`) : `REC-${Math.floor(100000 + Math.random() * 900000)}`;

            const mockInvoice: any = {
                id: uuidv4(),
                invoiceNumber: receiptNumber,
                client: { id: 'tenant', name: tenantName || 'The Tenant' },
                matter: { id: property.id, title: `Rent Payment: ${property.address}` },
                lineItems: [{
                    id: uuidv4(),
                    description: `Rent for ${property.address}`,
                    hours: 1,
                    rate: receiptAmount,
                    total: receiptAmount
                }],
                status: InvoiceStatus.Paid,
                issueDate: receiptDate,
                dueDate: receiptDate,
                paidDate: receiptDate,
                paymentDetails: coreState.firmDetails?.bankAccounts?.[0] || { 
                    bankName: 'PracticePro Default', 
                    accountNumber: '0000000000',
                    accountName: coreState.firmDetails?.name || 'Firm'
                },
                subTotal: receiptAmount,
                taxAmount: 0,
                total_amount: receiptAmount
            };

            const pStart = payment ? payment.periodStart : periodStart;
            const pEnd = payment ? payment.periodEnd : periodEnd;
            
            const tenancyPeriod = (pStart && pEnd)
                ? `${formatDateWithOrdinal(pStart)} to ${formatDateWithOrdinal(pEnd)}`
                : property.rentalDetails?.leaseStart && property.rentalDetails?.leaseEnd 
                    ? `${formatDateWithOrdinal(property.rentalDetails.leaseStart)} to ${formatDateWithOrdinal(property.rentalDetails.leaseEnd)}`
                    : undefined;

            generateReceiptPdf(mockInvoice, coreState.firmDetails, { name: tenantName || 'The Tenant' } as any, { tenancyPeriod });
            if (!isSilent) addToast("Tenant receipt generated.", { type: 'success' });
        } catch (error: any) {
            console.error("[CollectRentModal] Receipt generation failed:", error);
            if (!isSilent) addToast("Failed to generate receipt PDF.", { type: 'error' });
        }
    };

    return (
        <div className="p-1 sm:p-4">
            <div className="mb-6 flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-2xl text-green-600 dark:text-green-400">
                    <BanknotesIcon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Issue Rent Receipt</h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">Record rent collection and calculate management fees.</p>
                </div>
                {lastPayment && (
                    <button
                        onClick={() => handleDownloadTenantReceipt(lastPayment)}
                        className="px-3 py-2 text-xs font-bold bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-lg flex items-center gap-2 border border-slate-200 dark:border-zinc-700"
                        title={lastPayment.paidDate ? `Last paid: ${new Date(lastPayment.paidDate).toLocaleDateString('en-GB')} for ${formatNaira(lastPayment.amount)}` : undefined}
                    >
                        <DownloadIcon className="w-4 h-4" /> Download Last Receipt
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                {/* Left: Input Form */}
                <div className="space-y-4">
                    <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100 dark:border-zinc-700 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rent Amount</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold"><NairaSymbol /></span>
                                <input autoComplete="off" data-lpignore="true" 
                                    type="text"
                                    value={displayAmount}
                                    onChange={e => handleAmountChange(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date Paid</label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input autoComplete="off" data-lpignore="true" 
                                        type="date"
                                        value={paymentDate}
                                        onChange={e => {
                                            setPaymentDate(e.target.value);
                                            if (!periodStart) setPeriodStart(e.target.value);
                                        }}
                                        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-slate-700 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Method</label>
                                <select 
                                    value={paymentMethod}
                                    onChange={e => setPaymentMethod(e.target.value)}
                                    className="w-full px-4 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-medium text-slate-700 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                >
                                    <option>Bank Transfer</option>
                                    <option>Cheque</option>
                                    <option>Cash</option>
                                    <option>Other</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-primary-600 uppercase tracking-widest ml-1">Period Start</label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
                                    <input autoComplete="off" data-lpignore="true" 
                                        type="date"
                                        value={periodStart}
                                        onChange={e => setPeriodStart(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-primary-200 dark:border-primary-900/30 rounded-xl text-sm font-medium text-slate-700 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-primary-600 uppercase tracking-widest ml-1">Period End</label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" />
                                    <input autoComplete="off" data-lpignore="true" 
                                        type="date"
                                        value={periodEnd}
                                        onChange={e => setPeriodEnd(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3 bg-white dark:bg-zinc-900 border border-primary-200 dark:border-primary-900/30 rounded-xl text-sm font-medium text-slate-700 dark:text-zinc-200 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-primary-50 dark:bg-primary-900/10 rounded-2xl border border-primary-100 dark:border-primary-900/30">
                        <div className="p-2 bg-primary-100 dark:bg-primary-800 rounded-lg text-primary-600 dark:text-primary-400">
                            <OfficeBuildingIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-primary-600 uppercase tracking-tight">Property</p>
                            <p className="text-xs font-bold text-slate-700 dark:text-zinc-200 truncate">{property.address}</p>
                        </div>
                    </div>
                </div>

                {/* Right: Breakdown & Summary */}
                <div className="bg-slate-900 dark:bg-black rounded-3xl p-6 text-white flex flex-col shadow-xl">
                    <div className="flex items-center gap-2 mb-6 opacity-60">
                        <CalculatorIcon className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Financial Breakdown</span>
                    </div>

                    <div className="space-y-4 flex-grow">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-400">Gross Rent</span>
                            <span className="font-bold"><NairaSymbol />{formatNaira(amountValue)}</span>
                        </div>
                        <div className="flex justify-between items-start text-sm">
                            <div className="flex flex-col">
                                <span className="text-slate-400">Management Fee</span>
                                <span className="text-[9px] w-fit mt-1 px-1.5 py-0.5 bg-primary-500/20 text-primary-400 rounded-md font-bold uppercase tracking-tighter">{feePercentage}% Firm Share</span>
                            </div>
                            <span className="font-bold text-primary-400">- <NairaSymbol />{formatNaira(feeAmount)}</span>
                        </div>
                        
                        <div className="h-px bg-white/10 my-4"></div>

                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Net to Client</p>
                                <p className="text-3xl font-black"><NairaSymbol />{formatNaira(netToClient)}</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/10 space-y-3">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                <UserIcon className="w-3 h-3" />
                                <span>Client: <strong className="text-white">{owner?.name || 'Unknown'}</strong></span>
                            </div>
                            {tenantName && (
                                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                    <UserIcon className="w-3 h-3 opacity-50" />
                                    <span>Tenant: <strong className="text-white/80">{tenantName}</strong></span>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleCollect}
                            disabled={isProcessing || amountValue <= 0}
                            className="w-full py-4 bg-primary-600 hover:bg-primary-500 disabled:bg-slate-700 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all shadow-lg shadow-primary-900/20 group"
                        >
                            {isProcessing ? 'Processing...' : 'Confirm & Issue Receipt'}
                        </button>
                        <button
                            onClick={() => handleDownloadTenantReceipt()}
                            type="button"
                            className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-white/5"
                        >
                            <DownloadIcon className="w-3.5 h-3.5" />
                            Download Tenant Receipt
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex justify-center">
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                    <XIcon className="w-4 h-4" /> Cancel
                </button>
            </div>
        </div>
    );
};

export default CollectRentModal;
