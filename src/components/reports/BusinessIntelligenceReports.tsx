import React, { useState, useMemo } from 'react';
import { AppState } from '../../types';
import { useProduct } from '../../contexts/ProductContext';
import CaseManagementReports from './CaseManagementReports';
import ClientReports from './ClientReports';
import PropertyReports from './PropertyReports';

interface BusinessIntelligenceReportsProps {}

type BITab = 'case' | 'client' | 'property';

const BusinessIntelligenceReports: React.FC<BusinessIntelligenceReportsProps> = () => {
    // Product-aware tabs: Vega sees Case + Client, Atrium sees Client + Property,
    // Komplete sees all three.
    const { isLegal, hasPropertyFeatures } = useProduct();
    const availableTabs = useMemo<BITab[]>(() => {
        const tabs: BITab[] = [];
        if (isLegal) tabs.push('case');
        tabs.push('client');
        if (hasPropertyFeatures) tabs.push('property');
        return tabs;
    }, [isLegal, hasPropertyFeatures]);

    const [activeTab, setActiveTab] = useState<BITab>(availableTabs[0]);

    const renderTabContent = () => {
        switch (activeTab) {
            case 'case':
                return <CaseManagementReports />;
            case 'client':
                return <ClientReports />;
            case 'property':
                return <PropertyReports />;
            default:
                return null;
        }
    };

    const labelMap: Record<BITab, string> = {
        case: 'Case Analytics',
        client: 'Client Analytics',
        property: 'Property Analytics',
    };

    return (
        <div>
            <div className="mb-6 border-b border-gray-200 dark:border-zinc-700">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    {availableTabs.map(tab => (
                         <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`whitespace-nowrap py-3 px-1 border-b-2 font-semibold text-sm transition-colors ${
                                activeTab === tab
                                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200'
                            }`}
                        >
                            {labelMap[tab]}
                        </button>
                    ))}
                </nav>
            </div>
            <div>
                {renderTabContent()}
            </div>
        </div>
    );
};

export default BusinessIntelligenceReports;