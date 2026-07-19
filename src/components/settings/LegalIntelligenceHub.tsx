import * as React from 'react';
import { useState } from 'react';
import { LEGAL_MODULES, LegalModule, ModuleCategory } from '../../utils/legalModules';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { 
    BookOpenIcon, 
    ShieldCheckIcon, 
    LockClosedIcon, 
    InfoIcon, 
    ChevronDownIcon, 
    CheckCircleIcon, 
    OfficeBuildingIcon,
    PlusIcon,
    UploadIcon
} from '../../constants';
import { ReportingIcon as ActivityIcon, ShieldCheckIcon as ShieldIcon, DismissIcon as XCircleIcon } from '../../constants';

interface LegalIntelligenceHubProps {
    className?: string;
    firmId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: LegalModule['status']; isBundled: boolean }> = ({ status, isBundled }) => {
    if (status === 'active') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {isBundled ? 'Included' : 'Active'}
            </span>
        );
    }
    if (status === 'locked') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800">
                <LockClosedIcon className="w-3 h-3" />
                Enquire
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-zinc-600" />
            Coming Soon
        </span>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY LABEL
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ModuleCategory, string> = {
    civil_procedure: 'Civil Procedure',
    criminal_procedure: 'Criminal Procedure',
    arbitration: 'Arbitration',
    regulatory: 'Regulatory',
    case_law: 'Case Law & Reports',
    practice_directions: 'Practice Directions',
    legislation: 'Legislation',
};

// ─────────────────────────────────────────────────────────────────────────────
// MODULE CARD
// ─────────────────────────────────────────────────────────────────────────────

