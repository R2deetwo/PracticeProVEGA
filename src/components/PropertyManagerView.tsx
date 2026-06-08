
import React, { useMemo, useState } from 'react';
import { Contact, Property, SubscriptionPlan } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { useCoreState } from '../contexts/CoreContext';
import { useDataActions } from '../contexts/DataContext';
import { OfficeBuildingIcon, LockClosedIcon, SearchIcon, PlusIcon, CheckCircleIcon, TrashIcon, XIcon } from '../constants';
import { useFeatures } from '../hooks/useFeatures';
import StatCard from './StatCard';
import NairaSymbol from './NairaSymbol';
import { formatNaira, formatLargeNumber } from '../utils/formatting';
import EmptyState from './EmptyState';
import { generateRentReviewNoticePdf } from '../services/reportGenerator';
import { MailIcon } from '../constants';

interface PropertyManagerViewProps {
    contacts: Contact[];
    onViewDetails: (id: string) => void;
    openModal: (type: any, id?: any, context?: any) => void;
    isCompact?: boolean;
}

// Helper to compute days remaining on a lease
const getDaysUntilLeaseEnd = (leaseEnd?: string): number | null => {
    if (!leaseEnd) return null;
    const diff = Math.ceil((new Date(leaseEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diff;
};

const PropertyListItem: React.FC<{ 
    property: Property, 
    ownerName: string, 
    unitCount?: number, 
    onClick: () => void, 
    onDelete: (e: React.MouseEvent) => void,
    isSelected?: boolean,
    onToggleSelect?: (e: React.MouseEvent) => void
}> = ({ property, ownerName, unitCount, onClick, onDelete, isSelected, onToggleSelect }) => {
    const isOccupied = property.status === 'Occupied';
    const isListed = property.status === 'Listed';
    const rent = property.rentalDetails?.rentAmount;
    const daysLeft = getDaysUntilLeaseEnd(property.rentalDetails?.leaseEnd);

    // Compute rent range from embedded units array (multi-unit properties)
    const embeddedUnits: any[] = (property as any).units || [];
    const unitRents = embeddedUnits
        .map((u: any) => u.rentalDetails?.rentAmount || u.rentAmount || 0)
        .filter((r: number) => r > 0);
    const allRents = unitRents.length > 0 ? unitRents : (rent && rent > 0 ? [rent] : []);
    const minRent = allRents.length > 0 ? Math.min(...allRents) : 0;
    const maxRent = allRents.length > 0 ? Math.max(...allRents) : 0;
    const showRange = allRents.length > 1 && minRent !== maxRent;
    const leaseUrgent = daysLeft !== null && daysLeft <= 90 && daysLeft > 0;
    const leaseExpired = daysLeft !== null && daysLeft <= 0;

    return (
        <div
            onClick={onClick}
            className={`group relative p-3 mb-2 rounded-xl border-l-4 cursor-pointer transition-all duration-300 hover:shadow-lg hover:bg-slate-50 dark:hover:bg-zinc-800 ${isSelected ? 'border-l-primary-600 bg-primary-50 dark:bg-primary-950/30' : leaseExpired ? 'border-l-red-400 bg-white dark:bg-zinc-900 shadow-sm' : leaseUrgent ? 'border-l-amber-400 bg-white dark:bg-zinc-900 shadow-sm' : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 shadow-sm'}`}
        >
            <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <div className="flex-1 min-w-0 pr-2">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-white truncate group-hover:text-primary-600 transition-colors leading-tight">{property.address}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                {unitCount && unitCount > 1 && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">{unitCount} Units</span>
                                )}
                                <span className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium truncate max-w-[120px]">{ownerName}</span>
                                {allRents.length > 0 ? (
                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                        {showRange
                                            ? <>₦{minRent.toLocaleString('en-NG')} – ₦{maxRent.toLocaleString('en-NG')}<span className="font-normal text-slate-400">/yr</span></>
                                            : <>₦{minRent.toLocaleString('en-NG')}<span className="font-normal text-slate-400">/yr</span></>
                                        }
                                    </span>
                                ) : !isOccupied && (
                                    <span className="text-[10px] font-medium text-slate-400 dark:text-zinc-500 italic">Vacant</span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            {leaseUrgent && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                                    ⚠ {daysLeft}d
                                </span>
                            )}
                            {leaseExpired && isOccupied && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                                    Expired
                                </span>
                            )}
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${
                                isOccupied 
                                    ? 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400' 
                                    : isListed
                                    ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400'
                                    : 'text-slate-400 bg-slate-50 dark:bg-zinc-800 dark:text-zinc-500'
                            }`}>
                                {property.status}
                            </span>
                            <button
                                onClick={onDelete}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-opacity"
                            >
                                <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const PropertyManagerView: React.FC<PropertyManagerViewProps> = ({ contacts, onViewDetails, openModal, isCompact }) => {
    const { currentPlan, canUsePropertyManager, isPropertyFirm } = useFeatures();
    const { navigateTo, openModal: openConfirmationModal, closeModal, addToast } = useUI();
    const dataHandlers = useDataActions();
    const { onUpdateContactProperties } = dataHandlers;
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Feature Gating
    // Property firms (Atrium/Unified): any paid plan gets access.
    // Legal-only firms (Vega): still require Ultimate+.
    if (!canUsePropertyManager) {
        return (
            <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-zinc-900 text-center">
                <div className="w-20 h-20 bg-slate-200 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                    <LockClosedIcon className="w-10 h-10 text-slate-400" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">Property Management Locked</h2>
                <p className="text-slate-500 dark:text-zinc-400 max-w-md mb-8">
                    {isPropertyFirm
                        ? 'Select a plan to unlock the complete Property Management suite, including lease tracking, automated notices, and portfolio analytics.'
                        : 'Upgrade to the Pro plan to unlock Property Management. Or switch to Atrium OS for a dedicated property management experience.'}
                </p>
                <button
                    onClick={() => navigateTo('settings', null, { settingsTargetId: 'subscription-management' })}
                    className="px-6 py-3 bg-primary-600 text-white rounded-lg font-bold shadow-lg hover:bg-primary-700 transition-colors"
                >
                    {isPropertyFirm ? 'Select a Plan' : 'View Upgrade Options'}
                </button>
            </div>
        );
    }

    const { coreState } = useCoreState();
    // Group properties by address to avoid clutter in the sidebar
    const allProperties = useMemo(() => {
        const rawProps: { property: Property, ownerName: string, ownerId: string }[] = [];
        
        // 1. Standalone Properties (New Schema)
        (coreState.properties || []).forEach(p => {
            const owner = (contacts || []).find(c => c.id === p.contactId);
            rawProps.push({ 
                property: p, 
                ownerName: owner ? owner.name : 'Unknown Owner', 
                ownerId: p.contactId || '' 
            });
        });

        // 2. Legacy Contact Properties (avoid duplicates)
        const existingIds = new Set((coreState.properties || []).map(p => p.id));
        (contacts || []).forEach(c => {
            if (c.properties && Array.isArray(c.properties)) {
                c.properties.forEach(p => {
                    if (p && p.id && p.address && !existingIds.has(p.id)) {
                        rawProps.push({ property: p, ownerName: c.name, ownerId: c.id });
                    }
                });
            }
        });

        // Group by address
        const grouped: { property: Property, ownerName: string, ownerId: string, unitCount: number }[] = [];
        const addressMap = new Map<string, number>();

        rawProps.forEach(item => {
            const addr = (item.property.address || 'Unknown Address').toLowerCase().trim();
            if (addressMap.has(addr)) {
                const index = addressMap.get(addr)!;
                grouped[index].unitCount++;
            } else {
                addressMap.set(addr, grouped.length);
                grouped.push({ ...item, unitCount: 1 });
            }
        });

        return grouped;
    }, [contacts, coreState.properties]); // This dependency ensures list rebuilds on any contact or property update

    const filteredProperties = useMemo(() => {
        if (!searchTerm) return allProperties;
        const lower = searchTerm.toLowerCase();
        return allProperties.filter(p =>
            p.property.address.toLowerCase().includes(lower) ||
            p.ownerName.toLowerCase().includes(lower)
        );
    }, [allProperties, searchTerm]);

    // Unified helper: delete all units at an address from Convex + local state + legacy contact array
    const deletePropertyGroup = async (ownerId: string, propertyAddress: string): Promise<number> => {
        const normalizedAddr = propertyAddress.toLowerCase().trim();
        const allUnits = (coreState.properties || []).filter(p =>
            (p.address || '').toLowerCase().trim() === normalizedAddr
        );
        const unitIds = Array.from(new Set(allUnits.map(u => u.id).filter(Boolean)));

        // Delete from Convex (ignore "already deleted" — cascade returns success)
        await Promise.allSettled(
            unitIds.map(id => dataHandlers.handleDeleteProperty(id, propertyAddress, true))
        );

        // Strip legacy contact properties for this address
        const owner = (contacts || []).find(c => c.id === ownerId);
        if (owner && owner.properties && owner.properties.length > 0) {
            const remaining = owner.properties.filter(p =>
                (p.address || '').toLowerCase().trim() !== normalizedAddr
            );
            if (remaining.length !== owner.properties.length) {
                onUpdateContactProperties(ownerId, remaining);
            }
        }

        return unitIds.length;
    };

    const handleDeleteProperty = (e: React.MouseEvent, propertyId: string, ownerId: string, propertyAddress: string) => {
        e.stopPropagation();
        const normalizedAddr = propertyAddress.toLowerCase().trim();
        const allUnits = (coreState.properties || []).filter(p =>
            (p.address || '').toLowerCase().trim() === normalizedAddr
        );
        const unitCount = allUnits.length;

        openConfirmationModal('deleteConfirmation', propertyId, {
            title: 'Delete Property?',
            message: unitCount > 1
                ? `This will permanently delete all ${unitCount} unit records for this property from your portfolio.`
                : 'This will permanently delete this property from your portfolio.',
            onConfirm: async () => {
                await deletePropertyGroup(ownerId, propertyAddress);
                setSelectedIds(prev => {
                    const next = new Set(prev);
                    allUnits.forEach(u => next.delete(u.id));
                    next.delete(propertyId);
                    return next;
                });
                addToast('Property deleted.', { type: 'success' });
                closeModal();
            },
            confirmText: 'Delete',
            confirmButtonClass: 'bg-red-600 hover:bg-red-700'
        });
    };

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;
        // Resolve selected IDs to full property entries (grouped by address to avoid double-deleting)
        const toDelete = Array.from(selectedIds).reduce<{ ownerId: string; address: string }[]>((acc, id) => {
            const entry = allProperties.find(p => p.property.id === id);
            if (!entry) return acc;
            const addr = (entry.property.address || '').toLowerCase().trim();
            if (!acc.some(a => a.address === addr)) {
                acc.push({ ownerId: entry.ownerId, address: entry.property.address });
            }
            return acc;
        }, []);

        openConfirmationModal('deleteConfirmation', null, {
            title: `Delete ${toDelete.length} ${toDelete.length === 1 ? 'Property' : 'Properties'}?`,
            message: `This will permanently remove ${toDelete.length === 1 ? 'this property' : 'these properties'} and all their unit records. This cannot be undone.`,
            onConfirm: async () => {
                await Promise.allSettled(
                    toDelete.map(({ ownerId, address }) => deletePropertyGroup(ownerId, address))
                );
                setSelectedIds(new Set());
                addToast(`${toDelete.length === 1 ? 'Property' : `${toDelete.length} properties`} deleted.`, { type: 'success' });
                closeModal();
            },
            confirmText: 'Delete',
            confirmButtonClass: 'bg-red-600 hover:bg-red-700'
        });
    };

    // KPI Calcs
    const totalValue = allProperties.reduce((sum, p) => sum + (p.property.value || 0), 0);
    const activeLeases = allProperties.filter(p => p.property.category === 'Tenanted Property' && p.property.status === 'Occupied').length;
    const forSaleCount = allProperties.filter(p => p.property.status === 'Listed').length;
    const expiringSoon = allProperties.filter(p => {
        if (!p.property.rentalDetails?.leaseEnd) return false;
        const end = new Date(p.property.rentalDetails.leaseEnd);
        const now = new Date();
        const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff > 0 && diff <= 90;
    }).length;

    const handleAddProperty = () => {
        openModal('newProperty');
    };

    if (isCompact) {
        return (
            <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-900/30 border-r border-slate-200 dark:border-zinc-800">
                <div className="flex-shrink-0 p-4 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky top-0 z-10">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-xl text-slate-900 dark:text-white">Properties</h3>
                        <button
                            onClick={() => openModal('newProperty')}
                            className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-opacity shadow-sm flex items-center gap-2 text-xs font-bold"
                        >
                            <PlusIcon className="w-4 h-4" /> New
                        </button>
                    </div>
                    <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input autoComplete="off" data-lpignore="true"  type="search" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all" />
                    </div>
                </div>
                <div className="flex-grow flex flex-col overflow-hidden">
                    {/* Bulk Actions Bar (Compact) */}
                    {selectedIds.size > 0 && (
                        <div className="bg-primary-600 px-4 py-2 flex items-center justify-between animate-in slide-in-from-top-2 duration-300 relative z-20">
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                {selectedIds.size} Selected
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => openModal('bulkEditProperty', null, { propertyIds: Array.from(selectedIds) })}
                                    className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
                                    title="Bulk Edit"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button
                                    onClick={handleBulkDelete}
                                    className="p-1.5 bg-rose-500/20 hover:bg-rose-500 text-white rounded-lg transition-all"
                                    title="Bulk Delete"
                                >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => setSelectedIds(new Set())}
                                    className="p-1.5 text-primary-100 hover:text-white"
                                >
                                    <XIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Compact List Header with Select All */}
                    <div className="bg-slate-50 dark:bg-zinc-900/50 px-4 py-2 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                        <div 
                            onClick={() => {
                                if (selectedIds.size === filteredProperties.length) setSelectedIds(new Set());
                                else setSelectedIds(new Set(filteredProperties.map(p => p.property.id)));
                            }}
                            className="flex items-center gap-2 cursor-pointer group"
                        >
                            <div className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${selectedIds.size === filteredProperties.length && filteredProperties.length > 0 ? 'bg-primary-600 border-primary-600' : 'border-slate-300 dark:border-zinc-700 group-hover:border-primary-400'}`}>
                                {selectedIds.size === filteredProperties.length && filteredProperties.length > 0 && <svg className="w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-primary-600 transition-colors">Select all</span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">{filteredProperties.length}</span>
                    </div>

                    <div className="flex-grow overflow-y-auto custom-scrollbar p-2">
                        {filteredProperties.length > 0 ? (
                            filteredProperties.map(item => (
                                <PropertyListItem
                                    key={item.property.id}
                                    property={item.property}
                                    ownerName={item.ownerName}
                                    unitCount={item.unitCount}
                                    isSelected={selectedIds.has(item.property.id)}
                                    onToggleSelect={(e) => {
                                        e.stopPropagation();
                                        setSelectedIds(prev => {
                                            const next = new Set(prev);
                                            if (next.has(item.property.id)) next.delete(item.property.id);
                                            else next.add(item.property.id);
                                            return next;
                                        });
                                    }}
                                    onClick={() => onViewDetails(item.property.id)}
                                    onDelete={(e) => handleDeleteProperty(e, item.property.id, item.ownerId, item.property.address)}
                                />
                            ))
                        ) : (
                            <p className="text-center text-xs text-slate-500 py-8">No properties found.</p>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full overflow-y-auto scroll-smooth-ios custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-nav">
            <header className="sticky top-0 z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center mb-6">
                <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Properties</h2>
                <button
                    onClick={() => openModal('newProperty')}
                    className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-opacity shadow-sm flex items-center gap-2 text-xs font-bold"
                >
                    <PlusIcon className="w-4 h-4" /> New
                </button>
            </header>

            <div className="px-4 sm:px-6 lg:px-8">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8">
                    <StatCard title="Portfolio Value" value={<><NairaSymbol />{formatNaira(totalValue)}</>} icon={<OfficeBuildingIcon />} colorClass="bg-blue-500" scrollOnOverflow={true} />
                    <StatCard title="Active Leases" value={activeLeases} icon={<CheckCircleIcon />} colorClass="bg-green-500" scrollOnOverflow={true} />
                    <StatCard title="Expiring Leases (90d)" value={expiringSoon} icon={<LockClosedIcon />} colorClass="bg-orange-500" scrollOnOverflow={true} />
                    <StatCard title="For Sale" value={forSaleCount} icon={<SearchIcon />} colorClass="bg-purple-500" scrollOnOverflow={true} />
                </div>

                {/* Filter Bar */}
                <div className="bg-white dark:bg-zinc-800 p-4 rounded-t-xl border border-slate-200 dark:border-zinc-700 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 transition-all">
                    <div className="flex items-center gap-4 flex-grow max-w-2xl w-full">
                        <div className="relative flex-grow">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input autoComplete="off" data-lpignore="true" 
                                type="text"
                                placeholder="Search properties or owners..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-primary-500"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 overflow-x-auto pb-1 lg:pb-0 custom-scrollbar-hide">
                        {expiringSoon > 0 && (
                            <button
                                onClick={() => {
                                    const upcoming = allProperties.filter(p => {
                                        if (!p.property.rentalDetails?.leaseEnd) return false;
                                        const end = new Date(p.property.rentalDetails.leaseEnd);
                                        const now = new Date();
                                        const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                        return diff > 0 && diff <= 90;
                                    });
                                    
                                    upcoming.forEach(item => {
                                        const owner = contacts.find(c => c.id === item.ownerId);
                                        if (owner) {
                                            generateRentReviewNoticePdf(item.property, owner, coreState.firmDetails);
                                        }
                                    });
                                    addToast(`Generated ${upcoming.length} rent review notices.`, { type: 'success' });
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-[10px] font-black uppercase tracking-wider rounded-xl border border-primary-100 dark:border-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-all shadow-sm whitespace-nowrap"
                            >
                                <MailIcon className="w-3.5 h-3.5" /> Bulk Notices ({expiringSoon})
                            </button>
                        )}
                    </div>
                </div>

                {/* Bulk Actions Bar */}
                {selectedIds.size > 0 && (
                    <div className="bg-primary-600 px-6 py-3 flex items-center justify-between animate-in slide-in-from-top-4 duration-300 relative z-20">
                        <div className="flex items-center gap-4">
                            <span className="text-xs font-black text-white uppercase tracking-widest bg-primary-700/50 px-2.5 py-1 rounded-lg">
                                {selectedIds.size} Selected
                            </span>
                            <div className="h-4 w-px bg-primary-500/50"></div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => openModal('bulkEditProperty', null, { propertyIds: Array.from(selectedIds) })}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    Bulk Edit
                                </button>
                                <button
                                    onClick={handleBulkDelete}
                                    className="flex items-center gap-2 px-4 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-rose-500/30"
                                >
                                    <TrashIcon className="w-3.5 h-3.5" /> Bulk Delete
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="p-1.5 text-primary-100 hover:text-white transition-colors"
                            title="Clear Selection"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                )}

                {/* List Header with Select All */}
                <div className="bg-slate-50 dark:bg-zinc-900/50 px-6 py-3 border-x border-b border-slate-200 dark:border-zinc-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div 
                            onClick={() => {
                                if (selectedIds.size === filteredProperties.length) setSelectedIds(new Set());
                                else setSelectedIds(new Set(filteredProperties.map(p => p.property.id)));
                            }}
                            className="flex items-center gap-2 cursor-pointer group"
                        >
                            <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center ${selectedIds.size === filteredProperties.length && filteredProperties.length > 0 ? 'bg-primary-600 border-primary-600' : 'border-slate-300 dark:border-zinc-700 group-hover:border-primary-400'}`}>
                                {selectedIds.size === filteredProperties.length && filteredProperties.length > 0 && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                                {selectedIds.size > 0 && selectedIds.size < filteredProperties.length && <div className="w-2.5 h-0.5 bg-primary-600 rounded"></div>}
                            </div>
                            <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest group-hover:text-primary-600 transition-colors">Select all</span>
                        </div>
                    </div>
                    <div className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                        {filteredProperties.length} Total Properties
                    </div>
                </div>

                {/* List — card-style items matching Matters UI */}
                <div className="p-2">
                    {filteredProperties.length > 0 ? (
                        filteredProperties.map(item => (
                            <PropertyListItem
                                key={item.property.id}
                                property={item.property}
                                ownerName={item.ownerName}
                                unitCount={item.unitCount}
                                isSelected={selectedIds.has(item.property.id)}
                                onToggleSelect={(e) => {
                                    e.stopPropagation();
                                    setSelectedIds(prev => {
                                        const next = new Set(prev);
                                        if (next.has(item.property.id)) next.delete(item.property.id);
                                        else next.add(item.property.id);
                                        return next;
                                    });
                                }}
                                onClick={() => onViewDetails(item.property.id)}
                                onDelete={(e) => handleDeleteProperty(e, item.property.id, item.ownerId, item.property.address)}
                            />
                        ))
                    ) : (
                        <EmptyState
                            title="No Properties Yet"
                            description="Add your first property to start tracking leases, rent payments, and portfolio value."
                            icon={<OfficeBuildingIcon className="w-full h-full" />}
                            actionLabel="+ Add Property"
                            onAction={() => openModal('newProperty')}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default PropertyManagerView;
