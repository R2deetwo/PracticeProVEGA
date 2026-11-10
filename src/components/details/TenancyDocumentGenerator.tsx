/**
 * TenancyDocumentGenerator — ROUND E (Wave E4): generate tenancy documents
 * from existing templates, pre-filled from the ledger.
 * ─────────────────────────────────────────────────────────────────────────
 * The owner brief (§4) asks for template document generation as a workflow
 * affordance. Mounted per-tenancy inside TenancyLifecyclePanel (both the
 * active row and every history row), it:
 *
 *   1. Lists the firm's OWN templates (Settings → Templates) first; when
 *      the firm has none it falls back to BUILT_IN_PROPERTY_TEMPLATES —
 *      a fresh Atrium firm can generate its first agreement immediately.
 *   2. Builds the {{token}} context from the ledger row + unit + property
 *      (buildTenancyTemplateContext — NEVER re-typing facts the ledger
 *      already knows).
 *   3. Previews the substituted document with unfilled [FILL: …] markers
 *      listed up top, so the manager sees exactly what is missing.
 *   4. "Open in editor" hands the filled draft to the REAL DocumentForm
 *      through the E3 propertyId pipeline (openModal('newDocument', …,
 *      { draftTitle, draftContent, propertyId })) — saving, categorising
 *      and analysis all reuse the existing document flow.
 *
 * Conventions honored here:
 *   - ui/ primitives ONLY (Select/Button/Card/Badge) — ADR-0004 ratchet.
 *   - Read-only against the ledger: generation never writes tenancy data;
 *     the only write is the document the manager explicitly saves.
 */

import React, { useMemo, useState } from 'react';
import { Button, Select, Badge } from '../ui';
import { useUI } from '../../contexts/UIContext';
import {
    BUILT_IN_PROPERTY_TEMPLATES,
    PropertyDocumentTemplate,
    buildTenancyTemplateContext,
    fillTemplate,
    templateTokens,
    TenancyTemplateInput,
} from '../../utils/tenancyDocumentGeneration';
import { FileText, AlertTriangle, ExternalLink } from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface GeneratorTemplate extends PropertyDocumentTemplate {
    /** Where this template comes from (label in the picker). */
    source: 'firm' | 'builtin';
}

export interface TenancyDocumentGeneratorProps {
    /** Ledger row (active or history) supplying the tenancy facts. */
    tenancy: {
        tenantName?: string | null;
        tenantPhone?: string | null;
        tenantEmail?: string | null;
        leaseStart?: string | null;
        startDate?: string | null;
        endDate?: string | null;
        leaseEnd?: string | null;
        rentAmount?: number | null;
        paymentFrequency?: string | null;
        rentFrequency?: string | null;
        cautionDeposit?: number | null;
        emergencyContactName?: string | null;
        emergencyContactPhone?: string | null;
        emergencyContactRelationship?: string | null;
    };
    unitLabel: string;
    propertyAddress: string;
    propertyId: string;
    firmName: string;
    firmState?: string | null;
    /** The firm's own templates (coreState.documentTemplates). */
    firmTemplates?: { id: string; name?: string | null; content?: string | null; categoryId?: string | null }[];
    /** Outstanding balance on the unit, when already computed. */
    outstandingBalance?: number | null;
    /** Extra tokens (e.g. a renewal's new end date). */
    extras?: Record<string, string>;
    onDone?: () => void;
}

/** Map a ledger row (active vs history field spellings) to the pure input. */
function toTemplateInput(props: TenancyDocumentGeneratorProps): TenancyTemplateInput {
    const t = props.tenancy || {};
    return {
        tenantName: t.tenantName ?? null,
        tenantPhone: t.tenantPhone ?? null,
        tenantEmail: t.tenantEmail ?? null,
        unitLabel: props.unitLabel,
        propertyAddress: props.propertyAddress,
        leaseStart: t.leaseStart ?? t.startDate ?? null,
        leaseEnd: t.leaseEnd ?? t.endDate ?? null,
        rentAmount: t.rentAmount ?? null,
        rentFrequency: t.rentFrequency ?? t.paymentFrequency ?? null,
        cautionDeposit: t.cautionDeposit ?? null,
        emergencyContactName: t.emergencyContactName ?? null,
        emergencyContactPhone: t.emergencyContactPhone ?? null,
        emergencyContactRelationship: t.emergencyContactRelationship ?? null,
        outstandingBalance: props.outstandingBalance ?? null,
        firmName: props.firmName,
        firmState: props.firmState ?? null,
        extras: props.extras,
    };
}

