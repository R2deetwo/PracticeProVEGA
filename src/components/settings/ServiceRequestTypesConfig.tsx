/**
 * ServiceRequestTypesConfig — Admin UI to manage the catalog of request
 * types that appear in the resident / client portal.
 *
 * Resident portal types: plumbing, electrical, structural, etc.
 * Client portal types: document review, meeting request, billing inquiry, etc.
 *
 * The firm's admin can:
 *  - Add a new type (with label, icon emoji, category, default priority)
 *  - Edit an existing type's label / icon / etc.
 *  - Disable (hide) a type without deleting it
 *  - Delete a type entirely
 *  - Seed the default catalog on first visit
 *
 * If the firm hasn't configured any types yet, the backend returns a sensible
 * default set (with `isDefault: true`) so the portal is never empty. The
 * admin can either edit those defaults in place (which persists them) or
 * click "Seed defaults" to bulk-persist them.
 */
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { useProduct } from '../../contexts/ProductContext';
import {
  TrashIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  CheckCircleIcon,
} from '../../constants';
import { ChevronUp as ChevronUpIcon, Plus as PlusIcon } from 'lucide-react';

type PortalType = 'resident' | 'client';

const PRIORITY_OPTIONS: Array<{ value: 'low' | 'medium' | 'high' | 'urgent'; label: string; color: string }> = [
  { value: 'low',    label: 'Low',    color: 'bg-slate-100 text-slate-700 dark:bg-zinc-700 dark:text-zinc-300' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'high',   label: 'High',   color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'urgent', label: 'Urgent', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' },
];

const CATEGORY_OPTIONS = [
  'maintenance',
  'legal',
  'administrative',
  'billing',
  'other',
];

// ─── Single Type Row ────────────────────────────────────────────────────────
const TypeRow: React.FC<{
  type: any;
  portalType: PortalType;
  onUpdate: (typeId: string, updates: any) => Promise<void>;
  onDelete: (typeId: string) => Promise<void>;
}> = ({ type, portalType, onUpdate, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [label, setLabel] = useState(type.label || '');
  const [icon, setIcon] = useState(type.icon || '');
  const [description, setDescription] = useState(type.description || '');
  const [category, setCategory] = useState(type.category || 'other');
  const [defaultPriority, setDefaultPriority] = useState(type.defaultPriority || 'medium');
  const [isActive, setIsActive] = useState(type.isActive !== false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset local state if the underlying type changes (e.g. after refetch)
  useEffect(() => {
    setLabel(type.label || '');
    setIcon(type.icon || '');
    setDescription(type.description || '');
    setCategory(type.category || 'other');
    setDefaultPriority(type.defaultPriority || 'medium');
    setIsActive(type.isActive !== false);
  }, [type]);

  const isDefault = type.isDefault === true;
  const id = String(type._id);

  const handleSave = async () => {
    if (isDefault) {
      // Can't patch a default (synthetic id) — caller will need to seed first.
      // We just return; the parent component shows a "Seed defaults" CTA.
      return;
    }
    setIsSaving(true);
    try {
      await onUpdate(id, {
        label,
        icon,
        description: description || undefined,
        category,
        defaultPriority,
        isActive,
      });
    } finally {
      setIsSaving(false);
      setIsExpanded(false);
    }
  };

  const handleDelete = async () => {
    if (isDefault) return;
    setIsDeleting(true);
    try {
      await onDelete(id);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleActive = async () => {
    const newVal = !isActive;
    setIsActive(newVal);
    if (!isDefault) {
      try {
        await onUpdate(id, { isActive: newVal });
      } catch (err) {
        setIsActive(!newVal); // revert on failure
      }
    }
  };

  return (
    <div className={`rounded-xl border ${isActive ? 'border-slate-200 dark:border-zinc-700' : 'border-slate-200 dark:border-zinc-700 opacity-60'} bg-white dark:bg-zinc-900 overflow-hidden`}>
      <div className="flex items-center gap-3 p-3">
        <span className="text-2xl flex-shrink-0 w-10 text-center">{icon || '📋'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-slate-800 dark:text-zinc-200 truncate">{label}</p>
            {isDefault && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400">
                Default
              </span>
            )}
            {!isActive && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
                Hidden
              </span>
            )}
            <span className="text-[10px] text-slate-400 dark:text-zinc-500">·</span>
            <span className="text-[10px] text-slate-500 dark:text-zinc-400">{category}</span>
          </div>
          {description && (
            <p className="text-xs text-slate-500 dark:text-zinc-400 truncate mt-0.5">{description}</p>
          )}
        </div>

        {/* Quick toggle: enable / disable */}
        <button
          onClick={toggleActive}
          disabled={isDefault}
          title={isActive ? 'Hide from portal' : 'Show in portal'}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${isActive ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-zinc-600'} ${isDefault ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
        >
          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>

        {/* Expand / collapse */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={isDefault}
          className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
          title={isExpanded ? 'Collapse' : 'Edit'}
        >
          {isExpanded ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && !isDefault && (
        <div className="border-t border-slate-100 dark:border-zinc-800 p-4 bg-slate-50/50 dark:bg-zinc-800/30 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Label</label>
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Icon (emoji)</label>
              <input
                value={icon}
                onChange={e => setIcon(e.target.value)}
                placeholder="🔧"
                maxLength={4}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Description (optional)</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Helper text shown under the label in the portal"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {CATEGORY_OPTIONS.map(c => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Default Priority</label>
              <select
                value={defaultPriority}
                onChange={e => setDefaultPriority(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              >
                {PRIORITY_OPTIONS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors disabled:opacity-50"
            >
              {isDeleting ? (
                <span className="w-3 h-3 border-2 border-rose-300 border-t-rose-600 rounded-full animate-spin" />
              ) : (
                <TrashIcon className="w-3.5 h-3.5" />
              )}
              Delete
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsExpanded(false)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !label.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                )}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── New Type Form ──────────────────────────────────────────────────────────
const NewTypeForm: React.FC<{
  portalType: PortalType;
  firmId: string;
  onCreated: () => void;
}> = ({ portalType, firmId, onCreated }) => {
  const createType = useMutation(api.portals.createServiceRequestType);
  const { addToast } = useUI();
  const [isOpen, setIsOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [icon, setIcon] = useState('📋');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(portalType === 'resident' ? 'maintenance' : 'legal');
  const [defaultPriority, setDefaultPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [isSaving, setIsSaving] = useState(false);

  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'custom';

  const reset = () => {
    setLabel('');
    setIcon('📋');
    setDescription('');
    setCategory(portalType === 'resident' ? 'maintenance' : 'legal');
    setDefaultPriority('medium');
    setIsOpen(false);
  };

  const handleSubmit = async () => {
    if (!label.trim()) {
      addToast('Please enter a label for the request type.', { type: 'info' });
      return;
    }
    setIsSaving(true);
    try {
      await createType({
        firmId,
        portalType,
        key: slugify(label),
        label: label.trim(),
        icon: icon || undefined,
        description: description || undefined,
        category,
        defaultPriority,
      });
      addToast(`Added "${label.trim()}" to the ${portalType} portal.`, { type: 'success' });
      reset();
      onCreated();
    } catch (err: any) {
      addToast(err.message || 'Failed to create request type.', { type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full px-4 py-2.5 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl text-sm font-semibold text-slate-500 dark:text-zinc-400 hover:border-emerald-400 dark:hover:border-emerald-600 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors inline-flex items-center justify-center gap-2"
      >
        <PlusIcon className="w-4 h-4" />
        Add Custom Request Type
      </button>
    );
  }

  return (
    <div className="rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50/30 dark:bg-emerald-900/10 p-4 space-y-3">
      <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200">New Request Type</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Label *</label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g., Plumbing, Document Review"
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Icon (emoji)</label>
          <input
            value={icon}
            onChange={e => setIcon(e.target.value)}
            placeholder="🔧"
            maxLength={4}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>
      </div>
      <div>
        <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Description (optional)</label>
        <input
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Helper text shown under the label in the portal"
          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Category</label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            {CATEGORY_OPTIONS.map(c => (
              <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Default Priority</label>
          <select
            value={defaultPriority}
            onChange={e => setDefaultPriority(e.target.value as any)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          >
            {PRIORITY_OPTIONS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          onClick={reset}
          className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSaving || !label.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <PlusIcon className="w-3.5 h-3.5" />
          )}
          Add Type
        </button>
      </div>
    </div>
  );
};

// ─── Main Export ────────────────────────────────────────────────────────────
export const ServiceRequestTypesConfig: React.FC<{ portalType: PortalType }> = ({ portalType }) => {
  const { currentUser } = useAuth();
  const { addToast } = useUI();
  const firmId = currentUser?.firmId || '';

  const allTypes = useQuery(
    api.portals.getAllServiceRequestTypes,
    firmId ? { firmId, portalType } : 'skip'
  );

  const updateType = useMutation(api.portals.updateServiceRequestType);
  const deleteType = useMutation(api.portals.deleteServiceRequestType);
  const seedDefaults = useMutation(api.portals.seedDefaultServiceRequestTypes);
  const [isSeeding, setIsSeeding] = useState(false);
  // Collapsed by default — the summary line shows the count + active types.
  // Expanding reveals the full management UI (edit/hide/delete/add).
  // This keeps the Settings page tidy instead of showing a long list of rows.
  const [isExpanded, setIsExpanded] = useState(false);

  const hasPersistedTypes = (allTypes || []).some((t: any) => !t.isDefault);
  const hasOnlyDefaults = !hasPersistedTypes && (allTypes || []).length > 0;
  const activeCount = (allTypes || []).filter((t: any) => t.isActive !== false).length;
  const totalCount = (allTypes || []).length;

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await seedDefaults({ firmId, portalType });
      addToast(`Default ${portalType} request types seeded. You can now edit them.`, { type: 'success' });
    } catch (err: any) {
      addToast(err.message || 'Failed to seed defaults.', { type: 'error' });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleUpdate = async (typeId: string, updates: any) => {
    try {
      await updateType({ typeId: typeId as any, ...updates });
      addToast('Updated.', { type: 'success' });
    } catch (err: any) {
      addToast(err.message || 'Failed to update.', { type: 'error' });
      throw err;
    }
  };

  const handleDelete = async (typeId: string) => {
    try {
      await deleteType({ typeId: typeId as any });
      addToast('Request type deleted. (Portal users will no longer see it.)', { type: 'success' });
    } catch (err: any) {
      addToast(err.message || 'Failed to delete.', { type: 'error' });
      throw err;
    }
  };

  const portalLabel = portalType === 'resident' ? 'Resident' : 'Client';
  const portalIcon = portalType === 'resident' ? '🏠' : '⚖️';

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
      {/* Summary header — always visible. Click to expand/collapse. */}
      <button
        onClick={() => setIsExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl flex-shrink-0">{portalIcon}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-200">
              {portalLabel} Portal — Service Request Types
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5 truncate">
              {totalCount === 0
                ? 'No types configured yet'
                : `${activeCount} active of ${totalCount} total — tap to manage`}
            </p>
          </div>
        </div>
        {/* Quick preview chips — show first 3 active types */}
        {!isExpanded && totalCount > 0 && (
          <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
            {(allTypes || []).filter((t: any) => t.isActive !== false).slice(0, 3).map((t: any) => (
              <span key={t._id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300">
                <span>{t.icon || '📋'}</span>
                {t.label}
              </span>
            ))}
            {activeCount > 3 && (
              <span className="text-[10px] text-slate-400">+{activeCount - 3} more</span>
            )}
          </div>
        )}
        <svg
          className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded management UI */}
      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-zinc-800 p-4 space-y-3">
          <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
            Choose what {portalLabel.toLowerCase()}s can pick from when submitting a request. Each option creates a ticket
            that surfaces in your Conversations inbox. Adding a new type automatically posts a pinned notice to the portal's
            notice board so {portalLabel.toLowerCase()}s are gently notified.
          </p>

          {hasOnlyDefaults && (
            <div className="px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-amber-800 dark:text-amber-300 font-medium flex-1 min-w-[200px]">
                These are sensible defaults. Click "Seed & Edit" to persist them and start customizing.
              </p>
              <button
                onClick={handleSeed}
                disabled={isSeeding}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {isSeeding ? (
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <ArrowPathIcon className="w-3.5 h-3.5" />
                )}
                Seed &amp; Edit
              </button>
            </div>
          )}

          <div className="space-y-2">
            {(allTypes || []).map((t: any) => (
              <TypeRow
                key={t._id}
                type={t}
                portalType={portalType}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
            {allTypes && allTypes.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-4">No request types yet.</p>
            )}
          </div>

          {hasPersistedTypes && (
            <NewTypeForm
              portalType={portalType}
              firmId={firmId}
              onCreated={() => {/* Convex query auto-refreshes */}}
            />
          )}
        </div>
      )}
    </div>
  );
};
