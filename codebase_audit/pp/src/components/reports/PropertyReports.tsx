import React, { useMemo } from 'react';
import { Property } from '../../types';
import { useCoreState } from '../../contexts/CoreContext';
import { useMatterState } from '../../contexts/MatterContext';
import StatCard from '../StatCard';
import NairaSymbol from '../NairaSymbol';
import { formatNaira } from '../../utils/formatting';
import { OfficeBuildingIcon, BanknotesIcon, CheckCircleIcon } from '../../constants';
import Tooltip from '../Tooltip';

const BarChart: React.FC<{ data: { label: string; value: number }[]; color: string }> = ({ data, color }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1);
    return (
        <div className="space-y-2">
            {data.map(item => {
                const fullValueText = `₦${formatNaira(item.value)}`;
                return (
                    <div key={item.label} className="flex items-center gap-2 text-sm">
                        <span className="w-32 text-right truncate text-slate-500 dark:text-zinc-400" title={item.label}>{item.label}</span>
                        <div className="flex-grow bg-slate-200 dark:bg-zinc-700 rounded-full h-4">
                            <Tooltip text={fullValueText}>
                                <div
                                    className={`h-4 rounded-full ${color} flex items-center justify-end pr-2 text-white text-[10px] font-bold overflow-hidden whitespace-nowrap`}
                                    style={{ width: `${(item.value / maxValue) * 100}%` }}
                                >
                                    <NairaSymbol/>{formatNaira(item.value)}
                                </div>
                            </Tooltip>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const PropertyReports: React.FC = () => {
    const { coreState } = useCoreState();
    const { matterState } = useMatterState();
    
    const { kpis, chartData, tableData } = useMemo(() => {
        // Collect all properties
        const allProperties: Property[] = [...(coreState.properties || [])];
        
        // Add legacy properties embedded in contacts
        matterState.contacts.forEach(c => {
            if (c.properties) {
                c.properties.forEach(p => {
                    if (!allProperties.find(existing => existing.id === p.id)) {
                        allProperties.push(p);
                    }
                });
            }
        });

        // KPIs
        const totalProperties = allProperties.length;
        const occupiedProperties = allProperties.filter(p => p.status === 'Occupied');
        const occupancyRate = totalProperties > 0 ? (occupiedProperties.length / totalProperties) * 100 : 0;
        
        let totalRentCollectedYTD = 0;
        let totalExpectedRent = 0;
        
        const currentYear = new Date().getFullYear();

        const propertiesWithStats = allProperties.map(p => {
            const expected = p.rentalDetails?.rentAmount || p.value || 0;
            totalExpectedRent += expected;

            const collectedYTD = (p.rentPaymentHistory || []).filter(h => {
                if (h.status !== 'paid' || !h.paidDate) return false;
                const payYear = new Date(h.paidDate).getFullYear();
                return payYear === currentYear;
            }).reduce((sum, h) => sum + (h.amount || 0), 0);

            totalRentCollectedYTD += collectedYTD;

            return {
                id: p.id,
                address: p.address,
                status: p.status,
                unitsCount: Array.isArray(p.units) ? p.units.length : (p.numberOfUnits || 1),
                expectedRent: expected,
                collectedYTD
            };
        });

        // Chart Data
        const revenueByPropertyChartData = [...propertiesWithStats]
            .sort((a,b) => b.collectedYTD - a.collectedYTD)
            .slice(0, 10)
            .map(p => ({ label: p.address, value: p.collectedYTD }));

        return {
            kpis: {
                totalProperties,
                occupancyRate,
                totalRentCollectedYTD,
                totalExpectedRent
            },
            chartData: {
                revenueByProperty: revenueByPropertyChartData
            },
            tableData: propertiesWithStats
        };
    }, [coreState.properties, matterState.contacts]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Properties" value={kpis.totalProperties} icon={<OfficeBuildingIcon />} colorClass="text-indigo-500" />
                <StatCard title="Occupancy Rate" value={`${kpis.occupancyRate.toFixed(1)}%`} icon={<CheckCircleIcon />} colorClass="text-green-500" />
                <StatCard title="Rent Collected (YTD)" value={<><NairaSymbol/>{formatNaira(kpis.totalRentCollectedYTD)}</>} icon={<BanknotesIcon />} colorClass="text-blue-500" />
                <StatCard title="Total Expected Rent" value={<><NairaSymbol/>{formatNaira(kpis.totalExpectedRent)}</>} icon={<BanknotesIcon />} colorClass="text-purple-500" />
            </div>
             <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-md p-6 border border-black/5 dark:border-white/5">
                <h3 className="text-lg font-bold mb-4">Rent Collection by Property (Top 10)</h3>
                <BarChart data={chartData.revenueByProperty} color="bg-indigo-500" />
            </div>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-md p-6 border border-black/5 dark:border-white/5">
                <h3 className="text-lg font-bold mb-4">All Properties</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 dark:text-zinc-400 uppercase">
                           <tr>
                                <th className="py-2 px-4">Address</th>
                                <th className="py-2 px-4 text-center">Status</th>
                                <th className="py-2 px-4 text-center">Units</th>
                                <th className="py-2 px-4 text-right">Expected Rent</th>
                                <th className="py-2 px-4 text-right">Collected YTD</th>
                            </tr>
                        </thead>
                         <tbody className="divide-y divide-slate-200 dark:divide-zinc-700">
                            {tableData.map(p => (
                                <tr key={p.id}>
                                    <td className="py-3 px-4 font-medium truncate max-w-[200px]" title={p.address}>{p.address}</td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.status === 'Occupied' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
                                            {p.status || 'Vacant'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-center">{p.unitsCount}</td>
                                    <td className="py-3 px-4 text-right"><NairaSymbol/>{formatNaira(p.expectedRent)}</td>
                                    <td className="py-3 px-4 text-right font-bold text-slate-800 dark:text-slate-200"><NairaSymbol/>{formatNaira(p.collectedYTD)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PropertyReports;
