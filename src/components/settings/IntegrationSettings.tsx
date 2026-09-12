import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useCoreState } from '../../contexts/CoreContext';
import { useUI } from '../../contexts/UIContext';
import { useAuth } from '../../contexts/AuthContext';
import { useMutation, useConvex, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { translateError } from '../../utils/errorTranslator';
import { MSG_TYPE_LABELS } from '../../utils/messageTypes';
import { FirmTemplateMapping, TemplateVarField } from '../../utils/deliveryErrors';
import { RefreshCw, Send, Trash2 } from 'lucide-react';

const WhatsAppIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

// Message types that make sense to map to a WhatsApp template. `custom` is
// excluded — a custom message has no stable content to map variables to.
const MAPPABLE_TYPES = [
  'rent_reminder', 'late_notice', 'payment_receipt', 'service_charge_alert',
  'access_restriction', 'penalty_notice', 'lease_renewal', 'welcome_note',
  'promotion', 'vendor_update', 'general_announcement', 'maintenance_update',
] as const;

const VAR_FIELD_LABELS: Record<string, string> = {
  tenantName: 'Tenant name',
  amount: 'Rent amount',
  totalPayable: 'Total payable',
  serviceCharge: 'Service charge',
  address: 'Unit / address',
  firmName: 'Firm name',
  dueDate: 'Due date',
  messageText: 'Message text',
};

const LANGUAGES = ['en', 'en_US', 'en_GB', 'fr', 'pt_BR', 'es', 'hi', 'id', 'pt'];

interface TemplateDoc {
  _id: string;
  name: string;
  language: string;
  status: string;
  category?: string;
  bodyText?: string;
  variableCount?: number;
  metaId?: string;
  syncedAt: number;
}

const IntegrationSettings: React.FC = () => {
  const { coreState } = useCoreState();
  const { addToast } = useUI();
  const { currentUser, bearerToken } = useAuth();
  const convex = useConvex();
  const updateFirm = useMutation(api.myFunctions.updateFirmSettings);

  const config = coreState.firmDetails?.automationSettings?.chakra || { isActive: false };
  const [editingConfig, setEditingConfig] = useState(config);
  const [isSaving, setIsSaving] = useState(false);

  const authArgs = currentUser?.email && bearerToken
    ? { sessionToken: bearerToken, userEmail: currentUser.email }
    : null;

  // ── Template registry (synced from Meta) + firm mappings ──────────────
  const templates = (useQuery(
    api.whatsappTemplates.getWhatsAppTemplates,
    authArgs ?? 'skip'
  ) ?? undefined) as TemplateDoc[] | undefined;
  const mappings = (useQuery(
    api.whatsappTemplates.getWhatsAppTemplateMappings,
    authArgs ?? 'skip'
  ) ?? undefined) as FirmTemplateMapping[] | undefined;
  const saveMapping = useMutation(api.whatsappTemplates.saveWhatsAppTemplateMapping);
  const deleteMapping = useMutation(api.whatsappTemplates.deleteWhatsAppTemplateMapping);
  // Connection snapshot: the REAL sending number + WABA, verified live from
  // the gateway at the last sync (replaces the placeholder inputs).
  const waSettings = useQuery(
    api.whatsappTemplates.getWhatsAppSettings,
    authArgs ?? 'skip'
  );

  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const autoSyncRan = useRef(false);
  const [expandedMap, setExpandedMap] = useState<string | null>(null);

  // Per-type edit state (seeded from the saved mapping)
  const [mapEdits, setMapEdits] = useState<Record<string, { templateName: string; templateLanguage: string; varOrder: string[] }>>({});
  const [savingType, setSavingType] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState<string>('');
  const [testResult, setTestResult] = useState<{ type: string; success: boolean; raw?: string; error?: string } | null>(null);

  const status = config?.isActive ? 'connected' : 'not_configured';

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateFirm({
        firmId: coreState.firmDetails?.id || '',
        settings: {
          automationSettings: {
            ...coreState.firmDetails?.automationSettings,
            chakra: editingConfig,
            provider: editingConfig.isActive ? 'chakra' : 'manual'
          }
        }
      });
      addToast('Integration settings updated', { type: 'success' });
    } catch (e: any) {
      addToast(translateError(e, "save settings"), { type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Sync: pull the firm's REAL templates from Meta via Chakra ────────
  const handleSync = async () => {
    if (!authArgs) { addToast('Sign in to sync templates.', { type: 'error' }); return; }
    setSyncing(true); setSyncError(null); setSyncInfo(null);
    try {
      const res = await convex.action(api.whatsappTemplates.syncWhatsAppTemplates, authArgs);
      if (res.success) {
        const approved = (res.templates || []).filter((t: any) => String(t.status).toUpperCase() === 'APPROVED').length;
        const autoNote = res.autoMappedCount ? ` · ${res.autoMappedCount} message type(s) auto-mapped` : '';
        setSyncInfo(`Synced ${(res.templates || []).length} template(s) from Meta — ${approved} approved${autoNote}. WABA ${res.wabaId}${res.phoneDisplay ? ` · ${res.phoneDisplay}` : ''}.`);
        addToast(`Synced ${(res.templates || []).length} template(s) from your WhatsApp account`, { type: 'success' });
      } else {
        setSyncError(res.error || 'Sync failed.');
        addToast(res.error || 'Template sync failed', { type: 'error' });
      }
    } catch (e: any) {
      const msg = translateError(e, 'sync templates');
      setSyncError(msg);
      addToast(msg, { type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  // ── AUTO-SYNC on panel load (the user's ask: "can we not have the
  // templates synced already??"). Runs once, silently, when the panel
  // opens AND the registry is empty or the last sync is older than 12h.
  // A daily cron (syncAllFirmsWhatsAppTemplates) keeps it fresh even if
  // the user never opens this panel; this covers the "approved a template
  // 5 minutes ago, want it in the app NOW" case.
  const lastSyncAt = (waSettings as any)?.lastSyncAt as number | undefined;
  useEffect(() => {
    if (autoSyncRan.current) return;
    if (!authArgs) return;
    // Wait for both queries to resolve so we know the real freshness.
    if (templates === undefined || waSettings === undefined) return;
    autoSyncRan.current = true;
    const STALE_MS = 12 * 60 * 60 * 1000;
    const empty = (templates?.length ?? 0) === 0;
    const stale = !lastSyncAt || Date.now() - lastSyncAt > STALE_MS;
    if (!empty && !stale) return;
    (async () => {
      setAutoSyncing(true);
      try {
        const res = await convex.action(api.whatsappTemplates.syncWhatsAppTemplates, authArgs);
        if (res.success) {
          const approved = (res.templates || []).filter((t: any) => String(t.status).toUpperCase() === 'APPROVED').length;
          const autoNote = res.autoMappedCount ? ` · ${res.autoMappedCount} auto-mapped` : '';
          setSyncInfo(`Auto-synced ${(res.templates || []).length} template(s) — ${approved} approved${autoNote}. WABA ${res.wabaId}${res.phoneDisplay ? ` · ${res.phoneDisplay}` : ''}.`);
        } else if (res.error) {
          // Surface the reason — never a dead-end "try again".
          setSyncError(`Auto-sync failed: ${res.error}`);
        }
      } catch (e: any) {
        setSyncError(`Auto-sync failed: ${translateError(e, 'sync templates')}`);
      } finally {
        setAutoSyncing(false);
      }
    })();
  }, [authArgs, templates, waSettings, lastSyncAt, convex]);

  const getMapEdit = (type: string) => {
    if (mapEdits[type]) return mapEdits[type];
    const saved = mappings?.find((m) => m.messageType === type);
    return {
      templateName: saved?.templateName || '',
      templateLanguage: saved?.templateLanguage || 'en',
      varOrder: (saved?.varOrder as string[] | undefined) || ['tenantName', 'amount', 'address'],
    };
  };

  const setMapEdit = (type: string, patch: Partial<{ templateName: string; templateLanguage: string; varOrder: string[] }>) => {
    setMapEdits((prev) => ({ ...prev, [type]: { ...getMapEdit(type), ...patch } }));
  };

  const selectedTemplateFor = (type: string): TemplateDoc | undefined => {
    const name = getMapEdit(type).templateName;
    if (!name) return undefined;
    return templates?.find((t) => t.name === name);
  };

  const handleSaveMapping = async (type: string) => {
    if (!authArgs) { addToast('Sign in first.', { type: 'error' }); return; }
    const edit = getMapEdit(type);
    if (!edit.templateName.trim()) { addToast('Choose or type a template name first.', { type: 'error' }); return; }
    setSavingType(type);
    try {
      await saveMapping({ ...authArgs, messageType: type, templateName: edit.templateName.trim(), templateLanguage: edit.templateLanguage, varOrder: edit.varOrder });
      addToast(`Template mapped for ${MSG_TYPE_LABELS[type as keyof typeof MSG_TYPE_LABELS] || type}`, { type: 'success' });
    } catch (e: any) {
      addToast(translateError(e, 'save mapping'), { type: 'error' });
    } finally {
      setSavingType(null);
    }
  };

  const handleDeleteMapping = async (type: string) => {
    if (!authArgs) return;
    setSavingType(type);
    try {
      await deleteMapping({ ...authArgs, messageType: type });
      addToast(`Template mapping removed for ${type}`, { type: 'success' });
    } catch (e: any) {
      addToast(translateError(e, 'remove mapping'), { type: 'error' });
    } finally {
      setSavingType(null);
    }
  };

  const handleTest = async (type: string) => {
    if (!authArgs) { addToast('Sign in first.', { type: 'error' }); return; }
    const edit = getMapEdit(type);
    if (!edit.templateName.trim()) { addToast('Choose a template first.', { type: 'error' }); return; }
    if (!testPhone.replace(/\D/g, '')) { addToast('Enter your own WhatsApp number to receive the test.', { type: 'error' }); return; }
    setTesting(type); setTestResult(null);
    try {
      const tpl = selectedTemplateFor(type);
      const varCount = tpl?.variableCount ?? edit.varOrder.length;
      const sample: Record<string, string> = {
        tenantName: 'Chigozie', amount: '1,400,000', totalPayable: '1,780,000',
        serviceCharge: '40,000', address: 'Unit 1', firmName: coreState.firmDetails?.name || 'Management',
        dueDate: '01/10/2026', messageText: 'This is a test message.',
      };
      const vars = edit.varOrder.slice(0, Math.max(varCount, 0)).map((f) => sample[f] ?? '');
      const res = await convex.action(api.whatsappTemplates.testWhatsAppTemplate, {
        ...authArgs,
        templateName: edit.templateName.trim(),
        templateLanguage: edit.templateLanguage,
        testPhone: testPhone.replace(/\D/g, ''),
        templateVars: vars.length ? vars : undefined,
      });
      setTestResult({ type, success: res.success, raw: res.rawResponse, error: res.error });
      if (res.success) addToast('Test message sent — check your WhatsApp.', { type: 'success' });
      else addToast(res.error ? `Test failed: ${res.error.slice(0, 120)}` : 'Test failed — see details below.', { type: 'error' });
    } catch (e: any) {
      setTestResult({ type, success: false, error: translateError(e, 'send test') });
      addToast(translateError(e, 'send test'), { type: 'error' });
    } finally {
      setTesting(null);
    }
  };

  const syncedAt = useMemo(() => {
    if (!templates?.length) return null;
    return new Date(Math.max(...templates.map((t) => t.syncedAt))).toLocaleString();
  }, [templates]);

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl">
      {/* WhatsApp Business API Configuration */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#25D366]/10 rounded-lg flex items-center justify-center p-2">
              <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">WhatsApp Business API</h3>
              <p className="text-xs text-slate-500">Automated reminders, alerts & messaging</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <span className={`text-2xs font-black uppercase px-2 py-1 rounded-full ${
               status === 'connected' ? 'bg-emerald-500/20 text-emerald-400' :
               'bg-slate-800 text-slate-500'
             }`}>
               {status.replace('_', ' ')}
             </span>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Configuration</h4>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-800">
                <span className="text-sm text-slate-300">Enable WhatsApp Messaging</span>
                <button
                  onClick={() => setEditingConfig({ ...editingConfig, isActive: !editingConfig.isActive })}
                  className={`w-10 h-6 rounded-full transition-colors relative ${editingConfig.isActive ? 'bg-emerald-600' : 'bg-slate-700'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 bg-white dark:bg-zinc-900 rounded-full transition-transform ${editingConfig.isActive ? 'translate-x-4' : ''}`} />
                </button>
              </div>

              {editingConfig.isActive && (
                <div className="space-y-3 animate-slide-down">
                  {/* REAL connection facts, verified live from the gateway —
                      NOT editable placeholders. The number here is the one
                      that actually sends; it comes from the same Chakra
                      pass-through the sends use, so it can never drift. */}
                  <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-2xs text-slate-500 uppercase tracking-wider">Connected WhatsApp line</span>
                      <span className={`text-2xs font-bold uppercase px-1.5 py-0.5 rounded ${autoSyncing ? 'bg-sky-500/20 text-sky-400' : (waSettings as any)?.phoneDisplay ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                        {autoSyncing ? 'Syncing…' : (waSettings as any)?.phoneDisplay ? 'Live' : 'Not synced yet'}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white font-mono">
                      {(waSettings as any)?.phoneDisplay || '—'}
                    </div>
                    {(waSettings as any)?.wabaId && (
                      <div className="text-2xs text-slate-500 font-mono">WABA {(waSettings as any).wabaId}</div>
                    )}
                    {(waSettings as any)?.approvedCount != null && (
                      <div className="text-2xs text-slate-400">
                        {(waSettings as any).approvedCount} approved template{(waSettings as any).approvedCount === 1 ? '' : 's'} on this line
                        {(waSettings as any)?.lastSyncSuccessAt ? ` · verified ${new Date((waSettings as any).lastSyncSuccessAt).toLocaleString()}` : ''}
                      </div>
                    )}
                    {(waSettings as any)?.lastSyncError && (
                      <div className="text-2xs text-rose-400/90 leading-relaxed">
                        Last sync failed: {(waSettings as any).lastSyncError}
                      </div>
                    )}
                  </div>
                  <div className="bg-amber-900/10 border border-amber-900/30 rounded-lg p-3">
                    <p className="text-2xs text-amber-500/80 leading-relaxed italic">
                      The gateway account (Chakra) and API keys are managed by the PracticePro administrator.
                      Messages are sent from the line above — verified directly from your WhatsApp Business account.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-lg transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Update Integration'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── WhatsApp Templates: the firm's REAL Meta templates ─────────── */}
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#25D366]/10 rounded-lg flex items-center justify-center p-2">
              <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">WhatsApp Message Templates</h3>
              <p className="text-xs text-slate-500">
                Your approved templates, exactly as registered in Meta{syncedAt ? ` · last synced ${syncedAt}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing || autoSyncing || !authArgs}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold rounded-lg transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-4 h-4 ${syncing || autoSyncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : autoSyncing ? 'Auto-syncing…' : 'Sync from Meta'}
          </button>
        </div>

        <div className="p-6 space-y-6">
          {syncInfo && (
            <div className="p-3 rounded-lg bg-emerald-900/10 border border-emerald-900/30 text-xs text-emerald-400">{syncInfo}</div>
          )}
          {syncError && (
            <div className="p-3 rounded-lg bg-rose-900/10 border border-rose-900/30 text-xs text-rose-400 leading-relaxed">{syncError}</div>
          )}

          {/* Template registry list */}
          {templates === undefined ? (
            <div className="text-xs text-slate-500 py-2">Loading template registry…</div>
          ) : templates.length === 0 ? (
            <div className="p-4 rounded-lg border border-dashed border-slate-700 text-sm text-slate-400 leading-relaxed">
              No templates synced yet{autoSyncing ? ' — auto-syncing from Meta…' : '. Press'} <span className="font-bold text-slate-200">Sync from Meta</span> to pull
              the templates approved on your WhatsApp Business account — their exact names, languages, statuses and
              variable counts, straight from Meta. Templates sync automatically when you open this page (if stale)
              and every morning, and message types are mapped automatically by name matching.
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <div key={t._id} className="p-3 rounded-lg bg-slate-800/40 border border-slate-800">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white font-mono">{t.name}</span>
                      <span className={`text-2xs font-black uppercase px-1.5 py-0.5 rounded ${
                        String(t.status).toUpperCase() === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400'
                        : String(t.status).toUpperCase() === 'PENDING' ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-rose-500/20 text-rose-400'}`}>
                        {t.status}
                      </span>
                      <span className="text-2xs text-slate-500 font-mono">{t.language}</span>
                      {t.category && <span className="text-2xs text-slate-500">{t.category}</span>}
                      {t.variableCount != null && t.variableCount > 0 && (
                        <span className="text-2xs text-sky-400">{t.variableCount} variable{t.variableCount === 1 ? '' : 's'}</span>
                      )}
                    </div>
                  </div>
                  {t.bodyText && (
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-3">{t.bodyText}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ─── Message-type mappings ─────────────────────────────────── */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">Message-type mappings</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              WhatsApp only delivers free-form text within 24 hours of a resident's last reply — business-initiated
              messages (reminders, notices) <span className="font-bold text-slate-300">require an approved template</span>.
              Every send — manual, bulk, and automated — retries automatically with the template mapped here.
              Mappings are created automatically by name matching after each sync (marked <span className="text-sky-400 font-bold">auto-mapped</span>);
              adjust any of them below. Meta matches templates by <span className="font-bold text-slate-300">name and language
              exactly</span>, and rejects sends whose variable count doesn't match the template.
            </p>
            <div>
              <label className="block text-2xs text-slate-500 mb-1 uppercase tracking-wider">Your WhatsApp number (for test sends)</label>
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+234 801 234 5678"
                className="w-full max-w-xs bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-2">
              {MAPPABLE_TYPES.map((type) => {
                const saved = mappings?.find((m) => m.messageType === type);
                const edit = getMapEdit(type);
                const tpl = selectedTemplateFor(type);
                const varCount = tpl?.variableCount ?? null;
                const expanded = expandedMap === type;
                return (
                  <div key={type} className="rounded-lg border border-slate-800 bg-slate-800/30">
                    <button
                      onClick={() => setExpandedMap(expanded ? null : type)}
                      className="w-full flex items-center justify-between gap-3 p-3 text-left"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-200">{MSG_TYPE_LABELS[type as keyof typeof MSG_TYPE_LABELS]}</span>
                        {saved ? (
                          <span className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-2xs font-mono text-emerald-400">→ {saved.templateName} ({saved.templateLanguage})</span>
                            {(saved as any).autoMapped && (
                              <span className="text-2xs font-bold uppercase px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400" title="Created automatically from template name matching — review and adjust in the editor below if needed.">
                                auto-mapped
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-2xs text-slate-600">not mapped</span>
                        )}
                      </div>
                      <span className={`text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
                    </button>

                    {expanded && (
                      <div className="p-3 pt-0 space-y-3 border-t border-slate-800">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-2xs text-slate-500 mb-1 uppercase tracking-wider">Template name</label>
                            {templates && templates.length > 0 ? (
                              <select
                                value={edit.templateName}
                                onChange={(e) => setMapEdit(type, { templateName: e.target.value })}
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500"
                              >
                                <option value="">— choose a synced template —</option>
                                {templates.map((t) => (
                                  <option key={t._id} value={t.name}>
                                    {t.name} · {t.language} · {t.status}
                                  </option>
                                ))}
                                <option value="__custom__">— type a name manually —</option>
                              </select>
                            ) : null}
                            <input
                              type="text"
                              value={edit.templateName === '__custom__' ? '' : edit.templateName}
                              onChange={(e) => setMapEdit(type, { templateName: e.target.value })}
                              placeholder={templates && templates.length ? 'e.g. my_exact_template_name' : 'Press Sync from Meta, or type the exact name'}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:ring-2 focus:ring-emerald-500 mt-2"
                            />
                          </div>
                          <div>
                            <label className="block text-2xs text-slate-500 mb-1 uppercase tracking-wider">Template language</label>
                            <select
                              value={edit.templateLanguage}
                              onChange={(e) => setMapEdit(type, { templateLanguage: e.target.value })}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-emerald-500"
                            >
                              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                            </select>
                            {tpl?.bodyText && (
                              <p className="text-2xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">{tpl.bodyText}</p>
                            )}
                          </div>
                        </div>

                        {/* Variable order — must match the template's {{n}} slots */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-2xs text-slate-500 uppercase tracking-wider">
                              Variables, in template order ({varCount != null ? `template expects ${varCount}` : 'count unknown — match your template'})
                            </label>
                          </div>
                          <div className="space-y-2">
                            {edit.varOrder.map((field, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-2xs font-mono text-slate-500 w-8">{`{{${idx + 1}}}`}</span>
                                <select
                                  value={field}
                                  onChange={(e) => {
                                    const next = [...edit.varOrder];
                                    next[idx] = e.target.value;
                                    setMapEdit(type, { varOrder: next });
                                  }}
                                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm text-white focus:ring-2 focus:ring-emerald-500"
                                >
                                  {Object.entries(VAR_FIELD_LABELS).map(([k, label]) => (
                                    <option key={k} value={k}>{label}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => setMapEdit(type, { varOrder: edit.varOrder.filter((_, i) => i !== idx) })}
                                  className="p-1.5 text-slate-500 hover:text-rose-400"
                                  aria-label="Remove variable"
                                ><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            ))}
                            <button
                              onClick={() => setMapEdit(type, { varOrder: [...edit.varOrder, 'tenantName'] })}
                              className="text-2xs text-emerald-400 hover:text-emerald-300 font-bold"
                            >+ add variable slot</button>
                          </div>
                        </div>

                        {/* Test send */}
                        {testResult?.type === type && (
                          <div className={`p-3 rounded-lg text-xs leading-relaxed ${testResult.success ? 'bg-emerald-900/10 border border-emerald-900/30 text-emerald-400' : 'bg-rose-900/10 border border-rose-900/30 text-rose-400'}`}>
                            {testResult.success
                              ? 'Test delivered — check your WhatsApp.'
                              : <>{testResult.error || 'Test failed.'}{testResult.raw && <details className="mt-2"><summary className="cursor-pointer text-2xs opacity-70">Provider's raw response</summary><pre className="mt-1 whitespace-pre-wrap break-all text-2xs opacity-80">{testResult.raw}</pre></details>}</>}
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            onClick={() => handleSaveMapping(type)}
                            disabled={savingType === type}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
                          >{savingType === type ? 'Saving…' : 'Save mapping'}</button>
                          <button
                            onClick={() => handleTest(type)}
                            disabled={testing === type}
                            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
                          ><Send className="w-3.5 h-3.5" />{testing === type ? 'Sending…' : 'Send test'}</button>
                          {saved && (
                            <button
                              onClick={() => handleDeleteMapping(type)}
                              disabled={savingType === type}
                              className="px-4 py-2 bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 disabled:opacity-50 text-xs font-bold rounded-lg transition-colors"
                            >Remove</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationSettings;