export const TenancyDocumentGenerator: React.FC<TenancyDocumentGeneratorProps> = (props) => {
    const { openModal } = useUI();

    const templates = useMemo<GeneratorTemplate[]>(() => {
        const firm = (props.firmTemplates || [])
            .filter((t) => t && String(t.name || '').trim() && String(t.content || '').trim())
            .map((t) => ({
                id: String(t.id),
                name: String(t.name),
                description: 'Your firm template',
                content: String(t.content),
                source: 'firm' as const,
            }));
        const builtin = BUILT_IN_PROPERTY_TEMPLATES.map((t) => ({ ...t, source: 'builtin' as const }));
        return [...firm, ...builtin];
    }, [props.firmTemplates]);

    const [selectedId, setSelectedId] = useState<string>(templates[0]?.id ?? '');
    const selected = templates.find((t) => t.id === selectedId) ?? templates[0];

    const filled = useMemo(() => {
        if (!selected) return null;
        const context = buildTenancyTemplateContext(toTemplateInput(props));
        return fillTemplate(selected.content, context);
    }, [selected, props]);

    const openInEditor = () => {
        if (!selected || !filled) return;
        // The modal pipeline (ModalManager 'newDocument') accepts
        // draftTitle/draftContent/propertyId — the E3 property-document
        // link stamps propertyId on the saved row.
        openModal('newDocument', null, {
            draftTitle: `${selected.name} — ${props.tenancy?.tenantName || 'Resident'} — ${props.unitLabel}`,
            draftContent: filled.content,
            propertyId: props.propertyId,
        });
        props.onDone?.();
    };

    if (!selected || !filled) return null;

    return (
        <div className="rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 space-y-3" data-testid="tenancy-doc-generator">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-2xs font-bold text-slate-700 dark:text-zinc-200 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary-500" />
                    Generate document
                </p>
                <Badge tone="outline" size="xs">{selected.source === 'firm' ? 'Firm template' : 'Built-in template'}</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select
                    label="Template"
                    value={selected.id}
                    onChange={(e) => setSelectedId(e.target.value)}
                    options={templates.map((t) => ({
                        value: t.id,
                        label: t.source === 'firm' ? `${t.name} (firm)` : t.name,
                    }))}
                    selectClassName="!py-1.5 text-xs"
                />
                <div className="flex items-end">
                    <Button
                        size="sm"
                        variant="primary"
                        icon={ExternalLink}
                        onClick={openInEditor}
                        title="Open the filled draft in the document editor (nothing is saved until you save it there)"
                    >
                        Open in editor
                    </Button>
                </div>
            </div>

            {filled.unfilledKeys.length > 0 && (
                <p className="text-2xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                        Not on file: {filled.unfilledKeys.join(', ')} — these appear as{' '}
                        <span className="font-mono">[FILL: …]</span> markers in the draft for you to complete.
                    </span>
                </p>
            )}

            <div className="text-2xs text-slate-400 dark:text-zinc-500">
                Tokens used by this template: {templateTokens(selected.content).join(', ') || '—'}
            </div>

            {/* Read-only preview of the substituted draft */}
            <div
                className="max-h-64 overflow-y-auto rounded-md border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900/60 p-3 text-xs leading-relaxed text-slate-700 dark:text-zinc-300 [&_p]:mb-2"
                dangerouslySetInnerHTML={{ __html: filled.content }}
            />
        </div>
    );
};

export default TenancyDocumentGenerator;
