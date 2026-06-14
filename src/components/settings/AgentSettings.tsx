
import React, { useState, useEffect } from 'react';
import { FirmDetails, User, UserRole } from '../../types';
import { useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { ShieldCheckIcon, GavelIconLarge, CalculatorIcon, DocumentIcon, ZapIcon, LockClosedIcon, PlusIcon, TrashIcon, EyeIcon, EyeOffIcon } from '../../constants';
import { useUI } from '../../contexts/UIContext';
import { setCustomApiKey, getCustomApiKey, getAIProvider } from '../../utils/aiUtils';
import { useProduct } from '../../contexts/ProductContext';
import { CHANGELOG, FEATURE_ICONS } from '../WhatsNew';
import { v4 as uuidv4 } from 'uuid';

const SettingsCard: React.FC<{ title: string; children: React.ReactNode; id?: string, className?: string }> = ({ title, children, id, className }) => (
    <div id={id} className={`relative overflow-hidden bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-xl shadow-md p-6 ${className || ''}`}>
        <div className="relative z-10">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{title}</h3>
            {children}
        </div>
    </div>
);

// ... AgentToggle component remains same ...
const AgentToggle: React.FC<{
    title: string;
    description: string;
    icon: React.ReactNode;
    isEnabled: boolean;
    onToggle: () => void;
    triggerText: string;
    locked?: boolean;
}> = ({ title, description, icon, isEnabled, onToggle, triggerText, locked }) => (
    <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${isEnabled ? 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 shadow-sm' : 'bg-slate-50 dark:bg-zinc-900 border-transparent opacity-75'}`}>
        <div className={`p-2 rounded-lg ${isEnabled ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400' : 'bg-slate-200 text-slate-500 dark:bg-zinc-700 dark:text-zinc-500'}`}>
            {icon}
        </div>
        <div className="flex-grow">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{title}</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 leading-relaxed">{description}</p>
                </div>
                {locked ? (
                    <div className="flex flex-col items-center">
                        <div className="bg-slate-300 dark:bg-zinc-600 relative inline-flex items-center h-5 rounded-full w-9 cursor-not-allowed ml-2 opacity-50">
                            <span className="translate-x-4.5 inline-block w-4 h-4 transform bg-white rounded-full" />
                        </div>
                        <span className="text-[9px] text-slate-400 mt-1 flex items-center gap-0.5"><LockClosedIcon className="w-2 h-2" /> Pro</span>
                    </div>
                ) : (
                    <div
                        role="switch"
                        aria-checked={isEnabled}
                        onClick={onToggle}
                        className={`${isEnabled ? 'bg-primary-600' : 'bg-slate-300 dark:bg-zinc-600'} relative inline-flex items-center h-5 rounded-full w-9 transition-colors cursor-pointer flex-shrink-0 ml-2`}
                    >
                        <span className={`${isEnabled ? 'translate-x-4.5' : 'translate-x-0.5'} inline-block w-4 h-4 transform bg-white rounded-full transition-transform`} />
                    </div>
                )}
            </div>
            <div className="mt-3 flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Trigger:</span>
                <span className="text-[10px] bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 px-2 py-0.5 rounded-full font-mono">
                    {triggerText}
                </span>
            </div>
        </div>
    </div>
);

interface AgentSettingsProps {
    firmDetails: FirmDetails;
    onUpdateFirmDetails: (details: FirmDetails) => void;
    currentUser: User;
}

// ─── SEED BRAIN BUTTON ──────────────────────────────────────────────────────
// Triggers one-time full indexing of all existing firm docs and notes.
// Uses the user's Gemini API key from localStorage — no server-side key needed.
const SeedBrainButton: React.FC<{
    firmId: string;
    scope: 'legal' | 'property';
    addToast: (msg: string, opts?: any) => void;
    convex: any;
}> = ({ firmId, scope, addToast, convex }) => {
    const [status, setStatus] = React.useState<'idle' | 'running' | 'done' | 'error'>('idle');
    const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);

    const handleSeed = async () => {
        setStatus('running');
        setProgress(null);
        try {
            const { brain } = await import('../../services/brainService');

            const result = await brain.seedFirm({
                firmId,
                scope,
                convexQuery: (name: any, args: any) => convex.query(name, args),
                convexMutation: (name: any, args: any) => convex.mutation(name, args),
                onProgress: (done, total) => setProgress({ done, total })
            });

            addToast(`Indexing complete: ${result.indexed} items stored.`, { type: 'success' });
            setStatus('done');
        } catch (e: any) {
            console.error('[Brain] Seed failed:', e);
            addToast('Brain seed failed: ' + e.message, { type: 'error' });
            setStatus('error');
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <button
                onClick={handleSeed}
                disabled={status === 'running'}
                className={`w-full sm:w-auto px-5 py-2.5 rounded-lg font-bold text-sm transition-colors shadow-sm ${status === 'idle' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' :
                    status === 'running' ? 'bg-indigo-400 text-white cursor-wait' :
                        status === 'done' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    }`}
            >
                {status === 'idle' && 'Seed Brain from Existing Data'}
                {status === 'running' && 'Preparing…'}
                {status === 'done' && 'Indexing Scheduled'}
                {status === 'error' && 'Failed — Retry?'}
            </button>
            {status === 'done' && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    New documents and notes will be automatically indexed going forward using your Gemini key.
                </p>
            )}
            {progress && (
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Indexed {progress.done} / {progress.total} chunks…
                </p>
            )}
        </div>
    );
};

const AgentSettings: React.FC<AgentSettingsProps> = ({ firmDetails, onUpdateFirmDetails, currentUser }) => {
    const { addToast } = useUI();
    const { isProperty } = useProduct();
    const convex = useConvex();
    const [customKey, setCustomKey] = useState('');
    const [hasKey, setHasKey] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const isFirmAdmin = currentUser.role === UserRole.Admin;

    // Default to true if undefined
    const settings = firmDetails.aiSettings?.enabledAgents || {
        jurisdictionScout: true,
        rpcGuardian: true,
        privacyShield: true,
        billingAuditor: true,
        draftingAssistant: true
    };

    useEffect(() => {
        // Gemini
        const storedGemini = getCustomApiKey();
        if (storedGemini) {
            setHasKey(true);
            setCustomKey('••••••••••••••••');
        }
    }, []);

    const handleToggleShow = () => {
        if (!showKey) {
            // SHOW
            if (customKey === '••••••••••••••••') {
                setCustomKey(getCustomApiKey() || '');
            }
            setShowKey(true);
        } else {
            // HIDE
            if (hasKey) setCustomKey('••••••••••••••••');
            setShowKey(false);
        }
    };

    const toggleAgent = (key: keyof typeof settings) => {
        const newAgents = { ...settings, [key]: !settings[key] };
        onUpdateFirmDetails({
            ...firmDetails,
            aiSettings: {
                ...firmDetails.aiSettings,
                enableAllAiFeatures: firmDetails.aiSettings?.enableAllAiFeatures ?? true,
                enableJurisdictionalAnalysis: firmDetails.aiSettings?.enableJurisdictionalAnalysis ?? false,
                enabledAgents: newAgents
            }
        });
    };

    const handleSaveKey = () => {
        if (customKey && customKey !== '••••••••••••••••') {
            setCustomApiKey(customKey);
            setHasKey(true);
            addToast("Gemini Key saved.", { type: 'success' });
            if (!showKey) setCustomKey('••••••••••••••••');
        }
    };

    const handleClearKey = () => {
        setCustomApiKey(null);
        setHasKey(false);
        setCustomKey('');
        addToast("Key removed.", { type: 'info' });
    };

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 border border-slate-200 dark:border-zinc-700 shadow-sm">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                        <ZapIcon className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">AI Assistant Settings</h2>
                </div>
                <p className="text-slate-600 dark:text-zinc-400 ml-14">
                    Configure your personal AI access and firm-wide agents.
                </p>
            </div>

            <SettingsCard title="API Key Configuration" id="api-config">
                <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
                    Enter your Google Gemini API Key. Stored locally and used for Chat, Drafting, and Analysis.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-grow w-full relative">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                            Gemini API Key
                        </label>
                        <div className="relative">
                            <input autoComplete="off" data-lpignore="true" 
                                type={showKey ? "text" : "password"}
                                value={customKey}
                                onChange={(e) => setCustomKey(e.target.value)}
                                placeholder="AIzaSy..."
                                className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500 pr-10"
                            />
                            <button
                                onClick={handleToggleShow}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                title={showKey ? "Hide API Key" : "Show API Key"}
                            >
                                {showKey ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <button
                            onClick={handleSaveKey}
                            disabled={!customKey || customKey === '••••••••••••••••'}
                            className="px-4 py-2.5 bg-primary-600 text-white rounded-lg font-bold text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex-grow sm:flex-grow-0"
                        >
                            Save Key
                        </button>
                        <button
                            onClick={async () => {
                                try {
                                    addToast("Testing connection...", { type: 'info' });
                                    const { streamGemini, AI_CONFIG } = await import('../../utils/aiUtils');
                                    const savedKey = getCustomApiKey();
                                    let rawKey = (customKey && customKey !== '••••••••••••••••') ? customKey : savedKey;
                                    const keyToTest = rawKey ? rawKey.replace(/[^ -~]/g, '').trim() : null;

                                    if (!keyToTest) throw new Error("No Gemini Key found.");
                                    await streamGemini("Test", { model: AI_CONFIG.gemini.fallbackPlan[0], apiKeyOverride: keyToTest });

                                    addToast("Connection Successful! AI is ready.", { type: 'success' });
                                } catch (e: any) {
                                    console.error("AI Connection Test Failed:", e);
                                    addToast(`Connection Failed: ${e.message}`, { type: 'error' });
                                }
                            }}
                            className="px-4 py-2.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg font-bold text-sm hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                            title="Test Connection"
                        >
                            <ZapIcon className="w-5 h-5" />
                        </button>
                        {hasKey && (
                            <button
                                onClick={handleClearKey}
                                className="px-4 py-2.5 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg font-bold text-sm hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                            >
                                <TrashIcon className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <LockClosedIcon className="w-3 h-3" />
                    <span>Stored locally. Never sent to our servers.</span>
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-primary-600 hover:underline ml-1">Get Gemini Key &rarr;</a>
                </div>
            </SettingsCard>

            {isFirmAdmin ? (
                <>
                    <SettingsCard title="Firm-Wide API Keys (Admin Only)" id="firm-keys">
                        <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
                            Set fallback API keys for the entire firm. These will be used if a user hasn't set their own personal key.
                        </p>
                        <div className="space-y-4">
                            {/* Firm Gemini Key */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Firm Gemini Key (Google)</label>
                                <div className="flex gap-2">
                                    <input autoComplete="off" data-lpignore="true" 
                                        type="password"
                                        placeholder="AIzaSy... (Firm Fallback)"
                                        defaultValue={firmDetails.aiSettings?.firmGeminiApiKey || ''}
                                        onBlur={(e) => {
                                            const val = e.target.value;
                                            if (val !== firmDetails.aiSettings?.firmGeminiApiKey) {
                                                onUpdateFirmDetails({
                                                    ...firmDetails,
                                                    aiSettings: {
                                                        ...firmDetails.aiSettings,
                                                        enableAllAiFeatures: firmDetails.aiSettings?.enableAllAiFeatures ?? true,
                                                        enableJurisdictionalAnalysis: firmDetails.aiSettings?.enableJurisdictionalAnalysis ?? false,
                                                        firmGeminiApiKey: val,
                                                    }
                                                });
                                                addToast("Firm Gemini Key updated.", { type: 'success' });
                                            }
                                        }}
                                        className="flex-grow p-2.5 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </SettingsCard>

                    <SettingsCard title={isProperty ? "ARIA Brain — Memory Index" : "ARIA Brain — Memory Index"} id="brain-index">
                        <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
                            {isProperty ? "ARIA's memory is built from your portfolio's documents and notes. This allows the AI to recall specific facts instead of guessing." : "ARIA's memory is built from your firm's documents and notes. This allows the AI to recall specific facts instead of guessing."}
                        </p>
                        <SeedBrainButton
                            firmId={firmDetails.id}
                            scope={isProperty ? 'property' : 'legal'}
                            addToast={addToast}
                            convex={convex}
                        />
                        <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700/40 text-xs text-indigo-700 dark:text-indigo-300 mb-4 leading-relaxed">
                            <span className="font-bold">API Key Note:</span> The memory (vector embeddings) is stored
                            in your firm's database, tied to your <code className="font-mono bg-indigo-100 dark:bg-indigo-800/40 px-1 rounded">firmId</code>.
                            You can change or rotate your Gemini API key at any time without losing any indexed memories.
                        </div>
                    </SettingsCard>

                    <SettingsCard title="Firm Agent Configuration" id="agent-config">
                        <div className="grid grid-cols-1 gap-4">
                            <AgentToggle
                                title="Jurisdiction Scout"
                                description="Analyzes new litigation matters to recommend the appropriate court (Federal vs. State)."
                                icon={<GavelIconLarge className="w-5 h-5" />}
                                isEnabled={settings.jurisdictionScout}
                                onToggle={() => toggleAgent('jurisdictionScout')}
                                triggerText="On New Matter"
                            />

                            <AgentToggle
                                title="RPC Guardian"
                                description="Reviews AI-generated content for ethical compliance."
                                icon={<ShieldCheckIcon className="w-5 h-5" />}
                                isEnabled={settings.rpcGuardian}
                                onToggle={() => toggleAgent('rpcGuardian')}
                                triggerText="After Analysis"
                            />

                            <AgentToggle
                                title="Privacy Shield"
                                description="Scans documents for PII (NIN, BVN) and suggests redaction. (Enterprise)"
                                icon={<LockClosedIcon className="w-5 h-5" />}
                                isEnabled={true}
                                onToggle={() => { }}
                                triggerText="On Upload"
                                locked={true}
                            />

                            <AgentToggle
                                title="Scale Fee Auditor"
                                description="Checks real estate invoices against the Remuneration Order."
                                icon={<CalculatorIcon className="w-5 h-5" />}
                                isEnabled={settings.billingAuditor}
                                onToggle={() => toggleAgent('billingAuditor')}
                                triggerText="On Invoice"
                            />

                            <AgentToggle
                                title="Drafting Co-Pilot"
                                description="Enables 'Magic Rewrite' and context-aware suggestions."
                                icon={<DocumentIcon className="w-5 h-5" />}
                                isEnabled={settings.draftingAssistant}
                                onToggle={() => toggleAgent('draftingAssistant')}
                                triggerText="In Editor"
                            />
                        </div>
                    </SettingsCard>
                </>
            ) : (
                <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-lg text-center text-sm text-slate-500">
                    <p>Only Administrators can configure firm-wide agents.</p>
                </div>
            )}
            <SettingsCard title="Product Updates & Changelog" id="changelog" className="mt-8">
                <p className="text-sm text-slate-600 dark:text-zinc-400 mb-6 font-medium">
                    {isProperty ? "See the latest enhancements to Atrium OS and the ARIA Brain." : "See the latest enhancements to Vega OS and ARIA."}
                </p>
                <div className="space-y-8">
                    {CHANGELOG.map((entry) => (
                        <div key={entry.id} className="relative pl-8 border-l-2 border-slate-100 dark:border-zinc-800 pb-2 transition-all group/item hover:border-primary-400">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white dark:bg-zinc-900 border-2 border-slate-200 dark:border-zinc-700 group-hover/item:border-primary-500 group-hover/item:shadow-[0_0_8px_rgba(99,102,241,0.4)] transition-all" />
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                <h4 className="font-extrabold text-slate-900 dark:text-white text-base tracking-tight">{entry.title}</h4>
                                <span className="w-fit text-[10px] font-black text-slate-400 bg-slate-50 dark:bg-zinc-900/50 px-3 py-1 rounded-full border border-slate-200 dark:border-zinc-800 uppercase tracking-widest">
                                    v{entry.version} — {new Date(entry.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-5 leading-relaxed">
                                {entry.description}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {entry.features.map((f) => {
                                    const Icon = FEATURE_ICONS[f.icon];
                                    return (
                                        <div key={f.label} className="flex flex-col gap-2 p-3 rounded-xl bg-slate-50/50 dark:bg-zinc-900/30 border border-slate-100 dark:border-zinc-800/50 hover:border-primary-500/20 transition-all">
                                            <div className="flex items-center gap-2">
                                                {Icon && <div className="scale-75 origin-left"><Icon /></div>}
                                                <span className="text-[10px] font-black text-slate-700 dark:text-zinc-200 uppercase tracking-wider">{f.label}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500 dark:text-zinc-500 leading-snug">
                                                {f.text}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </SettingsCard>
        </div>
    );
};

export default AgentSettings;
