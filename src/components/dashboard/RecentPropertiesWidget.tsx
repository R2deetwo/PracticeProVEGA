
import React from 'react';
import { Property, FirmActivity, User, View, ModalType } from '../../types';
import { timeAgo } from '../../utils/colorUtils';
import { OfficeBuildingIcon } from '../../constants';
import { Skeleton } from '../toolkit/Skeleton';
import NairaSymbol from '../NairaSymbol';
import { formatNaira } from '../../utils/formatting';

interface RecentPropertiesWidgetProps {
    properties: Property[];
    firmActivity: FirmActivity[];
    users: User[];
    currentUser: User;
    onNavigateToDetail: (view: View, id: string | null, context?: any) => void;
    openModal: (modalType: ModalType, id: string | null, context?: any) => void;
    isLoading?: boolean;
}

const RecentPropertiesWidget: React.FC<RecentPropertiesWidgetProps> = ({ properties, firmActivity, users, currentUser, onNavigateToDetail, openModal, isLoading = false }) => {
    const categories = ['Recent', 'Maintenance', 'Vacant'] as const;
    const [activeCategory, setActiveCategory] = React.useState<typeof categories[number]>('Recent');

    const handleNextCategory = () => {
        const nextIndex = (categories.indexOf(activeCategory) + 1) % categories.length;
        setActiveCategory(categories[nextIndex]);
    };

    const handlePrevCategory = () => {
        const prevIndex = (categories.indexOf(activeCategory) - 1 + categories.length) % categories.length;
        setActiveCategory(categories[prevIndex]);
    };

    const recentProperties = React.useMemo(() => {
        if (isLoading) return [];
        
        let filtered = properties || [];
        
        if (activeCategory === 'Maintenance') {
            filtered = properties.filter(p => p.status === 'Maintenance');
        } else if (activeCategory === 'Vacant') {
            filtered = properties.filter(p => p.status === 'Vacant');
        }

        // Sort by last activity or creation
        return [...filtered].sort((a, b) => {
            const aTime = new Date((a as any).createdAt || 0).getTime();
            const bTime = new Date((b as any).createdAt || 0).getTime();
            return bTime - aTime;
        }).slice(0, 5);
    }, [properties, activeCategory, isLoading]);

    return (
        <div className="card-premium flex flex-col h-full overflow-hidden halo-hover transition-all duration-300">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-zinc-800/50 bg-slate-50/30 dark:bg-zinc-900/30">
                <div className="flex items-center gap-3">
                   <div className="flex items-center bg-slate-100 dark:bg-zinc-800 rounded-lg p-0.5">
                        <button 
                            onClick={handlePrevCategory}
                            className="p-1 rounded-md hover:bg-white dark:hover:bg-zinc-700 text-slate-400 hover:text-primary-600 transition-all"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button 
                            onClick={handleNextCategory}
                            className="p-1 rounded-md hover:bg-white dark:hover:bg-zinc-700 text-slate-400 hover:text-primary-600 transition-all"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                        </button>
                   </div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                        {activeCategory} Properties
                    </h3>
                </div>
                <button onClick={() => onNavigateToDetail('properties', null)} className="text-2xs font-bold text-slate-400 hover:text-primary-600 transition-colors uppercase tracking-widest h-fit">All</button>
            </div>
            
            <div className="flex-grow overflow-y-auto relative min-h-0">
                {isLoading ? (
                    <div className="p-4 space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex justify-between items-center border-b border-slate-50 dark:border-zinc-700/50 pb-2">
                                <div className="space-y-2">
                                    <Skeleton width={120} height={16} />
                                    <Skeleton width={80} height={12} />
                                </div>
                                <Skeleton width={60} height={24} />
                            </div>
                        ))}
                    </div>
                ) : recentProperties.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-zinc-800 dark:bg-zinc-700 flex items-center justify-center mb-2">
                            <OfficeBuildingIcon className="h-5 w-5 text-slate-400" />
                        </div>
                        <h3 className="text-xs font-medium text-slate-500 dark:text-zinc-400">No {activeCategory} Properties</h3>
                        {/* CRO AUDIT Track C — C4: add inline CTA so users can add their
                            first property directly from the dashboard widget, instead of
                            having to navigate to the Properties view to find the button. */}
                        <button
                          onClick={() => openModal('newProperty')}
                          className="mt-3 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-2xs font-black uppercase tracking-widest rounded-lg transition-all hover:-translate-y-0.5 active:scale-95"
                        >
                          + Add Your First Property
                        </button>
                    </div>
                ) : (
                    <div className="animate-fade-in-scale h-full">
                        {recentProperties.map((property) => (
                            <div
                                key={property.id}
                                onClick={() => onNavigateToDetail('properties', property.id)}
                                className="group flex justify-between items-center hover:bg-slate-50 dark:hover:bg-zinc-700/30 cursor-pointer border-b border-slate-50 dark:border-zinc-700/50 last:border-0 transition-colors px-4 py-3"
                            >
                                <div className="flex flex-col min-w-0 flex-1 pr-2">
                                    <div className="font-semibold text-sm text-slate-800 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 truncate">
                                        {property.rentalDetails?.tenantName ? (
                                            <>
                                                {property.rentalDetails.tenantName} <span className="text-slate-400 dark:text-zinc-500 font-normal">({property.rentalDetails.unitName || property.description || 'Unit'})</span>
                                            </>
                                        ) : (
                                            <>{property.rentalDetails?.unitName || property.description || 'Unit'}</>
                                        )}
                                    </div>
                                    <div className="text-2xs text-slate-500 dark:text-zinc-400 font-medium truncate mt-0.5">
                                        {property.address}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <div className={`px-2 py-0.5 rounded text-3xs font-black uppercase tracking-wider ${
                                        property.status === 'Occupied' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                        property.status === 'Vacant' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                        'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400'
                                    }`}>
                                        {property.status}
                                    </div>
                                    {property.rentalDetails?.rentAmount ? (
                                        <div className="text-2xs text-primary-600 dark:text-primary-400 font-bold mt-1">
                                            <NairaSymbol />{formatNaira(property.rentalDetails.rentAmount)}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecentPropertiesWidget;
