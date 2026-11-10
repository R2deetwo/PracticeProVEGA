/**
 * GatekeeperInterface — Lightweight Gate Verification Portal
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Designed for gate tablets/phones. Optimized for:
 *   - Low data usage (minimal queries, cached results)
 *   - Fast input (large code field; auto-verifies at 6 digits)
 *   - Clear visual feedback (green success / red error)
 *   - Offline fallback (caches last 100 verifications in localStorage)
 *
 * ROUND SENTRY 3 (owner brief §3):
 *   - Accepts the 6-digit PIN OR the 12-char passRef (auto-detected).
 *   - Verify result carries the resident's instructions: expected
 *     arrival time + access note.
 *   - One-tap denial recording (denied entries land in the security
 *     report — reason captured in a single extra step, never more).
 *   - Fast search over today's expected visitors (name / code / passRef).
 *   - Today's board distinguishes expired passes and shows each
 *     visitor's expected arrival.
 *   - Arrival-request desk: raise a request when a visitor has no pass,
 *     and watch the resident's approval/rejection land on the board.
 *
 * Accessible from the main app as a separate view, or from the
 * tenant portal via a "Gate Access" button.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useConvex } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Button, Input, Textarea } from '../ui';
import { GateIcon, CheckIcon, XCircleIcon, ClockIcon, UserIcon, MapPinIcon, SearchIcon, InfoIcon } from '../../constants';

interface VerificationResult {
    valid: boolean;
    reason?: string;
    message?: string;
    tokenId?: string;
    visitorName?: string;
    estateName?: string;
    address?: string;
    unitName?: string;
    residentName?: string;
    expectedArrival?: string;
    accessNote?: string;
    expiresAt?: number;
    visitDate?: string;
    checkedInAt?: number;
    validFrom?: number;
    expiredAt?: number;
}

const OFFLINE_CACHE_KEY = 'practicepro_sentrypass_cache';
const MAX_CACHE_SIZE = 100;
const GATEKEEPER_NAME_KEY = 'practicepro_gatekeeper_name';

const DENIAL_REASONS = [
    'Not on the list',
    'No valid pass',
    'Refused to identify',
    'Estate rules',
    'Resident unreachable',
];

const fmtTime = (ms?: number | null) =>
    ms ? new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : null;
const fmtDayTime = (ms?: number | null) =>
    ms ? new Date(ms).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : null;

/** Normalises gate input: uppercase, alphanumerics only. */
const cleanIdentifier = (raw: string) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** PIN = 6 pure digits. passRef = contains letters (12 chars when issued). */
const looksLikePin = (v: string) => v.length === 6 && /^\d{6}$/.test(v);

