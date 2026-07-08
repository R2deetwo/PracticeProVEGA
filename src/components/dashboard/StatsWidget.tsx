import React, { useState } from 'react';
import { MattersIcon, ContactsIcon, NairaCircleIcon } from '../../constants';
import { Building2, ClipboardCheck } from 'lucide-react';
import StatCard from '../StatCard';
import { formatLargeNumber } from '../../utils/formatting';
import NairaSymbol from '../NairaSymbol';
import { View, UserRole, User } from '../../types';
import { Skeleton } from '../toolkit/Skeleton';
import { useProduct } from '../../contexts/ProductContext';

interface StatsWidgetProps {
    activeMattersCount: number;
    overdueTasksCount: number;
    outstandingRevenue: number;
    contactsCount: number;
    propertyCount?: number;
    propertyRevenue?: number;
    activeLeasesCount?: number;
    navigateTo: (view: View) => void;
    isCompact?: boolean;
    isLoading?: boolean;
    currentUser: User;
}

const TaskAlertIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z" />
        <path d="M12 11v3" strokeWidth="2" />
        <path d="M12 16h.01" strokeWidth="2" />
    </svg>
);

interface OutstandingCardProps {
    outstandingRevenue: number;
    propertyRevenue: number;
    showInvoices: boolean;
    showRent: boolean;
    isLoading: boolean;
    navigateTo: (view: View) => void;
}

const OutstandingCard: React.FC<OutstandingCardProps> = ({
    outstandingRevenue,
    propertyRevenue,
    showInvoices,
    showRent,
    isLoading,
    navigateTo,
}) => {
    const showTabs = showInvoices && showRent;
    const [activeTab, setActiveTab] = useState<'invoices' | 'rent'>('invoices');

    const displayInvoices = showTabs ? activeTab === 'invoices' : showInvoices;
    const value = displayInvoices ? outstandingRevenue : propertyRevenue;
    const label = displayInvoices ? 'Outstanding Invoices' : 'Outstanding Rent';
    const nav: View = displayInvoices ? 'billing' : 'atriumEngine';
    const colorClass = displayInvoices ? 'bg-yellow-500' : 'bg-amber-500';
    const textClass = displayInvoices ? 'text-yellow-500' : 'text-amber-500';

    return (
        <div className="h-24 relative overflow-hidden rounded-2xl isolate transform-gpu">
            <div
                className={`relative overflow-hidden card-premium h-full flex flex-col cursor-pointer active:scale-[0.98] group`}
                onClick={() => navigateTo(nav)}
            >
                {/* Decorative background icon */}
                <div className="absolute -right-6 -top-6 opacity-[0.03] dark:opacity-[0.05] text-slate-900 dark:text-white pointer-events-none transform -rotate-12 transition-transform duration-700 group-hover:scale-110 group-hover:rotate-0">
                    <NairaCircleIcon className="w-32 h-32" />
                </div>

                <div className="relative z-10 flex items-center justify-between flex-1 px-5">
                    {/* Icon on LEFT — matches StatCard layout (icon left, text right).
                        Previously the naira icon was on the RIGHT which conflicted
                        with the monochrome naira symbol in the text on the LEFT,
                        making both naira symbols appear on the same side. */}
                    <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center ${colorClass} bg-opacity-10 flex-shrink-0 shadow-sm border border-white/10`}>
                        <NairaCircleIcon className={`w-5 h-5 ${textClass}`} />
                    </div>
                    <div className="flex flex-col justify-center min-w-0 pl-3 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap truncate">{label}</p>
                            {showTabs && (
                                <div
                                    className="flex items-center gap-0.5 bg-slate-100 dark:bg-zinc-800 rounded-full p-0.5"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <button
                                        onClick={() => setActiveTab('invoices')}
                                        className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full transition-all ${activeTab === 'invoices' ? 'bg-yellow-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'}`}
                                    >
                                        INV
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('rent')}
                                        className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full transition-all ${activeTab === 'rent' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300'}`}
                                    >
                                        RENT
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight break-all">
                            {isLoading ? <Skeleton width={100} height={28} /> : <><NairaSymbol />{formatLargeNumber(value)}</>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatsWidget: React.FC<StatsWidgetProps> = ({ activeMattersCount, overdueTasksCount, outstandingRevenue, contactsCount, propertyCount = 0, propertyRevenue = 0, activeLeasesCount = 0, navigateTo, isCompact, isLoading = false, currentUser }) => {
    const isAdmin = currentUser.role === UserRole.Admin;
    // Use hasPropertyFeatures (not isProperty) so Komplete (unified) mode
    // shows the Managed Units card. isProperty only controls the assistant
    // name (ALOA vs ARIA), not feature availability.
    const { isLegal, hasPropertyFeatures } = useProduct();

    const showFinanceCard = isAdmin && (isLegal || hasPropertyFeatures);

    const totalCards =
        (isLegal ? 1 : 0) +
        (hasPropertyFeatures ? 1 : 0) +
        1 +
        (showFinanceCard ? 1 : 0);

    const gridClass = isCompact
        ? "grid-cols-1 gap-3"
        : totalCards === 4
            ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"
            : totalCards === 3
                ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4"
                : "grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4";

    return (
        <div className={`grid ${gridClass}`}>
            {isLegal && (
                <div className="h-24 relative overflow-hidden rounded-2xl isolate transform-gpu">
                    <StatCard
                        title="Active Matters"
                        value={isLoading ? <Skeleton width={40} height={28} /> : activeMattersCount}
                        icon={<MattersIcon className="w-full h-full" />}
                        colorClass="bg-blue-500"
                        onClick={() => navigateTo('matters')}
                    />
                </div>
            )}

            {hasPropertyFeatures && (
                <div className="h-24 relative overflow-hidden rounded-2xl isolate transform-gpu">
                    <StatCard
                        title="Managed Units"
                        value={isLoading ? <Skeleton width={40} height={28} /> : propertyCount}
                        icon={<Building2 className="w-full h-full" />}
                        colorClass="bg-indigo-500"
                        onClick={() => navigateTo('properties')}
                    />
                </div>
            )}

            <div className="h-24 relative overflow-hidden rounded-2xl isolate transform-gpu">
                <StatCard
                    title="Overdue Tasks"
                    value={isLoading ? <Skeleton width={40} height={28} /> : overdueTasksCount}
                    icon={<ClipboardCheck className="w-full h-full" />}
                    colorClass="bg-red-500"
                    onClick={() => navigateTo('tasks')}
                />
            </div>

            {showFinanceCard && (
                <OutstandingCard
                    outstandingRevenue={outstandingRevenue}
                    propertyRevenue={propertyRevenue}
                    showInvoices={isLegal}
                    showRent={hasPropertyFeatures}
                    isLoading={isLoading}
                    navigateTo={navigateTo}
                />
            )}
        </div>
    );
};

export default StatsWidget;
