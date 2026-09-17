import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { Plus, Link2, Download, X, ChevronDown } from 'lucide-react';
import {
  RelationshipTypeOption,
  SYSTEM_RELATIONSHIP_TYPES,
  CONSENT_STATUSES,
  CONSIDERATION_FREQUENCIES,
  STATUS_STYLES,
  CONSENT_STYLES,
  LEGAL_NATURE_LABELS,
} from '../../utils/relationshipTypes';

/**
 * PropertyRelationshipsTab — Atrium property use-relationship ontology UI
 * (Task 52). Tracks every legal relationship over a property — tenancies,
 * subleases, licenses, easements, mortgages, customary tenancies/pledges,
 * caretakers, co-ownership, pending sales, assignments (with Governor's
 * consent tracking), trusts and management agencies — plus firm-defined
 * custom types, all through the same registry-validated machinery.
 *
 * Existing tenancies import on demand (idempotent) — no forced migration.
 */

interface RelationshipRow {
  _id: string;
  propertyId: string;
  unitId: string | null;
  typeKey: string;
  typeLabel: string;
  legalNature: string | null;
  grantorRole: string;
  granteeRole: string;
  requiresGovernorConsent: boolean;
  status: string;
  grantorContactId: string | null;
  granteeContactId: string | null;
  grantorName: string | null;
  granteeName: string | null;
  startDate: string | null;
  endDate: string | null;
  considerationAmount: number | null;
  considerationFrequency: string | null;
  drivesRentLedger: boolean;
  consentStatus: string;
  consentReference: string | null;
  notes: string | null;
  source: string;
}

interface Props {
  /** Convex document ID of the ROOT property (relationships are keyed on it). */
  propertyConvexId: string;
  /** Units of the property (for unit scoping + name resolution). */
  units: { id: string; unitName: string; tenantName?: string }[];
}

const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const fmtMoney = (n?: number | null) =>
  n != null ? `₦${Number(n).toLocaleString('en-NG')}` : null;

const consentLabel = (s: string) =>
  s === 'not_required' ? 'Consent n/a' :
  s === 'not_applied' ? 'Consent pending' :
  s === 'applied' ? 'Consent applied' :
  s === 'approved' ? 'Consent approved' : 'Consent rejected';

