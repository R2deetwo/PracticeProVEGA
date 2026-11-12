/**
 * VisitorPortal — Resident-facing Visitor Code Generation
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Part of the Sentry Pass for gated estates.
 *
 * Features:
 *   - Generate 6-digit visitor access codes
 *   - Two delivery modes: client-share (wa.me link) or portal-API (WhatsApp)
 *   - Auto-fills estate name + address from resident's property
 *   - Active tokens list with revoke button
 *   - History of past tokens
 *
 * Design: matches the portal's card-based layout with emerald accents,
 * rounded-premium cards, and the same icon-tile pattern as DashboardTab.
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Button, Input, Textarea } from '../ui';
import { VisitorIcon, CheckIcon, ClockIcon, XCircleIcon, SendIcon, ShareIcon, MapPinIcon, BellIcon } from '../../constants';
import { useAuth } from '../../contexts/AuthContext';
import { useUI } from '../../contexts/UIContext';
import { useConfirm } from '../ui/ConfirmDialog';

interface VisitorPortalProps {
    firmId: string;
    propertyId: string;
    propertyName?: string;
    propertyAddress?: string;
    unitId?: string;
    unitName?: string;
    residentName?: string;
}

const EXPIRY_OPTIONS = [
    { value: 2,  label: '2 Hours' },
    { value: 6,  label: '6 Hours' },
    { value: 12, label: '12 Hours' },
    { value: 24, label: '24 Hours' },
];

export const VisitorPortal: React.FC<VisitorPortalProps> = ({
    firmId,
    propertyId,
    propertyName,
    propertyAddress,
    unitId,
    unitName,
    residentName,
}) => {
    const { addToast } = useUI();
    const { confirm, ConfirmDialog } = useConfirm();
    const { currentUser, bearerToken } = useAuth();
    const residentId = currentUser?.id || '';

    // ─── Form state ─────────────────────────────────────────────────────
    // Default expiry window reads from portal settings (admin-configurable
    // via vmsDefaultExpiryHours). Falls back to 6 hours if no setting found.
    const portalSettings = useQuery(api.portals.getFirmPortalSettings, firmId ? { firmId } : 'skip');
    const [visitorName, setVisitorName] = useState('');
    const [visitorPhone, setVisitorPhone] = useState('');
    const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
    const [expiryWindow, setExpiryWindow] = useState(portalSettings?.vmsDefaultExpiryHours ?? 6);
    const [deliveryMethod, setDeliveryMethod] = useState<'client_share' | 'portal_api'>('client_share');
    const [isGenerating, setIsGenerating] = useState(false);
    const [lastGenerated, setLastGenerated] = useState<{ tokenCode: string; passRef?: string; message: string } | null>(null);
    // ROUND SENTRY 1: optional display-only extras (never widen the window)
    const [expectedArrival, setExpectedArrival] = useState('');
    const [accessNote, setAccessNote] = useState('');

    // ROUND SENTRY 2: arrival-request desk (gatehouse → resident → decision)
    const [rejectOpenFor, setRejectOpenFor] = useState<string | null>(null);
    const [rejectText, setRejectText] = useState('');
    const [decidingId, setDecidingId] = useState<string | null>(null);
    const [decisionError, setDecisionError] = useState<string | null>(null);

    // ─── Mutations ──────────────────────────────────────────────────────
    const generateToken = useMutation(api.visitorManagement.generateVisitorToken);
    const revokeToken = useMutation(api.visitorManagement.revokeVisitorToken);
    const decideRequest = useMutation(api.sentryRequests.decideArrivalRequest);
    // ─── Queries ────────────────────────────────────────────────────────
    const activeTokens = useQuery(
        api.visitorManagement.getResidentTokens,
        firmId && residentId ? { firmId, residentId, status: 'active', userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) } : 'skip'
    );
    const pastTokens = useQuery(
        api.visitorManagement.getResidentTokens,
        firmId && residentId ? { firmId, residentId, userEmail: currentUser?.email, sessionToken: (bearerToken ?? undefined) } : 'skip'
    );
    const myRequests = useQuery(
        api.sentryRequests.getSentryResidentRequests,
        firmId && residentId ? { firmId, residentId, sessionToken: (bearerToken ?? undefined) } : 'skip'
    );

    // ─── Handlers ───────────────────────────────────────────────────────
    const handleGenerate = async () => {
        if (!visitorName.trim() || !visitorPhone.trim()) {
            addToast('Please enter visitor name and phone number.', { type: 'error' });
            return;
        }
        if (deliveryMethod === 'portal_api' && !visitorPhone.trim()) {
            addToast('Phone number is required for portal delivery.', { type: 'error' });
            return;
        }

        setIsGenerating(true);
        try {
            const result = await generateToken({
                firmId,
                propertyId,
                unitId,
                residentId,
                visitorName: visitorName.trim(),
                visitorPhone: visitorPhone.trim(),
                visitDate,
                expiryWindowHours: expiryWindow,
                deliveryMethod,
                sessionToken: (bearerToken ?? undefined),
                expectedArrival: expectedArrival.trim() || undefined,
                accessNote: accessNote.trim() || undefined,
            });

            if (deliveryMethod === 'client_share' && result.message) {
                setLastGenerated({ tokenCode: result.tokenCode!, passRef: (result as any).passRef, message: result.message });
            } else if (deliveryMethod === 'portal_api') {
                addToast(`Code ${result.tokenCode} sent to ${visitorPhone} via WhatsApp.`, { type: 'success' });
            } else {
                addToast(`Visitor code generated: ${result.tokenCode}`, { type: 'success' });
            }

            // Reset form
            setVisitorName('');
            setVisitorPhone('');
            setExpectedArrival('');
            setAccessNote('');
        } catch (err: any) {
            addToast(err.message || 'Failed to generate code.', { type: 'error' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleShareViaWhatsApp = () => {
        if (!lastGenerated) return;
        const url = `https://wa.me/?text=${encodeURIComponent(lastGenerated.message)}`;
        window.open(url, '_blank');
    };

    const handleRevoke = async (tokenId: string, name: string) => {
        const ok = await confirm({
            title: 'Revoke Visitor Code',
            message: `Revoke visitor code for ${name}? They will not be able to enter.`,
            confirmLabel: 'Revoke',
            danger: true,
        });
        if (!ok) return;
        try {
            await revokeToken({ tokenId: tokenId as any, reason: 'Revoked by resident', residentId, sessionToken: (bearerToken ?? undefined) });
            addToast('Code revoked.', { type: 'success' });
        } catch (err: any) {
            addToast(err.message || 'Failed to revoke.', { type: 'error' });
        }
    };

    // ── ROUND SENTRY 2: decide a gatehouse arrival request ────────────
    const handleDecide = async (requestId: string, decision: 'approved' | 'rejected') => {
        if (!residentId) return;
        setDecidingId(requestId);
        setDecisionError(null);
        try {
            const out: any = await decideRequest({
                requestId: requestId as any,
                decision,
                rejectReason: decision === 'rejected' ? (rejectText.trim() || undefined) : undefined,
                residentId,
                sessionToken: (bearerToken ?? undefined),
            });
            if (decision === 'approved') {
                addToast(
                    out?.delivered === 'whatsapp'
                        ? `Approved — pass ${out.tokenCode} WhatsApped to the visitor.`
                        : `Approved — today's pass is ${out.tokenCode}.`,
                    { type: 'success' },
                );
            } else {
                addToast('Request rejected — the gatehouse has been told.', { type: 'success' });
            }
            setRejectOpenFor(null);
            setRejectText('');
        } catch (err: any) {
            setDecisionError(err.message || 'Could not record the decision.');
        } finally {
            setDecidingId(null);
        }
    };

    // ─── Render ─────────────────────────────────────────────────────────
    return (
        <>
        <div className="space-y-5">
            {/* Hero header */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-premium shadow-premium p-6 text-white">
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-white/20 rounded-icon flex items-center justify-center backdrop-blur-sm">
                        <VisitorIcon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold tracking-tight">Visitor Codes</h2>
                        <p className="text-emerald-100 text-xs">{propertyName || 'Your Estate'} · {unitName || 'Resident'}</p>
                    </div>
                </div>
                <p className="text-emerald-50 text-sm mt-2">
                    Generate a 6-digit entry code for your visitor. Share it instantly or let us send it for you.
                </p>
            </div>

            {/* Generated code share sheet — appears after client_share generation */}
            {lastGenerated && (
                <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-soft border border-emerald-200 dark:border-emerald-700/40 p-5 animate-in fade-in zoom-in duration-300">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                            <CheckIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">Code Ready!</h3>
                    </div>
                    <div className="text-center my-4">
                        <div className="text-4xl font-black tracking-[0.3em] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg py-4">
                            {lastGenerated.tokenCode}
                        </div>
                    </div>
                    {/* Access code display. PRIVACY FIX: this previously
                        rendered the QR via a THIRD-PARTY API
                        (api.qrserver.com) — leaking live access codes to an
                        external service and breaking offline. The 6-digit code
                        IS the credential (gatehouse verifies by code entry),
                        so we render it large locally instead. */}
                    <div className="flex justify-center mb-3">
                        <div className="px-6 py-4 bg-white rounded-lg border border-slate-200 dark:border-zinc-700">
                            <p className="text-3xl font-black tracking-[0.3em] text-slate-900 text-center font-mono select-all">
                                {lastGenerated.tokenCode}
                            </p>
                            <p className="text-2xs text-slate-400 text-center mt-1.5 font-bold uppercase tracking-wider">Show / enter this code at the gate</p>
                        </div>
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-900 rounded-lg p-3 mb-3 max-h-32 overflow-y-auto">
                        <p className="text-xs text-slate-600 dark:text-zinc-400 whitespace-pre-wrap">{lastGenerated.message}</p>
                    </div>
                    {lastGenerated.passRef && (
                        <div className="bg-slate-50 dark:bg-zinc-900 rounded-lg p-3 mb-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Pass ID</p>
                                <p className="text-sm font-mono font-bold tracking-wider text-slate-700 dark:text-zinc-300 select-all">{lastGenerated.passRef}</p>
                            </div>
                            <p className="text-2xs text-slate-400 text-right flex-shrink-0 max-w-[10rem]">The 6-digit code or this ID both work at the gate.</p>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button
                            onClick={handleShareViaWhatsApp}
                            className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <ShareIcon className="w-4 h-4" /> Open WhatsApp
                        </button>
                        <button
                            onClick={() => setLastGenerated(null)}
                            className="px-4 py-2.5 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-lg font-bold text-sm hover:bg-slate-200 dark:hover:bg-zinc-600 transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}

            {/* Generation form */}
            {!lastGenerated && (
                <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-soft p-5 space-y-4">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base">Generate New Code</h3>

                    {/* Visitor Name */}
                    <div>
                        <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Visitor Name</label>
                        <input
                            type="text"
                            value={visitorName}
                            onChange={(e) => setVisitorName(e.target.value)}
                            placeholder="e.g. John Doe"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-base text-slate-900 dark:text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                        />
                    </div>

                    {/* Visitor Phone */}
                    <div>
                        <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Visitor Phone Number</label>
                        <input
                            type="tel"
                            value={visitorPhone}
                            onChange={(e) => setVisitorPhone(e.target.value)}
                            placeholder="+234 801 234 5678"
                            className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-base text-slate-900 dark:text-white placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                        />
                        <p className="text-2xs text-slate-400 mt-1">Required for portal delivery. Include country code.</p>
                    </div>

                    {/* Visit Date + Expiry */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Visit Date</label>
                            <input
                                type="date"
                                value={visitDate}
                                onChange={(e) => setVisitDate(e.target.value)}
                                className="w-full px-3 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-base text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                            />
                        </div>
                        <div>
                            <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Valid For</label>
                            <select
                                value={expiryWindow}
                                onChange={(e) => setExpiryWindow(parseInt(e.target.value))}
                                className="w-full px-3 py-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-base text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                            >
                                {EXPIRY_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Delivery Mode Selector */}
                    <div>
                        <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Delivery Method</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setDeliveryMethod('client_share')}
                                className={`p-3 rounded-lg border-2 text-left transition-all ${
                                    deliveryMethod === 'client_share'
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                        : 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <ShareIcon className={`w-4 h-4 ${deliveryMethod === 'client_share' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                                    <span className={`text-xs font-bold ${deliveryMethod === 'client_share' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-zinc-300'}`}>Share via My WhatsApp</span>
                                </div>
                                <p className="text-2xs text-slate-500 dark:text-zinc-400">Opens WhatsApp on your phone. No cost.</p>
                            </button>
                            <button
                                onClick={() => setDeliveryMethod('portal_api')}
                                className={`p-3 rounded-lg border-2 text-left transition-all ${
                                    deliveryMethod === 'portal_api'
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                        : 'border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <SendIcon className={`w-4 h-4 ${deliveryMethod === 'portal_api' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                                    <span className={`text-xs font-bold ${deliveryMethod === 'portal_api' ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-zinc-300'}`}>Send from Portal</span>
                                </div>
                                <p className="text-2xs text-slate-500 dark:text-zinc-400">We send it directly. Uses WhatsApp quota.</p>
                            </button>
                        </div>
                    </div>

                    {/* ROUND SENTRY 1: expected arrival + gate instructions (optional, display-only) */}
                    <div className="grid grid-cols-1 gap-3">
                        <div>
                            <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Expected Arrival (optional)</label>
                            <Input
                                type="time"
                                value={expectedArrival}
                                onChange={(e: any) => setExpectedArrival(e.target.value)}
                                placeholder="--:--"
                            />
                            <p className="text-2xs text-slate-400 mt-1">Shown to the gate — never widens the code's validity window.</p>
                        </div>
                        <div>
                            <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1.5">Instructions for the gate (optional)</label>
                            <Textarea
                                value={accessNote}
                                onChange={(e: any) => setAccessNote(e.target.value)}
                                placeholder="e.g. Delivery to door 2 — call on arrival"
                                rows={2}
                                maxLength={120}
                            />
                        </div>
                    </div>

                    {/* Auto-filled address preview */}
                    <div className="bg-slate-50 dark:bg-zinc-900 rounded-lg p-3 flex items-start gap-2">
                        <MapPinIcon className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                            <p className="text-2xs font-bold text-slate-400 uppercase tracking-wider">Auto-filled Address</p>
                            <p className="text-xs text-slate-700 dark:text-zinc-300">
                                {propertyName}{unitName ? ` · ${unitName}` : ''}{propertyAddress ? ` · ${propertyAddress}` : ''}
                            </p>
                        </div>
                    </div>

                    {/* Generate button */}
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !visitorName.trim() || !visitorPhone.trim()}
                        className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                        {isGenerating ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Generating...
                            </>
                        ) : (
                            <>
                                <VisitorIcon className="w-4 h-4" /> Generate Code
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* ROUND SENTRY 2: arrival requests from the gatehouse */}
            {myRequests && myRequests.length > 0 && (
                <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-soft p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                            <BellIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-base">At the gate ({myRequests.filter((r: any) => r.status === 'pending').length} waiting)</h3>
                    </div>
                    <p className="text-2xs text-slate-500 dark:text-zinc-400 mb-3">The gatehouse raised these visitors. Approving mints a pass for today (6h) and sends it to the visitor when a phone was left.</p>
                    <div className="space-y-2.5">
                        {myRequests.map((r: any) => (
                            <div key={r.requestId} className={`p-3 rounded-lg border ${
                                r.status === 'pending'
                                    ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/40'
                                    : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-700'
                            }`}>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-900 dark:text-white text-sm">{r.visitorName}</span>
                                            {r.unitName && <span className="text-2xs text-slate-500 dark:text-zinc-400">· {r.unitName}</span>}
                                        </div>
                                        <div className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                            Asked {new Date(r.requestedAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })} by {r.requestedBy}
                                        </div>
                                        {r.notes && <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-1 italic">“{r.notes}”</p>}
                                        {r.status === 'rejected' && r.rejectReason && (
                                            <p className="text-2xs text-rose-500 mt-1">Rejected: {r.rejectReason}</p>
                                        )}
                                        {r.status === 'approved' && (
                                            <p className="text-2xs text-emerald-600 dark:text-emerald-400 mt-1 font-bold">Approved — pass sent for today.</p>
                                        )}
                                        {r.status === 'expired' && (
                                            <p className="text-2xs text-slate-400 mt-1">Unanswered for 12h — expired.</p>
                                        )}
                                    </div>
                                    {r.status === 'pending' && (
                                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                disabled={decidingId === r.requestId}
                                                onClick={() => handleDecide(r.requestId, 'approved')}
                                            >
                                                {decidingId === r.requestId ? '…' : 'Approve'}
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="danger-soft"
                                                disabled={decidingId === r.requestId}
                                                onClick={() => setRejectOpenFor(rejectOpenFor === r.requestId ? null : r.requestId)}
                                            >
                                                Reject
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                {rejectOpenFor === r.requestId && (
                                    <div className="mt-3 p-3 rounded-lg bg-white dark:bg-zinc-800 space-y-2">
                                        <Textarea
                                            value={rejectText}
                                            onChange={(e: any) => setRejectText(e.target.value)}
                                            placeholder="Reason (optional, kept on the record)"
                                            rows={2}
                                            maxLength={200}
                                        />
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="ghost" className="flex-1" onClick={() => setRejectOpenFor(null)}>Cancel</Button>
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                className="flex-1"
                                                disabled={decidingId === r.requestId}
                                                onClick={() => handleDecide(r.requestId, 'rejected')}
                                            >
                                                Confirm rejection
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    {decisionError && <p className="text-2xs text-rose-600 dark:text-rose-400 mt-2 font-bold">{decisionError}</p>}
                </div>
            )}

            {/* Active tokens */}
            {activeTokens && activeTokens.length > 0 && (
                <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-soft p-5">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base mb-3">Active Codes ({activeTokens.length})</h3>
                    <div className="space-y-2">
                        {activeTokens.map((token: any) => (
                            <div key={token._id} className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-700/30">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-slate-900 dark:text-white text-sm">{token.visitorName}</span>
                                        <span className="text-lg font-black tracking-widest text-emerald-600 dark:text-emerald-400">{token.tokenCode}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-2xs text-slate-500 dark:text-zinc-400">
                                        <ClockIcon className="w-3 h-3" />
                                        <span>Expires {new Date(token.expiresAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                        {token.expectedArrival && <span>· ~{token.expectedArrival}</span>}
                                        {token.deliveryMethod === 'portal_api' && (
                                            <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full font-bold">Sent via WhatsApp</span>
                                        )}
                                    </div>
                                    {token.accessNote && (
                                        <p className="text-2xs text-slate-400 mt-1 italic truncate">“{token.accessNote}”</p>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleRevoke(token._id, token.visitorName)}
                                    className="ml-2 px-3 py-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg text-2xs font-bold hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors flex-shrink-0"
                                >
                                    Revoke
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* History */}
            {pastTokens && pastTokens.length > 0 && (
                <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-soft p-5">
                    <h3 className="font-bold text-slate-900 dark:text-white text-base mb-3">History</h3>
                    <div className="space-y-1.5 max-h-64 overflow-y-auto">
                        {pastTokens.slice(0, 20).map((token: any) => (
                            <div key={token._id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition-colors">
                                <div className="min-w-0 flex-1">
                                    <span className="text-sm font-medium text-slate-900 dark:text-white">{token.visitorName}</span>
                                    <span className="text-2xs text-slate-400 ml-2">{new Date(token.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="text-sm font-mono font-bold text-slate-600 dark:text-zinc-300">{token.tokenCode}</span>
                                    <span className={`text-3xs px-2 py-0.5 rounded-full font-bold ${
                                        token.status === 'used' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                        token.status === 'expired' ? 'bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400' :
                                        token.status === 'revoked' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    }`}>
                                        {token.status === 'used' ? 'Used' : token.status === 'expired' ? 'Expired' : token.status === 'revoked' ? 'Revoked' : 'Active'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
        {ConfirmDialog}
        </>
    );
};

