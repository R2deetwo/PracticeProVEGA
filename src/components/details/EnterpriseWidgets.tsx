import React from 'react';
import { Matter, FirmSpecialty } from '../../types';
import { formatNaira } from '../../utils/formatting';

export const EnterpriseMatterDashboard: React.FC<{ matter: Matter }> = ({ matter }) => {
    // Determine active specialty from populated specialtyData keys
    let activeSpecialty: FirmSpecialty | undefined = matter.specialtyData?.maritime ? FirmSpecialty.Maritime :
        matter.specialtyData?.oilGas ? FirmSpecialty.OilGas :
        matter.specialtyData?.corporate ? FirmSpecialty.Corporate :
        matter.specialtyData?.tax ? FirmSpecialty.Tax :
        matter.specialtyData?.realEstate ? FirmSpecialty.RealEstate : undefined;

    if (!activeSpecialty) {
        if (matter.type === 'Corporate & Commercial') activeSpecialty = FirmSpecialty.Corporate;
        else if (matter.type === 'Tax Law') activeSpecialty = FirmSpecialty.Tax;
        else if (matter.type === 'Maritime & Admiralty') activeSpecialty = FirmSpecialty.Maritime;
        else if (matter.type === 'Oil & Gas') activeSpecialty = FirmSpecialty.OilGas;
        else if (matter.type === 'Real Estate') activeSpecialty = FirmSpecialty.RealEstate;
    }

    if (!activeSpecialty) return null;

    // Use existing data or empty default for retrofitting
    const activeData = matter.specialtyData || {};

    switch (activeSpecialty) {
        case FirmSpecialty.Maritime:
            return <MaritimeDossierWidget data={activeData.maritime || {}} />;
        case FirmSpecialty.OilGas:
            return <OilGasLifecycleTimeline data={activeData.oilGas || {}} />;
        case FirmSpecialty.Corporate:
            // Use legacy root fields for backwards compatibility if specialtyData isn't populated
            const corpData = activeData.corporate || {
                rcNumber: matter.rcNumber,
                shareCapital: matter.shareCapital,
                annualReturnsDueDate: matter.annualReturnsDueDate
            };
            return <CorporateGovernanceTracker data={corpData} />;
        case FirmSpecialty.Tax:
            return <TaxDisputeLedger data={activeData.tax || {}} />;
        case FirmSpecialty.RealEstate:
            if (matter.subCategory?.toLowerCase().includes('lease') || matter.subCategory?.toLowerCase().includes('tenancy')) {
                return null;
            }
            const reData = activeData.realEstate || {
                purchasePrice: matter.propertyValue,
                titleDocument: matter.titleRegistrationDetails
            };
            return <RealEstateTitleMatrix data={reData} />;
        default:
            return null;
    }
};

const WidgetCard: React.FC<{ title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, subtitle, icon, children, className = '' }) => (
    <div className={`bg-gradient-to-br from-slate-900 to-slate-800 dark:from-zinc-900 dark:to-zinc-950 rounded-2xl shadow-xl border border-amber-400/20 overflow-hidden mb-6 ${className}`}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-black/20">
            <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center text-amber-400 border border-amber-400/20 shadow-[0_0_15px_rgba(251,191,36,0.15)]">
                {icon}
            </div>
            <div>
                <h3 className="text-white font-black tracking-tight leading-tight">{title}</h3>
                {subtitle && <p className="text-amber-400/70 text-2xs uppercase tracking-[0.15em] font-bold">{subtitle}</p>}
            </div>
        </div>
        <div className="p-5 backdrop-blur-md">
            {children}
        </div>
    </div>
);

const DataPoint: React.FC<{ label: string; value: string | React.ReactNode }> = ({ label, value }) => (
    <div className="flex flex-col">
        <span className="text-2xs font-bold text-zinc-500 uppercase tracking-widest mb-1">{label}</span>
        <span className="text-sm font-semibold text-zinc-100">{value || <span className="text-zinc-700 italic">Not specified</span>}</span>
    </div>
);