export const GatekeeperInterface: React.FC<{ firmId: string; onBack?: () => void }> = ({ firmId, onBack }) => {
    const convex = useConvex();
    const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
    const [identifier, setIdentifier] = useState('');        // PIN or passRef
    const [verification, setVerification] = useState<VerificationResult | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [offlineCache, setOfflineCache] = useState<any[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    // ── Denial recorder state (one panel, shared by both result states)
    const [denyOpen, setDenyOpen] = useState(false);
    const [denyReason, setDenyReason] = useState('');
    const [denyOther, setDenyOther] = useState('');
    const [denyDone, setDenyDone] = useState<string | null>(null);

    // ── Search state
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedTerm, setDebouncedTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[] | null>(null);
    const [isSearching, setIsSearching] = useState(false);

    // ── Arrival-request desk state
    const [requestFormOpen, setRequestFormOpen] = useState(false);
    const [reqVisitorName, setReqVisitorName] = useState('');
    const [reqUnit, setReqUnit] = useState('');
    const [reqPhone, setReqPhone] = useState('');
    const [reqNotes, setReqNotes] = useState('');
    const [reqSubmitting, setReqSubmitting] = useState(false);
    const [reqError, setReqError] = useState<string | null>(null);

    // ── Gate post name (stamped on check-ins, denials and requests)
    const [gatekeeperName, setGatekeeperName] = useState('');
    const [nameEditing, setNameEditing] = useState(false);
    const [nameDraft, setNameDraft] = useState('');

    // ─── Queries ────────────────────────────────────────────────────────
    const properties = useQuery(api.visitorManagement.getGatekeeperProperties, firmId ? { firmId } : 'skip');
    const logs = useQuery(
        api.visitorManagement.getGatehouseLogs,
        selectedPropertyId ? { propertyId: selectedPropertyId } : 'skip'
    );
    const requests = useQuery(
        api.sentryRequests.getGatehouseRequests,
        selectedPropertyId ? { propertyId: selectedPropertyId } : 'skip'
    );

    // ─── Mutations ──────────────────────────────────────────────────────
    const checkIn = useMutation(api.visitorManagement.checkInVisitor);
    const checkOut = useMutation(api.visitorManagement.checkOutVisitor);
    const denyEntry = useMutation(api.visitorManagement.recordDeniedEntry);
    const raiseRequest = useMutation(api.sentryRequests.createArrivalRequest);

    // ─── Online/offline detection ───────────────────────────────────────
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // ─── Load offline cache + gatekeeper name ───────────────────────────
    useEffect(() => {
        try {
            const cached = localStorage.getItem(OFFLINE_CACHE_KEY);
            if (cached) setOfflineCache(JSON.parse(cached));
        } catch {}
        try {
            setGatekeeperName(localStorage.getItem(GATEKEEPER_NAME_KEY) || '');
        } catch {}
    }, []);

    // ─── Auto-select first property ─────────────────────────────────────
    useEffect(() => {
        if (properties && properties.length > 0 && !selectedPropertyId) {
            setSelectedPropertyId(properties[0].id);
        }
    }, [properties]);

    // ─── Debounce the search box (400ms — kind to low-power hardware) ──
    useEffect(() => {
        const t = setTimeout(() => setDebouncedTerm(searchTerm.trim()), 400);
        return () => clearTimeout(t);
    }, [searchTerm]);

    // ─── Run the search when the term settles (≥2 chars) ───────────────
    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!selectedPropertyId || debouncedTerm.length < 2) {
                setSearchResults(null);
                return;
            }
            setIsSearching(true);
            try {
                const rows = await convex.query(api.visitorManagement.searchExpectedVisitors, {
                    propertyId: selectedPropertyId,
                    term: debouncedTerm,
                });
                if (!cancelled) setSearchResults(rows as any[]);
            } catch {
                if (!cancelled) setSearchResults([]);
            } finally {
                if (!cancelled) setIsSearching(false);
            }
        })();
        return () => { cancelled = true; };
    }, [debouncedTerm, selectedPropertyId, convex]);

    // ─── Verify code / passRef ──────────────────────────────────────────
    const handleVerify = useCallback(async (rawValue?: string) => {
        const value = cleanIdentifier(rawValue ?? identifier);
        if (!value || !selectedPropertyId) return;
        // Auto-mode only fires on complete identifiers; a manual press
        // verifies whatever is present (≥1 char).
        setIsVerifying(true);
        setVerification(null);
        setDenyOpen(false);
        setDenyDone(null);

        const asPin = looksLikePin(value);
        const payload = asPin
            ? { tokenCode: value, propertyId: selectedPropertyId }
            : { passRef: value, propertyId: selectedPropertyId };

        if (!isOnline) {
            // Offline fallback: check local cache.
            // SECURITY FIX: the cache previously approved a code FOREVER once
            // it had been verified online once — expired and revoked codes
            // kept passing at the gate while offline. Now a cached entry is
            // only honored while its own expiresAt is in the future.
            const cached = offlineCache.find(c => (c.tokenCode === value || c.passRef === value) && c.propertyId === selectedPropertyId);
            const cacheEntryStillValid = cached && typeof cached.expiresAt === 'number' && cached.expiresAt > Date.now();
            if (cached && !cacheEntryStillValid) {
                setVerification({
                    valid: false,
                    reason: 'expired',
                    message: 'This cached code has expired. Verify again once the device is back online.',
                });
                setIsVerifying(false);
                return;
            }
            if (cached) {
                setVerification({
                    valid: true,
                    tokenId: cached.tokenId,
                    visitorName: cached.visitorName,
                    estateName: cached.estateName,
                    address: cached.address,
                    unitName: cached.unitName,
                    residentName: cached.residentName,
                    expectedArrival: cached.expectedArrival,
                    accessNote: cached.accessNote,
                    expiresAt: cached.expiresAt,
                    visitDate: cached.visitDate,
                });
            } else {
                setVerification({
                    valid: false,
                    reason: 'offline',
                    message: 'Cannot verify — device is offline and code not in cache. Try again when online.',
                });
            }
            setIsVerifying(false);
            return;
        }

        try {
            const result = await convex.query(api.visitorManagement.verifyToken, payload as any);
            setVerification(result as VerificationResult);

            // Cache successful verifications for offline fallback
            if ((result as any)?.valid) {
                const r: any = result;
                const newCacheEntry = {
                    tokenId: r.tokenId,
                    tokenCode: asPin ? value : undefined,
                    passRef: asPin ? undefined : value,
                    propertyId: selectedPropertyId,
                    visitorName: r.visitorName,
                    estateName: r.estateName,
                    address: r.address,
                    unitName: r.unitName,
                    residentName: r.residentName,
                    expectedArrival: r.expectedArrival,
                    accessNote: r.accessNote,
                    expiresAt: r.expiresAt,
                    visitDate: r.visitDate,
                    cachedAt: Date.now(),
                };
                const updatedCache = [newCacheEntry, ...offlineCache].slice(0, MAX_CACHE_SIZE);
                setOfflineCache(updatedCache);
                localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(updatedCache));
            }
        } catch (err: any) {
            setVerification({
                valid: false,
                reason: 'error',
                message: err.message || 'Verification failed. Check your connection.',
            });
        } finally {
            setIsVerifying(false);
        }
    }, [identifier, selectedPropertyId, isOnline, offlineCache, convex]);

    // ─── Identifier input: normalise + auto-verify on complete ──────────
    const onIdentifierChange = (raw: string) => {
        const value = cleanIdentifier(raw);
        setIdentifier(value);
        setVerification(null);
        setDenyOpen(false);
        setDenyDone(null);
        if (!selectedPropertyId || isVerifying) return;
        if (looksLikePin(value) || (/[A-Z]/.test(value) && value.length >= 12)) {
            handleVerify(value);
        }
    };

    // ─── Approve entry (check in) ───────────────────────────────────────
    const handleApproveEntry = async () => {
        if (!verification || !identifier || !selectedPropertyId) return; // ROUND A (C8): check-in carries the typed identifier (possession proof)
        const asPin = looksLikePin(identifier);
        try {
            await checkIn({
                tokenCode: asPin ? identifier : undefined,
                passRef: asPin ? undefined : identifier,
                propertyId: selectedPropertyId,
                gatekeeperName: gatekeeperName || 'Gatekeeper',
            });
            setVerification({ ...verification, valid: false, reason: 'checked_in', message: `${verification.visitorName} checked in successfully.` });
            setIdentifier('');
            inputRef.current?.focus();
        } catch (err: any) {
            setVerification({ ...verification, valid: false, reason: 'error', message: err.message });
        }
    };

    // ─── Check out ──────────────────────────────────────────────────────
    const handleCheckOut = async (tokenCode: string) => { // ROUND A (C8): code + property, not a bare tokenId
        if (!tokenCode || !selectedPropertyId) return;
        try {
            await checkOut({ tokenCode, propertyId: selectedPropertyId });
        } catch (err: any) {
            console.error('Checkout failed:', err);
        }
    };

    // ─── Record a denial (§3: one tap + one reason, that's it) ──────────
    const submitDenial = async () => {
        const reason = denyReason === 'Other' ? denyOther.trim() : denyReason;
        if (!reason) return;
        try {
            await denyEntry({
                propertyId: selectedPropertyId,
                propertyName: properties?.find((p: any) => p.id === selectedPropertyId)?.name,
                tokenCode: looksLikePin(identifier) ? identifier : undefined,
                passRef: looksLikePin(identifier) ? undefined : /[A-Z]/.test(identifier) ? identifier : undefined,
                visitorName: verification?.visitorName || undefined,
                reason,
                gatekeeperName: gatekeeperName || 'Gatekeeper',
            });
            setDenyDone(reason);
            setDenyOpen(false);
            setDenyReason('');
            setDenyOther('');
            setIdentifier('');
            inputRef.current?.focus();
        } catch (err: any) {
            setDenyDone(null);
            setDenyOpen(false);
            console.error('Denial recording failed:', err);
        }
    };

    // ─── Raise an arrival request (§2 gatehouse side) ───────────────────
    const submitRequest = async () => {
        if (!reqVisitorName.trim() || !reqUnit.trim() || !selectedPropertyId || !firmId) return;
        setReqSubmitting(true);
        setReqError(null);
        try {
            await raiseRequest({
                firmId,
                propertyId: selectedPropertyId,
                unitLabel: reqUnit.trim(),
                visitorName: reqVisitorName.trim(),
                visitorPhone: reqPhone.trim() || undefined,
                notes: reqNotes.trim() || undefined,
                requestedBy: gatekeeperName || 'Gatehouse',
            });
            setReqVisitorName('');
            setReqUnit('');
            setReqPhone('');
            setReqNotes('');
            setRequestFormOpen(false);
        } catch (err: any) {
            setReqError(err.message || 'Could not raise the request.');
        } finally {
            setReqSubmitting(false);
        }
    };

    const saveGatekeeperName = () => {
        const v = nameDraft.trim().slice(0, 80);
        setGatekeeperName(v);
        try { localStorage.setItem(GATEKEEPER_NAME_KEY, v); } catch {}
        setNameEditing(false);
    };

    // ─── Render ─────────────────────────────────────────────────────────

    // If no firmId provided, show a setup message
    if (!firmId) {
        return (
            <div className="min-h-[100dvh] bg-slate-100 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center mb-4">
                    <GateIcon className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Sentry Pass Terminal</h1>
                <p className="text-sm text-slate-500 dark:text-zinc-400 max-w-md mb-4">
                    This terminal verifies visitor access codes. To activate it,
                    your property manager needs to provide the Sentry Pass URL with
                    a firm identifier.
                </p>
                <p className="text-xs text-slate-400 dark:text-zinc-500">
                    The URL should look like: <code className="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-800 rounded">/gatehouse?firmId=YOUR_FIRM_ID</code>
                </p>
            </div>
        );
    }

    const statusBadge = (log: any) => {
        if (log.status === 'used' && log.checkedOutAt) return { cls: 'bg-slate-100 text-slate-500 dark:bg-zinc-700 dark:text-zinc-400', label: 'Completed' };
        if (log.status === 'used') return { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Inside' };
        if (log.status === 'revoked') return { cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', label: 'Revoked' };
        if (log.status === 'expired') return { cls: 'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400', label: 'Expired' };
        return { cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', label: 'Active' };
    };

    return (
        <div className="min-h-[100dvh] bg-slate-100 dark:bg-zinc-950 flex flex-col">
            {/* Header */}
            <div className="flex-shrink-0 bg-white dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-700 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {onBack && (
                        <button onClick={onBack} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    )}
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                        <GateIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="font-black text-slate-900 dark:text-white text-base">Sentry Pass</h1>
                        <p className="text-2xs text-slate-500 dark:text-zinc-400">Visitor Verification</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Online/offline indicator */}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-2xs font-bold ${
                        isOnline ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'} ${isOnline ? '' : 'animate-pulse'}`} />
                        {isOnline ? 'Online' : 'Offline'}
                    </div>
                    {/* Gate post name (stamped on every check-in / denial / request) */}
                    {nameEditing ? (
                        <div className="flex items-center gap-1">
                            <Input
                                value={nameDraft}
                                onChange={(e: any) => setNameDraft(e.target.value)}
                                placeholder="e.g. Main Gate"
                                className="!w-36 !py-1 !text-2xs"
                                autoFocus
                            />
                            <Button size="sm" variant="primary" onClick={saveGatekeeperName}>Set</Button>
                        </div>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setNameDraft(gatekeeperName); setNameEditing(true); }}
                            className="!rounded-full !text-2xs"
                            title="Name this gate post — stamped on check-ins, denials and requests"
                        >
                            {gatekeeperName ? `Post: ${gatekeeperName}` : 'Name this post'}
                        </Button>
                    )}
                </div>
            </div>

            {/* Property selector */}
            {properties && properties.length > 1 && (
                <div className="flex-shrink-0 px-4 py-2 bg-white dark:bg-zinc-900 border-b border-slate-100 dark:border-zinc-800">
                    <select
                        value={selectedPropertyId}
                        onChange={(e) => setSelectedPropertyId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/30"
                    >
                        {properties.map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Main content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Code / passRef input */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-soft p-6">
                    <label className="block text-2xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2 text-center">
                        6-Digit Code or Pass ID
                    </label>
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode="text"
                        autoCapitalize="characters"
                        autoComplete="off"
                        maxLength={12}
                        value={identifier}
                        onChange={(e) => onIdentifierChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                        placeholder="000000"
                        className="w-full text-center text-4xl font-black tracking-[0.25em] py-5 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-200 dark:border-zinc-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-zinc-700 uppercase focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-400 outline-none transition-all"
                        autoFocus
                    />
                    <p className="text-center text-3xs text-slate-400 dark:text-zinc-500 mt-2 font-bold uppercase tracking-wider">
                        PIN auto-verifies at 6 digits · Pass ID at 12
                    </p>
                    <button
                        onClick={() => handleVerify()}
                        disabled={!identifier || isVerifying || !selectedPropertyId}
                        className="w-full mt-4 px-6 py-3.5 bg-emerald-600 text-white rounded-lg font-bold text-base hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed transition-colors"
                    >
                        {isVerifying ? 'Verifying...' : 'Verify'}
                    </button>
                </div>

                {/* Verification result */}
                {verification && (
                    <div className={`rounded-2xl shadow-soft p-6 animate-in fade-in zoom-in duration-300 ${
                        verification.valid
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-300 dark:border-emerald-700'
                            : 'bg-rose-50 dark:bg-rose-900/20 border-2 border-rose-300 dark:border-rose-700'
                    }`}>
                        {verification.valid ? (
                            <>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                                        <CheckIcon className="w-7 h-7 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-emerald-700 dark:text-emerald-400">Valid Entry</h2>
                                        <p className="text-sm text-emerald-600 dark:text-emerald-500">Code verified successfully</p>
                                    </div>
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center gap-2 text-sm">
                                        <UserIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                        <span className="font-bold text-slate-900 dark:text-white">{verification.visitorName}</span>
                                    </div>
                                    {verification.unitName && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <MapPinIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                            <span className="text-slate-700 dark:text-zinc-300">Going to: {verification.unitName}</span>
                                        </div>
                                    )}
                                    {verification.residentName && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <UserIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                            <span className="text-slate-700 dark:text-zinc-300">Host: {verification.residentName}</span>
                                        </div>
                                    )}
                                    {verification.expectedArrival && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <ClockIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                            <span className="text-slate-700 dark:text-zinc-300">Expected around {verification.expectedArrival}</span>
                                        </div>
                                    )}
                                    {verification.expiresAt && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <ClockIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                            <span className="text-slate-700 dark:text-zinc-300">Valid until: {new Date(verification.expiresAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                    )}
                                </div>
                                {/* Resident's access instructions (§3) */}
                                {verification.accessNote && (
                                    <div className="flex items-start gap-2 mb-4 p-3 rounded-lg bg-white/70 dark:bg-zinc-800/60 border border-emerald-200 dark:border-emerald-800">
                                        <InfoIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-2xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-0.5">Access instructions</p>
                                            <p className="text-sm text-slate-700 dark:text-zinc-300">{verification.accessNote}</p>
                                        </div>
                                    </div>
                                )}
                                <button
                                    onClick={handleApproveEntry}
                                    className="w-full px-6 py-3.5 bg-emerald-600 text-white rounded-lg font-bold text-base hover:bg-emerald-700 transition-colors"
                                >
                                    Approve Entry
                                </button>
                                <Button
                                    variant="danger-soft"
                                    size="md"
                                    className="w-full mt-2"
                                    onClick={() => { setDenyOpen(v => !v); setDenyDone(null); }}
                                >
                                    Deny entry instead
                                </Button>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 bg-rose-500 rounded-full flex items-center justify-center flex-shrink-0">
                                        <XCircleIcon className="w-7 h-7 text-white" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-black text-rose-700 dark:text-rose-400">
                                            {verification.reason === 'expired' ? 'Code Expired' :
                                             verification.reason === 'revoked' ? 'Code Revoked' :
                                             verification.reason === 'used' ? 'Already Used' :
                                             verification.reason === 'already_inside' ? 'Already Inside' :
                                             verification.reason === 'not_yet_valid' ? 'Not Yet Valid' :
                                             verification.reason === 'checked_in' ? 'Checked In' :
                                             verification.reason === 'offline' ? 'Offline Mode' :
                                             verification.reason === 'rate_limited' ? 'Wait a Moment' :
                                             'Invalid Code'}
                                        </h2>
                                        <p className="text-sm text-rose-600 dark:text-rose-500">{verification.message}</p>
                                    </div>
                                </div>
                                {/* §3: record the denial — one tap + one reason */}
                                {verification.reason !== 'checked_in' && (
                                    <Button
                                        variant="danger"
                                        size="md"
                                        className="w-full mt-4"
                                        onClick={() => { setDenyOpen(v => !v); setDenyDone(null); }}
                                    >
                                        Record denied entry
                                    </Button>
                                )}
                            </>
                        )}

                        {/* Shared denial recorder (valid-but-suspect AND invalid states) */}
                        {denyOpen && (
                            <div className="mt-4 p-4 rounded-lg bg-white dark:bg-zinc-800 border border-rose-200 dark:border-rose-900 space-y-3">
                                <p className="text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Reason for denial</p>
                                <div className="flex flex-wrap gap-2">
                                    {DENIAL_REASONS.map(r => (
                                        <Button
                                            key={r}
                                            size="sm"
                                            variant={denyReason === r ? 'danger' : 'ghost'}
                                            onClick={() => setDenyReason(r)}
                                            className="!rounded-full !text-2xs"
                                        >
                                            {r}
                                        </Button>
                                    ))}
                                    <Button
                                        size="sm"
                                        variant={denyReason === 'Other' ? 'danger' : 'ghost'}
                                        onClick={() => setDenyReason('Other')}
                                        className="!rounded-full !text-2xs"
                                    >
                                        Other…
                                    </Button>
                                </div>
                                {denyReason === 'Other' && (
                                    <Textarea
                                        value={denyOther}
                                        onChange={(e: any) => setDenyOther(e.target.value)}
                                        placeholder="One line the estate admin will read…"
                                        maxLength={200}
                                        rows={2}
                                        className="!text-sm"
                                    />
                                )}
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="md" className="flex-1" onClick={() => setDenyOpen(false)}>Cancel</Button>
                                    <Button
                                        variant="danger"
                                        size="md"
                                        className="flex-1"
                                        disabled={!denyReason || (denyReason === 'Other' && !denyOther.trim())}
                                        onClick={submitDenial}
                                    >
                                        Record denial
                                    </Button>
                                </div>
                            </div>
                        )}
                        {denyDone && (
                            <p className="mt-3 text-center text-2xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                                Denial recorded · “{denyDone}” · visible in the security report
                            </p>
                        )}
                    </div>
                )}

                {/* Fast search (§3: search expected visitors) */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-soft p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <SearchIcon className="w-4 h-4 text-slate-400" />
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">Find expected visitor</h3>
                    </div>
                    <Input
                        value={searchTerm}
                        onChange={(e: any) => setSearchTerm(e.target.value)}
                        placeholder="Name, code or Pass ID…"
                        className="!text-base"
                    />
                    {isSearching && <p className="text-2xs text-slate-400 mt-2">Searching…</p>}
                    {searchResults && searchResults.length === 0 && !isSearching && debouncedTerm.length >= 2 && (
                        <p className="text-2xs text-slate-400 mt-2">No expected visitor matches “{debouncedTerm}” today.</p>
                    )}
                    {searchResults && searchResults.length > 0 && (
                        <div className="space-y-1.5 mt-3 max-h-64 overflow-y-auto">
                            {searchResults.map((hit: any, i: number) => {
                                const badge = statusBadge(hit);
                                return (
                                    <div key={i} className="py-2 px-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{hit.visitorName}</span>
                                                    <span className="text-2xs font-mono text-slate-400">{hit.tokenCode}{hit.passRef ? ` · ${hit.passRef}` : ''}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                                    {hit.unitName && <span>Unit {hit.unitName}</span>}
                                                    {hit.residentName && <span>· host {hit.residentName}</span>}
                                                    {hit.expectedArrival && <span>· ~{hit.expectedArrival}</span>}
                                                    {hit.checkedInAt && <span className="text-emerald-600 dark:text-emerald-400">· in {fmtTime(hit.checkedInAt)}</span>}
                                                    {hit.checkedOutAt && <span className="text-slate-400">· out {fmtTime(hit.checkedOutAt)}</span>}
                                                </div>
                                                {hit.accessNote && (
                                                    <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5 italic">“{hit.accessNote}”</p>
                                                )}
                                            </div>
                                            <span className={`text-3xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${badge.cls}`}>{badge.label}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Arrival-request desk (§2 gatehouse side) */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-soft p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">No pass? Raise a request</h3>
                        <Button size="sm" variant={requestFormOpen ? 'ghost' : 'primary'} onClick={() => setRequestFormOpen(v => !v)}>
                            {requestFormOpen ? 'Close' : 'New request'}
                        </Button>
                    </div>
                    <p className="text-2xs text-slate-500 dark:text-zinc-400 mb-3">
                        The resident is notified in-app and approves from their portal. Approval mints a pass for today — the board below shows the decision.
                    </p>
                    {requestFormOpen && (
                        <div className="space-y-3 p-3 rounded-lg bg-slate-50 dark:bg-zinc-800/60">
                            <Input value={reqVisitorName} onChange={(e: any) => setReqVisitorName(e.target.value)} placeholder="Visitor name *" />
                            <Input value={reqUnit} onChange={(e: any) => setReqUnit(e.target.value)} placeholder="Unit they're visiting * (e.g. Flat 3B)" />
                            <Input value={reqPhone} onChange={(e: any) => setReqPhone(e.target.value)} placeholder="Visitor phone (optional — pass is WhatsApped on approval)" />
                            <Textarea value={reqNotes} onChange={(e: any) => setReqNotes(e.target.value)} placeholder="Context for the resident (optional)" rows={2} maxLength={200} />
                            {reqError && <p className="text-2xs font-bold text-rose-600 dark:text-rose-400">{reqError}</p>}
                            <Button
                                variant="primary"
                                size="md"
                                className="w-full"
                                disabled={!reqVisitorName.trim() || !reqUnit.trim() || reqSubmitting}
                                onClick={submitRequest}
                            >
                                {reqSubmitting ? 'Raising…' : 'Raise request to resident'}
                            </Button>
                        </div>
                    )}
                    {requests && requests.length > 0 && (
                        <div className="space-y-1.5 mt-3 max-h-56 overflow-y-auto">
                            {requests.map((r: any) => (
                                <div key={r.requestId} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">{r.visitorName}</span>
                                            {r.unitName && <span className="text-2xs text-slate-500 dark:text-zinc-400">· {r.unitName}</span>}
                                        </div>
                                        <div className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                            Asked {fmtDayTime(r.requestedAt)} by {r.requestedBy}
                                            {r.decidedAt && ` · decided ${fmtTime(r.decidedAt)}`}
                                        </div>
                                        {r.notes && <p className="text-2xs text-slate-500 dark:text-zinc-400 mt-0.5 italic">“{r.notes}”</p>}
                                    </div>
                                    <span className={`text-3xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                                        r.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                        r.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                        r.status === 'rejected' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
                                        'bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
                                    }`}>
                                        {r.status === 'pending' ? 'Awaiting resident' :
                                         r.status === 'approved' ? 'Approved — pass sent' :
                                         r.status === 'rejected' ? 'Rejected' : 'Expired'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Today's logs */}
                {logs && logs.length > 0 && (
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-soft p-4">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-3">Today's Activity ({logs.length})</h3>
                        <div className="space-y-1.5 max-h-64 overflow-y-auto">
                            {logs.map((log: any) => {
                                const badge = statusBadge(log);
                                return (
                                    <div key={log._id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-zinc-800/50">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{log.visitorName}</span>
                                                <span className="text-2xs font-mono text-slate-400">{log.tokenCode}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-2xs text-slate-500 dark:text-zinc-400 mt-0.5">
                                                {log.checkedInAt && <span>In: {new Date(log.checkedInAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
                                                {log.checkedOutAt && <span>Out: {new Date(log.checkedOutAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
                                                {!log.checkedInAt && <span className="text-amber-500">Pending</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <span className={`text-3xs px-2 py-0.5 rounded-full font-bold ${badge.cls}`}>{badge.label}</span>
                                            {log.status === 'used' && log.checkedInAt && !log.checkedOutAt && (
                                                <button
                                                    onClick={() => handleCheckOut(log.tokenCode)}
                                                    className="text-3xs px-2 py-0.5 bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-full font-bold hover:bg-slate-200 dark:hover:bg-zinc-600"
                                                >
                                                    Check Out
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
