
import React, { useState, useEffect } from 'react';
import { FirmDetails, User, UserRole } from '../../types';
import { useConvex } from 'convex/react';
import { ShieldCheckIcon, DocumentIcon, ZapIcon, LockClosedIcon, TrashIcon, EyeIcon, EyeOffIcon, BrainIcon, SearchIcon, ScalesIcon } from '../../constants';
import { useUI } from '../../contexts/UIContext';
import { setCustomApiKey, getCustomApiKey } from '../../utils/aiUtils';
import { getAssistantName } from '../../utils/assistantIdentity';
import { useProduct } from '../../contexts/ProductContext';

const SettingsCard: React.FC<{ title: string; children: React.ReactNode; id?: string, className?: string }> = ({ title, children, id, className }) => (
    <div id={id} className={`relative overflow-hidden bg-white dark:bg-zinc-900 dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-xl shadow-md p-5 ${className || ''}`}>
        <div className="relative z-10">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">{title}</h3>
            {children}
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
        <div className="flex flex-col gap-2">
            <button
                onClick={handleSeed}
                disabled={status === 'running'}
                className={`w-full sm:w-auto px-4 py-2 rounded-lg font-semibold text-sm transition-colors shadow-sm ${status === 'idle' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' :
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
                    New documents and notes will be automatically indexed going forward.
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

// Compact agent row — replaces the old toggle cards.
const AgentRow: React.FC<{ icon: React.ReactNode; name: string; desc: string; trigger: string }> = ({ icon, name, desc, trigger }) => (
    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50/60 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-700/40">
        <div className="p-1.5 rounded-md bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 flex-shrink-0">
            {icon}
        </div>
        <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900 dark:text-white text-xs">{name}</span>
                <span className="text-3xs font-mono text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 dark:bg-zinc-900/60 px-1.5 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">{trigger}</span>
            </div>
            <p className="text-2xs text-slate-500 dark:text-zinc-400 leading-snug mt-0.5">{desc}</p>
        </div>
    </div>
);

const AgentSettings: React.FC<AgentSettingsProps> = ({ firmDetails, onUpdateFirmDetails, currentUser }) => {
    const { addToast } = useUI();
    const { isProperty } = useProduct();
    const convex = useConvex();
    const [customKey, setCustomKey] = useState('');
    const [hasKey, setHasKey] = useState(false);
    const [showKey, setShowKey] = useState(false);
    const isFirmAdmin = currentUser.role === UserRole.Admin;

    useEffect(() => {
        const storedGemini = getCustomApiKey();
        if (storedGemini) {
            setHasKey(true);
            setCustomKey('••••••••••••••••');
        }
    }, []);

    const handleToggleShow = () => {
        if (!showKey) {
            if (customKey === '••••••••••••••••') {
                setCustomKey(getCustomApiKey() || '');
            }
            setShowKey(true);
        } else {
            if (hasKey) setCustomKey('••••••••••••••••');
            setShowKey(false);
        }
    };

    const handleSaveKey = () => {
        // Strip any mask characters that might have been appended
        const cleanKey = customKey.replace(/•/g, '').trim();
        if (!cleanKey) {
            addToast("Please enter a valid API key.", { type: 'error' });
            return;
        }
        if (cleanKey.length < 30) {
            addToast("That key looks too short. Gemini keys are usually 39 characters starting with 'AIza'.", { type: 'error' });
            return;
        }
        try {
            setCustomApiKey(cleanKey);
            setHasKey(true);
            addToast("Gemini Key saved successfully.", { type: 'success' });
            setCustomKey('••••••••••••••••');
        } catch (err: any) {
            addToast("Failed to save key: " + (err.message || "Unknown error"), { type: 'error' });
        }
    };

    const handleClearKey = () => {
        setCustomApiKey(null);
        setHasKey(false);
        setCustomKey('');
        addToast("Key removed.", { type: 'info' });
    };

    // When user focuses the input and it contains the mask, clear it
    // so they can type a fresh key without appending to the mask.
    const handleInputFocus = () => {
        if (customKey === '••••••••••••••••') {
            setCustomKey('');
        }
    };

    // Build the agent list dynamically based on product (Vega vs Atrium).
    // All of these run automatically when AI is enabled — no per-agent toggles.
    const agentList = isProperty ? [
        { icon: <ZapIcon className="w-3.5 h-3.5" />, name: 'ARIA Chat', desc: 'Conversational assistant for portfolio & tenant queries.', trigger: 'On Demand' },
        { icon: <DocumentIcon className="w-3.5 h-3.5" />, name: 'ALDIA', desc: 'Document intelligence — summaries, key clauses, risks.', trigger: 'On Upload' },
        { icon: <LockClosedIcon className="w-3.5 h-3.5" />, name: 'PII Shield', desc: 'Strips NIN, BVN, account numbers before AI processing.', trigger: 'Auto' },
        { icon: <BrainIcon className="w-3.5 h-3.5" />, name: 'Brain Memory', desc: 'Vector recall over your firm\'s documents & notes.', trigger: 'On Search' },
        { icon: <SearchIcon className="w-3.5 h-3.5" />, name: 'Research', desc: 'Multi-source legal research with citations.', trigger: 'In Studio' },
    ] : [
        { icon: <ZapIcon className="w-3.5 h-3.5" />, name: 'ALOA Chat', desc: 'Conversational assistant for matters, drafting & finance.', trigger: 'On Demand' },
        { icon: <DocumentIcon className="w-3.5 h-3.5" />, name: 'ALDIA', desc: 'Document intelligence — summaries, key clauses, risks.', trigger: 'On Upload' },
        { icon: <ShieldCheckIcon className="w-3.5 h-3.5" />, name: 'RPC Review', desc: 'Ethics & accuracy check, built into ALDIA.', trigger: 'After Analysis' },
        { icon: <LockClosedIcon className="w-3.5 h-3.5" />, name: 'PII Shield', desc: 'Strips NIN, BVN, account numbers before AI processing.', trigger: 'Auto' },
        { icon: <BrainIcon className="w-3.5 h-3.5" />, name: 'Brain Memory', desc: 'Vector recall over your firm\'s documents & notes.', trigger: 'On Search' },
        { icon: <SearchIcon className="w-3.5 h-3.5" />, name: 'Research', desc: 'Multi-source legal research with citations.', trigger: 'In Studio' },
        { icon: <ScalesIcon className="w-3.5 h-3.5" />, name: 'Tax Compliance', desc: 'Nigerian tax analysis on expenses.', trigger: 'In Expense Form' },
    ];

    return (
        <div className="space-y-5">
            <div className="bg-white dark:bg-zinc-900 dark:bg-zinc-800 rounded-xl p-5 border border-slate-200 dark:border-zinc-700 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                        <ZapIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">AI Assistant</h2>
                        <p className="text-xs text-slate-600 dark:text-zinc-400">Configure your personal API access and review active agents.</p>
                    </div>
                </div>
            </div>

            <SettingsCard title="API Key Configuration" id="api-config">
                <p className="text-xs text-slate-600 dark:text-zinc-400 mb-3">
                    Enter your Google Gemini API Key. Stored locally and used for Chat, Drafting, and Analysis.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-grow w-full relative">
                        <label className="block text-2xs font-bold text-slate-500 uppercase mb-1">
                            Gemini API Key
                        </label>
                        <div className="relative">
                            <input autoComplete="off" data-lpignore="true"
                                type={showKey ? "text" : "password"}
                                value={customKey}
                                onChange={(e) => setCustomKey(e.target.value)}
                                onFocus={handleInputFocus}
                                placeholder="AIzaSy..."
                                className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-lg text-base focus:ring-primary-500 focus:border-primary-500 pr-10"
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
                            className="px-4 py-2.5 bg-primary-600 text-white rounded-lg font-bold text-sm hover:bg-primary-700 shadow-sm flex-grow sm:flex-grow-0 transition-colors active:scale-95"
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

                <div className="mt-3 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <LockClosedIcon className="w-3 h-3" />
                        <span>Stored locally. Never sent to our servers.</span>
                    </div>
                    <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 rounded-lg text-xs font-bold hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Get your free API key
                    </a>
                </div>
            </SettingsCard>

            {isFirmAdmin ? (
                <>
                    <SettingsCard title="Firm-Wide API Keys (Admin Only)" id="firm-keys">
                        <p className="text-xs text-slate-600 dark:text-zinc-400 mb-3">
                            Set a fallback API key for the entire firm. Used when a user hasn't set their own personal key.
                        </p>
                        <div>
                            <label className="block text-2xs font-bold text-slate-500 uppercase mb-1">Firm Gemini Key (Google)</label>
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
                                className="w-full p-2.5 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-lg text-sm focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>
                    </SettingsCard>

                    <SettingsCard title="Brain — Memory Index" id="brain-index">
                        <p className="text-xs text-slate-600 dark:text-zinc-400 mb-3">
                            {`${getAssistantName(isProperty)}'s memory is built from your ${isProperty ? "portfolio's" : "firm's"} documents and notes. This allows the AI to recall specific facts instead of guessing.`}
                        </p>
                        <SeedBrainButton
                            firmId={firmDetails.id}
                            scope={isProperty ? 'property' : 'legal'}
                            addToast={addToast}
                            convex={convex}
                        />
                        <div className="mt-3 p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700/40 text-2xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                            <span className="font-bold">Note:</span> Memory (vector embeddings) is stored in your firm's database, tied to your <code className="font-mono bg-indigo-100 dark:bg-indigo-800/40 px-1 rounded">firmId</code>. You can rotate your Gemini key at any time without losing indexed memories.
                        </div>
                    </SettingsCard>

                    <SettingsCard title="Active AI Agents" id="agent-config">
                        <p className="text-xs text-slate-600 dark:text-zinc-400 mb-3">
                            These agents run automatically as part of your AI assistant — no per-agent configuration needed.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {agentList.map((a) => (
                                <AgentRow key={a.name} icon={a.icon} name={a.name} desc={a.desc} trigger={a.trigger} />
                            ))}
                        </div>
                    </SettingsCard>
                </>
            ) : (
                <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 dark:bg-zinc-800 rounded-lg text-center text-sm text-slate-500">
                    <p>Only Administrators can configure firm-wide agents.</p>
                </div>
            )}
        </div>
    );
};

export default AgentSettings;
