/**
 * TenantPortal Maintenance tab — log maintenance tickets with attachments, service type picker.
 *
 * Extracted from TenantPortal.tsx (P5 monolith split, 2026-09-14).
 * Body is verbatim from the original file — zero behavioral change.
 */
import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useAuth } from '../../../contexts/AuthContext';
import { useOfflineQueue } from '../../../hooks/useOfflineQueue';
import { surfaceUploadError } from '../../../utils/convexUpload';
import { ServiceTypePicker } from '../../portal/ServiceTypePicker';
import { OfficeBuildingIcon, CheckIcon, ExclamationTriangleIcon } from '../../../constants';
import { WrenchIcon, UploadIcon, PaperclipIcon, XCircleIcon, formatDate } from './shared';

export const MaintenanceTab: React.FC<{ tenantInfo: any; effectiveFirmId?: string; addToast: (msg: React.ReactNode, opts?: any) => void }> = ({ tenantInfo, effectiveFirmId, addToast }) => {
  const { currentUser, bearerToken } = useAuth();
  const firmId = effectiveFirmId || currentUser?.firmId || '';
  const userId = currentUser?.id || '';
  const resolvedTenantId = tenantInfo?.tenantId || userId;

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  // Selected admin-configured request type (key). Falls back to "other".
  const [selectedTypeKey, setSelectedTypeKey] = useState<string>('other');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch admin-configured service request types (with sensible defaults
  // returned by the backend if the firm hasn't configured any yet).
  const requestTypes = useQuery(
    api.portals.getServiceRequestTypes,
    firmId ? { firmId, portalType: 'resident' as const } : 'skip'
  );

  // Fetch tickets from Convex
  const tickets = useQuery(
    api.portals.getMaintenanceTicketsByTenant,
    resolvedTenantId ? { tenantId: resolvedTenantId } : 'skip'
  );

  // Mutation for creating a ticket
  const createTicket = useMutation(api.portals.createMaintenanceTicket);
  const cancelTicket = useMutation(api.portals.cancelMaintenanceTicket);
  // Get upload URL mutation
  const generateUploadUrl = useMutation(api.myFunctions.generateUploadUrl);
  // Offline queue — for ticket creation when no attachments, and ticket
  // cancellation (never has attachments).
  const { queueMutation, isOnline } = useOfflineQueue();

  // Cancel ticket state
  const [cancellingTicketId, setCancellingTicketId] = useState<string | null>(null);
  const [cancelNote, setCancelNote] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelTicket = async (ticketId: string) => {
    if (!cancelNote.trim()) {
      addToast('Please enter a reason for cancelling.', { type: 'info' });
      return;
    }
    if (!currentUser?.id) return;
    // OFFLINE PATH — cancellation never has attachments, so it's always queueable.
    if (!isOnline) {
      queueMutation({
        mutationName: 'cancelMaintenanceTicket',
        args: {
          ticketId: ticketId as any,
          cancellationNote: cancelNote.trim(),
          cancelledBy: currentUser.id,
        },
        label: `Cancel maintenance ticket`,
      });
      addToast('Ticket cancellation saved offline. Your property manager will be notified when you reconnect.', { type: 'info', duration: 6000 });
      setCancellingTicketId(null);
      setCancelNote('');
      return;
    }
    setIsCancelling(true);
    try {
      await cancelTicket({
        ticketId: ticketId as any,
        cancellationNote: cancelNote.trim(),
        cancelledBy: currentUser.id,
      });
      addToast('Ticket cancelled. Your property manager has been notified.', { type: 'success' });
      setCancellingTicketId(null);
      setCancelNote('');
    } catch (err: any) {
      addToast(err.message || 'Failed to cancel ticket.', { type: 'error' });
    } finally {
      setIsCancelling(false);
    }
  };

  // Use tenantInfo to resolve property and unit IDs
  // This is the KEY FIX: we no longer use coreState (which is empty for portal users)
  const propertyId = tenantInfo?.primaryPropertyId;
  const unitId = tenantInfo?.primaryUnitId;

  // Derive the selected type's full metadata (label, icon, defaultPriority)
  const selectedType = useMemo(() => {
    if (!requestTypes || requestTypes.length === 0) return null;
    return requestTypes.find((t: any) => t.key === selectedTypeKey) || requestTypes[0];
  }, [requestTypes, selectedTypeKey]);

  // Map a request type key back to one of the legacy `category` literals.
  // The schema still requires one of plumbing/electrical/structural/other —
  // we use this as a fallback for tickets created without a custom type.
  const mapKeyToLegacyCategory = (key: string): 'plumbing' | 'electrical' | 'structural' | 'other' => {
    if (key === 'plumbing') return 'plumbing';
    if (key === 'electrical') return 'electrical';
    if (key === 'structural') return 'structural';
    return 'other';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Validate file types: images and PDFs only
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'application/pdf'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validFiles = files.filter(f => {
      if (!validTypes.includes(f.type)) {
        addToast(`"${f.name}" is not a supported file type. Use images or PDFs.`, { type: 'error' });
        return false;
      }
      if (f.size > maxSize) {
        addToast(`"${f.name}" exceeds 10MB limit.`, { type: 'error' });
        return false;
      }
      return true;
    });
    setPendingFiles(prev => [...prev, ...validFiles]);
    // Reset the input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      addToast('Please fill in all fields before submitting.', { type: 'info' });
      return;
    }
    // Distinguish between tenantInfo still loading vs genuinely no property linked
    if (tenantInfo === undefined) {
      addToast('Still loading your property information. Please try again in a moment.', { type: 'info' });
      return;
    }
    if (!propertyId) {
      addToast('No property linked to your account. Please contact your property manager to ensure your unit is properly assigned.', { type: 'error' });
      return;
    }

    // OFFLINE GUARD — file uploads fundamentally cannot be queued (the
    // upload URL is single-use and expires). Fail fast with a clear
    // message instead of letting the fetch hang or fail silently.
    if (pendingFiles.length > 0 && !navigator.onLine) {
      addToast("You're offline. File upload requires internet — please reconnect and try again.", { type: 'error', duration: 6000 });
      return;
    }

    setIsSubmitting(true);
    try {
      // Upload files to Convex storage if any
      let attachmentStorageIds: string[] = [];
      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          try {
            const postUrl = await generateUploadUrl();
            const res = await fetch(postUrl, {
              method: 'POST',
              body: file,
            });
            if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
            const { storageId } = await res.json();
            if (storageId) attachmentStorageIds.push(storageId);
          } catch (uploadErr: any) {
            surfaceUploadError(addToast, file, uploadErr);
          }
        }
      }

      // Resolve the type metadata for the backend — pass both the new
      // requestTypeKey/Label AND a legacy `category` literal so older
      // practitioner UI that filters by `category` still works.
      const typeLabel = selectedType?.label || selectedTypeKey;
      const legacyCategory = mapKeyToLegacyCategory(selectedTypeKey);

      // OFFLINE PATH — if we got here while offline, there are no attachments
      // (the offline guard at the top returned early if there were). Queue
      // the ticket creation; it'll sync when the user reconnects.
      if (!navigator.onLine) {
        queueMutation({
          mutationName: 'createMaintenanceTicket',
          args: {
            firmId,
            propertyId,
            unitId: unitId || undefined,
            tenantId: resolvedTenantId,
            tenantName: currentUser?.name || undefined,
            subject: subject.trim(),
            description: description.trim(),
            category: legacyCategory,
            requestTypeKey: selectedTypeKey,
            requestTypeLabel: typeLabel,
            attachments: undefined,
          },
          label: `Maintenance ticket — ${subject.trim()}`,
        });
        addToast('Ticket saved offline. Your property manager will be notified when you reconnect.', { type: 'info', duration: 6000 });
        setSubject('');
        setDescription('');
        setSelectedTypeKey('other');
        setPendingFiles([]);
        return;
      }

      await createTicket({
        firmId,
        propertyId,
        unitId: unitId || undefined,
        tenantId: resolvedTenantId,
        tenantName: currentUser?.name || undefined,
        subject: subject.trim(),
        description: description.trim(),
        category: legacyCategory,
        requestTypeKey: selectedTypeKey,
        requestTypeLabel: typeLabel,
        attachments: attachmentStorageIds.length > 0 ? attachmentStorageIds : undefined,
      });
      addToast('Maintenance ticket submitted successfully. Your property manager has been notified.', { type: 'success' });
      setSubject('');
      setDescription('');
      setSelectedTypeKey('other');
      setPendingFiles([]);
    } catch (err: any) {
      addToast(err.message || 'Failed to submit ticket. Please try again.', { type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading = tickets === undefined;

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; label: string }> = {
      open: { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-600 dark:text-amber-400', label: 'Open' },
      in_progress: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', label: 'In Progress' },
      resolved: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', label: 'Resolved' },
      closed: { bg: 'bg-slate-100 dark:bg-zinc-700', text: 'text-slate-600 dark:text-zinc-400', label: 'Closed' },
      cancelled: { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-600 dark:text-rose-400', label: 'Cancelled' },
    };
    const c = config[status] || config.open;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-bold ${c.bg} ${c.text}`}>
        {status === 'resolved' || status === 'closed' ? <CheckIcon className="w-3 h-3" /> : status === 'cancelled' ? <XCircleIcon className="w-3 h-3" /> : <ExclamationTriangleIcon className="w-3 h-3" />}
        {c.label}
      </span>
    );
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Maintenance Tickets</h3>
      <p className="text-sm text-slate-500 dark:text-zinc-400 mb-6">
        Log maintenance issues directly into your property manager's workflow.
      </p>

      {/* Property/Unit Info Banner */}
      {tenantInfo?.primaryPropertyName && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 text-sm">
          <div className="flex items-center gap-2">
            <OfficeBuildingIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <span className="text-emerald-800 dark:text-emerald-300 font-medium">
              {tenantInfo.primaryUnitName
                ? `Unit ${tenantInfo.primaryUnitName} in ${tenantInfo.primaryPropertyName}`
                : tenantInfo.primaryPropertyName}
            </span>
          </div>
        </div>
      )}

      {/* New Ticket Form */}
      <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-5 mb-6">
        <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3">Report New Issue</h4>
        <div className="space-y-3">
          <div>
            {requestTypes === undefined ? (
              <>
                <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-2">Request Type</label>
                <div className="h-12 rounded-lg bg-slate-100 dark:bg-zinc-700 animate-pulse" />
              </>
            ) : requestTypes && requestTypes.length > 0 ? (
              <ServiceTypePicker
                options={requestTypes as any}
                selectedKey={selectedTypeKey}
                onChange={setSelectedTypeKey}
                label="Request Type"
                placeholder="Select a request type"
              />
            ) : (
              <p className="text-xs text-slate-400">No request types configured. Please contact your property manager.</p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Subject</label>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g., Leaking roof in bedroom"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the issue in detail..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
          </div>
          {/* File Attachments */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">Attachments (Optional)</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-lg p-4 text-center cursor-pointer hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors"
            >
              <UploadIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500 mx-auto mb-2" />
              <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                Click to upload photos or PDFs
              </p>
              <p className="text-2xs text-slate-400 dark:text-zinc-500 mt-1">
                JPG, PNG, GIF, WebP, PDF · Max 10MB each
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,image/bmp,application/pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            {/* Show selected files */}
            {pendingFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {pendingFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-zinc-800 rounded-lg">
                    <PaperclipIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs text-slate-700 dark:text-zinc-300 flex-1 truncate">{file.name}</span>
                    <span className="text-2xs text-slate-400">{(file.size / 1024).toFixed(0)}KB</span>
                    <button onClick={() => removeFile(idx)} className="text-rose-500 hover:text-rose-700">
                      <XCircleIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </div>
      </div>

      {/* Existing Tickets */}
      <h4 className="text-sm font-bold text-slate-800 dark:text-zinc-200 mb-3">Your Tickets</h4>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-zinc-700" />
                <div className="flex-1">
                  <div className="h-4 bg-slate-200 dark:bg-zinc-700 rounded w-40 mb-2" />
                  <div className="h-3 bg-slate-200 dark:bg-zinc-700 rounded w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : tickets && tickets.length > 0 ? (
        <div className="space-y-2">
          {tickets.map((t: any) => {
            // Look up the icon for this ticket's request type
            const typeMeta = (requestTypes as any[] | undefined)?.find((rt: any) => rt.key === t.requestTypeKey);
            const iconChar = typeMeta?.icon || '🔧';
            const typeLabel = t.requestTypeLabel || (t.category ? t.category.charAt(0).toUpperCase() + t.category.slice(1) : 'Maintenance');
            const canCancel = t.status === 'open' || t.status === 'in_progress';
            const isCancellingThis = cancellingTicketId === String(t._id);
            return (
            <div
              key={t._id}
              className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 overflow-hidden"
            >
              <div className="p-4 flex flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${
                    t.status === 'resolved' || t.status === 'closed'
                      ? 'bg-emerald-50 dark:bg-emerald-900/20'
                      : t.status === 'cancelled'
                      ? 'bg-rose-50 dark:bg-rose-900/20'
                      : t.status === 'in_progress'
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : 'bg-amber-50 dark:bg-amber-900/20'
                  }`}>
                    {iconChar}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-800 dark:text-zinc-200 truncate">{t.subject}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      <span className="font-medium text-slate-600 dark:text-zinc-300">{typeLabel}</span>
                      {' · '}
                      {formatDate(t.createdAt)}
                      {t.images?.length > 0 && <span className="ml-1">· <PaperclipIcon className="w-3 h-3 inline" /> {t.images.length}</span>}
                    </p>
                    {t.cancellationNote && (
                      <p className="text-2xs text-rose-500 dark:text-rose-400 mt-1 italic">
                        Cancelled: {t.cancellationNote}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">{getStatusBadge(t.status)}</div>
              </div>
              {/* Locked banner for closed/cancelled/resolved tickets */}
              {(// Backend statuses are lowercase ('cancelled'/'closed'/'resolved') —
               // the old UPPERCASE literals made this "replies disabled" banner
               // dead code that never rendered.
               ['cancelled', 'closed', 'resolved', 'CANCELLED', 'CLOSED', 'RESOLVED'].includes(t.status)) && (
                <div className="px-4 pb-3">
                  <div className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-lg px-3 py-2 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      {t.status === 'CANCELLED' ? 'This ticket has been cancelled. Replies are disabled.' : 'This ticket has been closed. Replies are disabled.'}
                    </p>
                  </div>
                </div>
              )}
              {/* Cancel button for open/in_progress tickets */}
              {canCancel && (
                <div className="px-4 pb-3">
                  <button
                    onClick={() => {
                      setCancellingTicketId(isCancellingThis ? null : String(t._id));
                      setCancelNote('');
                    }}
                    className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {isCancellingThis ? 'Hide' : 'Cancel Ticket'}
                  </button>
                </div>
              )}
              {/* Cancel confirmation panel */}
              {canCancel && isCancellingThis && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-zinc-700 space-y-3">
                  <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 mb-1">
                    Reason for cancellation
                  </label>
                  <textarea
                    value={cancelNote}
                    onChange={e => setCancelNote(e.target.value)}
                    placeholder="e.g., Issue was resolved another way, no longer needed..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setCancellingTicketId(null); setCancelNote(''); }}
                      className="flex-1 px-3 py-2 text-xs font-bold text-slate-600 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-700 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors"
                    >
                      Keep Ticket
                    </button>
                    <button
                      onClick={() => handleCancelTicket(String(t._id))}
                      disabled={isCancelling || !cancelNote.trim()}
                      className="flex-1 px-3 py-2 text-xs font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    >
                      {isCancelling ? (
                        <>
                          <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        'Confirm Cancel'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 p-8 text-center">
          <div className="w-12 h-12 mx-auto rounded-lg bg-slate-100 dark:bg-zinc-700 flex items-center justify-center mb-3">
            <WrenchIcon className="w-6 h-6 text-slate-400 dark:text-zinc-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 mb-1">No maintenance tickets</p>
          <p className="text-xs text-slate-500 dark:text-zinc-400">
            Use the form above to report any issues in your unit.
          </p>
        </div>
      )}
    </div>
  );
};

// ─── Messages Tab ────────────────────────────────────────────────────────────