const MaritimeDossierWidget: React.FC<{ data?: any }> = ({ data }) => {
    if (!data) return null;
    return (
        <WidgetCard
            title="Vessel Dossier"
            subtitle="Maritime & Admiralty"
            icon={<svg viewBox="0 0 24 24" className="w-5 h-5 drop-shadow" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3" /><line x1="12" y1="22" x2="12" y2="8" /><path d="M5 12H2a10 10 0 0 0 20 0h-3" /></svg>}
        >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <DataPoint label="Vessel Name" value={data.vesselName} />
                <DataPoint label="IMO Number" value={data.imoNumber} />
                <DataPoint label="Flag State" value={data.flagState} />
                <DataPoint label="P&I Club" value={data.pAndIClub} />
            </div>
            <div className="p-3 bg-amber-400/5 rounded-lg border border-amber-400/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${data.arrestStatus === 'Vessel Arrested' || data.arrestStatus === 'Warrant Issued' ? 'bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-green-500'}`} />
                    <span className="text-sm font-bold text-zinc-300">Arrest Status: <span className={data.arrestStatus === 'Vessel Arrested' ? 'text-red-400' : 'text-white'}>{data.arrestStatus || 'None'}</span></span>
                </div>
                {data.arrestPort && <span className="text-xs font-mono text-zinc-400 bg-black/40 px-2 py-1 rounded border border-white/5">{data.arrestPort}</span>}
            </div>
        </WidgetCard>
    );
};

const OilGasLifecycleTimeline: React.FC<{ data?: any }> = ({ data }) => {
    if (!data) return null;
    return (
        <WidgetCard
            title="Asset Lifecycle"
            subtitle="Oil & Gas • NUPRC Tracking"
            icon={<svg viewBox="0 0 24 24" className="w-5 h-5 drop-shadow" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" /></svg>}
        >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <DataPoint label="License Type" value={data.licenseType} />
                <DataPoint label="License ID" value={data.licenseNumber} />
                <DataPoint label="NUPRC Ref" value={data.nuprcLicenseId} />
                <DataPoint label="PSC Partner" value={data.pscPartner} />
            </div>
            <div className="flex flex-col relative before:absolute before:inset-0 before:left-2 before:w-0.5 before:bg-zinc-800 space-y-4">
                <div className="relative pl-6">
                    <div className="absolute left-1.5 top-1.5 w-1.5 h-1.5 rounded-full bg-green-500 ring-4 ring-zinc-900" />
                    <p className="text-xs font-bold text-zinc-400 mb-0.5">License Issued</p>
                    <p className="text-sm text-zinc-200">{data.licenseIssueDate || 'Pending'}</p>
                </div>
                <div className="relative pl-6">
                    <div className="absolute left-1 top-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-zinc-900 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                    <p className="text-xs font-bold text-amber-500 mb-0.5">PIA Review / Farm-out</p>
                    <p className="text-sm text-zinc-200">{data.piaComplianceStatus || 'Under Review'}</p>
                </div>
                <div className="relative pl-6 text-zinc-600">
                    <div className="absolute left-1.5 top-1.5 w-1.5 h-1.5 rounded-full bg-red-500/50 ring-4 ring-zinc-900" />
                    <p className="text-xs font-bold mb-0.5">Relinquishment Deadline</p>
                    <p className="text-sm">{data.relinquishmentDate || 'Not set'}</p>
                </div>
            </div>
        </WidgetCard>
    );
};

const CorporateGovernanceTracker: React.FC<{ data?: any }> = ({ data }) => {
    if (!data) return null;
    return (
        <WidgetCard
            title="Governance Tracker"
            subtitle="Corporate & Commercial"
            icon={<svg viewBox="0 0 24 24" className="w-5 h-5 drop-shadow" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="7" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>}
        >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <DataPoint label="RC Number" value={data.rcNumber} />
                <DataPoint label="Company Type" value={data.companyType} />
                <DataPoint label="Share Capital" value={`₦${formatNaira(data.shareCapital || 0)}`} />
                <DataPoint label="Board Sec." value={data.boardSecretary} />
            </div>
            <div className="flex items-center gap-4 p-3 bg-white/5 rounded-lg border border-white/10">
                <div className="flex-1">
                    <p className="text-2xs font-bold text-zinc-500 uppercase tracking-widest mb-1">CAMA Annual Returns Due</p>
                    <p className={`text-lg font-black ${data.annualReturnsStatus === 'Overdue' ? 'text-red-400' : 'text-zinc-200'}`}>{data.annualReturnsDueDate || 'Not set'}</p>
                </div>
                <div className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider ${data.annualReturnsStatus === 'Overdue' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-green-500/10 text-green-500 border border-green-500/20'}`}>
                    {data.annualReturnsStatus || 'Pending'}
                </div>
            </div>
        </WidgetCard>
    );
};

const TaxDisputeLedger: React.FC<{ data?: any }> = ({ data }) => {
    if (!data) return null;
    return (
        <WidgetCard
            title="Financial Dispute Ledger"
            subtitle="Tax Law"
            icon={<svg viewBox="0 0 24 24" className="w-5 h-5 drop-shadow" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 2v20l2-2 2 2 2-2 2 2 2-2 2 2 2-2 2 2V2z" /><path d="M16 8h-6" /><path d="M16 12h-6" /><path d="M16 16h-6" /></svg>}
        >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <DataPoint label="TIN" value={data.tin} />
                <DataPoint label="Tax Office" value={data.firsTaxOffice} />
                <DataPoint label="Tax Type" value={data.taxType} />
                <DataPoint label="Audit Year" value={data.auditYear} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-red-500/5 rounded-lg border border-red-500/10">
                <div>
                    <p className="text-2xs font-bold text-red-400/70 uppercase tracking-widest mb-1">Disputed Liability</p>
                    <p className="text-xl font-black text-red-400">₦{formatNaira(data.disputedTaxLiability || 0)}</p>
                </div>
                <div>
                    <p className="text-2xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Penalties + Interest</p>
                    <p className="text-lg font-bold text-zinc-300">₦{formatNaira((data.penaltyAmount || 0) + (data.interestAmount || 0))}</p>
                </div>
                <div className="border-l border-red-500/20 pl-3">
                    <p className="text-2xs font-bold text-zinc-500 uppercase tracking-widest mb-1">TAT Appeal Deadline</p>
                    <p className="text-sm font-bold text-zinc-200">{data.objectionDeadline || 'Pending Assessment'}</p>
                    <p className="text-2xs text-red-400 mt-1">30-day statutory limit active</p>
                </div>
            </div>
        </WidgetCard>
    );
};

const RealEstateTitleMatrix: React.FC<{ data?: any }> = ({ data }) => {
    if (!data) return null;
    return (
        <WidgetCard
            title="Title Perfection Matrix"
            subtitle="Real Estate & Property"
            icon={<svg viewBox="0 0 24 24" className="w-5 h-5 drop-shadow" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>}
        >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <DataPoint label="Title Doc" value={data.titleDocument} />
                <DataPoint label="Survey Plan" value={data.surveyPlanNo} />
                <DataPoint label="Value" value={`₦${formatNaira(data.purchasePrice || 0)}`} />
                <DataPoint label="Location" value={data.plotLocation} />
            </div>
            
            <div className="relative">
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-zinc-800 -translate-y-1/2 rounded" />
                <div className="absolute top-1/2 left-0 w-2/3 h-1 bg-gradient-to-r from-amber-600 to-amber-400 -translate-y-1/2 rounded shadow-[0_0_10px_rgba(251,191,36,0.3)]" />
                
                <div className="relative flex justify-between">
                    <div className="flex flex-col items-center">
                        <div className={`w-4 h-4 rounded-full border-4 ring-2 ring-zinc-900 z-10 ${data.stampDutyStatus === 'Paid' ? 'bg-amber-400 border-amber-400' : 'bg-zinc-800 border-zinc-700'}`} />
                        <p className={`text-2xs font-bold mt-2 uppercase tracking-wide ${data.stampDutyStatus === 'Paid' ? 'text-amber-400' : 'text-zinc-500'}`}>Stamping</p>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className={`w-4 h-4 rounded-full border-4 ring-2 ring-zinc-900 z-10 ${data.governorConsentStatus === 'Approved' ? 'bg-amber-400 border-amber-400' : (data.governorConsentStatus?.includes('Applied') ? 'bg-white dark:bg-zinc-900 border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)] animate-pulse' : 'bg-zinc-800 border-zinc-700')}`} />
                        <p className={`text-2xs font-bold mt-2 uppercase tracking-wide ${data.governorConsentStatus === 'Approved' ? 'text-amber-400' : (data.governorConsentStatus?.includes('Applied') ? 'text-white' : 'text-zinc-500')}`}>Gov. Consent</p>
                    </div>
                    <div className="flex flex-col items-center">
                        <div className={`w-4 h-4 rounded-full border-4 ring-2 ring-zinc-900 z-10 ${data.registrationStatus === 'Registered' ? 'bg-amber-400 border-amber-400' : 'bg-zinc-800 border-zinc-700'}`} />
                        <p className={`text-2xs font-bold mt-2 uppercase tracking-wide ${data.registrationStatus === 'Registered' ? 'text-amber-400' : 'text-zinc-500'}`}>Registration</p>
                    </div>
                </div>
            </div>
        </WidgetCard>
    );
};
