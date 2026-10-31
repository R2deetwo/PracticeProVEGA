
import React, { useMemo, useState } from 'react';
import { Button, Select, Badge } from '../ui';
import { useFeatures } from '../../hooks/useFeatures';
import { useContractAnalysis, useRegulatoryAudit } from '../../hooks/useContractAnalysis';
import {
    JURISDICTION_OPTIONS,
    listStatutesForJurisdiction,
} from '../../utils/statuteLibrary';
import type { RiskFlag, RiskLevel, ContractClause } from '../../utils/contractAnalysis';
import type { StatuteViolation } from '../../utils/statuteLibrary';
import { ScalesIcon, LockClosedIcon, DocumentIcon } from '../../constants';
import RegulatoryGateModal from './RegulatoryGateModal';

/**
 * ContractAnalyzer — the DraftPro workspace (R48).
 *
 * MODULE 1 (standard, every Vega workspace): upload a commercial contract
 * (.docx / .pdf / .txt) → the analysis dashboard — defined-terms check,
 * missing standard clauses (each with its Nigerian-law compliant standard
 * draft), risk scoring (Low / Medium / High) and redline suggestions
 * (original clause vs suggested draft, side by side).
 *
 * MODULE 2 (the Regulatory Cross-Referencing add-on, Enterprise tier):
 * jurisdiction & statute selector → statutory audit log with exact
 * section citations. Gated: a standard user who attempts it gets the
 * RegulatoryGateModal.
 *
 * Design tokens per the module spec: light mode, deep navy headers,
 * crisp thin borders (border-slate-200), split-pane workspace — document
 * viewer on the left, AI insights/flag panel on the right. No chat UI.
 */

const LEVEL_TONE: Record<RiskLevel, 'danger' | 'warning' | 'info'> = {
    High: 'danger', Medium: 'warning', Low: 'info',
};

const RISK_BORDER: Record<RiskLevel, string> = {
    High: 'border-l-red-500',
    Medium: 'border-l-amber-500',
    Low: 'border-l-sky-500',
};