const ModuleCard: React.FC<{ module: LegalModule }> = ({ module }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className={`rounded-xl border transition-all ${
            module.status === 'active'
                ? 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60'
                : module.status === 'locked'
                ? 'border-amber-200/60 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/10'
                : 'border-slate-200/60 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/60 opacity-70'
        }`}>
            {/* Top row */}
            <div className="flex items-start gap-3 p-4">
                <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-sm ${
                    module.status === 'active'
                        ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                        : module.status === 'locked'
                        ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'
                }`}>
                    {module.status === 'active'
                        ? <ShieldCheckIcon className="w-4 h-4" />
                        : module.status === 'locked'
                        ? <LockClosedIcon className="w-4 h-4" />
                        : <InfoIcon className="w-4 h-4" />
                    }
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 dark:text-zinc-100 leading-tight">
                                {module.shortName}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5 leading-tight truncate">
                                {module.name}
                            </p>
                        </div>
                        <StatusBadge status={module.status} isBundled={module.isBundled} />
                    </div>

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">{module.jurisdiction}</span>
                        <span className="text-[10px] text-slate-300 dark:text-zinc-700">·</span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500">{module.version}</span>
                        {module.authority && (
                            <>
                                <span className="text-[10px] text-slate-300 dark:text-zinc-700">·</span>
                                <span className="text-[10px] text-slate-400 dark:text-zinc-500 italic">{module.authority}</span>
                            </>
                        )}
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setExpanded(v => !v)}
                    className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-zinc-700 transition-colors"
                >
                    <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Expanded detail */}
            {expanded && (
                <div className="px-4 pb-4 pt-0 space-y-3 border-t border-slate-100 dark:border-zinc-700/50">
                    <p className="text-xs text-slate-600 dark:text-zinc-400 pt-3 leading-relaxed">
                        {module.description}
                    </p>
                    {module.coverageAreas.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
                                Covers
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {module.coverageAreas.map(area => (
                                    <span key={area} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-700/60 text-[11px] text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700">
                                        {area}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                    {(module.status === 'locked' || module.status === 'coming_soon') && (
                        <div className="pt-1">
                            <button className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline">
                                {module.status === 'locked' ? 'Enquire about adding this module →' : 'Request this jurisdiction →'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// LICENSES TAB content
// ─────────────────────────────────────────────────────────────────────────────

const LicensesTab: React.FC<{ firmId: string }> = ({ firmId }) => {
    const allLicenses = useQuery(api.legalRepo.getAllLicenses) || [];
    const allModules = useQuery(api.legalRepo.getAllModules) || [];
    const grantLicenseMutation = useMutation(api.legalRepo.grantLicense);
    const revokeLicenseMutation = useMutation(api.legalRepo.revokeLicense);

    const [showGrant, setShowGrant] = useState(false);
    const [newLicense, setNewLicense] = useState({ targetFirmId: '', moduleKey: '', plan: 'Enterprise' });

    const handleGrant = async () => {
        if (!newLicense.targetFirmId || !newLicense.moduleKey) return;
        try {
            await grantLicenseMutation({
                firmId: newLicense.targetFirmId,
                moduleKey: newLicense.moduleKey,
                plan: newLicense.plan
            });
            setShowGrant(false);
            setNewLicense({ targetFirmId: '', moduleKey: '', plan: 'Enterprise' });
        } catch (e) {
            console.error("Grant failed:", e);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/30">
                <div>
                    <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-300">License Management</h3>
                    <p className="text-xs text-indigo-700/70 dark:text-indigo-400/60 mt-0.5">Control which modules are active for specific firm tenants.</p>
                </div>
                <button 
                   onClick={() => setShowGrant(true)}
                   className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-md active:scale-95"
                >
                    <PlusIcon className="w-3.5 h-3.5" /> Grant New License
                </button>
            </div>

            {showGrant && (
                <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border-2 border-indigo-500 shadow-2xl space-y-4 animate-in slide-in-from-top-4 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 block">Firm Reference ID</label>
                            <input autoComplete="off" data-lpignore="true"  
                                className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none" 
                                placeholder="e.g. k17..." 
                                value={newLicense.targetFirmId}
                                onChange={e => setNewLicense({...newLicense, targetFirmId: e.target.value})}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 block">Legal Rule Lib</label>
                            <select 
                                className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                value={newLicense.moduleKey}
                                onChange={e => setNewLicense({...newLicense, moduleKey: e.target.value})}
                            >
                                <option value="">— Select Library —</option>
                                {allModules.map((m: any) => (
                                    <option key={m.moduleKey} value={m.moduleKey}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1 block">License Plan</label>
                            <select 
                                className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                value={newLicense.plan}
                                onChange={e => setNewLicense({...newLicense, plan: e.target.value})}
                            >
                                <option value="Basic">Basic Edition</option>
                                <option value="Professional">Professional (AI Assisted)</option>
                                <option value="Enterprise">Enterprise (Full Automation)</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setShowGrant(false)} className="text-xs px-4 py-2 font-bold text-slate-400 hover:text-slate-600 transition-colors">Cancel</button>
                        <button onClick={handleGrant} className="text-xs px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">Enable License</button>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-zinc-900/40 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-700">
                            <tr>
                                <th className="py-4 px-6 font-bold text-slate-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider">Firm / Tenant</th>
                                <th className="py-4 px-6 font-bold text-slate-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider">Law Library</th>
                                <th className="py-4 px-6 font-bold text-slate-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider text-center">Plan</th>
                                <th className="py-4 px-6 font-bold text-slate-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider text-center">Status</th>
                                <th className="py-4 px-6 font-bold text-slate-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                            {allLicenses.map((l: any) => {
                                const mod = allModules.find((m: any) => m.moduleKey === l.moduleKey);
                                return (
                                    <tr key={l._id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 transition-colors text-xs">
                                        <td className="py-4 px-6 font-mono text-slate-400 dark:text-zinc-500">
                                            <div className="flex items-center gap-2">
                                                <OfficeBuildingIcon className="w-3.5 h-3.5 opacity-50" />
                                                <span className="truncate max-w-[80px]">{l.firmId}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 font-bold text-slate-700 dark:text-zinc-200">
                                            {mod ? mod.name : <span className="text-rose-500 italic">Unknown Ruleset</span>}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 rounded-md font-bold text-[9px] uppercase text-slate-600 dark:text-zinc-400">
                                                {l.plan}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex justify-center">
                                                {l.isActive ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[9px]">
                                                        <CheckCircleIcon className="w-3 h-3" /> Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-rose-500 font-bold uppercase text-[9px]">
                                                        <XCircleIcon className="w-3 h-3" /> Revoked
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            {l.isActive ? (
                                                <button 
                                                    onClick={() => revokeLicenseMutation({ firmId: l.firmId, moduleKey: l.moduleKey })}
                                                    className="text-[9px] font-black text-rose-500/80 hover:text-rose-600 uppercase tracking-tighter hover:underline"
                                                >
                                                    Revoke
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => grantLicenseMutation({ firmId: l.firmId, moduleKey: l.moduleKey, plan: l.plan })}
                                                    className="text-[9px] font-black text-emerald-600/80 hover:text-emerald-700 uppercase tracking-tighter hover:underline"
                                                >
                                                    Reactivate
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {allLicenses.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-16 text-center text-slate-400 dark:text-zinc-600 italic">
                                        No firm activity recorded in the license registry.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// USAGE LOGS TAB content
// ─────────────────────────────────────────────────────────────────────────────

const UsageLogsTab: React.FC = () => {
    const usageLogs = useQuery(api.legalRepo.getUsageLogs, {}) || [];
    const allModules = useQuery(api.legalRepo.getAllModules) || [];

    return (
        <div className="bg-white dark:bg-zinc-900/40 rounded-2xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50/50 dark:bg-zinc-800/40 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Global Telemetry Feed</h3>
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Live Stream</span>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/20 dark:bg-zinc-800/20 border-b border-slate-200 dark:border-zinc-700/50">
                        <tr>
                            <th className="py-4 px-6 font-bold text-slate-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider">Time</th>
                            <th className="py-4 px-6 font-bold text-slate-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider">Tenant</th>
                            <th className="py-4 px-6 font-bold text-slate-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider">Action</th>
                            <th className="py-4 px-6 font-bold text-slate-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider">Source Engine</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/40">
                        {usageLogs.map((log: any) => {
                            const mod = allModules.find((m: any) => m.moduleKey === log.moduleKey);
                            return (
                                <tr key={log._id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20 transition-all group">
                                    <td className="py-4 px-6 text-[10px] font-mono text-slate-400 transition-colors group-hover:text-slate-500">
                                        {new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </td>
                                    <td className="py-4 px-6 text-xs font-bold text-slate-700 dark:text-zinc-300">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-[8px] font-black text-slate-400 uppercase">F</div>
                                            {log.firmId.slice(0, 8)}...
                                        </div>
                                    </td>
                                    <td className="py-4 px-6">
                                        <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-1">{log.action}</p>
                                    </td>
                                    <td className="py-4 px-6 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter">
                                                {log.sourceType === 'module' ? 'ALOA Core' : log.sourceType.toUpperCase()}
                                            </span>
                                            <span className="text-[9px] text-slate-400 dark:text-zinc-500 italic truncate max-w-[120px]">
                                                {mod ? mod.shortName : log.moduleKey}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {usageLogs.length === 0 && (
                            <tr>
                                <td colSpan={4} className="py-20 text-center">
                                    <div className="flex flex-col items-center gap-2 opacity-30">
                                        <ActivityIcon className="w-10 h-10 text-slate-300" />
                                        <p className="text-sm font-medium text-slate-400 italic">Listening for intelligence events...</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HUB COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_ORDER: ModuleCategory[] = [
    'civil_procedure',
    'legislation',
    'regulatory',
    'criminal_procedure',
    'arbitration',
    'case_law',
    'practice_directions',
];

export const LegalIntelligenceHub: React.FC<LegalIntelligenceHubProps> = ({ firmId, className = '' }) => {
    const [topLevelTab, setTopLevelTab] = useState<'modules' | 'licenses' | 'logs'>('modules');
    
    // Fetch live licenses from Convex
    const activeLicenses = useQuery(api.legalRepo.getLicensesForFirm, firmId ? { firmId } : "skip") || [];
    const activeKeys = new Set(activeLicenses.map((l: any) => l.moduleKey));

    const [showAloaX, setShowAloaX] = useState(() => localStorage.getItem('aloax_sidebar_enabled') === 'true');

    const handleToggleAloaX = () => {
        const nextState = !showAloaX;
        setShowAloaX(nextState);
        if (nextState) {
            localStorage.setItem('aloax_sidebar_enabled', 'true');
        } else {
            localStorage.removeItem('aloax_sidebar_enabled');
        }
        window.dispatchEvent(new Event('aloa_x_toggled'));
    };

    const allModulesRaw = useQuery(api.legalRepo.getAllModules);
    const allModules = [
        ...(allModulesRaw || []),
        ...LEGAL_MODULES.filter(m => m.status === 'locked')
    ];

    const totalActiveCount = activeKeys.size;
    const lockedCount   = allModules.filter((m: any) => m.status === 'locked').length;
    const comingCount   = 0; // coming_soon modules are hidden from the UI

    const filtered = allModules.map((m: any) => ({
        ...m,
        id: m.moduleKey || m._id
    }));

    // Group by category
    const grouped = CATEGORY_ORDER.reduce<Record<string, LegalModule[]>>((acc, cat) => {
        const modules = filtered.filter(m => m.category === cat);
        if (modules.length > 0) acc[cat] = modules;
        return acc;
    }, {});

    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
        civil_procedure: true,
        legislation: true,
        regulatory: true
    });

    const toggleCategory = (cat: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [cat]: !prev[cat]
        }));
    };

    return (
        <div className={`space-y-6 ${className}`}>
            {/* Header / Tabs */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-200 dark:border-zinc-800 pb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <BookOpenIcon className="w-8 h-8 text-indigo-500" />
                        Legal Intelligence
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1 max-w-xl">
                        Executive monitoring and control of specialized law libraries and intelligence modules.
                    </p>
                </div>

                <div className="flex flex-col items-end gap-3 self-start lg:self-center">
                    <button 
                        onClick={handleToggleAloaX}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${showAloaX ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300' : 'bg-white border-slate-200 text-slate-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400'}`}
                    >
                        <div className={`w-2 h-2 rounded-full ${showAloaX ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-zinc-600'}`} />
                        {showAloaX ? 'ALOA-X Interface: Visible in Sidebar' : 'ALOA-X Interface: Hidden'}
                    </button>

                <div className="flex p-1 bg-slate-100 dark:bg-zinc-800/80 rounded-2xl w-fit self-start lg:self-center shadow-inner">
                    {[
                        { id: 'modules', label: 'Modules', icon: <BookOpenIcon className="w-3.5 h-3.5" /> },
                        { id: 'licenses', label: 'Licenses', icon: <ShieldIcon className="w-3.5 h-3.5" /> },
                        { id: 'logs', label: 'Live Logs', icon: <ActivityIcon className="w-3.5 h-3.5" /> }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setTopLevelTab(tab.id as any)}
                            className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition-all ${
                                topLevelTab === tab.id
                                    ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-400 shadow-xl scale-105'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300'
                            }`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>
                </div>
            </div>

            {topLevelTab === 'modules' && (
                <>
            {/* Stats bar */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Active Modules',  value: totalActiveCount,  color: 'emerald' },
                    { label: 'Optional Add-ons', value: lockedCount, color: 'amber'   },
                    { label: 'In Development',   value: comingCount,  color: 'slate'   },
                ].map(({ label, value, color }) => (
                    <div key={label} className={`p-4 rounded-xl border ${
                        color === 'emerald' ? 'border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/20' :
                        color === 'amber'   ? 'border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20' :
                        'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50'
                    }`}>
                        <p className={`text-2xl font-black ${
                            color === 'emerald' ? 'text-emerald-700 dark:text-emerald-400' :
                            color === 'amber'   ? 'text-amber-700 dark:text-amber-400' :
                            'text-slate-600 dark:text-zinc-400'
                        }`}>{value}</p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* Module groups */}
            <div className="space-y-6">
                {Object.entries(grouped).map(([category, modules]) => {
                    const isExpanded = expandedCategories[category] ?? false;
                    return (
                        <div key={category} className="space-y-3">
                            <button 
                                onClick={() => toggleCategory(category)}
                                className="w-full flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-3">
                                    <p className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em]">
                                        {CATEGORY_LABELS[category as ModuleCategory]}
                                    </p>
                                    <div className="h-px flex-1 bg-slate-100 dark:bg-zinc-800/60 min-w-[32px] group-hover:bg-indigo-500/20 transition-colors" />
                                    <span className="text-[10px] font-bold text-slate-300 dark:text-zinc-600 px-2 py-0.5 rounded-md border border-slate-100 dark:border-zinc-800">
                                        {modules.length}
                                    </span>
                                </div>
                                <ChevronDownIcon className={`w-3.5 h-3.5 text-slate-300 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {isExpanded && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                    {modules.map(m => <ModuleCard key={m.id} module={m} />)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {Object.keys(grouped).length === 0 && (
                <div className="text-center py-12 text-slate-400 dark:text-zinc-500 text-sm">
                    No modules in this category.
                </div>
            )}

                    {/* Footer note */}
                    <div className="flex items-start gap-2.5 p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700">
                        <InfoIcon className="w-4 h-4 text-slate-400 dark:text-zinc-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                            All <strong className="text-slate-700 dark:text-zinc-300">Active</strong> modules are included in your Enterprise plan.
                            Additional court rules and case law databases can be added as licensed modules.
                            Contact your account manager or email <span className="text-primary-600 dark:text-primary-400">enterprise@practicepro.ng</span> to enquire.
                        </p>
                    </div>
                </>
            )}

            {topLevelTab === 'licenses' && <LicensesTab firmId={firmId} />}
            {topLevelTab === 'logs' && <UsageLogsTab />}
        </div>
    );
};

export default LegalIntelligenceHub;