export const PropertyRelationshipsTab: React.FC<Props> = ({ propertyConvexId, units }) => {
  const { currentUser, bearerToken } = useAuth();
  const { addToast } = useUI();
  const firmId = currentUser?.firmId || '';

  const auth = { userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) || undefined };

  const registry = useQuery(
    api.propertyRelationships.getRelationshipTypes,
    firmId ? { firmId, ...auth } : 'skip'
  ) as RelationshipTypeOption[] | undefined;

  const [includeEnded, setIncludeEnded] = useState(false);
  const relationships = useQuery(
    api.propertyRelationships.getRelationships,
    firmId && propertyConvexId ? { firmId, propertyId: propertyConvexId, includeEnded, ...auth } : 'skip'
  ) as RelationshipRow[] | undefined;

  const createRel = useMutation(api.propertyRelationships.createRelationship);
  const updateRel = useMutation(api.propertyRelationships.updateRelationship);
  const endRel = useMutation(api.propertyRelationships.endRelationship);
  const importTenancies = useMutation(api.propertyRelationships.importTenanciesAsRelationships);

  const allTypes = registry ?? SYSTEM_RELATIONSHIP_TYPES;

  // ── Create form state ─────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    typeKey: 'tenancy',
    unitId: '',
    grantorName: '',
    granteeName: '',
    startDate: '',
    endDate: '',
    considerationAmount: '',
    considerationFrequency: 'monthly',
    consentStatus: 'not_required',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const selectedType = allTypes.find((t) => t.key === form.typeKey);

  const handleCreate = async () => {
    if (!selectedType) return;
    if (!form.grantorName.trim() && !form.granteeName.trim()) {
      addToast('Name at least one party.', { type: 'error' });
      return;
    }
    setSaving(true);
    try {
      await createRel({
        firmId,
        propertyId: propertyConvexId,
        unitId: form.unitId || undefined,
        typeKey: form.typeKey,
        grantorName: form.grantorName.trim() || undefined,
        granteeName: form.granteeName.trim() || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        considerationAmount: form.considerationAmount ? parseFloat(form.considerationAmount) : undefined,
        considerationFrequency: form.considerationAmount ? form.considerationFrequency : undefined,
        consentStatus: form.consentStatus,
        notes: form.notes.trim() || undefined,
        ...auth,
      });
      addToast(`${selectedType.label} added.`, { type: 'success' });
      setShowForm(false);
      setForm((f) => ({ ...f, grantorName: '', granteeName: '', considerationAmount: '', notes: '' }));
    } catch (e: any) {
      addToast(e?.message || 'Could not save the relationship.', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res: any = await importTenancies({ firmId, ...auth });
      addToast(res?.message || 'Tenancy import complete.', { type: 'success' });
    } catch (e: any) {
      addToast(e?.message || 'Import failed.', { type: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const setConsent = async (rel: RelationshipRow, consentStatus: string) => {
    try {
      await updateRel({ firmId, relationshipId: rel._id, patch: { consentStatus }, ...auth });
    } catch (e: any) {
      addToast(e?.message || 'Update failed.', { type: 'error' });
    }
  };

  const setStatus = async (rel: RelationshipRow, status: string) => {
    try {
      if (['terminated', 'expired', 'redeemed'].includes(status)) {
        await endRel({ firmId, relationshipId: rel._id, endStatus: status as any, ...auth });
      } else {
        await updateRel({ firmId, relationshipId: rel._id, patch: { status }, ...auth });
      }
    } catch (e: any) {
      addToast(e?.message || 'Update failed.', { type: 'error' });
    }
  };

  const unitName = (unitId?: string | null) =>
    unitId ? (units.find((u) => u.id === unitId)?.unitName ?? unitId) : null;

  const hasImported = (relationships ?? []).some((r) => r.source.startsWith('imported'));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Property Use Relationships
          </h3>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
            Tenancies, licenses, easements, mortgages, customary interests, co-ownership,
            assignments &amp; more — with Governor&rsquo;s consent (Land Use Act s.22) tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!hasImported && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-300 dark:border-zinc-600 text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> {importing ? 'Importing…' : 'Import existing tenancies'}
            </button>
          )}
          <button
            onClick={() => setShowForm((s) => !s)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-primary-600 text-white hover:bg-primary-700 flex items-center gap-1.5"
          >
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showForm ? 'Cancel' : 'Add relationship'}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Relationship type</span>
              <select
                value={form.typeKey}
                onChange={(e) => {
                  const key = e.target.value;
                  const t = allTypes.find((x) => x.key === key);
                  setForm((f) => ({
                    ...f,
                    typeKey: key,
                    consentStatus: t?.requiresGovernorConsent ? 'not_applied' : 'not_required',
                    considerationFrequency: t?.drivesRentLedger ? 'monthly' : 'one_off',
                  }));
                }}
                className="mt-1 w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2.5 py-2 text-slate-900 dark:text-white"
              >
                {allTypes.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}{t.isSystem ? '' : ' (custom)'}
                  </option>
                ))}
              </select>
              {selectedType && (
                <span className="block mt-1 text-2xs text-slate-400 dark:text-zinc-500">
                  {LEGAL_NATURE_LABELS[selectedType.legalNature]} · {selectedType.lawBasis}
                </span>
              )}
            </label>

            {units.length > 0 && (
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Unit (optional)</span>
                <select
                  value={form.unitId}
                  onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}
                  className="mt-1 w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2.5 py-2 text-slate-900 dark:text-white"
                >
                  <option value="">Whole property</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.unitName}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                {selectedType?.grantorRole || 'Grantor'} (owner side)
              </span>
              <input
                value={form.grantorName}
                onChange={(e) => setForm((f) => ({ ...f, grantorName: e.target.value }))}
                placeholder={selectedType?.grantorRole || 'Grantor name'}
                className="mt-1 w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2.5 py-2 text-slate-900 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                {selectedType?.granteeRole || 'Grantee'} (right-holder side)
              </span>
              <input
                value={form.granteeName}
                onChange={(e) => setForm((f) => ({ ...f, granteeName: e.target.value }))}
                placeholder={selectedType?.granteeRole || 'Grantee name'}
                className="mt-1 w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2.5 py-2 text-slate-900 dark:text-white"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Start date</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className="mt-1 w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2.5 py-2 text-slate-900 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                End / redemption date {selectedType?.legalNature === 'security_interest' ? '(redemption)' : '(optional)'}
              </span>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className="mt-1 w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2.5 py-2 text-slate-900 dark:text-white"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">
                Consideration (₦) — rent, fee or secured amount
              </span>
              <input
                inputMode="decimal"
                value={form.considerationAmount}
                onChange={(e) => setForm((f) => ({ ...f, considerationAmount: e.target.value.replace(/[^0-9.]/g, '') }))}
                placeholder="e.g. 1500000"
                className="mt-1 w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2.5 py-2 text-slate-900 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Frequency</span>
              <select
                value={form.considerationFrequency}
                onChange={(e) => setForm((f) => ({ ...f, considerationFrequency: e.target.value }))}
                className="mt-1 w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2.5 py-2 text-slate-900 dark:text-white"
              >
                {CONSIDERATION_FREQUENCIES.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </label>

            {selectedType?.requiresGovernorConsent && (
              <label className="block sm:col-span-2">
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Governor&rsquo;s consent (Land Use Act s.22) — required for this relationship type
                </span>
                <select
                  value={form.consentStatus}
                  onChange={(e) => setForm((f) => ({ ...f, consentStatus: e.target.value }))}
                  className="mt-1 w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2.5 py-2 text-slate-900 dark:text-white"
                >
                  {CONSENT_STATUSES.map((s) => (
                    <option key={s} value={s}>{consentLabel(s)}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="block sm:col-span-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">Notes</span>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Terms, registered documents, tribute arrangements…"
                className="mt-1 w-full text-sm rounded-lg border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-2.5 py-2 text-slate-900 dark:text-white"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleCreate}
              disabled={saving || !selectedType}
              className="px-4 py-2 text-sm font-bold rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save relationship'}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {!relationships ? (
        <div className="text-sm text-slate-400 dark:text-zinc-500 py-8 text-center">Loading relationships…</div>
      ) : relationships.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-zinc-400 py-10 text-center border border-dashed border-slate-300 dark:border-zinc-700 rounded-xl">
          No relationships recorded yet.
          <br />
          <span className="text-xs">Import your existing tenancies or add any relationship — license, easement, mortgage, co-ownership…</span>
        </div>
      ) : (
        <div className="space-y-2.5">
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-zinc-400 justify-end">
            <input
              type="checkbox"
              checked={includeEnded}
              onChange={(e) => setIncludeEnded(e.target.checked)}
              className="rounded border-slate-300"
            />
            Show ended relationships
          </label>
          {relationships.map((rel) => {
            const type = allTypes.find((t) => t.key === rel.typeKey);
            return (
              <div
                key={rel._id}
                className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl p-3.5"
              >
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{rel.typeLabel}</span>
                      <span className={`px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wide ${STATUS_STYLES[rel.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {rel.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-2xs font-bold ${CONSENT_STYLES[rel.consentStatus] ?? ''}`}>
                        {consentLabel(rel.consentStatus)}
                      </span>
                      {unitName(rel.unitId) && (
                        <span className="px-2 py-0.5 rounded-full text-2xs font-semibold bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300">
                          {unitName(rel.unitId)}
                        </span>
                      )}
                      {rel.source.startsWith('imported') && (
                        <span className="text-2xs text-slate-400 dark:text-zinc-500 italic">imported</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-zinc-300 mt-1">
                      <span className="font-semibold">{rel.grantorRole}:</span> {rel.grantorName || '—'}
                      <span className="mx-1.5 text-slate-300 dark:text-zinc-600">↔</span>
                      <span className="font-semibold">{rel.granteeRole}:</span> {rel.granteeName || '—'}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500 dark:text-zinc-400">
                    <div>{fmtDate(rel.startDate)} → {fmtDate(rel.endDate)}</div>
                    <div className="font-semibold text-slate-700 dark:text-zinc-200">
                      {fmtMoney(rel.considerationAmount)}
                      {rel.considerationAmount != null && rel.considerationFrequency
                        ? ` / ${CONSIDERATION_FREQUENCIES.find((f) => f.key === rel.considerationFrequency)?.label ?? rel.considerationFrequency}`
                        : ''}
                    </div>
                  </div>
                </div>

                {rel.notes && (
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 whitespace-pre-line">{rel.notes}</p>
                )}

                {/* Inline actions */}
                <div className="flex flex-wrap items-center gap-2 mt-2.5 pt-2.5 border-t border-slate-100 dark:border-zinc-700">
                  {type?.requiresGovernorConsent && (
                    <select
                      value={rel.consentStatus}
                      onChange={(e) => setConsent(rel, e.target.value)}
                      className="text-2xs font-semibold rounded-md border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-1.5 py-1 text-slate-600 dark:text-zinc-300"
                    >
                      {CONSENT_STATUSES.map((s) => (
                        <option key={s} value={s}>{consentLabel(s)}</option>
                      ))}
                    </select>
                  )}
                  <div className="flex items-center gap-1 ml-auto">
                    <select
                      value={rel.status}
                      onChange={(e) => setStatus(rel, e.target.value)}
                      className="text-2xs font-semibold rounded-md border border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 px-1.5 py-1 text-slate-600 dark:text-zinc-300"
                    >
                      {['pending', 'active', 'disputed', 'expired', 'terminated', 'redeemed'].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ontology legend */}
      <details className="text-xs text-slate-500 dark:text-zinc-400">
        <summary className="cursor-pointer font-semibold flex items-center gap-1 select-none">
          <ChevronDown className="w-3.5 h-3.5" /> What relationship types exist? ({allTypes.length})
        </summary>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-1">
          {allTypes.map((t) => (
            <div key={t.key} className="flex gap-2">
              <span className="font-semibold text-slate-600 dark:text-zinc-300 whitespace-nowrap">{t.label}</span>
              <span className="text-slate-400 dark:text-zinc-500">{LEGAL_NATURE_LABELS[t.legalNature]}{t.requiresGovernorConsent ? ' · consent' : ''}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-2xs text-slate-400 dark:text-zinc-500">
          Need another type (e.g. &ldquo;Church Lease — Sunday use only&rdquo;)? Custom relationship types can be
          added by your firm and tracked exactly like these.
        </p>
      </details>
    </div>
  );
};

export default PropertyRelationshipsTab;