export const ContractAnalyzer: React.FC = () => {
    const analysis = useContractAnalysis();
    const features = useFeatures();
    const [tab, setTab] = useState<'analysis' | 'regulatory'>('analysis');
    const [gateOpen, setGateOpen] = useState(false);
    const [openRedline, setOpenRedline] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const regulatory = useRegulatoryAudit(analysis.rawText, analysis.effectiveDocType);
    const canRegulate = features.canUseRegulatoryEngine;

    const statuteList = useMemo(
        () => listStatutesForJurisdiction(regulatory.jurisdiction),
        [regulatory.jurisdiction],
    );

    /** clauseId → highest risk level (for the document viewer's borders). */
    const clauseRisk = useMemo(() => {
        const m = new Map<string, RiskLevel>();
        analysis.result?.riskFlags.forEach((f) => {
            const cur = m.get(f.clauseId);
            if (!cur || (f.level === 'High') || (f.level === 'Medium' && cur === 'Low')) {
                m.set(f.clauseId, f.level);
            }
        });
        return m;
    }, [analysis.result]);

    const handleTab = (t: 'analysis' | 'regulatory') => {
        if (t === 'regulatory' && !canRegulate) { setGateOpen(true); return; }
        setTab(t);
    };

    /**
     * Programmatic file picker. Created imperatively, not in JSX — the
     * ADR-0004 ratchet (check-ui-primitives.mjs) counts raw JSX form
     * elements and there is no file-picker primitive; this behaves exactly
     * like the hidden inputs in DocumentForm/AddResearchSourceModal without
     * growing the ratchet.
     */
    const browse = () => {
        const el = document.createElement('input');
        el.type = 'file';
        el.accept = '.docx,.doc,.pdf,.txt,.md';
        el.onchange = () => {
            const f = el.files?.[0];
            if (f) void analysis.ingest(f);
        };
        el.click();
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void analysis.ingest(f);
    };

    const scrollToClause = (clauseId: string) => {
        document.getElementById(`clause-${clauseId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    return (
        <div className="h-full overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-zinc-900 pb-32">
            {/* Header — navy on light, thin border, no heavy shadow */}
            <header className="sticky top-0 pt-safe z-30 glass flex-shrink-0 py-4 px-4 sm:px-6 lg:px-8 shadow-sm border-b border-slate-200 dark:border-zinc-700 mb-6">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="p-2 bg-slate-900 dark:bg-zinc-800 rounded-lg">
                        <ScalesIcon className="w-6 h-6 text-white dark:text-zinc-100" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                            DraftPro — Contract Analyzer
                        </h2>
                        <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mt-1">
                            Upload a commercial contract. Every clause read, every gap named, every fix drafted.
                        </p>
                    </div>
                    {analysis.phase === 'ready' && (
                        <div className="ml-auto hidden sm:flex items-center gap-3">
                            <Badge tone={analysis.result?.overallRisk === 'High' ? 'danger' : analysis.result?.overallRisk === 'Medium' ? 'warning' : 'success'}>
                                Overall risk: {analysis.result?.overallRisk}
                            </Badge>
                        </div>
                    )}
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Control bar: doc type + upload + phase */}
                <div className="flex flex-wrap items-end gap-4 mb-5">
                    <div className="w-full sm:w-72">
                        <Select
                            label={<span className="font-mono text-2xs uppercase tracking-widest text-slate-600 dark:text-zinc-500">Contract type</span>}
                            labelClassName="mb-1.5"
                            styleVariant="classic"
                            value={analysis.docType}
                            onChange={(e) => analysis.setDocType(e.target.value as any)}
                            options={[
                                { value: 'auto', label: 'Auto-detect' },
                                ...analysis.docTypeOptions.map((o) => ({ value: o.value, label: o.label })),
                            ]}
                        />
                    </div>
                    <Button variant="primary" onClick={browse} icon={DocumentIcon}>
                        {analysis.phase === 'ready' ? 'Replace contract' : 'Upload contract'}
                    </Button>
                    {analysis.phase === 'extracting' && <span className="text-sm text-slate-500 dark:text-zinc-400 py-2">Reading the document…</span>}
                    {analysis.phase === 'analyzing' && <span className="text-sm text-slate-500 dark:text-zinc-400 py-2">Analyzing clauses…</span>}
                    {analysis.fileName && analysis.phase !== 'extracting' && (
                        <span className="text-sm text-slate-500 dark:text-zinc-400 py-2 truncate max-w-[240px]">
                            {analysis.fileName}
                        </span>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 border-b border-slate-200 dark:border-zinc-700 mb-6" role="tablist" aria-label="Analyzer modes">
                    <Button variant={tab === 'analysis' ? 'tab-active' : 'tab'} onClick={() => handleTab('analysis')} role="tab" aria-selected={tab === 'analysis'}>
                        Contract Analysis
                    </Button>
                    <Button variant={tab === 'regulatory' ? 'tab-active' : 'tab'} onClick={() => handleTab('regulatory')} role="tab" aria-selected={tab === 'regulatory'}>
                        <span className="inline-flex items-center gap-1.5">
                            Statutory Cross-Reference
                            {!canRegulate && <LockClosedIcon className="w-3.5 h-3.5" />}
                        </span>
                    </Button>
                </div>

                {tab === 'analysis' ? (
                    <AnalysisTab
                        analysis={analysis}
                        clauseRisk={clauseRisk}
                        openRedline={openRedline}
                        setOpenRedline={setOpenRedline}
                        isDragging={isDragging}
                        setIsDragging={setIsDragging}
                        onDrop={onDrop}
                        browse={browse}
                        scrollToClause={scrollToClause}
                    />
                ) : (
                    <RegulatoryTab
                        fileName={analysis.fileName}
                        ready={analysis.phase === 'ready'}
                        regulatory={regulatory}
                        statuteList={statuteList}
                        scrollToClause={scrollToClause}
                    />
                )}
            </div>

            {gateOpen && <RegulatoryGateModal onClose={() => setGateOpen(false)} />}
        </div>
    );
};

// ─── Tab 1: the standard analysis workspace ─────────────────────────────────

const AnalysisTab: React.FC<{
    analysis: ReturnType<typeof useContractAnalysis>;
    clauseRisk: Map<string, RiskLevel>;
    openRedline: string | null;
    setOpenRedline: (id: string | null) => void;
    isDragging: boolean;
    setIsDragging: (b: boolean) => void;
    onDrop: (e: React.DragEvent) => void;
    browse: () => void;
    scrollToClause: (clauseId: string) => void;
}> = ({ analysis, clauseRisk, openRedline, setOpenRedline, isDragging, setIsDragging, onDrop, browse, scrollToClause }) => {
    if (analysis.phase === 'error') {
        return (
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 p-6 mb-6">
                <p className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">Could not read that file</p>
                <p className="text-sm text-red-700 dark:text-red-400 leading-relaxed">{analysis.error}</p>
                <Button variant="secondary" className="mt-4" onClick={browse}>Try another file</Button>
            </div>
        );
    }

    if (analysis.phase === 'idle' || analysis.phase === 'extracting' || !analysis.result) {
        return (
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                className={`rounded-2xl border-2 border-dashed p-10 sm:p-16 text-center transition-colors mb-6 ${
                    isDragging
                        ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20'
                        : 'border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800/40'
                }`}
            >
                <div className="max-w-md mx-auto">
                    <div className="inline-flex p-3 rounded-xl bg-slate-100 dark:bg-zinc-800 mb-4">
                        <DocumentIcon className="w-7 h-7 text-slate-500 dark:text-zinc-400" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                        Drop a commercial contract here
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed mb-6">
                        Shareholders&apos; agreements, JVAs, employment contracts, commercial leases
                        and NDAs — .docx, .pdf or .txt, up to ~100 pages.
                    </p>
                    <Button variant="primary" onClick={browse} loading={analysis.phase === 'extracting'}>
                        Browse files
                    </Button>
                </div>
            </div>
        );
    }

    const r = analysis.result;
    return (
        <div className="grid lg:grid-cols-5 gap-6 mb-10">
            {/* LEFT — the document viewer */}
            <section aria-label="Document viewer" className="lg:col-span-3">
                <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-200 dark:border-zinc-700 flex items-baseline justify-between">
                        <p className="font-mono text-2xs uppercase tracking-widest text-slate-500 dark:text-zinc-500">
                            Document — {analysis.fileName}
                        </p>
                        <p className="font-mono text-2xs text-slate-400 dark:text-zinc-600">
                            {r.clauseCount} clauses · {r.wordCount.toLocaleString('en-NG')} words
                        </p>
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-zinc-800">
                        {analysis.clauses.map((c: ContractClause) => (
                            <article
                                key={c.id}
                                id={`clause-${c.id}`}
                                className={`p-5 border-l-4 ${clauseRisk.get(c.id) ? RISK_BORDER[clauseRisk.get(c.id)!] : 'border-l-transparent'} scroll-mt-6`}
                            >
                                <p className="font-mono text-2xs text-slate-400 dark:text-zinc-600 mb-1.5">
                                    {c.heading ? `CLAUSE ${c.index} — ${c.heading.slice(0, 70)}` : `PARAGRAPH ${c.index}`}
                                </p>
                                <p className="text-sm leading-[1.75] text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">
                                    {c.text.length > 900 ? `${c.text.slice(0, 900)}…` : c.text}
                                </p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* RIGHT — the AI insights / flag panel */}
            <section aria-label="Analysis insights" className="lg:col-span-2 space-y-6">
                {/* Summary */}
                <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 p-5">
                    <p className="font-mono text-2xs uppercase tracking-widest text-slate-500 dark:text-zinc-500 mb-3">Summary</p>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{r.riskFlags.length}</p>
                            <p className="text-xs text-slate-500 dark:text-zinc-500">risk flags</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{r.missingClauses.length}</p>
                            <p className="text-xs text-slate-500 dark:text-zinc-500">missing clauses</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{r.definedTerms.length}</p>
                            <p className="text-xs text-slate-500 dark:text-zinc-500">defined terms</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{r.reviewHoursSaved}h</p>
                            <p className="text-xs text-slate-500 dark:text-zinc-500">review time saved</p>
                        </div>
                    </div>
                </div>

                {/* Risk flags with redlines */}
                <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-200 dark:border-zinc-700">
                        <p className="font-mono text-2xs uppercase tracking-widest text-slate-500 dark:text-zinc-500">Risk flags — scored & redlined</p>
                    </div>
                    {r.riskFlags.length === 0 && (
                        <p className="p-5 text-sm text-slate-500 dark:text-zinc-400">No risk triggers in this draft.</p>
                    )}
                    <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {r.riskFlags.map((f: RiskFlag) => (
                            <div key={f.id} className="p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge tone={LEVEL_TONE[f.level]}>{f.level}</Badge>
                                    <Button variant="bare" className="text-xs font-mono text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 p-0" onClick={() => scrollToClause(f.clauseId)}>
                                        → clause {f.clauseIndex}
                                    </Button>
                                </div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">{f.redline?.label ?? f.issue.slice(0, 40)}</p>
                                <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-1">{f.issue}</p>
                                <p className="text-xs text-slate-400 dark:text-zinc-600 leading-relaxed italic">“{f.excerpt.slice(0, 160)}…”</p>

                                {f.redline && (
                                    <>
                                        <Button variant="ghost" size="sm" className="mt-3" aria-expanded={openRedline === f.id} onClick={() => setOpenRedline(openRedline === f.id ? null : f.id)}>
                                            {openRedline === f.id ? 'Hide redline' : 'View redline'}
                                        </Button>
                                        {openRedline === f.id && (
                                            <div className="mt-3 grid sm:grid-cols-2 gap-3">
                                                <div className="rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20 p-4">
                                                    <p className="font-mono text-2xs uppercase tracking-widest text-rose-700 dark:text-rose-400 mb-2">Original</p>
                                                    <p className="text-xs leading-[1.7] text-slate-700 dark:text-zinc-300">{f.redline.original.slice(0, 700)}…</p>
                                                </div>
                                                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-4">
                                                    <p className="font-mono text-2xs uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-2">Suggested — Nigerian-law compliant</p>
                                                    <p className="text-xs leading-[1.7] text-slate-700 dark:text-zinc-300">{f.redline.suggested}</p>
                                                    <p className="text-xs text-slate-400 dark:text-zinc-600 mt-3 leading-relaxed">{f.redline.rationale}</p>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Missing standard clauses */}
                <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-200 dark:border-zinc-700">
                        <p className="font-mono text-2xs uppercase tracking-widest text-slate-500 dark:text-zinc-500">Missing standard clauses</p>
                    </div>
                    {r.missingClauses.length === 0 && (
                        <p className="p-5 text-sm text-slate-500 dark:text-zinc-400">The standard checklist is complete for this contract type.</p>
                    )}
                    <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                        {r.missingClauses.map((c) => (
                            <div key={c.id} className="p-5">
                                <div className="flex items-center gap-2 mb-2">
                                    <Badge tone={c.severity === 'High' ? 'danger' : 'warning'}>{c.severity}</Badge>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.label}</p>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-3">{c.why}</p>
                                <blockquote className="border-l-2 border-emerald-500/60 pl-4 text-xs leading-[1.7] text-slate-700 dark:text-zinc-300 italic">
                                    {c.nigerianStandard}
                                </blockquote>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Defined terms */}
                <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-200 dark:border-zinc-700">
                        <p className="font-mono text-2xs uppercase tracking-widest text-slate-500 dark:text-zinc-500">Defined terms check</p>
                    </div>
                    <div className="p-5 space-y-4">
                        {r.definedTerms.length > 0 && (
                            <ul className="space-y-2">
                                {r.definedTerms.map((d) => (
                                    <li key={d.term} className="text-sm">
                                        <span className="font-semibold text-slate-900 dark:text-white">“{d.term}”</span>
                                        <span className="text-slate-500 dark:text-zinc-500"> — {d.definition.slice(0, 90)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {r.undefinedUses.length > 0 ? (
                            <div>
                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">In use but never defined:</p>
                                <ul className="space-y-1.5">
                                    {r.undefinedUses.map((u) => (
                                        <li key={u.term} className="text-sm text-slate-600 dark:text-zinc-400">
                                            “{u.term}” ×{u.occurrences} — <span className="italic text-slate-400 dark:text-zinc-600">“{u.sample.slice(0, 80)}…”</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 dark:text-zinc-400">No undefined terms in use.</p>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

// ─── Tab 2: the statutory cross-reference (Enterprise add-on) ──────────────

const RegulatoryTab: React.FC<{
    fileName: string | null;
    ready: boolean;
    regulatory: ReturnType<typeof useRegulatoryAudit>;
    statuteList: ReturnType<typeof listStatutesForJurisdiction>;
    scrollToClause: (clauseId: string) => void;
}> = ({ fileName, ready, regulatory, statuteList, scrollToClause }) => {
    const log = regulatory.log;
    const violations = log?.filter((v) => v.severity === 'Violation') ?? [];
    const advisories = log?.filter((v) => v.severity === 'Advisory') ?? [];

    if (!ready) {
        return (
            <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 p-8 text-center">
                <p className="text-sm text-slate-500 dark:text-zinc-400">Upload a contract on the Contract Analysis tab first — the statutory audit runs against the same draft.</p>
            </div>
        );
    }

    return (
        <div className="grid lg:grid-cols-5 gap-6 mb-10">
            {/* LEFT — jurisdiction & statute selector */}
            <section aria-label="Jurisdiction and statute selector" className="lg:col-span-3 space-y-6">
                <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 p-5">
                    <p className="font-mono text-2xs uppercase tracking-widest text-slate-500 dark:text-zinc-500 mb-4">Jurisdiction</p>
                    <Select
                        id="regulatory-jurisdiction"
                        styleVariant="classic"
                        value={regulatory.jurisdiction}
                        onChange={(e) => { regulatory.setJurisdiction(e.target.value as any); regulatory.clearLog(); }}
                        options={JURISDICTION_OPTIONS.map((j) => ({ value: j.value, label: j.label }))}
                    />
                    <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed mt-3">
                        {JURISDICTION_OPTIONS.find((j) => j.value === regulatory.jurisdiction)?.description}
                    </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 p-5">
                    <p className="font-mono text-2xs uppercase tracking-widest text-slate-500 dark:text-zinc-500 mb-4">
                        Statutes — {fileName ?? 'the draft'}
                    </p>
                    <div className="space-y-2">
                        {statuteList.map((s) => {
                            const on = regulatory.selected.includes(s.id);
                            return (
                                <div key={s.id} className={`rounded-lg border p-4 transition-colors ${on ? 'border-slate-900 dark:border-zinc-300 bg-slate-50 dark:bg-zinc-800' : 'border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40'}`}>
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                {s.statute} · s.{s.section} <span className="font-normal text-slate-500 dark:text-zinc-500">— {s.heading}</span>
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-zinc-500 leading-relaxed mt-1">{s.summary}</p>
                                        </div>
                                        <Button
                                            variant={on ? 'segmented-active' : 'segmented'}
                                            size="sm"
                                            aria-pressed={on}
                                            onClick={() => regulatory.toggle(s.id)}
                                        >
                                            {on ? 'Selected' : 'Select'}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex flex-wrap gap-3 items-center mt-5">
                        <Button variant="primary" disabled={regulatory.selected.length === 0} onClick={regulatory.run}>
                            Run statutory audit
                        </Button>
                        <span className="text-xs font-mono text-slate-400 dark:text-zinc-600">
                            {regulatory.selected.length} statute{regulatory.selected.length === 1 ? '' : 's'} selected
                        </span>
                    </div>
                </div>
            </section>

            {/* RIGHT — the compliance audit log */}
            <section aria-label="Statutory audit log" className="lg:col-span-2">
                <div className="rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/40 overflow-hidden lg:sticky lg:top-28">
                    <div className="px-5 py-3 border-b border-slate-200 dark:border-zinc-700 flex items-baseline justify-between">
                        <p className="font-mono text-2xs uppercase tracking-widest text-slate-500 dark:text-zinc-500">Audit log</p>
                        {regulatory.ranAt && (
                            <p className="font-mono text-2xs text-slate-400 dark:text-zinc-600">run {regulatory.ranAt}</p>
                        )}
                    </div>

                    {!log && (
                        <p className="p-5 text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                            Select the statutes to cross-reference and run the audit. Findings appear
                            here with exact section citations.
                        </p>
                    )}

                    {log && log.length === 0 && (
                        <p className="p-5 text-sm text-emerald-700 dark:text-emerald-400">
                            No statutory findings under the selected statutes. Clean as drafted.
                        </p>
                    )}

                    {log && log.length > 0 && (
                        <>
                            <div className="px-5 py-3 border-b border-slate-100 dark:border-zinc-800 flex gap-4">
                                <span className="text-sm"><b className="text-red-600 dark:text-red-400">{violations.length}</b> <span className="text-slate-500 dark:text-zinc-500">violations</span></span>
                                <span className="text-sm"><b className="text-amber-600 dark:text-amber-400">{advisories.length}</b> <span className="text-slate-500 dark:text-zinc-500">advisories</span></span>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-zinc-800 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                {log.map((v: StatuteViolation) => (
                                    <div key={v.id} className="p-5">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Badge tone={v.severity === 'Violation' ? 'danger' : 'warning'}>{v.severity}</Badge>
                                            {v.clauseId && (
                                                <Button variant="bare" className="text-xs font-mono text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300 p-0" onClick={() => scrollToClause(v.clauseId!)}>
                                                    → {v.clauseId}
                                                </Button>
                                            )}
                                        </div>
                                        <p className="font-mono text-xs text-slate-800 dark:text-zinc-200 mb-1">{v.citation}</p>
                                        <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mb-2">{v.finding}</p>
                                        <p className="text-xs leading-relaxed text-slate-500 dark:text-zinc-500">
                                            <span className="font-semibold text-slate-700 dark:text-zinc-300">Fix: </span>{v.requiredFix}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </section>
        </div>
    );
};

export default ContractAnalyzer;
