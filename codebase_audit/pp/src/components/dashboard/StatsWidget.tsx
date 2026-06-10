import React from 'react';
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

const StatsWidget: React.FC<StatsWidgetProps> = ({ activeMattersCount, overdueTasksCount, outstandingRevenue, contactsCount, propertyCount = 0, propertyRevenue = 0, activeLeasesCount = 0, navigateTo, isCompact, isLoading = false, currentUser }) => {
    const isAdmin = currentUser.role === UserRole.Admin;
    const { isLegal } = useProduct();

    // Grid adapts based on role (Admin shows 3 cards, others show 2 or 3)
    const gridClass = isCompact
        ? "grid-cols-1 gap-3"
        : isAdmin
            ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4" 
            : "grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4"; 

    return (
        <div className={`grid ${gridClass}`}>
            <div className="h-24 relative overflow-hidden rounded-2xl">
                {isLegal ? (
                    <StatCard
                        title="Active Matters"
                        value={isLoading ? <Skeleton width={40} height={28} /> : activeMattersCount}
                        icon={<MattersIcon className="w-full h-full" />}
                        colorClass="bg-blue-500"
                        onClick={() => navigateTo('matters')}
                    />
                ) : (
                    <StatCard
                        title="Managed Units"
                        value={isLoading ? <Skeleton width={40} height={28} /> : propertyCount}
                        icon={<Building2 className="w-full h-full" />}
                        colorClass="bg-blue-500"
                        onClick={() => navigateTo('properties')}
                    />
                )}
            </div>
            <div className="h-24 relative overflow-hidden rounded-2xl">
                <StatCard
                    title="Overdue Tasks"
                    value={isLoading ? <Skeleton width={40} height={28} /> : overdueTasksCount}
                    icon={<ClipboardCheck className="w-full h-full" />}
                    colorClass="bg-red-500"
                    onClick={() => navigateTo('tasks')}
                />
            </div>

            {/* Financial Card - Restricted to Admin */}
            {isAdmin && (
                <div className="h-24 relative overflow-hidden rounded-2xl">
                    {isLegal ? (
                        <StatCard
                            title="Outstanding Invoices"
                            value={isLoading ? <Skeleton width={100} height={28} /> : <><NairaSymbol />{formatLargeNumber(outstandingRevenue)}</>}
                            icon={<NairaCircleIcon className="w-full h-full" />}
                            colorClass="bg-yellow-500"
                            onClick={() => navigateTo('billing')}
                            isSensitive={true}
                        />
                    ) : (
                        <StatCard
                            title="Rent Due"
                            value={isLoading ? <Skeleton width={100} height={28} /> : <><NairaSymbol />{formatLargeNumber(propertyRevenue)}</>}
                            icon={<NairaCircleIcon className="w-full h-full" />}
                            colorClass="bg-emerald-600"
                            onClick={() => navigateTo('properties')}
                            isSensitive={true}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default StatsWidget;
