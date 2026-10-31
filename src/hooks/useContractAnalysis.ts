/**
 * useContractAnalysis — the state machine behind the DraftPro Contract
 * Analyzer workspace (R48).
 *
 * Owns the ingest → extract → analyze lifecycle for MODULE 1 (standard
 * contract analysis) and exposes the doc-type switch (re-analysis is
 * synchronous and instant). Extraction failures surface as phase 'error'
 * with a user-actionable message; nothing is thrown to the boundary.
 */

import { useCallback, useMemo, useState } from 'react';
import {
    analyzeContract,
    detectDocType,
    DOC_TYPE_OPTIONS,
    type ContractAnalysisResult,
    type ContractDocType,
} from '../utils/contractAnalysis';
import { extractContractText } from '../utils/contractTextExtractor';
import { splitClauses } from '../utils/contractAnalysis';

export type AnalysisPhase = 'idle' | 'extracting' | 'analyzing' | 'ready' | 'error';

export function useContractAnalysis() {
    const [phase, setPhase] = useState<AnalysisPhase>('idle');
    const [fileName, setFileName] = useState<string | null>(null);
    const [fileKind, setFileKind] = useState<'pdf' | 'docx' | 'txt' | null>(null);
    const [rawText, setRawText] = useState('');
    const [docType, setDocTypeState] = useState<ContractDocType | 'auto'>('auto');
    const [result, setResult] = useState<ContractAnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Clause list for the document viewer — memoized; splitClauses walks the
    // whole text and this hook re-renders on every phase/flag interaction.
    const clauses = useMemo(() => (rawText ? splitClauses(rawText) : []), [rawText]);

    const effectiveDocType: ContractDocType = useMemo(
        () => (docType === 'auto' ? detectDocType(rawText) : docType),
        [docType, rawText],
    );

    const runAnalysis = useCallback((text: string, type: ContractDocType) => {
        // 'analyzing' is a real (if brief) phase today; when the backend
        // lands, this is where the API call goes.
        setPhase('analyzing');
        setResult(analyzeContract(text, type));
        setPhase('ready');
    }, []);

    const ingest = useCallback(async (file: File) => {
        setError(null);
        setFileName(file.name);
        setPhase('extracting');
        try {
            const { text, kind } = await extractContractText(file);
            if (!text.trim()) throw new Error('The file appears to be empty.');
            setFileKind(kind);
            setRawText(text);
            const detected = detectDocType(text);
            setDocTypeState('auto');
            runAnalysis(text, detected);
        } catch (e: any) {
            setPhase('error');
            setError(e?.message || 'Could not read this file.');
            setResult(null);
            setRawText('');
        }
    }, [runAnalysis]);

    const setDocType = useCallback((t: ContractDocType | 'auto') => {
        setDocTypeState(t);
        if (!rawText) return;
        runAnalysis(rawText, t === 'auto' ? detectDocType(rawText) : t);
    }, [rawText, runAnalysis]);

    const reset = useCallback(() => {
        setPhase('idle');
        setFileName(null);
        setFileKind(null);
        setRawText('');
        setResult(null);
        setError(null);
        setDocTypeState('auto');
    }, []);

    return {
        phase, fileName, fileKind, rawText, docType, effectiveDocType,
        result, error,
        docTypeOptions: DOC_TYPE_OPTIONS,
        clauses,
        ingest, setDocType, reset,
    };
}

/**
 * useRegulatoryAudit — MODULE 2's state (the Enterprise add-on):
 * jurisdiction + statute selection, and the audit log once run.
 * The audit itself is pure (statuteLibrary.runRegulatoryAudit); the hook
 * exists so the workspace's gate + selection UI stays one concern.
 */

import { runRegulatoryAudit, type StatuteViolation, type StatuteJurisdiction } from '../utils/statuteLibrary';

export function useRegulatoryAudit(rawText: string, docType: ContractDocType) {
    const [jurisdiction, setJurisdiction] = useState<StatuteJurisdiction>('federal');
    const [selected, setSelected] = useState<string[]>([]);
    const [log, setLog] = useState<StatuteViolation[] | null>(null);
    const [ranAt, setRanAt] = useState<string | null>(null);

    const toggle = useCallback((id: string) => {
        setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
        setLog(null);
    }, []);

    const run = useCallback(() => {
        const clauses = splitClauses(rawText).map(({ id, text }) => ({ id, text }));
        setLog(runRegulatoryAudit(clauses, docType, selected));
        setRanAt(new Date().toISOString().slice(0, 19).replace('T', ' '));
    }, [rawText, docType, selected]);

    const clearLog = useCallback(() => { setLog(null); setRanAt(null); }, []);

    return { jurisdiction, setJurisdiction, selected, toggle, log, ranAt, run, clearLog };
}
